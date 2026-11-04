<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Produk;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProdukController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Produk::query();
        if ($request->has('kategori')) {
            $query->where('kategori', $request->input('kategori'));
        }
        return response()->json($query->orderByDesc('id')->get());
    }

    public function show(string $id): JsonResponse
    {
        $produk = Produk::findOrFail($id);
        return response()->json($produk);
    }

    public function store(Request $request): JsonResponse
    {
        $this->validateStockWrites($request);
        $produk = Produk::create($request->all());
        return response()->json($produk, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $produk = Produk::findOrFail($id);
        $this->validateStockWrites($request, $produk);
        $produk->update($request->all());
        return response()->json($produk);
    }

    private function validateStockWrites(Request $request, ?Produk $product = null): void
    {
        // stok_3 boleh ditimpa langsung dari API (impor/koreksi). Riwayat
        // log_stock di-anchor ulang oleh ProdukObserver::saved().
        $user = $request->attributes->get('pocketbase_user');
        if (!$user) return;
        $level = (int) ($user['level'] ?? 0);
        foreach (['beli' => [1], 'stok_1' => [1,5], 'stok_2' => [1,6,7,10]] as $field => $levels) {
            if (!$product && $field === 'stok_1') continue;
            if ($request->has($field) && (float) $request->input($field) !== (float) ($product?->$field ?? 0)) abort_unless(in_array($level, $levels, true), 403);
        }
    }

    public function destroy(string $id): JsonResponse
    {
        $produk = Produk::findOrFail($id);
        $produk->delete();
        return response()->json(['message' => 'Produk deleted successfully']);
    }
}
