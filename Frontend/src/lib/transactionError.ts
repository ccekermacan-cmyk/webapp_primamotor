const labels: Record<string, string> = {nominal:'Nominal',qty:'Jumlah',account_1:'Akun sumber',account_2:'Akun tujuan',item_baru:'Produk',person_baru:'Pelanggan',created_at:'Tanggal',id_lama:'Kode'};
export function transactionError(error: unknown): Error {
  const messages: string[] = [];
  const visit = (value: unknown, field = '') => {
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object' && Object.keys(obj.data).length) {
      for (const [key, child] of Object.entries(obj.data)) visit(child, labels[key] || key);
    } else if (obj.response) visit(obj.response);
    else if (typeof obj.message === 'string') {
      let message = obj.message;
      if (obj.status === 401) message = 'Sesi tidak sah atau sudah berakhir. Silakan login ulang.';
      else if (obj.status === 403 && ['Forbidden.', 'Only authenticated users can perform this action.'].includes(message)) message = 'Akses tindakan ini ditolak. Periksa izin akun atau login ulang jika sesi sudah berakhir.';
      else if (message === 'Anda tidak memiliki akses ke akun ini.') message = 'Tidak memiliki izin untuk tindakan ini pada akun kas terkait. Hubungi administrator.';
      if (field && !['requests','data'].includes(field) && !/^\d+$/.test(field)) message = `${field}: ${message}`;
      messages.push(message);
    } else for (const child of Object.values(obj)) visit(child);
  };
  visit(error);
  const status = (error as {status?:number})?.status;
  if (status === 0) return new Error('Koneksi ke server terputus. Status transaksi perlu diperiksa sebelum mencoba kembali.');
  return new Error([...new Set(messages)].join(' ') || (status && status >= 500 ? 'Server transaksi sedang bermasalah. Silakan coba pemeriksaan transaksi kembali.' : 'Transaksi gagal. Periksa data dan izin akun Anda.'));
}
