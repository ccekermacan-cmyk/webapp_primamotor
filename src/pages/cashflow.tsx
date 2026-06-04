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
  person_customer?: string;
  acc1?: string;
  acc2?: string;
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
  
  const [jenisOptionsIn, setJenisOptionsIn] = useState<DropdownItem[]>([]);
  const [jenisOptionsOut, setJenisOptionsOut] = useState<DropdownItem[]>([]);
  const [accountOptions, setAccountOptions] = useState<DropdownItem[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20; 
  
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMutasi, setFilterMutasi] = useState<string>('semua');

  const [modalType, setModalType] = useState<'detail' | 'form' | 'delete' | null>(null);
  const [selectedTx, setSelectedTx] = useState<Cashflow | null>(null);
  const [formData, setFormData] = useState<Partial<Cashflow>>({
    mutasi: 'Masuk',
    created_at: new Date().toISOString().slice(0,16).replace('T', ' '),
    account_2: '',
    person_customer: '',
    acc2: '',
    person: ''
  });

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [wallets, setWallets] = useState<DropdownItem[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('history');
  const [isFormDirty, setIsFormDirty] = useState(false);

  const isEditMode = !!(selectedTx && selectedTx.id);

  const checkFormDirty = () => {
    return !!(formData.jenis || formData.account_1 || formData.nominal || formData.note);
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
  };

  const getAccountName = (idOrName: string) => {
    const acc = accountOptions.find(opt => opt.id === idOrName || opt.text_1 === idOrName);
    return acc ? acc.text_1 : idOrName;
  };

  const fetchDropdowns = async () => {
    try {
      const userLevel = "1"; 
      const records = await pb.collection('dropdown').getFullList<DropdownItem>({
        filter: `kategori ~ "Cashflow" && (jenis ~ "jenis" || jenis ~ "account") && visibilitas ~ "${userLevel}"`,
        $autoCancel: false
      });
      // Pisahkan berdasarkan jenis
      const jenisRecords = records.filter(r => String(r.jenis).toLowerCase().includes('jenis'));
      const accountRecords = records.filter(r => String(r.jenis).toLowerCase().includes('account'));
      
      // Filter jenis berdasarkan text_2 (in / out)
      setJenisOptionsIn(jenisRecords.filter(r => r.text_2?.toLowerCase() === 'in'));
      setJenisOptionsOut(jenisRecords.filter(r => r.text_2?.toLowerCase() === 'out'));
      setAccountOptions(accountRecords);
    } catch (error) {
      console.error("Gagal memuat dropdown:", error);
    }
  };

  const fetchWallets = async () => {
    setLoadingWallets(true);
    try {
      const currentUser = pb.authStore.model;
      const userLevel = localStorage.getItem('user_level') || '';
      const userName = currentUser?.username || '';

      let filterCondition = `kategori ~ "cashflow" && jenis ~ "cashflow account"`;

      // Jika level bukan 1 (bukan superadmin), tambahkan filter enum_1 dan visibilitas
      if (userLevel !== '1') {
        filterCondition += ` && enum_1 ~ "${userName}" && visibilitas ~ "${userLevel}"`;
      }

      const records = await pb.collection('dropdown').getFullList<DropdownItem>({
        filter: filterCondition,
        $autoCancel: false
      });
      setWallets(records);
    } catch (error) {
      console.error("Gagal memuat dompet:", error);
    } finally {
      setLoadingWallets(false);
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
        if (filterMutasi === 'masuk') conditions.push(`mutasi = "in"`);
        else if (filterMutasi === 'keluar') conditions.push(`mutasi = "out"`);
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

  useEffect(() => { 
    fetchDropdowns(); 
    fetchWallets(); 
  }, []);
  useEffect(() => {
    const delayDebounce = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchInput, filterMutasi]);
  useEffect(() => { fetchCashflow(); }, [page, searchTerm, filterMutasi]);

  useEffect(() => {
    if (files.length === 0) { setPreviewUrls([]); return; }
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    // Jika mutasi berubah dan jenis yang dipilih tidak sesuai dengan mutasi baru, reset jenis
    if (formData.mutasi && formData.jenis) {
      const validJenis = formData.mutasi === 'Masuk' 
        ? jenisOptionsIn.some(j => j.text_1 === formData.jenis)
        : jenisOptionsOut.some(j => j.text_1 === formData.jenis);
      if (!validJenis) {
        setFormData(prev => ({ ...prev, jenis: '' }));
      }
    }
  }, [formData.mutasi, jenisOptionsIn, jenisOptionsOut]);

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
    setIsFormDirty(true);
  };

  const handleMutasiChange = (newMutasi: string) => {
    if (formData.jenis && formData.jenis !== '') {
      if (window.confirm("Mengubah jenis mutasi akan mereset pilihan Jenis Cashflow. Lanjutkan?")) {
        setFormData(prev => ({ ...prev, mutasi: newMutasi, jenis: '' }));
        setIsFormDirty(true);
      }
    } else {
      setFormData(prev => ({ ...prev, mutasi: newMutasi }));
      setIsFormDirty(true);
    }
  };

  const handleCloseModal = () => {
    if (checkFormDirty()) {
      if (window.confirm("Ada perubahan yang belum disimpan. Yakin ingin menutup?")) {
        setModalType(null);
        setIsFormDirty(false);
      }
    } else {
      setModalType(null);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.jenis) {
      alert("Jenis Cashflow wajib dipilih!");
      return;
    }
    if (!formData.account_1) {
      alert("Akun Pembayaran wajib dipilih!");
      return;
    }
    if (!formData.nominal || formData.nominal <= 0) {
      alert("Nominal harus diisi dan lebih dari 0!");
      return;
    }
    if (!formData.note || formData.note.trim() === '') {
      alert("Keterangan wajib diisi!");
      return;
    }
    if (formData.jenis?.toLowerCase() === 'transfer' && !formData.account_2) {
      alert("Akun Tujuan wajib dipilih untuk transaksi Transfer!");
      return;
    }

    setIsProcessing(true);
    try {
      const currentUser = pb.authStore.model;
      const operatorName = currentUser?.name || currentUser?.username || 'Admin';
      const formattedDate = formData.created_at ? formData.created_at.replace('T', ' ') + ':00' : new Date().toISOString().replace('T', ' ').slice(0, 19);
      const selectedAccount = accountOptions.find(acc => acc.id === formData.account_1);
      const accountIdLama = selectedAccount?.id_lama || '';

      const formDataObj = new FormData();
      formDataObj.append("jenis", formData.jenis || "");
      const mutasiValue = formData.mutasi?.toLowerCase() === 'masuk' ? 'in' : 'out';
      formDataObj.append("mutasi", mutasiValue);
      formDataObj.append("account_1", formData.account_1 || "");
      formDataObj.append("account_2", formData.account_2 || "");
      formDataObj.append("nominal", String(formData.nominal || 0));
      formDataObj.append("note", formData.note || "");
      formDataObj.append("created_at", formattedDate);
      formDataObj.append("operator", operatorName);
      formDataObj.append("person_customer", formData.person_customer || "");
      formDataObj.append("person", formData.person || "");
      formDataObj.append("acc1", accountIdLama);
      formDataObj.append("acc2", formData.acc2 || "");

      if (files && files.length > 0) {
        files.forEach(file => formDataObj.append("file", file));
      }

      if (isEditMode && selectedTx) {
        await pb.collection('cashflow').update(selectedTx.id, formDataObj);
      } else {
        await pb.collection('cashflow').create(formDataObj);
      }
      
      setModalType(null);
      setFormData({
        mutasi: 'Masuk',
        created_at: new Date().toISOString().slice(0,16).replace('T', ' '),
        account_2: '',
        person_customer: '',
        acc2: '',
        person: ''
      });
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

  const isVideo = (filename: string) => filename.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="p-4 md:p-8 h-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* PEMBUNGKUS UTAMA (Agar tidak terlalu panjang/lebar ke samping di layar besar) */}
      <div className="max-w-6xl mx-auto w-full h-full flex flex-col relative">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-200">
                <Wallet size={26} strokeWidth={2.5} />
              </div>
              Arus Kas
            </h2>
            <p className="text-slate-500 mt-2 font-medium">Monitoring perputaran modal Prima Motor</p>
          </div>
          <button 
            onClick={() => {
              setSelectedTx(null);
              setFiles([]);
              setFormData({ mutasi: 'Masuk', created_at: new Date().toISOString().slice(0,16).replace('T', ' ') });
              setModalType('form');
            }}
            className="bg-slate-900 hover:bg-black text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-emerald-400 text-lg leading-none">+</span> CATAT KAS
          </button>
        </div>

        {/* TAB NAVIGATION (Gaya Modern Segmented Control) */}
        <div className="flex p-1.5 bg-slate-200/60 rounded-2xl mb-6 w-full sm:w-fit shrink-0">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
              activeTab === 'accounts'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
            }`}
          >
            Daftar Dompet
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
              activeTab === 'history'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
            }`}
          >
            Histori Kas
          </button>
        </div>

        {/* CONTAINER HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 flex-1 flex flex-col overflow-hidden">
            {/* FILTER SEARCH BAR */}
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 bg-white">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
                {['semua', 'masuk', 'keluar'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setFilterMutasi(tab)} 
                    className={`flex-1 md:w-28 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                      filterMutasi === tab ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:max-w-sm group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari referensi, pihak, catatan..." 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none text-sm font-medium transition-all" 
                  value={searchInput} 
                  onChange={(e) => setSearchInput(e.target.value)} 
                />
              </div>
            </div>

            {/* DAFTAR TRANSAKSI (Tampilan Border Per Data) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : Object.keys(groupedTransactions).length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  Belum ada data transaksi kas ditemukan.
                </div>
              ) : (
                Object.entries(groupedTransactions).map(([date, items]) => (
                  <div key={date} className="space-y-4">
                    {/* Divider Tanggal */}
                    <div className="flex items-center gap-4">
                      <span className="bg-slate-800 px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest text-center shadow-sm">
                        {date !== 'Tanpa Tanggal' ? new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : date}
                      </span>
                      <div className="h-[2px] flex-1 bg-slate-100" />
                    </div>
                    
                    {/* List Data Row */}
                    <div className="grid gap-3">
                      {items.map((tx) => {
                        const isMasuk = tx.mutasi.toLowerCase() === 'in';
                        return (
                          <div 
                            key={tx.id} 
                            onClick={() => { setSelectedTx(tx); setModalType('detail'); }} 
                            className="group bg-white border-2 border-slate-100 p-4 md:p-5 rounded-2xl hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                          >
                            <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
                              {/* Icon Mutasi */}
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isMasuk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {isMasuk ? <ArrowDownRight strokeWidth={3}/> : <ArrowUpRight strokeWidth={3}/>}
                              </div>
                              
                              {/* Info Kiri */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {tx.ref}
                                  </span>
                                </div>
                                <h4 className="font-bold text-slate-800 line-clamp-1">{tx.note}</h4>
                                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md"><Layers size={12} className="text-slate-400"/> {tx.jenis}</span>
                                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md"><User size={12} className="text-slate-400"/> {tx.person}</span>
                                </div>
                              </div>
                            </div>

                            {/* Nominal & Akun Kanan */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest sm:mb-1 order-2 sm:order-1">
                                {getAccountName(tx.account_1)}
                              </p>
                              <p className={`text-lg sm:text-xl font-black tracking-tight order-1 sm:order-2 ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isMasuk ? '+' : '-'} {formatRupiah(tx.nominal)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Paginasi Bawah */}
            <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 rounded-b-3xl">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-xl">Hal. {page} / {totalPages || 1}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 transition-all shadow-sm text-slate-600"><ChevronLeft size={20}/></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 transition-all shadow-sm text-slate-600"><ChevronRight size={20}/></button>
              </div>
            </div>
          </div>
        )}

        {/* CONTAINER ACCOUNTS / WALLET (Gaya Kartu Modern) */}
        {activeTab === 'accounts' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                Buku Rekening & Kas
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1">Sisa saldo aktif untuk setiap penyimpanan</p>
            </div>
            
            {loadingWallets ? (
              <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
            ) : wallets.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200 shadow-sm">
                Tidak ada dompet yang tersedia.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wallets.map(wallet => (
                  <div 
                    key={wallet.id} 
                    className="relative overflow-hidden rounded-[2rem] p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-xl hover:-translate-y-1.5 transition-transform duration-300 group cursor-default"
                  >
                    {/* Efek Lingkaran Blur Dekoratif */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-colors duration-500" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
                    
                    {/* Konten Kartu Atas */}
                    <div className="flex justify-between items-start mb-8 relative z-10">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-center backdrop-blur-md shadow-inner">
                        <Wallet size={24} className="text-emerald-400" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-3 py-1.5 rounded-full">
                        {wallet.jenis || 'DOMPET'}
                      </span>
                    </div>

                    {/* Saldo Kartu Bawah */}
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-slate-400 mb-1">{wallet.text_1}</p>
                      <p className="text-3xl font-black tracking-tighter text-white">
                        {formatRupiah(wallet.number_1 || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sisa Modalnya Biarkan Sama Persis / Tidak Perlu Dirombak Jika Hanya Minta Tampilan Depannya Saja */}
        {/* Jika modal form juga perlu diubah, layout-nya sudah cukup bagus, hanya perlu dibungkus di dalam hirarki ini */}
        <Modal isOpen={modalType === 'form'} onClose={handleCloseModal} title={isEditMode ? "Edit Transaksi" : "Catat Transaksi"}>
          {/* ... (Isi Form Modal Sama Persis Seperti Sebelumnya) ... */}
        </Modal>

        <Modal isOpen={modalType === 'detail'} onClose={() => setModalType(null)} title="Rincian Transaksi">
          {/* ... (Isi Detail Modal Sama Persis Seperti Sebelumnya) ... */}
        </Modal>
        
        {/* ... SISA KODE MODAL LAINNYA ... */}
        
      </div>
    </div>
  );
}