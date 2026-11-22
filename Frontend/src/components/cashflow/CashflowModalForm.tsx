import React, { useState } from 'react';
import Modal from '../modal';
import {
  ArrowDownRight, ArrowUpRight, Calendar, Layers, Wallet,
  ArrowRight, User, DollarSign, FileText, ImagePlus, Trash2, Save, ChevronDown
} from 'lucide-react';
import { formatRupiah } from '../../lib/money';
import type { Cashflow, DropdownItem, PersonOption } from './types';

interface CashflowModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  isEditMode: boolean;
  formData: Partial<Cashflow>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Cashflow>>>;
  handleMutasiChange: (newMutasi: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  accountOptions: DropdownItem[];
  jenisOptionsIn: DropdownItem[];
  jenisOptionsOut: DropdownItem[];
  personOptions: PersonOption[];
  walletsMap: Map<string, any>;
  files: any[];
  setFiles: React.Dispatch<React.SetStateAction<any[]>>;
  previewUrls: string[];
  setIsFormDirty: (val: boolean) => void;
  isProcessing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CashflowModalForm({
  isOpen,
  onClose,
  isEditMode,
  formData,
  setFormData,
  handleMutasiChange,
  handleInputChange,
  accountOptions,
  jenisOptionsIn,
  jenisOptionsOut,
  personOptions,
  walletsMap,
  files,
  setFiles,
  previewUrls,
  setIsFormDirty,
  isProcessing,
  onSubmit
}: CashflowModalFormProps) {
  const [searchPerson, setSearchPerson] = useState('');
  const [isPersonOpen, setIsPersonOpen] = useState(false);

  const isVideo = (filename: string | undefined) => {
    if (!filename) return false;
    return /\.(mp4|webm|ogg)$/i.test(filename);
  };

  const isMasuk = formData.mutasi === 'Masuk';
  const txtColor = isMasuk ? 'text-emerald-600' : 'text-rose-600';
  const focusClass = isMasuk ? 'focus:ring-emerald-500/20 focus:border-emerald-400' : 'focus:ring-rose-500/20 focus:border-rose-400';
  const bgBox = isMasuk ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100';
  const btnUpload = isMasuk ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 border-rose-200';
  const optionsJenis = isMasuk ? jenisOptionsIn : jenisOptionsOut;
  const isTransfer = (formData.jenis || '').toLowerCase().includes('transfer');
  const showPersonSelector = formData.mutasi === 'Keluar' && formData.jenis?.toLowerCase() === 'bonkaryawan';
  const twoColumns = isTransfer || showPersonSelector;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Revisi Transaksi Kas' : 'Catat Transaksi Kas Baru'}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={onSubmit} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
        <div className="space-y-5">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full shadow-inner">
            <button
              type="button"
              onClick={() => handleMutasiChange('Masuk')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                formData.mutasi === 'Masuk' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <ArrowDownRight size={16} className="inline mr-2" /> KAS MASUK
            </button>
            <button
              type="button"
              onClick={() => handleMutasiChange('Keluar')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                formData.mutasi === 'Keluar' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <ArrowUpRight size={16} className="inline mr-2" /> KAS KELUAR
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className={`text-[10px] md:text-[11px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
                <Calendar size={14} /> Tanggal Waktu
              </label>
              <input
                type="datetime-local"
                name="created_at"
                value={formData.created_at || ''}
                onChange={handleInputChange}
                className={`w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none transition-all shadow-sm ${focusClass}`}
                required
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className={`text-[10px] md:text-[11px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
                <Layers size={14} /> Jenis Cashflow
              </label>
              <select
                name="jenis"
                value={formData.jenis || ''}
                onChange={handleInputChange}
                className={`w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`}
                required
              >
                <option value="" disabled>Pilih Kategori...</option>
                {optionsJenis.map(opt => (
                  <option key={opt.id} value={opt.id_lama || opt.id}>{opt.text_1}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${twoColumns ? 'sm:grid-cols-2' : ''} gap-3`}>
            {/* Akun Sumber */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="flex flex-wrap justify-between items-center gap-1 ml-1">
                <label className={`text-[10px] md:text-[11px] font-black ${txtColor} uppercase tracking-wider flex items-center gap-1.5`}>
                  <Wallet size={14} /> Akun Sumber
                </label>
                {formData.account_1 && (
                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                    Saldo: {formatRupiah(walletsMap.get(formData.account_1)?.number_1 || 0)}
                  </span>
                )}
              </div>
              <select
                name="account_1"
                value={formData.account_1 || ''}
                onChange={handleInputChange}
                className={`w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`}
                required
              >
                <option value="" disabled>Pilih Dompet...</option>
                {accountOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.text_1}</option>
                ))}
              </select>
            </div>

            {/* Kolom 2: Transfer atau Person Selector */}
            {isTransfer && (
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 animate-in fade-in zoom-in duration-300">
                <div className="flex flex-wrap justify-between items-center gap-1 ml-1">
                  <label className="text-[10px] md:text-[11px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowRight size={14} /> Akun Tujuan
                  </label>
                  {formData.account_2 && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-200/50 px-2 py-0.5 rounded-md">
                      Saldo: {formatRupiah(walletsMap.get(formData.account_2)?.number_1 || 0)}
                    </span>
                  )}
                </div>
                <select
                  name="account_2"
                  value={formData.account_2 || ''}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-blue-200 rounded-xl focus:ring-blue-500/20 focus:border-blue-400 outline-none shadow-sm"
                  required
                >
                  <option value="" disabled>Pilih Tujuan...</option>
                  {accountOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.text_1}</option>
                  ))}
                </select>
              </div>
            )}

            {showPersonSelector && !isTransfer && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 relative">
                <label className={`text-[10px] md:text-[11px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
                  <User size={14} /> Pilih Pihak (Customer / Karyawan)
                </label>
                <div className="relative mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cari nama..."
                      value={searchPerson}
                      onChange={(e) => setSearchPerson(e.target.value)}
                      onFocus={() => setIsPersonOpen(true)}
                      className="flex-1 min-w-0 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPersonOpen(!isPersonOpen)}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shrink-0"
                    >
                      <ChevronDown size={16} className={`transition-transform duration-200 ${isPersonOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isPersonOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {personOptions.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-500 text-center">Memuat data...</div>
                      ) : (
                        personOptions
                          .filter(opt => opt.text_1.toLowerCase().includes(searchPerson.toLowerCase()))
                          .map(opt => (
                            <div
                              key={opt.id}
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  person: opt.id,
                                  persontext: opt.source === 'user' ? (opt.id_lama || opt.text_1) : opt.text_1
                                }));
                                setSearchPerson('');
                                setIsPersonOpen(false);
                              }}
                              className="px-3 py-2.5 text-xs md:text-sm font-semibold text-slate-700 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center gap-2"
                            >
                              <span className="truncate">{opt.text_1}</span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                {opt.source === 'user' ? 'Karyawan' : 'Customer'}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
                {formData.person && (
                  <div className="mt-2.5 text-xs font-semibold text-emerald-600 bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between gap-2">
                    <span>Dipilih:</span>
                    <span className="text-slate-800 truncate">{formData.persontext}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nominal Rupiah */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <label className={`text-[10px] md:text-[11px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
              <DollarSign size={14} /> Nominal Rupiah
            </label>
            <div className="relative mt-2">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${txtColor}`}>Rp</span>
              <input
                type="number"
                name="nominal"
                placeholder="0"
                value={formData.nominal || ''}
                onChange={handleInputChange}
                className={`w-full pl-9 pr-3 py-2.5 text-xs md:text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`}
                required
              />
            </div>
            {Number(formData.nominal) > 0 && (
              <p className="mt-1.5 text-[11px] font-bold text-slate-500 ml-1">
                Terbilang: <span className="font-extrabold text-slate-800">{formatRupiah(Number(formData.nominal))}</span>
              </p>
            )}
          </div>

          {/* Catatan */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <label className={`text-[10px] md:text-[11px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
              <FileText size={14} /> Catatan
            </label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <input
                type="text"
                name="note"
                placeholder="Deskripsi/Catatan..."
                value={formData.note || ''}
                onChange={handleInputChange}
                className={`w-full p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`}
                required
              />
            </div>
          </div>

          {/* Lampiran Bukti */}
          <div className={`p-4 rounded-3xl border space-y-3 ${bgBox}`}>
            <div className="flex justify-between items-center">
              <label className={`text-[11px] font-black ${txtColor} uppercase tracking-wider flex items-center gap-2`}>
                <ImagePlus size={16} /> Lampiran Bukti
              </label>
              <label
                htmlFor="cashflow-file-input"
                className={`cursor-pointer text-[10px] font-black bg-white px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border ${btnUpload}`}
              >
                + Upload
              </label>
              <input
                id="cashflow-file-input"
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={e => {
                  const selectedFiles = Array.from(e.target.files || []);
                  if (selectedFiles.length > 0) {
                    setFiles(prev => [...prev, ...selectedFiles]);
                    setIsFormDirty(true);
                  }
                  e.target.value = '';
                }}
              />
            </div>
            {previewUrls.length === 0 ? (
              <div className="text-center py-5 rounded-2xl border-2 border-dashed border-white/50">
                <p className={`text-[10px] font-bold ${txtColor} opacity-70`}>Belum ada file terlampir</p>
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

        <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-5 border-t-2 border-slate-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs tracking-widest transition-colors"
          >
            BATALKAN
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2 ${
              isProcessing
                ? 'opacity-70 cursor-not-allowed bg-slate-400'
                : (formData.mutasi === 'Masuk'
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40'
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/40')
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                MENYIMPAN...
              </>
            ) : (
              <>
                <Save size={16} />
                SIMPAN TRANSAKSI
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
