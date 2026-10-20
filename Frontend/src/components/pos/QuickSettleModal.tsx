import React from 'react';
import { CheckCircle2, Upload, Wallet, X } from 'lucide-react';
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
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{data.menu?.jenis || 'Nota Transaksi'}</p>
                <p className="text-base font-semibold text-slate-800 mt-0.5 break-words">
                  {getPersonDisplayText(data.menu?.person, 'Pelanggan umum')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">{data.menu?.ref || data.menu?.id?.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onChange({ nominal: sisa })}
                className="pos-action bg-emerald-600 text-white shrink-0"
              >
                Lunas penuh
              </button>
            </div>
            <dl className="grid grid-cols-3 gap-3 mt-4 text-slate-700 tabular-nums">
              <div>
                <dt className="text-xs">Total invoice</dt>
                <dd className="font-semibold">{formatRupiah(data.menu?.total || 0)}</dd>
              </div>
              <div>
                <dt className="text-xs">Sudah dibayar</dt>
                <dd className="font-semibold text-emerald-700">{formatRupiah(data.menu?.dibayar || 0)}</dd>
              </div>
              <div>
                <dt className="text-xs">Sisa tagihan</dt>
                <dd className="font-semibold text-emerald-700">{formatRupiah(sisa)}</dd>
              </div>
            </dl>
          </section>

          {/* Form pelunasan */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex justify-between items-center gap-2">
                <span>Akun kas penerima pembayaran <span className="text-rose-500">*</span></span>
                {data.accountId && (() => {
                  const selected = accounts.find(a => a.id === data.accountId);
                  return (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                      <Wallet size={12} /> Saldo: {formatRupiah(selected?.number_1 || 0)}
                    </span>
                  );
                })()}
              </label>
              <select
                value={data.accountId}
                disabled={isProcessing}
                onChange={(e) => onChange({ accountId: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">-- Pilih akun kas --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.text_1} {acc.id_lama ? `(${acc.id_lama})` : ''} - Saldo: {formatRupiah(acc.number_1 || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                Nominal pelunasan (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={data.nominal || ''}
                disabled={isProcessing}
                onChange={(e) => onChange({ nominal: Number(e.target.value) })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                placeholder="Masukkan nominal bayar..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Waktu pembayaran</label>
              <input
                type="datetime-local"
                value={data.createdAt}
                disabled={isProcessing}
                onChange={(e) => onChange({ createdAt: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Catatan pelunasan (opsional)</label>
              <input
                type="text"
                value={data.note}
                disabled={isProcessing}
                onChange={(e) => onChange({ note: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                placeholder="Contoh: Pelunasan Transfer BCA"
              />
            </div>

            {/* Lampiran bukti transfer */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between gap-2">
                <span>Upload media / bukti transfer (opsional)</span>
                {data.menu?.file && data.menu.file.length > 0 && (
                  <span className="text-[10px] text-blue-600 font-medium">({data.menu.file.length} file terdahulu)</span>
                )}
              </label>
              <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
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
                  }}
                />
                <label htmlFor="quick-settle-file-input" className="flex flex-col items-center justify-center cursor-pointer gap-2 py-2">
                  <div className="p-3 bg-white rounded-full shadow-sm text-emerald-600">
                    <Upload size={20} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-700">Klik untuk pilih foto bukti transfer</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Format: JPG, PNG, WEBP</p>
                  </div>
                </label>

                {data.settleFiles && data.settleFiles.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200">
                    {data.settleFiles.map((file, idx) => {
                      const previewUrl = URL.createObjectURL(file);
                      return (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-white">
                          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => onChange({ settleFiles: data.settleFiles.filter((_, i) => i !== idx) })}
                            className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-80 hover:opacity-100 transition-opacity"
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
          </div>
        </div>
        <div className="pos-modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs tracking-wider transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isProcessing}
            className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-wider shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
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
    </Modal>
  );
};

export default QuickSettleModal;
