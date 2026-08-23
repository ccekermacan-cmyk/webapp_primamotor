<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Report::query();
        if ($request->has('date')) {
            $query->whereDate('created_at', $request->input('date'));
        }
        return response()->json($query->latest('created_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $report = Report::findOrFail($id);
        return response()->json($report);
    }

    public function today(): JsonResponse
    {
        $today = Carbon::today()->format('Y-m-d');
        $report = Report::whereDate('created_at', $today)->first();
        if (!$report) {
            $report = Report::create([
                'created_at' => $today . ' 08:00:00',
            ]);
        }
        return response()->json($report);
    }

    public function recalculate(Request $request): JsonResponse
    {
        $date = $request->input('date') ?? Carbon::now('Asia/Jakarta')->format('Y-m-d');
        \App\Services\ReportService::recalculateDaily($date);
        return response()->json(['status' => 'success', 'date' => $date]);
    }
}
