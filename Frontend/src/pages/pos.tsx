import { formatIdLamaDisplay, getFullLabel, getLocalDatetimeInput, formatLocalDateTime } from '../lib/posFormatters';
import { formatRupiah, formatAmount } from '../lib/money';
import { validateCheckout, FIELD_TAB, type FieldKey } from '../lib/posValidation';
import { readPosView, writePosView } from '../lib/posView';
import type { CheckoutForm, Produk, DropdownItem, UserKaryawan, CartItem, HistoryMenu, LogStockDetail, CashflowDetail, OngkosDetail } from '../types/pos';
import { POS_DRAFT_KEY, readPosDraft, type PosDraft } from '../lib/posDraft';
import { hasPendingAtomic } from '../services/api/atomic';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { pb } from '../lib/pocketbase';
import '../components/pos/pos-modal.css';
import { 
  ShoppingCart, ChevronLeft, ChevronRight,
  Plus, X,
  Filter, User
} from 'lucide-react';

import { PosNavbar } from '../components/pos/PosNavbar';
import { PosFilterBar } from '../components/pos/PosFilterBar';
import { QuickSettleModal } from '../components/pos/QuickSettleModal';
import { CheckoutReviewModal } from '../components/pos/CheckoutReviewModal';
import { ReceiptPrintModal } from '../components/pos/ReceiptPrintModal';
import { PosDetailModal } from '../components/pos/PosDetailModal';
import { PosGajiModals } from '../components/pos/PosGajiModals';
import { PosCartModal } from '../components/pos/PosCartModal';
import { PosAlertDialog } from '../components/pos/PosAlertDialog';
import { PosFloatingCheckoutBar } from '../components/pos/PosFloatingCheckoutBar';
import { PosContentFeed } from '../components/pos/PosContentFeed';
import { executePosCheckout } from '../services/posCheckout';
import { usePosGaji, calculateWorkingDays, calculateItemNetto } from '../hooks/usePosGaji';
import { executeQuickSettleTransaction, deleteHistoryTransaction, openQuickSettleTransaction, type QuickSettleState } from '../services/posHistoryActions';

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

  // State untuk posisi dropdown
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const personButtonRef = useRef<HTMLButtonElement>(null);

  const [initialView] = useState(() => readPosView(key => localStorage.getItem(key)));
  const [searchInput, setSearchInput] = useState(initialView.search);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialView.viewMode); // 'grid' atau 'list'
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
  const [selectedMenuFilters, setSelectedMenuFilters] = useState<string[]>(initialView.menuFilters);

  const [isPersonFilterOpen, setIsPersonFilterOpen] = useState(false);
  const [personFilterSearch, setPersonFilterSearch] = useState('');
  
  const [showDetailHistory, setShowDetailHistory] = useState<HistoryMenu | null>(null);
  const [historyItems, setHistoryItems] = useState<LogStockDetail[]>([]);
  const [historyCashflow, setHistoryCashflow] = useState<CashflowDetail[]>([]);
  const [historyOngkos, setHistoryOngkos] = useState<OngkosDetail[]>([]);
  
  const [showCheckoutReview, setShowCheckoutReview] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [draftRestored, setDraftRestored] = useState(() => !!initialDraft);
  const [showReceiptPrint, setShowReceiptPrint] = useState<any>(null);

  const [allUsers, setAllUsers] = useState<any[]>([]);
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
  const [quickSettleData, setQuickSettleData] = useState<QuickSettleState | null>(null);

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


  const [dialog, setDialog] = useState<{show: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void, confirmLabel?: string}>({
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

  // Hook Manajemen Payroll/Gaji Karyawan
  const {
    salaryTab, setSalaryTab,
    salaryPeriodTab, setSalaryPeriodTab,
    salaryReview, setSalaryReview,
    isGajiFormOpen, setIsGajiFormOpen,
    gajiEditSession, setGajiEditSession,
    gajiHeader, setGajiHeader,
    gajiItemList, setGajiItemList,
    editingGajiItemIndex, setEditingGajiItemIndex,
    showGajiBonus, setShowGajiBonus,
    isGajiItemSubModalOpen, setIsGajiItemSubModalOpen,
    gajiItemSubData, setGajiItemSubData,
    employeeActiveBon,
    isFetchingEmployeeData,
    hasLoadedPreviousSlip,
    availableUsers,
    handleSelectPerson,
    handleGajiSubItemFileAdd,
    handleRemoveGajiSubItemFile,
    handleSaveSubGajiItem,
    handleEditGajiItem,
    handleDeleteGajiItem,
    handleSaveGaji,
    handleEditGajiFromHistory,
  } = usePosGaji({
    allUsers,
    allPersons,
    showAlert: (title: string, message: string) => showAlert(title, message),
    submitLockRef,
    setIsProcessing,
    setProcessingMsg,
    operatorName,
    historyGajiSubItems,
    setShowDetailHistory,
  });





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
          const [persons, menus, accounts, usersList] = await Promise.all([
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `kategori ~ "person"`, $autoCancel: false }),
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `kategori ~ "menu" && jenis ~ "jenis menu"`, sort: 'text_1', $autoCancel: false }),
            pb.collection('dropdown').getFullList<DropdownItem>({ filter: `jenis ~ "cashflow account"`, sort: 'text_1', $autoCancel: false }),
            pb.collection('user').getFullList<UserKaryawan>({ sort: 'name', $autoCancel: false }),
          ]);
          const mechs = (usersList as UserKaryawan[]).filter(u => Number(u.level) === 10 && String(u.status || '').toLowerCase() === 'active');
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
              const persons = allPersons.length > 0
                  ? allPersons.filter(p => (p.jenis || '').toLowerCase().includes(jenisTarget))
                  : await pb.collection('dropdown').getFullList<DropdownItem>({
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
          const mechanicCond = `(text ~ "${currentUsername}" || text ~ "${currentName}" || person ~ "${currentUsername}" || person ~ "${currentName}" || operator ~ "${currentUsername}")`;
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
    const timer = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 250);
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

  // Sinkronisasi realtime stok produk saat kasir lain melakukan transaksi
  useEffect(() => {
    let active = true;
    pb.collection('produk').subscribe<Produk>('*', (e) => {
      if (!active) return;
      if (e.action === 'update' && e.record) {
        const updated = e.record;
        // Update stok pada catalog view jika ada di halaman aktif
        setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, stok_3: updated.stok_3, beli: updated.beli } : p));
        // Update stok pada item di keranjang belanja
        setCart(prev => prev.map(item => item.id === updated.id ? { ...item, stok_3: updated.stok_3 } : item));
      }
    }).catch(() => { /* Realtime fallback: preflight check tetap menjaga konsistensi */ });

    return () => {
      active = false;
      pb.collection('produk').unsubscribe('*').catch(() => {});
    };
  }, []);

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

  // Simpan tampilan katalog agar tidak hilang saat berpindah halaman.
  useEffect(() => {
    writePosView((key, value) => localStorage.setItem(key, value), { search: searchInput, viewMode, menuFilters: selectedMenuFilters });
  }, [searchInput, viewMode, selectedMenuFilters]);

  // Cegah tab/ halaman ditutup selagi proses simpan berjalan.
  useEffect(() => {
    if (!isProcessing) return;
    const blockUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', blockUnload);
    return () => window.removeEventListener('beforeunload', blockUnload);
  }, [isProcessing]);

  // 🟢 Keyboard Shortcuts Listener untuk Web & Tablet Hardware Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // F2 atau '/' untuk fokus pencarian produk
      if (isProcessing) return; // tidak ada interaksi lain saat proses simpan berjalan
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
        setFormBayar(prev => {
          const sumOther = prev.cashflowList.reduce((acc, curr, i) => i !== 0 ? acc + (curr.nominal || 0) : acc, 0);
          const remaining = Math.max(0, grandTotal - sumOther);
          const newList = prev.cashflowList.length > 0
            ? prev.cashflowList.map((row, i) => i === 0 ? { ...row, nominal: remaining, accountId: row.accountId || (kasirAcc ? kasirAcc.id : '') } : row)
            : [{ id: '', created_at: '', accountId: kasirAcc ? kasirAcc.id : '', nominal: remaining }];
          return { ...prev, payment: 'Tunai', nominalBayar: grandTotal, cashflowList: newList };
        });
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
  }, [isPaymentFormOpen, isCartModalOpen, showCheckoutReview, cartTab, cart, cashflowAccounts, formBayar.cashflowList, grandTotal, isProcessing]);

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
    await executePosCheckout({
      pb,
      selectedMenu,
      formBayar,
      editSession,
      submitLockRef,
      setIsProcessing,
      setProcessingMsg,
      personOptions,
      cartWithTierPrice,
      grandTotal,
      totalQtyKeranjang,
      isOnlinePerson,
      menuFiles,
      operatorName,
      cashflowAccounts,
      mechanics,
      setShowReceiptPrint,
      setDialog,
      setShowCheckoutReview,
      setCart,
      setEditSession,
      setEditOldItems,
      setIsCartModalOpen,
      setFormBayar,
      setIsPaymentFormOpen,
      setMenuFiles,
      fetchData,
    });
  };

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

  const openQuickSettle = async (menu: HistoryMenu, e?: React.MouseEvent) => {
    await openQuickSettleTransaction(pb, menu, cashflowAccounts, setCashflowAccounts, setQuickSettleData, e);
  };

  const executeQuickSettle = async () => {
    if (!quickSettleData) return;
    await executeQuickSettleTransaction({
      pb,
      quickSettleData,
      submitLockRef,
      setIsProcessing,
      setProcessingMsg,
      cashflowAccounts,
      operatorName,
      setQuickSettleData,
      setCashflowAccounts,
      showDetailHistory,
      setShowDetailHistory,
      fetchData,
      setDialog,
    });
  };

  const handleDeleteHistory = async (menuItem: HistoryMenu) => {
    await deleteHistoryTransaction({
      menuItem,
      submitLockRef,
      setIsDeleting,
      setIsProcessing,
      editSession,
      setEditSession,
      setEditOldItems,
      setCart,
      setMenuFiles,
      setExistingMenuFiles,
      fetchData,
      setShowDetailHistory,
      setDialog,
    });
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
    <fieldset disabled={isProcessing} className="h-dvh min-w-0 border-0 m-0 p-0">
    <div className="flex h-dvh bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Indikator proses: semua kontrol dinonaktifkan, beri tahu apa yang sedang berjalan */}
      {isProcessing && (
        <div role="status" aria-live="polite" className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 rounded-full bg-slate-900/95 px-4 py-2 text-xs font-bold text-white shadow-xl">
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
          <span>{processingMsg || 'Memproses...'}</span>
        </div>
      )}
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
        <PosContentFeed
          selectedMenu={selectedMenu}
          products={products}
          groupedHistory={groupedHistory}
          activeTheme={activeTheme}
          viewMode={viewMode}
          addToCart={addToCart}
          loadHistorySubDetails={loadHistorySubDetails}
          openQuickSettle={openQuickSettle}
          getPersonDisplayText={getPersonDisplayText}
          getJenisColor={getJenisColor}
          setIsGajiFormOpen={setIsGajiFormOpen}
          setSalaryPeriodTab={setSalaryPeriodTab}
          setSalaryReview={setSalaryReview}
          draftRestored={draftRestored}
          setDraftRestored={setDraftRestored}
          cartLength={cart.length}
        />
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
          className={`fixed bottom-[calc(6rem_+_env(safe-area-inset-bottom))] right-6 md:bottom-30 md:right-10 z-50 p-4 md:p-5 ${activeTheme.main} text-white rounded-full shadow-2xl shadow-${activeTheme.main.replace('bg-', '')}/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-white`}
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
          onClick={() => { setSalaryPeriodTab('period'); setSalaryReview(false); setIsGajiFormOpen(true); }}
          className="fixed bottom-[calc(6rem_+_env(safe-area-inset-bottom))] right-6 md:bottom-30 md:right-10 z-50 px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full shadow-2xl shadow-emerald-600/50 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white font-black text-xs uppercase tracking-wider"
        >
          <Plus size={22} />
          <span className="hidden sm:inline">Buat Slip Gaji</span>
        </button>
      )}

      {/* ===== 1. MODAL KERANJANG DAN CHECKOUT PEMBAYARAN ===== */}
      <PosCartModal
        isOpen={isCartModalOpen && !showCheckoutReview}
        onClose={() => !isProcessing && setIsCartModalOpen(false)}
        selectedMenu={selectedMenu}
        activeTheme={activeTheme}
        cartTab={cartTab}
        setCartTab={setCartTab}
        setIsPaymentFormOpen={setIsPaymentFormOpen}
        setIsPersonDropdownOpen={setIsPersonDropdownOpen}
        isPersonDropdownOpen={isPersonDropdownOpen}
        editSession={editSession}
        setCart={setCart}
        setEditSession={setEditSession}
        setEditOldItems={setEditOldItems}
        setMenuFiles={setMenuFiles}
        setExistingMenuFiles={setExistingMenuFiles}
        formBayar={formBayar}
        setFormBayar={setFormBayar}
        confirmAction={confirmAction}
        getLocalDatetimeInput={getLocalDatetimeInput}
        fieldErrors={fieldErrors}
        clearFieldError={clearFieldError}
        getPersonDisplayText={getPersonDisplayText}
        personSearch={personSearch}
        setPersonSearch={setPersonSearch}
        personOptions={personOptions}
        cart={cart}
        showCartCatalog={showCartCatalog}
        setShowCartCatalog={setShowCartCatalog}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        setPage={setPage}
        page={page}
        totalPages={totalPages}
        loading={loading}
        products={products}
        addToCart={addToCart}
        getFullLabel={getFullLabel}
        cartWithTierPrice={cartWithTierPrice}
        formatIdLamaDisplay={formatIdLamaDisplay}
        updateQty={updateQty}
        updatePrice={updatePrice}
        grandTotal={grandTotal}
        mechanics={mechanics}
        setDialog={setDialog}
        cashflowAccounts={cashflowAccounts}
        isOnlinePerson={isOnlinePerson}
        menuFiles={menuFiles}
        existingMenuFiles={existingMenuFiles}
        menuPreviewUrls={menuPreviewUrls}
        isVideo={isVideo}
        isProcessing={isProcessing}
        handleCheckoutValidation={handleCheckoutValidation}
      />

      {/* ========================================================= */} 
      {/* 1. MODAL OVERVIEW RE-CHECK SEBELUM EXECUTE STORING DATA */} 
      {/* ========================================================= */} 
      {showCheckoutReview && <CheckoutReviewModal
        isOpen={showCheckoutReview}
        formBayar={formBayar}
        selectedMenu={selectedMenu}
        isEditing={!!editSession?.isEditing}
        grandTotal={grandTotal}
        totalBelanja={totalBelanja}
        totalQty={totalQtyKeranjang}
        items={cartWithTierPrice}
        accounts={cashflowAccounts}
        operatorName={operatorName}
        isOnlinePerson={isOnlinePerson}
        isProcessing={isProcessing}
        processingMsg={processingMsg}
        attachmentCount={existingMenuFiles.length + menuFiles.length}
        hasMedia={menuFiles.length > 0 || (!!editSession?.isEditing && existingMenuFiles.length > 0)}
        showDetails={showReviewDetails}
        activeTheme={activeTheme}
        getPersonDisplayText={getPersonDisplayText}
        getItemLabel={getFullLabel}
        onToggleDetails={() => setShowReviewDetails(prev => !prev)}
        onGoToTab={tab => { setShowCheckoutReview(false); setCartTab(tab); }}
        onBack={() => setShowCheckoutReview(false)}
        onSave={executeStoringData}
      />}

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

      {/* ===== 2. MODAL DETAIL HISTORI TRANSAKSI BESERTA SUB-DETAILS ===== */}
      <PosDetailModal
        showDetailHistory={showDetailHistory}
        onClose={() => setShowDetailHistory(null)}
        userLevel={userLevel}
        operatorName={operatorName}
        historyItems={historyItems}
        historyCashflow={historyCashflow}
        historyOngkos={historyOngkos}
        historyGajiSubItems={historyGajiSubItems}
        cashflowAccounts={cashflowAccounts}
        isDeleting={isDeleting}
        confirmAction={confirmAction}
        handleDeleteHistory={handleDeleteHistory}
        openQuickSettle={openQuickSettle}
        handleEditGajiFromHistory={handleEditGajiFromHistory}
        handleEditHistoryToCart={handleEditHistoryToCart}
        handleDetailPrintFn={handleDetailPrintFn}
        detailPrintRef={detailPrintRef}
        getThemeConfig={getThemeConfig}
        getFullLabel={getFullLabel}
        getPersonDisplayText={getPersonDisplayText}
        formatLocalDateTime={formatLocalDateTime}
        fetchFileWithAuth={fetchFileWithAuth}
        setDialog={setDialog}
      />

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
      <PosAlertDialog
        dialog={dialog}
        onClose={() => setDialog(prev => ({ ...prev, show: false }))}
      />

      {/* FLOATING MOBILE QUICK CHECKOUT BAR */}
      <PosFloatingCheckoutBar
        cartLength={cart.length}
        isPaymentFormOpen={isPaymentFormOpen}
        showReceiptPrint={showReceiptPrint}
        activeTheme={activeTheme}
        totalQtyKeranjang={totalQtyKeranjang}
        selectedMenu={selectedMenu}
        grandTotal={grandTotal}
        isProcessing={isProcessing}
        processingMsg={processingMsg}
        onOpenPayment={() => {
          setIsCartModalOpen(true);
          setCartTab('payment');
          setIsPaymentFormOpen(true);
        }}
      />

      {/* ===== 4. MODAL KHUSUS FORM GAJI KARYAWAN ===== */}
      <PosGajiModals
        isGajiFormOpen={isGajiFormOpen}
        setIsGajiFormOpen={setIsGajiFormOpen}
        gajiEditSession={gajiEditSession}
        setGajiEditSession={setGajiEditSession}
        gajiHeader={gajiHeader}
        setGajiHeader={setGajiHeader}
        gajiItemList={gajiItemList}
        setGajiItemList={setGajiItemList}
        salaryPeriodTab={salaryPeriodTab}
        setSalaryPeriodTab={setSalaryPeriodTab}
        salaryReview={salaryReview}
        setSalaryReview={setSalaryReview}
        isGajiItemSubModalOpen={isGajiItemSubModalOpen}
        setIsGajiItemSubModalOpen={setIsGajiItemSubModalOpen}
        gajiItemSubData={gajiItemSubData}
        setGajiItemSubData={setGajiItemSubData}
        salaryTab={salaryTab}
        setSalaryTab={setSalaryTab}
        editingGajiItemIndex={editingGajiItemIndex}
        setEditingGajiItemIndex={setEditingGajiItemIndex}
        showGajiBonus={showGajiBonus}
        setShowGajiBonus={setShowGajiBonus}
        availableUsers={availableUsers}
        hasLoadedPreviousSlip={hasLoadedPreviousSlip}
        isFetchingEmployeeData={isFetchingEmployeeData}
        employeeActiveBon={employeeActiveBon}
        isProcessing={isProcessing}
        calculateWorkingDays={calculateWorkingDays}
        calculateItemNetto={calculateItemNetto}
        renderFormattedNetto={renderFormattedNetto}
        handleSelectPerson={handleSelectPerson}
        handleEditGajiItem={handleEditGajiItem}
        handleDeleteGajiItem={handleDeleteGajiItem}
        handleSaveSubGajiItem={handleSaveSubGajiItem}
        handleSaveGaji={handleSaveGaji}
        handleGajiSubItemFileAdd={handleGajiSubItemFileAdd}
        handleRemoveGajiSubItemFile={handleRemoveGajiSubItemFile}
      />

      {/* ===== MODAL PELUNASAN PEMBAYARAN CEPAT ===== */}
      {/* ===== MODAL PELUNASAN PEMBAYARAN CEPAT ===== */}
      {quickSettleData?.show && quickSettleData.menu && (
        <QuickSettleModal
          data={quickSettleData}
          accounts={cashflowAccounts}
          isProcessing={isProcessing}
          getPersonDisplayText={getPersonDisplayText}
          onClose={() => setQuickSettleData(null)}
          onChange={patch => setQuickSettleData(prev => prev ? { ...prev, ...patch } : prev)}
          onSubmit={executeQuickSettle}
        />
      )}

    </div> 
    </fieldset>
  );
}
