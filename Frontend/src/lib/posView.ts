// Menyimpan tampilan katalog POS (pencarian, mode tampilan, filter jenis)
// agar tidak hilang saat pengguna berpindah halaman. Cache lokal, bukan data
// bisnis, jadi aman disimpan di localStorage.

export const POS_VIEW_KEY = 'pos_view_state';

export interface PosViewState {
  search: string;
  viewMode: 'grid' | 'list';
  menuFilters: string[];
}

export const DEFAULT_POS_VIEW: PosViewState = { search: '', viewMode: 'grid', menuFilters: [] };

export function readPosView(getItem: (key: string) => string | null): PosViewState {
  try {
    const raw = getItem(POS_VIEW_KEY);
    if (!raw) return { ...DEFAULT_POS_VIEW };
    const parsed = JSON.parse(raw) as Partial<PosViewState>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      viewMode: parsed.viewMode === 'list' ? 'list' : 'grid',
      menuFilters: Array.isArray(parsed.menuFilters) ? parsed.menuFilters.filter(f => typeof f === 'string') : [],
    };
  } catch {
    return { ...DEFAULT_POS_VIEW };
  }
}

export function writePosView(setItem: (key: string, value: string) => void, state: PosViewState): void {
  try {
    setItem(POS_VIEW_KEY, JSON.stringify(state));
  } catch {
    // Penyimpanan tidak tersedia: tampilan saja yang Affected, bukan data.
  }
}
