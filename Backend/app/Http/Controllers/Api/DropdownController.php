<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dropdown;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DropdownController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Dropdown::query();
        if ($request->has('text_1')) {
            $query->where('text_1', $request->input('text_1'));
        }
        if ($request->has('jenis')) {
            $query->where('jenis', $request->input('jenis'));
        }
        return response()->json($query->get());
    }

    public function show(string $id): JsonResponse
    {
        $dropdown = Dropdown::findOrFail($id);
        return response()->json($dropdown);
    }

    public function store(Request $request): JsonResponse
    {
        $dropdown = Dropdown::create($request->all());
        return response()->json($dropdown, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $dropdown = Dropdown::findOrFail($id);
        $dropdown->update($request->all());
        return response()->json($dropdown);
    }

    public function destroy(string $id): JsonResponse
    {
        $dropdown = Dropdown::findOrFail($id);
        $dropdown->delete();
        return response()->json(['message' => 'Dropdown deleted successfully']);
    }
}
