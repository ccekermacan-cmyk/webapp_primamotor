<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MenuController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Menu::query();
        if ($request->has('jenis')) {
            $query->where('jenis', $request->input('jenis'));
        }
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }
        return response()->json($query->latest('created_at')->get());
    }

    public function show(string $id): JsonResponse
    {
        $menu = Menu::findOrFail($id);
        return response()->json($menu);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->all();
        $menu = DB::transaction(function () use ($validated) {
            return Menu::create($validated);
        });
        return response()->json($menu, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $menu = Menu::findOrFail($id);
        $validated = $request->all();
        DB::transaction(function () use ($menu, $validated) {
            $menu->update($validated);
        });
        return response()->json($menu);
    }

    public function destroy(string $id): JsonResponse
    {
        $menu = Menu::findOrFail($id);
        DB::transaction(function () use ($menu) {
            $menu->delete();
        });
        return response()->json(['message' => 'Menu and child cascade resources deleted successfully']);
    }
}
