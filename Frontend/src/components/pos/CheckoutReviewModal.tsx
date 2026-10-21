import React from 'react';
import { ChevronDown, ChevronLeft, ChevronUp, FileText, ListOrdered, Package, Save, Wallet } from 'lucide-react';
import Modal from '../modal';
import { formatRupiah } from '../../lib/money';
import type { CheckoutForm } from '../../types/pos';

export interface ReviewCartItem {
  id: string;
  qty: number;
  unit?: string;
  priceSelected: number;
  sell_6?: number;
}

export interface ReviewAccount {
  id: string;
  text_1: string;
}

interface CheckoutReviewModalProps {
  isOpen: boolean;
  formBayar: CheckoutForm;
  selectedMenu: string;
  isEditing: boolean;
  grandTotal: number;
  totalBelanja: number;
  totalQty: number;
  items: ReviewCartItem[];
  accounts: ReviewAccount[];
  operatorName: string;
  isOnlinePerson: boolean;
  isProcessing: boolean;
  processingMsg: string;
  attachmentCount: number;
  /** Media sudah tersedia: file baru, atau file lama saat mode edit. */
  hasMedia: boolean;
  showDetails: boolean;
  activeTheme: { text: string; main: string };
  getPersonDisplayText: (personId?: string | null, fallback?: string) => string;
  getItemLabel: (item: ReviewCartItem) => string;
  onToggleDetails: () => void;
  onGoToTab: (tab: 'items' | 'payment' | 'notes') => void;
  onBack: () => void;
  onSave: () => void;
}

