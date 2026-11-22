export interface CheckoutForm {
  personIdLama: string;
  payment: string;
  nominalBayar: number;
  cashflowList: { id?: string; created_at?: string; accountId: string; nominal: number }[];
  mekanikList: { idLama: string; ongkos: number }[];
  note: string;
  noteMenu: string;
  tempoDate: string;
  marketplace: string;
  adminFee: number;
  cashback: number;
  createdAt: string;
  notaNo?: string;
}

export interface Produk {
  nama?: string;
  id: string; id_lama: string; kategori: string; merk: string; jenis: string;
  varian: string; keterangan: string; tipe: string; unit: string; beli: number;
  sell_1: number; sell_2: number; sell_3: number; sell_4: number; sell_5: number; sell_6: number;
  min_1: number; min_2: number; min_3: number; stok_3: number;
}

export interface DropdownItem {
  text_2?: string; number_1?: number;
  id: string; id_lama: string; text_1: string; jenis: string; kategori: string; visibilitas: string;
}

export interface UserKaryawan {
  id: string; username: string; name: string; level: number; status: string;
  number?: number;
}

export interface CartItem extends Produk {
  qty: number;
  priceSelected: number;
  isTiered: boolean;
  basePriceDefault: number;
  manualPrice?: number;
  activeTierName?: string;
}

export interface HistoryMenu {
  status: string; date_lunas?: string;
  id: string; created_at: string; created: string; jenis: string; person: string; payment: string; 
  qty: number; text: string; tempo: string; marketplace: string; cashback: number; admin: number; operator: string; ref: string; person_baru: string;
  file: string[];
  total?: number;
  dibayar?: number;
}

export interface LogStockDetail {
  stok_awal?: number; stok_akhir?: number; created_at?: string;
  id: string; item: string; qty: number; price_1: number; price_2: number; boolean: string; item_baru: string; number_1: number; number_2: number;
  expand?: { item_baru: Produk; ref_baru?: HistoryMenu };
}

export interface CashflowDetail {
  saldo_awal?: number; saldo_akhir?: number;
  id: string; nominal: number; mutasi: string; account_1: string; account_2: string; jenis: string; note: string;
}

export interface OngkosDetail {
  id: string; person: string; ongkos: number; date: string;
}

export interface GajiItemForm {
  id: string;
  person: string;
  pokok: number;
  tunjangan: number;
  bonus_1: number;
  bonus_2: number;
  bonus_3: number;
  bonus_4: number;
  program: number;
  lembur: number;
  alfa: number;
  setengah_hari: number;
  sakit: number;
  telat: number;
  bpjs: number;
  bon_diambil: number;
  bon_dibayar: number;
  netto: number;
  diterima: number;
  note?: string;
  files?: File[];
  fileUrls?: string[];
}

