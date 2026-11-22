export interface Cashflow {
  saldo_awal?: number;
  saldo_akhir?: number;
  id: string;
  id_lama: string;
  ref: string;
  operator: string;
  created_at: string;
  jenis: string;
  mutasi: string; 
  account_1: string;
  account_2: string;
  persontext: string;
  nominal: number;
  note: string;
  ref_baru: string;
  created: string; 
  file: string[];
  person?: string;
  acc1?: string;
  acc2?: string;
}

export interface DropdownItem {
  id_lama?: string;
  text_2?: string;
  number_1?: number;
  enum_1?: string;
  id: string;
  kategori: string;
  jenis: string;
  text_1: string;
  visibilitas: string;
  link_image?: string;
  enum_4?: string;
}

export interface PersonOption {
  id: string;
  id_lama: string;
  text_1: string;
  text_2?: string;
  jenis?: string;
  source: 'dropdown' | 'user';
}

export interface SystemAlertState {
  show: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
}
