import { X, User, DollarSign, FileText, Calendar } from 'lucide-react';
import { formatRupiah } from '../../lib/money';

interface PersonDetailModalProps {
  isOpen: boolean;
  selectedUserForDetail: any;
  personDetailTab: 'Overview' | 'History';
  activeDetailTab: 'Overview' | 'Gaji' | 'Bon';
  historySummary: { totalBelanja: number; totalSisa: number };
  historyList: any[];
  historyPage: number;
  historyTotalPages: number;
  dummySalaryList: any[];
  salaryLoading: boolean;
  salaryPage: number;
  salaryTotalPages: number;
  dummyBonList: any[];
  bonPage: number;
  bonTotalPages: number;
  userLevelFromStorage: string;
  getAvatarInitials: (name: string) => string;
  formatLocalDateTime: (dateStr: string) => string;
  onClose: () => void;
  onPersonDetailTabChange: (tab: 'Overview' | 'History') => void;
  onActiveDetailTabChange: (tab: 'Overview' | 'Gaji' | 'Bon') => void;
  onFetchPersonHistory: (id: string, page: number) => void;
  onFetchUserGaji: (username: string, page: number) => void;
  onSelectSalary: (salaryRecord: any) => void;
  onBonPageChange: (page: number) => void;
  onOpenEditPerson: (person: any) => void;
  onOpenEditUser: (user: any) => void;
}

