export interface Produk {
  [key: string]: any;
  id: string;
  id_lama: string;
  kategori: string;
  merk: string;
  jenis: string;
  varian: string;
  keterangan: string;
  tipe: string;
  unit: string;
  beli: number;
  sell_1: number;
  sell_2: number;
  sell_3: number;
  sell_4: number;
  sell_5: number;
  sell_6: number;
  min_1: number;
  min_2: number;
  min_3: number;
  stok_1: number;
  stok_2: number;
  stok_3: number;
  date: string;
  file?: string[];
}
