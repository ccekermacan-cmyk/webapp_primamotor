<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ongkos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OngkosController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Ongkos::query();
        if ($request->has('ref_baru')) {
            $query->where('ref_baru', $request->input('ref_baru'));
        }
        return response()->json($query->latest('created_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $ongkos = Ongkos::findOrFail($id);
        return response()->json($ongkos);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->all();
        $ongkos = DB::transaction(function () use ($validated) {
            return Ongkos::create($validated);
        });
        return response()->json($ongkos, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $ongkos = Ongkos::findOrFail($id);
        $validated = $request->all();
        DB::transaction(function () use ($ongkos, $validated) {
            $ongkos->update($validated);
        });
        return response()->json($ongkos);
    }

    public function destroy(string $id): JsonResponse
    {
        $ongkos = Ongkos::findOrFail($id);
        DB::transaction(function () use ($ongkos) {
            $ongkos->delete();
        });
        return response()->json(['message' => 'Ongkos deleted successfully']);
    }
}
