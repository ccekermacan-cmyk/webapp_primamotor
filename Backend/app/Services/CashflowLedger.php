<?php

namespace App\Services;

use App\Models\Cashflow;
use App\Models\Dropdown;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashflowLedger
{
    public function accountId($value): string
    {
        if (is_array($value)) $value = $value[0] ?? '';
        $value = (string) $value;
        if (str_starts_with($value, '[')) $value = json_decode($value, true)[0] ?? '';
        if (!$value) return '';
        return (string) (Dropdown::where('id', $value)->orWhere('id_lama', $value)->value('id') ?? '');
    }

    public function validate(Cashflow $record): void
    {
        $nominal = (float) $record->nominal;
        $direction = strtolower((string) $record->mutasi);
        $direction = match ($direction) { 'masuk' => 'in', 'keluar' => 'out', default => $direction };
        if (!is_finite($nominal) || $nominal <= 0) $this->fail('nominal', 'Nominal harus lebih dari nol.');
        if (!in_array($direction, ['in', 'out'], true)) $this->fail('mutasi', 'Mutasi tidak valid.');
        $source = $this->accountId($record->account_1 ?: $record->acc1);
        $this->authorizeAccounts([$source]);
        if (!$source) $this->fail('account_1', 'Akun sumber tidak ditemukan.');
        $record->mutasi = $direction;
        $record->account_1 = $source;
        if ($this->isTransfer($record->getAttributes())) {
            $target = $this->accountId($record->account_2 ?: $record->acc2);
            $record->account_2 = $target;
            $this->authorizeAccounts([$target]);
            if ($direction !== 'out') $this->fail('mutasi', 'Transfer harus berupa mutasi keluar dari akun sumber.');
            if (!$target || $target === $source) $this->fail('account_2', 'Akun tujuan harus berbeda dari akun sumber.');
        } elseif (strtolower((string) $record->jenis) !== 'bonkaryawan') {
            $record->account_2 = '';
            $record->acc2 = '';
        }
    }

    public function isTransfer(array $data): bool
    {
        return str_contains(strtolower((string) ($data['jenis'] ?? '')), 'transfer');
    }

    public function deltas(array $data, bool $legacy = false): array
    {
        $source = $this->accountId(($data['account_1'] ?? '') ?: ($data['acc1'] ?? ''));
        $target = $this->accountId(($data['account_2'] ?? '') ?: ($data['acc2'] ?? ''));
        $direction = strtolower((string) ($data['mutasi'] ?? ''));
        $amount = (float) ($data['nominal'] ?? 0);
        $out = in_array($direction, ['out', 'keluar'], true);
        $deltas = [];
        if ($source) $deltas[$source] = $out ? -$amount : $amount;
        if ($out && $target && ($legacy || $this->isTransfer($data))) $deltas[$target] = ($deltas[$target] ?? 0) + $amount;
        return $deltas;
    }

    public function apply(Cashflow $record, string $event): void
    {
        if ($event !== 'deleted') $this->validate($record);
        $deltas = $event === 'deleted' ? [] : $this->deltas($record->getAttributes());
        if ($event !== 'created') {
            $old = $event === 'deleted' ? $record->getAttributes() : $record->getRawOriginal();
            foreach ($this->deltas($old, true) as $id => $amount) $deltas[$id] = ($deltas[$id] ?? 0) - $amount;
        }
        $this->authorizeAccounts(array_keys($deltas));
        DB::transaction(function () use ($deltas) {
            // All accounts are checked before any delta is committed. SQL guards also prevent races.
            foreach ($deltas as $id => $amount) {
                if ($amount < 0 && (float) DB::table('dropdown')->where('id', $id)->value('number_1') + $amount < -0.00001) {
                    $this->fail('nominal', 'Saldo akun tidak cukup untuk perubahan ini.');
                }
            }
            foreach ($deltas as $id => $amount) {
                if ($amount < 0) {
                    $count = DB::table('dropdown')->where('id', $id)->where('number_1', '>=', -$amount)->decrement('number_1', -$amount);
                    if ($count !== 1) $this->fail('nominal', 'Saldo berubah; silakan muat ulang transaksi.');
                } elseif ($amount > 0) DB::table('dropdown')->where('id', $id)->increment('number_1', $amount);
            }
        });
        if ($event !== 'deleted') $record->saveQuietly();
        $this->rebuild(array_keys($deltas), $event === 'deleted' ? (string) $record->id : null);
    }

    public function rebuild(array $accountIds, ?string $excludeId = null): void
    {
        foreach (array_unique($accountIds) as $accountId) {
            $rows = Cashflow::where(fn ($q) => $q->where('account_1', $accountId)->orWhere('account_2', $accountId)->orWhere('acc1', $accountId)->orWhere('acc2', $accountId))
                ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
                ->orderByRaw('datetime(created_at)')->orderBy('id')->get();
            $movement = $rows->sum(fn ($row) => $this->deltas($row->getAttributes())[$accountId] ?? 0);
            $running = (float) DB::table('dropdown')->where('id', $accountId)->value('number_1') - $movement;
            foreach ($rows as $row) {
                $opening = $running;
                $running += $this->deltas($row->getAttributes())[$accountId] ?? 0;
                if ($this->accountId($row->account_1 ?: $row->acc1) === $accountId) {
                    DB::table('cashflow')->where('id', $row->id)->update(['saldo_awal' => $opening, 'saldo_akhir' => $running]);
                }
            }
        }
    }

    private function authorizeAccounts(array $ids): void
    {
        $user = request()->attributes->get('pocketbase_user');
        if (!$user || (int) ($user['level'] ?? 0) === 1) return;
        foreach (array_filter($ids) as $id) {
            $account = Dropdown::find($id);
            $contains = fn ($value, $token) => in_array((string) $token, array_map('trim', explode(',', (string) $value)), true);
            abort_unless($account && $contains($account->visibilitas, $user['level'] ?? '') && $contains($account->enum_1, $user['username'] ?? ''), 403, 'Anda tidak memiliki akses ke akun ini.');
        }
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
