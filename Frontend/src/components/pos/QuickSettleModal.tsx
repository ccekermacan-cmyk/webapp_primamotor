import React from 'react';
import { Calendar, CheckCircle2, DollarSign, FileText, ImagePlus, Upload, Wallet, X, Zap } from 'lucide-react';
import Modal from '../modal';
import { formatRupiah } from '../../lib/money';

export interface QuickSettleMenu {
  id: string;
  ref?: string;
  jenis?: string;
  person?: string;
  total?: number;
  dibayar?: number;
  file?: string[];
}

export interface QuickSettleData {
  show: boolean;
  menu: QuickSettleMenu | null;
  nominal: number;
  accountId: string;
  note: string;
  createdAt: string;
  settleFiles: File[];
}

export type QuickSettlePatch = Partial<Omit<QuickSettleData, 'menu'>>;

export interface CashflowAccount {
  id: string;
  id_lama?: string;
  text_1: string;
  number_1?: number;
}

interface QuickSettleModalProps {
  data: QuickSettleData;
  accounts: CashflowAccount[];
  isProcessing: boolean;
  getPersonDisplayText: (personId?: string | null, fallback?: string) => string;
  onClose: () => void;
  onChange: (patch: QuickSettlePatch) => void;
  onSubmit: () => void;
}

export const QuickSettleModal: React.FC<QuickSettleModalProps> = ({
  data,
  accounts,
  isProcessing,
  getPersonDisplayText,
  onClose,
  onChange,
  onSubmit,
}) => {
  const sisa = Math.max(0, (data.menu?.total || 0) - (data.menu?.dibayar || 0));

  return (
    <Modal
      isOpen={data.show}
      onClose={() => !isProcessing && onClose()}
      title="Pelunasan Pembayaran Cepat"
      maxWidth="max-w-2xl"
      compact
    >
      <div className="pos-modal-layout">
        <div className="pos-modal-scroll pos-form-fields space-y-4">
          {/* Ringkasan nota */}
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-500">{data.menu?.jenis || 'Nota Transaksi'}</p>
                <p className="text-sm sm:text-base font-semibold text-slate-800 mt-0.5 break-words">
                  {getPersonDisplayText(data.menu?.person, 'Pelanggan umum')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">{data.menu?.ref || data.menu?.id?.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onChange({ nominal: sisa })}
                className="pos-action bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 transition-colors"
              >
                <Zap size={14} fill="currentColor" /> Lunas penuh
              </button>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-3.5 text-slate-700 tabular-nums">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <dt className="text-[11px] text-slate-500">Total invoice</dt>
                <dd className="text-xs sm:text-sm font-semibold mt-0.5">{formatRupiah(data.menu?.total || 0)}</dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <dt className="text-[11px] text-slate-500">Sudah dibayar</dt>
                <dd className="text-xs sm:text-sm font-semibold text-emerald-700 mt-0.5">{formatRupiah(data.menu?.dibayar || 0)}</dd>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                <dt className="text-[11px] text-emerald-700">Sisa tagihan</dt>
                <dd className="text-xs sm:text-sm font-semibold text-emerald-700 mt-0.5">{formatRupiah(sisa)}</dd>
              </div>
            </dl>
          </section>

          {/* Form pelunasan selaras dengan detail keranjang */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className="text-[10px] md:text-[11px] font-black text-emerald-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Calendar size={14} /> Waktu pembayaran
              </label>
              <input
                type="datetime-local"
                value={data.createdAt}
                disabled={isProcessing}
                onChange={(e) => onChange({ createdAt: e.target.value })}
                className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="flex flex-wrap justify-between items-center gap-1.5 ml-1">
                <label className="text-[10px] md:text-[11px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={14} /> Akun kas penerima <span className="text-rose-500">*</span>
                </label>
                {data.accountId && (() => {
                  const selected = accounts.find(a => a.id === data.accountId);
                  return (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <Wallet size={11} /> Saldo: {formatRupiah(selected?.number_1 || 0)}
                    </span>
                  );
                })()}
              </div>
              <select
                value={data.accountId}
                disabled={isProcessing}
                onChange={(e) => onChange({ accountId: e.target.value })}
                className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">-- Pilih akun kas --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.text_1} {acc.id_lama ? `(${acc.id_lama})` : ''} - Saldo: {formatRupiah(acc.number_1 || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className="text-[10px] md:text-[11px] font-black text-emerald-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <DollarSign size={14} /> Nominal pelunasan (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-emerald-600">Rp</span>
                <input
                  type="number"
                  min="1"
                  value={data.nominal || ''}
                  disabled={isProcessing}
                  onChange={(e) => onChange({ nominal: Number(e.target.value) })}
                  className="w-full pl-9 pr-3 py-2.5 text-xs md:text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  placeholder="Masukkan nominal bayar..."
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className="text-[10px] md:text-[11px] font-black text-emerald-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <FileText size={14} /> Catatan pelunasan (opsional)
              </label>
              <input
                type="text"
                value={data.note}
                disabled={isProcessing}
                onChange={(e) => onChange({ note: e.target.value })}
                className="w-full mt-2 p-2.5 text-xs md:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                placeholder="Contoh: Pelunasan Transfer BCA"
              />
            </div>
          </div>

          {/* Lampiran bukti transfer */}
          <div className="bg-emerald-50 p-5 rounded-3xl border-2 border-emerald-200 space-y-4 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="text-[11px] md:text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                <ImagePlus size={16} />
                Upload media / bukti transfer (opsional)
                {data.menu?.file && data.menu.file.length > 0 && (
                  <span className="text-[10px] text-blue-600 font-medium">({data.menu.file.length} file terdahulu)</span>
                )}
              </label>
              <label htmlFor="quick-settle-file-input" className="cursor-pointer pos-action bg-white text-emerald-600 border border-emerald-200">
                <Upload size={14} /> Tambah file
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isProcessing}
                id="quick-settle-file-input"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const filesArray = Array.from(e.target.files);
                    onChange({ settleFiles: [...(data.settleFiles || []), ...filesArray] });
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {!data.settleFiles || data.settleFiles.length === 0 ? (
              <label htmlFor="quick-settle-file-input" className="block text-center py-4 rounded-2xl border border-dashed border-emerald-200 bg-white/60 cursor-pointer hover:bg-white/80 transition-colors">
                <p className="text-xs font-semibold text-emerald-700 opacity-80">Klik untuk pilih foto bukti transfer</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Format: JPG, PNG, WEBP</p>
              </label>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {data.settleFiles.map((file, idx) => {
                  const previewUrl = URL.createObjectURL(file);
                  return (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-white aspect-square bg-white">
                      <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => onChange({ settleFiles: data.settleFiles.filter((_, i) => i !== idx) })}
                        className="absolute top-1.5 right-1.5 p-1 bg-rose-500 text-white rounded-full opacity-90 hover:opacity-100 transition-opacity"
                        title="Hapus foto ini"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="pos-modal-footer">
          <div>
            <span className="text-xs text-slate-500">Nominal pelunasan</span>
            <p className="text-lg sm:text-xl font-bold tabular-nums text-emerald-600">{formatRupiah(data.nominal || 0)}</p>
            <small className="text-slate-500">Sisa tagihan {formatRupiah(sisa)}</small>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="pos-action flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isProcessing}
              className="pos-action flex-[2] sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-95"
            >
              {isProcessing ? 'Menyimpan...' : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Simpan pelunasan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default QuickSettleModal;
