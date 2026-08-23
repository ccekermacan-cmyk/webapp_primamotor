<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LogStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LogStockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LogStock::query();
        if ($request->has('item_baru')) {
            $query->where('item_baru', $request->input('item_baru'));
        }
        if ($request->has('ref_baru')) {
            $query->where('ref_baru', $request->input('ref_baru'));
        }
        return response()->json($query->latest('created_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $logStock = LogStock::findOrFail($id);
        return response()->json($logStock);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->all();
        $logStock = DB::transaction(function () use ($validated) {
            return LogStock::create($validated);
        });
        return response()->json($logStock, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $logStock = LogStock::findOrFail($id);
        $validated = $request->all();
        DB::transaction(function () use ($logStock, $validated) {
            $logStock->update($validated);
        });
        return response()->json($logStock);
    }

    public function destroy(string $id): JsonResponse
    {
        $logStock = LogStock::findOrFail($id);
        DB::transaction(function () use ($logStock) {
            $logStock->delete();
        });
        return response()->json(['message' => 'LogStock deleted successfully']);
    }
}
