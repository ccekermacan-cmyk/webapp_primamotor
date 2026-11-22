import type { RecordModel } from 'pocketbase';

export interface UserData extends RecordModel {
  id: string;
  username: string;
  email: string;
  name: string;
  status: string;
  avatar: string;
  link_image: string;
  level: number;
  number: number;
}

export interface Gaji {
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
  sakit: number;
  setengah_hari: number;
  telat: number;
  bpjs: number;
  bon_diambil: number;
  bon_dibayar: number;
  created_at: string;
  ref: string;
  note?: string;
  operator?: string;
  diterima?: number;
  file?: string[];
  expand?: {
    ref_baru?: {
      qty: number;
    }
  };
  qty?: number;
  total?: number;
}

export interface BonItem {
  id: string;
  nominal: number;
  jenis: string;
  note?: string;
  operator?: string;
  created_at: string;
}
