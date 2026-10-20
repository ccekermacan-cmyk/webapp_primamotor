// Draft keranjang POS: cache lokal sementara supaya keranjang/form tidak hilang
// saat pengguna tidak sengaja berpindah halaman. Kedaluwarsa dalam 24 jam.
export const POS_DRAFT_KEY = 'pos_draft_cart';
export const POS_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PosDraft {
  cart: unknown[];
  selectedMenu?: string;
  formBayar?: unknown;
  savedAt?: number;
}

export function readPosDraft(
  getItem: (key: string) => string | null,
  now: number,
  hasPending: boolean,
): PosDraft | null {
  // Jangan pulihkan saat transaksi atomic masih menunggu resolusi.
  if (hasPending) return null;
  try {
    const raw = getItem(POS_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as PosDraft;
    if (!draft || !Array.isArray(draft.cart) || draft.cart.length === 0) return null;
    if (typeof draft.savedAt === 'number' && now - draft.savedAt > POS_DRAFT_MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}
