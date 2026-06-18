  import React, { useState, useEffect, useMemo, useRef } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { pb } from '../lib/pocketbase';
  import Modal from '../components/modal';
  import { 
    Wallet, Search, Trash2, Edit, ChevronLeft, ChevronRight, 
    ArrowDownRight, ArrowUpRight, Calendar, User,
    ExternalLink, Layers, X, DollarSign, ImagePlus, Save, FileText,
    ArrowRight, Filter, Plus, ChevronDown, AlertCircle
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
    persontext: string;   // field person lama menjadi persontext
    nominal: number;
    note: string;
    ref_baru: string;
    created: string; 
    file: string[];
    person?: string;      // field person_customer lama menjadi person
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

    // Helper untuk menampilkan datetime lokal dari string ISO UTC
    const formatLocalDateTime = (isoString: string | undefined) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    };

    // ========== SCROLL BEHAVIOR ==========
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showHeader, setShowHeader] = useState(true);
    const [showTabs, setShowTabs] = useState(true);
    const [lastScrollTop, setLastScrollTop] = useState(0);

    // Helper untuk mengkonversi tanggal lokal (dari input date picker) ke ISO UTC
    const toLocalDateISO = (dateStr: string, endOfDay = false) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const hour = endOfDay ? 23 : 0;
      const minute = endOfDay ? 59 : 0;
      const second = endOfDay ? 59 : 0;
      const localDate = new Date(year, month - 1, day, hour, minute, second);
      return localDate.toISOString();
    };

    // Helper untuk mengkonversi ISO UTC ke format datetime-local (YYYY-MM-DDThh:mm)
    const formatToLocalDatetimeInput = (isoString: string) => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    const [jenisOptionsIn, setJenisOptionsIn] = useState<DropdownItem[]>([]);
    const [jenisOptionsOut, setJenisOptionsOut] = useState<DropdownItem[]>([]);
    const [accountOptions, setAccountOptions] = useState<DropdownItem[]>([]);

    const [personOptions, setPersonOptions] = useState<{ id: string; id_lama: string; text_1: string; source: 'dropdown' | 'user' }[]>([]);
    const [searchPerson, setSearchPerson] = useState('');
    const [isPersonOpen, setIsPersonOpen] = useState(false);
    
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const perPage = 20; 

    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    const [activeFilter, setActiveFilter] = useState<'account' | 'jenis' | 'tanggal' | 'search' | null>(null);

    // Tambahkan state ini untuk mengatur animasi buka/tutup UI
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [isAccountFilterOpen, setIsAccountFilterOpen] = useState(false); // State baru

    // State untuk filter jenis
    const [filterJenis, setFilterJenis] = useState<string[]>([]);
    const [isJenisFilterOpen, setIsJenisFilterOpen] = useState(false);
    
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAccounts, setFilterAccounts] = useState<string[]>([]); // State filter dompet
    const [filterMutasi, setFilterMutasi] = useState<string>('semua');
    
    // State baru untuk filter tanggal
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const [modalType, setModalType] = useState<'detail' | 'form' | 'delete' | null>(null);
    const [selectedTx, setSelectedTx] = useState<Cashflow | null>(null);
    const [formData, setFormData] = useState<Partial<Cashflow>>({
      mutasi: 'Masuk',
      created_at: formatToLocalDatetimeInput(new Date().toISOString()),
      account_2: '',
      person: '',
      persontext: '',
      acc2: ''
    });

    const [files, setFiles] = useState<any[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [wallets, setWallets] = useState<DropdownItem[]>([]);
    const [loadingWallets, setLoadingWallets] = useState(false);
    const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('history');
    const [isFormDirty, setIsFormDirty] = useState(false);
    
    // TAMBAHAN: State untuk System Alert/Confirm Modal
    const [systemAlert, setSystemAlert] = useState({ show: false, title: '', message: '', type: 'alert' as 'alert'|'confirm', onConfirm: () => {} });

    const isEditMode = !!(selectedTx && selectedTx.id);

    // TAMBAHAN: Helper memanggil alert
    const showAlert = (title: string, message: string) => {
      setSystemAlert({ show: true, title, message, type: 'alert', onConfirm: () => setSystemAlert(prev => ({...prev, show: false})) });
    };

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

    const getPersonName = (personId: string | undefined) => {
      if (!personId) return '-';
      const person = personOptions.find(opt => opt.id === personId || opt.id_lama === personId);
      return person ? person.text_1 : personId;
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

    const fetchPersonOptions = async () => {
      try {
        // Ambil dari dropdown kategori person dengan jenis customer
        const persons = await pb.collection('dropdown').getFullList({
          filter: `kategori ~ "person" && jenis ~ "customer"`,
          $autoCancel: false
        });
        const dropdownList = persons.map(p => ({
          id: p.id,
          id_lama: p.id_lama || '',
          text_1: p.text_1,
          source: 'dropdown' as const
        }));
        // Ambil dari koleksi user (karyawan) yang aktif
        const users = await pb.collection('user').getFullList({
          filter: `status = "active"`,
          $autoCancel: false
        });
        const userList = users.map(u => ({
          id: u.id,
          id_lama: u.username || u.id,
          text_1: u.name || u.username,
          source: 'user' as const
        }));
        setPersonOptions([...dropdownList, ...userList]);
      } catch (error) {
        console.error("Gagal memuat person:", error);
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
            conditions.push(`(ref ~ {:t${idx}} || note ~ {:t${idx}} || persontext ~ {:t${idx}} || jenis ~ {:t${idx}})`);
            params[`t${idx}`] = term;
          });
        }

        if (filterMutasi !== 'semua') {
          if (filterMutasi === 'masuk') conditions.push(`mutasi = "in"`);
          else if (filterMutasi === 'keluar') conditions.push(`mutasi = "out"`);
        }

        // --- LOGIKA FILTER TANGGAL BARU ---
        if (dateRange.start) {
          conditions.push(`created_at >= {:start}`);
          params.start = toLocalDateISO(dateRange.start, false);
        }
        if (dateRange.end) {
          conditions.push(`created_at <= {:end}`);
          params.end = toLocalDateISO(dateRange.end, true);
        }

        // --- LOGIKA FILTER AKUN/DOMPET (MULTISELECT) ---
        if (filterAccounts.length > 0) {
          const accountConditions = filterAccounts.map(id => `(account_1 = "${id}" || account_2 = "${id}")`).join(' || ');
          conditions.push(`(${accountConditions})`);
        }

        if (filterJenis.length > 0) {
          const jenisConditions = filterJenis.map(id => `jenis = "${id}"`).join(' || ');
          conditions.push(`(${jenisConditions})`);
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
      fetchPersonOptions(); 
    }, []);
    useEffect(() => {
      const delayDebounce = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 500);
      return () => clearTimeout(delayDebounce);
    }, [searchInput, filterMutasi]);
    
    // Tambahkan filterAccounts ke dalam dependency agar data otomatis ter-refresh
    useEffect(() => { fetchCashflow(); }, [page, searchTerm, filterMutasi, dateRange, filterAccounts, filterJenis]);

    useEffect(() => {
      // Reset person jika bukan (mutasi keluar & jenis bonkaryawan)
      if (!(formData.mutasi === 'Keluar' && formData.jenis?.toLowerCase() === 'bonkaryawan')) {
        setFormData(prev => ({ ...prev, person: '', persontext: '' }));
      }
    }, [formData.mutasi, formData.jenis]);

    // Fungsi helper untuk toggle opsi multiselect akun
    const toggleFilterAccount = (accId: string) => {
      setFilterAccounts(prev => prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]);
      setPage(1);
    };

    const toggleFilterJenis = (jenisId: string) => {
      setFilterJenis(prev => prev.includes(jenisId) ? prev.filter(id => id !== jenisId) : [...prev, jenisId]);
      setPage(1);
    };

    useEffect(() => {
      if (files.length === 0) { setPreviewUrls([]); return; }
      const urls = files.map(f => {
        // Jika file adalah data lama dari server, langsung gunakan URL-nya
        if (f.isOld) return f.url;
        // Jika file adalah unggahan baru, buatkan local object URL
        return URL.createObjectURL(f);
      });
      setPreviewUrls(urls);
      
      // Bersihkan memory HANYA untuk local object URL (menghindari error link server)
      return () => {
        urls.forEach(u => {
          if (u.startsWith('blob:')) URL.revokeObjectURL(u);
        });
      };
    }, [files]);

    useEffect(() => {
      // Jika mutasi berubah dan jenis yang dipilih tidak sesuai dengan mutasi baru, reset jenis
      if (formData.mutasi && formData.jenis) {
        const validJenis = formData.mutasi === 'Masuk' 
          ? jenisOptionsIn.some(j => j.id_lama === formData.jenis)
          : jenisOptionsOut.some(j => j.id_lama === formData.jenis);
        if (!validJenis) {
          setFormData(prev => ({ ...prev, jenis: '' }));
        }
      }
    }, [formData.mutasi, jenisOptionsIn, jenisOptionsOut]);

    useEffect(() => {
      const containerHistory = scrollContainerRef.current;
      const containerAccounts = scrollContainerAccountsRef.current;

      const handleScroll = () => {
        const activeContainer = activeTab === 'history' ? containerHistory : containerAccounts;
        if (!activeContainer) return;

        const scrollTop = activeContainer.scrollTop;

        if (scrollTop > 20) {
          setShowHeader(false);
          setShowTabs(false);
        } else {
          setShowHeader(true);
          setShowTabs(true);
        }
      };

      if (containerHistory) {
        containerHistory.addEventListener('scroll', handleScroll);
      }
      if (containerAccounts) {
        containerAccounts.addEventListener('scroll', handleScroll);
      }

      return () => {
        if (containerHistory) {
          containerHistory.removeEventListener('scroll', handleScroll);
        }
        if (containerAccounts) {
          containerAccounts.removeEventListener('scroll', handleScroll);
        }
      };
    }, [activeTab]);

    const groupedTransactions = useMemo(() => {
      const groups: { [key: string]: Cashflow[] } = {};
      transactions.forEach(tx => {
        let date = 'Tanpa Tanggal';
        if (tx.created_at) {
          let parsed = new Date(tx.created_at);
          // Jika gagal, coba format "YYYY-MM-DD HH:MM:SS" (format lama)
          if (isNaN(parsed.getTime())) {
            const match = tx.created_at.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
            if (match) {
              const [_, year, month, day, hour, minute, second] = match;
              parsed = new Date(Number(year), Number(month)-1, Number(day), Number(hour), Number(minute), Number(second));
            }
          }
          // Jika masih gagal, gunakan string asli (biar tidak muncul "Invalid Date")
          if (!isNaN(parsed.getTime())) {
            date = parsed.toLocaleDateString('id-ID');
          } else {
            date = tx.created_at; // tampilkan raw string
          }
        }
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
        setSystemAlert({
          show: true,
          title: "Tutup Form?",
          message: "Ada perubahan yang belum disimpan. Yakin ingin menutup?",
          type: 'confirm',
          onConfirm: () => {
            setModalType(null);
            setIsFormDirty(false);
            setSystemAlert(prev => ({ ...prev, show: false }));
          }
        });
      } else {
        setModalType(null);
      }
    };

    const submitForm = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!formData.jenis) {
        showAlert("Validasi Gagal", "Jenis Cashflow wajib dipilih!");
        return;
      }
      if (!formData.account_1) {
        showAlert("Validasi Gagal", "Akun Pembayaran wajib dipilih!");
        return;
      }
      if (!formData.nominal || formData.nominal <= 0) {
        showAlert("Validasi Gagal", "Nominal harus diisi dan lebih dari 0!");
        return;
      }
      if (!formData.note || formData.note.trim() === '') {
        showAlert("Validasi Gagal", "Keterangan wajib diisi!");
        return;
      }
      if (formData.jenis?.toLowerCase() === 'transfer' && !formData.account_2) {
        showAlert("Validasi Gagal", "Akun Tujuan wajib dipilih untuk transaksi Transfer!");
        return;
      }

      setIsProcessing(true);
      try {
        const currentUser = pb.authStore.model;
        const operatorName = currentUser?.name || currentUser?.username || 'Admin';
        let formattedDate;
        if (formData.created_at && formData.created_at.includes('T')) {
          const [datePart, timePart] = formData.created_at.split('T');
          if (datePart && timePart) {
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
              const localDate = new Date(year, month - 1, day, hours, minutes, 0);
              formattedDate = localDate.toISOString();
            } else {
              formattedDate = new Date().toISOString();
            }
          } else {
            formattedDate = new Date().toISOString();
          }
        } else {
          formattedDate = new Date().toISOString();
        }
        const selectedAccount = accountOptions.find(acc => acc.id === formData.account_1);
        const accountIdLama = selectedAccount?.id_lama || '';

        // Logika untuk acc2 (akun tujuan)
        let account2IdLama = '';
        if (formData.account_2) {
          const selectedAccount2 = accountOptions.find(acc => acc.id === formData.account_2);
          account2IdLama = selectedAccount2?.id_lama || '';
        }

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
        formDataObj.append("person", formData.person || "");
        formDataObj.append("persontext", formData.persontext || "");
        formDataObj.append("acc1", accountIdLama);
        formDataObj.append("acc2", account2IdLama);

        // Di PocketBase, cukup kirim 'string' nama file lama untuk dipertahankan, dan 'File object' untuk file baru
        if (files && files.length > 0) {
          files.forEach(f => {
            if (f.isOld) {
              formDataObj.append("file", f.name); // Pertahankan file lama ini
            } else {
              formDataObj.append("file", f);      // Upload file baru ini
            }
          });
        } else if (isEditMode) {
          // Jika mode edit tapi array kosong (user menghapus semua foto), kirim string kosong untuk menghapus file di server
          formDataObj.append("file", "");
        }

        if (isEditMode && selectedTx) {
          await pb.collection('cashflow').update(selectedTx.id, formDataObj);
        } else {
          await pb.collection('cashflow').create(formDataObj);
        }
        
        setModalType(null);
        setFormData({
          mutasi: 'Masuk',
          created_at: formatToLocalDatetimeInput(new Date().toISOString()),
          account_2: '',
          person: '',
          persontext: '',
          acc2: ''
        });
        setFiles([]);
        fetchCashflow();
      } catch (error: any) {
        showAlert("Gagal Simpan", error.data?.message || "Terjadi kesalahan saat menyimpan transaksi.");
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
        showAlert("Gagal Menghapus", "Terjadi kesalahan saat menghapus data.");
      } finally {
        setIsProcessing(false);
      }
    };

    // Ditambahkan pengecekan agar jika filename kosong/undefined tidak memicu crash
    const isVideo = (filename: string | undefined) => filename ? !!filename.match(/\.(mp4|webm|ogg)$/i) : false;

    const scrollContainerAccountsRef = useRef<HTMLDivElement>(null);

    return (
      <div className="p-4 md:p-8 h-full bg-slate-50 flex flex-col overflow-hidden font-sans">
        {/* PEMBUNGKUS UTAMA */}
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col relative">
          
          {/* ============================================================ */}
          {/* HEADER */}
          {/* ============================================================ */}
          <div
            className={`flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 shrink-0 transition-all duration-300 ${
              showHeader
                ? 'opacity-100 max-h-40'
                : 'opacity-0 max-h-0 pointer-events-none mb-0 overflow-hidden'
            }`}
          >
            <div>
              <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-200">
                  <Wallet size={26} strokeWidth={2.5} />
                </div>
                Arus Kas
              </h2>
              <p className="text-slate-500 mt-2 font-medium">
                Monitoring perputaran modal Prima Motor
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedTx(null);
                setFiles([]);
                setFormData({
                  mutasi: 'Masuk',
                  created_at: formatToLocalDatetimeInput(new Date().toISOString()),
                });
                setModalType('form');
              }}
              className="hidden md:flex bg-slate-900 hover:bg-black text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-slate-200 transition-all active:scale-95 items-center justify-center gap-2"
            >
              <span className="text-emerald-400 text-lg leading-none">+</span> CATAT KAS
            </button>
          </div>

          {/* ============================================================ */}
          {/* TAB NAVIGATION */}
          {/* ============================================================ */}
          <div
            className={`flex p-1.5 bg-slate-200/60 rounded-2xl mb-6 w-full sm:w-fit shrink-0 transition-all duration-300 ${
              showTabs
                ? 'opacity-100 max-h-20'
                : 'opacity-0 max-h-0 pointer-events-none mb-0 overflow-hidden'
            }`}
          >
            <button
              onClick={() => {
                setActiveTab('accounts');
                fetchWallets();
              }}
              className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                activeTab === 'accounts'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
              }`}
            >
              Daftar Dompet
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setPage(1);
                fetchCashflow();
              }}
              className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                activeTab === 'history'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
              }`}
            >
              Histori Kas
            </button>
          </div>

      {/* ============================================================ */}
      {/* CONTAINER HISTORY */}
      {/* ============================================================ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 flex-1 min-h-0 flex flex-col overflow-hidden relative">
          
          {/* FILTER BAR - STICKY TOP */}
          <div className="sticky top-0 z-10 p-3 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
            
            {/* === KIRI: Toggle Mutasi (flex-1, max-w-60%) === */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg flex-1 max-w-[60%] min-w-0">
              {['semua', 'masuk', 'keluar'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setFilterMutasi(tab);
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all duration-300 ${
                    filterMutasi === tab
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* === TENGAH: Expandable Filter Area (flex-1 saat aktif, max-w-40%) === */}
            <div className="flex-1 min-w-0 flex items-center">
              <div
                className={`transition-all duration-300 overflow-hidden ${
                  activeFilter ? 'max-w-[40%] opacity-100 flex-1' : 'max-w-0 opacity-0 flex-0'
                }`}
              >
                {activeFilter === 'account' && (
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 h-8 w-full">
                    <Wallet size={14} className="text-emerald-500 shrink-0" />
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                      {accountOptions.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => toggleFilterAccount(acc.id)}
                          className={`whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-md transition-all border ${
                            filterAccounts.includes(acc.id)
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {acc.text_1}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="p-0.5 text-rose-500 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {activeFilter === 'jenis' && (
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 h-8 w-full">
                    <Layers size={14} className="text-emerald-500 shrink-0" />
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                      {(filterMutasi === 'masuk'
                        ? jenisOptionsIn
                        : filterMutasi === 'keluar'
                        ? jenisOptionsOut
                        : []
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => toggleFilterJenis(opt.id_lama || opt.id)}
                          className={`whitespace-nowrap px-2 py-0.5 text-[9px] font-bold rounded-md transition-all border ${
                            filterJenis.includes(opt.id_lama || opt.id)
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {opt.text_1}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="p-0.5 text-rose-500 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {activeFilter === 'tanggal' && (
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 h-8 w-full">
                    <Calendar size={14} className="text-emerald-500 shrink-0" />
                    <input
                      type="date"
                      className="bg-transparent text-[10px] font-bold text-slate-600 outline-none w-20 cursor-pointer"
                      value={dateRange.start}
                      onChange={(e) => {
                        setDateRange({ ...dateRange, start: e.target.value });
                        setPage(1);
                      }}
                    />
                    <span className="text-slate-300 text-xs">-</span>
                    <input
                      type="date"
                      className="bg-transparent text-[10px] font-bold text-slate-600 outline-none w-20 cursor-pointer"
                      value={dateRange.end}
                      onChange={(e) => {
                        setDateRange({ ...dateRange, end: e.target.value });
                        setPage(1);
                      }}
                    />
                    <button
                      onClick={() => {
                        setDateRange({ start: '', end: '' });
                        setActiveFilter(null);
                        setPage(1);
                      }}
                      className="p-0.5 text-rose-500 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {activeFilter === 'search' && (
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 h-8 w-full">
                    <Search size={14} className="text-emerald-500 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari..."
                      className="bg-transparent text-[10px] font-bold text-slate-700 outline-none flex-1 min-w-0"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        setSearchInput('');
                        setActiveFilter(null);
                      }}
                      className="p-0.5 text-rose-500 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* === KANAN: Ikon-ikon Filter (tetap di posisi) === */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setActiveFilter(activeFilter === 'account' ? null : 'account')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
                  activeFilter === 'account'
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                    : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
                }`}
                title="Filter Akun"
              >
                <Wallet size={16} />
              </button>

              <button
                onClick={() => setActiveFilter(activeFilter === 'jenis' ? null : 'jenis')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
                  activeFilter === 'jenis'
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                    : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
                }`}
                title="Filter Jenis"
              >
                <Layers size={16} />
              </button>

              <button
                onClick={() => setActiveFilter(activeFilter === 'tanggal' ? null : 'tanggal')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
                  activeFilter === 'tanggal'
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                    : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
                }`}
                title="Filter Tanggal"
              >
                <Calendar size={16} />
              </button>

              <button
                onClick={() => setActiveFilter(activeFilter === 'search' ? null : 'search')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
                  activeFilter === 'search'
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                    : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
                }`}
                title="Cari"
              >
                <Search size={16} />
              </button>

              {/* Tombol filter mobile (muncul di layar kecil) */}
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="md:hidden w-8 h-8 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-600 shadow-sm"
              >
                <Filter size={16} />
              </button>
            </div>
          </div>

          {/* DAFTAR TRANSAKSI - SCROLLABLE */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth custom-scrollbar"
          >
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : Object.keys(groupedTransactions).length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-bold bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                Belum ada data transaksi kas ditemukan.
              </div>
            ) : (
              Object.entries(groupedTransactions).map(([date, items]) => (
                <div key={date} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="bg-slate-800 px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest text-center shadow-sm">
                      {date !== 'Tanpa Tanggal' ? date : 'Tanpa Tanggal'}
                    </span>
                    <div className="h-[2px] flex-1 bg-slate-100" />
                  </div>
                  <div className="grid gap-3">
                    {items.map((tx) => {
                      const isMasuk = tx.mutasi.toLowerCase() === 'in';
                      return (
                        <div
                          key={tx.id}
                          onClick={() => {
                            setSelectedTx(tx);
                            setModalType('detail');
                          }}
                          className="group bg-white border-2 border-slate-100 rounded-2xl hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer overflow-hidden"
                        >
                          <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 shrink-0">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                                  isMasuk
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-rose-50 text-rose-600'
                                }`}
                              >
                                {isMasuk ? (
                                  <ArrowDownRight strokeWidth={2.5} />
                                ) : (
                                  <ArrowUpRight strokeWidth={2.5} />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                  {tx.id?.slice(-6) || tx.ref?.slice(-6)}
                                </span>
                                <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 text-center">
                                  {tx.jenis}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm md:text-base truncate">
                                {tx.note || '-'}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                                <span className="text-slate-500 flex items-center gap-1">
                                  <User size={12} /> {getPersonName(tx.person)}
                                </span>
                                <span className="text-slate-500 flex items-center gap-1">
                                  <Wallet size={12} /> {getAccountName(tx.account_1)}
                                </span>
                                {tx.account_2 && (
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <ArrowRight size={12} />{' '}
                                    {getAccountName(tx.account_2)}
                                  </span>
                                )}
                                <span className="text-slate-500 flex items-center gap-1">
                                  <User size={12} /> {tx.operator || '-'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-end shrink-0">
                              <p
                                className={`text-base md:text-lg font-black tracking-tight ${
                                  isMasuk ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {isMasuk ? '+' : '-'} {formatRupiah(tx.nominal)}
                              </p>
                            </div>
                          </div>
                          <div className="px-4 pb-3 md:px-5 md:pb-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <span className="text-[9px] font-mono text-slate-400">
                              {tx.created_at
                                ? new Date(tx.created_at).toLocaleTimeString(
                                    'id-ID',
                                    { hour: '2-digit', minute: '2-digit' }
                                  )
                                : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PAGINASI */}
          <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 rounded-b-3xl">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-xl">
              Hal. {page} / {totalPages || 1}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 transition-all shadow-sm text-slate-600"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 transition-all shadow-sm text-slate-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONTAINER ACCOUNTS / WALLET */}
      {/* ============================================================ */}
      {activeTab === 'accounts' && (
        <div
          ref={scrollContainerAccountsRef}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-10"
        >
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              Buku Rekening & Kas
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Sisa saldo aktif untuk setiap penyimpanan
            </p>
          </div>

          {loadingWallets ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200 shadow-sm">
              Tidak ada dompet yang tersedia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wallets.map((wallet) => {
                const getInitials = (name: string) =>
                  name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                const stringToColor = (str: string) => {
                  let hash = 0;
                  for (let i = 0; i < str.length; i++)
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
                  return '#' + '00000'.substring(0, 6 - c.length) + c;
                };
                const bgColor =
                  wallet.link_image && wallet.link_image.startsWith('#')
                    ? wallet.link_image
                    : stringToColor(wallet.text_1);

                return (
                  <div
                    key={wallet.id}
                    onClick={() => {
                      setFilterAccounts([wallet.id]);
                      setActiveTab('history');
                      setPage(1);
                    }}
                    style={{
                      background: `linear-gradient(135deg, ${bgColor}CC 0%, ${bgColor} 100%)`,
                    }}
                    className="relative overflow-hidden rounded-[2rem] p-6 text-white shadow-xl hover:-translate-y-1.5 transition-transform duration-300 group cursor-pointer"
                  >
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:bg-white/30 transition-colors duration-500 pointer-events-none" />
                    <div className="flex justify-between items-start mb-8 relative z-10">
                      <div className="relative group/avatar">
                        <div className="absolute -inset-1 bg-white/20 rounded-2xl blur opacity-0 group-hover/avatar:opacity-100 transition duration-500" />
                        <div className="relative w-14 h-14 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center backdrop-blur-md shadow-lg overflow-hidden transition-all duration-300 group-hover:scale-105">
                          {wallet.link_image &&
                          !wallet.link_image.startsWith('#') ? (
                            <>
                              <img
                                src={pb.files.getUrl(wallet, wallet.link_image)}
                                alt="PP"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                onError={(e) => {
                                  e.currentTarget.classList.add('hidden');
                                  e.currentTarget.nextElementSibling?.classList.remove(
                                    'hidden'
                                  );
                                }}
                              />
                              <span className="hidden font-black text-lg tracking-tight transition-transform duration-300 group-hover:scale-110">
                                {getInitials(wallet.text_1)}
                              </span>
                            </>
                          ) : (
                            <span className="font-black text-lg tracking-tight transition-transform duration-300 group-hover:scale-110">
                              {getInitials(wallet.text_1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm">
                        {wallet.jenis || 'DOMPET'}
                      </span>
                    </div>
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-white/70 mb-1">
                        {wallet.text_1}
                      </p>
                      <p className="text-3xl font-black tracking-tighter text-white">
                        {formatRupiah(wallet.number_1 || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

          {/* MODAL TRANSAKSI FORM */}
          <Modal
            isOpen={modalType === 'form'}
            onClose={handleCloseModal}
            title={isEditMode ? 'Revisi Transaksi Kas' : 'Catat Transaksi Kas Baru'}
            maxWidth="max-w-3xl"
          >
            <form onSubmit={submitForm} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
              <div className="space-y-5">
                
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full shadow-inner">
                  <button type="button" onClick={() => handleMutasiChange('Masuk')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${formData.mutasi === 'Masuk' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}>
                    <ArrowDownRight size={16} className="inline mr-2"/> KAS MASUK
                  </button>
                  <button type="button" onClick={() => handleMutasiChange('Keluar')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${formData.mutasi === 'Keluar' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}>
                    <ArrowUpRight size={16} className="inline mr-2"/> KAS KELUAR
                  </button>
                </div>

                {(() => {
                  const isMasuk = formData.mutasi === 'Masuk';
                  const txtColor = isMasuk ? 'text-emerald-600' : 'text-rose-600';
                  const focusClass = isMasuk ? 'focus:ring-emerald-500/20 focus:border-emerald-400' : 'focus:ring-rose-500/20 focus:border-rose-400';
                  const bgBox = isMasuk ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100';
                  const btnUpload = isMasuk ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 border-rose-200';

                  const optionsJenis = isMasuk ? jenisOptionsIn : jenisOptionsOut;
                  const isTransfer = formData.jenis?.toLowerCase().includes('transfer');

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <label className={`text-[10px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><Calendar size={14}/> Tanggal Waktu</label>
                          <input type="datetime-local" name="created_at" value={formData.created_at || ''} onChange={handleInputChange} className={`w-full mt-2 p-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none transition-all shadow-sm ${focusClass}`} required />
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <label className={`text-[10px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><Layers size={14}/> Jenis Cashflow</label>
                          <select name="jenis" value={formData.jenis || ''} onChange={handleInputChange} className={`w-full mt-2 p-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`} required>
                            <option value="" disabled>Pilih Kategori...</option>
                            {/* Mengubah value menjadi id_lama agar saat Edit bisa terbaca, dan label tetap text_1 */}
                            {optionsJenis.map(opt => <option key={opt.id} value={opt.id_lama || opt.id}>{opt.text_1}</option>)}
                          </select>
                        </div>
                      </div>

                    {/* (1) Akun Sumber & Tujuan (atau Person Selector) */}
                    {(() => {
                      const showPersonSelector = formData.mutasi === 'Keluar' && formData.jenis?.toLowerCase() === 'bonkaryawan';
                      const twoColumns = isTransfer || showPersonSelector;
                      return (
                        <div className={`grid grid-cols-1 ${twoColumns ? 'sm:grid-cols-2' : ''} gap-4`}>
                          {/* Kolom 1: Akun Sumber (selalu ada) */}
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-center ml-1">
                              <label className={`text-[10px] font-black ${txtColor} uppercase tracking-wider flex items-center gap-1.5`}>
                                <Wallet size={14}/> Akun Sumber
                              </label>
                              {formData.account_1 && (
                                <span className="text-[9px] font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                                  Saldo: {formatRupiah((wallets.find(w => w.id === formData.account_1) as any)?.number_1 || 0)}
                                </span>
                              )}
                            </div>
                            <select name="account_1" value={formData.account_1 || ''} onChange={handleInputChange} className={`w-full mt-2 p-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`} required>
                              <option value="" disabled>Pilih Dompet...</option>
                              {accountOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.text_1}</option>)}
                            </select>
                          </div>

                          {/* Kolom 2: Tentukan berdasarkan kondisi */}
                          {isTransfer && (
                            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 animate-in fade-in zoom-in duration-300">
                              <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                  <ArrowRight size={14}/> Akun Tujuan
                                </label>
                                {formData.account_2 && (
                                  <span className="text-[9px] font-black text-blue-600 bg-blue-200/50 px-2 py-0.5 rounded-md shadow-sm">
                                    Saldo: {formatRupiah((wallets.find(w => w.id === formData.account_2) as any)?.number_1 || 0)}
                                  </span>
                                )}
                              </div>
                              <select name="account_2" value={formData.account_2 || ''} onChange={handleInputChange} className="w-full mt-2 p-3 text-xs font-bold text-slate-700 bg-white border border-blue-200 rounded-xl focus:ring-blue-500/20 focus:border-blue-400 outline-none shadow-sm" required>
                                <option value="" disabled>Pilih Tujuan...</option>
                                {accountOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.text_1}</option>)}
                              </select>
                            </div>
                          )}

                          {showPersonSelector && !isTransfer && (
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 relative">
                              <label className={`text-[10px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
                                <User size={14}/> Pilih Pihak (Customer / Karyawan)
                              </label>
                              <div className="relative mt-2">
                                {/* Input search dengan tombol dropdown */}
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="Cari nama..."
                                    value={searchPerson}
                                    onChange={(e) => setSearchPerson(e.target.value)}
                                    onFocus={() => setIsPersonOpen(true)}
                                    className="flex-1 p-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setIsPersonOpen(!isPersonOpen)}
                                    className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                                  >
                                    <ChevronDown size={16} className={`transition-transform duration-200 ${isPersonOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>

                                {/* Dropdown list person */}
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
                                              setFormData(prev => ({ ...prev, person: opt.id, persontext: opt.text_1 }));
                                              setSearchPerson('');
                                              setIsPersonOpen(false);
                                            }}
                                            className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center"
                                          >
                                            <span>{opt.text_1}</span>
                                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                              {opt.source === 'user' ? 'Karyawan' : 'Customer'}
                                            </span>
                                          </div>
                                        ))
                                    )}
                                  </div>
                                )}
                              </div>
                              {formData.person && (
                                <div className="mt-3 text-xs font-bold text-emerald-600 bg-white p-2.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                                  <span>Dipilih:</span>
                                  <span className="text-slate-800">{formData.persontext}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* (2) Nominal Rupiah DIPINDAH KE BAWAH */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <label className={`text-[10px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><DollarSign size={14}/> Nominal Rupiah</label>
                      <div className="relative mt-2">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black ${txtColor}`}>Rp</span>
                        <input type="number" name="nominal" placeholder="0" value={formData.nominal || ''} onChange={handleInputChange} className={`w-full pl-9 pr-3 py-3 text-sm font-black text-slate-800 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`} required />
                      </div>
                    </div>

                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <label className={`text-[10px] font-black ${txtColor} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><FileText size={14}/> Catatan</label>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          <input type="text" name="note" placeholder="Deskripsi/Catatan..." value={formData.note || ''} onChange={handleInputChange} className={`w-full p-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none shadow-sm ${focusClass}`} required />
                        </div>
                      </div>

                      <div className={`p-4 rounded-3xl border space-y-3 ${bgBox}`}>
                      <div className="flex justify-between items-center">
                        <label className={`text-[11px] font-black ${txtColor} uppercase tracking-wider flex items-center gap-2`}><ImagePlus size={16} /> Lampiran Bukti</label>
                        
                        {/* 1. Label dipisah dan menggunakan htmlFor untuk mencegah bug event bubbling di React */}
                        <label 
                          htmlFor="cashflow-file-input" 
                          className={`cursor-pointer text-[10px] font-black bg-white px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border ${btnUpload}`}
                        >
                          + Upload
                        </label>
                        
                        {/* 2. Input diletakkan di luar label dengan id yang terhubung ke htmlFor */}
                        <input 
                          id="cashflow-file-input"
                          type="file" 
                          multiple 
                          accept="image/*,video/*" 
                          className="hidden" 
                          onChange={e => { 
                            // EKSTRAK file DULU sebelum input di-reset!
                            const selectedFiles = Array.from(e.target.files || []);
                            
                            if (selectedFiles.length > 0) {
                              setFiles(prev => [...prev, ...selectedFiles]); 
                              setIsFormDirty(true); 
                            }
                            
                            // Baru aman untuk membersihkan input agar bisa upload file yang sama berkali-kali
                            e.target.value = ''; 
                          }} 
                        />
                      </div>
                        {previewUrls.length === 0 ? (
                          <div className="text-center py-5 rounded-2xl border-2 border-dashed border-white/50"><p className={`text-[10px] font-bold ${txtColor} opacity-70`}>Belum ada file terlampir</p></div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {previewUrls.map((url, idx) => (
                              <div key={idx} className="relative group rounded-xl overflow-hidden border border-white shadow-sm aspect-square bg-white">
                                {isVideo(files[idx]?.name) ? <video src={url} className="w-full h-full object-cover opacity-80" muted /> : <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 shadow-lg"><Trash2 size={14} /></button></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-5 border-t-2 border-slate-100 sticky bottom-0 bg-white">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs tracking-widest transition-colors">BATALKAN</button>
                <button type="submit" disabled={isProcessing} className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2 ${isProcessing ? 'opacity-70 cursor-not-allowed bg-slate-400' : (formData.mutasi === 'Masuk' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/40')}`}>{isProcessing ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> MENYIMPAN...</> : <><Save size={16}/> SIMPAN TRANSAKSI</>}</button>
              </div>
            </form>
          </Modal>

          {/* MODAL FILTER MOBILE */}
          <Modal
            isOpen={modalType === 'detail'}
            onClose={() => setModalType(null)}
            title="Detail Log Transaksi Kas"
            maxWidth="max-w-2xl"
          >
            <div className="space-y-6 p-2">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Wallet size={14}/> Filter Dompet / Akun</label>
                  <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar pb-2">                    {accountOptions.map(acc => (
                  <button 
                    key={acc.id}
                    onClick={() => toggleFilterAccount(acc.id)}
                    className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border ${filterAccounts.includes(acc.id) ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                  {acc.text_1}
                  </button>
                ))}
              </div>
              </div>

              {filterMutasi !== 'semua' && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Layers size={14}/> Filter Jenis
                  </label>
                  <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar pb-2">
                    {(filterMutasi === 'masuk' ? jenisOptionsIn : jenisOptionsOut).map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => toggleFilterJenis(opt.id_lama || opt.id)}
                        className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border ${
                          filterJenis.includes(opt.id_lama || opt.id) 
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {opt.text_1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Rentang Tanggal</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
                  <input type="date" className="p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Pencarian</label>
                <input type="text" placeholder="Cari kata kunci..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              </div>
              <button onClick={() => setIsMobileFilterOpen(false)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Terapkan Filter</button>
            </div>
          </Modal>

          {/* MODAL DETAIL */}
          <Modal
            isOpen={modalType === 'detail'}
            onClose={() => setModalType(null)}
            title="Detail Log Transaksi Kas"
          >
            {selectedTx && (() => {
              const isMasuk = selectedTx.mutasi?.toLowerCase() === 'in';
              const txtColor = isMasuk ? 'text-emerald-600' : 'text-rose-600';
              const mutasiLabel = isMasuk ? 'KAS MASUK (DEBET)' : 'KAS KELUAR (KREDIT)';

              return (
                <div className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
                  <div className={`p-5 sm:p-6 md:p-8 rounded-3xl sm:rounded-[2rem] text-center text-white relative shadow-xl overflow-hidden ${isMasuk ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full blur-3xl opacity-20 pointer-events-none" />
                    
                    <span className="inline-block max-w-[90%] truncate text-[9px] sm:text-[10px] font-black bg-black/20 border border-white/20 px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md relative z-10 shadow-sm">
                      {selectedTx.ref || selectedTx.id}
                    </span>
                    
                    <div className="mt-3 sm:mt-4 relative z-10 flex flex-col items-center">
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-white/80 mb-1">{mutasiLabel}</p>
                      
                      {/* Teks nominal menggunakan ukuran yang mengecil di layar HP dan truncate agar tidak merusak layout */}
                      <p className="text-2xl min-[360px]:text-3xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm truncate w-full px-2">
                        Rp {selectedTx.nominal?.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-4 text-xs font-medium">
                    <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm space-y-3">
                      <p className={`font-black text-[11px] ${txtColor} uppercase border-b-2 border-slate-200 pb-3 mb-2 flex items-center gap-2`}><Layers size={16} /> Entitas: Data Jurnal Kas</p>
                      <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1"><span className="text-slate-400 font-bold">Waktu Transaksi:</span> <span className="font-bold text-slate-700 sm:text-right">{formatLocalDateTime(selectedTx.created_at)}</span></p>
                      <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1"><span className="text-slate-400 font-bold">Operator:</span> <span className="font-bold text-slate-700 sm:text-right">{selectedTx.operator || '-'}</span></p>
                      <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-2 pt-2 border-t border-dashed border-slate-200"><span className="text-slate-400 font-bold">Kategori/Jenis:</span> <span className="font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded uppercase self-start sm:self-auto">{selectedTx.jenis}</span></p>
                      <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1"><span className="text-slate-400 font-bold">Akun Sumber:</span> <span className="font-bold text-slate-700 sm:text-right">{getAccountName(selectedTx.account_1)}</span></p>
                      {selectedTx.account_2 && <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1"><span className="text-slate-400 font-bold">Akun Tujuan:</span> <span className="font-bold text-blue-600 sm:text-right">{getAccountName(selectedTx.account_2)}</span></p>}
                      <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1"><span className="text-slate-400 font-bold">Pihak Terkait:</span> <span className="font-bold text-slate-700 sm:text-right">{getPersonName(selectedTx.person)}</span></p>
                      {selectedTx.ref_baru && <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mt-2 pt-2 border-t border-dashed border-slate-200"><span className="text-slate-400 font-bold">Ref Transaksi POS:</span> <span className="font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 self-start sm:self-auto">{selectedTx.ref_baru}</span></p>}
                    </div>

                    <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm flex flex-col">
                      <p className={`font-black text-[11px] ${txtColor} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}><FileText size={16}/> Catatan & Keterangan</p>
                      <p className="text-sm font-bold text-slate-700 italic leading-relaxed">"{selectedTx.note || 'Tidak ada catatan'}"</p>
                    </div>

                    {selectedTx.file && selectedTx.file.length > 0 && (
                      <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm flex flex-col">
                        <p className={`font-black text-[11px] ${txtColor} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}><ImagePlus size={16}/> Bukti Lampiran Media</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {selectedTx.file.map((f, i) => {
                            const fileUrl = pb.files.getUrl(selectedTx, f);
                            return (
                              <div key={i} className={`relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square ${isMasuk ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                {f.match(/\.(mp4|webm|ogg)$/i) ? <video src={fileUrl} className="w-full h-full object-cover opacity-90" /> : <img src={fileUrl} alt={`Lampiran ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />}
                                <a href={fileUrl} target="_blank" rel="noreferrer" className={`absolute inset-0 ${isMasuk ? 'bg-emerald-900/40' : 'bg-rose-900/40'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm`}><ExternalLink size={24} className="text-white drop-shadow-lg scale-75 group-hover:scale-100 transition-transform" /></a>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 pb-2 border-t-2 border-slate-100 sticky bottom-0 bg-white z-20">
                    <div className="grid grid-cols-4 md:flex gap-3">
                      {/* Tombol Hapus */}
                      <button 
                        onClick={() => {
                          setSystemAlert({
                            show: true,
                            title: "Hapus Transaksi?",
                            message: "Yakin ingin menghapus transaksi kas ini secara permanen?",
                            type: 'confirm',
                            onConfirm: () => {
                              setSystemAlert(prev => ({...prev, show: false}));
                              submitDelete();
                            }
                          });
                        }} 
                        className="col-span-1 md:w-14 h-12 md:h-14 flex-shrink-0 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-500 hover:text-white border border-rose-100 hover:shadow-lg transition-all flex justify-center items-center group"
                        title="Hapus transaksi"
                      >
                        <Trash2 size={20} className="group-hover:scale-110 transition-transform"/>
                      </button>
                      
                      {/* Tombol Edit */}
                      <button 
                        onClick={() => { 
                          const localCreatedAt = selectedTx.created_at ? formatToLocalDatetimeInput(selectedTx.created_at) : '';
                          
                          const oldFiles = (selectedTx.file || []).map(fileName => ({
                            isOld: true,
                            name: fileName,
                            url: pb.files.getUrl(selectedTx, fileName)
                          }));
                          
                          setFiles(oldFiles); 
                          
                          setFormData({
                            mutasi: selectedTx.mutasi?.toLowerCase() === 'in' ? 'Masuk' : 'Keluar', 
                            created_at: localCreatedAt, 
                            jenis: selectedTx.jenis, 
                            account_1: selectedTx.account_1, 
                            account_2: selectedTx.account_2 || '', 
                            person: selectedTx.person || '', 
                            persontext: selectedTx.persontext || '', 
                            nominal: selectedTx.nominal, 
                            note: selectedTx.note 
                          }); 
                          setModalType('form'); 
                        }}
                        className="col-span-3 md:flex-1 h-12 md:h-14 bg-blue-500 text-white rounded-xl font-black text-[11px] md:text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center"
                      >
                        Edit Transaksi
                      </button>
                      
                      {/* Tombol Tutup */}
                      <button 
                        onClick={() => setModalType(null)} 
                        className="col-span-4 md:flex-[2] h-12 md:h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs tracking-widest shadow-xl transition-all active:scale-95 uppercase flex items-center justify-center"
                      >
                        TUTUP DETAIL
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Modal>

        </div>
        
        {/* TOMBOL FLOATING MOBILE */}
        <button
          onClick={() => {
            setSelectedTx(null);
            setFiles([]);
            setFormData({
              mutasi: 'Masuk',
              created_at: formatToLocalDatetimeInput(new Date().toISOString()),
            });
            setModalType('form');
          }}
          className="md:hidden fixed bottom-6 right-6 z-50 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-500/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <Plus size={30} strokeWidth={3} />
        </button>

        {/* SYSTEM ALERT & CONFIRMATION MODAL */}
        <Modal
          isOpen={systemAlert.show}
          onClose={() => setSystemAlert(prev => ({...prev, show: false}))}
          isAlert={true}
          title={systemAlert.title}
          alertDescription={systemAlert.message}
          showCancel={systemAlert.type === 'confirm'}
          alertIcon={systemAlert.type === 'confirm' ? <Trash2 size={24} /> : <AlertCircle size={24} />}
          alertIconBg={systemAlert.type === 'confirm' ? "bg-amber-50 text-amber-500 border-amber-100" : "bg-rose-50 text-rose-500 border-rose-100"}
          onConfirm={systemAlert.onConfirm}
          confirmText={systemAlert.type === 'confirm' ? "Ya, Lanjutkan" : "SAYA MENGERTI"}
          cancelText="Batal"
          confirmBg={systemAlert.type === 'confirm' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-200" : "bg-slate-900 hover:bg-slate-800 shadow-slate-200"}
        />
      </div>
    );
  }