export default function PersonDetailModal({
  isOpen,
  selectedUserForDetail,
  personDetailTab,
  activeDetailTab,
  historySummary,
  historyList,
  historyPage,
  historyTotalPages,
  dummySalaryList,
  salaryLoading,
  salaryPage,
  salaryTotalPages,
  dummyBonList,
  bonPage,
  bonTotalPages,
  userLevelFromStorage,
  getAvatarInitials,
  formatLocalDateTime,
  onClose,
  onPersonDetailTabChange,
  onActiveDetailTabChange,
  onFetchPersonHistory,
  onFetchUserGaji,
  onSelectSalary,
  onBonPageChange,
  onOpenEditPerson,
  onOpenEditUser,
}: PersonDetailModalProps) {
  if (!isOpen || !selectedUserForDetail) return null;

  let gradient = '';
  let typeLabel = '';
  if (selectedUserForDetail.kategori === 'Person') {
    const isCustomer = String(selectedUserForDetail.jenis).toLowerCase() === 'customer';
    gradient = isCustomer ? 'from-emerald-500 to-teal-600' : 'from-amber-500 to-orange-600';
    typeLabel = isCustomer ? 'Customer' : 'Supplier';
  } else {
    gradient = 'from-blue-500 to-indigo-600';
    typeLabel = selectedUserForDetail.level === 1 ? 'Admin' : (selectedUserForDetail.level === 10 ? 'Mekanik' : 'Karyawan');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform scale-100 animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* === HEADER DINAMIS === */}
        <div className={`bg-gradient-to-br ${gradient} p-6 text-white relative shrink-0`}>
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-md"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-4 mt-2">
            {selectedUserForDetail.link_image ? (
              <img src={selectedUserForDetail.link_image} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md bg-white" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white text-cyan-600 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                {getAvatarInitials(selectedUserForDetail.text_1 || selectedUserForDetail.name || selectedUserForDetail.username)}
              </div>
            )}
            <div className="overflow-hidden">
              <h3 className="font-black text-xl leading-tight truncate">
                {selectedUserForDetail.text_1 || selectedUserForDetail.name || selectedUserForDetail.username}
              </h3>
              <p className="text-white/80 text-sm font-medium mt-0.5 truncate">
                {selectedUserForDetail.text_2 || (selectedUserForDetail.username ? `@${selectedUserForDetail.username}` : 'Partner Eksternal')}
              </p>
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                {typeLabel}
              </span>
            </div>
          </div>
        </div>

        {/* === TAB NAVIGASI === */}
        <div className="flex border-b border-gray-200 bg-white px-4">
          {selectedUserForDetail.kategori === 'Person' ? (
            <>
              <button
                onClick={() => onPersonDetailTabChange('Overview')}
                className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                  personDetailTab === 'Overview'
                    ? 'border-b-2 border-cyan-600 text-cyan-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => onPersonDetailTabChange('History')}
                className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                  personDetailTab === 'History'
                    ? 'border-b-2 border-cyan-600 text-cyan-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                History
              </button>
            </>
          ) : (
            <>
              {(['Overview', 'Gaji', 'Bon'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onActiveDetailTabChange(tab)}
                  className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeDetailTab === tab
                      ? 'border-b-2 border-indigo-600 text-indigo-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab === 'Overview' && <User size={14} />}
                  {tab === 'Gaji' && <DollarSign size={14} />}
                  {tab === 'Bon' && <FileText size={14} />}
                  <span>{tab}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* === KONTEN TAB === */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {selectedUserForDetail.kategori === 'Person' ? (
            <>
              {personDetailTab === 'Overview' && (() => {
                const isCust = String(selectedUserForDetail.jenis).toLowerCase() === 'customer';
                const themeBg = isCust ? 'bg-cyan-50/50' : 'bg-amber-50/50';
                const themeBorder = isCust ? 'border-cyan-100' : 'border-amber-100';
                const themeText = isCust ? 'text-cyan-800' : 'text-amber-800';
                const themeMuted = isCust ? 'text-cyan-600/70' : 'text-amber-600/70';
                
                const jalan = selectedUserForDetail.text_3 || '';
                const rt = selectedUserForDetail.number_2 ? `RT ${selectedUserForDetail.number_2}` : '';
                const rw = selectedUserForDetail.number_3 ? `RW ${selectedUserForDetail.number_3}` : '';
                const rtrw = [rt, rw].filter(Boolean).join('/');
                const desa = selectedUserForDetail.text_4 ? `Ds. ${selectedUserForDetail.text_4}` : '';
                const kec = selectedUserForDetail.text_5 ? `Kec. ${selectedUserForDetail.text_5}` : '';
                const kota = selectedUserForDetail.text_6 || '';
                const prov = selectedUserForDetail.text_7 || '';

                const fullAddress = [jalan, rtrw, desa, kec, kota, prov].filter(Boolean).join(', ');

                return (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className={`p-5 md:p-6 rounded-3xl border ${themeBorder} ${themeBg} relative overflow-hidden shadow-sm`}>
                      <div className={`absolute -top-10 -right-10 w-32 h-32 blur-2xl opacity-40 rounded-full pointer-events-none ${isCust ? 'bg-cyan-400' : 'bg-amber-400'}`} />
                      <div className="relative z-10">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${themeMuted} mb-1.5`}>
                          Alamat Lengkap
                        </p>
                        <p className={`font-bold text-sm md:text-base leading-relaxed ${themeText}`}>
                          {fullAddress || 'Belum ada data alamat yang diinputkan.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kontak (HP/WA)</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.phone || '-'}</p>
                      </div>
                      
                      <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Induk (NIK)</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.number_4 || '-'}</p>
                      </div>

                      <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe / Kelompok</p>
                        <p className="font-bold text-slate-700 text-sm mt-1.5">
                          <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${themeBorder} ${themeBg} ${themeText}`}>
                            {selectedUserForDetail.text_9 || '-'}
                          </span>
                        </p>
                      </div>
                      
                      <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Rekam Internal</p>
                        <p className="font-black text-slate-400 text-sm mt-1 uppercase">#{selectedUserForDetail.id_lama || selectedUserForDetail.id}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {personDetailTab === 'History' && (
                <div className="animate-in fade-in duration-300">
                  <div className={`grid gap-3 mb-5 ${historySummary.totalSisa > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-cyan-500/30 relative overflow-hidden flex flex-col justify-center min-h-[5rem]">
                      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-cyan-100 mb-0.5 relative z-10">Total Belanja</p>
                      <p className="text-xl md:text-2xl font-black tracking-tight relative z-10">Rp {historySummary.totalBelanja.toLocaleString('id-ID')}</p>
                    </div>
                    
                    {historySummary.totalSisa > 0 && (
                      <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-4 rounded-2xl text-white shadow-lg shadow-rose-500/30 relative overflow-hidden flex flex-col justify-center min-h-[5rem]">
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-100 mb-0.5 relative z-10">
                          {String(selectedUserForDetail.jenis).toLowerCase() === 'customer' ? 'Total Piutang' : 'Total Hutang'} Berjalan
                        </p>
                        <p className="text-xl md:text-2xl font-black tracking-tight relative z-10">
                          Rp {historySummary.totalSisa.toLocaleString('id-ID')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {historyList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <span className="text-2xl mb-2 opacity-40">📭</span>
                        <p className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest">Belum ada riwayat transaksi</p>
                      </div>
                    ) : (
                      historyList.map(item => (
                        <div
                          key={item.id}
                          onClick={() => { window.location.href = `/?ref=${item.id}`; }}
                          className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-cyan-400 hover:shadow-md transition-all group flex flex-col gap-3 relative overflow-hidden"
                          title="Klik untuk melihat detail nota"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-50/0 via-transparent to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2 relative z-10">
                            <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-cyan-400 transition-colors" />
                              {formatLocalDateTime(item.created_at)}
                            </span>
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm ${
                              item.status === 'lunas' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                            }`}>
                              {item.status === 'lunas' ? 'LUNAS' : 'BELUM'}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-end relative z-10">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-cyan-600 transition-colors">
                                {item.jenis || 'Transaksi'}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-1 font-bold">
                                Opr: <span className="text-slate-500">{item.operator || '-'}</span>
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-900 group-hover:scale-105 transition-transform origin-right block">
                                Rp {item.total?.toLocaleString('id-ID') || 0}
                              </span>
                              {item.status !== 'lunas' && (() => {
                                const sisa = (item.total || 0) - (item.dibayar || 0);
                                return sisa > 0 ? (
                                  <span className="text-[10px] font-bold text-rose-500 block mt-0.5">
                                    Sisa: Rp {sisa.toLocaleString('id-ID')}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {historyList.length > 0 && (
                    <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner">
                      <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-200">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Halaman Ini</span>
                        <span className="text-sm font-black text-slate-700">
                          Rp {historyList.reduce((acc, curr) => acc + (curr.total || 0), 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      
                      {historyTotalPages > 1 ? (
                        <div className="flex justify-between items-center">
                          <button
                            disabled={historyPage === 1}
                            onClick={() => onFetchPersonHistory(selectedUserForDetail.id, historyPage - 1)}
                            className="py-2 px-4 bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-black uppercase tracking-wider rounded-xl text-[10px] disabled:opacity-40 transition-colors shadow-sm"
                          >
                            Prev
                          </button>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                            Hal {historyPage} / {historyTotalPages}
                          </span>
                          <button
                            disabled={historyPage === historyTotalPages}
                            onClick={() => onFetchPersonHistory(selectedUserForDetail.id, historyPage + 1)}
                            className="py-2 px-4 bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-black uppercase tracking-wider rounded-xl text-[10px] disabled:opacity-40 transition-colors shadow-sm"
                          >
                            Next
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Semua data telah dimuat
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {activeDetailTab === 'Overview' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-5 rounded-3xl border border-indigo-100 bg-indigo-50/50 relative overflow-hidden shadow-xs">
                    <div className="absolute -top-10 -right-10 w-32 h-32 blur-2xl opacity-40 rounded-full bg-indigo-400 pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Informasi Karyawan</p>
                        <h4 className="text-base font-black text-indigo-950 mt-0.5">{selectedUserForDetail.name || selectedUserForDetail.text_1 || selectedUserForDetail.username}</h4>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${selectedUserForDetail.status === 'inactive' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                        {selectedUserForDetail.status === 'inactive' ? 'Nonaktif' : 'Aktif'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</p>
                      <p className="font-bold text-slate-800 text-sm mt-1">@{selectedUserForDetail.username || '-'}</p>
                    </div>
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level Jabatan</p>
                      <p className="font-bold text-slate-800 text-sm mt-1">
                        <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black border border-indigo-100">
                          {selectedUserForDetail.level === 1 ? 'Admin' : selectedUserForDetail.level === 10 ? 'Mekanik' : 'Karyawan'}
                        </span>
                      </p>
                    </div>
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                      <p className="font-bold text-slate-700 text-xs mt-1 truncate">{selectedUserForDetail.email || '-'}</p>
                    </div>
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-xs col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telepon / WA</p>
                      <p className="font-bold text-slate-700 text-xs mt-1">{selectedUserForDetail.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
              {activeDetailTab === 'Gaji' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {dummySalaryList.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{salaryLoading ? 'Memuat riwayat gaji…' : 'Belum ada riwayat penerimaan gaji'}</p>
                    </div>
                  ) : (
                    dummySalaryList.map((gaji, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-indigo-300 transition-colors">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                          <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                            <Calendar size={13} /> {gaji.created_at}
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 tabular-nums">
                            {formatRupiah(gaji.nominal)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2.5 text-[11px]">
                          <span className="font-bold text-slate-500">Operator: <strong className="text-slate-700">{gaji.operator || '-'}</strong></span>
                          <button type="button" onClick={() => onSelectSalary(gaji.record)} className="pos-action text-teal-700 bg-teal-50"><FileText size={14} /> Detail slip</button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                    <button disabled={salaryLoading || salaryPage === 1} onClick={() => onFetchUserGaji(selectedUserForDetail.username || selectedUserForDetail.id_lama || selectedUserForDetail.name || '', salaryPage - 1)} className="py-2 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs">Prev</button>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hal {salaryPage} / {salaryTotalPages}</span>
                    <button disabled={salaryLoading || salaryPage >= salaryTotalPages} onClick={() => onFetchUserGaji(selectedUserForDetail.username || selectedUserForDetail.id_lama || selectedUserForDetail.name || '', salaryPage + 1)} className="py-2 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs">Next</button>
                  </div>
                </div>
              )}
              {activeDetailTab === 'Bon' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
                    <p className="text-xs text-slate-500">Total sisa bon berjalan</p>
                    <p className="text-xl md:text-2xl font-semibold text-rose-700 tabular-nums">
                      {formatRupiah(selectedUserForDetail.number || 0)}
                    </p>
                  </div>

                  {dummyBonList.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum ada riwayat bon karyawan</p>
                    </div>
                  ) : (
                    dummyBonList.slice((bonPage-1)*5, bonPage*5).map((bon, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-purple-300 transition-colors">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                          <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                            <Calendar size={13} /> {bon.created_at}
                          </span>
                          <span className="text-xs font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                            Nominal: {formatRupiah(bon.cicilan)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2.5 text-[11px]">
                          <span className="font-bold text-slate-500">Mutasi/Ket: <strong className="text-slate-700">{bon.note || 'Transaksi Bon'}</strong></span>
                          <span className="font-bold text-slate-400">Opr: <strong className="text-slate-700">{bon.operator}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                    <button disabled={bonPage === 1} onClick={() => onBonPageChange(bonPage - 1)} className="py-2 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs">Prev</button>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hal {bonPage} / {bonTotalPages}</span>
                    <button disabled={bonPage === bonTotalPages} onClick={() => onBonPageChange(bonPage + 1)} className="py-2 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* === FOOTER TOMBOL === */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
          >
            Tutup
          </button>
          {selectedUserForDetail.kategori === 'Person' ? (
            <button
              onClick={() => onOpenEditPerson(selectedUserForDetail)}
              className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-cyan-700 transition-colors shadow-md shadow-cyan-600/20"
            >
              Edit {selectedUserForDetail.jenis === 'Customer' ? 'Customer' : 'Supplier'}
            </button>
          ) : (
            [1,2,3,4,5,6].includes(Number(userLevelFromStorage)) && (
              <button
                onClick={() => onOpenEditUser(selectedUserForDetail)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-md shadow-indigo-600/20"
              >
                Edit User Karyawan
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
