import React from 'react';
import Modal from '../modal';
import { SalaryTabs } from '../salary/SalaryDetail';
import { formatRupiah } from '../../lib/money';
import type { GajiItemForm } from '../../types/pos';
import {
  CreditCard, Calendar, Users, Plus, Edit, Trash2, X, CheckCircle2,
  User, Info, DollarSign, FileText, Wallet, Upload, ChevronLeft
} from 'lucide-react';

export interface GajiHeader {
  date: string;
  qty: number;
  note: string;
}

interface PosGajiModalsProps {
  isGajiFormOpen: boolean;
  setIsGajiFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  gajiEditSession: { menuId: string } | null;
  setGajiEditSession: React.Dispatch<React.SetStateAction<{ menuId: string } | null>>;
  gajiHeader: GajiHeader;
  setGajiHeader: React.Dispatch<React.SetStateAction<GajiHeader>>;
  gajiItemList: GajiItemForm[];
  setGajiItemList: React.Dispatch<React.SetStateAction<GajiItemForm[]>>;
  salaryPeriodTab: string;
  setSalaryPeriodTab: React.Dispatch<React.SetStateAction<string>>;
  salaryReview: boolean;
  setSalaryReview: React.Dispatch<React.SetStateAction<boolean>>;
  isGajiItemSubModalOpen: boolean;
  setIsGajiItemSubModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  gajiItemSubData: GajiItemForm;
  setGajiItemSubData: React.Dispatch<React.SetStateAction<GajiItemForm>>;
  salaryTab: string;
  setSalaryTab: React.Dispatch<React.SetStateAction<string>>;
  editingGajiItemIndex: number | null;
  setEditingGajiItemIndex: React.Dispatch<React.SetStateAction<number | null>>;
  showGajiBonus: boolean;
  setShowGajiBonus: React.Dispatch<React.SetStateAction<boolean>>;
  availableUsers: any[];
  hasLoadedPreviousSlip: boolean;
  isFetchingEmployeeData: boolean;
  employeeActiveBon: number;
  isProcessing: boolean;
  calculateWorkingDays: (dateStr: string) => number;
  calculateItemNetto: (item: GajiItemForm, headerQty: number) => number;
  renderFormattedNetto: (amount: number, mainTextSize?: string, textColor?: string, rpColor?: string) => React.ReactNode;
  handleSelectPerson: (val: string) => void;
  handleEditGajiItem: (idx: number) => void;
  handleDeleteGajiItem: (idx: number) => void;
  handleSaveSubGajiItem: () => void;
  handleSaveGaji: () => Promise<void>;
  handleGajiSubItemFileAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveGajiSubItemFile: (idx: number) => void;
}

