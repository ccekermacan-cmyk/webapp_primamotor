<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cashflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashflowController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Cashflow::query();
        if ($request->has('ref_baru')) {
            $query->where('ref_baru', $request->input('ref_baru'));
        }
        return response()->json($query->latest('created_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $cashflow = Cashflow::findOrFail($id);
        return response()->json($cashflow);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->all();
        $cashflow = DB::transaction(function () use ($validated) {
            return Cashflow::create($validated);
        });
        return response()->json($cashflow, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $cashflow = Cashflow::findOrFail($id);
        $validated = $request->all();
        DB::transaction(function () use ($cashflow, $validated) {
            $cashflow->update($validated);
        });
        return response()->json($cashflow);
    }

    public function destroy(string $id): JsonResponse
    {
        $cashflow = Cashflow::findOrFail($id);
        DB::transaction(function () use ($cashflow) {
            $cashflow->delete();
        });
        return response()->json(['message' => 'Cashflow deleted successfully']);
    }
}
