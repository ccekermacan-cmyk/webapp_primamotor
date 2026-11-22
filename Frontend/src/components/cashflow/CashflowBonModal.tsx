import React, { useState } from 'react';
import Modal from '../modal';
import { Calendar, ArrowRight, User, ChevronDown, Wallet, DollarSign, FileText, ImagePlus, Trash2, Save } from 'lucide-react';
import { formatRupiah } from '../../lib/money';
import type { DropdownItem, PersonOption, FormDataBon } from './types';

interface CashflowBonModalProps {
  isOpen: boolean;
  onClose: () => void;
  formDataBon: FormDataBon;
  setFormDataBon: React.Dispatch<React.SetStateAction<FormDataBon>>;
  personOptions: PersonOption[];
  accountOptions: DropdownItem[];
  files: any[];
  setFiles: React.Dispatch<React.SetStateAction<any[]>>;
  previewUrls: string[];
  isProcessing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CashflowBonModal({
  isOpen,
  onClose,
  formDataBon,
  setFormDataBon,
  personOptions,
  accountOptions,
  files,
  setFiles,
  previewUrls,
  isProcessing,
  onSubmit,
}: CashflowBonModalProps) {
  const [searchPersonBon, setSearchPersonBon] = useState('');
  const [isPersonOpenBon, setIsPersonOpenBon] = useState(false);

  const isVideo = (filename: string | undefined) => {
    if (!filename) return false;
    return /\.(mp4|webm|ogg)$/i.test(filename);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Bon Karyawan" maxWidth="max-w-3xl">
      <form onSubmit={onSubmit} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
        <div className="space-y-5">
          {/* Checkbox Catat Cashflow */}
          <label className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl cursor-pointer hover:bg-purple-100 transition-colors shadow-sm">
            <input
              type="checkbox"
              className="w-5 h-5 accent-purple-600 cursor-pointer"
              checked={formDataBon.catatCashflow}
              onChange={(e) => setFormDataBon({ ...formDataBon, catatCashflow: e.target.checked })}
            />
            <div>
              <p className="font-black text-purple-700 text-sm">Catat ke Cashflow</p>
              <p className="text-[10px] font-bold text-purple-500">Nominal bon akan tercatat sebagai pengeluaran kas</p>
            </div>
          </label>

          {/* Baris 1: Tanggal + Jenis Bon (tetap out) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className="text-[10px] md:text-[11px] font-black text-purple-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Calendar size={14} /> Tanggal Waktu
              </label>
              <input
                type="datetime-local"
                value={formDataBon.created_at}
                onChange={e => setFormDataBon({ ...formDataBon, created_at: e.target.value })}
                className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm focus:ring-purple-500/20 focus:border-purple-400"
                required
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className="text-[10px] md:text-[11px] font-black text-purple-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <ArrowRight size={14} /> Jenis Bon
              </label>
              <div className="bg-white rounded-xl p-1.5 mt-2 border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm">
                    KELUAR (Bayar)
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">(Bon karyawan selalu keluar)</span>
                </div>
                <input type="hidden" name="jenis" value="out" />
              </div>
            </div>
          </div>

          {/* Pilih Person (dari semua kategori person) */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 relative">
            <label className="text-[10px] md:text-[11px] font-black text-purple-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
              <User size={14} /> Pilih Karyawan (User)
            </label>
            <div className="relative mt-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Cari nama karyawan..."
                  value={searchPersonBon}
                  onChange={(e) => setSearchPersonBon(e.target.value)}
                  onFocus={() => setIsPersonOpenBon(true)}
                  className="flex-1 min-w-0 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => setIsPersonOpenBon(!isPersonOpenBon)}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shrink-0"
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isPersonOpenBon ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isPersonOpenBon && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {personOptions.filter(p => p.jenis?.toLowerCase() === 'user' || p.source === 'user').length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500 text-center">Tidak ada karyawan terdaftar</div>
                  ) : (
                    personOptions
                      .filter(p => p.jenis?.toLowerCase() === 'user' || p.source === 'user')
                      .filter(p => 
                        p.text_1.toLowerCase().includes(searchPersonBon.toLowerCase()) ||
                        (p.text_2 && p.text_2.toLowerCase().includes(searchPersonBon.toLowerCase())) ||
                        (p.id_lama && p.id_lama.toLowerCase().includes(searchPersonBon.toLowerCase()))
                      )
                      .map(opt => (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setFormDataBon(prev => ({ ...prev, person: opt.id, persontext: opt.id_lama }));
                            setSearchPersonBon('');
                            setIsPersonOpenBon(false);
                          }}
                          className="px-3 py-2.5 text-xs md:text-sm font-semibold text-slate-700 hover:bg-purple-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center gap-2"
                        >
                          <span className="truncate">{opt.text_1} {opt.text_2 ? `- ${opt.text_2}` : ''}</span>
                          <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 shrink-0">
                            Karyawan
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
            {formDataBon.person && (
              <div className="mt-2.5 text-xs font-semibold text-purple-700 bg-white p-2.5 rounded-xl border border-purple-100 flex items-center justify-between gap-2 shadow-sm">
                <span>Dipilih:</span>
                <span className="text-slate-800 truncate">{formDataBon.persontext}</span>
              </div>
            )}
          </div>

          {/* Akun Asal (hanya jika catat cashflow) */}
          {formDataBon.catatCashflow && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] md:text-[11px] font-black text-purple-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Wallet size={14} /> Akun Asal (Kas)
              </label>
              <select
                value={formDataBon.akun_asal}
                onChange={e => setFormDataBon({ ...formDataBon, akun_asal: e.target.value })}
                className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm focus:ring-purple-500/20 focus:border-purple-400"
                required
              >
                <option value="">Pilih Dompet...</option>
                {accountOptions.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.text_1}</option>
                ))}
              </select>
            </div>
          )}

          {/* Nominal */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <label className="text-[10px] md:text-[11px] font-black text-purple-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
              <DollarSign size={14} /> Nominal
            </label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-purple-600">Rp</span>
              <input
                type="number"
                placeholder="0"
                value={formDataBon.nominal || ''}
                onChange={e => setFormDataBon({ ...formDataBon, nominal: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2.5 text-xs md:text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none shadow-sm focus:ring-purple-500/20 focus:border-purple-400"
                required
              />
            </div>
            {Number(formDataBon.nominal) > 0 && (
              <p className="mt-1.5 text-[11px] font-bold text-purple-600 ml-1">
                Terbilang: <span className="font-extrabold text-purple-900">{formatRupiah(Number(formDataBon.nominal))}</span>
              </p>
            )}
          </div>

          {/* Catatan */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <label className="text-[10px] md:text-[11px] font-black text-purple-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
              <FileText size={14} /> Catatan / Keterangan
            </label>
            <input
              type="text"
              placeholder="Deskripsi bon..."
              value={formDataBon.note}
              onChange={e => setFormDataBon({ ...formDataBon, note: e.target.value })}
              className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm focus:ring-purple-500/20 focus:border-purple-400"
              required
            />
          </div>

          {/* Upload File */}
          <div className="p-4 rounded-3xl border border-purple-100 bg-purple-50/30 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-black text-purple-600 uppercase tracking-wider flex items-center gap-2">
                <ImagePlus size={16} /> Lampiran Bukti
              </label>
              <label
                htmlFor="bon-file-input"
                className="cursor-pointer text-[10px] font-black bg-white px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-purple-200 text-purple-600"
              >
                + Upload
              </label>
              <input
                id="bon-file-input"
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={e => {
                  const selectedFiles = Array.from(e.target.files || []);
                  if (selectedFiles.length > 0) setFiles(prev => [...prev, ...selectedFiles]);
                  e.target.value = '';
                }}
              />
            </div>

            {previewUrls.length === 0 ? (
              <div className="text-center py-5 rounded-2xl border-2 border-dashed border-purple-200/50">
                <p className="text-[10px] font-bold text-purple-600 opacity-70">Belum ada file terlampir</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-white shadow-sm aspect-square bg-white">
                    {isVideo(files[idx]?.name) ? (
                      <video src={url} className="w-full h-full object-cover opacity-80" muted />
                    ) : (
                      <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 shadow-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-5 border-t-2 border-slate-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs tracking-widest transition-colors">
            BATALKAN
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2 ${
              isProcessing ? 'opacity-70 cursor-not-allowed bg-slate-400' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/40'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> MENYIMPAN...
              </>
            ) : (
              <>
                <Save size={16} /> SIMPAN TRANSAKSI BON
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
