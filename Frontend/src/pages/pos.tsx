import DeleteAccess from '../components/delete-access';
import { isIncomeTransaction, settlementRemaining, matchUnusedStockLog } from '../lib/posTransactions';
import { createRecordId } from '../lib/ids';
import { formatRupiah, formatAmount } from '../lib/money';
import { validateCheckout, FIELD_TAB, type FieldKey } from '../lib/posValidation';
import type { CheckoutForm } from '../types/pos';
import { POS_DRAFT_KEY, readPosDraft, type PosDraft } from '../lib/posDraft';
import { createFinancialBatch } from '../services/api/financialBatch';
import { hasPendingAtomic } from '../services/api/atomic';
import { flushPendingSync, deleteFinancialRecord } from '../services/api/laravel';
import { useLocation } from 'react-router-dom'; // Ini yang menyebabkan error ReferenceError
import { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import '../components/pos/pos-modal.css';
import { 
  Search, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Plus, Printer, Share2, X,
  Calendar, History, Sparkles, DollarSign, Wallet, AlertTriangle, AlertCircle, Info, Wrench, Edit, Edit2, Filter, Zap,
  // Tambahan ikon baru untuk UI yang diperbarui:
  ListOrdered, Users, CreditCard, ShoppingBag, FileText, EyeOff, ImagePlus, Save, CheckCircle2, Box, User, ExternalLink,
  Package, Eye, Upload, RotateCcw
} from 'lucide-react';

import { PosNavbar } from '../components/pos/PosNavbar';
import { PosFilterBar } from '../components/pos/PosFilterBar';
import { MechanicSection } from '../components/pos/MechanicSection';
import { FieldError } from '../components/pos/FieldError';
import { ReceiptPrintModal } from '../components/pos/ReceiptPrintModal';

// --- DRAFT KERANJANG (cache lokal sementara) ---
// Dipulihkan saat halaman dibuka kembali supaya keranjang/form tidak hilang
// ketika pengguna tidak sengaja berpindah halaman. Hanya lokal, kedaluwarsa 24 jam.
// Logika parse/validasi ada di ../lib/posDraft.ts (diuji terpisah).

// --- INTERFACES ---
interface Produk {
  nama?: string;
  id: string; id_lama: string; kategori: string; merk: string; jenis: string;
  varian: string; keterangan: string; tipe: string; unit: string; beli: number;
  sell_1: number; sell_2: number; sell_3: number; sell_4: number; sell_5: number; sell_6: number;
  min_1: number; min_2: number; min_3: number; stok_3: number;
}

interface DropdownItem {
  text_2?: string; number_1?: number;
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
  status: string; date_lunas?: string;
  id: string; created_at: string; created: string; jenis: string; person: string; payment: string; 
  qty: number; text: string; tempo: string; marketplace: string; cashback: number; admin: number; operator: string; ref: string; person_baru: string;
  file: string[];
  total?: number;
  dibayar?: number;
}

interface LogStockDetail {
  stok_awal?: number; stok_akhir?: number; created_at?: string;
  id: string; item: string; qty: number; price_1: number; price_2: number; boolean: string; item_baru: string; number_1: number; number_2: number;
  expand?: { item_baru: Produk; ref_baru?: HistoryMenu };
}

interface CashflowDetail {
  saldo_awal?: number; saldo_akhir?: number;
  id: string; nominal: number; mutasi: string; account_1: string; account_2: string; jenis: string; note: string;
}

interface OngkosDetail {
  id: string; person: string; ongkos: number; date: string;
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

  const location = useLocation();

  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'items' | 'payment' | 'notes'>('items');
  const [showCartCatalog, setShowCartCatalog] = useState(false);
  const [existingMenuFiles, setExistingMenuFiles] = useState<File[]>([]);

  // --- 1. ALL STATES ---
  const [products, setProducts] = useState<Produk[]>([]);
  const [historyMenu, setHistoryMenu] = useState<HistoryMenu[]>([]);

  const [menuOptions, setMenuOptions] = useState<DropdownItem[]>([]);
  const [personOptions, setPersonOptions] = useState<DropdownItem[]>([]);
  const [cashflowAccounts, setCashflowAccounts] = useState<DropdownItem[]>([]);
  const [mechanics, setMechanics] = useState<UserKaryawan[]>([]);

  const [allPersons, setAllPersons] = useState<DropdownItem[]>([]);
  const personsMap = useMemo(() => {
    const map = new Map<string, DropdownItem>();
    allPersons.forEach(p => {
      if (p.id_lama) map.set(p.id_lama, p);
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [allPersons]);

  const getPersonDisplayText = (personId: string | undefined | null, fallback: string = 'Umum'): string => {
    if (!personId) return fallback;
    const p = personsMap.get(personId);
    if (!p) return personId || fallback;
    const text1 = p.text_1 || '';
    const text2 = p.text_2 || '';
    return text2 ? `${text1} - ${text2}` : (text1 || fallback);
  };
  
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialDraft] = useState<PosDraft | null>(() => readPosDraft(key => localStorage.getItem(key), Date.now(), hasPendingAtomic()));
  const initialBayar = initialDraft?.formBayar as Partial<CheckoutForm> | undefined;
  const [selectedMenu, setSelectedMenu] = useState<string>(initialDraft?.selectedMenu ?? 'Overview');
  const [cart, setCart] = useState<CartItem[]>(initialDraft?.cart as CartItem[] ?? []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(12);

  const [reportDetailData] = useState<{
    menu: any[]; 
    logStock: any[]; 
    cashflow: any[]; 
    ongkos: any[] 
  } | null>(null);

  // State untuk posisi dropdown
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const personButtonRef = useRef<HTMLButtonElement>(null);

  const [searchInput, setSearchInput] = useState('');

  const [activeTab, setActiveTab] = useState<'detail' | 'items' | 'payments'>('detail');
  const [searchItemTerm, setSearchItemTerm] = useState('');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // 'grid' atau 'list'
  const [showNavbar, setShowNavbar] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  // Ambil parameter dari URL saat pertama kali render
  const initialPersonParam = new URLSearchParams(window.location.search).get('person') || '';
  const initialStatusParam = new URLSearchParams(window.location.search).get('status');
  const initialStatus = initialStatusParam === 'lunas' ? 'lunas' : (initialStatusParam === 'belum' ? 'belum' : 'all');

  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [filterPerson, setFilterPerson] = useState<string>(initialPersonParam);
  const [selectedMenuFilters, setSelectedMenuFilters] = useState<string[]>([]);

  const [isPersonFilterOpen, setIsPersonFilterOpen] = useState(false);
  const [personFilterSearch, setPersonFilterSearch] = useState('');
  
  const [showDetailHistory, setShowDetailHistory] = useState<HistoryMenu | null>(null);
  const [historyItems, setHistoryItems] = useState<LogStockDetail[]>([]);
  const [historyCashflow, setHistoryCashflow] = useState<CashflowDetail[]>([]);
  const [historyOngkos, setHistoryOngkos] = useState<OngkosDetail[]>([]);
  
  const [showCheckoutReview, setShowCheckoutReview] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
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

      try {
        const foundUser = allUsers.find(u => u.username === personVal || u.name === personVal || u.id === personVal);
        if (foundUser) {
           activeBon = Number(foundUser.number) || 0;
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

  // Ambil parameter dari URL saat pertama kali mount / URL berubah
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const personParam = searchParams.get('person');
    const statusParam = searchParams.get('status');

    if (personParam !== null && personParam !== filterPerson) {
      setFilterPerson(personParam);
    }

    if (statusParam === 'lunas' && filterStatus !== 'lunas') {
      setFilterStatus('lunas');
    } else if (statusParam === 'belum' && filterStatus !== 'belum') {
      setFilterStatus('belum');
    } else if (!statusParam && filterStatus !== 'all') {
      setFilterStatus('all');
    }
  }, [location.search]);

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
  const [editSession, setEditSession] = useState<{ isEditing: boolean, menuId: string, createdAt: string, snapshot?: HistoryMenu } | null>(null);
  const [, setEditOldItems] = useState<{ item_baru?: string; item?: string; qty: number; boolean: string }[]>([]);
  const [quickSettleData, setQuickSettleData] = useState<{
    show: boolean;
    menu: HistoryMenu | null;
    nominal: number;
    accountId: string;
    note: string;
    createdAt: string;
    settleFiles: File[];
  } | null>(null);

  const [formBayar, setFormBayar] = useState<CheckoutForm>({
      personIdLama: initialBayar?.personIdLama ?? 'umum1',
      payment: initialBayar?.payment ?? 'Tunai',
      nominalBayar: initialBayar?.nominalBayar ?? 0,
      cashflowList: initialBayar?.cashflowList ?? [{ accountId: '', nominal: 0 }], // Multi cashflow
      mekanikList: initialBayar?.mekanikList ?? [{ idLama: '', ongkos: 0 }],
      note: initialBayar?.note ?? '',
      noteMenu: initialBayar?.noteMenu ?? '',
      tempoDate: initialBayar?.tempoDate ?? '', // 🟢 Pisahkan state khusus untuk Tanggal Tempo
      marketplace: initialBayar?.marketplace ?? '',
      adminFee: initialBayar?.adminFee ?? 0,
      cashback: initialBayar?.cashback ?? 0,
      createdAt: initialBayar?.createdAt ?? getLocalDatetimeInput(), 
});

  // Simpan draft lokal setiap keranjang/form berubah; hapus saat keranjang kosong.
  const draftReadyRef = useRef(false);
  useEffect(() => {
    // Jangan sentuh draft selama transaksi atomic masih menunggu resolusi.
    if (hasPendingAtomic()) return;
    const firstRun = !draftReadyRef.current;
    draftReadyRef.current = true;
    try {
      if (cart.length > 0) {
        localStorage.setItem(POS_DRAFT_KEY, JSON.stringify({ cart, selectedMenu, formBayar, savedAt: Date.now() }));
      } else if (!firstRun) {
        // Hapus hanya saat keranjang betul-betul dikosongkan, bukan saat mount.
        localStorage.removeItem(POS_DRAFT_KEY);
      }
    } catch { /* cache lokal bersifat best-effort */ }
  }, [cart, selectedMenu, formBayar]);

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


  const [dialog, setDialog] = useState<{show: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void}>({
    show: false, title: '', message: '', type: 'alert'
  });

  const showAlert = (title: string, message: string) => {
    setDialog({ show: true, title, message, type: 'alert' });
  };

  const receiptRef = useRef<HTMLDivElement>(null);
  const detailPrintRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Guard anti double-submit (lebih kuat dari state karena tidak ter-reset oleh watchdog)
  const submitLockRef = useRef(false);

  const handleReactPrintFn = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Struk_${formBayar.notaNo || 'POS'}`,
  });

  const handleDetailPrintFn = useReactToPrint({
    contentRef: detailPrintRef,
    documentTitle: `Detail_Transaksi`,
  });

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

  // Helper Formatter Tampilan Nominal Netto (pakai format uang seragam)
  const renderFormattedNetto = (amount: number, mainTextSize: string = "text-xl sm:text-2xl", textColor: string = "text-emerald-300", rpColor: string = "text-emerald-400") => {
    const formatted = formatAmount(amount);
    return (
      <span className="inline-flex items-baseline font-black">
        <span className={`text-[10px] sm:text-xs font-extrabold ${rpColor} mr-1 uppercase`}>Rp</span>
        <span className={`${mainTextSize} ${textColor}`}>{formatted}</span>
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
  // Helper Simpan Seluruh Batch Slip Gaji (Perangkum + Children)
  const handleSaveGaji = async () => {
    if (gajiItemList.length === 0) {
      showAlert('Perhatian', 'Tambahkan minimal 1 Penerima Gaji ke dalam daftar!');
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsProcessing(true);
    setProcessingMsg('Menyiapkan batch slip gaji...');
    try {
      await flushPendingSync();
      const grandTotal = gajiItemList.reduce((sum, item) => sum + calculateItemNetto(item,gajiHeader.qty), 0);
      const isEditMode = gajiEditSession !== null;
      let menuId: string;
      const existingSalaryIds = new Set<string>();

      // Inisialisasi PocketBase Atomic Batch
      const batch = createFinancialBatch();

      if (isEditMode) {
        // ============== MODE EDIT ==============
        menuId = gajiEditSession!.menuId;
        // 1. Queue Update record menu utama ke atomic batch
        batch.collection('menu').update(menuId, {
          total: grandTotal,
          dibayar: grandTotal,
          qty: gajiHeader.qty,
          text: gajiHeader.note || `Gaji Periode ${gajiHeader.date}`,
          person: gajiItemList.map(i => i.person).join(', '),
          created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
        });

        // 2. Fetch & Queue Hapus semua record gaji lama yang terkait ke batch
        const oldGajiList = await pb.collection('gaji').getFullList({
          filter: `ref = "${menuId}" || ref_baru = "${menuId}"`,
          $autoCancel: false
        });
        oldGajiList.forEach(salary => existingSalaryIds.add(salary.id));

        // 3. Fetch & Queue Hapus semua record bon lama yang ter-generate dari gaji ini ke batch
        const oldBonList = await pb.collection('bon').getFullList({
          filter: [pb.filter('ref_menu = {:id}', { id: menuId }), ...oldGajiList.map(g => pb.filter('ref_gaji = {:id}', { id: g.id }))].join(' || '),
          $autoCancel: false
        });
        for (const ob of oldBonList) batch.collection('bon').delete(ob.id);
        for (const salary of oldGajiList) {
          if (!gajiItemList.some(item => item.id === salary.id)) batch.collection('gaji').delete(salary.id);
        }
      } else {
        // ============== MODE BARU ==============
        // 1. Simpan Perangkum Utama ke collection 'menu' untuk mendapatkan menuId
        menuId = createRecordId();
        batch.collection('menu').create({
          id: menuId,
          jenis: 'gaji',
          status: 'lunas',
          total: grandTotal,
          dibayar: grandTotal,
          qty: gajiHeader.qty,
          text: gajiHeader.note || `Gaji Periode ${gajiHeader.date}`,
          person: gajiItemList.map(i => i.person).join(', '),
          operator: operatorName || pb.authStore.model?.username || 'System',
          created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
        });
      }

      // 2. Queue Simpan ulang setiap rincian karyawan ke collection 'gaji' dan 'bon' dalam atomic batch
      for (const item of gajiItemList) {
        const salaryExists = existingSalaryIds.has(item.id);
        const salaryId = salaryExists ? item.id : createRecordId();
        const formData = new FormData();
        formData.append('id', salaryId);
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
            formData.append(salaryExists ? 'file+' : 'file', file);
          });
        }

        if (salaryExists) batch.collection('gaji').update(salaryId,formData);
        else batch.collection('gaji').create(formData);

        // Cari user ID untuk update saldo bon
        const foundUser = allUsers.find(u => u.username === item.person || u.name === item.person || u.id === item.person);
        
        // Cari dropdown person ID untuk relasi tabel bon
        let personDropdownId = '';
        if (foundUser) {
          const foundPerson = allPersons.find(p => p.id_lama === foundUser.username || p.text_1 === foundUser.name || p.id === item.person);
          if (foundPerson) personDropdownId = foundPerson.id;
        }

        // Auto-queue record bon jika ada bon_dibayar > 0 (Pelunasan Bon)
        if (item.bon_dibayar && item.bon_dibayar > 0) {
          batch.collection('bon').create({
            persontext: item.person,
            person: personDropdownId,
            user: foundUser?.id || '',
            jenis: 'in', // Pelunasan = in (mengurangi saldo bon)
            nominal: item.bon_dibayar,
            note: `Potongan Bon via Slip Gaji Periode ${gajiHeader.date}`,
            ref_gaji: salaryId,
            ref_menu: menuId,
            operator: operatorName || pb.authStore.model?.username || 'System'
          });

        }

        // Auto-queue record bon jika ada bon_diambil > 0 (Pinjaman Bon Baru)
        if (item.bon_diambil && item.bon_diambil > 0) {
          batch.collection('bon').create({
            persontext: item.person,
            person: personDropdownId,
            user: foundUser?.id || '',
            jenis: 'out', // Ambil bon baru = out (menambah saldo bon)
            nominal: item.bon_diambil,
            note: `Pinjaman Bon Baru via Slip Gaji Periode ${gajiHeader.date}`,
            ref_gaji: salaryId,
            ref_menu: menuId,
            operator: operatorName || pb.authStore.model?.username || 'System'
          });

        }
      }

      // EKSEKUSI ATOMIC BATCH POCKETBASE
      setProcessingMsg('Mengeksekusi batch ke PocketBase...');
      await batch.send([], () => { setIsGajiFormOpen(false); setGajiEditSession(null); setGajiItemList([]); });

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
      submitLockRef.current = false;
      setIsProcessing(false);
      setProcessingMsg('');
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
        });
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
        netto: calculateItemNetto(g,Number(menuItem.qty) || 0),
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
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `kategori ~ "menu" && jenis ~ "jenis menu"`, sort: 'text_1', $autoCancel: false }),
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `jenis ~ "cashflow account"`, sort: 'text_1', $autoCancel: false }),
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

      if (menuLower === 'overview') {
        // Cari ID menu dari sub-koleksi (log_stock nama barang & ongkos nama mekanik) jika ada kata kunci pencarian
        let subCollectionMenuIds: string[] = [];
        if (searchTerm.trim()) {
          const cleanTerm = searchTerm.trim();
          try {
            const [stockRes, ongkosRes] = await Promise.all([
              pb.collection('log_stock').getList(1, 100, {
                filter: pb.filter('item ~ {:term} || item_baru ~ {:term}', { term: cleanTerm }),
                fields: 'ref_baru',
                $autoCancel: false
              }).catch(() => ({ items: [] })),
              pb.collection('ongkos').getList(1, 100, {
                filter: pb.filter('person ~ {:term}', { term: cleanTerm }),
                fields: 'ref_baru',
                $autoCancel: false
              }).catch(() => ({ items: [] }))
            ]);
            const ids = new Set<string>();
            (stockRes.items || []).forEach((i: any) => { if (i.ref_baru) ids.add(i.ref_baru); });
            (ongkosRes.items || []).forEach((i: any) => { if (i.ref_baru) ids.add(i.ref_baru); });
            subCollectionMenuIds = Array.from(ids);
          } catch (err) {
            console.warn("Subcollection lookup error:", err);
          }
        }

        if (searchTerm) {
          const terms = searchTerm.trim().split(/\s+/);
          terms.forEach((t, i) => {
            params[`t${i}`] = t;

            const matchedPersonIds: string[] = [];
            allPersons.forEach(p => {
              const text1 = (p.text_1 || '').toLowerCase();
              const text2 = (p.text_2 || '').toLowerCase();
              if (text1.includes(t.toLowerCase()) || text2.includes(t.toLowerCase())) {
                matchedPersonIds.push(p.id_lama);
                if (p.id) matchedPersonIds.push(p.id);
              }
            });

            const personIdConds = matchedPersonIds.length > 0
              ? matchedPersonIds.map(id => `person = "${id}"`).join(' || ')
              : '';

            const subIdConds = subCollectionMenuIds.length > 0
              ? subCollectionMenuIds.map(id => `id = "${id}"`).join(' || ')
              : '';

            let mainCondParts = [
              `id_lama ~ {:t${i}}`,
              `jenis ~ {:t${i}}`,
              `person ~ {:t${i}}`,
              `text ~ {:t${i}}`,
              `payment ~ {:t${i}}`,
              `operator ~ {:t${i}}`,
              `marketplace ~ {:t${i}}`
            ];
            if (personIdConds) mainCondParts.push(personIdConds);
            if (subIdConds) mainCondParts.push(subIdConds);

            conditions.push(`(${mainCondParts.join(' || ')})`);
          });
        }
      } else {
        if (searchTerm) {
          const terms = searchTerm.trim().split(/\s+/);
          terms.forEach((t, i) => {
            params[`t${i}`] = t;
            if (menuLower.includes('gaji')) {
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
      }

      const filterStr = conditions.length > 0 ? pb.filter(conditions.join(' && '), params) : '';

      if (menuLower === 'overview') {
        let overviewFilterParts: string[] = [];

        if (filterStr) {
          overviewFilterParts.push(`(${filterStr})`);
        }

        if (userLevel === '10') {
          const currentUsername = pb.authStore.model?.username || localStorage.getItem('user_username') || '';
          const currentName = pb.authStore.model?.name || localStorage.getItem('user_name') || '';
          const mechanicCond = `(note ~ "${currentUsername}" || note ~ "${currentName}" || person ~ "${currentUsername}" || person ~ "${currentName}" || persontext ~ "${currentUsername}" || persontext ~ "${currentName}" || operator ~ "${currentUsername}")`;
          overviewFilterParts.push(`jenis ~ "service"`);
          overviewFilterParts.push(mechanicCond);
        } else {
          if (filterStatus !== 'all') {
            const statusValue = filterStatus === 'lunas' ? 'lunas' : 'belum';
            overviewFilterParts.push(`status ~ "${statusValue}"`);
          }

          if (filterPerson) {
            const matchedP = allPersons.find(p => p.id_lama === filterPerson || p.id === filterPerson);
            if (matchedP) {
              const pConds = [`person = "${matchedP.id_lama}"`];
              if (matchedP.id) pConds.push(`person = "${matchedP.id}"`);
              if (matchedP.text_1) pConds.push(`person ~ "${matchedP.text_1}"`);
              overviewFilterParts.push(`(${pConds.join(' || ')})`);
            } else {
              overviewFilterParts.push(`person = "${filterPerson}"`);
            }
          }

          if (selectedMenuFilters.length > 0) {
            const jenisConditions = selectedMenuFilters.map(jenis => `jenis ~ "${jenis}"`).join(' || ');
            overviewFilterParts.push(`(${jenisConditions})`);
          }
        }

        const overviewFilter = overviewFilterParts.join(' && ');
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
        setIsCartModalOpen(true);
        setCartTab('payment');
        setIsPaymentFormOpen(true);
      }

      // F9 untuk Auto Lunas (Uang Pas) saat Modal Pembayaran Terbuka
      if (e.key === 'F9' && isCartModalOpen && !showCheckoutReview && cartTab === 'payment') {
        e.preventDefault();
        const kasirAcc = cashflowAccounts.find(a => a.text_1.toLowerCase().includes('kasir') || a.text_1.toLowerCase().includes('cash')) || cashflowAccounts[0];
        const newList = [...formBayar.cashflowList];
        const sumOther = newList.reduce((acc, curr, i) => i !== 0 ? acc + (curr.nominal || 0) : acc, 0);
        const remaining = Math.max(0, grandTotal - sumOther);
        if (newList.length > 0) {
          newList[0].nominal = remaining;
          if (kasirAcc && !newList[0].accountId) {
            newList[0].accountId = kasirAcc.id;
          }
        } else {
          newList.push({ id: '', created_at: '', accountId: kasirAcc ? kasirAcc.id : '', nominal: remaining });
        }
        setFormBayar(prev => ({ ...prev, payment: 'Tunai', nominalBayar: grandTotal, cashflowList: newList }));
      }

      // Esc untuk tutup Form Pembayaran
      if (e.key === 'Escape' && isPaymentFormOpen) {
        e.preventDefault();
        setIsPaymentFormOpen(false);
        setIsCartModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentFormOpen, isCartModalOpen, showCheckoutReview, cartTab, cart, cashflowAccounts, formBayar.cashflowList, grandTotal]);

  // --- CHECKOUT SAFETY GUARD ---
  const clearFieldError = (field: FieldKey) => setFieldErrors(prev => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });

  const focusFieldError = (field: FieldKey) => {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
  };

  const handleCheckoutValidation = () => {
    const menuLower = selectedMenu.toLowerCase();
    const errors = validateCheckout({
      menu: selectedMenu,
      cartCount: cart.length,
      mekanik: formBayar.mekanikList,
      cashflow: formBayar.cashflowList,
      isOnline: isOnlinePerson,
      marketplace: formBayar.marketplace,
      adminFee: formBayar.adminFee,
      noteMenu: formBayar.noteMenu,
      payment: formBayar.payment,
      tempoDate: formBayar.tempoDate,
    });

    // Tampilkan pesan tepat di bawah field yang bermasalah dan fokuskan error pertama.
    if (errors.length > 0) {
      const map: Partial<Record<FieldKey, string>> = {};
      errors.forEach(error => { if (!map[error.field]) map[error.field] = error.message; });
      setFieldErrors(map);
      const first = errors[0];
      setCartTab(FIELD_TAB[first.field]);
      focusFieldError(first.field);
      return;
    }
    setFieldErrors({});

    // --- CEK STATUS LUNAS / BELUM (keputusan penting, tetap pakai dialog) ---
    const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
    const isCashflowKosong = formBayar.cashflowList.length === 0 ||
      formBayar.cashflowList.every(cf => !cf.accountId && cf.nominal === 0);
    const totalKurang = totalDibayar < grandTotal;

    if (isCashflowKosong || totalKurang) {
      setDialog({
        show: true,
        title: 'Konfirmasi Status Belum Lunas',
        message: `Apakah Anda yakin ingin melanjutkan simpan menu ${selectedMenu} ini dalam keadaan BELUM LUNAS?`,
        type: 'confirm',
        onConfirm: () => {
          setDialog(prev => ({ ...prev, show: false }));
          lanjutkanValidasiMandatory();
        }
      });
      return;
    }

    lanjutkanValidasiMandatory();

    // Lanjut ke review: catatan tempo untuk pembelian diisi otomatis oleh sistem.
    function lanjutkanValidasiMandatory() {
      if (menuLower.includes('pembelian') && formBayar.payment === 'Tempo' && !formBayar.noteMenu.trim()) {
        const tglTransaksi = formBayar.createdAt ? new Date(formBayar.createdAt) : new Date();
        const tglJatuhTempo = new Date(formBayar.tempoDate);
        const diffTime = tglJatuhTempo.getTime() - tglTransaksi.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };
        const formattedDate = tglJatuhTempo.toLocaleDateString('id-ID', options);
        setFormBayar(prev => ({ ...prev, noteMenu: `Tempo: ${formattedDate} (${diffDays} hari)` }));
      }
      setShowReviewDetails(false);
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
    clearFieldError('cart');
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
    if (submitLockRef.current) return; // anti double-submit (tombol disabled + watchdog tidak bisa menembus ini)
    submitLockRef.current = true;
    setIsProcessing(true);
    setProcessingMsg('Menyimpan...');
    // A slow response is still in flight: keep the submit lock and avoid encouraging duplicate input.
    const watchdog = setTimeout(() => {
      setProcessingMsg('Server masih memproses. Jangan membuat transaksi yang sama lagi.');
    }, 60000);
    const isEditing = !!(editSession?.isEditing && editSession?.menuId);
    let menuRecordId = isEditing ? editSession.menuId : '';
    let oldMenuData: any = null;
    let oldCashflows: any[] = [];
    let oldOngkos: any[] = [];
    let oldLogs: any[] = [];

    try {
      await flushPendingSync();
      // Browser otomatis mengubah string lokal (YYYY-MM-DDTHH:mm) menjadi format UTC (Z) yang diterima PB
      const timestamp = formBayar.createdAt
        ? new Date(formBayar.createdAt).toISOString()
        : new Date().toISOString();
        
      const menuLower = selectedMenu.toLowerCase();

      const selectedPersonRecordId = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '';
      const selectedPersonName = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.text_1 || 'Umum';



      if (isEditing) {
        oldMenuData = await pb.collection('menu').getOne(editSession.menuId);
        
        oldLogs = await pb.collection('log_stock').getFullList({ filter: `ref = "${editSession.menuId}" || ref_baru = "${editSession.menuId}"` });
        oldCashflows = await pb.collection('cashflow').getFullList({ filter: `ref = "${editSession.menuId}" || ref_baru = "${editSession.menuId}"` });
        oldOngkos = await pb.collection('ongkos').getFullList({ filter: `ref = "${editSession.menuId}" || ref_baru = "${editSession.menuId}"` });
      }

      // Hitung akumulasi parameter keuangan pembayaran kasir
      const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);

      // === PRE-FLIGHT: ambil snapshot stok & saldo sebelum write ===
      setProcessingMsg('Memverifikasi stok & saldo...');
      const preflightStocks: Record<string, number> = {};
      const preflightBalances: Record<string, number> = {};
      try {
        const stockIds = Array.from(new Set([...cartWithTierPrice.map(item => item.id), ...oldLogs.map(log => log.item_baru)].filter(Boolean)));
        const stockPromises = stockIds.map(id => pb.collection('produk').getOne(id, { $autoCancel: false }).then(p => ({ id, stok: Number(p.stok_3) || 0 })));
        
        const oldAccountIds = isEditing ? oldCashflows.flatMap((c: any) => [c.account_1, c.account_2]) : [];
        const newAccountIds = formBayar.cashflowList.map((cf: any) => cf.accountId);
        const allAccountIds = Array.from(new Set([...oldAccountIds, ...newAccountIds].filter(Boolean)));

        const balancePromises = allAccountIds
          .map(accId => pb.collection('dropdown').getOne(accId, { $autoCancel: false }).then(a => ({ id: accId, bal: Number(a.number_1) || 0 })));
        const [stocks, balances] = await Promise.all([Promise.all(stockPromises), Promise.all(balancePromises)]);
        stocks.forEach(s => { preflightStocks[s.id] = s.stok; });
        balances.forEach(b => { preflightBalances[b.id] = b.bal; });

        // Jika mode edit, revert saldo transaksi cashflow lama pada preflightBalances
        if (isEditing && oldCashflows.length > 0) {
          for (const oldCf of oldCashflows) {
            const acc1 = oldCf.account_1;
            const acc2 = oldCf.account_2;
            const nom = Number(oldCf.nominal || 0);
            const mut = String(oldCf.mutasi || '').toLowerCase();
            const isOut = mut === 'out' || mut === 'keluar';
            const isTransfer = String(oldCf.jenis || '').toLowerCase().includes('transfer');

            if (acc1 && preflightBalances[acc1] !== undefined) {
              preflightBalances[acc1] = isOut
                ? preflightBalances[acc1] + nom
                : preflightBalances[acc1] - nom;
            }
            if (acc2 && isTransfer && preflightBalances[acc2] !== undefined) {
              preflightBalances[acc2] = isOut
                ? preflightBalances[acc2] - nom
                : preflightBalances[acc2] + nom;
            }
          }
        }
      } catch { throw new Error('Gagal memverifikasi stok dan saldo. Silakan coba lagi.'); }
      setProcessingMsg('Menyimpan transaksi...');

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
          dateLunas = oldMenuData.date_lunas || new Date().toISOString(); // Pertahankan track records tgl lunas lama
        }
      } else if (statusBaru === 'lunas') {
        dateLunas = new Date().toISOString();
      }

      // Pembentukan Dokumen Jurnal Formulir Data Menu Baru
      const menuFormData = new FormData();
      if (isEditing && editSession?.snapshot) menuFormData.set('atomic_expected',JSON.stringify(editSession.snapshot));
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
      menuFormData.append('date_lunas', dateLunas || '');
      
      // 🟢 Simpan tanggal tempo jika pembayaran di-set ke Tempo
      menuFormData.append('tempo', formBayar.payment === 'Tempo' ? formBayar.tempoDate : '');

      if (menuFiles && menuFiles.length > 0) {
        menuFiles.forEach(file => menuFormData.append(isEditing ? 'file+' : 'file', file));
      }

      const batch = createFinancialBatch({draftKey:'pos_draft_cart'});
      if (!isEditing) {
        menuRecordId = createRecordId();
        menuFormData.set('id', menuRecordId);
        batch.collection('menu').create(menuFormData);
      }

      // ========== MODE EDIT: hapus children lama terlebih dahulu (di-queue ke batch) ==========
      if (isEditing) {
        const newCfIds = formBayar.cashflowList.filter(cf => cf.accountId && cf.nominal > 0).map((cf: any) => cf.id).filter(id => id);
        for (const cf of oldCashflows) {
          if (!newCfIds.includes(cf.id)) {
            batch.collection('cashflow').delete(cf.id);
          }
        }

        // Dynamic Incremental Diff for Ongkos (Service Mechanics)
        const validMekanik = formBayar.mekanikList.filter((m: any) => m.idLama && m.ongkos > 0);
        const activeMekanikPersonIds = validMekanik.map((m: any) => m.idLama);
        for (const ong of oldOngkos) {
          if (!activeMekanikPersonIds.includes(ong.person)) {
            batch.collection('ongkos').delete(ong.id);
          }
        }
      }

      // ========== INCREMENTAL DIFF PENYIMPANAN LOG STOCK ==========
      const processedLogIds = new Set<string>();
      const runningStock: Record<string, number> = {};

      for (const item of cartWithTierPrice) {
        const booleanValue = (menuLower.includes('penjualan') || menuLower.includes('service') || menuLower.includes('servis')) ? 'out' : 'in';
        
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
        const logQty = Number(item.qty);
        if (!Number.isInteger(logQty) || logQty <= 0) throw new Error('Jumlah barang harus bilangan bulat positif.');
        const qtyAwal = runningStock[prodId] ?? 0;

        const matchedOldLog = isEditing ? matchUnusedStockLog(oldLogs, prodId, item.id_lama || '', processedLogIds) : undefined;

        if (matchedOldLog) {
          processedLogIds.add(matchedOldLog.id);
          const isLogChanged = Number(matchedOldLog.qty) !== logQty || 
                               Number(matchedOldLog.price_1) !== Number(item.priceSelected || 0) ||
                               matchedOldLog.boolean !== booleanValue ||
                               Number(matchedOldLog.price_2) !== Number(price2Value) ||
                               Number(matchedOldLog.normal) !== Number(normalValue);

          if (!isLogChanged) {
            // UNCHANGED ITEM: Skip DB update & webhook, retain stock & ID in-place
            runningStock[prodId] = qtyAwal;
          } else {
            // CHANGED ITEM: Update existing log_stock in-place via Batch
            const afterRevert = matchedOldLog.boolean === 'in'
              ? qtyAwal - Number(matchedOldLog.qty || 0)
              : qtyAwal + Number(matchedOldLog.qty || 0);
            const qtyAkhir = booleanValue === 'in' ? afterRevert + logQty : afterRevert - logQty;
            if (qtyAkhir < 0) throw new Error('Stok barang tidak cukup.');
            runningStock[prodId] = qtyAkhir;

            batch.collection('log_stock').update(matchedOldLog.id, {
              qty: logQty,
              price_1: Number(item.priceSelected || 0),
              price_2: Number(price2Value || 0),
              normal: Number(normalValue || 0),
              boolean: booleanValue,
              stok_awal: preflightStocks[prodId] ?? qtyAwal,
              stok_akhir: qtyAkhir,
            });
          }
        } else {
          // NEW ITEM ADDED TO CART DURING EDIT / NEW TRANSACTION
          const qtyAkhir = booleanValue === 'in' ? qtyAwal + logQty : qtyAwal - logQty;
          if (qtyAkhir < 0) throw new Error('Stok barang tidak cukup.');
          runningStock[prodId] = qtyAkhir;

          // Dalam batch mode, jika item baru dibuat, buat id sementara atau serahkan ke PB batch
          // Catatan: PocketBase batch membuat entri baru secara otomatis
          batch.collection('log_stock').create({
            id_lama: '',
            created_at: timestamp,
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
          // Webhook notification untuk created log_stock
        }
      }

      // DELETE REMOVED LOGS (Items that were removed from cart during edit) & REVERT THEIR STOCK
      if (isEditing && oldLogs.length > 0) {
        for (const log of oldLogs) {
          if (!processedLogIds.has(log.id)) {
            if (log.item_baru) {
              const stock = runningStock[log.item_baru] ?? preflightStocks[log.item_baru];
              if (stock === undefined) throw new Error('Stok item yang dihapus belum dapat diverifikasi.');
              const afterRemoval = stock + (log.boolean === 'in' ? -Number(log.qty) : Number(log.qty));
              if (afterRemoval < 0) throw new Error('Item pembelian tidak dapat dihapus karena stoknya sudah terpakai.');
              runningStock[log.item_baru] = afterRemoval;
            }
            batch.collection('log_stock').delete(log.id);


          }
        }
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

      // Simpan pemetaan pemisahan multi cashflow aliran dana masuk/keluar & UPDATE SALDO DOMPET

      for (const cf of formBayar.cashflowList) {
        if (cf.accountId && cf.nominal > 0) {
          const selectedAccount = cashflowAccounts.find(acc => acc.id === cf.accountId);
          const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
          const mutasiValue = (menuLower.includes('penjualan') || menuLower.includes('service') || menuLower.includes('servis')) ? 'in' : 'out';
          
          let saldoAwal = preflightBalances[cf.accountId] ?? 0;
          const saldoAkhir = mutasiValue === 'in' ? (saldoAwal + cf.nominal) : (saldoAwal - cf.nominal);
          preflightBalances[cf.accountId] = saldoAkhir;

          const cfData = {
            id_lama: '',
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
          };

          if (cf.id) {
            // Update exist via Batch
            batch.collection('cashflow').update(cf.id, cfData);
          } else {
            // Create new via Batch
            batch.collection('cashflow').create({
              ...cfData,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      if (Object.values(preflightBalances).some(balance => balance < -0.00001)) throw new Error('Saldo akun tidak cukup untuk perubahan pembayaran ini.');

      // Alokasikan alur pembagian komisi upah ke sub-koleksi ongkos (Khusus Jenis Service)
      if (menuLower.includes('service') || menuLower.includes('servis')) {
        const mekanikValid = formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0);
        
        if (mekanikValid.length > 0) {
          for (const mek of mekanikValid) {
            const existingOng = oldOngkos.find(o => o.person === mek.idLama);
            if (existingOng) {
              if (existingOng.ongkos !== mek.ongkos) {
                batch.collection('ongkos').update(existingOng.id, { ongkos: mek.ongkos });
              }
            } else {
              batch.collection('ongkos').create({
                id_lama: '',
                date: timestamp,
                person: mek.idLama,
                ongkos: mek.ongkos,
                operator: operatorName,
                ref: '',
                ref_baru: menuRecordId
              });
            }
          }
        }
      }

      // MODE EDIT: queue update menu terakhir (setelah semua children tersusun)
      if (isEditing) {
        batch.collection('menu').update(menuRecordId, menuFormData);
      }

      // EKSEKUSI POCKETBASE ATOMIC BATCH TRANSACTION
      setProcessingMsg('Mengeksekusi transaksi atomic batch ke PocketBase...');
      await batch.send();
      setIsPaymentFormOpen(false);
      try { localStorage.removeItem('pos_draft_cart'); } catch { /* Draft cleanup must not interrupt financial synchronization. */ }
      setCart([]);
      setEditSession(null);


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

      setDialog({ show: true, title: 'SUKSES', message: isEditing ? "Perubahan transaksi berhasil diperbarui!" : "Transaksi berhasil disimpan!", type: 'alert' });
      
      // Reset State Form input kasir kembali bersih
      setShowCheckoutReview(false);
      setCart([]);
      try { localStorage.removeItem('pos_draft_cart'); } catch { /* ignore */ }
      setMenuFiles([]);
      setEditSession(null);
      setEditOldItems([]);
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
        tempoDate: '',
        createdAt: getLocalDatetimeInput(), // 🟢 Reset dengan akurat
      });

      fetchData(); // Muat ulang grid inventaris barang & list overview di screen utama

    } catch (err: any) {
      console.error(err);
      // Never delete committed records after an uncertain network response. The durable sync queue
      // keeps the same request ID for retries, so server effects cannot be applied twice.
      setDialog({ show: true, title: 'Sinkronisasi Gagal', message: "Gagal menyimpan data entri: " + (err.message || err), type: 'alert' });
    } finally {
      clearTimeout(watchdog);
      submitLockRef.current = false;
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



  const handleEditHistoryToCart = (menuItem: HistoryMenu) => {
    setDialog({
      show: true, title: 'Edit Transaksi Ini?',
      message: 'Transaksi ini akan dimuat ulang ke keranjang. Menyimpan kembali akan menimpa data lama tanpa mengubah tanggalnya. Lanjutkan?',
      type: 'confirm',
      onConfirm: async () => {
        setDialog(prev => ({ ...prev, show: false }));
        try {
          const logs = await pb.collection('log_stock').getFullList<LogStockDetail>({ 
            filter: `ref = "${menuItem.id}" || ref_baru = "${menuItem.id}"`, 
            expand: 'item_baru',
            $autoCancel: false 
          });
          const reloadedCart: CartItem[] = [];

          for (const log of logs) {
            let prod: any = log.expand?.item_baru;

            if (!prod && log.item_baru) {
              prod = await pb.collection('produk').getOne(log.item_baru, { $autoCancel: false }).catch(() => null);
              if (!prod) {
                prod = await pb.collection('menu').getOne(log.item_baru, { $autoCancel: false }).catch(() => null);
              }
            }
            if (!prod && log.item) {
              prod = await pb.collection('produk').getFirstListItem(`id_lama = "${log.item}"`, { $autoCancel: false }).catch(() => null);
            }

            if (prod) {
              reloadedCart.push({ 
                ...prod, 
                qty: log.qty, 
                priceSelected: log.price_1, 
                manualPrice: log.price_1,      // 🔒 Kunci harga agar tidak berubah oleh tier
                isTiered: true,                // Tandai sebagai tiered agar UI menampilkan badge
                basePriceDefault: prod.sell_6 || prod.sell_1 || log.price_1 
              });
            } else {
              // Fallback jika record produk master tidak ditemukan di DB
              reloadedCart.push({
                id: log.item_baru || log.item || log.id,
                id_lama: log.item || '',
                kategori: 'Umum',
                merk: '',
                jenis: menuItem.jenis || 'produk',
                varian: '',
                keterangan: log.item || 'Item Transaksi',
                tipe: '',
                unit: 'Pcs',
                beli: log.price_2 || 0,
                sell_1: log.price_1 || 0,
                sell_2: log.price_1 || 0,
                sell_3: log.price_1 || 0,
                sell_4: log.price_1 || 0,
                sell_5: log.price_1 || 0,
                sell_6: log.price_1 || 0,
                min_1: 0, min_2: 0, min_3: 0, stok_3: 0,
                qty: log.qty,
                priceSelected: log.price_1,
                manualPrice: log.price_1,
                isTiered: true,
                basePriceDefault: log.price_1,
                activeTierName: 'Harga Nota'
              });
            }
          }

          if (logs.length > 0 && reloadedCart.length === 0) {
            setDialog({ show: true, title: 'Gagal Muat Item', message: 'Item transaksi tidak dapat dimuat ke keranjang. Edit dibatalkan.', type: 'alert' });
            return;
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
          let cashflowList: any[] = [];
          if (existingCashflows.length > 0) {
            cashflowList = existingCashflows.map(cf => ({
              id: cf.id,
              created_at: cf.created_at,
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
          setEditSession({ isEditing: true, menuId: menuItem.id, createdAt: menuItem.created_at, snapshot: menuItem });
          setEditOldItems(logs.map((l: any) => ({ item_baru: l.item_baru || '', item: l.item || '', qty: l.qty, boolean: l.boolean })));
          setShowDetailHistory(null); // Tutup modal
          setCartTab('items');
          setIsCartModalOpen(true);
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

  const deleteTransactionWithRevert = async (menuId: string) => {
    if (!menuId) return;
    await deleteFinancialRecord('menu', menuId);
  };

  const openQuickSettle = async (menu: HistoryMenu, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sisa = Math.max(0, (menu.total || 0) - (menu.dibayar || 0));
    
    // Refresh list akun kas agar nilai number_1 (saldo dompet) selalu akurat & up-to-date
    let currentAccounts = cashflowAccounts;
    try {
      currentAccounts = await pb.collection('dropdown').getFullList<DropdownItem>({
        filter: `jenis ~ "cashflow account"`,
        sort: 'text_1',
        $autoCancel: false
      });
      setCashflowAccounts(currentAccounts);
    } catch (err) {
      console.warn("Gagal merefresh akun kas untuk pelunasan cepat:", err);
    }

    const defaultAcc = currentAccounts.length > 0 ? currentAccounts[0].id : '';
    setQuickSettleData({
      show: true,
      menu,
      nominal: sisa,
      accountId: defaultAcc,
      note: `Pelunasan Nota ${menu.ref || menu.id}`,
      createdAt: getLocalDatetimeInput(),
      settleFiles: []
    });
  };

  const executeQuickSettle = async () => {
    if (!quickSettleData || !quickSettleData.menu || submitLockRef.current) return;
    const { menu: displayedMenu, nominal, accountId, note, createdAt } = quickSettleData;
    if (!accountId) {
      setDialog({ show: true, title: 'Validasi Gagal', message: 'Pilih akun kas penerima pembayaran!', type: 'alert' });
      return;
    }
    if (!Number.isFinite(Number(nominal)) || Number(nominal) <= 0) {
      setDialog({ show: true, title: 'Validasi Gagal', message: 'Nominal pelunasan harus lebih besar dari 0!', type: 'alert' });
      return;
    }

    submitLockRef.current = true;
    setIsProcessing(true);
    setProcessingMsg('Menyimpan pelunasan atomic batch...');

    try {
      // Satu round-trip paralel, bukan tiga berurutan; saldo diverifikasi ulang server-side oleh ledger.
      const [menu, personRec] = await Promise.all([
        pb.collection('menu').getOne<HistoryMenu>(displayedMenu.id, {$autoCancel:false}),
        displayedMenu.person && displayedMenu.person !== 'umum1'
          ? pb.collection('dropdown').getFirstListItem(`id_lama = "${displayedMenu.person}"`, { $autoCancel: false }).catch(() => null)
          : Promise.resolve(null)
      ]);
      settlementRemaining(Number(menu.total), Number(menu.dibayar), Number(nominal));
      const selectedAccount = cashflowAccounts.find(acc => acc.id === accountId);
      const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
      const mutasiValue = isIncomeTransaction(menu.jenis || '') ? 'in' : 'out';
      const timestamp = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
      const personRecordId = personRec ? personRec.id : '';

      // Saldo di-rebuild server-side oleh rebuildAccount; nilai ini hanya tampilan awal.
      const saldoAwal = Number(selectedAccount?.number_1) || 0;
      const saldoAkhir = mutasiValue === 'in' ? (saldoAwal + Number(nominal)) : (saldoAwal - Number(nominal));

      if (saldoAkhir < 0) throw new Error('Saldo akun tidak cukup untuk pelunasan ini.');

      // Akumulasi total dibayar dan status menu
      const currentPaid = Number(menu.dibayar || 0);
      const grandTotalVal = Number(menu.total || 0);
      const newPaid = currentPaid + Number(nominal);
      const newStatus = newPaid >= grandTotalVal ? 'lunas' : 'belum';
      const dateLunas = newStatus === 'lunas' ? (menu.date_lunas || new Date().toISOString()) : null;

      const updateData = new FormData();
      updateData.append('dibayar', String(newPaid));
      updateData.append('status', newStatus);
      if (dateLunas) updateData.append('date_lunas', dateLunas);

      if (quickSettleData.settleFiles && quickSettleData.settleFiles.length > 0) {
        quickSettleData.settleFiles.forEach((f: File) => {
          updateData.append('file+', f);
        });
      }

      // Gabungkan pembuatan Cashflow Pelunasan, Update Saldo Dompet & Update Menu ke dalam PocketBase Atomic Batch
      const batch = createFinancialBatch();

      batch.collection('cashflow').create({
        id_lama: '',
        operator: operatorName || pb.authStore.model?.username || 'Kasir',
        nominal: Number(nominal),
        jenis: menu.jenis || 'Penjualan',
        mutasi: mutasiValue,
        account_1: accountId,
        account_2: '',
        note: note || `Pelunasan POS Nota ${menu.id}`,
        ref_baru: menu.id,
        person: personRecordId,
        persontext: menu.person || '',
        acc1: accountIdLama,
        acc2: '',
        saldo_awal: saldoAwal,
        saldo_akhir: saldoAkhir,
        created_at: timestamp
      });

      updateData.set('atomic_expected',JSON.stringify(menu));
      batch.collection('menu').update(menu.id, updateData);

      await batch.send([], () => setQuickSettleData(null));

      const updatedMenuRecord = await pb.collection('menu').getOne(menu.id).catch(() => null);
      const finalStatus = updatedMenuRecord?.status || newStatus;

      // Refresh akun kas lokal
      try {
        const freshAccounts = await pb.collection('dropdown').getFullList<DropdownItem>({
          filter: `jenis ~ "cashflow account"`,
          sort: 'text_1',
          $autoCancel: false
        });
        setCashflowAccounts(freshAccounts);
      } catch {}

      setQuickSettleData(null);
      if (showDetailHistory?.id === menu.id) {
        setShowDetailHistory(prev => prev ? { 
          ...prev, 
          dibayar: newPaid, 
          status: finalStatus as any,
          date_lunas: dateLunas || prev.date_lunas,
          file: updatedMenuRecord?.file || prev.file
        } : null);
      }
      fetchData();
      setDialog({
        show: true,
        title: 'Pelunasan Sukses!',
        message: `Pembayaran sebesar Rp ${formatAmount(nominal)} berhasil dicatat. Status nota saat ini: ${String(finalStatus).toUpperCase()}`,
        type: 'alert'
      });
    } catch (err: any) {
      console.error('Quick Settle Error:', err);
      setDialog({ show: true, title: 'Gagal Pelunasan', message: 'Terjadi kesalahan saat menyimpan pelunasan: ' + (err.message || err), type: 'alert' });
    } finally {
      submitLockRef.current = false;
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  const handleDeleteHistory = async (menuItem: HistoryMenu) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
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
      if (editSession?.menuId === menuItem.id) {
        setEditSession(null);
        setEditOldItems([]);
        setCart([]);
        setMenuFiles([]);
        setExistingMenuFiles([]);
      }
      fetchData();
      setShowDetailHistory(null);
      setDialog({ show: true, title: 'Sukses Hapus', message: 'Data transaksi berhasil dihapus. Stok produk dan data kas telah dikembalikan.', type: 'alert' });
    } catch (e: any) {
      console.error(e);
      setDialog({ show: true, title: 'Gagal Hapus', message: 'Gagal menghapus data transaksi: ' + (e.message || e), type: 'alert' });
    } finally {
      window.removeEventListener('beforeunload', blockUnload);
      submitLockRef.current = false;
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

  return (
    <fieldset disabled={isProcessing} className="h-screen min-w-0 border-0 m-0 p-0">
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      <div className="flex-1 flex flex-col p-3 md:p-6 lg:p-8 pt-20 md:pt-6 overflow-hidden w-full transition-colors duration-500">
         
        {/* Nav Tabs */}
        <PosNavbar
          showNavbar={showNavbar}
          menuOptions={menuOptions}
          userLevel={userLevel}
          selectedMenu={selectedMenu}
          getThemeConfig={getThemeConfig}
          handleMenuChange={handleMenuChange}
        />

        {/* Search Bar & Filters - Clean & Consistent */}
        <PosFilterBar
          selectedMenu={selectedMenu}
          activeTheme={activeTheme}
          searchInputRef={searchInputRef}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterPerson={filterPerson}
          setFilterPerson={setFilterPerson}
          selectedMenuFilters={selectedMenuFilters}
          setSelectedMenuFilters={setSelectedMenuFilters}
          allPersons={allPersons}
          personButtonRef={personButtonRef}
          isPersonFilterOpen={isPersonFilterOpen}
          setIsPersonFilterOpen={setIsPersonFilterOpen}
          dropdownPosition={dropdownPosition}
          setDropdownPosition={setDropdownPosition}
          personFilterSearch={personFilterSearch}
          setPersonFilterSearch={setPersonFilterSearch}
          menuOptions={menuOptions}
          setPage={setPage}
        />

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
        {selectedMenu?.toLowerCase() === 'overview' && showFilters && 
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
                          {formatRupiah((p.sell_6 || 0))}
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
                              {getPersonDisplayText(h.person, 'PELANGGAN UMUM')}
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
                                <span className="text-xs font-black text-emerald-600">Total: {formatRupiah((h.total || 0))}</span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-500 line-through">{formatRupiah((h.total || 0))}</span>
                                  <span className="text-xs font-black text-rose-600">Sisa: {formatRupiah(Math.max(0, (h.total || 0) - (h.dibayar || 0)))}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => openQuickSettle(h, e)}
                                    className="mt-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-1 transition-colors"
                                    title="Pelunasan Cepat"
                                  >
                                    <Wallet size={12} />
                                    <span>Pelunasan Cepat</span>
                                  </button>
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
                                  {formatRupiah((item.total || 0))}
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
          aria-label="Buka keranjang"
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

      {/* POS: bounded modal, persistent tabs and a separate action footer. */}
      <Modal isOpen={isCartModalOpen && !showCheckoutReview} onClose={() => !isProcessing && setIsCartModalOpen(false)} title={`${editSession ? 'Edit' : 'Transaksi'} ${selectedMenu}`} maxWidth="max-w-2xl" compact>
        <div className="pos-modal-layout">
          <nav className="pos-modal-tabs" aria-label="Bagian form transaksi">
            {([{id:'items',label:'Barang & jasa',Icon:Package},{id:'payment',label:'Pembayaran',Icon:Wallet},{id:'notes',label:'Catatan',Icon:FileText}] as const).map(({id,label,Icon}) => <button type="button" key={id} aria-pressed={cartTab===id} onClick={() => { setCartTab(id); setIsPaymentFormOpen(id==='payment'); setIsPersonDropdownOpen(false); }} className={cartTab===id ? `${activeTheme.light} ${activeTheme.text}` : 'text-slate-500'}><Icon size={16}/>{label}</button>)}
          </nav>
          <div className="pos-modal-scroll pos-form-fields">
          {editSession?.isEditing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-2 mb-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-blue-900">
                  Mode Edit Nota ({editSession.menuId.slice(0, 8)}...)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  confirmAction(
                    'Batalkan Edit?',
                    'Keranjang akan dibersihkan dan kembali ke mode transaksi baru. Lanjutkan?',
                    () => {
                      setCart([]);
                      setEditSession(null);
                      setEditOldItems([]);
                      setMenuFiles([]);
                      setExistingMenuFiles([]);
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
                        tempoDate: '',
                        createdAt: getLocalDatetimeInput(),
                      });
                    }
                  );
                }}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold uppercase transition-colors"
              >
                <X size={14}/> Batal edit
              </button>
            </div>
          )}

            <section hidden={cartTab !== 'items'} className="space-y-4">
              <div data-field="cart" tabIndex={-1} className="outline-none">
                <FieldError message={fieldErrors.cart} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-medium text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
                    />
                  </div>
                </div>

                
                {/* 1. Pelanggan & Bayar */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><Users size={14}/> Pelanggan</label>
                    
                    {/* 🟢 Custom Searchable Dropdown */}
                    <div className="relative mt-2">
                      <div 
                        onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)}
                        className={`w-full p-3 text-xs md:text-sm font-medium text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl cursor-pointer flex justify-between items-center shadow-sm hover:border-slate-300 transition-colors`}
                      >
                        <span className="truncate">
                          {getPersonDisplayText(formBayar.personIdLama, 'Pilih Pelanggan...')}
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
                                placeholder="Cari nama / HP pelanggan..."
                                className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 placeholder-slate-400"
                                value={personSearch}
                                onChange={e => setPersonSearch(e.target.value)}
                              />
                            </div>
                            
                            {/* Area List Pelanggan Terfilter */}
                            <div className="max-h-48 overflow-y-auto custom-scrollbar bg-white">
                              {personOptions.filter(p => p.text_1.toLowerCase().includes(personSearch.toLowerCase()) || ((p as any).text_2 && (p as any).text_2.toLowerCase().includes(personSearch.toLowerCase())) || p.id_lama.toLowerCase().includes(personSearch.toLowerCase())).length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 font-bold">Pelanggan tidak ditemukan</div>
                              ) : (
                                personOptions
                                  .filter(p => p.text_1.toLowerCase().includes(personSearch.toLowerCase()) || ((p as any).text_2 && (p as any).text_2.toLowerCase().includes(personSearch.toLowerCase())) || p.id_lama.toLowerCase().includes(personSearch.toLowerCase()))
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
                                      <span className="truncate">{p.text_1}{(p as any).text_2 ? ` - ${(p as any).text_2}` : ''}</span>
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
                </div>

              </div>
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-sm">Item transaksi ({cart.length})</h3><button type="button" className={`pos-action ${activeTheme.light} ${activeTheme.text}`} onClick={() => setShowCartCatalog(v => !v)}><Plus size={16}/> Tambah item</button></div>
              {showCartCatalog && <div className="p-3 border border-slate-200 rounded-xl space-y-2">
                <label className="text-xs font-medium block">Cari barang di katalog<input aria-label="Cari barang di katalog" value={searchInput} onChange={e => {setSearchInput(e.target.value);setPage(1);}} className="w-full mt-2 p-2 border border-slate-200 rounded-lg" placeholder="Nama / kode barang"/></label>
                {loading ? <p role="status" className="text-xs">Memuat barang…</p> : products.length === 0 ? <p className="text-xs">Barang tidak ditemukan.</p> : products.map(product => <button type="button" key={product.id} onClick={() => addToCart(product)} className="flex w-full items-center justify-between gap-2 border-b border-slate-100 py-2 text-left text-xs"><span>{getFullLabel(product)}<small className="block text-slate-500">Stok: {product.stok_3} {product.unit}</small></span><span className="pos-action"><Plus size={14}/> Tambah</span></button>)}
                <div className="flex justify-between items-center text-xs"><button type="button" className="pos-action" disabled={page<=1 || loading} onClick={() => setPage(p => p-1)}><ChevronLeft size={14}/> Sebelumnya</button><span>{page} / {Math.max(1,totalPages)}</span><button type="button" className="pos-action" disabled={page>=totalPages || loading} onClick={() => setPage(p => p+1)}>Berikutnya <ChevronRight size={14}/></button></div>
              </div>}
              <div className="space-y-3">
                {cart.length === 0 && selectedMenu.toLowerCase().includes('service') && (
                  <div className="text-center py-8 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    Tidak ada sparepart/item fisik. Hanya mencatat nota jasa service.
                  </div>
                )}
                {cartWithTierPrice.map(item => {
                  const canEditPrice = pb.authStore.isValid;
                  return (
                    <div key={item.id} className={`bg-slate-50/70 hover:bg-white border ${activeTheme.border} rounded-2xl p-3 sm:p-3.5 relative group transition-all shadow-sm`}>
                      
                      {/* BARIS UTAMA: ID, NAMA PRODUK, TIER, TOMBOL HAPUS */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`font-black ${activeTheme.text} bg-white px-2 py-0.5 rounded-md text-[10px] tracking-tight border border-slate-200 shadow-2xs`}>
                              #{formatIdLamaDisplay(item.id_lama)}
                            </span>
                            {(item.isTiered || item.activeTierName) && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${activeTheme.light} ${activeTheme.text} border border-slate-200/50`}>
                                {item.activeTierName}
                              </span>
                            )}
                            {item.priceSelected !== item.sell_6 && !selectedMenu.toLowerCase().includes('pembelian') && (
                              <span className="text-[10px] text-slate-400 line-through font-bold">
                                {formatRupiah(item.sell_6)}
                              </span>
                            )}
                          </div>
                          <p className="font-black text-slate-800 text-xs md:text-sm line-clamp-1 leading-snug">
                            {getFullLabel(item)}
                          </p>
                        </div>

                        <button
                          onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                          className="text-rose-500 hover:text-rose-600 pos-action rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                          title="Hapus dari keranjang"
                        >
                          <Trash2 size={16} /> Hapus
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                        <span className="text-xs text-slate-500">{item.manualPrice !== undefined ? 'Harga manual tetap saat jumlah berubah' : 'Harga otomatis sesuai jumlah & pelanggan'}</span>
                        {item.manualPrice !== undefined && canEditPrice && <button type="button" className="pos-action text-slate-600" onClick={() => setCart(prev => prev.map(row => { if (row.id !== item.id) return row; const { manualPrice: _manual, ...automatic } = row; return automatic; }))}><RotateCcw size={14}/> Harga otomatis</button>}
                      </div>
                      <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer">Aturan harga barang ini</summary>
                        <dl className="grid grid-cols-2 gap-2 pt-2">
                          {selectedMenu.toLowerCase().includes('pembelian') ? <><dt>Beli lama</dt><dd>{formatRupiah(Number(item.beli))}</dd></> : <>
                            <dt>Eceran</dt><dd>{formatRupiah(Number(item.sell_6))}</dd>
                            <dt>Pelanggan</dt><dd>{formatRupiah(Number(item.sell_5))}</dd>
                            {([[item.min_3,item.sell_3,'Grosir kecil'],[item.min_2,item.sell_2,'Grosir sedang'],[item.min_1,item.sell_1,'Grosir besar']] as const).filter(([min]) => min > 0).map(([min, price, label]) => <div className="contents" key={label}><dt>{label} · ≥ {min}</dt><dd>{formatRupiah(Number(price))}</dd></div>)}
                          </>}
                        </dl>
                      </details>
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
                            aria-label={`Jumlah ${getFullLabel(item)}`}
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
                                  aria-label={`Harga satuan ${getFullLabel(item)}`}
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
                                {formatAmount(item.priceSelected)}
                              </span>
                            )}
                          </div>

                          <div className={`text-xs md:text-sm font-black text-white ${activeTheme.main} px-3 py-1.5 rounded-lg shadow-sm text-right min-w-[90px]`}>
                            {formatRupiah((item.qty * item.priceSelected))}
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>

                {/* 5. Mekanik (Khusus Service) */}
                <MechanicSection
                  selectedMenu={selectedMenu}
                  activeTheme={activeTheme}
                  formBayar={formBayar}
                  setFormBayar={setFormBayar}
                  grandTotal={grandTotal}
                  mechanics={mechanics}
                  setDialog={setDialog}
                  error={fieldErrors.mechanic || fieldErrors.mechanicOngkos}
                  onChange={() => { clearFieldError('mechanic'); clearFieldError('mechanicOngkos'); }}
                />


            </section>
            <section hidden={cartTab !== 'payment'} className="space-y-4">
              <div>
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
                        cashflowList: [...prev.cashflowList, { id: '', created_at: '', accountId: '', nominal: 0 }]
                      }))}
                      className={`text-[10px] font-black bg-white ${activeTheme.text} px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border}`}
                    >
                      <Plus size={14}/> Tambah pembayaran
                    </button>
                  </div>
                  
                  <div className="space-y-2.5">
                  {formBayar.cashflowList.map((cf, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center bg-white p-3 rounded-2xl border border-white/80 shadow-sm">
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
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 self-end sm:self-auto"
                        title="Hapus baris pembayaran"
                      >
                        <Trash2 size={16} /> Hapus
                      </button>
                    )}
                    {/* Dropdown Akun Kas */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={cf.accountId}
                        data-field="paymentAccount"
                        onChange={e => {
                          const newList = [...formBayar.cashflowList];
                          newList[idx].accountId = e.target.value;
                          setFormBayar({ ...formBayar, cashflowList: newList });
                          clearFieldError('paymentAccount');
                        }}
                        className="w-full p-3 text-xs md:text-sm font-bold text-slate-700 border-none bg-slate-50 hover:bg-slate-100 rounded-xl outline-none cursor-pointer"
                      >
                        <option value="">Pilih Akun Bank/Tunai...</option>
                        {cashflowAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.text_1}</option>
                        ))}
                      </select>
                    </div>

                    {/* Input Nominal */}
                    <div className="relative w-full sm:w-48 shrink-0">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black ${activeTheme.text}`}>Rp</span>
                      <input
                        type="number"
                        placeholder="Nominal"
                        value={cf.nominal || ''}
                        data-field="paymentNominal"
                        onChange={e => {
                          const newList = [...formBayar.cashflowList];
                          newList[idx].nominal = Number(e.target.value);
                          setFormBayar({ ...formBayar, cashflowList: newList });
                          clearFieldError('paymentNominal');
                        }}
                        className="w-full pl-9 pr-3 py-3 text-xs md:text-sm font-black text-slate-800 border-none bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  </div>
                  ))}
                  </div>

                  <div data-field="paymentRows" tabIndex={-1} className="outline-none">
                    <FieldError message={fieldErrors.paymentAccount || fieldErrors.paymentNominal} />
                  </div>

                  {/* Total Dibayar & Tombol Uang Pas (Auto Lunas) ditaruh dibawahnya */}
                  <div className="flex justify-between items-center pt-3 border-t border-black/5">
                    <span className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase`}>Total Dibayar:</span>
                    <span className="text-base md:text-lg font-black text-slate-800 bg-white px-4 py-1.5 rounded-xl shadow-sm border border-slate-100">
                      {formatRupiah(formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0))}
                    </span>
                  </div>

                  {/* Live Status Kembalian / Sisa Piutang Badge */}
                  {(() => {
                    const totalDibayarCalc = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                    const selisih = totalDibayarCalc - grandTotal;
                    if (selisih > 0) {
                      return (
                        <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex justify-between items-center text-xs font-bold text-emerald-800 shadow-sm animate-in fade-in">
                          <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-500"/> Kembalian:</span>
                          <span className="font-black text-emerald-700 text-sm md:text-base">{formatRupiah(selisih)}</span>
                        </div>
                      );
                    } else if (selisih < 0) {
                      return (
                        <div className="p-3 bg-rose-50/90 border border-rose-200 rounded-2xl flex justify-between items-center text-xs font-bold text-rose-800 shadow-sm animate-in fade-in">
                          <span className="flex items-center gap-1.5"><AlertCircle size={14} className="text-rose-500"/> Sisa Kurang (Piutang):</span>
                          <span className="font-black text-rose-700 text-sm md:text-base">{formatRupiah(Math.abs(selisih))}</span>
                        </div>
                      );
                    } else if (totalDibayarCalc > 0) {
                      return (
                        <div className="p-2.5 bg-white/80 border border-emerald-200/80 rounded-2xl flex justify-between items-center text-xs font-bold text-slate-700 shadow-sm animate-in fade-in">
                          <span className="flex items-center gap-1.5 text-slate-500"><CheckCircle2 size={14} className="text-emerald-500"/> Status Pembayaran:</span>
                          <span className="font-black text-emerald-600 text-xs uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100">Pas / Lunas</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      const kasirAcc = cashflowAccounts.find(a => a.text_1.toLowerCase().includes('kasir') || a.text_1.toLowerCase().includes('cash')) || cashflowAccounts[0];
                      const newList = [...formBayar.cashflowList];
                      const sumOther = newList.reduce((acc, curr, i) => i !== 0 ? acc + (curr.nominal || 0) : acc, 0);
                      const remaining = Math.max(0, grandTotal - sumOther);
                      if (newList.length > 0) {
                        newList[0].nominal = remaining;
                        if (kasirAcc && !newList[0].accountId) {
                          newList[0].accountId = kasirAcc.id;
                        }
                      } else {
                        newList.push({
                          id: '',
                          created_at: '',
                          accountId: kasirAcc ? kasirAcc.id : '',
                          nominal: remaining
                        });
                      }
                      setFormBayar(prev => ({
                        ...prev,
                        payment: 'Tunai',
                        nominalBayar: grandTotal,
                        cashflowList: newList
                      }));
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
                    title="Auto Lunas (Isi Uang Pas & Akun Kas Kasir)"
                  >
                    <Zap size={16} fill="currentColor" /> Uang Pas (Auto Lunas)
                  </button>
                </div>

                {/* 3. Jatuh Tempo */}
                {formBayar.payment === 'Tempo' && (
                  <div className="animate-in fade-in zoom-in duration-300 bg-rose-50 p-4 rounded-3xl border-2 border-rose-200 shadow-inner">
                    <label className="text-[10px] md:text-[11px] font-black text-rose-500 uppercase tracking-wider ml-1 flex items-center gap-1.5"><Calendar size={14}/> Tanggal Jatuh Tempo</label>
                    <input
                      type="date"
                      value={formBayar.tempoDate} // 🟢 Menggunakan state tempoDate
                      data-field="tempoDate"
                      onChange={e => { setFormBayar({ ...formBayar, tempoDate: e.target.value }); clearFieldError('tempoDate'); }}
                      className="w-full mt-2 p-3 text-sm font-bold text-slate-700 bg-white border-2 border-rose-100 rounded-xl focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-sm"
                    />
                    <FieldError message={fieldErrors.tempoDate} />
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
                        data-field="marketplace"
                        onChange={e => { setFormBayar({ ...formBayar, marketplace: e.target.value }); clearFieldError('marketplace'); }}
                        className="w-full mt-2 p-3 text-xs md:text-sm font-bold bg-white border-2 border-amber-100 focus:border-amber-400 rounded-xl outline-none shadow-sm"
                      />
                      <FieldError message={fieldErrors.marketplace} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-600 uppercase ml-1">Biaya admin (−)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formBayar.adminFee}
                        data-field="adminFee"
                        onChange={e => { setFormBayar({ ...formBayar, adminFee: Number(e.target.value) }); clearFieldError('adminFee'); }}
                        className="w-full mt-2 p-3 text-xs md:text-sm font-bold bg-white border-2 border-amber-100 focus:border-amber-400 rounded-xl outline-none shadow-sm"
                      />
                      <FieldError message={fieldErrors.adminFee} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-600 uppercase ml-1">Cashback (+)</label>
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


            </section>
            <section hidden={cartTab !== 'notes'} className="space-y-4">
                {/* 6. Catatan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><FileText size={14}/> Catatan nota</label>
                    <textarea
                      rows={3}
                      placeholder="Contoh: Garansi 1 Minggu..."
                      value={formBayar.noteMenu}
                      data-field="note"
                      onChange={e => { setFormBayar({ ...formBayar, noteMenu: e.target.value }); clearFieldError('note'); }}
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-medium text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
                    />
                    <FieldError message={fieldErrors.note} />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><EyeOff size={14}/> Catatan kas (internal)</label>
                    <textarea
                      rows={3}
                      placeholder="Informasi kasir (tidak di-print)..."
                      value={formBayar.note}
                      onChange={e => setFormBayar({ ...formBayar, note: e.target.value })}
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-medium text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
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
                        <span className="text-rose-500 bg-rose-100 px-2 py-0.5 rounded text-[9px] ml-1">Untuk status lunas</span>
                      )}
                    </label>

                    <label className={`cursor-pointer text-[10px] font-black bg-white ${activeTheme.text} px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border}`}>
                      <Upload size={14}/> Tambah file
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

                          <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(URL.createObjectURL(file), '_blank')}
                              className="pos-action bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                              title="Lihat file"
                            >
                              <Eye size={16} /> Lihat
                            </button>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2 text-white text-[9px] truncate font-bold">
                            {file.name} <span className="text-emerald-400">(tersimpan)</span>
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
                          <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(url, '_blank')}
                              className="pos-action bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                              title="Lihat file di tab baru"
                            >
                              <Eye size={16} /> Lihat
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                // Hapus file baru
                                setMenuFiles(prev => prev.filter((_, i) => i !== idx));
                                // Revoke URL agar tidak memory leak
                                URL.revokeObjectURL(url);
                              }}
                              className="pos-action bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                              title="Hapus file"
                            >
                              <Trash2 size={16} /> Hapus
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
                        <Trash2 size={14}/> Hapus file baru
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


                </div>


            </section>
          </div>
          <footer className="pos-modal-footer">
            <div><span className="text-xs text-slate-500">Total tagihan</span><p className={`text-xl font-bold tabular-nums ${activeTheme.text}`}>{formatRupiah(grandTotal)}</p><small className="text-slate-500">{cart.length} item · Dibayar {formatRupiah(formBayar.cashflowList.reduce((sum,cf) => sum+(cf.nominal||0),0))}</small></div>
            <button type="button" disabled={isProcessing} onClick={handleCheckoutValidation} className={`pos-action ${activeTheme.main} text-white`}><CheckCircle2 size={16}/>{isProcessing ? 'Menyimpan…' : 'Periksa transaksi'}</button>
          </footer>
        </div>
      </Modal>

      {/* ========================================================= */} 
      {/* 1. MODAL OVERVIEW RE-CHECK SEBELUM EXECUTE STORING DATA */} 
      {/* ========================================================= */} 
      <Modal isOpen={showCheckoutReview} onClose={() => !isProcessing && setShowCheckoutReview(false)} title="Periksa transaksi" maxWidth="max-w-2xl" compact>
        <div className="pos-modal-layout">
          <div className="pos-modal-scroll pos-form-fields space-y-4">
            {(() => {
              const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
              const selisih = grandTotal - totalDibayar;
              const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
              const hasMedia = menuFiles.length > 0 || (editSession?.isEditing && existingMenuFiles.length > 0);
              const isLunas = totalDibayar >= grandTotal;
              const statusText = isPembelian && !hasMedia ? 'BELUM (Menunggu Bukti Media)' : (isLunas ? 'LUNAS' : 'BELUM LUNAS');
              const statusClass = isPembelian && !hasMedia
                ? 'bg-amber-50 border-amber-100 text-amber-700'
                : (isLunas ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700');
              const paymentRows = formBayar.cashflowList.filter(cf => cf.accountId || cf.nominal);
              const mechanicRows = formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0);
              return (
                <>
                  {/* Identitas transaksi + status */}
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{editSession ? 'Validasi update nota terakhir' : 'Periksa sebelum menyimpan'}</p>
                        <p className="text-base font-semibold text-slate-800 mt-0.5 break-words">{getPersonDisplayText(formBayar.personIdLama, 'Umum')}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">{selectedMenu}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formBayar.payment}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatLocalDateTime(formBayar.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{isIncomeTransaction(selectedMenu) ? 'Debet (Masuk)' : 'Kredit (Keluar)'}</span>
                          <span aria-hidden="true">·</span>
                          <span>Kasir {operatorName}</span>
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-xl border px-3 py-2 text-right ${statusClass}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Status nota</p>
                        <p className="text-xs font-bold">{statusText}</p>
                      </div>
                    </div>
                    {isPembelian && !hasMedia && <p className="text-[11px] text-amber-600 mt-2">Upload bukti nota agar bisa berstatus LUNAS</p>}
                  </section>

                  {/* Angka utama: total, dibayar, sisa */}
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700 tabular-nums">
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-xs">Total tagihan</dt>
                      <dd className={`text-xl font-semibold ${activeTheme.text}`}>{formatRupiah(grandTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs">Dibayar</dt>
                      <dd className="font-semibold">{formatRupiah(totalDibayar)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs">{selisih < 0 ? 'Kembalian' : 'Sisa tagihan'}</dt>
                      <dd className="font-semibold">{formatRupiah(Math.abs(selisih))}</dd>
                    </div>
                  </dl>

                  {/* Kembali ke bagian yang perlu diperbaiki */}
                  <div className="flex flex-wrap gap-2">
                    {([{id:'items',label:'Ubah barang',Icon:Package},{id:'payment',label:'Ubah pembayaran',Icon:Wallet},{id:'notes',label:'Ubah catatan',Icon:FileText}] as const).map(({id,label,Icon}) => <button type="button" className="pos-action bg-slate-100" key={id} onClick={() => { setShowCheckoutReview(false); setCartTab(id); }}><Icon size={14}/>{label}</button>)}
                  </div>

                  <button type="button" onClick={() => setShowReviewDetails(prev => !prev)} aria-expanded={showReviewDetails} className="inline-flex w-full min-h-[36px] items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200">
                    <span className="flex items-center gap-2"><ListOrdered size={14}/> {showReviewDetails ? 'Sembunyikan rincian' : 'Lihat rincian'}</span>
                    <span className="text-slate-400">{showReviewDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
                  </button>

                  {showReviewDetails && (
                    <div className="space-y-4">
                      {/* Barang & jasa */}
                      <section className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Barang &amp; jasa <span className="text-slate-400">· {totalQtyKeranjang} item</span></p>
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                          {cartWithTierPrice.map(item => (
                            <div key={item.id} className="p-3 flex justify-between items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-800 break-words">{getFullLabel(item)}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{item.qty} {item.unit} x {formatRupiah(item.priceSelected)}</p>
                                {selectedMenu.toLowerCase() !== 'pembelian' && <p className="text-[11px] text-slate-400">Normal: {formatRupiah((item.sell_6 * item.qty))}</p>}
                              </div>
                              <p className="font-semibold text-slate-900 shrink-0">{formatRupiah((item.priceSelected * item.qty))}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">Total produk: {formatRupiah(totalBelanja)}</p>
                      </section>

                      {/* Pembayaran per akun */}
                      <section className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Pembayaran per akun</p>
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                          {paymentRows.length === 0 && <p className="p-3 text-xs text-slate-400">Belum ada akun kas yang dipilih.</p>}
                          {paymentRows.map((cf, idx) => {
                            const accName = cashflowAccounts.find(a => a.id === cf.accountId)?.text_1 || 'Akun Belum Dipilih';
                            return (
                              <div key={idx} className="p-3 flex justify-between items-center gap-3">
                                <span className="font-semibold text-slate-600 truncate">#{idx + 1} {accName}</span>
                                <span className="font-semibold text-slate-900 shrink-0">{formatRupiah((cf.nominal || 0))}</span>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      {/* Alokasi ongkos mekanik */}
                      {selectedMenu.toLowerCase().includes('service') && mechanicRows.length > 0 && (
                        <section className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600">Alokasi ongkos mekanik</p>
                          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                            {mechanicRows.map((mek, idx) => (
                              <div key={idx} className="p-3 flex justify-between items-center gap-3">
                                <span className="font-semibold text-slate-600">{mek.idLama}</span>
                                <span className="font-semibold text-slate-900">{formatRupiah((mek.ongkos || 0))}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Detail marketplace online */}
                      {isOnlinePerson && (
                        <section className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600">Detail marketplace online</p>
                          <dl className="text-xs text-slate-700 space-y-1">
                            <div className="flex justify-between gap-3"><dt className="text-slate-500">Platform</dt><dd className="font-semibold">{formBayar.marketplace || '-'}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-slate-500">Potongan admin</dt><dd className="font-semibold text-rose-600">- {formatRupiah((formBayar.adminFee || 0))}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-slate-500">Cashback</dt><dd className="font-semibold text-emerald-600">+ {formatRupiah((formBayar.cashback || 0))}</dd></div>
                          </dl>
                        </section>
                      )}

                      {/* Catatan & lampiran */}
                      <section className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Catatan &amp; lampiran</p>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{formBayar.noteMenu || 'Tidak ada catatan nota.'}</p>
                        <p className="text-[11px] text-slate-500">Lampiran: {existingMenuFiles.length + menuFiles.length} file</p>
                      </section>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="pos-modal-footer">
            <button type="button" onClick={() => setShowCheckoutReview(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-slate-500 text-xs tracking-widest transition-colors"><ChevronLeft size={16}/> Kembali</button>
            <button type="button" onClick={executeStoringData} disabled={isProcessing} className={`flex-[2] py-4 text-white rounded-2xl font-black text-sm shadow-xl tracking-widest transition-all active:scale-95 ${activeTheme.main} ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> {processingMsg || 'MENYIMPAN KE DATABASE...'}</span>
              ) : <><Save size={16}/> Simpan transaksi</>}
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
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Cust:</span> <span>{getPersonDisplayText(showDetailHistory.person, 'Umum')}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Kasir:</span> <span>{showDetailHistory.operator || operatorName}</span></p>
            </div>
            {historyItems.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                {historyItems.map((item, i) => (
                  <div key={i} style={{marginBottom:'4px'}}>
                    <p style={{fontWeight:700,margin:'1px 0',fontSize:'10px',textTransform:'uppercase'}}>{getFullLabel(item.expand?.item_baru)}</p>
                    <p style={{margin:'1px 0',display:'flex',justifyContent:'space-between',color:'#475569'}}>
                      <span>{item.qty} x {formatRupiah(Number(item.price_1))}</span>
                      <b style={{color:'#1e293b'}}>{formatRupiah(Number(item.price_1 * item.qty))}</b>
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
                    <b>{formatRupiah(Number(cf.nominal))}</b>
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
                    <b>{formatRupiah(Number(o.ongkos))}</b>
                  </p>
                ))}
              </div>
            )}
            <div style={{padding:'8px',backgroundColor:'#f8fafc',borderBottom:'2px dashed #cbd5e1'}}>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between',fontSize:'12px',fontWeight:900}}>
                <span>TOTAL:</span><span>{formatRupiah(Number(showDetailHistory.total))}</span>
              </p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between',color:'#475569',fontSize:'10px'}}>
                <span>DIBAYAR:</span><span>{formatRupiah(Number(showDetailHistory.dibayar))}</span>
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
        maxWidth="max-w-2xl" compact
        title={showDetailHistory?.jenis?.toLowerCase().includes('gaji') ? "Rincian Perangkum & Slip Gaji Karyawan" : "Detail transaksi"}
      >
        {showDetailHistory && (
          <div className="pos-modal-layout pos-detail-fields">
            
            {!showDetailHistory.jenis.toLowerCase().includes('gaji') && <nav className="pos-modal-tabs" aria-label="Bagian detail transaksi">
              {([{id:'detail',label:'Ringkasan',Icon:Info},{id:'items',label:'Barang & jasa',Icon:Package},{id:'payments',label:'Pembayaran',Icon:Wallet}] as const).map(({id,label,Icon}) => <button type="button" key={id} aria-pressed={activeTab===id} onClick={() => setActiveTab(id)} className={activeTab===id ? `${getThemeConfig(showDetailHistory.jenis).light} ${getThemeConfig(showDetailHistory.jenis).text}` : 'text-slate-500'}><Icon size={16}/>{label}</button>)}
            </nav>}

            {/* KONTEN SCROLLABLE */}
            <div className="pos-modal-scroll space-y-4">
              
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
                                          {formatRupiah(Number(gRec.diterima))},00
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
                                          {formatRupiah(gSal.total1)}
                                        </span>
                                      </div>
                                      <div className="space-y-1 text-[11px]">
                                        <div className="flex justify-between text-slate-600"><span>Gaji Pokok:</span><strong className="text-slate-800">{formatRupiah((gSal.t1.pokok || 0))}</strong></div>
                                        <div className="flex justify-between text-slate-600"><span>Tunjangan:</span><strong className="text-slate-800">{formatRupiah((gSal.t1.tunjangan || 0))}</strong></div>
                                        {gSal.t1.bonus_1 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 1:</span><strong className="text-slate-800">{formatRupiah(gSal.t1.bonus_1)}</strong></div>}
                                        {gSal.t1.bonus_2 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 2:</span><strong className="text-slate-800">{formatRupiah(gSal.t1.bonus_2)}</strong></div>}
                                        {gSal.t1.bonus_3 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 3:</span><strong className="text-slate-800">{formatRupiah(gSal.t1.bonus_3)}</strong></div>}
                                        {gSal.t1.bonus_4 > 0 && <div className="flex justify-between text-slate-600"><span>Bonus 4:</span><strong className="text-slate-800">{formatRupiah(gSal.t1.bonus_4)}</strong></div>}
                                        {gSal.t1.program > 0 && <div className="flex justify-between text-slate-600"><span>Program:</span><strong className="text-slate-800">{formatRupiah(gSal.t1.program)}</strong></div>}
                                        {gSal.t1.lembur > 0 && <div className="flex justify-between text-slate-600"><span>Lembur:</span><strong className="text-slate-800">{formatRupiah(gSal.t1.lembur)}</strong></div>}
                                      </div>
                                    </div>

                                    {/* Card 2 & 3: Potongan (-) */}
                                    <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2">
                                      <div className="flex justify-between items-center border-b border-rose-200/60 pb-1.5">
                                        <span className="text-[11px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-1">
                                          <AlertCircle size={13} className="text-rose-600" /> 2 & 3. Potongan (-)
                                        </span>
                                        <span className="text-xs font-black text-rose-700">
                                          -{formatRupiah((gSal.total2 + gSal.total3))}
                                        </span>
                                      </div>
                                      <div className="space-y-1 text-[11px]">
                                        {gSal.t2.alfa > 0 && <div className="flex justify-between text-slate-600"><span>Alfa ({gRec.alfa} hr):</span><strong className="text-rose-700">-{formatRupiah(Math.round(gSal.t2.alfa))}</strong></div>}
                                        {gSal.t2.setengah_hari > 0 && <div className="flex justify-between text-slate-600"><span>1/2 Hari ({gRec.setengah_hari} hr):</span><strong className="text-rose-700">-{formatRupiah(Math.round(gSal.t2.setengah_hari))}</strong></div>}
                                        {gSal.t2.sakit > 0 && <div className="flex justify-between text-slate-600"><span>Sakit ({gRec.sakit} hr):</span><strong className="text-rose-700">-{formatRupiah(Math.round(gSal.t2.sakit))}</strong></div>}
                                        {gSal.t2.telat > 0 && <div className="flex justify-between text-slate-600"><span>Telat ({gRec.telat} mnt):</span><strong className="text-rose-700">-{formatRupiah(Math.round(gSal.t2.telat))}</strong></div>}
                                        {gSal.t3.bpjs > 0 && <div className="flex justify-between text-slate-600"><span>BPJS:</span><strong className="text-rose-700">-{formatRupiah(gSal.t3.bpjs)}</strong></div>}
                                        {gSal.t3.bon_dibayar > 0 && <div className="flex justify-between text-slate-600"><span>Bayar Bon:</span><strong className="text-rose-700">-{formatRupiah(gSal.t3.bon_dibayar)}</strong></div>}
                                        {gSal.t3.bon_diambil > 0 && <div className="flex justify-between text-slate-600"><span>Ambil Bon (Pinjaman):</span><strong className="text-amber-700">+{formatRupiah(gSal.t3.bon_diambil)}</strong></div>}
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
                    <section className={`rounded-2xl p-4 ${getThemeConfig(showDetailHistory.jenis).light}`}>
                      <div className="flex justify-between items-center gap-2 text-xs"><span className={getThemeConfig(showDetailHistory.jenis).text}>{showDetailHistory.ref || showDetailHistory.id}</span><span className="rounded-lg bg-white px-2 py-1 text-slate-600">{showDetailHistory.status}</span></div>
                      <h3 className="text-lg font-semibold text-slate-800 mt-3">{getPersonDisplayText(showDetailHistory.person, 'Pelanggan umum')}</h3>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500"><span className="flex items-center gap-1"><User size={14}/>{showDetailHistory.operator || 'System'}</span><span className="flex items-center gap-1"><Calendar size={14}/>{formatLocalDateTime(showDetailHistory.created_at)}</span></div>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-slate-700 tabular-nums">
                        <div className="col-span-2 sm:col-span-1"><dt className="text-xs">Total tagihan</dt><dd className={`text-xl font-semibold ${getThemeConfig(showDetailHistory.jenis).text}`}>{formatRupiah(Number(showDetailHistory.total || 0))}</dd></div>
                        <div><dt className="text-xs">Dibayar</dt><dd className="font-semibold">{formatRupiah(Number(showDetailHistory.dibayar || 0))}</dd></div>
                        <div><dt className="text-xs">{(showDetailHistory.dibayar || 0) > (showDetailHistory.total || 0) ? 'Kembalian' : 'Sisa tagihan'}</dt><dd className="font-semibold">{formatRupiah(Math.abs((showDetailHistory.total || 0) - (showDetailHistory.dibayar || 0)))}</dd></div>
                      </dl>
                    </section>
                  )}

                  {!showDetailHistory.jenis.toLowerCase().includes('gaji') && showDetailHistory.marketplace && (
                  <>
                    <div className="mt-4 p-3 bg-slate-800 rounded-xl text-xs text-white font-bold flex flex-wrap gap-4 justify-center relative z-10 border border-white/10">
                      <span className="flex items-center gap-1"><ShoppingBag size={12}/> {showDetailHistory.marketplace}</span>
                      <span className="text-rose-200">Admin: -Rp {showDetailHistory.admin}</span>
                      <span className="text-emerald-200">CB: +Rp {showDetailHistory.cashback}</span>
                    </div>

                    {userLevel === '1' && showDetailHistory.jenis?.toLowerCase() !== 'pembelian' && (
                      <div className="mt-6 pt-5 border-t border-white/20 flex justify-around relative z-10">
                        <div className="text-center bg-black/20 flex-1 rounded-l-xl p-2 border-r border-white/10">
                          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Laba Kotor</p>
                          <p className="font-black text-emerald-300 text-lg md:text-xl drop-shadow-sm mt-1">
                            {formatRupiah(totalLabaKotor)}
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
                      <section className="space-y-2"><h3 className="text-sm font-semibold flex items-center gap-2"><FileText size={16}/> Catatan nota</h3><p className="whitespace-pre-wrap break-words text-sm text-slate-600">{showDetailHistory.text || 'Tidak ada catatan nota.'}</p></section>
                      {/* SECTION: Lampiran Media */}
                      {showDetailHistory.file && showDetailHistory.file.length > 0 && (
                        <div id="section-media" className="scroll-mt-16">
                          <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                            <p className={`font-black text-[11px] ${getThemeConfig(showDetailHistory.jenis).text} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
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

                      {/* SECTION: Rincian Item (dengan ID untuk navigasi) */}
                      <div id="section-items" className="scroll-mt-16">
                        <div className="space-y-3">
                          <p className={`text-[11px] font-black ${getThemeConfig(showDetailHistory.jenis).text} uppercase tracking-widest ml-1 flex items-center gap-2`}>
                            <Box size={16}/> Rincian Item (Log Stok Terjual)
                          </p>
                          <div className="border-2 border-slate-200 rounded-[1.5rem] bg-white divide-y divide-slate-100 text-xs shadow-sm overflow-hidden">
                            {filteredHistoryItems.length === 0 ? (
                              <div className="p-8 text-center flex flex-col items-center">
                                
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Tidak ada barang yang cocok.</p>
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
                                        Qty: {item.qty} @ {formatRupiah(item.price_1 ?? 0)}
                                      </p>
                                    </div>
                                    <p className="font-black text-slate-900 text-sm bg-slate-100 px-3 py-1 rounded-lg shrink-0">
                                      {formatRupiah(item.price_1 * item.qty)}
                                    </p>
                                  </div>
                                  {userLevel === '1' && (
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] md:text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-3 shadow-inner">
                                      <p className="flex justify-between"><span className="font-bold">ID:</span> <span className="font-mono text-slate-800">{item.id}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Kode:</span> <span className="font-mono text-slate-800">{item.item}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Qty:</span> <span className="font-black text-slate-800 bg-slate-200 px-1.5 rounded">{item.qty}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">In / Out:</span> <span className="font-black text-slate-800">{item.boolean}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Jual:</span> <span className="font-black text-slate-800">{formatRupiah(item.price_1 ?? 0)}</span></p>
                                      <p className="flex justify-between"><span className="font-bold">Modal:</span> <span className="font-black text-slate-800">{formatRupiah(item.price_2 ?? 0)}</span></p>
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
              ? (hargaLama > 0 ? (laba >= 0 ? `+Rp ${formatAmount(laba)}` : `Rp ${formatAmount(laba)}`) : 'Harga Awal')
              : `Rp ${formatAmount(laba)}`
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
                                  <span className="font-black text-emerald-600 text-sm tracking-tight">{formatRupiah(fee.ongkos ?? 0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                </div>
              )}
              {activeTab === 'payments' && !showDetailHistory.jenis.toLowerCase().includes('gaji') && <div>                      {/* SECTION: Cashflow */}
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
                                    <p className="flex justify-between"><span>Nominal:</span> <span className="font-black text-blue-600 text-sm">{formatRupiah(cf.nominal ?? 0)}</span></p>
                                    <p className="flex justify-between"><span>Mutasi:</span> <span className="uppercase text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{cf.mutasi}</span></p>
                                    <p className="flex justify-between items-center gap-2"><span>Account:</span> <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-right truncate">{accName}</span></p>
                                    {('1' === userLevel || '2' === userLevel || '5' === userLevel) && (cf.saldo_awal !== undefined || cf.saldo_akhir !== undefined) && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                        <p className="flex justify-between text-[10px]"><span className="font-bold text-emerald-700">Saldo Awal:</span> <span className="font-black">{formatRupiah(Number(cf.saldo_awal || 0))}</span></p>
                                        <p className="flex justify-between text-[10px]"><span className="font-bold text-emerald-700">Saldo Akhir:</span> <span className="font-black">{formatRupiah(Number(cf.saldo_akhir || 0))}</span></p>
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

</div>}
            </div>

            {/* FOOTER TOMBOL - TETAP DI BAWAH (STICKY) */}
            <div className="pos-modal-footer">
              <div className="flex flex-wrap gap-3 pb-1">
                {(() => {
                  const isStatusBelum = showDetailHistory?.status === 'belum';
                  const bolehDelete = (userLevel === '1' || userLevel === '5') || (isStatusBelum && ['1','2','3','4','5','6','7'].includes(userLevel));
                  return bolehDelete && (
                    <DeleteAccess collection="menu" id={showDetailHistory!.id}><button
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
                        <><Trash2 size={16}/> Hapus</>
                      )}
                    </button></DeleteAccess>
                  );
                })()}

                {showDetailHistory && showDetailHistory.status !== 'lunas' && !showDetailHistory.jenis?.toLowerCase().includes('gaji') && (
                  <button
                    type="button"
                    onClick={() => openQuickSettle(showDetailHistory)}
                    disabled={isDeleting}
                    className={`pos-action text-white ${getThemeConfig(showDetailHistory.jenis).main}`}
                    title="Pelunasan Pembayaran Cepat (Tanpa Ubah Keranjang)"
                  >
                    <Wallet size={18} />
                    <span>Pelunasan</span>
                  </button>
                )}

                {pb.authStore.isValid && (
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
                    <span>Edit</span>
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
                  <Printer size={16} /> Cetak
                </button>

                {showDetailHistory?.status === 'lunas' && (
                  <>
                    <button
                      onClick={() => {
                        if (isDeleting) return;
                        const detail = showDetailHistory;
                        if (!detail) return;
                        const items = historyItems.map(h => 
                          `${getFullLabel(h.expand?.item_baru)} | Qty: ${h.qty} @ Rp ${formatAmount(h.price_1)} = Rp ${formatAmount(Number(h.price_1) * h.qty)}`
                        ).join('\n');
                        const text = `*${detail.jenis?.toUpperCase()}*\nID: ${detail.ref || detail.id}\n${formatLocalDateTime(detail.created_at)}\nPelanggan: ${getPersonDisplayText(detail.person, 'Umum')}\nTotal: Rp ${formatAmount(detail.total)}\nDibayar: Rp ${formatAmount(detail.dibayar)}\n\nItems:\n${items}`;
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
                      <Share2 size={16} /> Bagikan
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
                  <X size={16}/>{isDeleting ? 'Tunggu…' : 'Tutup'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */} 
      {/* 3. LAYOUT TEMPLATE NOTA PRINTER THERMAL 58MM */} 
      {/* ========================================================= */} 
      <ReceiptPrintModal
        showReceiptPrint={showReceiptPrint}
        setShowReceiptPrint={setShowReceiptPrint}
        receiptRef={receiptRef}
        formatLocalDateTime={formatLocalDateTime}
        operatorName={operatorName}
        getFullLabel={getFullLabel}
        printWithRawBT={printWithRawBT}
        setDialog={setDialog}
        activeTheme={activeTheme}
        setCart={setCart}
        setIsPaymentFormOpen={setIsPaymentFormOpen}
        setFormBayar={setFormBayar}
        getLocalDatetimeInput={getLocalDatetimeInput}
      />

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
              <p className="text-base font-black text-white tracking-tight">{formatRupiah(grandTotal)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsCartModalOpen(true);
              setCartTab('payment');
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
        maxWidth="max-w-2xl" compact
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
                              <span>Pendapatan: <strong className="text-emerald-600">{formatRupiah((item.pokok + item.tunjangan + item.bonus_1 + item.bonus_2 + item.bonus_3 + item.bonus_4 + item.program + item.lembur))}</strong></span>
                              <span>|</span>
                              <span>Netto: {renderFormattedNetto(item.netto, "text-xs sm:text-sm", "text-emerald-700", "text-emerald-700")}</span>
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
        maxWidth="max-w-2xl" compact
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
                          <div className="border-2 border-rose-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} /> 3. Potongan Lain & Bon (-)
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

                          {/* SECTION 4: DITERIMA (JUMLAH YANG DITERIMA KARYAWAN) */}
                          <div className="border-2 border-teal-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-white flex justify-between items-center">
                              <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Wallet size={15} /> 4. Diterima
                              </span>
                              <span className="font-black text-xs text-teal-100">
                                {formatRupiah((Number(gajiItemSubData.diterima) || 0))}
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

      {/* ===== MODAL PELUNASAN PEMBAYARAN CEPAT ===== */}
      {quickSettleData?.show && quickSettleData.menu && (
        <Modal
          isOpen={quickSettleData.show}
          onClose={() => !isProcessing && setQuickSettleData(null)}
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
                    <p className="text-xs text-slate-500">{quickSettleData.menu.jenis || 'Nota Transaksi'}</p>
                    <p className="text-base font-semibold text-slate-800 mt-0.5 break-words">{getPersonDisplayText(quickSettleData.menu.person, 'Pelanggan umum')}</p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">{quickSettleData.menu.ref || quickSettleData.menu.id.slice(0, 8)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setQuickSettleData(prev => prev ? {
                      ...prev,
                      nominal: Math.max(0, (prev.menu!.total || 0) - (prev.menu!.dibayar || 0))
                    } : null)}
                    className="pos-action bg-emerald-600 text-white shrink-0"
                  >
                    Lunas penuh
                  </button>
                </div>
                <dl className="grid grid-cols-3 gap-3 mt-4 text-slate-700 tabular-nums">
                  <div>
                    <dt className="text-xs">Total invoice</dt>
                    <dd className="font-semibold">{formatRupiah(Number(quickSettleData.menu.total || 0))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs">Sudah dibayar</dt>
                    <dd className="font-semibold text-emerald-700">{formatRupiah(Number(quickSettleData.menu.dibayar || 0))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs">Sisa tagihan</dt>
                    <dd className="font-semibold text-emerald-700">{formatRupiah(Math.max(0, (quickSettleData.menu.total || 0) - (quickSettleData.menu.dibayar || 0)))}</dd>
                  </div>
                </dl>
              </section>

              {/* Form pelunasan */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 flex justify-between items-center gap-2">
                    <span>Akun kas penerima pembayaran <span className="text-rose-500">*</span></span>
                    {quickSettleData.accountId && (() => {
                      const selectedAcc = cashflowAccounts.find(a => a.id === quickSettleData.accountId);
                      const bal = Number(selectedAcc?.number_1 || 0);
                      return (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                          <Wallet size={12} /> Saldo: {formatRupiah(bal)}
                        </span>
                      );
                    })()}
                  </label>
                  <select
                    value={quickSettleData.accountId}
                    disabled={isProcessing}
                    onChange={(e) => setQuickSettleData(prev => prev ? { ...prev, accountId: e.target.value } : null)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="">-- Pilih akun kas --</option>
                    {cashflowAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.text_1} {acc.id_lama ? `(${acc.id_lama})` : ''} - Saldo: {formatRupiah(Number(acc.number_1 || 0))}
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
                    value={quickSettleData.nominal || ''}
                    disabled={isProcessing}
                    onChange={(e) => setQuickSettleData(prev => prev ? { ...prev, nominal: Number(e.target.value) } : null)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Masukkan nominal bayar..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Waktu pembayaran
                  </label>
                  <input
                    type="datetime-local"
                    value={quickSettleData.createdAt}
                    disabled={isProcessing}
                    onChange={(e) => setQuickSettleData(prev => prev ? { ...prev, createdAt: e.target.value } : null)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Catatan pelunasan (opsional)
                  </label>
                  <input
                    type="text"
                    value={quickSettleData.note}
                    disabled={isProcessing}
                    onChange={(e) => setQuickSettleData(prev => prev ? { ...prev, note: e.target.value } : null)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Contoh: Pelunasan Transfer BCA"
                  />
                </div>

                {/* Lampiran bukti transfer */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between gap-2">
                    <span>Upload media / bukti transfer (opsional)</span>
                    {quickSettleData.menu.file && quickSettleData.menu.file.length > 0 && (
                      <span className="text-[10px] text-blue-600 font-medium">
                        ({quickSettleData.menu.file.length} file terdahulu)
                      </span>
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
                          setQuickSettleData(prev => prev ? {
                            ...prev,
                            settleFiles: [...(prev.settleFiles || []), ...filesArray]
                          } : null);
                        }
                      }}
                    />
                    <label
                      htmlFor="quick-settle-file-input"
                      className="flex flex-col items-center justify-center cursor-pointer gap-2 py-2"
                    >
                      <div className="p-3 bg-white rounded-full shadow-sm text-emerald-600">
                        <Upload size={20} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700">Klik untuk pilih foto bukti transfer</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Format: JPG, PNG, WEBP</p>
                      </div>
                    </label>

                    {quickSettleData.settleFiles && quickSettleData.settleFiles.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200">
                        {quickSettleData.settleFiles.map((file, idx) => {
                          const previewUrl = URL.createObjectURL(file);
                          return (
                            <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-white">
                              <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickSettleData(prev => prev ? {
                                    ...prev,
                                    settleFiles: prev.settleFiles.filter((_, i) => i !== idx)
                                  } : null);
                                }}
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
                onClick={() => setQuickSettleData(null)}
                disabled={isProcessing}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs tracking-wider transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeQuickSettle}
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
      )}

    </div> 
    </fieldset>
  );
}
