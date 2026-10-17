<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class AuthenticatePocketBase
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if (!$token) return response()->json(['message' => 'Autentikasi diperlukan.'], 401);
        try {
            $auth = Http::timeout(8)->withToken($token)
                ->post(rtrim(config('services.pocketbase.url'), '/') . '/api/collections/user/auth-refresh', new \stdClass);
        } catch (\Throwable $error) {
            return response()->json(['message' => 'Layanan autentikasi tidak tersedia. Periksa POCKETBASE_URL dan koneksi Laravel ke PocketBase.'], 503);
        }
        if ($auth->serverError() || $auth->status() === 404) {
            return response()->json(['message' => 'Layanan autentikasi PocketBase belum tersedia. Periksa POCKETBASE_URL.'], 503);
        }
        if (!$auth->successful()) return response()->json(['message' => 'Sesi tidak valid.'], 401);
        $user = $auth->json('record');
        if (!is_array($user) || empty($user['id'])) return response()->json(['message' => 'Respons autentikasi PocketBase tidak valid. Periksa POCKETBASE_URL.'], 503);
        if (strtolower($user['status'] ?? '') !== 'active') {
            return response()->json(['message' => 'Akun tidak aktif.'], 403);
        }
        if ($request->is('api/reports*') && !in_array((int) ($user['level'] ?? 0), [1, 2, 3, 4, 5, 6], true)) {
            return response()->json(['message' => 'Akses laporan tidak diizinkan.'], 403);
        }
        if (($request->is('api/bons*') || $request->is('api/transactions/bon/*')) && !in_array((int) ($user['level'] ?? 0), [1, 2, 3, 4, 5, 6], true)) {
            return response()->json(['message' => 'Gunakan riwayat bon pribadi pada halaman akun.'], 403);
        }
        if ($request->is('api/dropdowns*') && !in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true) && (int) ($user['level'] ?? 0) !== 1) {
            return response()->json(['message' => 'Perubahan master akun hanya diizinkan untuk administrator.'], 403);
        }
        if ($request->is('api/produks/*') && $request->isMethod('DELETE') && (int) ($user['level'] ?? 0) !== 1) {
            return response()->json(['message' => 'Hanya administrator dapat menghapus produk.'], 403);
        }
        $request->attributes->set('pocketbase_user', $user);
        return $next($request);
    }
}
