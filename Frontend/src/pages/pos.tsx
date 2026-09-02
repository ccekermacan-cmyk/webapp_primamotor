import { useNavigate, useLocation } from 'react-router-dom'; // Ini yang menyebabkan error ReferenceError
import { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { pb, notifyLaravelApi } from '../lib/pocketbase';
import Modal from '../components/modal';
import { createPortal } from 'react-dom';
import { 
  Search, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Plus, Receipt, Layers, Printer, Share2, X,
  ArrowRight, Calendar, History, Sparkles, DollarSign, Wallet, AlertTriangle, AlertCircle, Info, Wrench, Edit, TrendingUp, TrendingDown, Filter, Zap,
  // Tambahan ikon baru untuk UI yang diperbarui:
  ListOrdered, List, Grid, Users, CreditCard, ShoppingBag, FileText, EyeOff, ImagePlus, Save, CheckCircle2, Box, User, ExternalLink,
  Package, Eye, Upload
} from 'lucide-react';

// --- INTERFACES ---
interface Produk {
  id: string; id_lama: string; kategori: string; merk: string; jenis: string;
  varian: string; keterangan: string; tipe: string; unit: string; beli: number;
  sell_1: number; sell_2: number; sell_3: number; sell_4: number; sell_5: number; sell_6: number;
  min_1: number; min_2: number; min_3: number; stok_3: number;
}

interface DropdownItem {
  id: string; id_lama: string; text_1: string; jenis: string; kategori: string; visibilitas: string;
}

interface UserKaryawan {
  id: string; username: string; name: string; level: number; status: string;
}

interface CartItem extends Produk {
  qty: number;
  priceSelected: number;
  isTiered: boolean;
  basePriceDefault: number;
  manualPrice?: number;
  activeTierName?: string; // Tambahan properti
}

interface HistoryMenu {
  id: string; created_at: string; created: string; jenis: string; person: string; payment: string; 
  qty: number; text: string; tempo: string; marketplace: string; cashback: number; admin: number; operator: string; ref: string; person_baru: string;
  file: string[];
  total?: number;
  dibayar?: number;
}

interface LogStockDetail {
  id: string; item: string; qty: number; price_1: number; price_2: number; boolean: string; item_baru: string; number_1: number; number_2: number;
  expand?: { item_baru: Produk };
}

interface CashflowDetail {
  id: string; nominal: number; mutasi: string; account_1: string; account_2: string; jenis: string; note: string;
}

interface OngkosDetail {
  id: string; person: string; ongkos: number; date: string;
}

interface Gaji {
  id: string; person: string; pokok: number; created_at: string; tunjangan: number; bonus_1: number;
}

// Helper: Menghasilkan string "YYYY-MM-DDTHH:mm" untuk input datetime-local berdasarkan waktu lokal murni
const getLocalDatetimeInput = (dateString?: string) => {
  // Jika string dari PB ada (contoh: "2026-06-21 01:30:00.000Z"), ubah spasinya jadi 'T' supaya aman di-parse browser
  const d = dateString ? new Date(dateString.replace(' ', 'T')) : new Date();
  
  // Ambil komponen waktu berdasarkan zona waktu lokal perangkat (tanpa offset matematis ganda)
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function MenuPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  // State untuk menyimpan file lama saat edit (agar bisa diupload ulang)
  const [existingMenuFiles, setExistingMenuFiles] = useState<File[]>([]);

  // --- 1. ALL STATES ---
  const [products, setProducts] = useState<Produk[]>([]);
  const [historyMenu, setHistoryMenu] = useState<HistoryMenu[]>([]);
  const [historyGaji, setHistoryGaji] = useState<Gaji[]>([]);
  const [menuOptions, setMenuOptions] = useState<DropdownItem[]>([]);
  const [personOptions, setPersonOptions] = useState<DropdownItem[]>([]);
  const [cashflowAccounts, setCashflowAccounts] = useState<DropdownItem[]>([]);
  const [mechanics, setMechanics] = useState<UserKaryawan[]>([]);

  const [allPersons, setAllPersons] = useState<DropdownItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<string>('Overview');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(12);

  const [reportDetailData, setReportDetailData] = useState<{ 
    menu: any[]; 
    logStock: any[]; 
    cashflow: any[]; 
    ongkos: any[] 
  } | null>(null);

  // State untuk posisi dropdown
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const personButtonRef = useRef<HTMLButtonElement>(null);

  const [searchInput, setSearchInput] = useState('');

  const [activeTab, setActiveTab] = useState<'detail' | 'items'>('detail');
  const [searchItemTerm, setSearchItemTerm] = useState('');

  const [viewMode, setViewMode] = useState('grid'); // 'grid' atau 'list'
  const [showNavbar, setShowNavbar] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  // Ambil parameter dari URL saat pertama kali render
  const initialPerson = new URLSearchParams(window.location.search).get('person') || '';
  const initialStatus = new URLSearchParams(window.location.search).get('status') === 'belum' ? 'belum' : 'all';

  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [filterPerson, setFilterPerson] = useState<string>(initialPerson);
  const [selectedMenuFilters, setSelectedMenuFilters] = useState<string[]>([]);
  const [showJenisFilter, setShowJenisFilter] = useState(false);
  const [isPersonFilterOpen, setIsPersonFilterOpen] = useState(false);
  const [personFilterSearch, setPersonFilterSearch] = useState('');
  
  const [showDetailHistory, setShowDetailHistory] = useState<HistoryMenu | null>(null);
  const [historyItems, setHistoryItems] = useState<LogStockDetail[]>([]);
  const [historyCashflow, setHistoryCashflow] = useState<CashflowDetail[]>([]);
  const [historyOngkos, setHistoryOngkos] = useState<OngkosDetail[]>([]);
  
  const [showCheckoutReview, setShowCheckoutReview] = useState(false);
  const [showReceiptPrint, setShowReceiptPrint] = useState<any>(null);

  // Helper Hitung Hari Kerja (Total Hari dlm Bulan - Jumlah Hari Minggu)
  const calculateWorkingDays = (dateStr: string) => {
    if (!dateStr) return 26;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return 26;

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();

    const totalDays = new Date(year, month + 1, 0).getDate();
    let sundays = 0;

    for (let day = 1; day <= totalDays; day++) {
      if (new Date(year, month, day).getDay() === 0) {
        sundays++;
      }
    }

    return totalDays - sundays;
  };

  // State Khusus System Gaji (Perangkum & List Item)
  const [isGajiFormOpen, setIsGajiFormOpen] = useState(false);
  const [gajiEditSession, setGajiEditSession] = useState<{ menuId: string } | null>(null);
  const [gajiHeader, setGajiHeader] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      date: todayStr,
      qty: calculateWorkingDays(todayStr),
      note: '',
    };
  });

  interface GajiItemForm {
    id: string;
    person: string;
    pokok: number;
    tunjangan: number;
    bonus_1: number;
    bonus_2: number;
    bonus_3: number;
    bonus_4: number;
    program: number;
    lembur: number;
    alfa: number;
    setengah_hari: number;
    sakit: number;
    telat: number;
    bpjs: number;
    bon_diambil: number;
    bon_dibayar: number;
    netto: number;
    diterima: number;
    note?: string;
    files?: File[];
    fileUrls?: string[];
  }
  const [gajiItemList, setGajiItemList] = useState<GajiItemForm[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Sub-Modal Detail Gaji Per Karyawan
  const [isGajiItemSubModalOpen, setIsGajiItemSubModalOpen] = useState(false);
  const [editingGajiItemIndex, setEditingGajiItemIndex] = useState<number | null>(null);

  const [gajiItemSubData, setGajiItemSubData] = useState<GajiItemForm>({
    id: '',
    person: '',
    pokok: 0,
    tunjangan: 0,
    bonus_1: 0,
    bonus_2: 0,
    bonus_3: 0,
    bonus_4: 0,
    program: 0,
    lembur: 0,
    alfa: 0,
    setengah_hari: 0,
    sakit: 0,
    telat: 0,
    bpjs: 0,
    bon_diambil: 0,
    bon_dibayar: 0,
    netto: 0,
    diterima: 0,
    note: '',
    files: [],
    fileUrls: [],
  });

  // Filter Karyawan (users): kecuali level = 1 dan kecuali user yang sudah ada di batch periode yang sama
  const availableUsers = useMemo(() => {
    const source = allUsers.length > 0 ? allUsers : allPersons.map(p => ({
      id: p.id,
      username: p.id_lama || p.text_1,
      name: p.text_1,
      level: 10
    }));

    return source.filter(u => {
      if (Number(u.level) === 1) return false;

      const userVal = String(u.username || u.name || u.id);

      // Saat mode edit item sedang aktif, karyawan yang sedang diedit tetap bisa dipilih
      if (editingGajiItemIndex !== null && String(gajiItemSubData?.person) === userVal) {
        return true;
      }

      // Karyawan yang sudah ada di list tidak ditampilkan (mencegah duplikat)
      return !gajiItemList.some(item => String(item.person) === userVal);
    });
  }, [allUsers, allPersons, gajiItemList, editingGajiItemIndex, gajiItemSubData?.person]);

  const [employeeActiveBon, setEmployeeActiveBon] = useState<number>(0);
  const [isFetchingEmployeeData, setIsFetchingEmployeeData] = useState<boolean>(false);
  const [hasLoadedPreviousSlip, setHasLoadedPreviousSlip] = useState<boolean>(false);

  // Helper saat user memilih karyawan di form detail gaji:
  // 1. Fetch Sisa Bon Karyawan dari koleksi 'bon'
  // Helper saat user memilih karyawan di form detail gaji:
  // 1. Fetch Sisa Bon Karyawan dari koleksi 'bon'
  // 2. Fetch data slip gaji periode sebelumnya untuk otomatis mengisi gaji pokok, tunjangan, dll (hanya untuk data baru, bukan edit)
  const handleSelectPerson = async (personVal: string, isEditMode: boolean = false) => {
    setGajiItemSubData(prev => ({ ...prev, person: personVal }));
    if (!personVal) {
      setEmployeeActiveBon(0);
      setHasLoadedPreviousSlip(false);
      return;
    }

    setIsFetchingEmployeeData(true);
    try {
      // 1. Fetch Sisa Bon Karyawan dari collection 'user' berdasarkan field 'number'
      let activeBon = 0;
      let matchedUserId = '';
      try {
        const foundUser = allUsers.find(u => u.username === personVal || u.name === personVal || u.id === personVal);
        if (foundUser) {
           activeBon = Number(foundUser.number) || 0;
           matchedUserId = foundUser.id;
        }
      } catch (bonErr) {
        console.warn("Notice: Fetching bon items fallback:", bonErr);
      }
      setEmployeeActiveBon(activeBon);

      // 2. JIKA BUKAN EDIT MODE (isEditMode === false), otomatis ambil data slip gaji periode sebelumnya untuk person ini
      if (!isEditMode && editingGajiItemIndex === null) {
        let foundPrevious = false;
        try {
          const allGajiList = await pb.collection('gaji').getFullList({
            filter: `person = "${personVal}"`,
            sort: '-created_at',
            $autoCancel: false
          });

          const lastSlip = allGajiList.find((g: any) => String(g.person) === String(personVal));

          if (lastSlip) {
            setGajiItemSubData(prev => ({
              ...prev,
              person: personVal,
              pokok: Number(lastSlip.pokok) || 0,
              tunjangan: Number(lastSlip.tunjangan) || 0,
              bonus_1: Number(lastSlip.bonus_1) || 0,
              bonus_2: Number(lastSlip.bonus_2) || 0,
              bonus_3: Number(lastSlip.bonus_3) || 0,
              bonus_4: Number(lastSlip.bonus_4) || 0,
              program: Number(lastSlip.program) || 0,
              lembur: Number(lastSlip.lembur) || 0,
              bpjs: Number(lastSlip.bpjs) || 0,
              diterima: Number(lastSlip.diterima) || 0,
              // Pertahankan isian sementara jika sudah dimasukkan, atau 0 jika kosong
              alfa: prev.alfa || 0,
              setengah_hari: prev.setengah_hari || 0,
              sakit: prev.sakit || 0,
              telat: prev.telat || 0,
              bon_diambil: prev.bon_diambil || 0,
              bon_dibayar: prev.bon_dibayar || 0
            }));
            foundPrevious = true;
          }
        } catch (gajiErr) {
          console.warn("Notice: Fetching previous gaji slip fallback:", gajiErr);
        }
        setHasLoadedPreviousSlip(foundPrevious);
      }
    } catch (err) {
      console.error("Error fetching employee bon/slip data:", err);
    } finally {
      setIsFetchingEmployeeData(false);
    }
  };

  const [historyGajiSubItems, setHistoryGajiSubItems] = useState<any[]>([]);

  // State Khusus File Upload Menu
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [menuPreviewUrls, setMenuPreviewUrls] = useState<string[]>([]);
  // State untuk menyimpan blob URL dari file nota (dengan autentikasi)
  const [fileBlobUrls, setFileBlobUrls] = useState<Record<string, string>>({});

  // Membersihkan local object URLs untuk preview agar tidak memory leak
  useEffect(() => {
    if (menuFiles.length === 0) { setMenuPreviewUrls([]); return; }
    const urls = menuFiles.map(f => URL.createObjectURL(f));
    setMenuPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [menuFiles]);

  useEffect(() => {
    // Bersihkan blob URL saat modal detail history berubah (ditutup atau ganti nota)
    return () => {
      Object.values(fileBlobUrls).forEach(url => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      setFileBlobUrls({});
    };
  }, [showDetailHistory]); // dependency: ketika modal detail berubah (open/close)

  // Ambil parameter dari URL saat pertama kali mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const personParam = searchParams.get('person');
    const statusParam = searchParams.get('status');

    // Hanya update jika nilai berbeda (untuk menghindari infinite loop)
    if (personParam && personParam !== filterPerson) {
      setFilterPerson(personParam);
    }
    if (statusParam === 'belum' && filterStatus !== 'belum') {
      setFilterStatus('belum');
    }
    if (statusParam !== 'belum' && filterStatus !== 'all') {
      setFilterStatus('all');
    }
  }, [location.search, filterPerson, filterStatus]);

  // Fungsi helper cek video
  const isVideo = (filename: string) => filename.match(/\.(mp4|webm|ogg)$/i);

  const fetchFileWithAuth = async (url: string): Promise<string> => {
    const token = pb.authStore.token;
    if (!token) return url; // fallback (seharusnya tidak terjadi karena user sudah login)
    const response = await fetch(url, {
      headers: { 
        'Authorization': token,
        'ngrok-skip-browser-warning': '69420' // TAMBAHKAN INI DI SINI
      }
    });
    if (!response.ok) throw new Error(`Gagal fetch file: ${response.status}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  const getJenisColor = (jenis: string) => {
  const j = jenis.toLowerCase();
  if (j.includes('penjualan')) return 'text-emerald-500 bg-emerald-50';
  if (j.includes('service')) return 'text-blue-500 bg-blue-50';
  if (j.includes('pembelian')) return 'text-orange-500 bg-orange-50';
  return 'text-slate-500 bg-slate-100'; // Default
  };

  // Edit Session Tracker
  const [editSession, setEditSession] = useState<{ isEditing: boolean, menuId: string, createdAt: string } | null>(null);
  const [editOldItems, setEditOldItems] = useState<{ item_baru: string; qty: number; boolean: string }[]>([]);

  const [formBayar, setFormBayar] = useState({
      personIdLama: 'umum1',
      payment: 'Tunai',
      nominalBayar: 0,
      cashflowList: [{ accountId: '', nominal: 0 }], // Multi cashflow
      mekanikList: [{ idLama: '', ongkos: 0 }],
      note: '',
      noteMenu: '',
      tempoDate: '', // 🟢 Pisahkan state khusus untuk Tanggal Tempo
      marketplace: '',
      adminFee: 0,
      cashback: 0,
      createdAt: getLocalDatetimeInput(), 
});

  const isOnlinePerson = useMemo(() => {
  const selectedPerson = personOptions.find(p => p.id_lama === formBayar.personIdLama);
  const personText = (selectedPerson?.text_1 || '').toLowerCase();
  const personId = formBayar.personIdLama.toLowerCase();
  return personId.includes('online1') || personText.includes('online');
  }, [formBayar.personIdLama, personOptions]);

  // 🟢 State baru untuk fitur Search Pelanggan/Supplier
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const [personSearch, setPersonSearch] = useState('');

  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [dialog, setDialog] = useState<{show: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void}>({
    show: false, title: '', message: '', type: 'alert'
  });

  const showAlert = (title: string, message: string) => {
    setDialog({ show: true, title, message, type: 'alert' });
  };

  const receiptRef = useRef<HTMLDivElement>(null);
  const detailPrintRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleReactPrintFn = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Struk_${formBayar.notaNo || 'POS'}`,
  });

  const handleDetailPrintFn = useReactToPrint({
    contentRef: detailPrintRef,
    documentTitle: `Detail_Transaksi`,
  });

  // 🟢 Keyboard Shortcuts Listener untuk Web & Tablet Hardware Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // F2 atau '/' untuk fokus pencarian produk
      if ((e.key === 'F2' || (e.key === '/' && !isInput)) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // F4 untuk buka Form Pembayaran
      if (e.key === 'F4' && !isPaymentFormOpen && cart.length > 0) {
        e.preventDefault();
        setIsPaymentFormOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentFormOpen, cart]);

  const printWithRawBT = (htmlContent: string) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      const encodedHtml = encodeURIComponent(htmlContent);
      const rawbtIntent = `intent://print?html=${encodedHtml}#Intent;scheme=rawbt;action=rawbt.intent.action.PRINT;end`;
      window.location.href = rawbtIntent;
    } else {
      if (handleReactPrintFn) {
        handleReactPrintFn();
      } else {
        window.print();
      }
    }
  };

  const userLevel = localStorage.getItem('user_level') || '';
  const operatorName = localStorage.getItem('user_name') || 'Admin';

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

  // Helper Logika Gaji & Breakdown Komponen (Lengkap & Presisi)
  const getSalaryDetails = (gaji: any) => {
    const qty = Number(gaji.qty) || 1;
    const pokok = Number(gaji.number_1 || gaji.pokok || 0);
    const tunjangan = Number(gaji.number_2 || gaji.tunjangan || 0);
    const bonus_1 = Number(gaji.bonus_1 || 0);
    const bonus_2 = Number(gaji.bonus_2 || 0);
    const bonus_3 = Number(gaji.bonus_3 || 0);
    const bonus_4 = Number(gaji.bonus_4 || 0);
    const program = Number(gaji.program || 0);
    const lembur = Number(gaji.lembur || 0);

    const nilaiDasar = qty > 0 ? (pokok + tunjangan) / qty : 0;

    const t1 = {
      pokok,
      tunjangan,
      bonus_1,
      bonus_2,
      bonus_3,
      bonus_4,
      program,
      lembur,
    };
    const total1 = Object.values(t1).reduce((sum, val) => sum + val, 0) || Number(gaji.total || 0);

    const t2 = {
      alfa: nilaiDasar * Number(gaji.alfa || 0),
      setengah_hari: (nilaiDasar / 2) * Number(gaji.setengah_hari || 0),
      sakit: (nilaiDasar * 0.9) * Number(gaji.sakit || 0),
      telat: Number(gaji.telat || 0) * 1000, 
    };
    const total2 = Object.values(t2).reduce((sum, val) => sum + val, 0);

    const t3 = {
      bpjs: Number(gaji.bpjs || 0),
      bon_diambil: Number(gaji.bon_diambil || 0),
      bon_dibayar: Number(gaji.bon_dibayar || 0),
    };
    const total3 = Object.values(t3).reduce((sum, val) => sum + val, 0);

    const grandTotal = Number(gaji.total) || (total1 - total2 - total3);

    const note = gaji.text || gaji.note || 'Slip Gaji Karyawan';
    const date = gaji.created_at || gaji.date || '';

    return { t1, total1, t2, total2, t3, total3, grandTotal, qty, note, date };
  };

  // Helper Formatter Tampilan Nominal Netto (Koma/Desimal dikecilkan agar jelas)
  const renderFormattedNetto = (amount: number, mainTextSize: string = "text-xl sm:text-2xl", textColor: string = "text-emerald-300", rpColor: string = "text-emerald-400") => {
    const formatted = Math.round(amount).toLocaleString('id-ID');
    return (
      <span className="inline-flex items-baseline font-black">
        <span className={`text-[10px] sm:text-xs font-extrabold ${rpColor} mr-1 uppercase`}>Rp</span>
        <span className={`${mainTextSize} ${textColor}`}>{formatted}</span>
        <span className={`text-[9px] sm:text-[11px] font-bold ${textColor} opacity-75 font-mono ml-0.5`}>,00</span>
      </span>
    );
  };

  // Helper File Upload untuk Detail Gaji Karyawan
  const handleGajiSubItemFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const existing = gajiItemSubData.files || [];
      const updatedFiles = [...existing, ...newFiles];
      const previewUrls = updatedFiles.map(f => URL.createObjectURL(f));
      setGajiItemSubData(prev => ({
        ...prev,
        files: updatedFiles,
        fileUrls: previewUrls
      }));
    }
  };

  const handleRemoveGajiSubItemFile = (index: number) => {
    const updatedFiles = (gajiItemSubData.files || []).filter((_, i) => i !== index);
    const previewUrls = updatedFiles.map(f => URL.createObjectURL(f));
    setGajiItemSubData(prev => ({
      ...prev,
      files: updatedFiles,
      fileUrls: previewUrls
    }));
  };

  // Helper Kalkulasi Netto Item Karyawan
  const calculateItemNetto = (item: GajiItemForm, headerQty: number) => {
    const qty = Math.max(1, Number(headerQty) || 1);
    const pokok = Number(item.pokok) || 0;
    const tunjangan = Number(item.tunjangan) || 0;
    const nilaiDasar = qty > 0 ? (pokok + tunjangan) / qty : 0;

    const t1 = pokok + tunjangan + Number(item.bonus_1) + Number(item.bonus_2) + Number(item.bonus_3) + Number(item.bonus_4) + Number(item.program) + Number(item.lembur);
    const t2 = (nilaiDasar * Number(item.alfa)) + ((nilaiDasar / 2) * Number(item.setengah_hari)) + (nilaiDasar * 0.9 * Number(item.sakit)) + (Number(item.telat) * 1000);
    const t3 = Number(item.bpjs) + Number(item.bon_diambil) + Number(item.bon_dibayar);

    return t1 - t2 - t3;
  };

  // Tambah/Edit Item Penerima Gaji dari Sub-Modal ke List
  const handleSaveSubGajiItem = () => {
    if (!gajiItemSubData.person) {
      showAlert('Perhatian', 'Pilih Karyawan penerima gaji terlebih dahulu!');
      return;
    }
    const netto = calculateItemNetto(gajiItemSubData, gajiHeader.qty);
    const itemToSave = { ...gajiItemSubData, netto };

    if (editingGajiItemIndex !== null) {
      const updated = [...gajiItemList];
      updated[editingGajiItemIndex] = itemToSave;
      setGajiItemList(updated);
    } else {
      setGajiItemList([...gajiItemList, { ...itemToSave, id: 'tmp_' + Date.now() }]);
    }

    setIsGajiItemSubModalOpen(false);
    setEditingGajiItemIndex(null);
    setGajiItemSubData({
      id: '', person: '', pokok: 0, tunjangan: 0, bonus_1: 0, bonus_2: 0, bonus_3: 0, bonus_4: 0,
      program: 0, lembur: 0, alfa: 0, setengah_hari: 0, sakit: 0, telat: 0, bpjs: 0, bon_diambil: 0, bon_dibayar: 0, netto: 0,
      diterima: 0, note: '', files: [], fileUrls: []
    });
  };

  const handleEditGajiItem = (index: number) => {
    setEditingGajiItemIndex(index);
    const item = gajiItemList[index];
    setGajiItemSubData({ ...item });
    setIsGajiItemSubModalOpen(true);
    handleSelectPerson(item.person, true);
  };

  const handleDeleteGajiItem = (index: number) => {
    setGajiItemList(gajiItemList.filter((_, i) => i !== index));
  };

  // Helper Simpan Seluruh Batch Slip Gaji (Perangkum + Children)
  const handleSaveGaji = async () => {
    if (gajiItemList.length === 0) {
      showAlert('Perhatian', 'Tambahkan minimal 1 Penerima Gaji ke dalam daftar!');
      return;
    }
    setIsProcessing(true);
    try {
      const grandTotal = gajiItemList.reduce((sum, item) => sum + item.netto, 0);
      const isEditMode = gajiEditSession !== null;
      let menuId: string;

      if (isEditMode) {
        // ============== MODE EDIT ==============
        // 1. Update record menu utama
        await pb.collection('menu').update(gajiEditSession!.menuId, {
          total: grandTotal,
          dibayar: grandTotal,
          qty: gajiHeader.qty,
          text: gajiHeader.note || `Gaji Periode ${gajiHeader.date}`,
          person: gajiItemList.map(i => i.person).join(', '),
          person_baru: gajiItemList[0]?.person || '',
          created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
        });
        menuId = gajiEditSession!.menuId;

        // 2. Hapus semua record gaji lama yang terkait (akan dibuat ulang)
        const oldGajiList = await pb.collection('gaji').getFullList({
          filter: `ref = "${menuId}" || ref_baru = "${menuId}"`,
          $autoCancel: false
        }).catch(() => []);
        for (const og of oldGajiList) {
          await notifyLaravelApi('gaji', 'deleted', og.id);
          await pb.collection('gaji').delete(og.id).catch(() => null);
        }

        // 3. Hapus semua record bon lama yang ter-generate dari gaji ini
        const oldBonList = await pb.collection('bon').getFullList({
          filter: `ref = "${menuId}"`,
          $autoCancel: false
        }).catch(() => []);
        for (const ob of oldBonList) {
          const obOk = await notifyLaravelApi('bon', 'deleted', ob.id);
          if (!obOk && ob.user) {
            try {
              const u = await pb.collection('user').getOne(ob.user, { $autoCancel: false });
              const bJ = String(ob.jenis||'').toLowerCase();
              const bN = Number(ob.nominal_bon || ob.nominal || 0);
              const newU = bJ==='in' ? Math.max(0,(Number(u.number)||0)-bN) : (Number(u.number)||0)+bN;
              await pb.collection('user').update(ob.user,{number:newU},{$autoCancel:false});
            } catch(e) { console.warn('Gaji bon revert fallback:',e); }
          }
          await pb.collection('bon').delete(ob.id).catch(() => null);
        }
      } else {
        // ============== MODE BARU ==============
        // 1. Simpan Perangkum Utama ke collection 'menu'
        const menuRecord = await pb.collection('menu').create({
          jenis: 'gaji',
          status: 'lunas',
          total: grandTotal,
          dibayar: grandTotal,
          qty: gajiHeader.qty,
          text: gajiHeader.note || `Gaji Periode ${gajiHeader.date}`,
          person: gajiItemList.map(i => i.person).join(', '),
          person_baru: gajiItemList[0]?.person || '',
          operator: operatorName || pb.authStore.model?.username || 'System',
          created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
        });
        menuId = menuRecord.id;
      }

      // 2 (Bersama). Simpan ulang setiap rincian karyawan ke collection 'gaji'
      for (const item of gajiItemList) {
        const formData = new FormData();
        formData.append('ref', menuId);
        formData.append('ref_baru', menuId);
        formData.append('person', item.person);
        formData.append('pokok', String(item.pokok || 0));
        formData.append('tunjangan', String(item.tunjangan || 0));
        formData.append('bonus_1', String(item.bonus_1 || 0));
        formData.append('bonus_2', String(item.bonus_2 || 0));
        formData.append('bonus_3', String(item.bonus_3 || 0));
        formData.append('bonus_4', String(item.bonus_4 || 0));
        formData.append('program', String(item.program || 0));
        formData.append('lembur', String(item.lembur || 0));
        formData.append('alfa', String(item.alfa || 0));
        formData.append('setengah_hari', String(item.setengah_hari || 0));
        formData.append('sakit', String(item.sakit || 0));
        formData.append('telat', String(item.telat || 0));
        formData.append('bpjs', String(item.bpjs || 0));
        formData.append('bon_diambil', String(item.bon_diambil || 0));
        formData.append('bon_dibayar', String(item.bon_dibayar || 0));
        formData.append('diterima', String(item.diterima || 0));
        if (item.note) formData.append('note', item.note);
        if (gajiHeader.date) formData.append('created_at', `${gajiHeader.date} 12:00:00`);

        if (item.files && item.files.length > 0) {
          item.files.forEach(file => {
            formData.append('file', file);
          });
        }

        await pb.collection('gaji').create(formData);

        // Cari user ID untuk update saldo bon
        const foundUser = allUsers.find(u => u.username === item.person || u.name === item.person || u.id === item.person);
        
        // Cari dropdown person ID untuk relasi tabel bon
        let personDropdownId = '';
        if (foundUser) {
          const foundPerson = allPersons.find(p => p.id_lama === foundUser.username || p.text_1 === foundUser.name || p.id === item.person);
          if (foundPerson) personDropdownId = foundPerson.id;
        }

        // Auto-buat record bon jika ada bon_dibayar > 0 (Pelunasan Bon)
        if (item.bon_dibayar && item.bon_dibayar > 0) {
          try {
            await pb.collection('bon').create({
              persontext: item.person,
              person: personDropdownId,
              jenis: 'in', // Pelunasan = in (mengurangi saldo bon)
              nominal: item.bon_dibayar,
              note: `Potongan Bon via Slip Gaji Periode ${gajiHeader.date}`,
              ref_gaji: menuId,
              operator: operatorName || pb.authStore.model?.username || 'System'
            });

            if (foundUser) {
              const uRec = await pb.collection('user').getOne(foundUser.id, { $autoCancel: false });
              const newBon = Math.max(0, (Number(uRec.number) || 0) - item.bon_dibayar);
              await pb.collection('user').update(foundUser.id, { number: newBon }, { $autoCancel: false });
            }
          } catch (bonErr) {
            console.error("Error auto-creating bon payment record:", bonErr);
          }
        }

        // Auto-buat record bon jika ada bon_diambil > 0 (Pinjaman Bon Baru)
        if (item.bon_diambil && item.bon_diambil > 0) {
          try {
            await pb.collection('bon').create({
              persontext: item.person,
              person: personDropdownId,
              jenis: 'out', // Ambil bon baru = out (menambah saldo bon)
              nominal: item.bon_diambil,
              note: `Pinjaman Bon Baru via Slip Gaji Periode ${gajiHeader.date}`,
              ref_gaji: menuId,
              operator: operatorName || pb.authStore.model?.username || 'System'
            });

            if (foundUser) {
              const uRec = await pb.collection('user').getOne(foundUser.id, { $autoCancel: false });
              const newBon = (Number(uRec.number) || 0) + item.bon_diambil;
              await pb.collection('user').update(foundUser.id, { number: newBon }, { $autoCancel: false });
            }
          } catch (bonErr) {
            console.error("Error auto-creating new bon loan record:", bonErr);
          }
        }
      }

      await notifyLaravelApi('menu', isEditMode ? 'updated' : 'created', menuId, isEditMode ? gajiEditSession : undefined);

      showAlert('Berhasil 🎉', `Slip Gaji Karyawan (${gajiItemList.length} Penerima) berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}!`);
      setIsGajiFormOpen(false);
      setGajiEditSession(null);
      setGajiItemList([]);
      setGajiHeader({ date: new Date().toISOString().split('T')[0], qty: 1, note: '' });
      fetchData();
    } catch (err: any) {
      console.error("Gagal simpan gaji:", err);
      showAlert('Error', 'Gagal menyimpan Slip Gaji: ' + (err.message || 'Error server'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Buka Form Gaji dalam Mode Edit – mengisi form dari data histori
  const handleEditGajiFromHistory = async (menuItem: HistoryMenu) => {
    try {
      // Tentukan tanggal dari created_at record menu
      const dateStr = menuItem.created_at
        ? menuItem.created_at.split('T')[0].split(' ')[0]
        : new Date().toISOString().split('T')[0];

      setGajiHeader({
        date: dateStr,
        qty: menuItem.qty || calculateWorkingDays(dateStr),
        note: menuItem.text || '',
      });

      // Ambil data gaji karyawan dari PocketBase (sudah ada di historyGajiSubItems jika modal sudah dibuka)
      let gajiRecords = historyGajiSubItems;
      if (gajiRecords.length === 0) {
        gajiRecords = await pb.collection('gaji').getFullList({
          filter: `ref = "${menuItem.id}" || ref_baru = "${menuItem.id}"`,
          $autoCancel: false
        }).catch(() => []);
      }

      // Mapping ke GajiItemForm
      const mappedItems: GajiItemForm[] = gajiRecords.map((g: any) => ({
        id: g.id,
        person: g.person || '',
        pokok: Number(g.pokok) || 0,
        tunjangan: Number(g.tunjangan) || 0,
        bonus_1: Number(g.bonus_1) || 0,
        bonus_2: Number(g.bonus_2) || 0,
        bonus_3: Number(g.bonus_3) || 0,
        bonus_4: Number(g.bonus_4) || 0,
        program: Number(g.program) || 0,
        lembur: Number(g.lembur) || 0,
        alfa: Number(g.alfa) || 0,
        setengah_hari: Number(g.setengah_hari) || 0,
        sakit: Number(g.sakit) || 0,
        telat: Number(g.telat) || 0,
        bpjs: Number(g.bpjs) || 0,
        bon_diambil: Number(g.bon_diambil) || 0,
        bon_dibayar: Number(g.bon_dibayar) || 0,
        netto: Number(g.netto) || 0,
        diterima: Number(g.diterima) || 0,
        note: g.note || '',
        files: [],    // File upload baru dikosongkan; file lama tidak perlu dimuat ulang
        fileUrls: [],
      }));

      setGajiItemList(mappedItems);
      setGajiEditSession({ menuId: menuItem.id });
      setShowDetailHistory(null); // Tutup modal detail
      setIsGajiFormOpen(true);
    } catch (err: any) {
      console.error('Gagal memuat data gaji untuk diedit:', err);
      showAlert('Error', 'Gagal memuat data gaji: ' + (err.message || 'Error server'));
    }
  };

  // --- HELPER WARNA TEMA DINAMIS ---
  const getThemeConfig = (menuName: string) => {
    const lower = menuName.toLowerCase();
    
    // Pemetaan tema berdasarkan kata kunci
    const themes: Record<string, any> = {
      overview: { main: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50', border: 'border-indigo-200', hoverMain: 'hover:bg-indigo-500', groupHoverText: 'group-hover:text-indigo-600', focusRing: 'focus:ring-indigo-500' },
      penjualan: { main: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', hoverMain: 'hover:bg-emerald-400', groupHoverText: 'group-hover:text-emerald-500', focusRing: 'focus:ring-emerald-500' },
      service: { main: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-50', border: 'border-blue-200', hoverMain: 'hover:bg-blue-400', groupHoverText: 'group-hover:text-blue-500', focusRing: 'focus:ring-blue-500' },
      pembelian: { main: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-50', border: 'border-amber-200', hoverMain: 'hover:bg-amber-400', groupHoverText: 'group-hover:text-amber-500', focusRing: 'focus:ring-amber-500' },
      gaji: { main: 'bg-teal-500', text: 'text-teal-500', light: 'bg-teal-50', border: 'border-teal-200', hoverMain: 'hover:bg-teal-400', groupHoverText: 'group-hover:text-teal-500', focusRing: 'focus:ring-teal-500' },
      grosir: { main: 'bg-violet-500', text: 'text-violet-500', light: 'bg-violet-50', border: 'border-violet-200', hoverMain: 'hover:bg-violet-400', groupHoverText: 'group-hover:text-violet-500', focusRing: 'focus:ring-violet-500' },
      retur: { main: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-50', border: 'border-rose-200', hoverMain: 'hover:bg-rose-400', groupHoverText: 'group-hover:text-rose-500', focusRing: 'focus:ring-rose-500' }
    };

    // Mencari kunci tema yang cocok dengan nama menu
    const match = Object.keys(themes).find(key => lower.includes(key));
    return match ? themes[match] : themes.overview; // Default ke overview jika tidak ketemu
  };

  const activeTheme = useMemo(() => getThemeConfig(selectedMenu), [selectedMenu]);

  // Helper untuk menyeragamkan nama produk
  const getFullLabel = (p: Produk | any) => {
    if (!p) return "Item Tidak Dikenal";
    const idLamaFormatted = formatIdLamaDisplay(p.id_lama);
    return `${idLamaFormatted} - ${p.kategori} ${p.merk} ${p.jenis} ${p.keterangan} ${p.varian} ${p.tipe}`.replace(/\s+/g, ' ').trim();
  };

  const formatIdLamaDisplay = (id: string | number | undefined) => {
    if (id === undefined || id === null || id === '') return 'N/A';
    return String(id).padStart(5, '0');
  };

  // --- 7. LOAD SUB-DETAILS (dipindah ke atas) ---
  const loadHistorySubDetails = async (menuItem: HistoryMenu) => {
    setShowDetailHistory(menuItem);
    setHistoryItems([]); setHistoryCashflow([]); setHistoryOngkos([]); setHistoryGajiSubItems([]);
    try {
      if (menuItem.jenis?.toLowerCase().includes('gaji')) {
        const gajiRecords = await pb.collection('gaji').getFullList({ 
          filter: `ref = "${menuItem.id}" || ref_baru = "${menuItem.id}"`, 
          $autoCancel: false 
        });
        setHistoryGajiSubItems(gajiRecords);
      } else {
        const [logs, cfs, fees] = await Promise.all([
          pb.collection('log_stock').getFullList<LogStockDetail>({ filter: `ref_baru = "${menuItem.id}"`, expand: 'item_baru', $autoCancel: false }),
          pb.collection('cashflow').getFullList<CashflowDetail>({ filter: `ref_baru = "${menuItem.id}"`, $autoCancel: false }),
          pb.collection('ongkos').getFullList<OngkosDetail>({ filter: `ref_baru = "${menuItem.id}"`, $autoCancel: false }),
        ]);
        setHistoryItems(logs);
        setHistoryCashflow(cfs);
        setHistoryOngkos(fees);
      }
    } catch (e) { console.error("Detail sub-item gagal:", e); }
  };

  // --- FITUR AUTO BUKA NOTA DARI URL (?ref=id_transaksi) ---
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const refId = searchParams.get('ref');
    
    
    if (refId) {
      const openDirectMenu = async () => {
        try {
          // Ambil data menu berdasarkan ID di URL
          const menuRecord = await pb.collection('menu').getOne<HistoryMenu>(refId, { $autoCancel: false });
          // Langsung jalankan fungsi buka sub-detail
          loadHistorySubDetails(menuRecord);
        } catch (error) {
          console.error("Gagal membuka transaksi dari URL (mungkin ID tidak valid/terhapus):", error);
        }
      };
      openDirectMenu();
    }
  }, [location.search]);

  // --- 2. INITIAL FETCH DATA ---
    useEffect(() => {
      const initData = async () => {
        try {
          const [persons, menus, accounts, mechs, usersList] = await Promise.all([
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `kategori ~ "person"`, $autoCancel: false }),
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `kategori ~ "menu" && jenis ~ "jenis menu" && visibilitas ~ "${userLevel}"`, sort: 'text_1', $autoCancel: false }),
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `jenis ~ "cashflow account" && visibilitas ~ "${userLevel}"`, sort: 'text_1', $autoCancel: false }),
            pb.collection('user').getFullList<UserKaryawan>({ filter: `level = 10 && status = "Active"`, $autoCancel: false }),
            pb.collection('user').getFullList({ sort: 'name', $autoCancel: false }),
          ]);
          setAllPersons(persons);
          setMenuOptions([{ id: 'ov-1', text_1: 'Overview' } as any, ...menus]);
          setCashflowAccounts(accounts);
          setMechanics(mechs);
          setAllUsers(usersList);
          console.log("Cek Data Cashflow:", accounts);
        } catch (e) { console.error("Error Fetch Init Data:", e); }
      };
      
      // Pastikan userLevel ada isinya
      if (userLevel !== null) {
          initData();
      } else {
          console.warn("User Level tidak ditemukan di Local Storage!");
      }
    }, [userLevel]);

    // Dynamic Person List (Supplier / Customer)
    // 1. Ubah bagian inisialisasi di useEffect utama atau buat baru
    // Ganti useEffect fetchAllPersons menjadi ini:
    // Dynamic Person List (Supplier / Customer)
    // Dynamic Person List (Supplier / Customer)
    useEffect(() => {
      const fetchFilteredPersons = async () => {
          if (selectedMenu === 'Overview' || selectedMenu.toLowerCase().includes('Gaji')) return;
          
          // Tentukan jenis berdasarkan menu
          const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
          const jenisTarget = isPembelian ? 'supplier' : 'customer';

          try {
              const persons = await pb.collection('dropdown').getFullList<DropdownItem>({
                  filter: `kategori ~ "person" && jenis ~ "${jenisTarget}"`,
                  $autoCancel: false
              });
              setPersonOptions(persons);
              
              // Set default person khusus 'umum1' jika menu penjualan/service
              if (editSession?.isEditing) return; // Jangan ubah customer jika sedang edit nota
              if (persons.length > 0 && !editSession?.isEditing) {
                  // Mencari 'umum1' baik di id_lama maupun text_1 secara case-insensitive
                  const defaultCustomer = persons.find(p => 
                      p.id_lama.toLowerCase().includes('umum1') || 
                      p.text_1.toLowerCase().includes('umum1')
                  ) || persons[0];
                  
                  setFormBayar(prev => ({ 
                      ...prev, 
                      personIdLama: isPembelian ? persons[0].id_lama : defaultCustomer.id_lama 
                  }));
              }
          } catch (e) { console.error("Gagal filter persons:", e); }
      };
      
      fetchFilteredPersons();
    }, [selectedMenu]);

  // --- 3. CORE FETCH ENGINE ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const menuLower = selectedMenu.toLowerCase();
      let conditions: string[] = [];
      let params: any = {};

      if (searchTerm) {
        const terms = searchTerm.trim().split(/\s+/);
        terms.forEach((t, i) => {
          params[`t${i}`] = t;

          if (menuLower === 'overview') {
            const matchedPersonIds: string[] = [];
            allPersons.forEach(p => {
              const text1 = (p.text_1 || '').toLowerCase();
              const text2 = (p.text_2 || '').toLowerCase();
              if (text1.includes(t.toLowerCase()) || text2.includes(t.toLowerCase())) {
                matchedPersonIds.push(p.id_lama);
              }
            });
            const personIdConditions = matchedPersonIds.length > 0
              ? `(${matchedPersonIds.map(id => `person = "${id}"`).join(' || ')})`
              : '';
            let mainCond = `(id_lama ~ {:t${i}} || jenis ~ {:t${i}} || person ~ {:t${i}} || text ~ {:t${i}} || payment ~ {:t${i}} || operator ~ {:t${i}})`;
            if (personIdConditions) {
              mainCond = `(${mainCond} || ${personIdConditions})`;
            }
            conditions.push(mainCond);
          } else if (menuLower.includes('gaji')) {
            conditions.push(`(person ~ {:t${i}} || id_lama ~ {:t${i}})`);
          } else {
            const numericId = parseInt(t, 10);
            const isNumeric = !isNaN(numericId) && numericId.toString() === t.replace(/^0+/, '');
            if (isNumeric) {
              conditions.push(
                `(id_lama ~ {:t${i}} || id_lama = {:id${i}} || kategori ~ {:t${i}} || merk ~ {:t${i}} || jenis ~ {:t${i}} || keterangan ~ {:t${i}} || tipe ~ {:t${i}} || varian ~ {:t${i}})`
              );
              params[`id${i}`] = numericId.toString();
            } else {
              conditions.push(
                `(id_lama ~ {:t${i}} || kategori ~ {:t${i}} || merk ~ {:t${i}} || jenis ~ {:t${i}} || keterangan ~ {:t${i}} || tipe ~ {:t${i}} || varian ~ {:t${i}})`
              );
            }
          }
        });
      }

      const filterStr = conditions.length > 0 ? pb.filter(conditions.join(' && '), params) : '';

      if (menuLower === 'overview') {
        let overviewFilter = filterStr;
        
        if (userLevel === '10') {
          const currentUsername = pb.authStore.model?.username || localStorage.getItem('user_username') || '';
          const currentName = pb.authStore.model?.name || localStorage.getItem('user_name') || '';
          const mechanicCond = `(note ~ "${currentUsername}" || note ~ "${currentName}" || person ~ "${currentUsername}" || person ~ "${currentName}" || persontext ~ "${currentUsername}" || persontext ~ "${currentName}" || operator ~ "${currentUsername}")`;
          overviewFilter = `jenis ~ "service" && ${mechanicCond}`;
        } else {
          // Filter status (dari URL atau manual)
          if (filterStatus !== 'all') {
            const statusValue = filterStatus === 'lunas' ? 'lunas' : 'belum';
            overviewFilter = overviewFilter
              ? `(${overviewFilter}) && status ~ "${statusValue}"`
              : `status ~ "${statusValue}"`;
          }
          
          // Filter person (dari URL)
          if (filterPerson) {
            const personCond = `person = "${filterPerson}"`;
            overviewFilter = overviewFilter
              ? `(${overviewFilter}) && (${personCond})`
              : personCond;
          }
          
          if (selectedMenuFilters.length > 0) {
            const jenisConditions = selectedMenuFilters.map(jenis => `jenis ~ "${jenis.toLowerCase()}"`).join(' || ');
            overviewFilter = overviewFilter
              ? `(${overviewFilter}) && (${jenisConditions})`
              : `(${jenisConditions})`;
          }
        }
        console.log("Overview Filter yang dikirim:", overviewFilter);
        const res = await pb.collection('menu').getList<HistoryMenu>(page, perPage, {
          sort: '-created_at',
          filter: overviewFilter,
          params: params,
          $autoCancel: false
        });
        console.log("Jumlah data ditemukan:", res.items.length);
        setHistoryMenu(res.items);
        setTotalPages(res.totalPages);
      } else if (menuLower.includes('gaji')) {
        // 🔁 Perbaikan: gunakan ~ untuk case-insensitive
        const gajiFilter = filterStr ? `jenis ~ 'gaji' && (${filterStr})` : `jenis ~ 'gaji'`;
        const res = await pb.collection('menu').getList<HistoryMenu>(page, perPage, {
          sort: '-created_at',
          filter: gajiFilter,
          params: params,
          $autoCancel: false
        });
        setHistoryMenu(res.items);
        setTotalPages(res.totalPages);
      } else {
        // Menu produk tetap pakai filter stok
        const showAllStock = ['pembelian', 'rusak', 'opname'].some(keyword => menuLower.includes(keyword));
        let baseFilter = showAllStock ? '' : 'stok_3 > 0';
        if (filterStr) {
          baseFilter = baseFilter ? `(${baseFilter}) && (${filterStr})` : filterStr;
        }
        const res = await pb.collection('produk').getList<Produk>(page, perPage, {
          sort: '-created',
          filter: baseFilter,
          params: params,
          $autoCancel: false
        });
        setProducts(res.items);
        setTotalPages(res.totalPages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Deteksi tipe perangkat
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setDeviceType('mobile');
      else if (width < 1024) setDeviceType('tablet');
      else setDeviceType('desktop');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Atur jumlah item per halaman berdasarkan device
  useEffect(() => {
    if (deviceType === 'mobile') setPerPage(6);
    else if (deviceType === 'tablet') setPerPage(9);
    else setPerPage(12);
  }, [deviceType]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (isOnlinePerson) {
      setFormBayar(prev => ({
        ...prev,
        marketplace: prev.marketplace || 'Shopee',
        adminFee: prev.adminFee || 0,
        cashback: prev.cashback || 0
      }));
    } else {
      // 🟢 RESET DATA: Mencegah bug Grand Total terpotong oleh angka yang tersembunyi
      // saat user mengganti tipe pelanggan dari Online kembali ke Offline/Umum
      setFormBayar(prev => ({
        ...prev,
        marketplace: '',
        adminFee: 0,
        cashback: 0
      }));
    }
  }, [isOnlinePerson]);

  useEffect(() => { fetchData(); }, [page, searchTerm, selectedMenu, filterStatus, selectedMenuFilters, perPage, filterPerson]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      // Jika scroll melewati 50px ke bawah, sembunyikan navbar
      if (currentScrollTop > 50) {
        setShowNavbar(false);
      } 
      // Jika scroll sudah mencapai posisi paling atas (<=10px), tampilkan navbar
      else if (currentScrollTop <= 10) {
        setShowNavbar(true);
      }
      // Untuk posisi antara 11px - 50px, biarkan status navbar tidak berubah (tetap seperti sebelumnya)
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []); // Dependency kosong karena tidak lagi menggunakan lastScrollTop

  const cartWithTierPrice = useMemo(() => {
  const isPembelian = selectedMenu.toLowerCase().includes('pembelian');

  const selectedPersonRecordId = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '';
  const selectedPersonName = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.text_1 || 'Umum';
  
  const selectedCustomer = personOptions.find(p => p.id_lama === formBayar.personIdLama);
  const customerText = (selectedCustomer?.text_1 || '').toLowerCase();
  const customerIdLama = (formBayar.personIdLama || '').toLowerCase();

  const isUmum = customerIdLama.includes('umum1') || customerText.includes('umum1');
  const isOnline = customerIdLama.includes('online1') || customerText.includes('online');
  const isSpecialCustomer = !isUmum && !isOnline;

  return cart.map(item => {
    const basePriceDefault = isPembelian ? item.beli : (isSpecialCustomer ? item.sell_5 : item.sell_6);
    
    let finalPrice = basePriceDefault;
    let isTiered = false;
    let activeTierName = isPembelian ? 'Beli Lama' : (isSpecialCustomer ? 'Harga Pelanggan' : 'Harga Eceran');

    if (!isPembelian) {
      // Urutan dari jumlah terbesar (harga termurah) ke terkecil
      if (item.min_1 > 0 && item.qty >= item.min_1) {
        finalPrice = item.sell_1;
        isTiered = true;
        activeTierName = 'Grosir Besar';
      } else if (item.min_2 > 0 && item.qty >= item.min_2) {
        finalPrice = item.sell_2;
        isTiered = true;
        activeTierName = 'Grosir Sedang';
      } else if (item.min_3 > 0 && item.qty >= item.min_3) {
        finalPrice = item.sell_3;
        isTiered = true;
        activeTierName = 'Grosir Kecil';
      } else if (isSpecialCustomer) {
        finalPrice = item.sell_5;
        isTiered = true;
        activeTierName = 'Harga Pelanggan';
      }
    }

    if (item.manualPrice !== undefined) {
      finalPrice = item.manualPrice;
      isTiered = true;
      activeTierName = 'Harga Custom';
    }

    return { 
      ...item, 
      priceSelected: finalPrice, 
      isTiered, 
      basePriceDefault,
      activeTierName
    };
  });
  }, [cart, formBayar.personIdLama, selectedMenu]);

    const updatePrice = (id: string, newPrice: number) => {
      setCart(prev => prev.map(c => c.id === id ? { ...c, manualPrice: newPrice } : c));
    };

  const totalBelanja = useMemo(() => cartWithTierPrice.reduce((sum, item) => sum + (item.priceSelected * item.qty), 0), [cartWithTierPrice]);
  const totalQtyKeranjang = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const totalOngkos = useMemo(() => {
  if (!selectedMenu.toLowerCase().includes('service')) return 0;
  return formBayar.mekanikList.reduce((sum, mek) => sum + (mek.ongkos || 0), 0);
}, [formBayar.mekanikList, selectedMenu]);

  const isPembelianMenu = selectedMenu.toLowerCase().includes('pembelian');
  const grandTotal = useMemo(() => isPembelianMenu
    ? totalBelanja
    : totalBelanja + totalOngkos - (formBayar.adminFee || 0) + (formBayar.cashback || 0),
    [isPembelianMenu, totalBelanja, totalOngkos, formBayar.adminFee, formBayar.cashback]);

  // --- CHECKOUT SAFETY GUARD ---
  const handleCheckoutValidation = () => {
    const menuLower = selectedMenu.toLowerCase();

    // 1. Validasi keranjang tidak boleh kosong (KECUALI menu Service)
    if (cart.length === 0 && !menuLower.includes('service')) {
      setDialog({ show: true, title: 'Validasi Gagal', message: 'Isi keranjang dengan item terlebih dahulu!', type: 'alert' });
      return;
    }

    // --- VALIDASI KHUSUS SERVICE ---
    if (menuLower.includes('service')) {
      // Minimal 1 mekanik harus diisi dengan ongkos > 0
      const mekanikValid = formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0);
      if (mekanikValid.length === 0) {
        setDialog({
          show: true,
          title: 'Validasi Gagal',
          message: 'Untuk menu SERVICE, minimal 1 mekanik harus diisi dengan ongkos yang valid (> 0).',
          type: 'alert'
        });
        return;
      }

      // Jika ada mekanik yang idLama diisi tapi ongkos = 0
      const mekanikTanpaOngkos = formBayar.mekanikList.some(m => m.idLama && m.ongkos === 0);
      if (mekanikTanpaOngkos) {
        setDialog({
          show: true,
          title: 'Ongkos Mekanik Kosong',
          message: 'Mekanik yang dipilih harus memiliki ongkos kerja yang valid (harus > 0). Silakan isi ongkos untuk semua mekanik.',
          type: 'alert'
        });
        return;
      }
    }

    // --- VALIDASI CASHFLOW (account_1 diisi tapi nominal 0) ---
    const cashflowInvalid = formBayar.cashflowList.some(cf => cf.accountId && cf.nominal === 0);
    if (cashflowInvalid) {
      setDialog({
        show: true,
        title: 'Nominal Pembayaran Kosong',
        message: 'Akun kas yang dipilih harus memiliki nominal pembayaran yang valid (harus > 0).',
        type: 'alert'
      });
      return;
    }

    // --- VALIDASI CASHFLOW (nominal > 0 tapi account_1 kosong) ---
    const cashflowTanpaAkun = formBayar.cashflowList.some(cf => !cf.accountId && cf.nominal > 0);
    if (cashflowTanpaAkun) {
      setDialog({
        show: true,
        title: 'Akun Kas Belum Dipilih',
        message: 'Nominal pembayaran dimasukkan tetapi akun kas belum dipilih. Silakan pilih akun kas terlebih dahulu.',
        type: 'alert'
      });
      return;
    }

    // --- CEK STATUS LUNAS / BELUM (konfirmasi) ---
    const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
    let perluKonfirmasiLunas = false;
    let pesanKonfirmasi = '';

    const isCashflowKosong = formBayar.cashflowList.length === 0 ||
      formBayar.cashflowList.every(cf => !cf.accountId && cf.nominal === 0);
    const adaCashflowBelumLengkap = formBayar.cashflowList.some(cf => (!cf.accountId && cf.nominal > 0) || (cf.accountId && cf.nominal <= 0));
    const totalKurang = totalDibayar < grandTotal;

    if (isCashflowKosong || adaCashflowBelumLengkap || totalKurang) {
      perluKonfirmasiLunas = true;
      pesanKonfirmasi = `Apakah Anda yakin ingin melanjutkan simpan menu ${selectedMenu} ini dalam keadaan BELUM LUNAS?`;
    }

    // Jika perlu konfirmasi, tampilkan dialog
    if (perluKonfirmasiLunas) {
      setDialog({
        show: true,
        title: 'Konfirmasi Status Belum Lunas',
        message: pesanKonfirmasi,
        type: 'confirm',
        onConfirm: () => {
          setDialog(prev => ({ ...prev, show: false }));
          lanjutkanValidasiMandatory();
        }
      });
      return;
    }

    // Jika tidak perlu konfirmasi (sudah lunas), langsung lanjut
    lanjutkanValidasiMandatory();

    // Fungsi untuk melanjutkan validasi mandatory (setelah konfirmasi atau langsung)
    function lanjutkanValidasiMandatory() {
      // Validasi untuk online person
      if (isOnlinePerson) {
        if (!formBayar.marketplace.trim()) {
          setDialog({ show: true, title: 'Validasi Gagal', message: 'Marketplace wajib diisi untuk pelanggan online.', type: 'alert' });
          return;
        }
        if (formBayar.adminFee <= 0) {
          setDialog({ show: true, title: 'Validasi Gagal', message: 'Admin fee wajib diisi (minimal 0).', type: 'alert' });
          return;
        }
      }

      // Validasi Catatan (Service & Pembelian)
      if (menuLower.includes('service') && !formBayar.noteMenu.trim()) {
        setDialog({ show: true, title: 'Catatan Kosong', message: 'Isi jenis motor service pada catatan nota!', type: 'alert' });
        return;
      }

      // ===== BLOK KHUSUS PEMBELIAN =====
      if (menuLower.includes('pembelian')) {
        let noteMenu = formBayar.noteMenu;

        // 1. Jika payment = Tempo, tanggal jatuh tempo wajib
        if (formBayar.payment === 'Tempo') {
          if (!formBayar.tempoDate) { // 🟢 Perbaikan: cek formBayar.tempoDate
            setDialog({
              show: true,
              title: 'Validasi Gagal',
              message: 'Tanggal jatuh tempo wajib diisi untuk pembelian dengan pembayaran Tempo.',
              type: 'alert'
            });
            return;
          }

          // 2. Jika noteMenu kosong, isi otomatis dengan keterangan tempo
          if (!noteMenu.trim()) {
            const tglTransaksi = formBayar.createdAt ? new Date(formBayar.createdAt) : new Date();
            const tglJatuhTempo = new Date(formBayar.tempoDate); // 🟢 Perbaikan: gunakan tempoDate
            const diffTime = tglJatuhTempo.getTime() - tglTransaksi.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };
            const formattedDate = tglJatuhTempo.toLocaleDateString('id-ID', options);
            noteMenu = `Tempo: ${formattedDate} (${diffDays} hari)`;
            // Update state agar UI tercermin
            setFormBayar(prev => ({ ...prev, noteMenu }));
          }
        }

        // Validasi noteMenu (jika masih kosong setelah auto-fill)
        if (!noteMenu.trim()) {
          setDialog({ show: true, title: 'Catatan Kosong', message: 'Isi nota dari customer pada catatan nota!', type: 'alert' });
          return;
        }

        // Validasi Media Bukti (Pembelian) - TIDAK WAJIB lagi, tapi akan memengaruhi status
        // (hanya beri peringatan, tidak block)
        if (menuFiles.length === 0 && !editSession?.menuId && menuLower.includes('pembelian')) {
          console.warn("Pembelian tanpa lampiran media - status akan tetap 'belum' meski lunas");
        }
      }

      // Jika lolos semua validasi, buka modal review
      setShowCheckoutReview(true);
    }
  };

  const handleMenuChange = (menuName: string) => {
    if (cart.length > 0 && selectedMenu !== menuName) {
      setDialog({
        show: true, title: 'Batalkan Transaksi?',
        message: 'Keranjang belanja Anda saat ini akan dibersihkan jika Anda berpindah ke halaman menu lain. Lanjutkan?',
        type: 'confirm',
        onConfirm: () => { 
          setCart([]); 
          setEditSession(null);
          setEditOldItems([]);
      setEditOldItems([]);
      setExistingMenuFiles([]);
          setMenuFiles([]);
      setExistingMenuFiles([]);
          setSelectedMenu(menuName); 
          setPage(1); 
          setDialog(prev => ({ ...prev, show: false }));
          setFormBayar(prev => ({
            ...prev,
            personIdLama: 'umum1',
            payment: 'Tunai',
            cashflowList: [{ accountId: '', nominal: 0 }],
            mekanikList: [{ idLama: '', ongkos: 0 }],
            note: '',
            noteMenu: '',
            marketplace: '',
            adminFee: 0,
            cashback: 0,
            createdAt: getLocalDatetimeInput(), // 🟢 Menggunakan fungsi waktu lokal
          }));
        }
      });
    } else if (selectedMenu.toLowerCase() === menuName.toLowerCase() && menuName.toLowerCase() === 'overview') {
      // Refresh data Overview saat tab diklik ulang
      fetchData();
    } else { 
      setSelectedMenu(menuName); 
      setPage(1);
      // fetchData triggered by useEffect on selectedMenu/page change
    }
  };

  const addToCart = (prod: Produk) => {
    const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
    const existing = cart.find(c => c.id === prod.id);
    const currentQty = existing ? existing.qty : 0;
    if (!isPembelian && currentQty + 1 > prod.stok_3) {
      setDialog({ show: true, title: 'Batas Stok Realtime', message: `Sisa pasokan fisik untuk barang ini hanya tersisa ${prod.stok_3} ${prod.unit}.`, type: 'alert' });
      return;
    }
    if (existing) { setCart(cart.map(c => c.id === prod.id ? { ...c, qty: c.qty + 1 } : c)); } 
    else { setCart([...cart, { ...prod, qty: 1, priceSelected: prod.sell_6, isTiered: false, basePriceDefault: prod.sell_6 }]); }
  };

  const updateQty = (id: string, delta: number, maxStok: number) => {
    const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
    const item = cart.find(c => c.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (!isPembelian && newQty > maxStok) {
      setDialog({ show: true, title: 'Kapasitas Stok Habis', message: `Maksimal gudang (${maxStok} unit).`, type: 'alert' });
      return;
    }
    if (newQty <= 0) {
      setCart(prev => prev.filter(c => c.id !== id));
    } else {
      setCart(prev => prev.map(c => c.id === id ? { ...c, qty: newQty } : c));
    }
  };

  // --- 6. MULTI-COLLECTION STORING TO POCKETBASE ---
  const executeStoringData = async () => {
    setIsProcessing(true);
    setProcessingMsg('Menyimpan...');
    // Watchdog: auto-recover jika proses >60 detik (stall/macet)
    const watchdog = setTimeout(() => {
      console.warn('Watchdog: executeStoringData stalled >60s, force re-enabling UI');
      setIsProcessing(false);
      setProcessingMsg('');
      setDialog({ show: true, title: 'Timeout', message: 'Proses penyimpanan terlalu lama (>60 detik). Silakan coba lagi atau refresh halaman.', type: 'alert' });
    }, 60000);
    try {
      const isEditing = editSession?.isEditing && editSession?.menuId;
      
      // Browser otomatis mengubah string lokal (YYYY-MM-DDTHH:mm) menjadi format UTC (Z) yang diterima PB
      const timestamp = formBayar.createdAt
        ? new Date(formBayar.createdAt).toISOString()
        : new Date().toISOString();
        
      const menuLower = selectedMenu.toLowerCase();

      const selectedPersonRecordId = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '';
      const selectedPersonName = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.text_1 || 'Umum';

      let menuRecordId = isEditing ? editSession.menuId : '';
      let oldMenuData: any = null;
      let oldCashflows: any[] = [];
      let oldOngkos: any[] = [];
      let oldLogs: any[] = [];

      if (isEditing) {
        oldMenuData = await pb.collection('menu').getOne(editSession.menuId).catch(() => null);
        
        oldLogs = await pb.collection('log_stock').getFullList({ filter: `ref_baru = "${editSession.menuId}"` }).catch(() => []);
        oldCashflows = await pb.collection('cashflow').getFullList({ filter: `ref_baru = "${editSession.menuId}"` }).catch(() => []);
        oldOngkos = await pb.collection('ongkos').getFullList({ filter: `ref_baru = "${editSession.menuId}"` }).catch(() => []);
      }

      // Hitung akumulasi parameter keuangan pembayaran kasir
      const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);

      // === PRE-FLIGHT: ambil snapshot stok & saldo sebelum write ===
      setProcessingMsg('Memverifikasi stok & saldo...');
      const preflightStocks: Record<string, number> = {};
      const preflightBalances: Record<string, number> = {};
      try {
        const stockPromises = cartWithTierPrice
          .filter(item => item.id)
          .map(item => pb.collection('produk').getOne(item.id, { $autoCancel: false }).then(p => ({ id: item.id, stok: Number(p.stok_3) || 0 })).catch(() => ({ id: item.id, stok: 0 })));
        const balancePromises = formBayar.cashflowList
          .filter(cf => cf.accountId && cf.nominal > 0)
          .map(cf => pb.collection('dropdown').getOne(cf.accountId, { $autoCancel: false }).then(a => ({ id: cf.accountId, bal: Number(a.number_1) || 0 })).catch(() => ({ id: cf.accountId, bal: 0 })));
        const [stocks, balances] = await Promise.all([Promise.all(stockPromises), Promise.all(balancePromises)]);
        stocks.forEach(s => { preflightStocks[s.id] = s.stok; });
        balances.forEach(b => { preflightBalances[b.id] = b.bal; });
      } catch { /* pre-flight failure is non-fatal, fallbacks handle it */ }
      setProcessingMsg('Menyimpan transaksi...');

      // Track created records for potential rollback
      const createdRecords: { type: string; id: string }[] = [];

      // Logika baru: Untuk pembelian, jika belum ada file → tetap 'belum' meski sudah dibayar penuh
      let statusBaru = totalDibayar >= grandTotal ? 'lunas' : 'belum';

      if (menuLower.includes('pembelian') && menuFiles.length === 0 && !isEditing) {
        statusBaru = 'belum'; // Paksa belum lunas jika belum upload bukti
        console.warn("Pembelian tanpa media → status tetap 'belum'");
      }
      let dateLunas = null;

      if (isEditing && oldMenuData) {
        const oldStatus = oldMenuData.status;
        if (statusBaru === 'lunas' && oldStatus !== 'lunas') {
          dateLunas = new Date().toISOString();
        } else if (statusBaru === 'lunas') {
          dateLunas = oldMenuData.date_lunas; // Pertahankan track records tgl lunas lama
        }
      } else if (statusBaru === 'lunas') {
        dateLunas = new Date().toISOString();
      }

      // Pembentukan Dokumen Jurnal Formulir Data Menu Baru
      const menuFormData = new FormData();
      menuFormData.append('jenis', selectedMenu);
      menuFormData.append('person', formBayar.personIdLama);
      menuFormData.append('person_baru', selectedPersonRecordId);
      menuFormData.append('text', formBayar.noteMenu);
      const paymentValue = formBayar.payment === 'Tunai' ? 'cash' : 'tempo';
      menuFormData.append('payment', paymentValue);
      menuFormData.append('operator', operatorName);
      menuFormData.append('created_at', timestamp);
      menuFormData.append('qty', String(totalQtyKeranjang));
      // 🟢 KEAMANAN GANDA: Pastikan nilai yang dikirim ke DB benar-benar 0 jika bukan pelanggan online
      menuFormData.append('marketplace', isOnlinePerson ? formBayar.marketplace : '');
      menuFormData.append('cashback', isOnlinePerson ? String(formBayar.cashback) : '0');
      menuFormData.append('admin', isOnlinePerson ? String(formBayar.adminFee) : '0');
      menuFormData.append('status', statusBaru);
      menuFormData.append('total', String(grandTotal));
      menuFormData.append('dibayar', String(totalDibayar));
      if (dateLunas) menuFormData.append('date_lunas', dateLunas);
      
      // 🟢 Simpan tanggal tempo jika pembayaran di-set ke Tempo
      if (formBayar.payment === 'Tempo' && formBayar.tempoDate) {
        menuFormData.append('tempo', formBayar.tempoDate);
      }

      if (menuFiles && menuFiles.length > 0) {
        menuFiles.forEach(file => menuFormData.append('file', file));
      }

      // Simpan entitas Menu utama ke Database
      if (isEditing) {
        await pb.collection('menu').update(menuRecordId, menuFormData);
      } else {
        const menuRecord = await pb.collection('menu').create(menuFormData);
        menuRecordId = menuRecord.id;
        createdRecords.push({ type: 'menu', id: menuRecordId });
        await notifyLaravelApi('menu', 'created', menuRecordId);
      }

      // ========== PENYIMPANAN LOG STOCK (ITEM BARU) ==========
      const oldItemMap: Record<string, { qty: number; boolean: string }> = {};
      if (isEditing && editOldItems.length > 0) {
        editOldItems.forEach(o => { oldItemMap[o.item_baru] = o; });
      }
      const runningStock: Record<string, number> = {};
      for (const item of cartWithTierPrice) {
        const booleanValue = (menuLower.includes('penjualan') || menuLower.includes('service')) ? 'out' : 'in';
        
        let price2Value = (item.beli || 0) * item.qty;
        let normalValue = (item.sell_6 || 0) * item.qty;

        if (booleanValue === 'in') {
            price2Value = 0;
            normalValue = 0;
        }

        const prodId = item.id || '';
        if (prodId && runningStock[prodId] === undefined) {
          runningStock[prodId] = preflightStocks[prodId] ?? 0;
        }
        const logQty = Math.max(1, Number(item.qty || 1));
        const qtyAwal = runningStock[prodId] ?? 0;

        // Smart edit: net stock delta (preflight is pre-revert = post-original value)
        let qtyAkhir: number;
        const oldItem = isEditing ? oldItemMap[prodId] : null;
        if (oldItem) {
          if (oldItem.qty === logQty && oldItem.boolean === booleanValue) {
            // Unchanged: restore to preflight (stock was reverted by delete, must restore)
            qtyAkhir = preflightStocks[prodId] ?? qtyAwal;
          } else {
            // Changed: preflight is post-original. Remove old effect, apply new.
            const afterRevert = oldItem.boolean === 'in'
              ? (preflightStocks[prodId] ?? 0) - oldItem.qty
              : (preflightStocks[prodId] ?? 0) + oldItem.qty;
            qtyAkhir = booleanValue === 'in' ? afterRevert + logQty : Math.max(0, afterRevert - logQty);
          }
        } else {
          qtyAkhir = booleanValue === 'in' ? qtyAwal + logQty : Math.max(0, qtyAwal - logQty);
        }
        if (prodId && (!oldItem || oldItem.qty !== logQty || oldItem.boolean !== booleanValue)) {
          runningStock[prodId] = qtyAkhir;
        }

        const logRecord = await pb.collection('log_stock').create({
          id_lama: '',
          created_at: new Date().toISOString(),
          operator: operatorName || pb.authStore.model?.username || 'Kasir',
          item: item.id_lama || item.id || '',
          qty: logQty,
          item_baru: prodId,
          price_1: Number(item.priceSelected || 0),
          price_2: Number(price2Value || 0),
          number_1: 0,
          number_2: 0,
          boolean: booleanValue,
          ref: menuRecordId || '',
          ref_baru: menuRecordId || '',
          normal: Number(normalValue || 0),
          stok_awal: qtyAwal,
          stok_akhir: qtyAkhir,
        });
        createdRecords.push({ type: 'log_stock', id: logRecord.id });
        // SELALU panggil webhook backend karena penghapusan Menu sebelumnya sudah me-revert stok dan laporan (omset/laba)
        const stockApiOk = await notifyLaravelApi('log_stock', 'created', logRecord.id);
        if (!stockApiOk) console.warn('Laravel log_stock notify failed');
      }

            // Cari person record ID berdasarkan personIdLama (jika ada)
      let personRecordId = '';
      if (formBayar.personIdLama && formBayar.personIdLama !== 'umum1') {
        try {
          const personRecord = await pb.collection('dropdown').getFirstListItem(`id_lama = "${formBayar.personIdLama}"`, { $autoCancel: false });
          personRecordId = personRecord.id;
        } catch (e) {
          console.warn("Person tidak ditemukan:", formBayar.personIdLama);
        }
      }

      if (isEditing) {
        for (const cf of oldCashflows) {
           await notifyLaravelApi('cashflow', 'deleted', cf.id);
           await pb.collection('cashflow').delete(cf.id).catch(() => null);
        }
        for (const ong of oldOngkos) {
           await notifyLaravelApi('ongkos', 'deleted', ong.id);
           await pb.collection('ongkos').delete(ong.id).catch(() => null);
        }
        for (const log of oldLogs) {
           await notifyLaravelApi('log_stock', 'deleted', log.id);
           await pb.collection('log_stock').delete(log.id).catch(() => null);
        }
      }

      // Simpan pemetaan pemisahan multi cashflow aliran dana masuk/keluar
      for (const cf of formBayar.cashflowList) {
        if (cf.accountId && cf.nominal > 0) {
          const selectedAccount = cashflowAccounts.find(acc => acc.id === cf.accountId);
          const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
          const mutasiValue = (menuLower.includes('penjualan') || menuLower.includes('service')) ? 'in' : 'out';
          
          let saldoAwal = preflightBalances[cf.accountId] ?? 0;
          const saldoAkhir = mutasiValue === 'in' ? (saldoAwal + cf.nominal) : (saldoAwal - cf.nominal);

          const cfRecord = await pb.collection('cashflow').create({
            id_lama: '',
            created_at: new Date().toISOString(),
            operator: operatorName,
            nominal: cf.nominal,
            jenis: selectedMenu,
            mutasi: mutasiValue,
            account_1: cf.accountId,          
            account_2: '',                    
            note: formBayar.note || `POS System: Nota ${menuRecordId}`,
            ref_baru: menuRecordId,
            person: personRecordId,
            persontext: formBayar.personIdLama || '',
            acc1: accountIdLama,              
            acc2: '',
            saldo_awal: saldoAwal,
            saldo_akhir: saldoAkhir,
          });
          createdRecords.push({ type: 'cashflow', id: cfRecord.id });
          const cfApiOk = await notifyLaravelApi('cashflow', 'created', cfRecord.id);
          if (!cfApiOk) console.warn('Laravel cashflow notify failed');
        }
      }

      // Alokasikan alur pembagian komisi upah ke sub-koleksi ongkos (Khusus Jenis Service)
      if (menuLower.includes('service')) {
        // Filter mekanik yang valid (ada idLama dan ongkos > 0)
        const mekanikValid = formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0);
        
        if (mekanikValid.length > 0) {
          try {
            // Buat array promise dengan $autoCancel: false dan panggil webhook Laravel API
            const ongkosPromises = mekanikValid.map(async (mek) => {
              const res = await pb.collection('ongkos').create(
                {
                  id_lama: '',
                  date: new Date().toISOString(),
                  person: mek.idLama,
                  ongkos: mek.ongkos,
                  operator: operatorName,
                  ref: '',
                  ref_baru: menuRecordId
                },
                { '$autoCancel': false }
              );
              createdRecords.push({ type: 'ongkos', id: res.id });
              await notifyLaravelApi('ongkos', 'created', res.id);
              return res;
            });
            // Jalankan semua promise secara paralel
            await Promise.all(ongkosPromises);
          } catch (error) {
            console.error('Gagal menyimpan ongkos:', error);
            // Lempar error agar user tahu ada masalah
            throw new Error('Gagal menyimpan data ongkos mekanik. Periksa input mekanik.');
          }
        }
      }

      // Siapkan State Nota Cetak Thermal Printer
      const mechanicsForPrint = formBayar.mekanikList
        .filter(m => m.idLama && m.ongkos > 0)
        .map(m => {
          const mech = mechanics.find(me => me.username === m.idLama);
          return { name: mech?.name || m.idLama, ongkos: m.ongkos };
        });

      setShowReceiptPrint({
        id: menuRecordId,
        timestamp,
        customer: selectedPersonName,
        items: cartWithTierPrice,
        total: grandTotal,
        cash: formBayar.nominalBayar,
        change: formBayar.nominalBayar - grandTotal,
        payment: formBayar.payment,
        jenis: selectedMenu,
        mechanics: mechanicsForPrint
      });

      if (isEditing) {
        await notifyLaravelApi('menu', 'updated', menuRecordId, editSession);
      }

      setDialog({ show: true, title: 'SUKSES', message: isEditing ? "Perubahan transaksi berhasil diperbarui!" : "Transaksi berhasil disimpan!", type: 'alert' });
      
      // Reset State Form input kasir kembali bersih
      setShowCheckoutReview(false);
      setCart([]);
      setMenuFiles([]);
      setEditSession(null);
      setIsCartModalOpen(false);
      setFormBayar({
        personIdLama: 'umum1',
        payment: 'Tunai',
        nominalBayar: 0,
        mekanikList: [{ idLama: '', ongkos: 0 }],
        noteMenu: '',
        note: '',
        marketplace: '',
        adminFee: 0,
        cashback: 0,
        cashflowList: [{ accountId: '', nominal: 0 }],
        createdAt: getLocalDatetimeInput(), // 🟢 Reset dengan akurat
      });

      fetchData(); // Muat ulang grid inventaris barang & list overview di screen utama

    } catch (err: any) {
      console.error(err);
      // Rollback: hapus record yang sudah terlanjur dibuat
      if (createdRecords.length > 0) {
        setProcessingMsg('Rollback perubahan...');
        for (const r of createdRecords.reverse()) {
          try {
            await pb.collection(r.type).delete(r.id, { $autoCancel: false });
            await notifyLaravelApi(r.type, 'deleted', r.id);
          } catch {}
        }
      }
      setDialog({ show: true, title: 'Sinkronisasi Gagal', message: "Gagal menyimpan data entri: " + (err.message || err), type: 'alert' });
    } finally {
      clearTimeout(watchdog);
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  const filteredHistoryItems = useMemo(() => {
    if (!searchItemTerm.trim()) return historyItems;
    const term = searchItemTerm.toLowerCase();
    return historyItems.filter(item => {
      const label = getFullLabel(item.expand?.item_baru).toLowerCase();
      return label.includes(term);
    });
  }, [historyItems, searchItemTerm]);

  // Kalkulasi laba kotor untuk modal history
  const totalLabaKotor = useMemo(() => {
    if (historyItems.length === 0) return 0;
    return historyItems.reduce((acc, item) => {
      const modal = item.price_2 || 0;
      const jual = (item.price_1 || 0) * (item.qty || 0);
      return acc + (jual - modal);
    }, 0);
  }, [historyItems]);

  const totalTransaksi = useMemo(() => {
    return historyItems.reduce((acc, item) => acc + (item.price_1 * item.qty), 0);
  }, [historyItems]);

  const persentaseLaba = totalTransaksi > 0 ? ((totalLabaKotor / totalTransaksi) * 100).toFixed(1) : 0;

  // --- 8. EDIT & DELETE HANDLERS ---
  const handleEditHistoryToCart = (menuItem: HistoryMenu) => {
    setDialog({
      show: true, title: 'Edit Transaksi Ini?',
      message: 'Transaksi ini akan dimuat ulang ke keranjang. Menyimpan kembali akan menimpa data lama tanpa mengubah tanggalnya. Lanjutkan?',
      type: 'confirm',
      onConfirm: async () => {
        setDialog(prev => ({ ...prev, show: false }));
        try {
          const logs = await pb.collection('log_stock').getFullList<LogStockDetail>({ filter: `ref_baru = "${menuItem.id}"`, expand: 'item_baru' });
          const reloadedCart: CartItem[] = [];

          for (const log of logs) {
            if (log.expand?.item_baru) {
              const prod = log.expand.item_baru;
              reloadedCart.push({ 
                ...prod, 
                qty: log.qty, 
                priceSelected: log.price_1, 
                manualPrice: log.price_1,      // 🔒 Kunci harga agar tidak berubah oleh tier
                isTiered: true,                // Tandai sebagai tiered agar UI menampilkan badge
                basePriceDefault: prod.sell_6 
              });
            }
          }

          setCart(reloadedCart);
          setSelectedMenu(menuItem.jenis);
          
          // Cari apakah ada data mekanik dari ongkos
          const fees = await pb.collection('ongkos').getFullList<OngkosDetail>({ filter: `ref_baru = "${menuItem.id}"` });
          const loadedMekanik = fees.length > 0 
            ? fees.map(f => ({ idLama: f.person, ongkos: f.ongkos }))
            : [{ idLama: '', ongkos: 0 }];

          const existingCashflows = await pb.collection('cashflow').getFullList({ filter: `ref_baru = "${menuItem.id}"` });
          const cfNote = existingCashflows.length > 0 ? existingCashflows[0].note : '';

          // Muat cashflowList dari database
          let cashflowList = [];
          if (existingCashflows.length > 0) {
            cashflowList = existingCashflows.map(cf => ({
              accountId: cf.account_1,
              nominal: cf.nominal
            }));
          } else {
            cashflowList = [{ accountId: '', nominal: 0 }];
          }

          // Mapping payment dari database ke nilai tombol UI
          // Database: "cash" / "tempo" → UI: "Tunai" / "Tempo"
          let paymentValue = 'Tunai';
          if (menuItem.payment && menuItem.payment.toLowerCase() === 'tempo') {
            paymentValue = 'Tempo';
          } else if (menuItem.payment && menuItem.payment.toLowerCase() === 'cash') {
            paymentValue = 'Tunai';
          }

          // Ambil file-file lama dari server (konversi ke Blob)
          const oldFiles: File[] = [];
          if (menuItem.file && menuItem.file.length > 0) {
            for (const fileName of menuItem.file) {
              try {
                const fileUrl = pb.files.getUrl(menuItem, fileName);
                // TAMBAHKAN HEADER NGROK DI SINI
                const response = await fetch(fileUrl, {
                  headers: { 'ngrok-skip-browser-warning': '69420' }
                });
                const blob = await response.blob();
                // Buat File object dengan nama asli
                const file = new File([blob], fileName, { type: blob.type });
                oldFiles.push(file);
              } catch (err) {
                console.warn(`Gagal mengambil file ${fileName}:`, err);
              }
            }
          }
          setMenuFiles(oldFiles);
          setExistingMenuFiles(oldFiles); // optional, untuk reference

          setFormBayar(prev => ({ 
          ...prev, 
          personIdLama: menuItem.person, 
          payment: paymentValue,
          noteMenu: menuItem.text,
          note: cfNote, // 🟢 Hanya tarik cashflow note
          tempoDate: menuItem.tempo || '', // 🟢 Tarik data tempo masuk ke kalender
          marketplace: menuItem.marketplace || '',
          adminFee: menuItem.admin || 0,
          cashback: menuItem.cashback || 0,
          mekanikList: loadedMekanik,
          cashflowList: cashflowList,
          createdAt: menuItem.created_at ? getLocalDatetimeInput(menuItem.created_at) : getLocalDatetimeInput() // 🟢 Waktu lama akan dikonversi akurat ke lokal
        }));
          
          // Satu kali panggil set state sudah cukup
          setEditSession({ isEditing: true, menuId: menuItem.id, createdAt: menuItem.created_at });
          setEditOldItems(logs.map((l: any) => ({ item_baru: l.item_baru, qty: l.qty, boolean: l.boolean })));
          setShowDetailHistory(null); // Tutup modal
          window.scrollTo(0, 0);
        } catch (e) { 
          setDialog({ show: true, title: 'Error Rincian', message: 'Gagal mengambil rincian data transaksi lama.', type: 'alert' });
        }
      }
    });
  };

  // Fungsi pembungkus untuk konfirmasi aksi
  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setDialog({ show: true, title, message, type: 'confirm', onConfirm: () => { onConfirm(); setDialog(prev => ({ ...prev, show: false })); } });
  };

  const handlePrint = () => {
    // Hitung total ongkos dari history
    const totalOngkosHistory = historyOngkos.reduce((sum, o) => sum + o.ongkos, 0);
    const grandTotalHistory = totalTransaksi + totalOngkosHistory;
    
    // Mapping ongkos ke nama mekanik
    const mechanicsForPrint = historyOngkos.map(ong => {
      const mech = mechanics.find(m => m.username === ong.person);
      return { name: mech?.name || ong.person, ongkos: ong.ongkos };
    });

    setShowReceiptPrint({
      id: showDetailHistory?.id,
      timestamp: showDetailHistory?.created_at,
      customer: allPersons.find(p => p.id_lama === showDetailHistory?.person)?.text_1 || 'Umum',
      items: historyItems.map(h => ({ ...h.expand?.item_baru, qty: h.qty, priceSelected: h.price_1 })),
      total: grandTotalHistory,
      cash: grandTotalHistory,
      change: 0,
      payment: showDetailHistory?.payment,
      jenis: showDetailHistory?.jenis,
      mechanics: mechanicsForPrint
    });
  };

  // Helper khusus Hapus Transaksi & Revert Stok, Cashflow, Ongkos, Bon, serta Trigger API Webhook
  const deleteTransactionWithRevert = async (menuId: string) => {
    if (!menuId) return;

    const deletedOk = await notifyLaravelApi('menu', 'deleted', menuId);

    try {
      // 2. Fetch seluruh log_stock terkait transaksi ini
      const logStockList = await pb.collection('log_stock').getFullList({
        filter: `ref = "${menuId}" || ref_baru = "${menuId}"`,
        $autoCancel: false
      }).catch(() => []);

      for (const log of logStockList) {
        if (!deletedOk) console.warn('Laravel menu delete notify failed, deleting log_stock in PB only');
        await pb.collection('log_stock').delete(log.id).catch(() => null);
      }

      // 3. Fetch dan hapus seluruh cashflow terkait transaksi ini
      const cashflowList = await pb.collection('cashflow').getFullList({
        filter: `ref_baru = "${menuId}"`,
        $autoCancel: false
      }).catch(() => []);

      for (const cf of cashflowList) {
        if (!deletedOk) console.warn('Laravel menu delete notify failed, deleting cashflow in PB only');
        await pb.collection('cashflow').delete(cf.id).catch(() => null);
      }

      // 4. Fetch dan hapus seluruh ongkos mekanik terkait
      const ongkosList = await pb.collection('ongkos').getFullList({
        filter: `ref_baru = "${menuId}" || ref = "${menuId}"`,
        $autoCancel: false
      }).catch(() => []);

      for (const ong of ongkosList) {
        // ponytail: ongkos cascade delete&revert handled by MenuObserver@deleting
        await pb.collection('ongkos').delete(ong.id).catch(() => null);
      }

      // 5. Fetch dan hapus seluruh slip gaji / bon jika ada
      const gajiList = await pb.collection('gaji').getFullList({
        filter: `ref = "${menuId}" || ref_baru = "${menuId}"`,
        $autoCancel: false
      }).catch(() => []);

      for (const g of gajiList) {
        const gajiOk = await notifyLaravelApi('gaji', 'deleted', g.id);
        if (!gajiOk) console.warn('Laravel gaji delete notify failed, record deleted from PB only');
        await pb.collection('gaji').delete(g.id).catch(() => null);
      }

      const bonList = await pb.collection('bon').getFullList({
        filter: `ref = "${menuId}" || ref_menu = "${menuId}"`,
        $autoCancel: false
      }).catch(() => []);

      for (const b of bonList) {
        const bonOk = await notifyLaravelApi('bon', 'deleted', b.id);
        if (!bonOk) console.warn('Laravel bon delete notify failed, record deleted from PB only');
        await pb.collection('bon').delete(b.id).catch(() => null);
      }
    } catch (err) {
      console.warn("Notice: Cleanup child records fallback:", err);
    }

    // 6. Hapus entitas menu utama di PocketBase
    await pb.collection('menu').delete(menuId).catch(e => console.warn('Menu delete failed (may already be deleted by Laravel):', e.message));
  };

  const handleDeleteHistory = async (menuItem: HistoryMenu) => {
    if (isDeleting) return; // guard double-call
    setIsDeleting(true);

    // Blokir refresh / navigasi selama proses hapus berjalan
    const blockUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', blockUnload);

    try {
      setIsProcessing(true);
      await deleteTransactionWithRevert(menuItem.id);
      fetchData();
      setShowDetailHistory(null);
      setDialog({ show: true, title: 'Sukses Hapus', message: 'Data transaksi berhasil dihapus. Stok produk dan data kas telah dikembalikan.', type: 'alert' });
    } catch (e: any) {
      console.error(e);
      setDialog({ show: true, title: 'Gagal Hapus', message: 'Gagal menghapus data transaksi: ' + (e.message || e), type: 'alert' });
    } finally {
      window.removeEventListener('beforeunload', blockUnload);
      setIsDeleting(false);
      setIsProcessing(false);
    }
  };

  // --- 9. MEMO GROUPING ---
  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryMenu[]> = {};
    historyMenu.forEach(h => {
      const date = h.created_at ? new Date(h.created_at).toLocaleDateString('id-ID') : 'Unknown';
      if (!groups[date]) groups[date] = [];
      groups[date].push(h);
    });
    return groups;
  }, [historyMenu]);

  const groupedGaji = useMemo(() => {
    const groups: Record<string, Gaji[]> = {};
    historyGaji.forEach(g => {
      const date = g.created_at ? new Date(g.created_at).toLocaleDateString('id-ID') : 'Unknown';
      if (!groups[date]) groups[date] = [];
      groups[date].push(g);
    });
    return groups;
  }, [historyGaji]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* --- PANEL KIRI (Utama) --- */}
      <div className="flex-1 flex flex-col p-3 md:p-6 lg:p-8 pt-20 md:pt-6 overflow-hidden w-full transition-colors duration-500">
         
        {/* Nav Tabs */}
        <div
          className={`shrink-0 transition-all duration-300 ${
            showNavbar ? 'opacity-100 max-h-24 mb-6' : 'opacity-0 max-h-0 mb-0 overflow-hidden'
          }`}
        >
          <div className="flex p-1.5 bg-slate-200/60 rounded-2xl w-full sm:w-fit shadow-sm border border-slate-200/50 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 sm:gap-2 px-1">
              {menuOptions.filter(m => userLevel !== '10' || m.text_1.toLowerCase() === 'overview').map(m => {
                const tabTheme = getThemeConfig(m.text_1);
                const isActive = selectedMenu === m.text_1;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMenuChange(m.text_1)}
                    className={`flex-1 sm:w-40 py-2.5 px-4 text-[10px] md:text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? `${tabTheme.main} text-white shadow-md shadow-${tabTheme.main.replace('bg-', '')}/30 scale-95`
                        : `text-slate-500 hover:text-slate-700 hover:bg-white/50`
                    }`}
                  >
                    {m.text_1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search Bar & Filters - Clean & Consistent */}
        <div className="p-2 sm:p-3 md:p-4 mb-2 sm:mb-3 bg-slate-200/60 rounded-2xl border border-slate-200/50 shadow-sm shrink-0 flex flex-col gap-1 sm:gap-2 md:gap-3">
          
          {/* BARIS UTAMA: Search + Filter Button + Indikator */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Input Pencarian */}
            <div className="relative w-full group flex-1 min-w-[180px]">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${activeTheme.text} opacity-50 group-focus-within:opacity-100`} size={18} />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder={`Cari ${selectedMenu}... (F2 / /)`} 
                className={`w-full pl-10 pr-4 py-2.5 bg-white/90 border-2 border-transparent hover:border-slate-300 rounded-xl focus:bg-white focus:border-transparent focus:ring-4 ${activeTheme.focusRing} outline-none transition-all shadow-sm text-sm font-bold text-slate-700 placeholder-slate-400`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Grup Tombol & Indikator (sejajar dengan search) */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tombol Toggle View (Desktop & Tablet) - hanya jika bukan Overview */}
              {selectedMenu.toLowerCase() !== 'overview' && (
                <div className="hidden sm:flex bg-white/80 border border-slate-200 rounded-xl p-1 shadow-sm shrink-0 items-center">
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? `${activeTheme.main} text-white shadow-sm` : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                    <List size={16} />
                  </button>
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid' ? `${activeTheme.main} text-white shadow-sm` : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                    <Grid size={16} />
                  </button>
                </div>
              )}

              {/* Tombol Filter & Indikator (hanya untuk Overview) */}
              {selectedMenu === 'Overview' && (
                <>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 bg-white/90 border border-slate-200 hover:border-slate-300 hover:bg-white shadow-sm"
                  >
                    <Filter size={14} />
                    Filter
                    {(() => {
                      const totalActive = (filterStatus !== 'all' ? 1 : 0) + (filterPerson ? 1 : 0) + (selectedMenuFilters.length > 0 ? 1 : 0);
                      return totalActive > 0 ? (
                        <span className="ml-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                          {totalActive}
                        </span>
                      ) : null;
                    })()}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Indikator Filter Person (muncul jika ada person terpilih) */}
                  {filterPerson && (
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1 shrink-0">
                      <User size={12} />
                      {allPersons.find(p => p.id_lama === filterPerson)?.text_1 || filterPerson}
                      <button
                        onClick={() => {
                          setFilterPerson('');
                          setFilterStatus('all');
                          const url = new URL(window.location.href);
                          url.searchParams.delete('person');
                          url.searchParams.delete('status');
                          window.history.replaceState({}, '', url.toString());
                        }}
                        className="ml-0.5 text-blue-400 hover:text-blue-600"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Area Filter (collapsible) - hanya untuk Overview */}
          {selectedMenu === 'Overview' && (
            <div
              className={`overflow-visible transition-all duration-300 ease-in-out ${
                showFilters ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 md:gap-3 p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm">
          
                {/* === GRUP FILTER STATUS === */}
                <div className="flex flex-wrap items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                  {['all', 'lunas', 'belum'].map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status);
                        setPage(1);
                        const url = new URL(window.location.href);
                        if (status === 'all') {
                          url.searchParams.delete('status');
                        } else {
                          url.searchParams.set('status', status);
                        }
                        if (filterPerson) url.searchParams.set('person', filterPerson);
                        window.history.replaceState({}, '', url.toString());
                      }}
                      className={`px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                        filterStatus === status
                          ? `${activeTheme.main} text-white shadow-sm scale-95`
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {status === 'all' ? 'Semua' : status}
                    </button>
                  ))}
                </div>

                {/* Pemisah (hanya tampil di desktop) */}
                <div className="hidden md:block w-px h-6 bg-slate-300/50"></div>

                {/* === GRUP FILTER PERSON === */}
                <div className="relative" style={{ zIndex: 9999 }}>
                  <button
                    ref={personButtonRef}
                    onClick={() => {
                      if (!isPersonFilterOpen && personButtonRef.current) {
                        const rect = personButtonRef.current.getBoundingClientRect();
                        setDropdownPosition({
                          top: rect.bottom + window.scrollY,
                          left: rect.left + window.scrollX,
                        });
                      }
                      setIsPersonFilterOpen(!isPersonFilterOpen);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 bg-white border border-slate-200 hover:border-slate-300 shadow-sm ${
                      filterPerson ? `${activeTheme.main} text-white border-transparent shadow-md` : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <User size={13} />
                    <span className="truncate max-w-[70px] md:max-w-[100px]">
                      {filterPerson
                        ? allPersons.find(p => p.id_lama === filterPerson)?.text_1 || 'Person'
                        : 'Person'}
                    </span>
                    {filterPerson && (
                      <X
                        size={13}
                        className="ml-0.5 cursor-pointer hover:text-white/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterPerson('');
                          setFilterStatus('all');
                          const url = new URL(window.location.href);
                          url.searchParams.delete('person');
                          url.searchParams.delete('status');
                          window.history.replaceState({}, '', url.toString());
                        }}
                      />
                    )}
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-200 ${isPersonFilterOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown Person (Portal) */}
                  {isPersonFilterOpen && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setIsPersonFilterOpen(false)} />
                      <div 
                        className="fixed z-[9999] w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 max-h-72 overflow-y-auto custom-scrollbar"
                        style={{
                          top: dropdownPosition.top + 8,
                          left: dropdownPosition.left,
                        }}
                      >
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Cari customer / supplier..."
                            className="w-full pl-8 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                            value={personFilterSearch}
                            onChange={(e) => setPersonFilterSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="mt-2 space-y-1">
                          {allPersons
                            .filter(p =>
                              (p.jenis?.toLowerCase().includes('customer') || p.jenis?.toLowerCase().includes('supplier')) &&
                              (p.text_1.toLowerCase().includes(personFilterSearch.toLowerCase()) ||
                                (p.text_2 && p.text_2.toLowerCase().includes(personFilterSearch.toLowerCase())))
                            )
                            .map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setFilterPerson(p.id_lama);
                                  setIsPersonFilterOpen(false);
                                  setPersonFilterSearch('');
                                  const currentStatus = filterStatus === 'all' ? 'belum' : filterStatus;
                                  const url = new URL(window.location.href);
                                  url.searchParams.set('person', p.id_lama);
                                  url.searchParams.set('status', currentStatus);
                                  window.history.replaceState({}, '', url.toString());
                                }}
                                className={`px-3 py-2.5 rounded-xl cursor-pointer hover:bg-blue-50 text-xs font-bold flex justify-between items-center transition-colors ${
                                  filterPerson === p.id_lama ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                                }`}
                              >
                                <span className="truncate">
                                  {p.text_1} {p.text_2 ? `- ${p.text_2}` : ''}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {p.jenis}
                                </span>
                              </div>
                            ))}
                          {allPersons.filter(p => p.jenis?.toLowerCase().includes('customer') || p.jenis?.toLowerCase().includes('supplier')).length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500">Tidak ada data</div>
                          )}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Pemisah (hanya tampil di desktop) */}
                <div className="hidden md:block w-px h-6 bg-slate-300/50"></div>

                {/* === GRUP FILTER JENIS MENU === */}
                <div className="flex flex-wrap items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                  <button
                    onClick={() => {
                      setSelectedMenuFilters([]);
                      setPage(1);
                      const url = new URL(window.location.href);
                      url.searchParams.delete('jenis');
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className={`px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                      selectedMenuFilters.length === 0
                        ? `${activeTheme.main} text-white shadow-sm scale-95`
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Semua Jenis
                  </button>
                  {menuOptions
                    .filter(m => m.text_1 !== 'Overview')
                    .map(menu => (
                      <button
                        key={menu.id}
                        onClick={() => {
                          const newFilters = selectedMenuFilters.includes(menu.text_1)
                            ? selectedMenuFilters.filter(j => j !== menu.text_1)
                            : [...selectedMenuFilters, menu.text_1];
                          setSelectedMenuFilters(newFilters);
                          setPage(1);
                          const url = new URL(window.location.href);
                          if (newFilters.length > 0) {
                            url.searchParams.set('jenis', newFilters.join(','));
                          } else {
                            url.searchParams.delete('jenis');
                          }
                          window.history.replaceState({}, '', url.toString());
                        }}
                        className={`px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                          selectedMenuFilters.includes(menu.text_1)
                            ? `${activeTheme.main} text-white shadow-sm scale-95`
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {menu.text_1}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Dynamic - Wrapper */}
        <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10 transition-colors duration-500 rounded-3xl`}>
        {loading ? ( 
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className={`w-16 h-16 border-4 border-slate-200 border-t-transparent ${activeTheme.text.replace('text-', 'border-t-')} rounded-full animate-spin`} />
            <p className={`font-black uppercase tracking-widest text-xs ${activeTheme.text} animate-pulse`}>Memuat Data...</p>
          </div> 
        ) : (
        
        <>
        {/* ===== INDIKATOR FILTER PERSON (CUSTOMER/SUPPLIER) ===== */}
        {selectedMenu === 'Overview' && showFilters && 
          (filterStatus !== 'all' || filterPerson || selectedMenuFilters.length > 0) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-blue-700">
              <Filter size={18} className="text-blue-500" />
              <span className="whitespace-nowrap">Filter aktif:</span>
              
              {filterStatus !== 'all' && (
                <span className="bg-blue-100 px-3 py-1 rounded-lg text-blue-800">
                  Status: {filterStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                </span>
              )}
              
              {filterPerson && (
                <span className="bg-blue-100 px-3 py-1 rounded-lg text-blue-800 max-w-[200px] sm:max-w-xs truncate flex items-center gap-1">
                  <User size={14} />
                  {(() => {
                    const person = allPersons.find(p => p.id_lama === filterPerson);
                    return person ? `${person.text_1} ${person.text_2 ? '- ' + person.text_2 : ''}` : filterPerson;
                  })()}
                </span>
              )}
              
              {selectedMenuFilters.length > 0 && (
                <span className="bg-blue-100 px-3 py-1 rounded-lg text-blue-800">
                  Jenis: {selectedMenuFilters.join(', ')}
                </span>
              )}
            </div>
            
            <button
              onClick={() => {
                setFilterPerson('');
                setFilterStatus('all');
                setSelectedMenuFilters([]);
                const url = new URL(window.location.href);
                url.searchParams.delete('person');
                url.searchParams.delete('status');
                window.history.replaceState({}, '', url.toString());
              }}
              className="px-4 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-black text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1 shrink-0"
            >
              <X size={14} /> Reset Semua Filter
            </button>
          </div>
        )}
            <div className="space-y-10">
                
              {/* 1. LIST PRODUK (PENJUALAN/SERVICE/PEMBELIAN) */} 
              {selectedMenu && 
              selectedMenu.toLowerCase() !== 'overview' && 
              !selectedMenu.toLowerCase().includes('gaji') && 
              products && products.length > 0 && (
                <div className={
                  viewMode === 'grid' 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 will-change-transform" 
                    : "flex flex-col gap-4 will-change-transform"
                }>
                  {products.map(p => ( 
                    <div key={p.id} onClick={() => addToCart && addToCart(p)} 
                      className={`bg-white rounded-3xl border-2 border-transparent hover:${activeTheme.border} shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${
                        viewMode === 'grid' ? 'flex flex-col justify-between h-72 p-6' : 'flex flex-row items-center justify-between p-4 min-h-[120px]'
                      }`}> 
                      
                      {/* Decorative Background Blob */}
                      <div className={`absolute -top-12 -right-12 w-40 h-40 ${activeTheme.light} rounded-full blur-sm md:blur-3xl opacity-20 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none`} />
                      
                      <div className={`relative z-10 ${viewMode === 'list' ? 'flex-1 pr-6' : ''}`}> 
                        <div className={`flex items-start mb-4 ${viewMode === 'grid' ? 'justify-between' : 'gap-4'}`}> 
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl tracking-tighter">
                            #{formatIdLamaDisplay ? formatIdLamaDisplay(p.id_lama) : p.id_lama}
                          </span>
                          <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm ${p.stok_3 > 5 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'}`}> 
                            SISA: {p.stok_3} {p.unit} 
                          </div> 
                        </div> 
                        <h3 className={`font-black text-slate-800 text-sm md:text-base uppercase leading-snug ${activeTheme.groupHoverText} line-clamp-2 md:line-clamp-3 tracking-tight transition-colors`}>
                          {typeof getFullLabel === 'function' ? getFullLabel(p) : `${p.nama || p.kategori} ${p.merk || ''}`}
                        </h3>
                      </div> 
                      
                      <div className={`flex justify-between items-center ${activeTheme.light} rounded-2xl group-hover:${activeTheme.main} transition-all duration-300 relative z-10 ${
                        viewMode === 'grid' ? 'p-4 mt-4' : 'p-3 px-5 min-w-[200px]'
                      }`}> 
                        <p className={`font-black ${activeTheme.text} group-hover:text-white text-base md:text-lg tracking-tighter transition-colors`}>
                          Rp {(p.sell_6 || 0).toLocaleString('id-ID')}
                        </p> 
                        <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center ${activeTheme.text} shadow-sm group-hover:scale-110 transition-transform`}>
                          <Plus size={20} strokeWidth={3}/>
                        </div> 
                      </div>
                    </div> 
                  ))}
                </div>
              )}

              {/* Jika produk kosong dan menu bukan overview/gaji */}
              {selectedMenu && 
              selectedMenu.toLowerCase() !== 'overview' && 
              !selectedMenu.toLowerCase().includes('gaji') && 
              (!products || products.length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Package size={32} className="text-slate-400" />
                  </div>
                  <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Tidak ada produk</span>
                </div>
              )}

              {/* LIST OVERVIEW */} 
              {selectedMenu && selectedMenu.toLowerCase() === 'overview' && groupedHistory && Object.keys(groupedHistory).length > 0 && (
                Object.entries(groupedHistory).map(([date, items]) => ( 
                  <div key={date} className="space-y-6"> 
                    <div className="flex items-center gap-4 px-2"> 
                      <div className={`w-2 h-2 rounded-full ${activeTheme.main}`} />
                      <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{date}</span> 
                      <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-200 to-transparent rounded-full" /> 
                    </div> 
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> 
                      {items.map(h => ( 
                        <div key={h.id} onClick={() => loadHistorySubDetails && loadHistorySubDetails(h)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 transition-all cursor-pointer group h-auto min-h-[15rem] flex flex-col justify-between relative overflow-hidden">
                          
                          {/* Glow effect based on status */}
                          <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${h.status === 'lunas' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                          <div className="flex justify-between items-start relative z-10"> 
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${typeof getJenisColor === 'function' ? getJenisColor(h.jenis) : 'bg-gray-100 text-gray-700'}`}>
                                {h.jenis}
                              </span>
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm ${
                                h.status === 'lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {h.status === 'lunas' ? 'LUNAS' : 'BELUM'}
                              </span>
                            </div>
                            <div className={`p-2 rounded-xl transition-colors ${activeTheme.light} ${activeTheme.text} opacity-50 group-hover:opacity-100`}><History size={16} strokeWidth={2.5} /></div> 
                          </div> 
                          
                          <div className="relative z-10 mt-4"> 
                            <h4 className="font-black text-slate-800 text-lg uppercase leading-tight mb-2 truncate group-hover:text-blue-600 transition-colors">
                              {(() => {
                                const person = allPersons && allPersons.find(p => p.id_lama === h.person);
                                return person ? `${person.text_1} - ${person.text_2 || ''}` : (h.person || 'PELANGGAN UMUM');
                              })()}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Operator: {h.operator || '-'}
                            </div>
                            <p className="text-xs font-bold text-slate-500 line-clamp-2 italic mt-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">"{h.text || 'Tanpa deskripsi nota.'}"</p> 
                          </div> 
                          
                          <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-4 relative z-10"> 
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5"><Calendar size={12} /> {formatLocalDateTime ? formatLocalDateTime(h.created_at) : h.created_at}</span>
                              {h.status === 'lunas' ? (
                                <span className="text-xs font-black text-emerald-600">Total: Rp {(h.total || 0).toLocaleString('id-ID')}</span>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-500 line-through">Rp {(h.total || 0).toLocaleString('id-ID')}</span>
                                  <span className="text-xs font-black text-rose-600">Terbayar: Rp {(h.dibayar || 0).toLocaleString('id-ID')}</span>
                                </div>
                              )}
                            </div>
                            <div className={`font-black text-white ${activeTheme.main} shadow-md shadow-${activeTheme.main.replace('bg-', '')}/30 px-3 py-1.5 rounded-xl text-xs`}>
                              {h.qty} Item
                            </div> 
                          </div>
                        </div>
                      ))} 
                    </div> 
                  </div> 
                ))
              )}

              {/* Jika overview kosong */}
              {selectedMenu && selectedMenu.toLowerCase() === 'overview' && (!groupedHistory || Object.keys(groupedHistory).length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar size={32} className="text-slate-400" />
                  </div>
                  <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Belum ada riwayat transaksi</span>
                </div>
              )}

              {/* LIST GAJI & BANNER PEMBUATAN GAJI */}
              {selectedMenu && selectedMenu.toLowerCase().includes('gaji') && (
                <div className="space-y-6">
                  {/* TOP ACTION BANNER UNTUK BUAT SLIP GAJI */}
                  <div className="p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <CreditCard size={24} className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">Kelola Slip Gaji Karyawan</h3>
                        <p className="text-xs text-emerald-200/80">Buat slip gaji baru, tetapkan periode & rincian penambahan/pengurangan gaji.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsGajiFormOpen(true)}
                      className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0"
                    >
                      <Plus size={18} /> Buat Slip Gaji Baru
                    </button>
                  </div>

                  {groupedHistory && Object.keys(groupedHistory).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                      <Calendar size={32} className="text-teal-500" />
                    </div>
                    <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Belum ada data slip gaji</span>
                  </div>
                ) : (
                  Object.entries(groupedHistory || {}).map(([date, items]) => (
                    <div key={date} className="space-y-6">
                      <div className="flex items-center gap-4 px-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-sm" />
                        <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{date}</span>
                        <div className="h-[2px] flex-1 bg-gradient-to-r from-teal-100 to-transparent rounded-full" />
                      </div>
                      <div className={
                        viewMode === 'grid' 
                          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 will-change-transform" 
                          : "flex flex-col gap-4 will-change-transform"
                      }>
                        {(items || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(item => (
                          <div key={item.id} onClick={() => loadHistorySubDetails && loadHistorySubDetails(item)}
                            className={`bg-white rounded-3xl border-2 border-teal-100/60 hover:border-teal-400 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${
                              viewMode === 'grid' ? 'flex flex-col justify-between min-h-[240px] p-6' : 'flex flex-row items-center justify-between p-4 min-h-[100px]'
                            }`}>
                            
                            {/* Decorative Background Blob */}
                            <div className="absolute -top-12 -right-12 w-40 h-40 bg-teal-50 rounded-full blur-3xl opacity-20 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

                            <div className={`relative z-10 ${viewMode === 'list' ? 'flex-1 pr-6' : ''}`}>
                              <div className={`flex items-start mb-3 ${viewMode === 'grid' ? 'justify-between' : 'gap-4 mb-2'}`}>
                                <span className="text-[10px] font-black bg-teal-50 text-teal-600 border border-teal-100 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                                  SLIP GAJI
                                </span>
                                <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                  Op: {item.operator || '-'}
                                </span>
                              </div>
                              
                              <h3 className="font-black text-slate-800 text-base md:text-lg uppercase leading-snug group-hover:text-teal-600 transition-colors line-clamp-1">
                                {item.text || 'Gaji Karyawan'}
                              </h3>
                              <div className="mt-2 space-y-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                  Penerima Gaji ({(item.person || '').split(',').filter(Boolean).length} Person):
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {(item.person || 'Karyawan').split(',').map((pName, pIdx) => {
                                    const trimmed = pName.trim();
                                    if (!trimmed) return null;
                                    return (
                                      <span key={pIdx} className="text-[10px] font-extrabold text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                                        👤 {trimmed}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mt-3">
                                <Calendar size={12} /> {formatLocalDateTime ? formatLocalDateTime(item.created_at) : item.created_at}
                              </span>
                            </div>

                            <div className={`flex justify-between items-center bg-teal-50/80 rounded-2xl group-hover:bg-teal-500 transition-all duration-300 relative z-10 ${
                              viewMode === 'grid' ? 'p-3.5 px-4 mt-4' : 'p-3 px-5 min-w-[200px]'
                            }`}>
                              <div>
                                <span className="text-[9px] font-black text-teal-600 group-hover:text-teal-100 uppercase tracking-widest block">Total Bersih</span>
                                <p className="font-black text-teal-700 group-hover:text-white text-base md:text-lg tracking-tight transition-colors">
                                  Rp {(item.total || 0).toLocaleString('id-ID')}
                                </p>
                              </div>
                              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-teal-600 shadow-sm group-hover:scale-110 transition-transform">
                                <History size={16} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                </div>
              )}
            </div>
          </>
          )}
        </div>

        {/* Pagination - Glassmorphism */}
        <div className="mt-auto flex justify-between items-center bg-white/80 backdrop-blur-md p-2 md:p-2 rounded-3xl border border-gray-100 shadow-lg shrink-0"> 
          <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 md:ml-6">Hal {page} / {totalPages}</p> 
          <div className="flex gap-2 md:gap-3"> 
            <button onClick={() => setPage(p => Math.max(1, p-1))} className={`p-3 md:p-4 bg-slate-50 rounded-2xl hover:${activeTheme.light} hover:${activeTheme.text} transition-colors border border-transparent hover:border-gray-200`}><ChevronLeft size={20}/></button> 
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} className={`p-3 md:p-4 bg-slate-50 rounded-2xl hover:${activeTheme.light} hover:${activeTheme.text} transition-colors border border-transparent hover:border-gray-200`}><ChevronRight size={20}/></button> 
          </div> 
        </div>
      </div>

      {/* ===== FLOATING BUTTON (DITUKAR GAJI JIKA MENU GAJI AKTIF) ===== */}
      {!selectedMenu.toLowerCase().includes('gaji') ? (
        <button 
          onClick={() => setIsCartModalOpen(true)}
          className={`fixed bottom-24 right-6 md:bottom-30 md:right-10 z-50 p-4 md:p-5 ${activeTheme.main} text-white rounded-full shadow-2xl shadow-${activeTheme.main.replace('bg-', '')}/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-white`}
        >
          <div className="relative">
            <ShoppingCart size={28} />
            {totalQtyKeranjang > 0 && (
              <span className="absolute -top-3 -right-4 bg-rose-500 text-white text-[11px] font-black min-w-[24px] h-6 px-1 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-lg">
                {totalQtyKeranjang}
              </span>
            )}
          </div>
        </button>
      ) : (
        <button 
          onClick={() => setIsGajiFormOpen(true)}
          className="fixed bottom-24 right-6 md:bottom-30 md:right-10 z-50 px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full shadow-2xl shadow-emerald-600/50 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white font-black text-xs uppercase tracking-wider"
        >
          <Plus size={22} />
          <span className="hidden sm:inline">Buat Slip Gaji</span>
        </button>
      )}

      {/* ===== MODAL KERANJANG (POPUP) – DYNAMIC THEME ===== */}
      <Modal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        title="Keranjang Belanja"
      >
        <div className="flex flex-col max-h-[75vh] md:max-h-[85vh] bg-white">
          {cart.length === 0 && !selectedMenu.toLowerCase().includes('service') ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
              <div className={`w-28 h-28 ${activeTheme.light} rounded-full flex items-center justify-center shadow-inner border border-white`}>
                <ShoppingCart size={56} className={`${activeTheme.text} opacity-80`} />
              </div>
              <div>
                <h3 className={`text-xl font-black ${activeTheme.text} uppercase tracking-widest`}>Keranjang Kosong</h3>
                <p className="text-sm text-slate-400 mt-2 font-medium px-8">Silakan pilih item dari katalog produk yang tersedia.</p>
              </div>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className={`mt-6 px-10 py-3.5 ${activeTheme.main} text-white rounded-2xl font-black text-sm shadow-xl shadow-${activeTheme.main.replace('bg-','')}/30 hover:-translate-y-1 hover:brightness-110 transition-all active:scale-95 uppercase tracking-wider`}
              >
                Tutup Panel
              </button>
            </div>
          ) : (
            <>
              {/* DAFTAR ITEM – DYNAMIC COLOR */}
              <div className="space-y-4 overflow-y-auto pr-2 mt-2 custom-scrollbar">
                {cart.length === 0 && selectedMenu.toLowerCase().includes('service') && (
                  <div className="text-center py-8 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    Tidak ada sparepart/item fisik. Hanya mencatat nota jasa service.
                  </div>
                )}
                {cartWithTierPrice.map(item => {
                  const canEditPrice =
                    userLevel === '1' ||
                    isOnlinePerson ||
                    selectedMenu.toLowerCase().includes('pembelian');
                  return (
                    <div key={item.id} className={`bg-slate-50/70 hover:bg-white border ${activeTheme.border} rounded-2xl p-3 sm:p-3.5 relative group transition-all shadow-sm`}>
                      
                      {/* BARIS UTAMA: ID, NAMA PRODUK, TIER, TOMBOL HAPUS */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`font-black ${activeTheme.text} bg-white px-2 py-0.5 rounded-md text-[10px] tracking-tight border border-slate-200 shadow-2xs`}>
                              #{formatIdLamaDisplay(item.id_lama)}
                            </span>
                            {item.isTiered && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${activeTheme.light} ${activeTheme.text} border border-slate-200/50`}>
                                {item.activeTierName}
                              </span>
                            )}
                            {item.priceSelected !== item.sell_6 && !selectedMenu.toLowerCase().includes('pembelian') && (
                              <span className="text-[10px] text-slate-400 line-through font-bold">
                                Rp {item.sell_6.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                          <p className="font-black text-slate-800 text-xs md:text-sm line-clamp-1 leading-snug">
                            {getFullLabel(item)}
                          </p>
                        </div>

                        <button
                          onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                          className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 -mr-1 -mt-1"
                          title="Hapus dari keranjang"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* BARIS KONTROL: QTY & HARGA SATUAN & SUBTOTAL */}
                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-200/50 gap-2">
                        
                        {/* QTY COUNTER COMPACT */}
                        <div className={`flex items-center border ${activeTheme.border} rounded-xl bg-white overflow-hidden shadow-2xs shrink-0`}>
                          <button
                            onClick={() => updateQty(item.id, -1, item.stok_3)}
                            className={`w-7 h-7 flex items-center justify-center text-slate-600 hover:${activeTheme.text} hover:${activeTheme.light} active:scale-95 transition-all text-base font-bold`}
                            aria-label="Kurangi jumlah"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              updateQty(item.id, val - item.qty, item.stok_3);
                            }}
                            className={`w-10 text-center text-xs font-black ${activeTheme.text} bg-transparent outline-none p-0 border-none focus:ring-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            min="1"
                            max={item.stok_3}
                          />
                          <button
                            onClick={() => updateQty(item.id, 1, item.stok_3)}
                            className={`w-7 h-7 flex items-center justify-center text-slate-600 hover:${activeTheme.text} hover:${activeTheme.light} active:scale-95 transition-all text-base font-bold`}
                            aria-label="Tambah jumlah"
                          >
                            +
                          </button>
                        </div>

                        {/* HARGA @ DAN SUBTOTAL */}
                        <div className="flex items-center justify-end gap-2 text-right">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold shrink-0">@</span>
                            {canEditPrice ? (
                              <div className="relative inline-block w-24 sm:w-28">
                                <input
                                  type="number"
                                  className={`w-full py-1 pl-6 pr-2 text-right text-xs font-black text-slate-700 bg-white border ${activeTheme.border} rounded-lg ${activeTheme.focusRing} outline-none transition-all [&::-webkit-inner-spin-button]:appearance-none`}
                                  value={item.manualPrice !== undefined ? item.manualPrice : item.priceSelected}
                                  onChange={e => updatePrice(item.id, Number(e.target.value))}
                                  placeholder="0"
                                />
                                <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black ${activeTheme.text}`}>
                                  Rp
                                </span>
                              </div>
                            ) : (
                              <span className={`text-xs font-bold ${activeTheme.text} px-1 truncate max-w-[90px]`}>
                                {item.priceSelected.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>

                          <div className={`text-xs md:text-sm font-black text-white ${activeTheme.main} px-3 py-1.5 rounded-lg shadow-sm text-right min-w-[90px]`}>
                            Rp {(item.qty * item.priceSelected).toLocaleString('id-ID')}
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>

              {/* FORM PEMBAYARAN – DYNAMIC COLOR */}
              <div className="mt-6 border-t-2 border-slate-100 pt-6">
                
                {/* TOGGLE MUNCULKAN DETAIL MENU */}
                <button
                  onClick={() => setIsPaymentFormOpen(!isPaymentFormOpen)}
                  className={`w-full flex justify-between items-center px-5 py-4 mb-4 rounded-2xl border-2 ${activeTheme.border} bg-white hover:${activeTheme.light} transition-all shadow-sm group`}
                >
                  <span className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-widest flex items-center gap-2.5`}>
                    <Receipt size={18} className="group-hover:scale-110 transition-transform"/> 
                    {isPaymentFormOpen ? 'Sembunyikan Detail Menu' : 'Munculkan Detail Menu'}
                  </span>
                  <div className={`p-1 rounded-full ${activeTheme.light} ${activeTheme.text}`}>
                    {isPaymentFormOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {/* PEMBUNGKUS KONTEN YANG DILIPAT */}
                {isPaymentFormOpen && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                

                {/* 🆕 Tanggal Transaksi */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
                      <Calendar size={14} /> Waktu Transaksi
                    </label>
                    <input
                      type="datetime-local"
                      value={formBayar.createdAt}
                      onChange={e => setFormBayar({ ...formBayar, createdAt: e.target.value })}
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-bold text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
                    />
                  </div>
                </div>

                
                {/* 1. Pelanggan & Bayar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><Users size={14}/> Pelanggan</label>
                    
                    {/* 🟢 Custom Searchable Dropdown */}
                    <div className="relative mt-2">
                      <div 
                        onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)}
                        className={`w-full p-3 text-xs md:text-sm font-bold text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl cursor-pointer flex justify-between items-center shadow-sm hover:border-slate-300 transition-colors`}
                      >
                        <span className="truncate">
                          {personOptions.find(p => p.id_lama === formBayar.personIdLama)?.text_1 || 'Pilih Pelanggan...'}
                        </span>
                        {isPersonDropdownOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>

                      {isPersonDropdownOpen && (
                        <>
                          {/* Overlay gaib untuk menutup dropdown jika diklik di luar area */}
                          <div className="fixed inset-0 z-40" onClick={() => setIsPersonDropdownOpen(false)}></div>
                          
                          <div className={`absolute z-50 w-full mt-1 bg-white border-2 ${activeTheme.border} rounded-xl shadow-2xl overflow-hidden flex flex-col`}>
                            {/* Area Input Pencarian */}
                            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                              <Search size={14} className="text-slate-400" />
                              <input 
                                type="text"
                                autoFocus
                                placeholder="Cari nama pelanggan..."
                                className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 placeholder-slate-400"
                                value={personSearch}
                                onChange={e => setPersonSearch(e.target.value)}
                              />
                            </div>
                            
                            {/* Area List Pelanggan Terfilter */}
                            <div className="max-h-48 overflow-y-auto custom-scrollbar bg-white">
                              {personOptions.filter(p => p.text_1.toLowerCase().includes(personSearch.toLowerCase()) || p.id_lama.toLowerCase().includes(personSearch.toLowerCase())).length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 font-bold">Pelanggan tidak ditemukan</div>
                              ) : (
                                personOptions
                                  .filter(p => p.text_1.toLowerCase().includes(personSearch.toLowerCase()) || p.id_lama.toLowerCase().includes(personSearch.toLowerCase()))
                                  .map(p => (
                                    <div 
                                      key={p.id}
                                      onClick={() => {
                                        setFormBayar({ ...formBayar, personIdLama: p.id_lama });
                                        setIsPersonDropdownOpen(false);
                                        setPersonSearch(''); // Bersihkan kolom pencarian setelah dipilih
                                      }}
                                      className={`p-3 text-xs md:text-sm font-bold cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${formBayar.personIdLama === p.id_lama ? `${activeTheme.light} ${activeTheme.text}` : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                      <span className="truncate">{p.text_1}</span>
                                      <span className="text-[9px] text-slate-400 font-mono tracking-widest">{p.id_lama}</span>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><CreditCard size={14}/> Tipe Bayar</label>
                    <div className={`flex bg-white rounded-xl p-1.5 mt-2 border-2 ${activeTheme.border} shadow-sm gap-1`}>
                      {['Tunai', 'Tempo'].map(m => (
                        <button
                          key={m}
                          onClick={() => setFormBayar({ ...formBayar, payment: m })}
                          className={`flex-1 py-2 text-[10px] md:text-[11px] font-black rounded-lg transition-all duration-300 ${
                            formBayar.payment === m 
                              ? `${activeTheme.main} text-white shadow-md transform scale-100` 
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {m === 'Tunai' ? 'CASH' : 'TEMPO'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>



                {/* 2. Multi Cashflow / Akun Kas */}
                <div className={`${activeTheme.light} p-5 rounded-3xl border-2 ${activeTheme.border} space-y-4 shadow-sm`}>
                  <div className="flex justify-between items-center">
                    <label className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-wider flex items-center gap-2`}>
                      <Wallet size={16} /> Akun Kas & Nominal
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormBayar(prev => ({
                        ...prev,
                        cashflowList: [...prev.cashflowList, { accountId: '', nominal: 0 }]
                      }))}
                      className={`text-[10px] font-black bg-white ${activeTheme.text} px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border}`}
                    >
                      + Tambah Kas
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                  {formBayar.cashflowList.map((cf, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-white p-2.5 rounded-2xl border border-white/50 shadow-sm">
                    {/* Tombol Hapus Baris Kas */}
                    {formBayar.cashflowList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormBayar(prev => ({
                            ...prev,
                            cashflowList: prev.cashflowList.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors self-end sm:self-auto order-1 sm:order-none"
                        title="Hapus baris pembayaran"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                      <select
                        value={cf.accountId}
                        onChange={e => {
                          const newList = [...formBayar.cashflowList];
                          newList[idx].accountId = e.target.value;
                          setFormBayar({ ...formBayar, cashflowList: newList });
                        }}
                        className="flex-1 p-3 text-xs md:text-sm font-bold text-slate-700 border-none bg-slate-50 hover:bg-slate-100 rounded-xl outline-none cursor-pointer w-full"
                      >
                        <option value="">Pilih Akun Bank/Tunai...</option>
                        {cashflowAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.text_1}</option>
                        ))}
                      </select>
                      <div className="relative w-full sm:w-auto flex items-center gap-1.5">
                        <div className="relative flex-1 sm:w-40">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black ${activeTheme.text}`}>Rp</span>
                          <input
                            type="number"
                            placeholder="Nominal Pembayaran"
                            value={cf.nominal || ''}
                            onChange={e => {
                              const newList = [...formBayar.cashflowList];
                              newList[idx].nominal = Number(e.target.value);
                              setFormBayar({ ...formBayar, cashflowList: newList });
                            }}
                            className="w-full pl-9 pr-3 py-3 text-xs md:text-sm font-black text-slate-800 border-none bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const kasirAcc = cashflowAccounts.find(a => a.text_1.toLowerCase().includes('kasir') || a.text_1.toLowerCase().includes('cash')) || cashflowAccounts[0];
                            const newList = [...formBayar.cashflowList];
                            newList[idx].nominal = grandTotal;
                            if (kasirAcc) {
                              newList[idx].accountId = kasirAcc.id;
                            }
                            setFormBayar(prev => ({
                              ...prev,
                              payment: 'Tunai',
                              nominalBayar: grandTotal,
                              cashflowList: newList
                            }));
                          }}
                          className="px-3.5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow-md shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-1.5"
                          title="Auto Lunas (Isi Uang Pas & Akun Kas Kasir)"
                        >
                          <Zap size={15} fill="currentColor" /> Uang Pas (Auto Lunas)
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-black/5">
                    <span className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase`}>Total Dibayar:</span>
                    <span className="text-base md:text-lg font-black text-slate-800 bg-white px-4 py-1.5 rounded-xl shadow-sm border border-slate-100">
                      Rp {formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* 3. Jatuh Tempo */}
                {formBayar.payment === 'Tempo' && (
                  <div className="animate-in fade-in zoom-in duration-300 bg-rose-50 p-4 rounded-3xl border-2 border-rose-200 shadow-inner">
                    <label className="text-[10px] md:text-[11px] font-black text-rose-500 uppercase tracking-wider ml-1 flex items-center gap-1.5"><Calendar size={14}/> Tanggal Jatuh Tempo</label>
                    <input
                      type="date"
                      value={formBayar.tempoDate} // 🟢 Menggunakan state tempoDate
                      onChange={e => setFormBayar({ ...formBayar, tempoDate: e.target.value })}
                      className="w-full mt-2 p-3 text-sm font-bold text-slate-700 bg-white border-2 border-rose-100 rounded-xl focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-sm"
                    />
                  </div>
                )}

                {/* 4. Marketplace Online */}
                {isOnlinePerson && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50 p-5 rounded-3xl border-2 border-amber-200 shadow-sm animate-in fade-in">
                    <div>
                      <label className="text-[10px] font-black text-amber-600 uppercase ml-1 flex items-center gap-1.5"><ShoppingBag size={12}/> Platform</label>
                      <input
                        list="marketplaceOptions"
                        placeholder="Shopee/Tokped"
                        value={formBayar.marketplace}
                        onChange={e => setFormBayar({ ...formBayar, marketplace: e.target.value })}
                        className="w-full mt-2 p-3 text-xs md:text-sm font-bold bg-white border-2 border-amber-100 focus:border-amber-400 rounded-xl outline-none shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-600 uppercase ml-1">Biaya Admin</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formBayar.adminFee}
                        onChange={e => setFormBayar({ ...formBayar, adminFee: Number(e.target.value) })}
                        className="w-full mt-2 p-3 text-xs md:text-sm font-bold bg-white border-2 border-amber-100 focus:border-amber-400 rounded-xl outline-none shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-600 uppercase ml-1">Cashback Potongan</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formBayar.cashback}
                        onChange={e => setFormBayar({ ...formBayar, cashback: Number(e.target.value) })}
                        className="w-full mt-2 p-3 text-xs md:text-sm font-bold bg-white border-2 border-amber-100 focus:border-amber-400 rounded-xl outline-none shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {/* 5. Mekanik (Khusus Service) */}
                {selectedMenu.toLowerCase().includes('service') && (
                  <div className={`${activeTheme.light} p-5 rounded-3xl border-2 ${activeTheme.border} space-y-4 shadow-sm`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-wider flex items-center gap-2`}>
                        <Wrench size={16}/> Alokasi Mekanik & Ongkos
                      </span>
                      <button
                        onClick={() => {
                          setFormBayar(prev => ({
                            ...prev,
                            mekanikList: [...prev.mekanikList, { idLama: '', ongkos: 0 }]
                          }));
                        }}
                        className={`text-[10px] font-black bg-white ${activeTheme.text} px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border}`}
                      >
                        + Tambah Mekanik
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                    {formBayar.mekanikList.map((mek, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-white p-2.5 rounded-2xl border border-white/50 shadow-sm">
                      {/* Tombol Hapus Baris Mekanik */}
                      {formBayar.mekanikList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormBayar(prev => ({
                              ...prev,
                              mekanikList: prev.mekanikList.filter((_, i) => i !== idx)
                            }));
                          }}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors self-end sm:self-auto order-1 sm:order-none"
                          title="Hapus mekanik"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                        <select
                          value={mek.idLama}
                          onChange={e => {
                            const selectedMekanik = e.target.value;
                            const isDuplicate = formBayar.mekanikList.some((m, i) => i !== idx && m.idLama === selectedMekanik);
                            if (selectedMekanik && isDuplicate) {
                              setDialog({ show: true, title: 'Mekanik Ganda', message: 'Mekanik sudah dipilih di baris lain!', type: 'alert' });
                              return;
                            }
                            const newList = [...formBayar.mekanikList];
                            newList[idx].idLama = selectedMekanik;
                            setFormBayar({ ...formBayar, mekanikList: newList });
                          }}
                          className="flex-1 p-3 text-xs md:text-sm font-bold text-slate-700 border-none bg-slate-50 hover:bg-slate-100 rounded-xl outline-none cursor-pointer w-full"
                        >
                          <option value="">Pilih Nama Mekanik...</option>
                          {mechanics.map(m => {
                            const isDisabled = formBayar.mekanikList.some((mekItem, i) => i !== idx && mekItem.idLama === m.username);
                            return (
                              <option key={m.id} value={m.username} disabled={isDisabled}>
                                {m.name}
                              </option>
                            );
                          })}
                        </select>
                        <div className="relative w-full sm:w-auto">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black ${activeTheme.text}`}>Rp</span>
                          <input
                            type="number"
                            placeholder="Ongkos Kerja"
                            value={mek.ongkos || ''}
                            onChange={e => {
                              const newList = [...formBayar.mekanikList];
                              newList[idx].ongkos = Number(e.target.value);
                              setFormBayar({ ...formBayar, mekanikList: newList });
                            }}
                            className="w-full sm:w-40 pl-9 pr-3 py-3 text-xs md:text-sm font-black text-slate-800 border-none bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* 6. Catatan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><FileText size={14}/> Note Menu</label>
                    <input
                      placeholder="Contoh: Garansi 1 Minggu..."
                      value={formBayar.noteMenu}
                      onChange={e => setFormBayar({ ...formBayar, noteMenu: e.target.value })}
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-bold text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
                    />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><EyeOff size={14}/> Note Cashflow</label>
                    <input
                      placeholder="Informasi kasir (tidak di-print)..."
                      value={formBayar.note}
                      onChange={e => setFormBayar({ ...formBayar, note: e.target.value })}
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-bold text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
                    />
                  </div>
                </div>

                {/* 6b. Upload File / Media Bukti */}
                <div className={`${activeTheme.light} p-5 rounded-3xl border-2 ${activeTheme.border} space-y-4 shadow-sm`}>
                  <div className="flex justify-between items-center">
                    <label className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-wider flex items-center gap-2`}>
                      <ImagePlus size={16} />
                      Lampiran Media / Bukti
                      {selectedMenu.toLowerCase().includes('pembelian') && (
                        <span className="text-rose-500 bg-rose-100 px-2 py-0.5 rounded text-[9px] ml-1">*Wajib</span>
                      )}
                    </label>

                    <label className={`cursor-pointer text-[10px] font-black bg-white ${activeTheme.text} px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border}`}>
                      + Upload File
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setMenuFiles(prev => [...prev, ...files]);
                          }
                          e.target.value = ''; // reset input agar bisa upload file sama lagi
                        }}
                      />
                    </label>
                  </div>

                  {/* Preview Area */}
                  {menuPreviewUrls.length === 0 && existingMenuFiles.length === 0 ? (
                    <div className={`text-center py-6 rounded-2xl border-2 border-dashed ${activeTheme.border} bg-white/50 backdrop-blur-sm`}>
                      <p className={`text-[11px] font-black ${activeTheme.text} opacity-60`}>
                        Belum ada file media yang dilampirkan
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {/* === FILE LAMA (saat Edit) === */}
                      {editSession?.isEditing && existingMenuFiles.map((file, idx) => (
                        <div key={`existing-${idx}`} className="relative group rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-md aspect-square bg-slate-100">
                          {isVideo(file.name) ? (
                            <video src={URL.createObjectURL(file)} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={URL.createObjectURL(file)} alt={`existing-${idx}`} className="w-full h-full object-cover" />
                          )}

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(URL.createObjectURL(file), '_blank')}
                              className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                              title="Lihat file"
                            >
                              <Eye size={16} />
                            </button>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2 text-white text-[9px] truncate font-bold">
                            {file.name} <span className="text-emerald-400">(lama)</span>
                          </div>
                        </div>
                      ))}

                      {/* === FILE BARU === */}
                      {menuPreviewUrls.map((url, idx) => (
                        <div key={`new-${idx}`} className="relative group rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                          {isVideo(menuFiles[idx]?.name) ? (
                            <video src={url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                          )}

                          {/* Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(url, '_blank')}
                              className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                              title="Lihat file di tab baru"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                // Hapus file baru
                                setMenuFiles(prev => prev.filter((_, i) => i !== idx));
                                // Revoke URL agar tidak memory leak
                                URL.revokeObjectURL(url);
                              }}
                              className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                              title="Hapus file"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Nama file */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2 text-white text-[9px] truncate font-bold">
                            {menuFiles[idx]?.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Info jumlah file baru */}
                  {menuFiles.length > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-black/5">
                      <span className={`text-[11px] font-black ${activeTheme.text}`}>
                        {menuFiles.length} file baru dilampirkan
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          menuPreviewUrls.forEach(url => URL.revokeObjectURL(url));
                          setMenuFiles([]);
                        }}
                        className="text-[10px] font-black text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Hapus Semua Baru
                      </button>
                    </div>
                  )}

                  {/* Tampilkan file lama (jika ada) saat edit */}
                  {existingMenuFiles.length > 0 && !editSession?.isEditing && (
                  <div className="mt-4 pt-2 border-t border-emerald-200">
                    <p className="text-[10px] font-black text-emerald-600 mb-2">📎 File yang sudah ada (akan dipertahankan):</p>
                    <div className="flex flex-wrap gap-2">
                      {existingMenuFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-xs shadow-sm">
                          <span className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-[8px]">📄</span>
                          <span className="truncate max-w-[150px]">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                  {menuFiles.length > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-black/5">
                      <span className={`text-[11px] font-black ${activeTheme.text}`}>{menuFiles.length} file telah dilampirkan</span>
                      <button
                        type="button"
                        onClick={() => setMenuFiles([])}
                        className="text-[10px] font-black text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Hapus Semua
                      </button>
                    </div>
                  )}
                </div>

                  </div> 
                )}

                {/* 7. Action Bawah (Grand Total & Checkout) */}
                <div className={`flex flex-col md:flex-row justify-between items-center px-6 py-5 mt-5 gap-4 rounded-3xl border border-slate-200 bg-slate-50 shadow-sm`}>
                  <div className="text-center md:text-left w-full md:w-auto">
                    <span className={`text-[10px] font-black ${activeTheme.text} uppercase tracking-widest block mb-0.5`}>
                      Total Tagihan Pembayaran
                    </span>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">
                      Rp {grandTotal.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    onClick={handleCheckoutValidation}
                    className={`w-full md:w-auto px-10 py-5 ${activeTheme.main} text-white rounded-2xl text-sm font-black shadow-xl shadow-${activeTheme.main.replace('bg-', '')}/40 hover:brightness-110 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all uppercase tracking-widest flex justify-center items-center gap-3`}
                  >
                    {isProcessing ? (processingMsg || 'Menyimpan...') : (editSession ? <><Save size={18}/> SIMPAN PERUBAHAN</> : <><CheckCircle2 size={18}/>CHECKOUT</>)}
                  </button>
                </div>

              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ========================================================= */} 
      {/* 1. MODAL OVERVIEW RE-CHECK SEBELUM EXECUTE STORING DATA */} 
      {/* ========================================================= */} 
      <Modal isOpen={showCheckoutReview} onClose={() => setShowCheckoutReview(false)} title="Konfirmasi & Finalisasi Checkout"> 
        <div className="space-y-6 max-h-[75vh] md:max-h-[80vh] overflow-y-auto pr-2 pb-6 custom-scrollbar"> 
          {/* Header Theme Sync */}
          <div className={`p-6 md:p-8 text-white rounded-[2rem] text-center ${editSession ? 'bg-blue-600 shadow-blue-500/30' : `${activeTheme.main} shadow-${activeTheme.main.replace('bg-','')}/30`} shadow-2xl relative overflow-hidden`}> 
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-20 pointer-events-none" />
            <p className="text-[11px] font-black uppercase tracking-widest text-white/80 relative z-10">{editSession ? 'Validasi Update Nota Terakhir' : 'Total Invoice Penjualan'}</p> 
            <p className="text-4xl md:text-4xl font-black mt-2 tracking-tight relative z-10">Rp {grandTotal.toLocaleString('id-ID')}</p> 
          </div> 

          {/* Rincian Field Koleksi yang akan di Entry */}
          <div className="flex flex-col gap-4 text-xs font-medium">
             {/* 1. KOLEKSI MENU */}
              <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 space-y-2.5 shadow-sm">
                <p className={`font-black text-[11px] ${activeTheme.text} uppercase border-b-2 border-slate-200 pb-3 mb-4 flex items-center gap-2`}>
                  <Layers size={16} /> Entitas: Tabel Data Induk Menu
                </p>
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Jenis:</span> <span className="font-black text-slate-700">{selectedMenu}</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Person:</span> <span className="font-bold text-slate-700">{formBayar.personIdLama}</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Tipe Bayar:</span> <span className="font-bold text-slate-700">{formBayar.payment}</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Total Qty:</span> <span className="font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded">{totalQtyKeranjang} Item</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Total Produk:</span> <span className="font-bold text-slate-700">Rp {totalBelanja.toLocaleString('id-ID')}</span></p>
                <p className="flex justify-between border-t border-dashed pt-2"><span className="text-slate-400 font-bold">Dana Masuk:</span> <span className="font-black text-emerald-600">Rp {formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0).toLocaleString('id-ID')}</span></p>
                
                {/* Status Nota dengan logika khusus pembelian */}
                  {(() => {
                    const totalDibayarCalc = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                    const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
                    const hasMedia = menuFiles.length > 0 || (editSession?.isEditing && existingMenuFiles.length > 0);
                    
                    let statusText = totalDibayarCalc >= grandTotal ? 'LUNAS' : 'BELUM LUNAS';
                    let statusClass = totalDibayarCalc >= grandTotal 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : 'bg-rose-50 border-rose-100 text-rose-700';

                    if (isPembelian && !hasMedia) {
                      statusText = 'BELUM (Menunggu Bukti Media)';
                      statusClass = 'bg-amber-50 border-amber-100 text-amber-700';
                    }

                    return (
                      <div className={`mt-4 p-3 rounded-xl border ${statusClass}`}>
                        <p className="flex justify-between text-[11px] uppercase tracking-widest font-black">
                          <span>Status Nota:</span>
                          <span>{statusText}</span>
                        </p>
                        {isPembelian && !hasMedia && (
                          <p className="text-[10px] text-amber-600 mt-1">Upload bukti nota agar bisa berstatus LUNAS</p>
                        )}
                      </div>
                    );
                  })()}
              </div>

             {/* 2. KOLEKSI CASHFLOW */}
             <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 space-y-2.5 shadow-sm flex flex-col">
                <p className={`font-black text-[11px] ${activeTheme.text} uppercase border-b-2 border-slate-200 pb-3 mb-4 flex items-center gap-2`}>
                  <Wallet size={16}/> Entitas: Mutasi Jurnal Kas
                </p>
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Nominal Transaksi:</span> <span className="font-black text-slate-800">Rp {grandTotal.toLocaleString('id-ID')}</span></p> 
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Jenis Mutasi:</span> <span className="font-black uppercase bg-slate-200 px-2 py-0.5 rounded text-slate-700">{(selectedMenu.toLowerCase().includes('penjualan') || selectedMenu.toLowerCase().includes('service')) ? 'Debet (Masuk)' : 'Kredit (Keluar)'}</span></p> 
                <p className="flex justify-between"><span className="text-slate-400 font-bold">Operator Kasir:</span> <span className="font-bold text-slate-700">{operatorName}</span></p> 
                
                {/* LIST MULTI CASHFLOW */}
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-2">Rincian Pembayaran (Multi-Akun):</p>
                  {formBayar.cashflowList.map((cf, idx) => {
                    if (!cf.accountId && cf.nominal === 0) return null;
                    const accName = cashflowAccounts.find(a => a.id === cf.accountId)?.text_1 || 'Akun Belum Dipilih';
                    return (
                      <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                        <span className="font-bold text-slate-600 text-[11px] truncate flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[9px]">#{idx + 1}</span> 
                          {accName}
                        </span>
                        <span className="font-black text-blue-600 text-[11px]">Rp {cf.nominal.toLocaleString('id-ID')}</span>
                      </div>
                    );
                  })}
                </div>

                {isOnlinePerson && (
                  <div className="mt-auto pt-4 border-t border-dashed">
                    <p className="font-black text-[10px] text-amber-500 uppercase mb-2">Detail Marketplace Online:</p>
                    <p className="flex justify-between"><span className="text-slate-400 font-bold">Platform:</span> <span className="font-bold text-slate-700">{formBayar.marketplace || '-'}</span></p>
                    <p className="flex justify-between"><span className="text-slate-400 font-bold">Potongan Admin:</span> <span className="font-bold text-rose-500">- Rp {formBayar.adminFee || 0}</span></p>
                    <p className="flex justify-between"><span className="text-slate-400 font-bold">Cashback:</span> <span className="font-bold text-emerald-500">+ Rp {formBayar.cashback || 0}</span></p>
                  </div>
                )}
             </div>

             {/* 3. KOLEKSI ONGKOS (Tampil Bersyarat) */}
             {selectedMenu.toLowerCase().includes('service') && formBayar.mekanikList.some(m => m.idLama && m.ongkos > 0) && (
               <div className={`${activeTheme.light} border-2 ${activeTheme.border} p-5 rounded-[1.5rem] col-span-1 md:col-span-2 shadow-sm`}>
                  <p className={`font-black text-[11px] ${activeTheme.text} uppercase border-b-2 border-black/10 pb-3 mb-4 flex items-center gap-2`}><Wrench size={16}/> Alokasi Ongkos Mekanik</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0).map((mek, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-white/50 shadow-sm relative overflow-hidden flex justify-between items-center">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${activeTheme.main}`} />
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Mekanik</p>
                          <p className={`font-black text-sm ${activeTheme.text}`}>{mek.idLama}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Ongkos</p>
                          <p className="font-black text-slate-800 text-sm">Rp {mek.ongkos.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>

          <div className="space-y-3"> 
            <p className={`text-[11px] font-black ${activeTheme.text} uppercase tracking-widest ml-1 flex items-center gap-2`}><ListOrdered size={16}/> Rincian Item (Log Stock)</p> 
            <div className="border-2 border-slate-200 rounded-[1.5rem] overflow-hidden divide-y divide-slate-100 text-xs bg-white shadow-sm"> 
              {cartWithTierPrice.map(item => ( 
                <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors"> 
                  <div className="flex-1 pr-4"> 
                    <p className="font-black text-slate-800 text-sm">{getFullLabel(item)}</p> 
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <p className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{item.qty} {item.unit} <span className="mx-1">x</span> Rp {item.priceSelected.toLocaleString('id-ID')}</p> 
                      {selectedMenu.toLowerCase() !== 'pembelian' && (
                      <p className="text-slate-400 font-bold border border-slate-200 px-2 py-0.5 rounded-md text-[10px]">Normal: Rp {(item.sell_6 * item.qty).toLocaleString('id-ID')}</p> 
                      )}
                      </div>
                  </div>
                  <p className="font-black text-slate-900 text-sm">Rp {(item.priceSelected * item.qty).toLocaleString('id-ID')}</p> 
                </div> 
              ))} 
            </div> 
          </div> 

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-slate-100"> 
            <button type="button" onClick={() => setShowCheckoutReview(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-slate-500 text-xs tracking-widest transition-colors">BATALKAN</button> 
            <button type="button" onClick={executeStoringData} disabled={isProcessing} className={`flex-[2] py-4 text-white rounded-2xl font-black text-sm shadow-xl tracking-widest transition-all active:scale-95 ${editSession ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : `${activeTheme.main} hover:brightness-110 shadow-${activeTheme.main.replace('bg-','')}/40`} ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}> 
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> {processingMsg || 'MENYIMPAN KE DATABASE...'}</span>
              ) : 'KONFIRMASI SIMPAN TRANSAKSI'} 
            </button> 
          </div> 
        </div> 
      </Modal>

      {/* Hidden printable thermal 58mm for detail transaction */}
      <div ref={detailPrintRef} className="hidden">
        {showDetailHistory && (
          <div style={{fontFamily:'monospace',fontSize:'11px',width:'280px',color:'#1e293b'}}>
            <div style={{textAlign:'center',borderBottom:'2px dashed #cbd5e1',padding:'12px 8px'}}>
              <h3 style={{fontWeight:900,fontSize:'14px',margin:'0 0 2px'}}>PRIMA MOTOR GLADAG</h3>
              <p style={{fontSize:'9px',margin:'1px 0'}}>Jl. Raya Gladag, Rogojampi</p>
              <p style={{fontSize:'9px',margin:'1px 0'}}>Banyuwangi - Jawa Timur</p>
              <p style={{fontSize:'10px',fontWeight:900,margin:'4px 0 0'}}>{showDetailHistory.jenis?.toUpperCase()}</p>
            </div>
            <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Nota:</span> <span>{showDetailHistory.ref || showDetailHistory.id}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Waktu:</span> <span>{formatLocalDateTime(showDetailHistory.created_at)}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Cust:</span> <span>{allPersons.find(p => p.id_lama === showDetailHistory.person)?.text_1 || showDetailHistory.person || 'Umum'}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Kasir:</span> <span>{showDetailHistory.operator || operatorName}</span></p>
            </div>
            {historyItems.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                {historyItems.map((item, i) => (
                  <div key={i} style={{marginBottom:'4px'}}>
                    <p style={{fontWeight:700,margin:'1px 0',fontSize:'10px',textTransform:'uppercase'}}>{getFullLabel(item.expand?.item_baru)}</p>
                    <p style={{margin:'1px 0',display:'flex',justifyContent:'space-between',color:'#475569'}}>
                      <span>{item.qty} x Rp {Number(item.price_1).toLocaleString('id-ID')}</span>
                      <b style={{color:'#1e293b'}}>Rp {Number(item.price_1 * item.qty).toLocaleString('id-ID')}</b>
                    </p>
                  </div>
                ))}
              </div>
            )}
            {historyCashflow.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                <p style={{fontWeight:900,fontSize:'9px',textAlign:'center',margin:'2px 0',color:'#64748b'}}>-- PEMBAYARAN --</p>
                {historyCashflow.map((cf, i) => (
                  <p key={i} style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}>
                    <span>{cf.mutasi === 'in' ? 'Masuk' : 'Keluar'} ({cashflowAccounts.find(a => a.id === cf.account_1)?.text_1 || 'Acc'})</span>
                    <b>Rp {Number(cf.nominal).toLocaleString('id-ID')}</b>
                  </p>
                ))}
              </div>
            )}
            {historyOngkos.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                <p style={{fontWeight:900,fontSize:'9px',textAlign:'center',margin:'2px 0',color:'#64748b'}}>-- BIAYA SERVIS --</p>
                {historyOngkos.map((o, i) => (
                  <p key={i} style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}>
                    <span>Mek: {o.person}</span>
                    <b>Rp {Number(o.ongkos).toLocaleString('id-ID')}</b>
                  </p>
                ))}
              </div>
            )}
            <div style={{padding:'8px',backgroundColor:'#f8fafc',borderBottom:'2px dashed #cbd5e1'}}>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between',fontSize:'12px',fontWeight:900}}>
                <span>TOTAL:</span><span>Rp {Number(showDetailHistory.total).toLocaleString('id-ID')}</span>
              </p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between',color:'#475569',fontSize:'10px'}}>
                <span>DIBAYAR:</span><span>Rp {Number(showDetailHistory.dibayar).toLocaleString('id-ID')}</span>
              </p>
            </div>
            <div style={{textAlign:'center',padding:'12px 8px'}}>
              <p style={{fontWeight:900,fontSize:'10px',margin:'2px 0'}}>TERIMA KASIH</p>
              <p style={{fontSize:'8px',color:'#64748b',margin:'2px 0'}}>Barang yang dibeli tidak dapat ditukar</p>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */} 
      {/* 2. MODAL DETAIL HISTORI TRANSAKSI BESERTA SUB-DETAILS */} 
      {/* ========================================================= */} 
      {/* ========================================================= */} 
      <Modal
        isOpen={!!showDetailHistory}
        onClose={() => setShowDetailHistory(null)}
        maxWidth="max-w-4xl"
        title={showDetailHistory?.jenis?.toLowerCase().includes('gaji') ? "Rincian Perangkum & Slip Gaji Karyawan" : "Rincian Histori & Log Finansial"}
      >
        {showDetailHistory && (
          <div className="flex flex-col h-full max-h-[80vh]">
            
            {/* TAB NAVIGASI (Hanya untuk transaksi barang/servis, sembunyikan untuk Gaji) */}
            {!showDetailHistory.jenis.toLowerCase().includes('gaji') && (
              <div className="shrink-0 px-6 pt-4 pb-2 border-b border-slate-200 bg-white">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setActiveTab('detail')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      activeTab === 'detail' 
                        ? `${activeTheme.main} text-white shadow-lg shadow-${activeTheme.main.replace('bg-','')}/30` 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Info size={14} /> Detail
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('items')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      activeTab === 'items' 
                        ? `${activeTheme.main} text-white shadow-lg shadow-${activeTheme.main.replace('bg-','')}/30` 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Box size={14} /> List Item ({historyItems.length})
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* KONTEN SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* ========== TAB DETAIL ========== */}
              {(activeTab === 'detail' || showDetailHistory.jenis.toLowerCase().includes('gaji')) && (
                <>
                  {/* Header besar (Rombak Khusus Gaji - Emerald/Teal Theme) */}
                  {showDetailHistory.jenis.toLowerCase().includes('gaji') ? (() => {
                    const sal = getSalaryDetails(showDetailHistory);
                    const grandTotalVal = showDetailHistory.total || sal.grandTotal;

                    return (
                      <div className="space-y-5">
                        {/* BANNER UTAMA HASIL PERANGKUM BATCH GAJI */}
                        <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 p-6 sm:p-8 rounded-[2rem] text-center text-white shadow-2xl relative overflow-hidden border border-emerald-500/30">
                          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 block">
                            PERANGKUM GAJI BATCH (TOTAL NETTO)
                          </span>
                          <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter drop-shadow-md">
                            {renderFormattedNetto(grandTotalVal, "text-3xl sm:text-4xl md:text-5xl", "text-emerald-300", "text-emerald-400")}
                          </div>
                          
                          <div className="mt-5 flex flex-col items-center gap-2">
                            <h4 className="font-black text-white text-base sm:text-lg uppercase tracking-wider bg-white/10 px-4 py-1.5 rounded-2xl backdrop-blur-md border border-white/10">
                              📋 {showDetailHistory.text || 'Gaji Periode'}
                            </h4>
                            <div className="flex flex-wrap justify-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-emerald-200 bg-emerald-950/60 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-500/30">
                                <User size={12}/> Opr: {showDetailHistory.operator || 'System'}
                              </span>
                              <span className="text-[10px] font-black text-emerald-200 bg-emerald-950/60 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-500/30">
                                <Calendar size={12}/> {formatLocalDateTime ? formatLocalDateTime(sal.date) : sal.date}
                              </span>
                              <span className="text-[10px] font-black text-amber-300 bg-amber-950/60 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-amber-500/30">
                                Qty: {showDetailHistory.qty || 1} Hari Kerja / Bulan
                              </span>
                            </div>

                            {/* DAFTAR PEGAWAI / KARYAWAN PENERIMA GAJI */}
                            <div className="mt-3 p-3.5 bg-emerald-950/80 rounded-2xl border border-emerald-500/40 max-w-2xl w-full">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-2 text-center">
                                👥 DAFTAR KARYAWAN PENERIMA GAJI ({(showDetailHistory.person || '').split(',').filter(Boolean).length} PERSON):
                              </span>
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {(showDetailHistory.person || '').split(',').map((pName, pIdx) => {
                                  const trimmed = pName.trim();
                                  if (!trimmed) return null;
                                  return (
                                    <span key={pIdx} className="text-xs font-black text-white bg-emerald-800/90 border border-emerald-400/60 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                                      <span>👤</span> {trimmed}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* LIST RINCIAN SLIP GAJI PER KARYAWAN */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Users size={16} className="text-emerald-600" /> Rincian Slip Gaji Karyawan ({historyGajiSubItems.length > 0 ? historyGajiSubItems.length : 1} Person)
                          </h4>

                          {historyGajiSubItems.length > 0 ? (
                            historyGajiSubItems.map((gRec, gIdx) => {
                              const gSal = getSalaryDetails({ ...gRec, qty: showDetailHistory.qty || gRec.qty });
                              return (
                                <div key={gRec.id || gIdx} className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-2xl space-y-4 shadow-sm transition-all">
                                  {/* Header Card Karyawan */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black">
                                        #{gIdx + 1}
                                      </span>
                                      <h5 className="font-extrabold text-slate-900 text-base uppercase">👤 {gRec.person}</h5>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500">Netto Slip:</span>
                                      {renderFormattedNetto(gSal.grandTotal, "text-base sm:text-lg", "text-emerald-700", "text-emerald-700")}
                                    </div>
                                    {gRec.diterima > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500">Diterima Karyawan:</span>
                                        <span className="text-base sm:text-lg font-black text-teal-600">
                                          Rp {Number(gRec.diterima).toLocaleString('id-ID')},00
                                        </span>
                                      </div>
                                    )}
                                    </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {/* Card 1: Pendapatan (+) */}
                                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-2">
                                      <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1.5">
                                        <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                                          <DollarSign size={13} className="text-emerald-600" /> 1. Pendapatan (+)
                                        </span>
                                        <span className="text-xs font-black text-emerald-700">
                                          Rp {gSal.total1.toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                      <div className="space-y-1 text-[11px]">
                                        <div className="flex justify-between text-slate-600"><span>Gaji Pokok:</span><strong className="text-slate-800">Rp {(gSal.t1.pokok || 0).toLocaleString('id-ID')}</strong></div>
                                        <div className="flex justify-between text-slate-600"><span>Tunjangan:</span><strong className="text-slate-800">Rp {(gSal.t1.tunjangan || 0).toLocaleString('id-ID')}</strong></div>
                                        {gSal.t1.bonus_1 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 1:</span><strong className="text-slate-800">Rp {gSal.t1.bonus_1.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t1.bonus_2 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 2:</span><strong className="text-slate-800">Rp {gSal.t1.bonus_2.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t1.bonus_3 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 3:</span><strong className="text-slate-800">Rp {gSal.t1.bonus_3.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t1.bonus_4 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 4:</span><strong className="text-slate-800">Rp {gSal.t1.bonus_4.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t1.program > 0 && <div className="flex justify-between text-slate-600"><span>Program:</span><strong className="text-slate-800">Rp {gSal.t1.program.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t1.lembur > 0 && <div className="flex justify-between text-slate-600"><span>Lembur:</span><strong className="text-slate-800">Rp {gSal.t1.lembur.toLocaleString('id-ID')}</strong></div>}
                                      </div>
                                    </div>

                                    {/* Card 2 & 3: Potongan (-) */}
                                    <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2">
                                      <div className="flex justify-between items-center border-b border-rose-200/60 pb-1.5">
                                        <span className="text-[11px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-1">
                                          <AlertCircle size={13} className="text-rose-600" /> 2 & 3. Potongan (-)
                                        </span>
                                        <span className="text-xs font-black text-rose-700">
                                          -Rp {(gSal.total2 + gSal.total3).toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                      <div className="space-y-1 text-[11px]">
                                        {gSal.t2.alfaPot > 0 && <div className="flex justify-between text-slate-600"><span>Alfa ({gRec.alfa} hr):</span><strong className="text-rose-700">-Rp {Math.round(gSal.t2.alfaPot).toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t2.setengahHariPot > 0 && <div className="flex justify-between text-slate-600"><span>1/2 Hari ({gRec.setengah_hari} hr):</span><strong className="text-rose-700">-Rp {Math.round(gSal.t2.setengahHariPot).toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t2.sakitPot > 0 && <div className="flex justify-between text-slate-600"><span>Sakit ({gRec.sakit} hr):</span><strong className="text-rose-700">-Rp {Math.round(gSal.t2.sakitPot).toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t2.telatPot > 0 && <div className="flex justify-between text-slate-600"><span>Telat ({gRec.telat} mnt):</span><strong className="text-rose-700">-Rp {Math.round(gSal.t2.telatPot).toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t3.bpjs > 0 && <div className="flex justify-between text-slate-600"><span>BPJS:</span><strong className="text-rose-700">-Rp {gSal.t3.bpjs.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t3.bon_dibayar > 0 && <div className="flex justify-between text-slate-600"><span>Bayar Bon:</span><strong className="text-rose-700">-Rp {gSal.t3.bon_dibayar.toLocaleString('id-ID')}</strong></div>}
                                        {gSal.t3.bon_diambil > 0 && <div className="flex justify-between text-slate-600"><span>Ambil Bon (Pinjaman):</span><strong className="text-amber-700">+Rp {gSal.t3.bon_diambil.toLocaleString('id-ID')}</strong></div>}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Catatan & Lampiran Bukti Transfer File */}
                                  {(gRec.note || (gRec.file && gRec.file.length > 0)) && (
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                      {gRec.note && (
                                        <div className="text-[11px] font-medium text-slate-700">
                                          <strong className="font-black text-slate-800 uppercase">📝 Catatan:</strong> {gRec.note}
                                        </div>
                                      )}
                                      {gRec.file && gRec.file.length > 0 && (
                                        <div className="space-y-1">
                                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                                            📎 Lampiran Bukti Transfer / File ({gRec.file.length}):
                                          </span>
                                          <div className="flex flex-wrap gap-2 pt-1">
                                            {gRec.file.map((fName: string, fIdx: number) => {
                                              const fileUrl = pb.files.getUrl(gRec, fName);
                                              const isImg = fName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                              return (
                                                <a
                                                  key={fIdx}
                                                  href={fileUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-lg text-xs text-indigo-600 font-bold transition-all shadow-2xs"
                                                >
                                                  {isImg ? (
                                                    <img src={fileUrl} alt={fName} className="w-8 h-8 object-cover rounded" />
                                                  ) : (
                                                    <FileText size={16} className="text-indigo-500" />
                                                  )}
                                                  <span className="truncate max-w-[120px] text-[10px]">{fName}</span>
                                                  <ExternalLink size={12} className="text-slate-400" />
                                                </a>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            /* Fallback untuk setiap karyawan yang terdaftar di string person */
                            <div className="space-y-3">
                              {(showDetailHistory.person || '').split(',').map((pName, pIdx) => {
                                const trimmed = pName.trim();
                                if (!trimmed) return null;
                                return (
                                  <div key={pIdx} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black">
                                        #{pIdx + 1}
                                      </span>
                                      <div>
                                        <h5 className="font-extrabold text-slate-900 text-sm uppercase">👤 {trimmed}</h5>
                                        <span className="text-[10px] text-slate-500 font-bold">Karyawan Penerima Gaji</span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">Status Slip</span>
                                      <span className="text-xs font-black text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-md">
                                        Tercatat di Batch Nota Gaji
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className={`p-6 md:p-8 rounded-[2rem] text-center text-white relative shadow-xl overflow-hidden ${getThemeConfig(showDetailHistory.jenis).main}`}>
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl opacity-20 pointer-events-none" />
                      <span className="text-[11px] font-black bg-black/20 px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md relative z-10">
                        {showDetailHistory.ref || `INV-${showDetailHistory.id}`}
                      </span>

                      <div className="mt-4 relative z-10">
                        <h4 className="font-black text-white text-3xl md:text-3xl uppercase leading-tight tracking-tight drop-shadow-sm">
                          {(() => {
                            const person = allPersons.find(p => p.id_lama === showDetailHistory.person);
                            return person ? `${person.text_1} - ${person.text_2 || ''}` : (showDetailHistory.person || 'PELANGGAN UMUM');
                          })()}
                        </h4>
                        <div className="mt-3 flex flex-col items-center gap-1">
                        <div className="inline-block bg-white/10 backdrop-blur-md border border-white/20 px-5 py-2 rounded-2xl">
                          <p className="text-sm font-black text-white/90 uppercase tracking-widest text-[10px]">Total Invoice</p>
                          <p className="text-2xl font-black text-white">Rp {(showDetailHistory?.total || 0).toLocaleString('id-ID')}</p>
                        </div>
                        <div className="inline-block bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-xl border border-white/10">
                          <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Dibayar</p>
                          <p className="text-sm font-black text-white">Rp {(showDetailHistory?.dibayar || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                      </div>

                      <div className="flex flex-wrap justify-center gap-3 mt-5 relative z-10">
                        <span className="text-[10px] font-black text-white/80 bg-black/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <User size={12}/> Kasir: {showDetailHistory.operator || 'System'}
                        </span>
                        <span className="text-[10px] font-black text-white/80 bg-black/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <Calendar size={12}/> {formatLocalDateTime(showDetailHistory.created_at)}
                        </span>
                      </div>
                    </div>
                  )}

                  {!showDetailHistory.jenis.toLowerCase().includes('gaji') && showDetailHistory.marketplace && (
                  <>
                    <div className="mt-4 p-3 bg-black/10 rounded-xl text-[10px] text-white/90 font-bold flex flex-wrap gap-4 justify-center relative z-10 border border-white/10">
                      <span className="flex items-center gap-1"><ShoppingBag size={12}/> {showDetailHistory.marketplace}</span>
                      <span className="text-rose-200">Admin: -Rp {showDetailHistory.admin}</span>
                      <span className="text-emerald-200">CB: +Rp {showDetailHistory.cashback}</span>
                    </div>

                    {userLevel === '1' && showDetailHistory.jenis?.toLowerCase() !== 'pembelian' && (
                      <div className="mt-6 pt-5 border-t border-white/20 flex justify-around relative z-10">
                        <div className="text-center bg-black/20 flex-1 rounded-l-xl p-2 border-r border-white/10">
                          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Laba Kotor</p>
                          <p className="font-black text-emerald-300 text-lg md:text-xl drop-shadow-sm mt-1">
                            Rp {totalLabaKotor.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="text-center bg-black/20 flex-1 rounded-r-xl p-2">
                          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Persentase Margin</p>
                          <p className="font-black text-white text-lg md:text-xl mt-1">
                            {(() => {
                              const totalOngkosHistory = historyOngkos.reduce((sum, o) => sum + o.ongkos, 0);
                              const menuGrandTotal = totalTransaksi + totalOngkosHistory - (showDetailHistory.admin || 0) + (showDetailHistory.cashback || 0);
                              const margin = menuGrandTotal > 0 ? ((totalLabaKotor / menuGrandTotal) * 100).toFixed(1) : 0;
                              return margin;
                            })()}%
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                  {!showDetailHistory.jenis.toLowerCase().includes('gaji') && (
                    <>
                      {/* SHORTCUT NAVIGASI KE BAGIAN BAWAH */}
                      <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 sticky top-0 z-10 backdrop-blur-sm bg-white/90">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 flex items-center">Lompat ke:</span>
                        <button 
                          onClick={() => document.getElementById('section-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="text-[10px] font-black px-3 py-1.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
                        >
                          📦 Item
                        </button>
                        <button 
                          onClick={() => document.getElementById('section-cashflow')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="text-[10px] font-black px-3 py-1.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
                        >
                          💰 Kas
                        </button>
                        {historyOngkos.length > 0 && (
                          <button 
                            onClick={() => document.getElementById('section-ongkos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="text-[10px] font-black px-3 py-1.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
                          >
                            🔧 Ongkos
                          </button>
                        )}
                        {showDetailHistory.file && showDetailHistory.file.length > 0 && (
                          <button 
                            onClick={() => document.getElementById('section-media')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="text-[10px] font-black px-3 py-1.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
                          >
                            🖼️ Media
                          </button>
                        )}
                      </div>

                      {/* SECTION: Rincian Item (dengan ID untuk navigasi) */}
                      <div id="section-items" className="scroll-mt-16">
                        <div className="space-y-3">
                          <p className={`text-[11px] font-black ${activeTheme.text} uppercase tracking-widest ml-1 flex items-center gap-2`}>
                            <Box size={16}/> Rincian Item (Log Stok Terjual)
                          </p>
                          <div className="border-2 border-slate-200 rounded-[1.5rem] bg-white divide-y divide-slate-100 text-xs shadow-sm overflow-hidden">
                            {historyItems.length === 0 ? (
                              <div className="p-8 text-center flex flex-col items-center">
                                <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-400 rounded-full animate-spin mb-3"></div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Menarik rincian database...</p>
                              </div>
                            ) : (
                              historyItems.map(item => (
                                <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                      <p className="font-black text-slate-800 text-sm md:text-base leading-snug">
                                        {getFullLabel(item.expand?.item_baru)}
                                      </p>
                                      <p className="text-[11px] font-bold text-slate-500 mt-1.5">
                                        Qty: {item.qty} @ Rp {item.price_1?.toLocaleString('id-ID')}
                                      </p>
                                    </div>
                                    <p className="font-black text-slate-900 text-sm bg-slate-100 px-3 py-1 rounded-lg shrink-0">
                                      Rp {(item.price_1 * item.qty)?.toLocaleString('id-ID')}
                                    </p>
                                  </div>
                                  {userLevel === '1' && (
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] md:text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-3 shadow-inner">
                                      <p className="flex justify-between"><span className="font-bold">ID:</span> <span className="font-mono text-slate-800">{item.id}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Kode:</span> <span className="font-mono text-slate-800">{item.item}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Qty:</span> <span className="font-black text-slate-800 bg-slate-200 px-1.5 rounded">{item.qty}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">In / Out:</span> <span className="font-black text-slate-800">{item.boolean}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Jual:</span> <span className="font-black text-slate-800">Rp {item.price_1?.toLocaleString('id-ID')}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Modal:</span> <span className="font-black text-slate-800">Rp {item.price_2?.toLocaleString('id-ID')}</span></p>
                                      {('1' === userLevel || '2' === userLevel || '5' === userLevel) && (
                                        <>
                                          <p className="flex justify-between col-span-2 border-t border-slate-200 pt-2 mt-1"><span className="font-bold">Stok Awal:</span> <span className="font-black text-emerald-700">{item.stok_awal ?? '-'}</span></p>
                                          <p className="flex justify-between col-span-2"><span className="font-bold">Stok Akhir:</span> <span className="font-black text-emerald-700">{item.stok_akhir ?? '-'}</span></p>
                                        </>
                                      )}
                                      {(() => {
      const logStockSemua = reportDetailData?.logStock || [];
      
      // Cari harga beli terakhir sebelum transaksi ini
      const logBeliTerakhir = logStockSemua
        .filter(l => l.boolean === 'in' && l.item_baru === item.item_baru && new Date(l.created_at || 0) < new Date(item.created_at || 0))
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

      const hargaLama = logBeliTerakhir ? logBeliTerakhir.price_1 : 0;
      const refJenis = item.expand?.ref_baru?.jenis || '';
      const isPembelian = refJenis.toLowerCase().includes('pembelian');
      
      let laba = 0;
      let pct = 0; // simpan sebagai angka dulu
      let isGreen = true;

      if (isPembelian) {
        laba = item.price_1 - hargaLama;
        // Hijau jika harga beli baru lebih murah/sama (laba naik), Merah jika harga beli naik (laba turun/beban naik)
        isGreen = hargaLama === 0 || item.price_1 <= hargaLama;
        pct = hargaLama > 0 ? (laba / hargaLama) * 100 : 0;
      } else {
        laba = (item.price_1 * item.qty) - item.price_2;
        const totalJual = (item.price_1 * item.qty);
        pct = totalJual > 0 ? (laba / totalJual) * 100 : 0;
        isGreen = laba >= 0;
      }

      // Format pct untuk tampilan
      const pctDisplay = Math.abs(pct).toFixed(1);

      return (
        <div className="col-span-2 border-t-2 border-dashed border-slate-200 pt-3 mt-2 flex justify-between items-center bg-white p-2 rounded-lg">
          <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">
            {isPembelian ? 'Analisis Perubahan Harga Beli:' : 'Laba Margin Analitik:'}
          </p>
          <p className={`font-black text-sm flex items-center gap-2 ${isGreen ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPembelian 
              ? (hargaLama > 0 ? (laba >= 0 ? `+Rp ${laba.toLocaleString('id-ID')}` : `Rp ${laba.toLocaleString('id-ID')}`) : 'Harga Awal')
              : `Rp ${laba.toLocaleString('id-ID')}`
            }
            
            {/* Indikator Persentase */}
            {(hargaLama > 0 || !isPembelian) && (
              <span className={`text-[10px] px-2 py-0.5 rounded-md shadow-sm border ${isGreen ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-rose-100 border-rose-200 text-rose-700'}`}>
                {pct >= 0 ? `+${pctDisplay}%` : `${pctDisplay}%`}
              </span>
            )}
          </p>
        </div>
      );
    })()}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* SECTION: Cashflow */}
                      <div id="section-cashflow" className="scroll-mt-16">
                        <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 blur-3xl opacity-5 rounded-full" />
                          <p className="font-black text-blue-500 text-[11px] uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-blue-100 pb-2 relative z-10">
                            <Wallet size={14}/> Rekaman Jurnal Kas
                          </p>
                          {historyCashflow.length > 0 ? (
                            <div className="space-y-3 relative z-10">
                              {historyCashflow.map((cf, idx) => {
                                const accName = cashflowAccounts.find(a => a.id === cf.account_1)?.text_1 || cf.account_1;
                                return (
                                  <div key={cf.id || idx} className="space-y-2 font-bold text-slate-600 text-[11px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <p className="flex justify-between"><span>Nominal:</span> <span className="font-black text-blue-600 text-sm">Rp {cf.nominal?.toLocaleString('id-ID')}</span></p>
                                    <p className="flex justify-between"><span>Mutasi:</span> <span className="uppercase text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{cf.mutasi}</span></p>
                                    <p className="flex justify-between items-center gap-2"><span>Account:</span> <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-right truncate">{accName}</span></p>
                                    {('1' === userLevel || '2' === userLevel || '5' === userLevel) && (cf.saldo_awal !== undefined || cf.saldo_akhir !== undefined) && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                        <p className="flex justify-between text-[10px]"><span className="font-bold text-emerald-700">Saldo Awal:</span> <span className="font-black">Rp {Number(cf.saldo_awal || 0).toLocaleString('id-ID')}</span></p>
                                        <p className="flex justify-between text-[10px]"><span className="font-bold text-emerald-700">Saldo Akhir:</span> <span className="font-black">Rp {Number(cf.saldo_akhir || 0).toLocaleString('id-ID')}</span></p>
                                      </div>
                                    )}
                                    {cf.note && (
                                      <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-500 italic font-medium leading-relaxed">
                                        " {cf.note} "
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic mt-2 text-[10px] relative z-10">Data jurnal kas tidak ditemukan atau sedang diselaraskan...</p>
                          )}
                        </div>
                      </div>

                      {/* SECTION: Ongkos Mekanik (hanya jika ada) */}
                      {historyOngkos.length > 0 && (
                        <div id="section-ongkos" className="scroll-mt-16">
                          <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 blur-3xl opacity-5 rounded-full" />
                            <p className="font-black text-amber-500 text-[11px] uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-amber-100 pb-2">
                              <Wrench size={14}/> Potongan Mekanik
                            </p>
                            <div className="space-y-2 font-bold text-slate-600 text-[11px]">
                              {historyOngkos.map(fee => (
                                <div key={fee.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                  <span className="font-black text-slate-700 uppercase flex items-center gap-2">
                                    <User size={12} className="text-slate-400"/> {fee.person}
                                  </span>
                                  <span className="font-black text-emerald-600 text-sm tracking-tight">Rp {fee.ongkos?.toLocaleString('id-ID')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SECTION: Lampiran Media */}
                      {showDetailHistory.file && showDetailHistory.file.length > 0 && (
                        <div id="section-media" className="scroll-mt-16">
                          <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                            <p className={`font-black text-[11px] ${activeTheme.text} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
                              <ImagePlus size={16}/> Lampiran Media Nota
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {showDetailHistory.file.map((f, i) => {
                                const fileUrl = pb.files.getUrl(showDetailHistory, f);
                                const blobUrl = fileBlobUrls[f];
                                if (!blobUrl) {
                                  fetchFileWithAuth(fileUrl).then(url => setFileBlobUrls(prev => ({ ...prev, [f]: url }))).catch(err => console.warn(`Gagal memuat file ${f}:`, err));
                                }
                                return (
                                  <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                                    {blobUrl ? (
                                      f.match(/\.(mp4|webm|ogg)$/i) ? (
                                        <video src={blobUrl} className="w-full h-full object-cover" />
                                      ) : (
                                        <img src={blobUrl} alt={`Lampiran ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                      )
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-slate-200 animate-pulse">
                                        <span className="text-xs text-slate-500">Loading...</span>
                                      </div>
                                    )}
                                    <a href={fileUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                      <ExternalLink size={24} className="text-white drop-shadow-lg scale-75 group-hover:scale-100 transition-transform" />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ========== TAB LIST ITEM ========== */}
              {activeTab === 'items' && (
                <div className="space-y-4">
                  {/* Filter / Search sederhana untuk list item */}
                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                    <Search size={16} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari produk di nota ini..."
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder-slate-400"
                      value={searchItemTerm}
                      onChange={(e) => setSearchItemTerm(e.target.value)}
                    />
                    {searchItemTerm && (
                      <button onClick={() => setSearchItemTerm('')} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    )}
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                      {filteredHistoryItems.length} / {historyItems.length}
                    </span>
                  </div>

                  {/* Daftar item yang sudah difilter */}
                  <div className="border-2 border-slate-200 rounded-[1.5rem] bg-white divide-y divide-slate-100 text-xs shadow-sm overflow-hidden">
                    {filteredHistoryItems.length === 0 ? (
                      <div className="p-8 text-center flex flex-col items-center">
                        <Box size={32} className="text-slate-300 mb-2" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                          {historyItems.length === 0 ? 'Tidak ada item' : 'Tidak ada item yang cocok'}
                        </p>
                      </div>
                    ) : (
                      filteredHistoryItems.map(item => (
                        <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="font-black text-slate-800 text-sm md:text-base leading-snug">
                                {getFullLabel(item.expand?.item_baru)}
                              </p>
                              <p className="text-[11px] font-bold text-slate-500 mt-1.5">
                                Qty: {item.qty} @ Rp {item.price_1?.toLocaleString('id-ID')}
                              </p>
                            </div>
                            <p className="font-black text-slate-900 text-sm bg-slate-100 px-3 py-1 rounded-lg shrink-0">
                              Rp {(item.price_1 * item.qty)?.toLocaleString('id-ID')}
                            </p>
                          </div>
                          {userLevel === '1' && (
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] md:text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-3 shadow-inner">
                              <p className="flex justify-between"><span className="font-bold">ID:</span> <span className="font-mono text-slate-800">{item.id}</span></p>
                              <p className="flex justify-between"><span className="font-bold">Kode:</span> <span className="font-mono text-slate-800">{item.item}</span></p>
                              <p className="flex justify-between"><span className="font-bold">Qty:</span> <span className="font-black text-slate-800 bg-slate-200 px-1.5 rounded">{item.qty}</span></p>
                              <p className="flex justify-between"><span className="font-bold">In / Out:</span> <span className="font-black text-slate-800">{item.boolean}</span></p>
                              <p className="flex justify-between"><span className="font-bold">Jual:</span> <span className="font-black text-slate-800">Rp {item.price_1?.toLocaleString('id-ID')}</span></p>
                              <p className="flex justify-between"><span className="font-bold">Modal:</span> <span className="font-black text-slate-800">Rp {item.price_2?.toLocaleString('id-ID')}</span></p>
                              {(() => {
                                const laba = (item.price_1 * item.qty) - item.price_2;
                                const totalJual = (item.price_1 * item.qty);
                                const pct = totalJual > 0 ? ((laba / totalJual) * 100).toFixed(1) : 0;
                                return (
                                  <div className="col-span-2 border-t-2 border-dashed border-slate-200 pt-3 mt-2 flex justify-between items-center bg-white p-2 rounded-lg">
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Laba Margin Analitik:</p>
                                    <p className="font-black text-emerald-600 text-sm flex items-center gap-2">
                                      Rp {laba.toLocaleString('id-ID')}
                                      <span className="text-[10px] bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-700 shadow-sm">+{pct}%</span>
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER TOMBOL - TETAP DI BAWAH (STICKY) */}
            <div className="shrink-0 px-6 py-4 border-t-2 border-slate-100 bg-white">
              <div className="flex flex-wrap gap-3 pb-1">
                {(() => {
                  const isStatusBelum = showDetailHistory?.status === 'belum';
                  const bolehDelete = (userLevel === '1' || userLevel === '5') || (isStatusBelum && ['1','2','3','4','5','6','7'].includes(userLevel));
                  return bolehDelete && (
                    <button
                      onClick={() => !isDeleting && confirmAction('Hapus Permanen', 'Peringatan: Menghapus nota ini akan mengembalikan seluruh stok barang dan menghapus jejak jurnal kas terkait. Lanjutkan?', () => handleDeleteHistory(showDetailHistory!))}
                      disabled={isDeleting}
                      className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-colors flex justify-center items-center gap-2 group ${
                        isDeleting
                          ? 'bg-rose-100 text-rose-400 border-rose-200 cursor-not-allowed opacity-70'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border-rose-100'
                      }`}
                      title={isDeleting ? 'Sedang menghapus...' : 'Hapus Nota'}
                    >
                      {isDeleting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <span className="text-[10px] font-black tracking-wider">MENGHAPUS...</span>
                        </>
                      ) : (
                        <Trash2 size={20} className="group-hover:scale-110 transition-transform"/>
                      )}
                    </button>
                  );
                })()}

                {['1','2','3','4','5','6','7'].includes(userLevel) && (
                  <button
                    onClick={() => {
                      if (isDeleting || !showDetailHistory) return;
                      // Untuk jenis gaji → buka form gaji dalam mode edit
                      if (showDetailHistory.jenis?.toLowerCase().includes('gaji')) {
                        handleEditGajiFromHistory(showDetailHistory);
                      } else {
                        handleEditHistoryToCart(showDetailHistory);
                      }
                    }}
                    disabled={isDeleting}
                    className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-colors flex justify-center items-center gap-1 group ${
                      isDeleting ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border-blue-100'
                    }`}
                    title={isDeleting ? 'Tunggu proses selesai' : (showDetailHistory?.jenis?.toLowerCase().includes('gaji') ? 'Edit Slip Gaji' : 'Revisi Nota')}
                  >
                    <Edit size={20} className="group-hover:scale-110 transition-transform"/>
                    {showDetailHistory?.jenis?.toLowerCase().includes('gaji') && (
                      <span className="text-[10px] font-black tracking-wide hidden sm:inline">EDIT</span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => !isDeleting && handleDetailPrintFn && handleDetailPrintFn()}
                  disabled={isDeleting}
                  className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-all flex justify-center items-center group ${
                    isDeleting ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-emerald-200 hover:border-emerald-600'
                  }`}
                  title={isDeleting ? 'Tunggu proses selesai' : 'Cetak Nota 58mm'}
                >
                  <Printer size={20} />
                </button>

                {showDetailHistory?.status === 'lunas' && (
                  <>
                    <button
                      onClick={() => {
                        if (isDeleting) return;
                        const detail = showDetailHistory;
                        if (!detail) return;
                        const items = historyItems.map(h => 
                          `${getFullLabel(h.expand?.item_baru)} | Qty: ${h.qty} @ ${Number(h.price_1).toLocaleString('id-ID')} = ${Number(h.price_1 * h.qty).toLocaleString('id-ID')}`
                        ).join('\n');
                        const text = `*${detail.jenis?.toUpperCase()}*\nID: ${detail.ref || detail.id}\n${formatLocalDateTime(detail.created_at)}\nPelanggan: ${allPersons.find(p => p.id_lama === detail.person)?.text_1 || detail.person || 'Umum'}\nTotal: Rp ${Number(detail.total).toLocaleString('id-ID')}\nDibayar: Rp ${Number(detail.dibayar).toLocaleString('id-ID')}\n\nItems:\n${items}`;
                        navigator.clipboard.writeText(text).then(() => {
                          setDialog({ show: true, title: 'Berhasil', message: 'Detail transaksi disalin ke clipboard!', type: 'alert' });
                        }).catch(() => alert('Gagal menyalin ke clipboard'));
                      }}
                      disabled={isDeleting}
                      className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-colors flex justify-center items-center group ${
                        isDeleting ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50' : 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border-amber-100'
                      }`}
                      title={isDeleting ? 'Tunggu proses selesai' : 'Share'}
                    >
                      <Share2 size={20} />
                    </button>
                  </>
                )}

                <button
                  onClick={() => !isDeleting && setShowDetailHistory(null)}
                  disabled={isDeleting}
                  className={`h-14 min-w-[6rem] flex-[2] rounded-2xl transition-colors flex items-center justify-center font-bold text-xs tracking-wider ${
                    isDeleting ? 'bg-slate-400 text-white cursor-not-allowed opacity-60' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isDeleting ? 'HARAP TUNGGU...' : 'TUTUP'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */} 
      {/* 3. LAYOUT TEMPLATE NOTA PRINTER THERMAL 58MM */} 
      {/* ========================================================= */} 
      <Modal isOpen={!!showReceiptPrint} onClose={() => setShowReceiptPrint(null)} title="Print Antrian Kasir"> 
        {showReceiptPrint && ( 
          <div className="space-y-6 flex flex-col items-center"> 
            
            <div className="bg-slate-100 p-4 w-full rounded-2xl flex justify-center items-center shadow-inner">
              {/* Box Putih simulasi kertas thermal */}
              <div ref={receiptRef} className="border-t-[8px] border-b-[8px] border-t-slate-800 border-b-white bg-white w-[280px] text-slate-900 font-mono text-xs shadow-xl rounded-sm" id="thermal-receipt-58mm"> 
                {/* HEADER TOKO */}
                <div className="text-center space-y-1.5 border-b-2 border-dashed border-slate-300 pb-4 pt-4 px-3"> 
                  <h4 className="font-black text-base tracking-wide">PRIMA MOTOR GLADAG</h4> 
                  <p className="text-[10px] font-bold">Jl. Raya Gladag, Rogojampi</p> 
                  <p className="text-[10px] font-bold">Banyuwangi - Jawa Timur</p> 
                  <p className="text-[10px] font-bold mt-1">WA: 081-XXXX-XXXX</p> 
                </div> 

                {/* INFORMASI NOTA */}
                <div className="py-3 px-3 border-b-2 border-dashed border-slate-300 text-[10px] space-y-1 font-bold">
                  <div className="flex justify-between"><span className="text-slate-500">Nota:</span> <span>{showReceiptPrint.id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Waktu:</span> <span>{formatLocalDateTime(showReceiptPrint.timestamp)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cust:</span> <span>{showReceiptPrint.customer}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Kasir:</span> <span>{operatorName}</span></div>
                  {showReceiptPrint.jenis && <div className="flex justify-between"><span className="text-slate-500">Jenis:</span> <span className="uppercase">{showReceiptPrint.jenis}</span></div>}
                </div>

                {/* DAFTAR ITEM PRODUK & MEKANIK */}
                <div className="py-3 px-3 border-b-2 border-dashed border-slate-300 text-[10px] space-y-3">
                  {/* Item Produk */}
                  {showReceiptPrint.items?.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-0.5">
                      <p className="font-bold uppercase break-words leading-tight">
                        {getFullLabel(item)}
                      </p>
                      <div className="flex justify-between text-slate-600 font-bold">
                        <span>{item.qty} {item.unit} x {item.priceSelected?.toLocaleString('id-ID')}</span>
                        <span className="text-slate-900 font-black">
                          {(item.priceSelected * item.qty)?.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Separator jika ada mekanik */}
                  {showReceiptPrint.mechanics && showReceiptPrint.mechanics.length > 0 && (
                    <div className="border-t border-slate-200 my-2 pt-2">
                      <p className="font-black text-center text-[9px] uppercase tracking-widest text-slate-500 mb-2">- BIAYA SERVIS JASA -</p>
                    </div>
                  )}

                  {/* Servis Mekanik */}
                  {showReceiptPrint.mechanics?.map((m: any, idx: number) => (
                    <div key={`mech-${idx}`} className="space-y-0.5">
                      <p className="font-bold uppercase">MEK: {m.name}</p>
                      <div className="flex justify-between text-slate-600 font-bold">
                        <span>1 Jasa x {m.ongkos.toLocaleString('id-ID')}</span>
                        <span className="text-slate-900 font-black">
                          {m.ongkos.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* TOTAL DAN PEMBAYARAN */}
                <div className="py-3 px-3 space-y-1.5 text-[10px] bg-slate-50 border-b-2 border-dashed border-slate-300">
                  <div className="flex justify-between font-black text-sm text-slate-900">
                    <span>TOTAL:</span>
                    <span>Rp {showReceiptPrint.total?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>DIBAYAR:</span>
                    <span>Rp {showReceiptPrint.cash?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>KEMBALI:</span>
                    <span>Rp {showReceiptPrint.change?.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="py-4 text-center space-y-1 bg-white">
                  <p className="font-black text-[10px]">TERIMA KASIH</p>
                  <p className="font-bold text-[9px] text-slate-500">Barang yang dibeli tidak dapat ditukar</p>
                </div>
              </div>
            </div>

            {/* TOMBOL CETAK, SHARE & BATAL */}
            <div className="flex flex-col sm:flex-row w-full gap-3 mt-2"> 
              <button 
                onClick={() => {
                  if (!showReceiptPrint?.id) return;
                  const items = (showReceiptPrint.items || []).map((i: any) => 
                    `${getFullLabel(i)} | Qty: ${i.qty} @ ${Number(i.priceSelected).toLocaleString('id-ID')} = ${Number(i.priceSelected * i.qty).toLocaleString('id-ID')}`
                  ).join('\n');
                  const text = `*NOTA ${showReceiptPrint.jenis?.toUpperCase() || ''}*\nID: ${showReceiptPrint.id}\n${formatLocalDateTime(showReceiptPrint.timestamp)}\nPelanggan: ${showReceiptPrint.customer}\nTotal: Rp ${Number(showReceiptPrint.total).toLocaleString('id-ID')}\nDibayar: Rp ${Number(showReceiptPrint.cash).toLocaleString('id-ID')}\n\nItems:\n${items}`;
                  navigator.clipboard.writeText(text).then(() => {
                    setDialog({ show: true, title: 'Berhasil', message: 'Detail nota disalin ke clipboard!', type: 'alert' });
                  }).catch(() => alert('Gagal menyalin ke clipboard'));
                }}
                className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-amber-500/30 hover:-translate-y-1 active:translate-y-0 transition-all tracking-widest flex justify-center items-center gap-2">
                <Share2 size={18}/> SHARE
              </button>
              <button 
                onClick={() => {
                  const receiptElement = document.getElementById('thermal-receipt-58mm');
                  if (receiptElement) {
                    printWithRawBT(receiptElement.outerHTML);
                  } else {
                    alert("Konten kertas nota gagal di-render oleh DOM.");
                  }
                }} 
                className={`flex-[2] py-4 ${activeTheme.main} text-white rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-${activeTheme.main.replace('bg-','')}/40 hover:-translate-y-1 hover:brightness-110 active:translate-y-0 transition-all tracking-widest flex justify-center items-center gap-2`}>
                <Printer size={18}/> PRINT
              </button>
              <button 
                onClick={() => {
                  setShowReceiptPrint(null);
                  setCart([]);
                  setIsPaymentFormOpen(false);
                  setFormBayar({
                    personIdLama: 'umum1',
                    payment: 'Tunai',
                    nominalBayar: 0,
                    cashflowList: [{ accountId: '', nominal: 0 }],
                    mekanikList: [{ idLama: '', ongkos: 0 }],
                    note: '',
                    noteMenu: '',
                    tempoDate: '',
                    marketplace: '',
                    adminFee: 0,
                    cashback: 0,
                    createdAt: getLocalDatetimeInput(),
                  });
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }} 
                className="flex-1 py-4 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs md:text-sm tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Zap size={16} fill="currentColor" /> TRANSAKSI BARU
              </button>
              <button onClick={() => setShowReceiptPrint(null)} 
                      className="flex-1 py-4 px-4 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-black rounded-2xl text-xs md:text-sm tracking-widest transition-colors">
                TUTUP
              </button>
            </div> 
          </div> 
        )} 
      </Modal>

      {/* DIALOG BOX POPUP ALERT / CONFIRMATION */} 
      <Modal isOpen={dialog.show} onClose={() => setDialog(prev => ({ ...prev, show: false }))} title={dialog.title}> 
        {/* Tentukan warna tema berdasarkan type dialog */}
        {(() => {
          const isAlert = dialog.type === 'alert';
          const themeColor = isAlert ? 'rose' : 'blue';
          
          return (
            <div className="text-center p-6"> 
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 bg-${themeColor}-50 text-${themeColor}-500 shadow-inner border border-${themeColor}-100 rotate-3`}> 
                {isAlert ? <AlertTriangle size={40} className="animate-pulse"/> : <Info size={40} />} 
              </div> 
              <p className="font-black text-slate-700 text-base leading-relaxed mb-8">{dialog.message}</p> 
              <div className="flex gap-4"> 
                {dialog.type === 'confirm' && (
                  <button onClick={() => setDialog(prev => ({ ...prev, show: false }))} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs tracking-widest transition-colors">
                    BATALKAN
                  </button>
                )} 
                <button 
                  onClick={dialog.onConfirm || (() => setDialog(prev => ({ ...prev, show: false })))} 
                  className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs shadow-xl bg-${themeColor}-500 shadow-${themeColor}-500/40 hover:bg-${themeColor}-600 active:scale-95 transition-all tracking-widest`}
                >
                  {dialog.type === 'confirm' ? 'YA, LANJUTKAN PROSES' : 'MENGERTI'}
                </button> 
              </div> 
            </div> 
          );
        })()}
      </Modal>

      {/* FLOATING MOBILE QUICK CHECKOUT BAR */}
      {cart.length > 0 && !isPaymentFormOpen && !showReceiptPrint && (
        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-slate-900/95 backdrop-blur-md text-white p-3.5 px-5 flex items-center justify-between border-t border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl ${activeTheme.main} flex items-center justify-center font-black text-sm text-white shadow-sm`}>
                <ShoppingCart size={18} />
              </div>
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm">
                {totalQtyKeranjang}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total ({selectedMenu})</p>
              <p className="text-base font-black text-white tracking-tight">Rp {grandTotal.toLocaleString('id-ID')}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsCartModalOpen(true);
              setIsPaymentFormOpen(true);
            }}
            className={`py-3 px-5 ${activeTheme.main} hover:brightness-110 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-60`}
            disabled={isProcessing}
          >
            {isProcessing ? processingMsg || 'Menyimpan...' : <><Zap size={15} fill="currentColor" /> BAYAR (1-TAP)</>}
          </button>
        </div>
      )}

      {/* ===== 1. MODAL FORM PERANGKUM GAJI UTAMA (HEADER + DAFTAR LIST KARYAWAN) ===== */}
      <Modal
        isOpen={isGajiFormOpen}
        onClose={() => {
          setIsGajiFormOpen(false);
          setGajiEditSession(null);
          setGajiItemList([]);
          setGajiHeader({ date: new Date().toISOString().split('T')[0], qty: calculateWorkingDays(new Date().toISOString().split('T')[0]), note: '' });
        }}
        maxWidth="max-w-4xl"
        title="Slip Gaji"
      >
        {(() => {
          const grandTotalBatch = gajiItemList.reduce((sum, item) => sum + item.netto, 0);

          return (
            <div className="flex flex-col max-h-[85vh] bg-white rounded-3xl overflow-hidden">
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

              {/* BODY SCROLLABLE */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                {/* SECTION HEADER PERANGKUM: PERIODE, QTY, NOTE */}
                <div className="p-4 bg-amber-50/70 border-2 border-amber-200/80 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={15} className="text-amber-600" /> Header Periode Gaji
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Tanggal Periode Gaji */}
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                        Tanggal Periode *
                      </label>
                      <input
                        type="date"
                        value={gajiHeader.date}
                        onChange={e => {
                          const newDate = e.target.value;
                          const autoQty = calculateWorkingDays(newDate);
                          setGajiHeader({ ...gajiHeader, date: newDate, qty: autoQty });
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    {/* Qty Periode */}
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                        Qty Pembantu (Hari Kerja / Bulan) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={gajiHeader.qty}
                        onChange={e => setGajiHeader({ ...gajiHeader, qty: Math.max(1, Number(e.target.value)) })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="26"
                      />
                      <span className="text-[9px] font-bold text-emerald-700 block mt-1">
                        💡 Otomatis: {calculateWorkingDays(gajiHeader.date)} hari kerja (total hari - hari Minggu). Dapat diubah manual.
                      </span>
                    </div>

                    {/* Note / Keterangan Periode */}
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                        Catatan Periode Gaji
                      </label>
                      <input
                        type="text"
                        value={gajiHeader.note}
                        onChange={e => setGajiHeader({ ...gajiHeader, note: e.target.value })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Contoh: Gaji Periode 1 - 15 Agustus 2026"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION DAFTAR KARYAWAN PENERIMA GAJI */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Users size={15} className="text-emerald-600" /> Daftar Penerima Gaji ({gajiItemList.length} Karyawan)
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Tambahkan rincian gaji karyawan dari koleksi users.</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingGajiItemIndex(null);
                        setGajiItemSubData({
                          id: '', person: '', pokok: 0, tunjangan: 0, bonus_1: 0, bonus_2: 0, bonus_3: 0, bonus_4: 0,
                          program: 0, lembur: 0, alfa: 0, setengah_hari: 0, sakit: 0, telat: 0, bpjs: 0, bon_diambil: 0, bon_dibayar: 0, netto: 0, diterima: 0
                        });
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
                              <span>Pendapatan: <strong className="text-emerald-600">Rp {(item.pokok + item.tunjangan + item.bonus_1 + item.bonus_2 + item.bonus_3 + item.bonus_4 + item.program + item.lembur).toLocaleString('id-ID')}</strong></span>
                              <span>|</span>
                              <span>Netto: {renderFormattedNetto(item.netto, "text-xs sm:text-sm", "text-emerald-700", "text-emerald-700")}</span>
                              <span>|</span>
                              <span>Diterima: <strong className="text-teal-600">Rp {(item.diterima || 0).toLocaleString('id-ID')}</strong></span>
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
              <div className="p-4 sm:p-5 bg-slate-900 text-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Gaji Batch</p>
                  <div>
                    {renderFormattedNetto(grandTotalBatch, "text-xl sm:text-2xl", "text-emerald-300", "text-emerald-400")}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setIsGajiFormOpen(false);
                      setGajiEditSession(null);
                      setGajiItemList([]);
                      setGajiHeader({ date: new Date().toISOString().split('T')[0], qty: calculateWorkingDays(new Date().toISOString().split('T')[0]), note: '' });
                    }}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveGaji}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    {isProcessing ? 'Menyimpan...' : (gajiEditSession ? 'Perbarui Slip Gaji' : 'Simpan Semua Slip Gaji')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ===== 2. POP-UP SUB-MODAL FORM DETAIL GAJI KARYAWAN (3-PART LAYOUT SEPERTI Halaman AKUN) ===== */}
      <Modal
        isOpen={isGajiItemSubModalOpen}
        onClose={() => setIsGajiItemSubModalOpen(false)}
        maxWidth="max-w-4xl"
        title="Detail Gaji Karyawan"
      >
        {(() => {
          const calcNettoItem = calculateItemNetto(gajiItemSubData, gajiHeader.qty);

          return (
            <div className="flex flex-col max-h-[85vh] bg-white rounded-3xl overflow-hidden">
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
                  Pembagi Qty: {gajiHeader.qty} Bln
                </span>
              </div>

              {/* BODY SCROLLABLE */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
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

                    {/* === 3 SECTION TERBAGI SEPERTI HALAMAN AKUN === */}
                    
                    {/* SECTION 1: PENDAPATAN */}
                    <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-white flex justify-between items-center">
                        <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign size={15} /> 1. Pendapatan (+)
                        </span>
                        <span className="font-black text-xs text-emerald-100">
                          Subtotal: Rp {(
                            (Number(gajiItemSubData.pokok)||0) + 
                            (Number(gajiItemSubData.tunjangan)||0) + 
                            (Number(gajiItemSubData.bonus_1)||0) + 
                            (Number(gajiItemSubData.bonus_2)||0) + 
                            (Number(gajiItemSubData.bonus_3)||0) + 
                            (Number(gajiItemSubData.bonus_4)||0) + 
                            (Number(gajiItemSubData.program)||0) + 
                            (Number(gajiItemSubData.lembur)||0)
                          ).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Gaji Pokok</label>
                          <input type="number" value={gajiItemSubData.pokok || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, pokok: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Tunjangan</label>
                          <input type="number" value={gajiItemSubData.tunjangan || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, tunjangan: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                        </div>
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
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Program</label>
                          <input type="number" value={gajiItemSubData.program || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, program: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Lembur</label>
                          <input type="number" value={gajiItemSubData.lembur || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, lembur: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
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
                          <div className="border-2 border-amber-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={15} /> 2. Potongan Kehadiran (-)
                              </span>
                              <span className="font-black text-xs text-amber-100">
                                Subtotal: -Rp {Math.round(subtotalKehadiran).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Alfa (Hari)</label>
                                <input type="number" value={gajiItemSubData.alfa || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, alfa: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {alfaVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {alfaVal} hari × Rp {Math.round(nilaiDasar).toLocaleString('id-ID')} = -Rp {Math.round(potAlfa).toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Setengah Hari (Hari)</label>
                                <input type="number" value={gajiItemSubData.setengah_hari || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, setengah_hari: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {setengahHariVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {setengahHariVal} hari × Rp {Math.round(nilaiDasar / 2).toLocaleString('id-ID')} = -Rp {Math.round(potSetengahHari).toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Sakit (Hari)</label>
                                <input type="number" value={gajiItemSubData.sakit || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, sakit: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {sakitVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {sakitVal} hari × Rp {Math.round(nilaiDasar * 0.9).toLocaleString('id-ID')} (90%) = -Rp {Math.round(potSakit).toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Telat (Menit/Kali)</label>
                                <input type="number" value={gajiItemSubData.telat || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, telat: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                                {telatVal > 0 && (
                                  <span className="text-[9px] font-bold text-amber-700 block mt-1">
                                    → Potongan: {telatVal} kali/menit × Rp 1.000 = -Rp {Math.round(potTelat).toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* SECTION 3: POTONGAN LAINNYA & BON */}
                          <div className="border-2 border-rose-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} /> 3. Potongan Lain & Bon (-)
                              </span>
                              <span className="font-black text-xs text-rose-100">
                                Subtotal: -Rp {subtotalPotonganLain.toLocaleString('id-ID')}
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
                                    💳 Sisa Bon Aktif: Rp {employeeActiveBon.toLocaleString('id-ID')}
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
                                  Total Bon (Saat Ini): Rp {employeeActiveBon.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* SECTION 4: DITERIMA (JUMLAH YANG DITERIMA KARYAWAN) */}
                          <div className="border-2 border-teal-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Wallet size={15} /> 4. Diterima
                              </span>
                              <span className="font-black text-xs text-teal-100">
                                Rp {(Number(gajiItemSubData.diterima) || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="p-4 bg-white">
                              <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">Jumlah Diterima Karyawan (Rp)</label>
                              <input type="number" value={gajiItemSubData.diterima || ''} onChange={e => setGajiItemSubData({...gajiItemSubData, diterima: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0" />
                              <span className="text-[9px] font-medium text-slate-400 block mt-1">
                                Isi manual jumlah uang yang diterima/ditransfer ke karyawan (optional).
                              </span>
                            </div>
                          </div>

                          {/* SECTION 5: CATATAN & BUKTI TRANSFER (NOTE & FILE) */}
                          <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} /> 5. Catatan & Bukti Transfer
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
              <div className="p-4 sm:p-5 bg-slate-900 text-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Netto Karyawan Ini</p>
                  <div>
                    {renderFormattedNetto(calcNettoItem, "text-xl sm:text-2xl", "text-emerald-300", "text-emerald-400")}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setIsGajiItemSubModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveSubGajiItem}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    {editingGajiItemIndex !== null ? 'Simpan Perubahan' : 'Tambahkan Karyawan Ini'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

    </div> 
  );
}