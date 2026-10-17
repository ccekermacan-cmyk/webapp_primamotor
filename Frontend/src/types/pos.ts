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
