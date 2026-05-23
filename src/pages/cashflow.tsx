import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Wallet, Search, Trash2, Edit, ChevronLeft, ChevronRight, 
  ArrowDownRight, ArrowUpRight, Calendar, User, CreditCard,
  ExternalLink, Layers, X, PlayCircle
} from 'lucide-react';

interface Cashflow {
  id: string;
  id_lama: string;
  ref: string;
  operator: string;
  created_at: string;
  jenis: string;
  mutasi: string; 
  account_1: string;
  account_2: string;
  person: string;
  nominal: number;
  note: string;
  ref_baru: string;
  created: string; 
  file: string[]; 
}

interface DropdownItem {
  id: string;
  kategori: string;
  jenis: string;
  text_1: string;
  visibilitas: string;
}

export default function CashflowPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Cashflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [jenisOptions, setJenisOptions] = useState<DropdownItem[]>([]);
  const [accountOptions, setAccountOptions] = useState<DropdownItem[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20; 
  
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMutasi, setFilterMutasi] = useState<string>('semua');

  const [modalType, setModalType] = useState<'detail' | 'form' | 'delete' | null>(null);
  const [selectedTx, setSelectedTx] = useState<Cashflow | null>(null);
  const [formData, setFormData] = useState<Partial<Cashflow>>({});

  // States untuk File & Media Gallery
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const isEditMode = !!(selectedTx && selectedTx.id);

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
  };

  // Helper untuk mendapatkan nama akun dari ID
  const getAccountName = (idOrName: string) => {
    const acc = accountOptions.find(opt => opt.id === idOrName || opt.text_1 === idOrName);
    return acc ? acc.text_1 : idOrName;
  };

  const fetchDropdowns = async () => {
    try {
      const userLevel = "1"; 
      const records = await pb.collection('dropdown').getFullList<DropdownItem>({
        filter: `kategori ~ "Cashflow" && visibilitas ~ "${userLevel}"`,
        $autoCancel: false
      });
      setJenisOptions(records.filter(r => String(r.jenis).toLowerCase().includes('jenis')));
      setAccountOptions(records.filter(r => String(r.jenis).toLowerCase().includes('account')));
    } catch (error) {
      console.error("Gagal memuat dropdown:", error);
    }
  };

  const fetchCashflow = async () => {
    try {
      setLoading(true);
      let conditions: string[] = [];
      let params: any = {};

      if (searchTerm) {
        const terms = searchTerm.toLowerCase().trim().split(/\s+/);
        terms.forEach((term, idx) => {
          conditions.push(`(ref ~ {:t${idx}} || note ~ {:t${idx}} || person ~ {:t${idx}} || jenis ~ {:t${idx}})`);
          params[`t${idx}`] = term;
        });
      }

      if (filterMutasi !== 'semua') {
        if (filterMutasi === 'masuk') conditions.push(`(mutasi ~ "masuk" || mutasi ~ "debet")`);
        else if (filterMutasi === 'keluar') conditions.push(`(mutasi ~ "keluar" || mutasi ~ "kredit")`);
      }

      const requestOptions: any = { sort: '-created_at' };
      if (conditions.length > 0) requestOptions.filter = pb.filter(conditions.join(' && '), params);

      const result = await pb.collection('cashflow').getList<Cashflow>(page, perPage, {
        ...requestOptions,
        $autoCancel: false 
      });
      setTransactions(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error("Gagal mengambil data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDropdowns(); }, []);
  useEffect(() => {
    const delayDebounce = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchInput, filterMutasi]);
  useEffect(() => { fetchCashflow(); }, [page, searchTerm, filterMutasi]);

  // Membersihkan local object URLs untuk preview file agar tidak memory leak
  useEffect(() => {
    if (files.length === 0) { setPreviewUrls([]); return; }
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Cashflow[] } = {};
    transactions.forEach(tx => {
      const date = tx.created_at ? tx.created_at.split(' ')[0] : 'Tanpa Tanggal';
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    });
    return groups;
  }, [transactions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value }));
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const currentUser = pb.authStore.model;
      const operatorName = currentUser?.name || currentUser?.username || 'Admin';
      const formattedDate = formData.created_at ? formData.created_at.replace('T', ' ') + ':00' : new Date().toISOString().replace('T', ' ').slice(0, 19);

      const formDataObj = new FormData();
      formDataObj.append("jenis", formData.jenis || "");
      formDataObj.append("mutasi", formData.mutasi?.toLowerCase() === 'masuk' ? 'Debet' : 'Kredit');
      formDataObj.append("account_1", formData.account_1 || "");
      formDataObj.append("nominal", String(formData.nominal || 0));
      formDataObj.append("note", formData.note || "");
      formDataObj.append("created_at", formattedDate);
      formDataObj.append("operator", operatorName);

      if (files && files.length > 0) {
        files.forEach(file => formDataObj.append("file", file));
      }

      if (isEditMode && selectedTx) {
        await pb.collection('cashflow').update(selectedTx.id, formDataObj);
      } else {
        await pb.collection('cashflow').create(formDataObj);
      }
      
      setModalType(null);
      setFormData({});
      setFiles([]);
      fetchCashflow();
    } catch (error: any) {
      alert("Gagal simpan: " + (error.data?.message || "Terjadi kesalahan"));
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDelete = async () => {
    if (!selectedTx) return;
    setIsProcessing(true);
    try {
      await pb.collection('cashflow').delete(selectedTx.id);
      setModalType(null);
      fetchCashflow();
    } catch (error) {
      alert("Gagal menghapus.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper untuk cek ekstensi file video
  const isVideo = (filename: string) => filename.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50 relative">
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-200"><Wallet size={28} /></div>
            Arus Kas
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Monitoring perputaran modal Prima Motor</p>
        </div>
        <button 
          onClick={() => {
            setSelectedTx(null);
            setFiles([]);
            setFormData({ mutasi: 'Masuk', created_at: new Date().toISOString().slice(0,16).replace('T', ' ') });
            setModalType('form');
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95"
        >
          + Catat Kas
        </button>
      </div>

      {/* CONTAINER UTAMA */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-white flex-1 flex flex-col overflow-hidden">
        
        {/* FILTER & PENCARIAN */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 bg-white/50 backdrop-blur-md">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
            {['semua', 'masuk', 'keluar'].map(tab => (
              <button key={tab} onClick={() => setFilterMutasi(tab)} className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${filterMutasi === tab ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
            <input type="text" placeholder="Cari transaksi..." className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        </div>

        {/* DAFTAR TRANSAKSI */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : Object.keys(groupedTransactions).length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">Belum ada data transaksi</div>
          ) : (
            Object.entries(groupedTransactions).map(([date, items]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-[1px] flex-1 bg-slate-100" />
                  <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-500 uppercase tracking-widest text-center">
                    {date !== 'Tanpa Tanggal' ? new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : date}
                  </span>
                  <div className="h-[1px] flex-1 bg-slate-100" />
                </div>
                
                <div className="grid gap-3">
                  {items.map((tx) => {
                    const isMasuk = tx.mutasi.toLowerCase().includes('masuk') || tx.mutasi.toLowerCase().includes('debet');
                    return (
                      <div key={tx.id} onClick={() => { setSelectedTx(tx); setModalType('detail'); }} className="group bg-white border border-slate-100 p-4 rounded-3xl hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isMasuk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {isMasuk ? <ArrowDownRight strokeWidth={2.5}/> : <ArrowUpRight strokeWidth={2.5}/>}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{tx.ref}</span>
                            </div>
                            <h4 className="font-bold text-slate-700">{tx.note}</h4>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><Layers size={12}/> {tx.jenis}</span>
                              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><User size={12}/> {tx.person}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-black tracking-tight ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>{isMasuk ? '+' : '-'} {formatRupiah(tx.nominal)}</p>
                          {/* Nama Akun menggunakan fungsi getAccountName */}
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getAccountName(tx.account_1)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center shrink-0">
          <p className="text-sm font-bold text-slate-400">Hal. {page} / {totalPages || 1}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-3 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"><ChevronLeft size={20}/></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-3 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"><ChevronRight size={20}/></button>
          </div>
        </div>
      </div>

      {/* MODAL FORM TAMBAH/EDIT */}
      <Modal isOpen={modalType === 'form'} onClose={() => setModalType(null)} title={isEditMode ? "Edit Transaksi" : "Catat Transaksi"}>
        <form onSubmit={submitForm} className="space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {['Masuk', 'Keluar'].map(m => (
              <button key={m} type="button" onClick={() => setFormData({...formData, mutasi: m})} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${formData.mutasi === m ? (m === 'Masuk' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-rose-500 text-white shadow-lg') : 'text-slate-400'}`}>
                UANG {m.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Waktu Transaksi</label>
            <input type="datetime-local" name="created_at" value={formData.created_at ? formData.created_at.replace(' ', 'T') : ''} onChange={handleInputChange} required className="w-full mt-1.5 p-3.5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-600" />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Jenis Cashflow</label>
                <select name="jenis" value={formData.jenis || ''} onChange={handleInputChange} required className="w-full mt-1.5 p-3.5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-600">
                  <option value="">Pilih Jenis</option>
                  {jenisOptions.map(opt => <option key={opt.id} value={opt.text_1}>{opt.text_1}</option>)}
                  {jenisOptions.length === 0 && <option disabled>Data Jenis Tidak Ditemukan di DB</option>}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Akun Pembayaran</label>
                <select name="account_1" value={formData.account_1 || ''} onChange={handleInputChange} required className="w-full mt-1.5 p-3.5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-600">
                  <option value="">Pilih Akun</option>
                  {accountOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.text_1}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nominal</label>
              <input type="number" name="nominal" value={formData.nominal || ''} onChange={handleInputChange} required placeholder="Rp 0" className="w-full mt-1.5 p-4 bg-slate-50 border-none rounded-2xl text-2xl font-black outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Keterangan</label>
              <textarea name="note" value={formData.note || ''} onChange={handleInputChange} className="w-full mt-1.5 p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium" rows={3} />
            </div>
            
            {/* INPUT FILE & PREVIEW FORM */}
            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lampiran Media (Gambar / Video, Max 5MB)</label>
              <input 
                type="file" 
                multiple 
                accept="image/*,video/*"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  const valid = selected.filter(f => f.size <= 5 * 1024 * 1024 && (f.type.startsWith('image/') || f.type.startsWith('video/')));
                  
                  if (valid.length !== selected.length) {
                    alert("Beberapa file dilewati karena lebih dari 5MB atau format tidak valid.");
                  }

                  // Logika Mencegah Duplikat & Append File Baru
                  setFiles(prevFiles => {
                    const newFilesList = [...prevFiles]; 
                    
                    valid.forEach(newFile => {
                      // Cek apakah file sudah ada berdasarkan nama dan ukurannya
                      const isDuplicate = newFilesList.some(
                        existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size
                      );
                      
                      if (!isDuplicate) {
                        newFilesList.push(newFile); 
                      }
                    });
                    
                    return newFilesList;
                  });

                  // Reset input value agar event onChange tetap terpanggil jika user memilih file yang sama setelah menghapusnya
                  e.target.value = '';
                }}
                className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all cursor-pointer"
              />
              
              <div className="flex flex-wrap gap-3 mt-3">
                {/* Tampilkan file lama jika mode Edit dan belum dihapus dari database (Hanya Display) */}
                {isEditMode && selectedTx?.file && files.length === 0 && selectedTx.file.map(filename => (
                   <div key={filename} className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
                      {isVideo(filename) ? <PlayCircle size={20} className="absolute text-white drop-shadow-md z-10" /> : null}
                      {isVideo(filename) 
                        ? <video src={pb.files.getURL(selectedTx, filename)} className="w-full h-full object-cover opacity-75" /> 
                        : <img src={pb.files.getURL(selectedTx, filename)} alt="old" className="w-full h-full object-cover" />}
                   </div>
                ))}

                {/* Tampilkan preview file baru yang akan diunggah lengkap dengan tombol Hapus */}
                {previewUrls.map((url, idx) => {
                  const isVid = files[idx].type.startsWith('video/');
                  return (
                    <div key={idx} className="w-16 h-16 bg-emerald-50 rounded-xl overflow-hidden border border-emerald-200 relative flex items-center justify-center group">
                       {isVid ? <PlayCircle size={20} className="absolute text-white drop-shadow-md z-10" /> : null}
                       {isVid ? <video src={url} className="w-full h-full object-cover opacity-75" /> : <img src={url} alt="preview" className="w-full h-full object-cover" />}
                       
                       <span className="absolute top-1 left-1 bg-emerald-500 text-white text-[8px] px-1 rounded font-bold shadow-sm pointer-events-none">NEW</span>
                       
                       {/* Tombol Hapus Preview Saat Hover */}
                       <button 
                         type="button"
                         onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                         className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md"
                         title="Hapus file ini"
                       >
                         <X size={10} strokeWidth={3} />
                       </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400 hover:bg-slate-200 transition-colors">BATAL</button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-slate-800 hover:bg-black transition-colors text-white rounded-2xl font-black shadow-lg shadow-slate-200">{isProcessing ? 'MENYIMPAN...' : 'SIMPAN DATA'}</button>
          </div>
        </form>
      </Modal>

      {/* MODAL DETAIL TRANSAKSI */}
      <Modal isOpen={modalType === 'detail'} onClose={() => setModalType(null)} title="Rincian Transaksi">
        {selectedTx && (
          <div className="space-y-6">
            <div className={`p-8 rounded-[2rem] text-center ${selectedTx.mutasi.toLowerCase().includes('masuk') ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedTx.ref}</span>
              <h3 className={`text-4xl font-black mt-2 tracking-tighter ${selectedTx.mutasi.toLowerCase().includes('masuk') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatRupiah(selectedTx.nominal)}
              </h3>
              <p className="mt-2 font-bold text-slate-600 italic">"{selectedTx.note}"</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'TANGGAL', value: selectedTx.created_at, icon: Calendar },
                { label: 'PIHAK', value: selectedTx.person, icon: User },
                { label: 'JENIS', value: selectedTx.jenis, icon: Layers },
                { label: 'AKUN', value: getAccountName(selectedTx.account_1), icon: CreditCard },
              ].map(info => (
                <div key={info.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5"><info.icon size={10}/> {info.label}</p>
                  <p className="mt-1 font-bold text-slate-700">{info.value || '-'}</p>
                </div>
              ))}
            </div>

            {/* KOTAK OPERATOR KASIR */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><User size={10}/> Operator Kasir Pencatat</p>
              <p className="mt-1 font-black text-slate-700">{selectedTx.operator || 'Sistem / Tidak Diketahui'}</p>
            </div>

            {/* MEDIA THUMBNAILS (KLIK UNTUK POPUP GALLERY) */}
            {selectedTx.file && selectedTx.file.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Lampiran Media Bukti</p>
                <div className="flex gap-3 flex-wrap">
                  {selectedTx.file.map((filename: string, idx: number) => (
                    <div 
                      key={filename} 
                      onClick={() => setGalleryIndex(idx)}
                      className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all relative flex items-center justify-center group"
                    >
                      {isVideo(filename) && <PlayCircle size={24} className="absolute text-white drop-shadow-md z-10 group-hover:scale-110 transition-transform" />}
                      {isVideo(filename) 
                        ? <video src={pb.files.getURL(selectedTx, filename)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> 
                        : <img src={pb.files.getURL(selectedTx, filename)} alt="attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTx.ref_baru && (
              <button onClick={() => navigate(`/?ref=${selectedTx.ref_baru}`)} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-sm border border-blue-100 hover:bg-blue-100 transition-all">
                <ExternalLink size={16} /> LIHAT DETAIL POS ({selectedTx.ref_baru})
              </button>
            )}

            <div className="flex gap-3 pt-4">
              <button onClick={() => { setModalType('delete'); setSelectedTx(selectedTx); }} className="p-4 bg-rose-50 text-rose-600 rounded-2xl font-black hover:bg-rose-100 transition-all"><Trash2 size={20}/></button>
              <button onClick={() => { setFormData(selectedTx); setFiles([]); setModalType('form'); }} className="p-4 bg-blue-50 text-blue-600 rounded-2xl font-black hover:bg-blue-100 transition-all"><Edit size={20}/></button>
              <button onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-800 hover:bg-black transition-colors text-white rounded-2xl font-black">TUTUP</button>
            </div>
          </div>
        )}
      </Modal>

      {/* POPUP GALLERY LAYER KHUSUS GAMBAR & VIDEO */}
      {galleryIndex !== null && selectedTx && selectedTx.file && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-fadeIn"
          onClick={() => setGalleryIndex(null)} // <--- Klik di area hitam/backdrop akan menutup modal
        >
          {/* Tombol Tutup */}
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Mencegah event tembus ke backdrop
              setGalleryIndex(null);
            }} 
            className="absolute top-6 right-6 md:top-10 md:right-10 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-rose-500 rounded-full transition-all z-10"
          >
            <X size={24} />
          </button>

          {/* Tombol Kiri */}
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Mencegah event tembus ke backdrop
              setGalleryIndex(prev => prev! > 0 ? prev! - 1 : selectedTx.file.length - 1);
            }} 
            className="absolute left-4 md:left-10 p-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/30 rounded-full transition-all z-10"
          >
            <ChevronLeft size={32} />
          </button>

          {/* Media Penampil Utama (Hanya satu block) */}
          <div 
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center p-4 relative group"
            onClick={(e) => e.stopPropagation()} // <--- Mencegah klik di area gambar menutup modal
          >
            {isVideo(selectedTx.file[galleryIndex]) ? (
              <video 
                src={pb.files.getUrl(selectedTx, selectedTx.file[galleryIndex])} 
                controls 
                autoPlay 
                className="max-w-full max-h-full rounded-2xl shadow-2xl ring-1 ring-white/10" 
              />
            ) : (
              <img 
                src={pb.files.getUrl(selectedTx, selectedTx.file[galleryIndex])} 
                alt="Gallery view" 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10" 
              />
            )}
          </div>

          {/* Tombol Kanan */}
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Mencegah event tembus ke backdrop
              setGalleryIndex(prev => prev! < selectedTx.file.length - 1 ? prev! + 1 : 0);
            }} 
            className="absolute right-4 md:right-10 p-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/30 rounded-full transition-all z-10"
          >
            <ChevronRight size={32} />
          </button>

          {/* Dot Indicator (Bawah) */}
          {selectedTx.file.length > 1 && (
            <div 
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedTx.file.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`h-2 rounded-full transition-all duration-300 ${idx === galleryIndex ? 'w-8 bg-emerald-500' : 'w-2 bg-white/30'}`} 
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRM */}
      <Modal isOpen={modalType === 'delete'} onClose={() => setModalType(null)} title="Hapus Data">
        <div className="text-center p-4">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
          <p className="font-bold text-slate-600">Hapus transaksi <span className="text-rose-600 font-black">{selectedTx?.ref}</span>?</p>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400">BATAL</button>
            <button onClick={submitDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black">HAPUS</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}