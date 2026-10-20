export function loginErrorMessage(error: unknown): string {
  const err = error as { status?: number; isAbort?: boolean; name?: string } | null;
  if (err?.name === 'SecurityError' || err?.name === 'QuotaExceededError') {
    return 'Penyimpanan browser tidak tersedia. Izinkan penyimpanan situs ini, lalu coba masuk kembali.';
  }
  if (err?.isAbort) return 'Permintaan login terhenti. Silakan coba kembali.';
  if (err?.status === 0) return 'Tidak dapat terhubung ke layanan login. Periksa koneksi internet dan coba kembali.';
  if (err?.status === 400 || err?.status === 401) {
    return 'Username/email atau password tidak cocok. Periksa penulisan, Caps Lock, dan password yang tersimpan di browser.';
  }
  if (err?.status === 403) return 'Akses ke layanan login ditolak. Hubungi admin untuk memeriksa izin akses situs.';
  if (err?.status === 429) return 'Terlalu banyak percobaan login. Tunggu beberapa saat sebelum mencoba kembali.';
  if (err?.status && err.status >= 500) return 'Layanan login sedang mengalami gangguan. Silakan coba kembali beberapa saat lagi.';
  return 'Login belum dapat diselesaikan. Silakan coba kembali atau hubungi admin.';
}
