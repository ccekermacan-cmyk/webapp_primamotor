<?php

namespace App\Services\Webhooks;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WebhookIdempotencyService
{
    public function ensureMarksTable(): void
    {
        DB::statement('CREATE TABLE IF NOT EXISTS webhook_marks (key TEXT PRIMARY KEY, created_at TEXT)');
    }

    public function createdMarkKey(string $collection, string $id): string
    {
        return strtolower($collection) . ':created:' . $id;
    }

    public function markKey(string $collection, string $event, string $id, array $payload = []): string
    {
        $key = strtolower($collection) . ':' . $event . ':' . $id;
        if ($event === 'updated') {
            $key .= ':' . md5(json_encode($payload));
        }
        return $key;
    }

    public function hasMark(string $key): bool
    {
        return DB::table('webhook_marks')->where('key', $key)->exists();
    }

    public function addMark(string $key): void
    {
        try {
            DB::table('webhook_marks')->insertOrIgnore([
                'key' => $key,
                'created_at' => now('UTC')->format('Y-m-d H:i:s.u\Z'),
            ]);
        } catch (\Throwable $e) {
            Log::error('webhook mark insert failed: ' . $e->getMessage());
        }
    }

    public function removeMark(string $key): void
    {
        DB::table('webhook_marks')->where('key', $key)->delete();
    }
}
