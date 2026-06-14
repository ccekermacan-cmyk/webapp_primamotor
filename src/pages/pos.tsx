import { useNavigate, useLocation } from 'react-router-dom'; // Ini yang menyebabkan error ReferenceError
import { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Plus, Receipt, Layers, Printer, Share2, X,
  ArrowRight, Calendar, History, Sparkles, DollarSign, Wallet, AlertTriangle, Info, Wrench, Edit, TrendingUp, TrendingDown, Filter,
  // Tambahan ikon baru untuk UI yang diperbarui:
  ListOrdered, List, Grid, Users, CreditCard, ShoppingBag, FileText, EyeOff, ImagePlus, Save, CheckCircle2, Box, User, ExternalLink,
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
  const [personMap] = useState<Record<string, string>>({});

  const [allPersons, setAllPersons] = useState<DropdownItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<string>('Overview');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 12;

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedMenuFilters, setSelectedMenuFilters] = useState<string[]>([]);
  const [showJenisFilter, setShowJenisFilter] = useState(false);
  
  const [showDetailHistory, setShowDetailHistory] = useState<HistoryMenu | null>(null);
  const [historyItems, setHistoryItems] = useState<LogStockDetail[]>([]);
  const [historyCashflow, setHistoryCashflow] = useState<CashflowDetail[]>([]);
  const [historyOngkos, setHistoryOngkos] = useState<OngkosDetail[]>([]);
  
  const [showCheckoutReview, setShowCheckoutReview] = useState(false);
  const [showReceiptPrint, setShowReceiptPrint] = useState<any>(null);

  // State Khusus File Upload Menu
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [menuPreviewUrls, setMenuPreviewUrls] = useState<string[]>([]);

  // Membersihkan local object URLs untuk preview agar tidak memory leak
  useEffect(() => {
    if (menuFiles.length === 0) { setMenuPreviewUrls([]); return; }
    const urls = menuFiles.map(f => URL.createObjectURL(f));
    setMenuPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [menuFiles]);

  // Fungsi helper cek video
  const isVideo = (filename: string) => filename.match(/\.(mp4|webm|ogg)$/i);

  const getJenisColor = (jenis: string) => {
  const j = jenis.toLowerCase();
  if (j.includes('penjualan')) return 'text-emerald-500 bg-emerald-50';
  if (j.includes('service')) return 'text-blue-500 bg-blue-50';
  if (j.includes('pembelian')) return 'text-orange-500 bg-orange-50';
  return 'text-slate-500 bg-slate-100'; // Default
  };

  // Edit Session Tracker
  const [editSession, setEditSession] = useState<{ isEditing: boolean, menuId: string, createdAt: string } | null>(null);

  const [formBayar, setFormBayar] = useState({
      personIdLama: 'umum1',
      payment: 'Tunai',
      nominalBayar: 0,
      cashflowList: [{ accountId: '', nominal: 0 }], // Multi cashflow
      mekanikList: [{ idLama: '', ongkos: 0 }],
      note: '',
      noteMenu: '',
      marketplace: '',
      adminFee: 0,
      cashback: 0
  });

  const isOnlinePerson = useMemo(() => {
  const selectedPerson = personOptions.find(p => p.id_lama === formBayar.personIdLama);
  const personText = (selectedPerson?.text_1 || '').toLowerCase();
  const personId = formBayar.personIdLama.toLowerCase();
  return personId.includes('online1') || personText.includes('online');
  }, [formBayar.personIdLama, personOptions]);

  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAutoLunas, setIsAutoLunas] = useState(false); // State baru untuk fitur Auto Lunas

  const [dialog, setDialog] = useState<{show: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void}>({
    show: false, title: '', message: '', type: 'alert'
  });

  const printWithRawBT = (htmlContent: string) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      const encodedHtml = encodeURIComponent(htmlContent);
      const rawbtIntent = `intent://print?html=${encodedHtml}#Intent;scheme=rawbt;action=rawbt.intent.action.PRINT;end`;
      window.location.href = rawbtIntent;
      // Fallback jika RawBT tidak terinstal
      setTimeout(() => {
        const printContents = document.getElementById('thermal-receipt-58mm')?.innerHTML;
        if (printContents) {
          const original = document.body.innerHTML;
          document.body.innerHTML = printContents;
          window.print();
          document.body.innerHTML = original;
          window.location.reload();
        }
      }, 1000);
    } else {
      const printContents = document.getElementById('thermal-receipt-58mm')?.innerHTML;
      if (printContents) {
        const original = document.body.innerHTML;
        document.body.innerHTML = printContents;
        window.print();
        document.body.innerHTML = original;
        window.location.reload();
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

  const activeTheme = getThemeConfig(selectedMenu);

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
    setHistoryItems([]); setHistoryCashflow([]); setHistoryOngkos([]);
    try {
      // expand: 'item_baru' untuk menarik semua detail produk yang berelasi
      const logs = await pb.collection('log_stock').getFullList<LogStockDetail>({ filter: `ref_baru = "${menuItem.id}"`, expand: 'item_baru', $autoCancel: false });
      setHistoryItems(logs);
     const cfs = await pb.collection('cashflow').getFullList<CashflowDetail>({ filter: `ref_baru = "${menuItem.id}"`, $autoCancel: false });
      setHistoryCashflow(cfs);
      const fees = await pb.collection('ongkos').getFullList<OngkosDetail>({ filter: `ref_baru = "${menuItem.id}"`, $autoCancel: false });
      setHistoryOngkos(fees);
    } catch (e) { console.log("Detail sub-item tidak ditemukan."); }
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
          const persons = await pb.collection('dropdown').getFullList<DropdownItem>({ 
            filter: `kategori ~ "person"`,
            $autoCancel: false 
          });
            setAllPersons(persons);

          const menus = await pb.collection('dropdown').getFullList<DropdownItem>({
            filter: `kategori ~ "menu" && jenis ~ "jenis menu" && visibilitas ~ "${userLevel}"`,
            sort: 'text_1', $autoCancel: false
          });
          setMenuOptions([{ id: 'ov-1', text_1: 'Overview' } as any, ...menus]);

          // Dropdown Cashflow Accounts
          const accounts = await pb.collection('dropdown').getFullList<DropdownItem>({
            filter: `jenis ~ "cashflow account" && visibilitas ~ "${userLevel}"`,
            sort: 'text_1', $autoCancel: false
          });
          setCashflowAccounts(accounts);
          console.log("Cek Data Cashflow:", accounts);

          const mechs = await pb.collection('user').getFullList<UserKaryawan>({
            filter: `level = 10 && status = "Active"`,
            $autoCancel: false
          });
          setMechanics(mechs);
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
          if (menuLower === 'overview') {
            conditions.push(`(id_lama ~ {:t${i}} || jenis ~ {:t${i}} || person ~ {:t${i}} || text ~ {:t${i}} || payment ~ {:t${i}})`);
          } else if (menuLower.includes('Gaji')) {
            conditions.push(`(person ~ {:t${i}} || id_lama ~ {:t${i}})`);
          } else {
            const numericId = parseInt(t, 10);
            const isNumeric = !isNaN(numericId) && numericId.toString() === t.replace(/^0+/, '');
            if (isNumeric) {
              conditions.push(`(id_lama ~ {:t${i}} || id_lama = {:id${i}} || kategori ~ {:t${i}} || merk ~ {:t${i}} || jenis ~ {:t${i}} || keterangan ~ {:t${i}} || tipe ~ {:t${i}} || varian ~ {:t${i}})`);
              params[`id${i}`] = numericId.toString();
            } else {
              conditions.push(`(id_lama ~ {:t${i}} || kategori ~ {:t${i}} || merk ~ {:t${i}} || jenis ~ {:t${i}} || keterangan ~ {:t${i}} || tipe ~ {:t${i}} || varian ~ {:t${i}})`);
            }
            params[`t${i}`] = t;
          }
        });
      } // ← TAMBAHKAN KURUNG TUTUP INI
      const filterStr = conditions.length > 0 ? pb.filter(conditions.join(' && '), params) : '';

      if (menuLower === 'overview') {
        let overviewFilter = filterStr;
        // Filter status lunas/belum berdasarkan field 'status'
        if (filterStatus !== 'all') {
          const statusValue = filterStatus === 'lunas' ? 'lunas' : 'belum';
          if (overviewFilter) {
            overviewFilter = `(${overviewFilter}) && status = "${statusValue}"`;
          } else {
            overviewFilter = `status = "${statusValue}"`;
          }
        }
        // Filter jenis menu (multi-select)
        if (selectedMenuFilters.length > 0) {
          // Langsung masukkan nilai lowercase ke dalam string filter
          const jenisConditions = selectedMenuFilters.map(jenis => `jenis = "${jenis.toLowerCase()}"`).join(' || ');
          if (overviewFilter) {
            overviewFilter = `(${overviewFilter}) && (${jenisConditions})`;
          } else {
            overviewFilter = `(${jenisConditions})`;
          }
        }
        console.log("Overview Filter yang dikirim:", overviewFilter);
        const res = await pb.collection('menu').getList<HistoryMenu>(page, perPage, { sort: '-created_at', filter: overviewFilter, $autoCancel: false });
        console.log("Jumlah data ditemukan:", res.items.length);
        setHistoryMenu(res.items);
        setTotalPages(res.totalPages);
      } else if (menuLower.includes('gaji')) {
        // Ambil dari koleksi menu dengan jenis = gaji
        const res = await pb.collection('menu').getList<HistoryMenu>(page, perPage, { 
          sort: '-created_at', 
          filter: filterStr ? `jenis = 'gaji' && (${filterStr})` : `jenis = 'gaji'`,
          $autoCancel: false 
        });
        setHistoryMenu(res.items);
        setTotalPages(res.totalPages);
        } else {
          // Menu: pembelian, rusak, opname → tampilkan semua produk (termasuk stok 0)
          const showAllStock = ['pembelian', 'rusak', 'opname'].some(keyword => menuLower.includes(keyword));
          let baseFilter = showAllStock ? '' : 'stok_3 > 0';
          if (filterStr) {
            baseFilter = baseFilter ? `(${baseFilter}) && (${filterStr})` : filterStr;
          }
          const res = await pb.collection('produk').getList<Produk>(page, perPage, { sort: '-created', filter: baseFilter, $autoCancel: false });
          setProducts(res.items);
          setTotalPages(res.totalPages);
        }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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
    }
  }, [isOnlinePerson]);

  useEffect(() => { fetchData(); }, [page, searchTerm, selectedMenu, filterStatus, selectedMenuFilters]);

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

  const totalBelanja = cartWithTierPrice.reduce((sum, item) => sum + (item.priceSelected * item.qty), 0);
  const totalQtyKeranjang = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalOngkos = useMemo(() => {
  if (!selectedMenu.toLowerCase().includes('service')) return 0;
  return formBayar.mekanikList.reduce((sum, mek) => sum + (mek.ongkos || 0), 0);
}, [formBayar.mekanikList, selectedMenu]);

  const isPembelianMenu = selectedMenu.toLowerCase().includes('pembelian');
  const grandTotal = isPembelianMenu
    ? totalBelanja
    : totalBelanja + totalOngkos - (formBayar.adminFee || 0) + (formBayar.cashback || 0);

  useEffect(() => { 
    setFormBayar(prev => {
      const next = { ...prev, nominalBayar: grandTotal };
      // Jika toggle auto lunas aktif, selalu sinkronkan nominal akun kas dengan grand total terbaru
      if (isAutoLunas && next.cashflowList.length > 0) {
        next.cashflowList[0].nominal = grandTotal;
      }
      return next;
    }); 
  }, [grandTotal, isAutoLunas]);

  // --- 5. GUARDS & INTERACTION HANDLERS --
  // --- CHECKOUT SAFETY GUARD ---
  const handleCheckoutValidation = () => {
    // 1. Validasi keranjang tidak boleh kosong
    if (cart.length === 0) {
      setDialog({ show: true, title: 'Validasi Gagal', message: 'Isi keranjang dengan item terlebih dahulu!', type: 'alert' });
      return;
    }

    const menuLower = selectedMenu.toLowerCase();
    const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
    let perluKonfirmasiLunas = false;
    let pesanKonfirmasi = '';

    // --- Cek kondisi belum lunas dari cashflow ---
    const isCashflowKosong = formBayar.cashflowList.length === 0 ||
      formBayar.cashflowList.every(cf => !cf.accountId && cf.nominal === 0);
    const adaCashflowBelumLengkap = formBayar.cashflowList.some(cf => (!cf.accountId && cf.nominal > 0) || (cf.accountId && cf.nominal <= 0));
    const totalKurang = totalDibayar < grandTotal;

    if (isCashflowKosong || adaCashflowBelumLengkap || totalKurang) {
      perluKonfirmasiLunas = true;
      pesanKonfirmasi = `Apakah Anda yakin ingin melanjutkan simpan menu ${selectedMenu} ini dalam keadaan BELUM LUNAS?`;
    }

    // --- Cek kondisi belum lunas dari mekanik (khusus service) ---
    let mekanikKosong = false;
    if (menuLower.includes('service')) {
      const adaMekanikTerisi = formBayar.mekanikList.some(mek => mek.idLama && mek.ongkos > 0);
      const adaMekanikTidakLengkap = formBayar.mekanikList.some(mek => (mek.idLama && mek.ongkos <= 0) || (!mek.idLama && mek.ongkos > 0));
      if (!adaMekanikTerisi || adaMekanikTidakLengkap) {
        mekanikKosong = true;
        perluKonfirmasiLunas = true;
        pesanKonfirmasi = `Apakah Anda yakin ingin melanjutkan simpan menu SERVICE ini dalam keadaan BELUM LUNAS (tanpa ongkos mekanik)?`;
      }
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
          // Lanjut ke validasi selanjutnya (mandatory)
          lanjutkanValidasiMandatory();
        }
      });
      return; // tunggu konfirmasi user
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

      if (menuLower.includes('pembelian')) {
        if (!formBayar.noteMenu.trim()) {
          setDialog({ show: true, title: 'Catatan Kosong', message: 'Isi nota dari customer pada catatan nota!', type: 'alert' });
          return;
        }
        // Validasi Media Bukti (Pembelian)
        if (menuFiles.length === 0 && !editSession?.menuId) {
          setDialog({ show: true, title: 'Media Kosong', message: 'Isi media foto nota pembelian!', type: 'alert' });
          return;
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
          setSelectedMenu(menuName); 
          setIsAutoLunas(false); // Reset auto lunas
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
            cashback: 0
          }));
        }
      });
    } else if (selectedMenu === menuName && menuName === 'Overview') {
      // Refresh data Overview saat tab diklik ulang
      fetchData();
    } else { 
      setSelectedMenu(menuName); 
      setPage(1); 
      fetchData(); // refresh data langsung
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
    try {
      const isEditing = editSession?.isEditing && editSession?.menuId;
      // Gunakan waktu buatan baru jika buat nota baru, pertahankan waktu lama jika sesi edit
      const timestamp = isEditing ? editSession.createdAt : new Date().toISOString();
      const menuLower = selectedMenu.toLowerCase();

      const selectedPersonRecordId = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '';
      const selectedPersonName = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.text_1 || 'Umum';

      let menuRecordId = isEditing ? editSession.menuId : '';
      let oldMenuData: any = null;

      if (isEditing) {
        // 1. Cadangkan info status lunas/belum nota lama sebelum dibersihkan
        oldMenuData = await pb.collection('menu').getOne(editSession.menuId).catch(() => null);

        // 2. Eksekusi Delete dan tunggu (AWAIT) hingga seluruh hooks server (menu & log_stock) tuntas mengembalikan stok fisik
        await pb.collection('menu').delete(editSession.menuId);
      }

      // Hitung akumulasi parameter keuangan pembayaran kasir
      const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
      const statusBaru = totalDibayar >= grandTotal ? 'lunas' : 'belum';
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
      menuFormData.append('marketplace', formBayar.marketplace);
      menuFormData.append('cashback', String(formBayar.cashback));
      menuFormData.append('admin', String(formBayar.adminFee));
      menuFormData.append('status', statusBaru);
      menuFormData.append('total', String(totalBelanja));
      menuFormData.append('dibayar', String(totalDibayar));
      if (dateLunas) menuFormData.append('date_lunas', dateLunas);

      if (menuFiles && menuFiles.length > 0) {
        menuFiles.forEach(file => menuFormData.append('file', file));
      }

      // Simpan entitas Menu utama ke Database
      if (isEditing) {
        // Tambahkan ID ke FormData, lalu create dengan ID yang sama
        menuFormData.append('id', menuRecordId);
        const menuRecord = await pb.collection('menu').create(menuFormData);
        menuRecordId = menuRecord.id;
      } else {
        const menuRecord = await pb.collection('menu').create(menuFormData);
        menuRecordId = menuRecord.id;
      }

      // ========== PERUBAHAN ADA DI SINI ==========
        for (const item of cartWithTierPrice) {
          const booleanValue = (menuLower.includes('penjualan') || menuLower.includes('service')) ? 'out' : 'in';
          
          // [MODIFIED] Menambahkan field 'normal' yang berisi sell_6 * qty
          await pb.collection('log_stock').create({
            id_lama: '',
            created_at: timestamp,
            operator: operatorName,
            item: item.id_lama,
            qty: item.qty,
            item_baru: item.id,
            price_1: item.priceSelected,
            price_2: item.beli * item.qty,
            number_1: 0,
            number_2: 0,
            boolean: booleanValue,
            ref_baru: menuRecordId,
            normal: item.sell_6 * item.qty   // <--- TAMBAHAN BARU
          });
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

      // Simpan pemetaan pemisahan multi cashflow aliran dana masuk/keluar
      for (const cf of formBayar.cashflowList) {
        if (cf.accountId && cf.nominal > 0) {
          const selectedAccount = cashflowAccounts.find(acc => acc.id === cf.accountId);
          const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
          const mutasiValue = (menuLower.includes('penjualan') || menuLower.includes('service')) ? 'in' : 'out';
          
          await pb.collection('cashflow').create({
            id_lama: '',
            created_at: timestamp,
            operator: operatorName,
            nominal: cf.nominal,
            jenis: selectedMenu,
            mutasi: mutasiValue,
            account_1: cf.accountId,          
            account_2: '',                    
            note: formBayar.note || `POS System: Nota ${menuRecordId}`,
            ref_baru: menuRecordId,
            person: personRecordId,
            persontext: formBayar.personIdLama || '',  // 🔁 tambahkan baris ini
            acc1: accountIdLama,              
            acc2: '',                         
          });
        }
      }

      // Alokasikan alur pembagian komisi upah ke sub-koleksi ongkos (Khusus Jenis Service)
      if (menuLower.includes('service')) {
        for (const mek of formBayar.mekanikList) {
          if (mek.idLama && mek.ongkos > 0) {
            await pb.collection('ongkos').create({
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

      alert(isEditing ? "Perubahan transaksi berhasil diperbarui!" : "Transaksi berhasil disimpan!");
      
      // Reset State Form input kasir kembali bersih
      setShowCheckoutReview(false);
      setCart([]);
      setMenuFiles([]);
      setEditSession(null);
      setIsCartModalOpen(false);
      setIsAutoLunas(false); // Reset auto lunas
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
        cashflowList: [{ accountId: '', nominal: 0 }]
      });

      fetchData(); // Muat ulang grid inventaris barang & list overview di screen utama

    } catch (err: any) {
      console.error(err);
      alert("Gagal melakukan sinkronisasi data entri: " + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  };


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
              reloadedCart.push({ ...prod, qty: log.qty, priceSelected: log.price_1, isTiered: log.price_1 !== prod.sell_6, basePriceDefault: prod.sell_6 });
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
                const response = await fetch(fileUrl);
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
            note: cfNote,
            marketplace: menuItem.marketplace || '',
            adminFee: menuItem.admin || 0,
            cashback: menuItem.cashback || 0,
            mekanikList: loadedMekanik,
            cashflowList: cashflowList
          }));
          
          // Satu kali panggil set state sudah cukup
          setEditSession({ isEditing: true, menuId: menuItem.id, createdAt: menuItem.created_at });
          setSelectedMenu(menuItem.jenis); 
          setShowDetailHistory(null); // Tutup modal
          window.scrollTo(0, 0);
        } catch (e) { alert("Gagal mengambil rincian data transaksi lama."); }
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
      customer: personMap[showDetailHistory?.person || ''] || 'Umum',
      items: historyItems.map(h => ({ ...h.expand?.item_baru, qty: h.qty, priceSelected: h.price_1 })),
      total: grandTotalHistory,
      cash: grandTotalHistory,
      change: 0,
      payment: showDetailHistory?.payment,
      jenis: showDetailHistory?.jenis,
      mechanics: mechanicsForPrint
    });
  };

  const handleDeleteHistory = async (menuItem: HistoryMenu) => {
    try {
      // Cukup hapus menu utamanya saja.
      // Penghapusan log_stock, cashflow, ongkos, dan pengembalian stok/saldo 
      // OTOMATIS dikerjakan oleh skrip backend (menu.pb.js)
      await pb.collection('menu').delete(menuItem.id);
      
      fetchData();
      setShowDetailHistory(null);
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus data.");
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

  const [viewMode, setViewMode] = useState('grid'); // 'grid' atau 'list'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* --- PANEL KIRI (Utama) --- */}
      <div className="flex-1 flex flex-col p-3 md:p-6 lg:p-8 pt-20 md:pt-6 overflow-hidden w-full transition-colors duration-500">
         
        {/* Nav Tabs */}
        <div className={`mb-6 shrink-0 flex items-center p-2 md:p-2.5 rounded-[2.5rem] shadow-sm border overflow-x-auto no-scrollbar transition-colors duration-500 ${activeTheme.light} ${activeTheme.border} bg-white/50 backdrop-blur-md`}>
          <div className="flex gap-2 md:gap-3 px-2">
            {menuOptions.map(m => {
              const tabTheme = getThemeConfig(m.text_1);
              const isActive = selectedMenu === m.text_1;
              return (
                <button key={m.id} onClick={() => handleMenuChange(m.text_1)}
                  className={`px-5 md:px-8 py-2.5 md:py-3.5 rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                    isActive ? `${tabTheme.main} text-white shadow-xl shadow-${tabTheme.main.replace('bg-', '')}/40 scale-105` : `${tabTheme.text} hover:bg-white/80 opacity-70 hover:opacity-100 hover:shadow-sm`
                  }`}>
                  {m.text_1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar & Filters - Glassmorphism & Theme Sync */}
        <div className="p-4 md:p-6 mb-4 border border-gray-100 bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm shrink-0 flex flex-col gap-4">
            
            {/* Baris atas: input pencarian + Toggle View & Filter Mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full group">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${activeTheme.text} opacity-50 group-focus-within:opacity-100`} size={20} />
                <input 
                  type="text" 
                  placeholder={`Cari di menu ${selectedMenu}...`} 
                  className={`w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border-2 border-transparent hover:border-gray-200 rounded-2xl focus:bg-white focus:border-transparent focus:ring-4 ${activeTheme.focusRing} outline-none transition-all shadow-sm text-sm font-bold text-slate-700 placeholder-slate-400`}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {/* Tombol Toggle View (Desktop & Tablet) */}
                {selectedMenu.toLowerCase() !== 'overview' && (
                  <div className="hidden sm:flex bg-gray-50 border border-gray-200 rounded-2xl p-1.5 shadow-inner shrink-0 items-center">
                    <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all duration-300 ${viewMode === 'list' ? `${activeTheme.main} text-white shadow-md` : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}>
                      <List size={18} />
                    </button>
                    <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all duration-300 ${viewMode === 'grid' ? `${activeTheme.main} text-white shadow-md` : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}>
                      <Grid size={18} />
                    </button>
                  </div>
                )}

                {/* Tombol filter mobile (Overview) */}
                {selectedMenu === 'Overview' && (
                  <button
                    onClick={() => setShowStatusFilter(!showStatusFilter)}
                    className={`sm:hidden flex flex-1 items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold ${activeTheme.text} shadow-sm active:scale-95 transition-all`}
                  >
                    <Filter size={18} />
                    {showStatusFilter ? 'Tutup Filter' : 'Filter'}
                  </button>
                )}
              </div>
            </div>

            {/* Filter Desktop (Sinkronisasi dengan activeTheme) */}
            {selectedMenu === 'Overview' && (
              <div className="hidden sm:flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
                
                {/* Filter status */}
                <div className="flex flex-wrap items-center bg-gray-50 border border-gray-200 rounded-2xl p-1.5 shadow-inner">
                  {['all', 'lunas', 'belum'].map(status => (
                    <button key={status} onClick={() => { setFilterStatus(status); setPage(1); }}
                      className={`px-5 py-2 text-xs md:text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                        filterStatus === status ? `${activeTheme.main} text-white shadow-md scale-95` : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                      }`}>
                      {status === 'all' ? 'Semua' : status}
                    </button>
                  ))}
                </div>

                {/* Filter jenis menu */}
                <div className="flex flex-wrap items-center bg-gray-50 border border-gray-200 rounded-2xl p-1.5 shadow-inner gap-1">
                  <button onClick={() => setSelectedMenuFilters([])}
                    className={`px-4 py-2 text-xs md:text-xm font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                      selectedMenuFilters.length === 0 ? `${activeTheme.main} text-white shadow-md` : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                    }`}>
                    Semua Jenis
                  </button>
                  {menuOptions.filter(m => m.text_1 !== 'Overview').map(menu => (
                    <button key={menu.id}
                      onClick={() => {
                        setSelectedMenuFilters(prev => prev.includes(menu.text_1) ? prev.filter(j => j !== menu.text_1) : [...prev, menu.text_1]);
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-xs md:text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                        selectedMenuFilters.includes(menu.text_1) ? `${activeTheme.main} text-white shadow-md` : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                      }`}>
                      {menu.text_1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Mobile Expand */}
            {selectedMenu === 'Overview' && showStatusFilter && (
              <div className="sm:hidden flex flex-col gap-4 mt-2 animate-in slide-in-from-top-4 fade-in duration-300 border-t border-gray-100 pt-4">
                <div className="flex gap-2 bg-gray-50 rounded-2xl p-1.5 shadow-inner">
                  {['all', 'lunas', 'belum'].map(status => (
                    <button key={status} onClick={() => { setFilterStatus(status); setPage(1); setShowStatusFilter(false); }}
                      className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                        filterStatus === status ? `${activeTheme.main} text-white shadow-md` : 'text-gray-500 hover:bg-gray-200'
                      }`}>
                      {status === 'all' ? 'Semua' : status}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 bg-gray-50 rounded-2xl p-1.5 shadow-inner">
                  <button onClick={() => { setSelectedMenuFilters([]); setPage(1); setShowStatusFilter(false); }}
                    className={`flex-1 min-w-[45%] py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                      selectedMenuFilters.length === 0 ? `${activeTheme.main} text-white shadow-md` : 'text-gray-500 hover:bg-gray-200'
                    }`}>
                    Semua Jenis
                  </button>
                  {menuOptions.filter(m => m.text_1 !== 'Overview').map(menu => (
                    <button key={menu.id} onClick={() => { /* logika sama dengan di atas */ setSelectedMenuFilters(prev => prev.includes(menu.text_1) ? prev.filter(j => j !== menu.text_1) : [...prev, menu.text_1]); setPage(1); setShowStatusFilter(false); }}
                      className={`flex-1 min-w-[45%] py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                        selectedMenuFilters.includes(menu.text_1) ? `${activeTheme.main} text-white shadow-md` : 'text-gray-500 hover:bg-gray-200'
                      }`}>
                      {menu.text_1}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Content Dynamic - Wrapper */}
        <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10 transition-colors duration-500 rounded-3xl`}>
          
          {loading ? ( 
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className={`w-16 h-16 border-4 border-slate-200 border-t-transparent ${activeTheme.text.replace('text-', 'border-t-')} rounded-full animate-spin`} />
              <p className={`font-black uppercase tracking-widest text-xs ${activeTheme.text} animate-pulse`}>Memuat Data...</p>
            </div> 
          ) : ( 
            <div className="space-y-10">
                
              {/* 1. LIST PRODUK (PENJUALAN/SERVICE/PEMBELIAN) */} 
              {selectedMenu.toLowerCase() !== 'overview' && !selectedMenu.toLowerCase().includes('gaji') && ( 
                <div className={
                  viewMode === 'grid' 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                    : "flex flex-col gap-4"
                }> 
                  {products.map(p => ( 
                    <div key={p.id} onClick={() => addToCart(p)} 
                      className={`bg-white rounded-3xl border-2 border-transparent hover:${activeTheme.border} shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${
                        viewMode === 'grid' ? 'flex flex-col justify-between h-72 p-6' : 'flex flex-row items-center justify-between p-4 min-h-[120px]'
                      }`}> 
                      
                      {/* Decorative Background Blob */}
                      <div className={`absolute -top-12 -right-12 w-40 h-40 ${activeTheme.light} rounded-full blur-3xl opacity-20 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none`} />
                      
                      <div className={`relative z-10 ${viewMode === 'list' ? 'flex-1 pr-6' : ''}`}> 
                        <div className={`flex items-start mb-4 ${viewMode === 'grid' ? 'justify-between' : 'gap-4'}`}> 
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl tracking-tighter">#{formatIdLamaDisplay(p.id_lama)}</span>
                          <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm ${p.stok_3 > 5 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'}`}> 
                            SISA: {p.stok_3} {p.unit} 
                          </div> 
                        </div> 
                        <h3 className={`font-black text-slate-800 text-sm md:text-base uppercase leading-snug ${activeTheme.groupHoverText} line-clamp-2 md:line-clamp-3 tracking-tight transition-colors`}>
                          {getFullLabel(p)}
                        </h3>
                      </div> 
                      
                      <div className={`flex justify-between items-center ${activeTheme.light} rounded-2xl group-hover:${activeTheme.main} transition-all duration-300 relative z-10 ${
                        viewMode === 'grid' ? 'p-4 mt-4' : 'p-3 px-5 min-w-[200px]'
                      }`}> 
                        <p className={`font-black ${activeTheme.text} group-hover:text-white text-base md:text-lg tracking-tighter transition-colors`}>
                          Rp {p.sell_6.toLocaleString('id-ID')}
                        </p> 
                        <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center ${activeTheme.text} shadow-sm group-hover:scale-110 transition-transform`}>
                          <Plus size={20} strokeWidth={3}/>
                        </div> 
                      </div>
                    </div> 
                  ))}
                </div> 
              )}

              {/* LIST OVERVIEW */} 
              {selectedMenu.toLowerCase() === 'overview' && Object.entries(groupedHistory).map(([date, items]) => ( 
                <div key={date} className="space-y-6"> 
                  <div className="flex items-center gap-4 px-2"> 
                    <div className={`w-2 h-2 rounded-full ${activeTheme.main}`} />
                    <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{date}</span> 
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-200 to-transparent rounded-full" /> 
                  </div> 
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> 
                    {items.map(h => ( 
                      <div key={h.id} onClick={() => loadHistorySubDetails(h)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 transition-all cursor-pointer group h-auto min-h-[15rem] flex flex-col justify-between relative overflow-hidden">
                        
                        {/* Glow effect based on status */}
                        <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${h.status === 'lunas' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                        <div className="flex justify-between items-start relative z-10"> 
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${getJenisColor(h.jenis)} shadow-sm`}>
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
                                const person = allPersons.find(p => p.id_lama === h.person);
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
                                                        <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5"><Calendar size={12} /> {formatLocalDateTime(h.created_at)}</span>
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
              ))} 

              {/* LIST GAJI */}
              {selectedMenu.toLowerCase().includes('gaji') && (
                Object.keys(groupedHistory).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <div className={`w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-4`}>
                      <Calendar size={32} className="text-teal-500" />
                    </div>
                    <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Belum ada data gaji</span>
                  </div>
                ) : (
                  Object.entries(groupedHistory).map(([date, items]) => (
                    <div key={date} className="space-y-6">
                      <div className="flex items-center gap-4 px-2">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{date}</span>
                        <div className="h-[2px] flex-1 bg-gradient-to-r from-teal-100 to-transparent rounded-full" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(item => (
                            <div key={item.id} onClick={() => loadHistorySubDetails(item)}
                              className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-teal-300 transition-all cursor-pointer group h-52 flex flex-col justify-between relative overflow-hidden">
                              
                              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500 blur-3xl opacity-10 transition-opacity group-hover:opacity-30 pointer-events-none" />

                              <div className="flex justify-between items-start relative z-10">
                                <span className="text-[10px] font-black bg-teal-50 text-teal-600 border border-teal-100 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                                  GAJI KARYAWAN
                                </span>
                                <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-teal-500 group-hover:bg-teal-50 transition-colors">
                                  <History size={16} />
                                </div>
                              </div>
                              <div className="relative z-10 mt-4">
                                <h4 className="font-black text-slate-800 text-lg uppercase leading-tight mb-2 truncate group-hover:text-teal-600 transition-colors">
                                  {item.person}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-md">
                                  Operator: {item.operator || '-'}
                                </p>
                                <p className="text-xs font-bold text-slate-500 line-clamp-2 italic mt-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                  "{item.text || 'Tanpa deskripsi'}"
                                </p>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-4 relative z-10">
                                                            <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5"><Calendar size={12} /> {formatLocalDateTime(h.created_at)}</span>
                                <div className="font-black text-white bg-teal-500 shadow-md shadow-teal-500/30 px-3 py-1.5 rounded-xl text-xs">
                                  {item.qty} Item
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          )}
        </div> 

        {/* Pagination - Glassmorphism */}
        <div className="mt-auto flex justify-between items-center bg-white/80 backdrop-blur-md p-3 md:p-4 rounded-3xl border border-gray-100 shadow-lg shrink-0"> 
          <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 md:ml-6">Hal {page} / {totalPages}</p> 
          <div className="flex gap-2 md:gap-3"> 
            <button onClick={() => setPage(p => Math.max(1, p-1))} className={`p-3 md:p-4 bg-slate-50 rounded-2xl hover:${activeTheme.light} hover:${activeTheme.text} transition-colors border border-transparent hover:border-gray-200`}><ChevronLeft size={20}/></button> 
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} className={`p-3 md:p-4 bg-slate-50 rounded-2xl hover:${activeTheme.light} hover:${activeTheme.text} transition-colors border border-transparent hover:border-gray-200`}><ChevronRight size={20}/></button> 
          </div> 
        </div>
      </div>

      {/* ===== FLOATING CART BUTTON (SINKRON DENGAN TEMA) ===== */}
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

      {/* ===== MODAL KERANJANG (POPUP) – DYNAMIC THEME ===== */}
      <Modal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        title="Keranjang Belanja"
      >
        <div className="flex flex-col max-h-[75vh] md:max-h-[85vh] bg-white">
          {cart.length === 0 ? (
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
                {cartWithTierPrice.map(item => {
                  const canEditPrice =
                    userLevel === '1' ||
                    isOnlinePerson ||
                    selectedMenu.toLowerCase().includes('pembelian');
                  return (
                    <div key={item.id} className={`bg-white border-2 ${activeTheme.border} rounded-3xl p-5 relative group hover:${activeTheme.light} transition-colors shadow-sm`}>
                      <button
                        onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                        className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      
                      <div className="pr-10">
                        <p className="font-black text-slate-800 text-sm md:text-base line-clamp-2 leading-tight">
                          <span className={`font-black ${activeTheme.text} bg-white px-2 py-1 rounded-md md:rounded-lg mr-2 text-[10px] md:text-xs tracking-tight border ${activeTheme.border}`}>
                            #{formatIdLamaDisplay(item.id_lama)}
                          </span>
                          {getFullLabel(item)}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                          {item.isTiered && (
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${activeTheme.light} ${activeTheme.text}`}>
                              {item.activeTierName}
                            </span>
                          )}
                          {item.priceSelected !== item.sell_6 &&
                            !selectedMenu.toLowerCase().includes('pembelian') && (
                              <span className="text-xs text-slate-400 line-through font-bold">
                                Rp {item.sell_6.toLocaleString('id-ID')}
                              </span>
                            )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4 pt-4 border-t border-slate-100/60 gap-3">
                        <div className={`flex items-center gap-1 border-2 ${activeTheme.border} rounded-2xl bg-white overflow-hidden shadow-sm w-fit`}>
                          <button
                            onClick={() => updateQty(item.id, -1, item.stok_3)}
                            className={`w-10 h-10 flex items-center justify-center text-slate-500 hover:${activeTheme.text} hover:${activeTheme.light} transition-colors text-xl font-medium`}
                          >
                            −
                          </button>
                          <span className={`w-10 text-center text-base font-black ${activeTheme.text}`}>
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, 1, item.stok_3)}
                            className={`w-10 h-10 flex items-center justify-center text-slate-500 hover:${activeTheme.text} hover:${activeTheme.light} transition-colors text-xl font-medium`}
                          >
                            +
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] md:text-xs text-slate-400 font-bold">@</span>
                            {canEditPrice ? (
                              <div className="relative inline-block">
                                <input
                                  type="number"
                                  className={`w-28 md:w-32 py-2 pl-7 pr-3 text-right text-xs md:text-sm font-black text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all`}
                                  value={item.manualPrice !== undefined ? item.manualPrice : item.priceSelected}
                                  onChange={e => updatePrice(item.id, Number(e.target.value))}
                                />
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-black ${activeTheme.text}`}>
                                  Rp
                                </span>
                              </div>
                            ) : (
                              <span className={`text-sm font-black ${activeTheme.text}`}>
                                {item.priceSelected.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                          
                          <div className={`text-sm md:text-base font-black text-slate-900 bg-white px-4 py-2 rounded-xl border-2 ${activeTheme.border} shadow-sm`}>
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
                
                {/* 1. Pelanggan & Bayar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><Users size={14}/> Pelanggan</label>
                    <select
                      value={formBayar.personIdLama}
                      onChange={e => setFormBayar({ ...formBayar, personIdLama: e.target.value })}
                      className={`w-full mt-2 p-3 text-xs md:text-sm font-bold text-slate-700 bg-white border-2 ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all shadow-sm`}
                    >
                      {personOptions.map(p => (
                        <option key={p.id} value={p.id_lama}>
                          {p.text_1}
                        </option>
                      ))}
                    </select>
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

                {/* TOGGLE AUTO LUNAS (MUNCUL JIKA ADA ITEM DI KERANJANG) */}
                {cart.length > 0 && (
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white rounded-2xl shadow-sm mb-4 border-2 border-slate-100">
                    <div>
                      <h4 className={`text-sm font-black ${activeTheme.text} flex items-center gap-2`}>
                        <Sparkles size={16}/> Auto Lunas (Cash Kasir)
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">Isi otomatis pembayaran penuh ke akun kasir</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newState = !isAutoLunas;
                        setIsAutoLunas(newState);
                        if (newState) {
                          // Mencari otomatis akun yang mengandung kata "kasir" atau "cash", jika tidak ada gunakan akun pertama.
                          const kasirAccount = cashflowAccounts.find(a => a.text_1.toLowerCase().includes('kasir') || a.text_1.toLowerCase().includes('cash')) || cashflowAccounts[0];
                          if (kasirAccount) {
                            setFormBayar(prev => ({
                              ...prev,
                              payment: 'Tunai',
                              cashflowList: [{ accountId: kasirAccount.id, nominal: grandTotal }]
                            }));
                          }
                        } else {
                          // Kosongkan kembali jika dimatikan
                          setFormBayar(prev => ({
                            ...prev,
                            cashflowList: [{ accountId: '', nominal: 0 }]
                          }));
                        }
                      }}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none shadow-inner border border-black/10 ${isAutoLunas ? activeTheme.main : 'bg-slate-300'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-transform duration-300 ${isAutoLunas ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}

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
                      <div className="relative w-full sm:w-auto">
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
                          className="w-full sm:w-40 pl-9 pr-3 py-3 text-xs md:text-sm font-black text-slate-800 border-none bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                        />
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
                      value={formBayar.note}
                      onChange={e => setFormBayar({ ...formBayar, note: e.target.value })}
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
                        onClick={() =>
                          setFormBayar({
                            ...formBayar,
                            mekanikList: [...formBayar.mekanikList, { idLama: '', ongkos: 0 }],
                          })
                        }
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
                              alert('Mekanik sudah dipilih di baris lain!');
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
                          setMenuFiles(prev => [...prev, ...files]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {menuPreviewUrls.length === 0 ? (
                    <div className={`text-center py-6 rounded-2xl border-2 border-dashed ${activeTheme.border} bg-white/50 backdrop-blur-sm`}>
                      <p className={`text-[11px] font-black ${activeTheme.text} opacity-60`}>Belum ada file media yang dilampirkan</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {menuPreviewUrls.map((url, idx) => (
                        <div key={idx} className="relative group rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                          {isVideo(menuFiles[idx]?.name) ? (
                            <video src={url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setMenuFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2 text-white text-[9px] truncate font-bold">
                            {menuFiles[idx]?.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tampilkan file lama (jika ada) saat edit */}
                  {existingMenuFiles.length > 0 && !isEditMode && (
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
                    {editSession ? <><Save size={18}/> SIMPAN PERUBAHAN</> : <><CheckCircle2 size={18}/>CHECKOUT</>}
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
                
                <div className={`mt-4 p-3 rounded-xl border ${(() => {
                    const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                    return totalDibayar >= grandTotal ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700';
                  })()}`}>
                  <p className="flex justify-between text-[11px] uppercase tracking-widest font-black">
                    <span>Status Nota:</span>
                    <span>{(() => {
                      const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                      return totalDibayar >= grandTotal ? 'LUNAS' : 'BELUM LUNAS';
                    })()}</span>
                  </p>
                </div>
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
                <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> MENYIMPAN KE DATABASE...</span>
              ) : 'KONFIRMASI SIMPAN TRANSAKSI'} 
            </button> 
          </div> 
        </div> 
      </Modal> 

      {/* ========================================================= */} 
      {/* 2. MODAL DETAIL HISTORI TRANSAKSI BESERTA SUB-DETAILS */} 
      {/* ========================================================= */} 
      <Modal isOpen={!!showDetailHistory} onClose={() => setShowDetailHistory(null)} title="Rincian Histori & Log Finansial"> 
        {showDetailHistory && ( 
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 pb-6 custom-scrollbar"> 
            <div className={`p-6 md:p-8 rounded-[2rem] text-center text-white relative shadow-xl overflow-hidden ${activeTheme.main}`}> 
              <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl opacity-20 pointer-events-none" />
              <span className="text-[11px] font-black bg-black/20 px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md relative z-10">{showDetailHistory.ref || `INV-${showDetailHistory.id}`}</span> 

              <div className="mt-4 relative z-10">
                <h4 className="font-black text-white text-3xl md:text-3xl uppercase leading-tight tracking-tight drop-shadow-sm">
                  {(() => {
                    const person = allPersons.find(p => p.id_lama === showDetailHistory.person);
                    return person ? `${person.text_1} - ${person.text_2 || ''}` : (showDetailHistory.person || 'PELANGGAN UMUM');
                  })()}
                </h4>
                <div className="mt-3 inline-block bg-white/10 backdrop-blur-md border border-white/20 px-5 py-2 rounded-2xl">
                  <p className="text-sm font-black text-white/90 uppercase tracking-widest text-[10px]">
                    Total Invoice
                  </p>
                  <p className="text-2xl font-black text-white">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mt-5 relative z-10">
                <span className="text-[10px] font-black text-white/80 bg-black/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><User size={12}/> Kasir: {showDetailHistory.operator || 'System'}</span>
                <span className="text-[10px] font-black text-white/80 bg-black/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Calendar size={12}/> {formatLocalDateTime(showDetailHistory.created_at)}</span>
              </div>

              {showDetailHistory.marketplace && (
                <div className="mt-4 p-3 bg-black/10 rounded-xl text-[10px] text-white/90 font-bold flex flex-wrap gap-4 justify-center relative z-10 border border-white/10">
                  <span className="flex items-center gap-1"><ShoppingBag size={12}/> {showDetailHistory.marketplace}</span>
                  <span className="text-rose-200">Admin: -Rp {showDetailHistory.admin}</span>
                  <span className="text-emerald-200">CB: +Rp {showDetailHistory.cashback}</span>
                </div>
              )}

              {userLevel === '1' && showDetailHistory.jenis?.toLowerCase() !== 'pembelian' && (
              <div className="mt-6 pt-5 border-t border-white/20 flex justify-around relative z-10">
                <div className="text-center bg-black/20 flex-1 rounded-l-xl p-2 border-r border-white/10">
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Laba Kotor</p>
                  <p className="font-black text-emerald-300 text-lg md:text-xl drop-shadow-sm mt-1">Rp {totalLabaKotor.toLocaleString('id-ID')}</p>
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
            </div> 

            <div className="space-y-3"> 
              <p className={`text-[11px] font-black ${activeTheme.text} uppercase tracking-widest ml-1 flex items-center gap-2`}><Box size={16}/> Rincian Item (Log Stok Terjual)</p> 
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden h-fit"> 
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 blur-3xl opacity-5 rounded-full" />
                <p className="font-black text-blue-500 text-[11px] uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-blue-100 pb-2 relative z-10"><Wallet size={14}/> Rekaman Jurnal Kas</p> 
                {historyCashflow.length > 0 ? ( 
                  <div className="space-y-3 relative z-10">
                    {historyCashflow.map((cf, idx) => {
                      // Lookup ID dari Pocketbase ke nama akun yang dapat dibaca manusia
                      const accName = cashflowAccounts.find(a => a.id === cf.account_1)?.text_1 || cf.account_1;
                      return (
                        <div key={cf.id || idx} className="space-y-2 font-bold text-slate-600 text-[11px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm"> 
                          <p className="flex justify-between"><span>Nominal:</span> <span className="font-black text-blue-600 text-sm">Rp {cf.nominal?.toLocaleString('id-ID')}</span></p> 
                          <p className="flex justify-between"><span>Mutasi:</span> <span className="uppercase text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{cf.mutasi}</span></p> 
                          <p className="flex justify-between items-center gap-2"><span>Account:</span> <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-right truncate">{accName}</span></p> 
                          {cf.note && (
                            <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-500 italic font-medium leading-relaxed">
                              " {cf.note} "
                            </div> 
                          )}
                        </div> 
                      );
                    })}
                  </div>
                ) : <p className="text-slate-400 italic mt-2 text-[10px] relative z-10">Data jurnal kas tidak ditemukan atau sedang diselaraskan...</p>} 
              </div>

              <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden"> 
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 blur-3xl opacity-5 rounded-full" />
                <p className="font-black text-amber-500 text-[11px] uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-amber-100 pb-2"><Wrench size={14}/> Potongan Mekanik</p> 
                <div className="space-y-2 font-bold text-slate-600 text-[11px]"> 
                  {historyOngkos.length === 0 ? <p className="text-slate-400 italic font-medium mt-4">Nota ini tidak memiliki alokasi servis mekanik.</p> : ( 
                    historyOngkos.map(fee => ( 
                      <div key={fee.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <span className="font-black text-slate-700 uppercase flex items-center gap-2"><User size={12} className="text-slate-400"/> {fee.person}</span>
                        <span className="font-black text-emerald-600 text-sm tracking-tight">Rp {fee.ongkos?.toLocaleString('id-ID')}</span>
                      </div>
                    )) 
                  )} 
                </div> 
              </div> 
            </div> 

            {showDetailHistory.file && showDetailHistory.file.length > 0 && (
            <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
              <p className={`font-black text-[11px] ${activeTheme.text} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
                <ImagePlus size={16}/> Lampiran Media Nota
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {showDetailHistory.file.map((f, i) => {
                  const fileUrl = pb.files.getUrl(showDetailHistory, f);
                  return (
                    <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                      {f.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={fileUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img src={fileUrl} alt={`Lampiran ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                      )}
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <ExternalLink size={24} className="text-white drop-shadow-lg scale-75 group-hover:scale-100 transition-transform" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            <div className="flex flex-wrap md:flex-nowrap gap-3 pt-6 border-t-2 border-slate-100">
              {/* Tombol Delete: level 1,5 selalu; jika status 'belum', level 1-7 */}
              {(() => {
                const isStatusBelum = showDetailHistory?.status === 'belum';
                const bolehDelete = (userLevel === '1' || userLevel === '5') || (isStatusBelum && ['1','2','3','4','5','6','7'].includes(userLevel));
                return bolehDelete && (
                  <button 
                    onClick={() => confirmAction('Hapus Permanen', 'Peringatan: Menghapus nota ini akan mengembalikan seluruh stok barang dan menghapus jejak jurnal kas terkait. Lanjutkan?', () => handleDeleteHistory(showDetailHistory!))} 
                    className="w-12 h-12 flex-shrink-0 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-500 hover:text-white border border-rose-100 hover:shadow-lg hover:shadow-rose-500/30 transition-all flex justify-center items-center group" title="Hapus Nota"
                  >
                    <Trash2 size={20} className="group-hover:scale-110 transition-transform"/>
                  </button>
                );
              })()}

              {/* Tombol Edit: level 1-7 */}
              {['1','2','3','4','5','6','7'].includes(userLevel) && (
                <button 
                  onClick={() => {
                    if (showDetailHistory) handleEditHistoryToCart(showDetailHistory);
                  }} 
                  className="w-12 h-12 flex-shrink-0 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white border border-blue-100 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex justify-center items-center group" title="Revisi Nota"
                >
                  <Edit size={20} className="group-hover:scale-110 transition-transform"/>
                </button>
              )}

              {/* Tombol Print & Share: hanya jika status 'lunas' */}
              {showDetailHistory?.status === 'lunas' && (
                <div className="flex w-full md:w-auto gap-3">
                  <button onClick={handlePrint} 
                          className="flex-1 p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-500 hover:text-white border border-emerald-100 hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex justify-center items-center group" title="Print Struk Thermal">
                          <Printer size={20} className="group-hover:scale-110 transition-transform"/>
                  </button>
                  <button onClick={() => alert('Fitur Share PDF Invoice menyusul pada update berikutnya!')} 
                          className="flex-1 p-4 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-500 hover:text-white border border-amber-100 hover:shadow-lg hover:shadow-amber-500/30 transition-all flex justify-center items-center group" title="Bagikan Bukti Digital">
                          <Share2 size={20} className="group-hover:scale-110 transition-transform"/>
                  </button>
                </div>
              )}

              {/* Tombol Close */}
              <button onClick={() => setShowDetailHistory(null)} 
                      className="flex-[2] md:flex-1 p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all flex items-center justify-center font-black text-xs tracking-widest">
                TUTUP PANEL
              </button>
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
              <div className="border-t-[8px] border-b-[8px] border-t-slate-800 border-b-white bg-white w-[280px] text-slate-900 font-mono text-xs shadow-xl rounded-sm" id="thermal-receipt-58mm"> 
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

            {/* TOMBOL CETAK & BATAL */}
            <div className="flex flex-col sm:flex-row w-full gap-3 mt-2"> 
              <button 
                onClick={() => {
                  const receiptElement = document.getElementById('thermal-receipt-58mm');
                  if (receiptElement) {
                    const htmlContent = receiptElement.outerHTML;
                    printWithRawBT(htmlContent);
                  } else {
                    alert("Konten kertas nota gagal di-render oleh DOM.");
                  }
                }} 
                className={`flex-[2] py-4 ${activeTheme.main} text-white rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-${activeTheme.main.replace('bg-','')}/40 hover:-translate-y-1 hover:brightness-110 active:translate-y-0 transition-all tracking-widest flex justify-center items-center gap-2`}>
                <Printer size={18}/> CETAK VIA RAWBT
              </button>
              <button onClick={() => setShowReceiptPrint(null)} 
                      className="flex-1 py-4 px-6 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-black rounded-2xl text-xs md:text-sm tracking-widest transition-colors">
                TUTUP & LEWATI
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

    </div> 
  );
}