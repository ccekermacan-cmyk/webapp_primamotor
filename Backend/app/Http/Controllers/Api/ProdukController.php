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
        if ($request->has('stok_3') && (float) $request->input('stok_3') !== (float) ($product?->stok_3 ?? 0)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['stok_3' => 'Gunakan log_stock untuk perubahan stok.']);
        }
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
