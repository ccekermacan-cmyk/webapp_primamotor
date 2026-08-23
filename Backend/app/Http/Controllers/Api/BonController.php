<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BonController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Bon::query();
        if ($request->has('ref_menu')) {
            $query->where('ref_menu', $request->input('ref_menu'));
        }
        if ($request->has('ref_cashflow')) {
            $query->where('ref_cashflow', $request->input('ref_cashflow'));
        }
        return response()->json($query->latest('created_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $bon = Bon::findOrFail($id);
        return response()->json($bon);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->all();
        $bon = DB::transaction(function () use ($validated) {
            return Bon::create($validated);
        });
        return response()->json($bon, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $bon = Bon::findOrFail($id);
        $validated = $request->all();
        DB::transaction(function () use ($bon, $validated) {
            $bon->update($validated);
        });
        return response()->json($bon);
    }

    public function destroy(string $id): JsonResponse
    {
        $bon = Bon::findOrFail($id);
        DB::transaction(function () use ($bon) {
            $bon->delete();
        });
        return response()->json(['message' => 'Bon deleted successfully']);
    }
}