export const PosGajiModals: React.FC<PosGajiModalsProps> = ({
  isGajiFormOpen, setIsGajiFormOpen,
  gajiEditSession, setGajiEditSession,
  gajiHeader, setGajiHeader,
  gajiItemList, setGajiItemList,
  salaryPeriodTab, setSalaryPeriodTab,
  salaryReview, setSalaryReview,
  isGajiItemSubModalOpen, setIsGajiItemSubModalOpen,
  gajiItemSubData, setGajiItemSubData,
  salaryTab, setSalaryTab,
  editingGajiItemIndex, setEditingGajiItemIndex,
  showGajiBonus, setShowGajiBonus,
  availableUsers,
  hasLoadedPreviousSlip,
  isFetchingEmployeeData,
  employeeActiveBon,
  isProcessing,
  calculateWorkingDays,
  calculateItemNetto,
  renderFormattedNetto,
  handleSelectPerson,
  handleEditGajiItem,
  handleDeleteGajiItem,
  handleSaveSubGajiItem,
  handleSaveGaji,
  handleGajiSubItemFileAdd,
  handleRemoveGajiSubItemFile,
}) => {
  const emptyGajiItem = (): GajiItemForm => ({
    id: '', person: '', pokok: 0, tunjangan: 0, bonus_1: 0, bonus_2: 0, bonus_3: 0, bonus_4: 0,
    program: 0, lembur: 0, alfa: 0, setengah_hari: 0, sakit: 0, telat: 0, bpjs: 0, bon_diambil: 0, bon_dibayar: 0, netto: 0, diterima: 0
  });
  const resetHeader = () => setGajiHeader({ date: new Date().toISOString().split('T')[0], qty: calculateWorkingDays(new Date().toISOString().split('T')[0]), note: '' });

  return (
    <>
      {/* ===== 1. MODAL FORM PERANGKUM GAJI UTAMA (HEADER + DAFTAR LIST KARYAWAN) ===== */}
      <Modal
        isOpen={isGajiFormOpen && !isGajiItemSubModalOpen && !salaryReview}
        onClose={() => {
          setIsGajiFormOpen(false);
          setGajiEditSession(null);
          setGajiItemList([]);
          resetHeader();
        }}
        maxWidth="max-w-2xl" compact
        title="Slip Gaji"
      >
        {(() => {
          const grandTotalBatch = gajiItemList.reduce((sum, item) => sum + calculateItemNetto(item, gajiHeader.qty), 0);

          return (
            <div className="pos-modal-layout pos-form-fields bg-white">
              {/* HEADER MODAL */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white shrink-0 border-b border-emerald-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <CreditCard size={13} /> Gaji Batch Periode
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                    {gajiEditSession ? '✏️ Edit Slip Gaji' : 'Ringkasan Slip Gaji'}
                  </h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {gajiEditSession && (
                    <span className="px-2.5 py-1 bg-amber-500/30 text-amber-300 rounded-lg text-[9px] font-black border border-amber-500/40">
                      MODE EDIT
                    </span>
                  )}
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-xl text-[10px] font-black border border-emerald-500/30 shrink-0">
                    {gajiItemList.length} Karyawan
                  </span>
                </div>
              </div>

              <nav className="pos-modal-tabs" aria-label="Bagian periode gaji">
                <button type="button" aria-pressed={salaryPeriodTab === 'period'} className={salaryPeriodTab === 'period' ? 'bg-teal-100 text-teal-800' : 'text-slate-500'} onClick={() => setSalaryPeriodTab('period')}><Calendar size={15} /> Periode</button>
                <button type="button" aria-pressed={salaryPeriodTab === 'employees'} className={salaryPeriodTab === 'employees' ? 'bg-teal-100 text-teal-800' : 'text-slate-500'} onClick={() => setSalaryPeriodTab('employees')}><Users size={15} /> Karyawan ({gajiItemList.length})</button>
              </nav>
              {/* BODY SCROLLABLE */}
              <div className="pos-modal-scroll space-y-4 custom-scrollbar">
                {/* SECTION HEADER PERANGKUM: PERIODE, QTY, NOTE */}
                <div hidden={salaryPeriodTab !== "period"} className="p-4 bg-teal-50/60 border border-teal-100 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={15} className="text-amber-600" /> Periode gaji
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tanggal Periode Gaji */}
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1 min-h-8 mb-1">
                        Tanggal periode *
                      </label>
                      <input
                        type="date"
                        value={gajiHeader.date}
                        onChange={e => {
                          const newDate = e.target.value;
                          const autoQty = calculateWorkingDays(newDate);
                          setGajiHeader({ ...gajiHeader, date: newDate, qty: autoQty });
                        }}
                        className="w-full h-11 p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    {/* Qty Periode */}
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1 min-h-8 mb-1">
                        Hari kerja * <span className="normal-case font-normal text-slate-500" title="Total hari dikurangi hari Minggu; dapat diubah manual.">(otomatis {calculateWorkingDays(gajiHeader.date)})</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={gajiHeader.qty}
                        onChange={e => setGajiHeader({ ...gajiHeader, qty: Math.max(1, Number(e.target.value)) })}
                        className="w-full h-11 p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="26"
                      />

                    </div>

                    {/* Note / Keterangan Periode */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1 min-h-8 mb-1">
                        Catatan Periode Gaji
                      </label>
                      <input
                        type="text"
                        value={gajiHeader.note}
                        onChange={e => setGajiHeader({ ...gajiHeader, note: e.target.value })}
                        className="w-full h-11 p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Contoh: Gaji Periode 1 - 15 Agustus 2026"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION DAFTAR KARYAWAN PENERIMA GAJI */}
                <div hidden={salaryPeriodTab !== "employees"} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Users size={15} className="text-emerald-600" /> Daftar Penerima Gaji ({gajiItemList.length} Karyawan)
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Susun slip setiap karyawan sebelum menyimpan periode.</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingGajiItemIndex(null);
                        setGajiItemSubData(emptyGajiItem());
                        setSalaryTab('income');
                        setIsGajiItemSubModalOpen(true);
                      }}
                      className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0"
                    >
                      <Plus size={15} /> + Tambah Karyawan
                    </button>
                  </div>

                  {/* LIST CARDS KARYAWAN */}
                  {gajiItemList.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                      Belum ada penerima gaji ditambahkan. Klik <strong className="text-emerald-600">+ Tambah Karyawan</strong> di atas.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {gajiItemList.map((item, idx) => (
                        <div key={item.id || idx} className="p-3.5 bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black">
                                #{idx + 1}
                              </span>
                              <h5 className="font-extrabold text-slate-800 text-sm uppercase">👤 {item.person}</h5>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium">
                              <span>Pendapatan: <strong className="text-emerald-600">{formatRupiah((item.pokok + item.tunjangan + item.bonus_1 + item.bonus_2 + item.bonus_3 + item.bonus_4 + item.program + item.lembur))}</strong></span>
                              <span>|</span>
                              <span>Netto: {renderFormattedNetto(calculateItemNetto(item, gajiHeader.qty), "text-xs sm:text-sm", "text-emerald-700", "text-emerald-700")}</span>
                              <span>|</span>
                              <span>Diterima: <strong className="text-teal-600">{formatRupiah((item.diterima || 0))}</strong></span>
                              {item.note && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">📝 Note</span>}
                              {item.files && item.files.length > 0 && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">📎 {item.files.length} File</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={() => handleEditGajiItem(idx)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[11px] rounded-lg uppercase transition-colors flex items-center gap-1"
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteGajiItem(idx)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[11px] rounded-lg uppercase transition-colors flex items-center gap-1 border border-rose-200"
                            >
                              <Trash2 size={13} /> Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER LIVE SUMMARY & ACTION */}
              <div className="pos-modal-footer">
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Gaji Batch</p>
                  <div>
                    {renderFormattedNetto(grandTotalBatch, "text-xl sm:text-2xl", "text-teal-800", "text-teal-700")}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setIsGajiFormOpen(false);
                      setGajiEditSession(null);
                      setGajiItemList([]);
                      resetHeader();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors"
                  >
                    <X size={15} /> Batal
                  </button>
                  <button
                    onClick={() => setSalaryReview(true)}
                    disabled={isProcessing || gajiItemList.length === 0 || !gajiHeader.date}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 size={15} /> Tinjau slip gaji
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ===== 2. POP-UP SUB-MODAL FORM DETAIL GAJI KARYAWAN ===== */}
      <Modal
        isOpen={isGajiItemSubModalOpen}
        onClose={() => setIsGajiItemSubModalOpen(false)}
        maxWidth="max-w-2xl" compact
        title="Detail Gaji Karyawan"
      >
        {(() => {
          const calcNettoItem = calculateItemNetto(gajiItemSubData, gajiHeader.qty);

          return (
            <div className="pos-modal-layout pos-form-fields bg-white">
              {/* HEADER SUB-MODAL */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white shrink-0 border-b border-emerald-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <User size={13} /> Detail Karyawan
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                    {editingGajiItemIndex !== null ? 'Edit Slip Karyawan' : 'Tambah Slip Karyawan'}
                  </h3>
                </div>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-xl text-[10px] font-black border border-amber-500/30 shrink-0">
                  {gajiHeader.qty} hari kerja
                </span>
              </div>

              <SalaryTabs value={salaryTab} onChange={setSalaryTab} />
              {/* BODY SCROLLABLE */}
              <div className="pos-modal-scroll space-y-4 custom-scrollbar">
                {/* PILIH KARYAWAN (USER COLLECTION) */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1">
                  <label className="text-[11px] font-black text-emerald-900 uppercase tracking-wider block">
                    Penerima Gaji (Karyawan) *
                  </label>
                  <select
                    value={gajiItemSubData.person}
                    onChange={e => handleSelectPerson(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Pilih Karyawan Penerima --</option>
                    {availableUsers.map(u => {
                      const val = u.username || u.name || u.id;
                      const label = u.name ? `${u.name} (@${u.username || u.id})` : (u.username || u.id);
                      return (
                        <option key={u.id} value={val}>
                          👤 {label} {u.level ? `[Level ${u.level}]` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {availableUsers.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">
                      ⚠️ Semua karyawan (users) selain level 1 sudah dimasukkan ke dalam daftar periode ini.
                    </p>
                  )}
                </div>

                {/* Sembunyikan field di bawah jika Karyawan Belum Dipilih */}
                {!gajiItemSubData.person ? (
                  <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-xs space-y-2">
                    <User size={32} className="mx-auto text-slate-300 animate-pulse" />
                    <p className="text-slate-700 font-black text-sm">Pilih Karyawan Penerima Gaji</p>
                    <p className="text-[11px] text-slate-400 font-medium max-w-xs mx-auto">
                      Silakan pilih nama karyawan di atas terlebih dahulu untuk menampilkan form rincian gaji & potongan.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* INDIKATOR APABILA AUTO-FILL DARI PERIODE SEBELUMNYA */}
                    {hasLoadedPreviousSlip && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-800 font-extrabold flex items-center gap-2">
                        <Info size={16} className="text-emerald-600 shrink-0" />
                        <span>Form otomatis diisi dari komponen gaji periode sebelumnya untuk karyawan ini. Bebas disesuaikan manual.</span>
                      </div>
                    )}

                    {isFetchingEmployeeData && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 font-bold flex items-center gap-2 animate-pulse">
                        <Info size={16} className="text-amber-600 shrink-0" />
                        <span>Memuat data sisa bon & riwayat gaji karyawan...</span>
                      </div>
                    )}

                    {/* SECTION 1: PENDAPATAN */}
                    <div hidden={salaryTab !== "income"} className="border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-white flex justify-between items-center">
                        <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign size={15} /> 1. Pendapatan (+)
                        </span>
                        <span className="font-black text-xs text-emerald-100">
                          Subtotal: {formatRupiah((
                            (Number(gajiItemSubData.pokok)||0) + 
                            (Number(gajiItemSubData.tunjangan)||0) + 
                            (Number(gajiItemSubData.bonus_1)||0) + 
                            (Number(gajiItemSubData.bonus_2)||0) + 
                            (Number(gajiItemSubData.bonus_3)||0) + 
                            (Number(gajiItemSubData.bonus_4)||0) + 
                            (Number(gajiItemSubData.program)||0) + 
                            (Number(gajiItemSubData.lembur)||0)
                          ))}
                        </span>
                      </div>
                      <div className="p-4 bg-white space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Gaji Pokok</label>
                            <input type="number" value={gajiItemSubData.pokok || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, pokok: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                            <span className="text-[9px] font-medium text-slate-400 block mt-1">Nominal per bulan (Rp)</span>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Tunjangan</label>
                            <input type="number" value={gajiItemSubData.tunjangan || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, tunjangan: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                            <span className="text-[9px] font-medium text-slate-400 block mt-1">Nominal per bulan (Rp)</span>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Program</label>
                            <input type="number" value={gajiItemSubData.program || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, program: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                            <span className="text-[9px] font-medium text-slate-400 block mt-1">Nominal program (Rp)</span>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Lembur</label>
                            <input type="number" value={gajiItemSubData.lembur || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, lembur: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                            <span className="text-[9px] font-medium text-slate-400 block mt-1">Total lembur dibayar (Rp)</span>
                          </div>
                        </div>

                        {/* Bonus 1-4 dilipat; otomatis terbuka bila sudah berisi nilai */}
                        <div className="border-t border-slate-100 pt-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-black text-slate-600 uppercase">Bonus 1&ndash;4</span>
                            <button
                              type="button"
                              onClick={() => setShowGajiBonus(prev => !prev)}
                              aria-expanded={showGajiBonus}
                              className="text-[9px] font-black text-slate-600 hover:text-slate-800 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider transition-colors"
                            >
                              {showGajiBonus ? 'Sembunyikan bonus' : 'Tampilkan bonus'}
                            </button>
                          </div>
                          {(showGajiBonus || [gajiItemSubData.bonus_1, gajiItemSubData.bonus_2, gajiItemSubData.bonus_3, gajiItemSubData.bonus_4].some(v => Number(v) > 0)) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Bonus 1</label>
                                <input type="number" value={gajiItemSubData.bonus_1 || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bonus_1: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Bonus 2</label>
                                <input type="number" value={gajiItemSubData.bonus_2 || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bonus_2: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Bonus 3</label>
                                <input type="number" value={gajiItemSubData.bonus_3 || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bonus_3: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Bonus 4</label>
                                <input type="number" value={gajiItemSubData.bonus_4 || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bonus_4: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* HITUNG PREVIEW SUB-NOMINAL POTONGAN KEHADIRAN & POTONGAN LAIN */}
                    {(() => {
                      const headerQty = Math.max(1, gajiHeader.qty || 1);
                      const pokokVal = Number(gajiItemSubData.pokok) || 0;
                      const tunjVal = Number(gajiItemSubData.tunjangan) || 0;
                      const nilaiDasar = (pokokVal + tunjVal) / headerQty;

                      const alfaVal = Number(gajiItemSubData.alfa) || 0;
                      const setengahHariVal = Number(gajiItemSubData.setengah_hari) || 0;
                      const sakitVal = Number(gajiItemSubData.sakit) || 0;
                      const telatVal = Number(gajiItemSubData.telat) || 0;

                      const potAlfa = nilaiDasar * alfaVal;
                      const potSetengahHari = (nilaiDasar / 2) * setengahHariVal;
                      const potSakit = (nilaiDasar * 0.9) * sakitVal;
                      const potTelat = telatVal * 1000;

                      const subtotalKehadiran = potAlfa + potSetengahHari + potSakit + potTelat;

                      const bpjsVal = Number(gajiItemSubData.bpjs) || 0;
                      const bonDiambilVal = Number(gajiItemSubData.bon_diambil) || 0;
                      const bonDibayarVal = Number(gajiItemSubData.bon_dibayar) || 0;

                      const subtotalPotonganLain = bpjsVal + bonDiambilVal + bonDibayarVal;

                      return (
                        <>
                          {/* SECTION 2: POTONGAN KEHADIRAN */}
                          <div hidden={salaryTab !== "deductions"} className="border-2 border-amber-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={15} /> 2. Potongan Kehadiran (-)
                              </span>
                              <span className="font-black text-xs text-amber-100">
                                Subtotal: -{formatRupiah(Math.round(subtotalKehadiran))}
                              </span>
                            </div>
                            <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Alfa (Hari)</label>
                                <input type="number" value={gajiItemSubData.alfa || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, alfa: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {alfaVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {alfaVal} hari × {formatRupiah(Math.round(nilaiDasar))} = -{formatRupiah(Math.round(potAlfa))}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Setengah Hari (Hari)</label>
                                <input type="number" value={gajiItemSubData.setengah_hari || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, setengah_hari: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {setengahHariVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {setengahHariVal} hari × {formatRupiah(Math.round(nilaiDasar / 2))} = -{formatRupiah(Math.round(potSetengahHari))}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Sakit (Hari)</label>
                                <input type="number" value={gajiItemSubData.sakit || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, sakit: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {sakitVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {sakitVal} hari × {formatRupiah(Math.round(nilaiDasar * 0.9))} (90%) = -{formatRupiah(Math.round(potSakit))}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Telat (Menit/Kali)</label>
                                <input type="number" value={gajiItemSubData.telat || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, telat: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {telatVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {telatVal} kali/menit × Rp 1.000 = -{formatRupiah(Math.round(potTelat))}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* SECTION 3: POTONGAN LAINNYA & BON */}
                          <div hidden={salaryTab !== "deductions"} className="border-2 border-rose-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} /> 3. Bon / Potongan Lain (-)
                              </span>
                              <span className="font-black text-xs text-rose-100">
                                Subtotal: -{formatRupiah(subtotalPotonganLain)}
                              </span>
                            </div>
                            <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">BPJS (Rp)</label>
                                <input type="number" value={gajiItemSubData.bpjs || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bpjs: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-black text-slate-600 uppercase">Bayar Bon (Rp)</label>
                                  {employeeActiveBon > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setGajiItemSubData({ ...gajiItemSubData, bon_dibayar: employeeActiveBon })}
                                      className="text-[9px] font-black text-emerald-700 hover:text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider transition-colors"
                                    >
                                      Gunakan Sisa
                                    </button>
                                  )}
                                </div>
                                <input type="number" value={gajiItemSubData.bon_dibayar || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bon_dibayar: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {employeeActiveBon > 0 ? (
                                  <span className="text-[9px] font-bold text-emerald-700 block mt-1">
                                    💳 Sisa Bon Aktif: {formatRupiah(employeeActiveBon)}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-medium text-slate-400 block mt-1">
                                    Karyawan tidak memiliki sisa bon aktif.
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Ambil Bon (Rp)</label>
                                <input type="number" value={gajiItemSubData.bon_diambil || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, bon_diambil: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                <span className="text-[9px] font-bold text-slate-500 block mt-1">
                                  Total Bon (Saat Ini): {formatRupiah(employeeActiveBon)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* SECTION 4: NETTO (JUMLAH YANG DITERIMA KARYAWAN) */}
                          <div hidden={salaryTab !== "received"} className="border-2 border-teal-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Wallet size={15} /> Penerimaan manual
                              </span>
                              <span className="font-black text-xs text-teal-100">
                                {formatRupiah((Number(gajiItemSubData.diterima) || 0))}
                              </span>
                            </div>
                            <div className="p-4 bg-white">
                              <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Jumlah Diterima Karyawan (Rp)</label>
                              <input type="number" value={gajiItemSubData.diterima || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, diterima: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0" />
                              <span className="text-[9px] font-medium text-slate-400 block mt-1">
                                Isi manual jumlah uang yang diterima/ditransfer ke karyawan (opsional). Netto: {formatRupiah(calcNettoItem)}. Selisih diterima − netto: {formatRupiah((Number(gajiItemSubData.diterima) || 0) - calcNettoItem)}.
                              </span>
                            </div>
                          </div>

                          {/* SECTION 5: CATATAN & BUKTI TRANSFER (NOTE & FILE) */}
                          <div hidden={salaryTab !== "notes"} className="border-2 border-indigo-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} /> Catatan & Bukti Transfer
                              </span>
                              {gajiItemSubData.files && gajiItemSubData.files.length > 0 && (
                                <span className="font-black text-[10px] text-indigo-100 bg-indigo-500/30 px-2 py-0.5 rounded-lg border border-indigo-400/30">
                                  {gajiItemSubData.files.length} Lampiran File
                                </span>
                              )}
                            </div>
                            <div className="p-4 bg-white space-y-3">
                              {/* Input Note / Catatan Karyawan */}
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                                  Catatan Slip Karyawan (Note)
                                </label>
                                <input
                                  type="text"
                                  value={gajiItemSubData.note || ''}
                                  onChange={e => setGajiItemSubData({ ...gajiItemSubData, note: e.target.value })}
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                  placeholder="Contoh: Transfer via Mandiri a.n Karyawan / Catatan khusus"
                                />
                              </div>

                              {/* Upload Bukti Transfer / File */}
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                                  Bukti Transfer / Lampiran File
                                </label>
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center justify-center gap-2 p-3 bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-200 rounded-xl cursor-pointer text-indigo-700 transition-colors">
                                    <Upload size={16} />
                                    <span className="text-xs font-black uppercase tracking-wider">
                                      Upload Bukti Transfer / File
                                    </span>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*,.pdf"
                                      onChange={handleGajiSubItemFileAdd}
                                      className="hidden"
                                    />
                                  </label>

                                  {/* List Preview File Upload */}
                                  {gajiItemSubData.files && gajiItemSubData.files.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                                      {gajiItemSubData.files.map((file, fIdx) => {
                                        const url = gajiItemSubData.fileUrls?.[fIdx] || '';
                                        const isImg = file.type.startsWith('image/');
                                        return (
                                          <div key={fIdx} className="relative group bg-slate-100 rounded-xl p-2 border border-slate-200 flex flex-col items-center">
                                            {isImg && url ? (
                                              <img src={url} alt={file.name} className="w-full h-16 object-cover rounded-lg mb-1" />
                                            ) : (
                                              <div className="w-full h-16 bg-indigo-100 text-indigo-700 flex items-center justify-center rounded-lg mb-1">
                                                <FileText size={24} />
                                              </div>
                                            )}
                                            <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
                                              {file.name}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveGajiSubItemFile(fIdx)}
                                              className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md transition-colors"
                                            >
                                              <Trash2 size={11} />
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
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* FOOTER SUB-MODAL ACTION */}
              <div className="pos-modal-footer">
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Netto Karyawan Ini</p>
                  <div>
                    {renderFormattedNetto(calcNettoItem, "text-xl sm:text-2xl", "text-teal-800", "text-teal-700")}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setIsGajiItemSubModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors"
                  >
                    <ChevronLeft size={15} /> Kembali
                  </button>
                  <button
                    onClick={handleSaveSubGajiItem}
                    disabled={isFetchingEmployeeData || !gajiItemSubData.person}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 size={15} /> Masukkan ke periode
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={salaryReview && isGajiFormOpen} onClose={() => !isProcessing && setSalaryReview(false)} title="Konfirmasi periode gaji" maxWidth="max-w-2xl" compact>
        <div className="pos-modal-layout">
          <div className="pos-modal-scroll space-y-3">
            <p className="text-sm text-slate-600">{gajiHeader.date} • {gajiHeader.qty} hari kerja • {gajiItemList.length} karyawan</p>
            {gajiHeader.note && <p className="text-sm">{gajiHeader.note}</p>}
            {gajiItemList.map((item, index) => <div key={item.id || index} className="p-3 rounded-xl border border-teal-100 space-y-2 text-sm">
              <div className="flex justify-between gap-2"><strong>{item.person}</strong><button type="button" className="pos-action text-teal-700" onClick={() => { setSalaryReview(false); handleEditGajiItem(index); }}><Edit size={14} /> Ubah</button></div>
              <p>Netto: <strong>{formatRupiah(calculateItemNetto(item, gajiHeader.qty))}</strong></p>
              <p>Diterima (manual): {formatRupiah(Number(item.diterima) || 0)}</p>
              <p className="text-xs text-slate-500">Bon diambil: {formatRupiah(Number(item.bon_diambil) || 0)} • Bon dibayar: {formatRupiah(Number(item.bon_dibayar) || 0)}</p>
            </div>)}
            <p className="text-xs text-slate-500">Slip baru tersimpan setelah Anda menekan Simpan. Perubahan slip dan bon diproses bersama.</p>
          </div>
          <div className="pos-modal-footer"><strong className="text-teal-800">{formatRupiah(gajiItemList.reduce((sum, item) => sum + calculateItemNetto(item, gajiHeader.qty), 0))}</strong><button disabled={isProcessing} onClick={() => setSalaryReview(false)}><ChevronLeft size={15} /> Kembali</button><button disabled={isProcessing} className="bg-teal-700 text-white" onClick={async () => { await handleSaveGaji(); setSalaryReview(false); }}><CheckCircle2 size={15} /> {isProcessing ? 'Menyimpan…' : 'Simpan semua slip'}</button></div>
        </div>
      </Modal>
    </>
  );
};
