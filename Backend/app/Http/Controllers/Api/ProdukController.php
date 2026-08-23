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
        return response()->json($query->latest('updated_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $produk = Produk::findOrFail($id);
        return response()->json($produk);
    }

    public function store(Request $request): JsonResponse
    {
        $produk = Produk::create($request->all());
        return response()->json($produk, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $produk = Produk::findOrFail($id);
        $produk->update($request->all());
        return response()->json($produk);
    }

    public function destroy(string $id): JsonResponse
    {
        $produk = Produk::findOrFail($id);
        $produk->delete();
        return response()->json(['message' => 'Produk deleted successfully']);
    }
}