export const CheckoutReviewModal: React.FC<CheckoutReviewModalProps> = ({
  isOpen,
  formBayar,
  selectedMenu,
  isEditing,
  grandTotal,
  totalBelanja,
  totalQty,
  items,
  accounts,
  operatorName,
  isOnlinePerson,
  isProcessing,
  processingMsg,
  attachmentCount,
  hasMedia,
  showDetails,
  activeTheme,
  getPersonDisplayText,
  getItemLabel,
  onToggleDetails,
  onGoToTab,
  onBack,
  onSave,
}) => {
  const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
  const selisih = grandTotal - totalDibayar;
  const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
  const isLunas = totalDibayar >= grandTotal;
  const statusText = isPembelian && !hasMedia
    ? 'BELUM (Menunggu Bukti Media)'
    : (isLunas ? 'LUNAS' : 'BELUM LUNAS');
  const statusClass = isPembelian && !hasMedia
    ? 'bg-amber-50 border-amber-100 text-amber-700'
    : (isLunas ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700');
  const paymentRows = formBayar.cashflowList.filter(cf => cf.accountId || cf.nominal);
  const mechanicRows = formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0);

  return (
    <Modal isOpen={isOpen} onClose={() => !isProcessing && onBack()} title="Periksa transaksi" maxWidth="max-w-2xl" compact>
      <div className="pos-modal-layout">
        <div className="pos-modal-scroll pos-form-fields space-y-4">
          {/* Identitas transaksi + status */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{isEditing ? 'Validasi update nota terakhir' : 'Periksa sebelum menyimpan'}</p>
                <p className="text-base font-semibold text-slate-800 mt-0.5 break-words">
                  {getPersonDisplayText(formBayar.personIdLama, 'Umum')}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">{selectedMenu}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formBayar.payment}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formBayar.createdAt ? new Date(formBayar.createdAt).toLocaleString('id-ID') : '-'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Kasir {operatorName}</span>
                </div>
              </div>
              <div className={`shrink-0 rounded-xl border px-3 py-2 text-right ${statusClass}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Status nota</p>
                <p className="text-xs font-bold">{statusText}</p>
              </div>
            </div>
            {isPembelian && !hasMedia && (
              <p className="text-[11px] text-amber-600 mt-2">Upload bukti nota agar bisa berstatus LUNAS</p>
            )}
          </section>

          {/* Angka utama: total, dibayar, sisa */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700 tabular-nums">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-xs">Total tagihan</dt>
              <dd className={`text-xl font-semibold ${activeTheme.text}`}>{formatRupiah(grandTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs">Dibayar</dt>
              <dd className="font-semibold">{formatRupiah(totalDibayar)}</dd>
            </div>
            <div>
              <dt className="text-xs">{selisih < 0 ? 'Kembalian' : 'Sisa tagihan'}</dt>
              <dd className="font-semibold">{formatRupiah(Math.abs(selisih))}</dd>
            </div>
          </dl>

          {/* Kembali ke bagian yang perlu diperbaiki */}
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'items' as const, label: 'Ubah barang', Icon: Package },
              { id: 'payment' as const, label: 'Ubah pembayaran', Icon: Wallet },
              { id: 'notes' as const, label: 'Ubah catatan', Icon: FileText },
            ]).map(({ id, label, Icon }) => (
              <button type="button" className="pos-action bg-slate-100" key={id} onClick={() => onGoToTab(id)}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={showDetails}
            className="inline-flex w-full min-h-[36px] items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
          >
            <span className="flex items-center gap-2">
              <ListOrdered size={14} /> {showDetails ? 'Sembunyikan rincian' : 'Lihat rincian'}
            </span>
            <span className="text-slate-400">{showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          </button>

          {showDetails && (
            <div className="space-y-4">
              {/* Barang & jasa */}
              <section className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Barang &amp; jasa <span className="text-slate-400">· {totalQty} item</span></p>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                  {items.map(item => (
                    <div key={item.id} className="p-3 flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 break-words">{getItemLabel(item)}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.qty} {item.unit} x {formatRupiah(item.priceSelected)}</p>
                        {selectedMenu.toLowerCase() !== 'pembelian' && (
                          <p className="text-[11px] text-slate-400">Normal: {formatRupiah((item.sell_6 || 0) * item.qty)}</p>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 shrink-0">{formatRupiah(item.priceSelected * item.qty)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Total produk: {formatRupiah(totalBelanja)}</p>
              </section>

              {/* Pembayaran per akun */}
              <section className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Pembayaran per akun</p>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                  {paymentRows.length === 0 && <p className="p-3 text-xs text-slate-400">Belum ada akun kas yang dipilih.</p>}
                  {paymentRows.map((cf, idx) => {
                    const accName = accounts.find(a => a.id === cf.accountId)?.text_1 || 'Akun Belum Dipilih';
                    return (
                      <div key={idx} className="p-3 flex justify-between items-center gap-3">
                        <span className="font-semibold text-slate-600 truncate">#{idx + 1} {accName}</span>
                        <span className="font-semibold text-slate-900 shrink-0">{formatRupiah(cf.nominal || 0)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Alokasi ongkos mekanik */}
              {selectedMenu.toLowerCase().includes('service') && mechanicRows.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Alokasi ongkos mekanik</p>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                    {mechanicRows.map((mek, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center gap-3">
                        <span className="font-semibold text-slate-600">{mek.idLama}</span>
                        <span className="font-semibold text-slate-900">{formatRupiah(mek.ongkos || 0)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Detail marketplace online */}
              {isOnlinePerson && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Detail marketplace online</p>
                  <dl className="text-xs text-slate-700 space-y-1">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Platform</dt><dd className="font-semibold">{formBayar.marketplace || '-'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Potongan admin</dt><dd className="font-semibold text-rose-600">- {formatRupiah(formBayar.adminFee || 0)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Cashback</dt><dd className="font-semibold text-emerald-600">+ {formatRupiah(formBayar.cashback || 0)}</dd></div>
                  </dl>
                </section>
              )}

              {/* Catatan & lampiran */}
              <section className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Catatan &amp; lampiran</p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{formBayar.noteMenu || 'Tidak ada catatan nota.'}</p>
                <p className="text-[11px] text-slate-500">Lampiran: {attachmentCount} file</p>
              </section>
            </div>
          )}
        </div>
        <div className="pos-modal-footer">
          <button type="button" onClick={onBack} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-slate-500 text-xs tracking-widest transition-colors">
            <ChevronLeft size={16} /> Kembali
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isProcessing}
            className={`flex-[2] py-4 text-white rounded-2xl font-black text-sm shadow-xl tracking-widest transition-all active:scale-95 ${activeTheme.main} ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {processingMsg || 'MENYIMPAN KE DATABASE...'}
              </span>
            ) : <><Save size={16} /> Simpan transaksi</>}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CheckoutReviewModal;
