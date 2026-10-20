// Validasi form transaksi POS.
// Bersih (murni) supaya bisa diuji tanpa React: komponen hanya menampilkan
// pesan yang dikembalikan di bawah field terkait dan memfokuskan error pertama.

export type FieldKey =
  | 'cart'
  | 'mechanic'
  | 'mechanicOngkos'
  | 'paymentAccount'
  | 'paymentNominal'
  | 'marketplace'
  | 'adminFee'
  | 'note'
  | 'tempoDate';

export interface FieldError {
  field: FieldKey;
  message: string;
}

export interface CheckoutValidationInput {
  menu: string;
  cartCount: number;
  mekanik: { idLama: string; ongkos: number }[];
  cashflow: { accountId: string; nominal: number }[];
  isOnline: boolean;
  marketplace: string;
  adminFee: number;
  noteMenu: string;
  payment: string;
  tempoDate: string;
}

export const FIELD_TAB: Record<FieldKey, 'items' | 'payment' | 'notes'> = {
  cart: 'items',
  mechanic: 'items',
  mechanicOngkos: 'items',
  paymentAccount: 'payment',
  paymentNominal: 'payment',
  marketplace: 'payment',
  adminFee: 'payment',
  tempoDate: 'payment',
  note: 'notes',
};

/** Aturan wajib isi transaksi. Tidak mengubah aturan perhitungan. */
export function validateCheckout(input: CheckoutValidationInput): FieldError[] {
  const errors: FieldError[] = [];
  const menu = input.menu.toLowerCase();
  const isService = menu.includes('service');
  const isPembelian = menu.includes('pembelian');

  if (input.cartCount === 0 && !isService) {
    errors.push({ field: 'cart', message: 'Isi keranjang dengan item terlebih dahulu!' });
  }

  if (isService) {
    const valid = input.mekanik.filter(m => m.idLama && m.ongkos > 0);
    if (valid.length === 0) {
      errors.push({ field: 'mechanic', message: 'Untuk menu SERVICE, minimal 1 mekanik harus diisi dengan ongkos yang valid (> 0).' });
    }
    if (input.mekanik.some(m => m.idLama && m.ongkos === 0)) {
      errors.push({ field: 'mechanicOngkos', message: 'Mekanik yang dipilih harus memiliki ongkos kerja yang valid (harus > 0). Silakan isi ongkos untuk semua mekanik.' });
    }
  }

  if (input.cashflow.some(cf => cf.accountId && cf.nominal === 0)) {
    errors.push({ field: 'paymentNominal', message: 'Akun kas yang dipilih harus memiliki nominal pembayaran yang valid (harus > 0).' });
  }
  if (input.cashflow.some(cf => !cf.accountId && cf.nominal > 0)) {
    errors.push({ field: 'paymentAccount', message: 'Nominal pembayaran dimasukkan tetapi akun kas belum dipilih. Silakan pilih akun kas terlebih dahulu.' });
  }

  if (input.isOnline) {
    if (!input.marketplace.trim()) {
      errors.push({ field: 'marketplace', message: 'Marketplace wajib diisi untuk pelanggan online.' });
    }
    if (input.adminFee < 0) {
      errors.push({ field: 'adminFee', message: 'Admin fee tidak boleh bernilai negatif.' });
    }
  }

  if (isService && !input.noteMenu.trim()) {
    errors.push({ field: 'note', message: 'Isi jenis motor service pada catatan nota!' });
  }

  if (isPembelian) {
    if (input.payment === 'Tempo' && !input.tempoDate) {
      errors.push({ field: 'tempoDate', message: 'Tanggal jatuh tempo wajib diisi untuk pembelian dengan pembayaran Tempo.' });
    } else if (!input.noteMenu.trim() && !(input.payment === 'Tempo' && input.tempoDate)) {
      // Catatan tempo terisi otomatis oleh sistem, jadi tidak dianggap kosong.
      errors.push({ field: 'note', message: 'Isi nota dari customer pada catatan nota!' });
    }
  }

  return errors;
}
