<?php

namespace App\Observers;

use App\Models\Bon;
use App\Models\Dropdown;
use Illuminate\Support\Facades\DB;

class BonObserver
{
    private function firstId($raw): string
    {
        if (!$raw) return '';
        $s = trim((string) $raw);
        if (str_starts_with($s, '[')) {
            try {
                $arr = json_decode($s, true);
                return (!empty($arr) && is_array($arr)) ? (string) $arr[0] : '';
            } catch (\Throwable $e) {
                return '';
            }
        }
        return $s;
    }

    private function getDelta(string $jenis, float $nominal): float
    {
        return strtolower($jenis) === 'out' ? abs($nominal) : -abs($nominal);
    }

    private function apply(array $data, int $direction): void
    {
        $nominal = (float) ($data['nominal'] ?? 0);
        $delta = $direction * $this->getDelta((string) ($data['jenis'] ?? 'in'), $nominal);
        $personId = $this->firstId($data['person'] ?? null);
        $userId = $this->firstId($data['user'] ?? null);
        if (!$userId && $personId) {
            $name = DB::table('dropdown')->where('id', $personId)->value('text_1');
            if ($name) $userId = (string) DB::table('user')
                ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($name))])
                ->orWhereRaw('LOWER(TRIM(username)) = ?', [strtolower(trim($name))])->value('id');
        }
        if ($delta != 0) {
            if ($personId) DB::table('dropdown')->where('id', $personId)->increment('number_1', $delta);
            if ($userId) DB::table('user')->where('id', $userId)->increment('number', $delta);
        }
    }

    public function created(Bon $bon): void
    {
        $this->apply($bon->getAttributes(), 1);
    }

    public function updated(Bon $bon): void
    {
        $this->apply($bon->getRawOriginal(), -1);
        $this->apply($bon->getAttributes(), 1);
    }

    public function deleted(Bon $bon): void
    {
        $this->apply($bon->getAttributes(), -1);
    }
}
