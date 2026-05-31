import { useNavigate, useLocation } from 'react-router-dom'; // Ini yang menyebabkan error ReferenceError
import { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Plus, Receipt, Layers, Printer, Share2, X,
  ArrowRight, Calendar, History, Sparkles, DollarSign, Wallet, AlertTriangle, Info, Wrench, Edit, TrendingUp, TrendingDown, Filter
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
  id: string; person: string; ongkos: number; created_at: string;
}

interface Gaji {
  id: string; person: string; pokok: number; created_at: string; tunjangan: number; bonus_1: number;
}

export default function MenuPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

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
  const [historyCashflow, setHistoryCashflow] = useState<CashflowDetail | null>(null);
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

  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

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
    return `${p.kategori} ${p.merk} ${p.jenis} ${p.keterangan} ${p.varian} ${p.tipe}`.replace(/\s+/g, ' ').trim();
  };

  const formatIdLamaDisplay = (id: string | number | undefined) => {
    if (id === undefined || id === null || id === '') return 'N/A';
    return String(id).padStart(5, '0');
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
          const jenisConditions = selectedMenuFilters.map(jenis => `jenis = "${jenis}"`).join(' || ');
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
        let baseFilter = 'stok_3 > 0';
        if (filterStr) baseFilter += ` && (${filterStr})`;
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

  const grandTotal = totalBelanja + totalOngkos;

  useEffect(() => { setFormBayar(prev => ({ ...prev, nominalBayar: grandTotal })); }, [grandTotal]);

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
    } else { setSelectedMenu(menuName); setPage(1); }
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
      const timestamp = isEditing ? editSession.createdAt : new Date().toISOString().slice(0, 19).replace('T', ' ');
      const menuLower = selectedMenu.toLowerCase();

      const selectedPersonRecordId = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '';
      const selectedPersonName = personMap[formBayar.personIdLama] || 'Umum';

      // Jika dalam Mode Edit, kembalikan stok lama dan bersihkan relasi (log_stock, cashflow, ongkos)
      if (isEditing) {
        const oldLogs = await pb.collection('log_stock').getFullList<LogStockDetail>({ filter: `ref_baru = "${editSession.menuId}"` });
        for (const old of oldLogs) {
           const revertDelta = (menuLower.includes('penjualan') || menuLower.includes('service')) ? old.qty : -old.qty;
           try {
             const prod = await pb.collection('produk').getOne(old.item_baru);
             await pb.collection('produk').update(old.item_baru, { stok_3: prod.stok_3 + revertDelta });
           } catch { console.warn(`Produk ID ${old.item_baru} dihapus dari database.`); }
           await pb.collection('log_stock').delete(old.id);
        }
        
        const oldCf = await pb.collection('cashflow').getFullList({ filter: `ref_baru = "${editSession.menuId}"` });
        for (const cf of oldCf) await pb.collection('cashflow').delete(cf.id);
        
        const oldOngkos = await pb.collection('ongkos').getFullList({ filter: `ref_baru = "${editSession.menuId}"` });
        for (const ok of oldOngkos) await pb.collection('ongkos').delete(ok.id);
      }

      // Payload Koleksi Menu
      // Hitung total dibayar dari cashflowList
      const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
      const statusBaru = totalDibayar >= grandTotal ? 'lunas' : 'belum';
      let dateLunas = null;

      // Tentukan date_lunas berdasarkan status dan mode edit/create
      if (isEditing) {
        // Ambil data menu lama untuk cek status sebelumnya
        const oldMenu = await pb.collection('menu').getOne(editSession.menuId);
        const oldStatus = oldMenu.status;
        if (statusBaru === 'lunas' && oldStatus !== 'lunas') {
          dateLunas = new Date().toISOString().slice(0, 19).replace('T', ' ');
        } else if (statusBaru === 'lunas') {
          // Pertahankan date_lunas lama jika sudah lunas
          dateLunas = oldMenu.date_lunas;
        }
      } else {
        // Mode create: set date_lunas hanya jika status lunas
        if (statusBaru === 'lunas') {
          dateLunas = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
      }

      // Payload Koleksi Menu
      const menuFormData = new FormData();
      menuFormData.append('jenis', selectedMenu);
      menuFormData.append('person', formBayar.personIdLama);
      menuFormData.append('person_baru', selectedPersonRecordId);
      menuFormData.append('text', formBayar.noteMenu);
      menuFormData.append('payment', formBayar.payment);
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

      // Append Lampiran jika ada
      if (menuFiles && menuFiles.length > 0) {
        menuFiles.forEach(file => menuFormData.append('file', file));
      }

      let menuRecordId;
      if (isEditing) {
        await pb.collection('menu').update(editSession.menuId, menuFormData);
        menuRecordId = editSession.menuId;
      } else {
        const menuRecord = await pb.collection('menu').create(menuFormData);
        menuRecordId = menuRecord.id;
      }
      // --- BATAS PENGGANTIAN ---

      // Payload Koleksi log_stock
      for (const item of cartWithTierPrice) {
        const booleanValue = (menuLower.includes('penjualan') || menuLower.includes('service')) ? 'out' : 'in';
        await pb.collection('log_stock').create({
          id_lama: '',
          created_at: timestamp,
          operator: operatorName,
          item: item.id_lama,
          qty: item.qty,
          item_baru: item.id,
          price_1: item.priceSelected,
          price_2: item.beli * item.qty,
          number_1: 0, number_2: 0,
          boolean: booleanValue,           // lowercase 'out' atau 'in'
          ref_baru: menuRecordId
        });

        const deltaStok = (menuLower.includes('penjualan') || menuLower.includes('service')) ? -item.qty : item.qty;
        await pb.collection('produk').update(item.id, { stok_3: Math.max(0, item.stok_3 + deltaStok) });
}

      // Simpan cashflow untuk setiap baris
      for (const cf of formBayar.cashflowList) {
        if (cf.accountId && cf.nominal > 0) {
          // Cari data akun untuk mendapatkan id_lama (field acc1/acc2)
          const selectedAccount = cashflowAccounts.find(acc => acc.id === cf.accountId);
          const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
          
          // Tentukan mutasi: 'in' untuk penjualan/service, 'out' untuk pembelian
          const mutasiValue = (menuLower.includes('penjualan') || menuLower.includes('service')) ? 'in' : 'out';
          
          await pb.collection('cashflow').create({
            id_lama: '',
            created_at: timestamp,
            operator: operatorName,
            nominal: cf.nominal,
            jenis: selectedMenu,
            mutasi: mutasiValue,
            account_1: cf.accountId,          // ID record akun (relasi)
            account_2: '',                    // ID record akun kedua (kosong)
            note: formBayar.note || `POS System: Nota ${menuRecordId}`,
            ref_baru: menuRecordId,
            // Field tambahan sesuai instruksi:
            person: formBayar.personIdLama,   // id_lama customer
            acc1: accountIdLama,              // id_lama akun pembayaran 1
            acc2: '',                         // id_lama akun pembayaran 2 (kosong)
          });
        }
      }

      // Payload Koleksi ongkos (Khusus Servis)
      if (menuLower.includes('service')) {
        for (const mek of formBayar.mekanikList) {
          if (mek.idLama && mek.ongkos > 0) {
            await pb.collection('ongkos').create({ 
              id_lama: '',
              created_at: timestamp,                // gunakan timestamp lengkap (bisa juga date only)
              person: mek.idLama,
              ongkos: mek.ongkos,
              operator: operatorName,              // tambahan field operator
              ref: '',
              ref_baru: menuRecordId
            });
          }
        }
      }

      // Siapkan data mekanik untuk nota
      const mechanicsForPrint = formBayar.mekanikList
        .filter(m => m.idLama && m.ongkos > 0)
        .map(m => {
          const mech = mechanics.find(me => me.username === m.idLama);
          return { name: mech?.name || m.idLama, ongkos: m.ongkos };
        });

      // Hanya tampilkan popup print jika status lunas
      if (statusBaru === 'lunas') {
        setShowReceiptPrint({
          id: menuRecordId, timestamp, customer: selectedPersonName, items: cartWithTierPrice,
          total: grandTotal, cash: formBayar.nominalBayar, change: formBayar.nominalBayar - grandTotal,
          payment: formBayar.payment,
          jenis: selectedMenu,
          mechanics: mechanicsForPrint
        });
      }

      setShowCheckoutReview(false);
      setCart([]);
      setMenuFiles([]);
      setEditSession(null);
      setIsCartOpen(false); // Tutup panel keranjang di mobile setelah sukses
      setFormBayar(prev => ({
        ...prev, nominalBayar: 0, mekanikList: [{ idLama: '', ongkos: 0 }], 
        noteMenu: '', note: '' ,marketplace: '', adminFee: 0, cashback: 0,
        cashflowList: [{ accountId: '', nominal: 0 }]
      }));

    } catch (err) {
      console.error(err);
      alert("Gagal sinkronisasi data PocketBase.");
    } finally { setIsProcessing(false); }
  };

  // --- 7. LOAD SUB-DETAILS ---
  const loadHistorySubDetails = async (menuItem: HistoryMenu) => {
    setShowDetailHistory(menuItem);
    setHistoryItems([]); setHistoryCashflow(null); setHistoryOngkos([]);
    try {
      // expand: 'item_baru' untuk menarik semua detail produk yang berelasi
      const logs = await pb.collection('log_stock').getFullList<LogStockDetail>({ filter: `ref_baru = "${menuItem.id}"`, expand: 'item_baru', $autoCancel: false });
      setHistoryItems(logs);
      const cf = await pb.collection('cashflow').getFirstListItem<CashflowDetail>(`ref_baru = "${menuItem.id}"`, { $autoCancel: false });
      setHistoryCashflow(cf);
      const fees = await pb.collection('ongkos').getFullList<OngkosDetail>({ filter: `ref_baru = "${menuItem.id}"`, $autoCancel: false });
      setHistoryOngkos(fees);
    } catch (e) { console.log("Detail sub-item tidak ditemukan."); }
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
      // 1. Hapus semua log_stock yang terkait
      const logs = await pb.collection('log_stock').getFullList({ filter: `ref_baru = "${menuItem.id}"` });
      for (const log of logs) await pb.collection('log_stock').delete(log.id);
      
      // 2. Hapus cashflow terkait
      const cfs = await pb.collection('cashflow').getFullList({ filter: `ref_baru = "${menuItem.id}"` });
      for (const cf of cfs) await pb.collection('cashflow').delete(cf.id);
      
      // 3. Hapus ongkos terkait
      const ongkosList = await pb.collection('ongkos').getFullList({ filter: `ref_baru = "${menuItem.id}"` });
      for (const ok of ongkosList) await pb.collection('ongkos').delete(ok.id);
      
      // 4. Hapus record menu (file otomatis terhapus)
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
    historyMenu.forEach(h => { const date = h.created_at?.split(' ')[0] || 'Unknown'; if (!groups[date]) groups[date] = []; groups[date].push(h); });
    return groups;
  }, [historyMenu]);

  const groupedGaji = useMemo(() => {
    const groups: Record<string, Gaji[]> = {};
    historyGaji.forEach(g => { const date = g.created_at?.split(' ')[0] || 'Unknown'; if (!groups[date]) groups[date] = []; groups[date].push(g); });
    return groups;
  }, [historyGaji]);

  return ( 
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans"> 
      
      {/* --- PANEL KIRI (Utama) --- */} 
      <div className="flex-1 flex flex-col p-4 md:p-8 pt-24 md:pt-8 overflow-hidden w-full transition-colors duration-500"> 
         
        {/* Nav Tabs */}
        <div className={`mb-6 shrink-0 flex items-center p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto no-scrollbar transition-colors duration-500 ${activeTheme.light} ${activeTheme.border}`}> 
          <div className="flex gap-2 px-2"> 
            {menuOptions.map(m => {
              const tabTheme = getThemeConfig(m.text_1);
              const isActive = selectedMenu === m.text_1;
              return (
                <button key={m.id} onClick={() => handleMenuChange(m.text_1)} 
                  className={`px-6 md:px-8 py-3 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${ 
                    isActive ? `${tabTheme.main} text-white shadow-lg scale-105` : `${tabTheme.text} hover:bg-white/60 opacity-60 hover:opacity-100` 
                  }`}> 
                  {m.text_1} 
                </button> 
              );
            })} 
          </div> 
        </div>

        {/* Search Bar - Flat Modern Style */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex flex-col gap-3">
            {/* Baris atas: input pencarian + tombol filter (mobile) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder={`Cari di menu ${selectedMenu}...`} 
                  className={`w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 ${activeTheme.focusRing} outline-none transition-all shadow-sm text-sm font-medium text-slate-700`}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              {/* Tombol filter untuk mobile (hanya di menu Overview) */}
              {selectedMenu === 'Overview' && (
                <button
                  onClick={() => setShowStatusFilter(!showStatusFilter)}
                  className="sm:hidden flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  <Filter size={16} />
                  {showStatusFilter ? 'Sembunyikan Filter' : 'Tampilkan Filter'}
                </button>
              )}
            </div>

            {/* Filter untuk desktop (selalu tampil di layar >= sm) */}
            {selectedMenu === 'Overview' && (
              <div className="hidden sm:flex flex-wrap items-center gap-3">
                {/* Filter status */}
                <div className="flex flex-wrap items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => { setFilterStatus('all'); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStatus === 'all' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => { setFilterStatus('lunas'); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStatus === 'lunas' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Lunas
                  </button>
                  <button
                    onClick={() => { setFilterStatus('belum'); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStatus === 'belum' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Belum
                  </button>
                </div>
                {/* Filter jenis menu (multi‑select) – sekarang dengan ukuran dan gaya yang sama */}
                <div className="flex flex-wrap items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => setSelectedMenuFilters([])}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      selectedMenuFilters.length === 0 ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Semua Jenis
                  </button>
                  {menuOptions.filter(m => m.text_1 !== 'Overview').map(menu => (
                    <button
                      key={menu.id}
                      onClick={() => {
                        if (selectedMenuFilters.includes(menu.text_1)) {
                          setSelectedMenuFilters(prev => prev.filter(j => j !== menu.text_1));
                        } else {
                          setSelectedMenuFilters(prev => [...prev, menu.text_1]);
                        }
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        selectedMenuFilters.includes(menu.text_1) ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {menu.text_1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter untuk mobile (muncul jika tombol ditekan) */}
            {selectedMenu === 'Overview' && showStatusFilter && (
              <div className="sm:hidden flex flex-col gap-3 mt-3 animate-in slide-in-from-top-2 duration-200">
                {/* Filter status – ukuran tombol sama seperti desktop */}
                <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => { setFilterStatus('all'); setPage(1); setShowStatusFilter(false); }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStatus === 'all' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => { setFilterStatus('lunas'); setPage(1); setShowStatusFilter(false); }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStatus === 'lunas' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Lunas
                  </button>
                  <button
                    onClick={() => { setFilterStatus('belum'); setPage(1); setShowStatusFilter(false); }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStatus === 'belum' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Belum
                  </button>
                </div>
                {/* Filter jenis – ukuran tombol disamakan dengan desktop (px-4 py-2 text-sm) */}
                <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => { setSelectedMenuFilters([]); setPage(1); setShowStatusFilter(false); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      selectedMenuFilters.length === 0 ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Semua Jenis
                  </button>
                  {menuOptions.filter(m => m.text_1 !== 'Overview').map(menu => (
                    <button
                      key={menu.id}
                      onClick={() => {
                        if (selectedMenuFilters.includes(menu.text_1)) {
                          setSelectedMenuFilters(prev => prev.filter(j => j !== menu.text_1));
                        } else {
                          setSelectedMenuFilters(prev => [...prev, menu.text_1]);
                        }
                        setPage(1);
                        setShowStatusFilter(false);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        selectedMenuFilters.includes(menu.text_1) ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {menu.text_1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List Produk (Scrollable Area) */}
        {/* Content Dynamic - Wrapper */}
        <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10 rounded-2xl transition-colors duration-500 p-2 md:p-4 bg-gradient-to-b from-transparent to-${activeTheme.light.replace('bg-', '')}/30`}>
          
          {loading ? ( 
            <div className="h-full flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            </div> 
          ) : ( 
            <div className="space-y-10">
               
              {/* 1. LIST PRODUK (PENJUALAN/SERVICE/PEMBELIAN) */} 
              {selectedMenu.toLowerCase() !== 'overview' && !selectedMenu.toLowerCase().includes('gaji') && ( 
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"> 
                  {products.map(p => ( 
                    <div key={p.id} onClick={() => addToCart(p)} className={`bg-white p-6 rounded-[2.5rem] border-2 border-transparent hover:${activeTheme.border} shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col justify-between h-72 relative overflow-hidden`}> 
                      <div className={`absolute -top-10 -right-10 w-32 h-32 ${activeTheme.light} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      
                      <div className="relative z-10"> 
                        <div className="flex justify-between items-start mb-4"> 
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl tracking-tighter">#{formatIdLamaDisplay(p.id_lama)}</span>
                          <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase ${p.stok_3 > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}> 
                            SISA: {p.stok_3} {p.unit} 
                          </div> 
                        </div> 
                        <h3 className={`font-black text-slate-800 text-sm uppercase leading-tight ${activeTheme.groupHoverText} line-clamp-3 tracking-tight transition-colors`}>
                          {formatIdLamaDisplay(p.id_lama)} - {getFullLabel(p)}
                        </h3>
                      </div> 
                      
                      <div className={`flex justify-between items-center ${activeTheme.light} p-4 rounded-2xl group-hover:${activeTheme.main} transition-all duration-300 mt-4 relative z-10`}> 
                        <p className={`font-black ${activeTheme.text} group-hover:text-white text-lg tracking-tighter transition-colors`}>
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
                <div key={date} className="space-y-4"> 
                  <div className="flex items-center gap-4 px-4"> 
                    <span className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{date}</span> 
                    <div className="h-[1px] flex-1 bg-slate-200" /> 
                  </div> 
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"> 
                    {items.map(h => ( 
                      <div key={h.id} onClick={() => loadHistorySubDetails(h)} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group h-52 flex flex-col justify-between"> 
                        <div className="flex justify-between items-start"> 
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${getJenisColor(h.jenis)}`}>
                                {h.jenis}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">•</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                h.status === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {h.status === 'lunas' ? 'LUNAS' : 'BELUM'}
                              </span>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-blue-500 transition-colors"><History size={16} /></div> 
                        </div> 
                        <div> 
                            {/* Menampilkan text_1 - text_2 dari dropdown person berdasarkan h.person */}
                            <h4 className="font-black text-slate-800 text-base uppercase leading-none mb-1 truncate">
                              {(() => {
                                const person = allPersons.find(p => p.id_lama === h.person);
                                return person ? `${person.text_1} - ${person.text_2 || ''}` : (h.person || 'PELANGGAN UMUM');
                              })()}
                            </h4>
                            {/* Menambahkan field operator */}
                            <p className="text-[10px] font-bold text-slate-500 mt-1">Operator: {h.operator || '-'}</p>
                            <p className="text-xs font-bold text-slate-400 line-clamp-2 italic mt-2">"{h.text || 'Tanpa deskripsi nota.'}"</p> 
                        </div> 
                        <div className="flex justify-between items-center border-t border-slate-100 pt-4"> 
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-300 flex items-center gap-1"><Calendar size={12}/> {h.created_at}</span>
                            <span className="text-[10px] font-black text-slate-400">|</span>
                            {h.status === 'lunas' ? (
                              <span className="text-[10px] font-black text-slate-700">Total: Rp {(h.total || 0).toLocaleString('id-ID')}</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-700">Total : Rp {(h.total || 0).toLocaleString('id-ID')}</span>
                                <span className="text-[10px] font-black text-slate-400">|</span>
                                <span className="text-[10px] font-black text-amber-600">Dibayar: Rp {(h.dibayar || 0).toLocaleString('id-ID')}</span>
                              </div>
                            )}
                          </div>
                          <div className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">{h.qty} Item</div> 
                        </div>
                      </div>
                    ))} 
                  </div> 
                </div> 
              ))} 

              {/* LIST GAJI */}
              {selectedMenu.toLowerCase().includes('gaji') && (
                Object.keys(groupedHistory).length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-bold text-sm">
                    Belum ada data gaji.
                  </div>
                ) : (
                  Object.entries(groupedHistory).map(([date, items]) => (
                    <div key={date} className="space-y-4">
                      <div className="flex items-center gap-4 px-4">
                        <span className="bg-teal-100 text-teal-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {date}
                        </span>
                        <div className="h-[1px] flex-1 bg-teal-100" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {items
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map(item => (
                            <div
                              key={item.id}
                              onClick={() => loadHistorySubDetails(item)}
                              className="bg-white p-6 rounded-[2.5rem] border border-teal-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group h-48 flex flex-col justify-between"
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black bg-teal-50 text-teal-600 px-2 py-0.5 rounded-md uppercase tracking-widest">
                                  GAJI
                                </span>
                                <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-teal-500 transition-colors">
                                  <History size={16} />
                                </div>
                              </div>
                              <div>
                                <h4 className="font-black text-slate-800 text-base uppercase leading-none mb-1 truncate">
                                  {item.person}
                                </h4>
                                <p className="text-xs font-bold text-slate-500 mt-1">
                                  Operator: {item.operator || '-'}
                                </p>
                                <p className="text-xs font-bold text-slate-400 line-clamp-2 italic mt-2">
                                  "{item.text || 'Tanpa deskripsi'}"
                                </p>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                <span className="text-[10px] font-black text-slate-300 flex items-center gap-1">
                                  <Calendar size={12} /> {item.created_at}
                                </span>
                                <div className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">
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

        <div className="mt-auto flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-200 shadow-xl shrink-0"> 
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-6">Halaman {page} / {totalPages}</p> 
          <div className="flex gap-3"> 
            <button onClick={() => setPage(p => Math.max(1, p-1))} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"><ChevronLeft size={24}/></button> 
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"><ChevronRight size={24}/></button> 
          </div> 
        </div>
      </div>

      {/* ===== FLOATING CART BUTTON (UNIVERSAL) ===== */}
      <button 
        onClick={() => setIsCartModalOpen(true)}
        className="fixed bottom-30 right-6 z-50 p-4 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-500/50 flex items-center justify-center hover:bg-blue-700 transition-all duration-300"
      >
        <div className="relative">
          <ShoppingCart size={24} />
          {totalQtyKeranjang > 0 && (
            <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {totalQtyKeranjang}
            </span>
          )}
        </div>
      </button>

      {/* ===== MODAL KERANJANG (POPUP) – FLAT COLOR THEME ===== */}
      <Modal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        title="Keranjang Belanja"
      >
        <div className="flex flex-col max-h-[75vh] bg-gray-50">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                <ShoppingCart size={48} className="text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-500 uppercase tracking-widest">Keranjang Kosong</h3>
                <p className="text-sm text-gray-400 mt-1">Silakan pilih item dari katalog.</p>
              </div>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition"
              >
                Tutup
              </button>
            </div>
          ) : (
            <>
              {/* DAFTAR ITEM – FLAT COLOR */}
              <div className="space-y-2 overflow-y-auto pr-1">
                {cartWithTierPrice.map(item => {
                  const canEditPrice =
                  userLevel === '1' ||
                  isOnlinePerson ||
                  selectedMenu.toLowerCase().includes('pembelian');
                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3 relative group hover:bg-gray-50 transition">
                      <button
                        onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded transition"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="pr-6">
                        <p className="font-medium text-gray-800 text-sm line-clamp-2">
                          <span className="font-mono text-gray-500 text-[11px] mr-1">
                            #{formatIdLamaDisplay(item.id_lama)}
                          </span>
                          {getFullLabel(item)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          {item.isTiered && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                              {item.activeTierName}
                            </span>
                          )}
                          {item.priceSelected !== item.sell_6 &&
                            !selectedMenu.toLowerCase().includes('pembelian') && (
                              <span className="text-[10px] text-gray-400 line-through">
                                Rp {item.sell_6.toLocaleString('id-ID')}
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1 border border-gray-300 rounded-md bg-white">
                          <button
                            onClick={() => updateQty(item.id, -1, item.stok_3)}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-l-md transition text-base"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium text-gray-800">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, 1, item.stok_3)}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-r-md transition text-base"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">@</span>
                          {canEditPrice ? (
                            <div className="relative inline-block">
                              <input
                                type="number"
                                className="w-20 py-1 pl-5 pr-1 text-right text-xs font-mono bg-white border border-gray-300 rounded-md focus:border-blue-400 focus:ring-0 outline-none"
                                value={item.manualPrice !== undefined ? item.manualPrice : item.priceSelected}
                                onChange={e => updatePrice(item.id, Number(e.target.value))}
                              />
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                                Rp
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-gray-700">
                              {item.priceSelected.toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          Rp {(item.qty * item.priceSelected).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* FORM PEMBAYARAN – FLAT COLOR */}
              <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold text-gray-500 uppercase">Pelanggan</label>
                    <select
                      value={formBayar.personIdLama}
                      onChange={e => setFormBayar({ ...formBayar, personIdLama: e.target.value })}
                      className="w-full p-1.5 text-xs bg-white border border-gray-300 rounded-md focus:border-blue-400 focus:ring-0 outline-none"
                    >
                      {personOptions.map(p => (
                        <option key={p.id} value={p.id_lama}>
                          {p.text_1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-gray-500 uppercase">Bayar</label>
                    <div className="flex bg-white rounded-md p-0.5 border border-gray-300">
                      {['Tunai', 'Tempo'].map(m => (
                        <button
                          key={m}
                          onClick={() => setFormBayar({ ...formBayar, payment: m })}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded-md transition ${
                            formBayar.payment === m ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {m === 'Tunai' ? 'CASH' : 'TEMPO'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-md space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-semibold text-gray-500 uppercase">Akun Kas & Nominal</label>
                    <button
                      type="button"
                      onClick={() => setFormBayar(prev => ({
                        ...prev,
                        cashflowList: [...prev.cashflowList, { accountId: '', nominal: 0 }]
                      }))}
                      className="text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
                    >
                      + Tambah Akun
                    </button>
                  </div>
                  {formBayar.cashflowList.map((cf, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      {/* Tombol Delete di kiri - hanya muncul jika baris sudah terisi akun dan nominal */}
                      {cf.accountId && cf.nominal > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm('Hapus data pembayaran ini?')) {
                              setFormBayar(prev => ({
                                ...prev,
                                cashflowList: prev.cashflowList.filter((_, i) => i !== idx)
                              }));
                            }
                          }}
                          className="text-rose-500 hover:text-rose-700"
                          title="Hapus baris pembayaran"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <select
                        value={cf.accountId}
                        onChange={e => {
                          const newList = [...formBayar.cashflowList];
                          newList[idx].accountId = e.target.value;
                          setFormBayar({ ...formBayar, cashflowList: newList });
                        }}
                        className="flex-1 p-1 text-xs border border-gray-300 rounded-md bg-white"
                      >
                        <option value="">Pilih Akun</option>
                        {cashflowAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.text_1}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Nominal"
                        value={cf.nominal || ''}
                        onChange={e => {
                          const newList = [...formBayar.cashflowList];
                          newList[idx].nominal = Number(e.target.value);
                          setFormBayar({ ...formBayar, cashflowList: newList });
                        }}
                        className="w-28 p-1 text-xs border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[9px] font-semibold text-gray-500">Total Dibayar:</span>
                    <span className="text-xs font-bold text-gray-800">
                      Rp {formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
                {formBayar.payment === 'Tempo' && (
                  <input
                    type="date"
                    value={formBayar.note}
                    onChange={e => setFormBayar({ ...formBayar, note: e.target.value })}
                    className="w-full p-1.5 text-xs bg-white border border-gray-300 rounded-md focus:border-blue-400 outline-none"
                  />
                )}
                {isOnlinePerson && (
                  <div className="grid grid-cols-3 gap-2 bg-gray-100 p-2 rounded-md">
                    <input
                      list="marketplaceOptions"
                      placeholder="Marketplace"
                      value={formBayar.marketplace}
                      onChange={e => setFormBayar({ ...formBayar, marketplace: e.target.value })}
                      className="p-1.5 text-xs border border-gray-300 rounded-md bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Admin fee"
                      value={formBayar.adminFee}
                      onChange={e => setFormBayar({ ...formBayar, adminFee: Number(e.target.value) })}
                      className="p-1.5 text-xs border border-gray-300 rounded-md bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Cashback"
                      value={formBayar.cashback}
                      onChange={e => setFormBayar({ ...formBayar, cashback: Number(e.target.value) })}
                      className="p-1.5 text-xs border border-gray-300 rounded-md bg-white"
                    />
                  </div>
                )}
                {selectedMenu.toLowerCase().includes('service') && (
                  <div className="bg-gray-100 p-2 rounded-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-teal-700">Ongkos Mekanik</span>
                      <button
                        onClick={() =>
                          setFormBayar({
                            ...formBayar,
                            mekanikList: [...formBayar.mekanikList, { idLama: '', ongkos: 0 }],
                          })
                        }
                        className="text-[9px] bg-teal-500 text-white px-2 py-0.5 rounded hover:bg-teal-600"
                      >
                        + Tambah
                      </button>
                    </div>
                    {formBayar.mekanikList.map((mek, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        {/* Tombol delete di kiri - hanya muncul jika mekanik dan ongkos sudah diisi */}
                        {mek.idLama && mek.ongkos > 0 && (
                          <button
                            onClick={() => {
                              if (window.confirm('Hapus data mekanik ini?')) {
                                setFormBayar({
                                  ...formBayar,
                                  mekanikList: formBayar.mekanikList.filter((_, i) => i !== idx)
                                });
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700"
                            title="Hapus mekanik"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <select
                          value={mek.idLama}
                          onChange={e => {
                            const selectedMekanik = e.target.value;
                            // Cek duplikat (mekanik yang sama tidak boleh dipilih dua kali)
                            const isDuplicate = formBayar.mekanikList.some((m, i) => i !== idx && m.idLama === selectedMekanik);
                            if (selectedMekanik && isDuplicate) {
                              alert('Mekanik sudah dipilih!');
                              return;
                            }
                            const newList = [...formBayar.mekanikList];
                            newList[idx].idLama = selectedMekanik;
                            setFormBayar({ ...formBayar, mekanikList: newList });
                          }}
                          className="flex-1 p-1 text-xs border border-gray-300 rounded-md bg-white"
                        >
                          <option value="">Pilih mekanik</option>
                          {mechanics.map(m => {
                            // Disable opsi jika mekanik sudah dipilih di baris lain
                            const isDisabled = formBayar.mekanikList.some((mekItem, i) => i !== idx && mekItem.idLama === m.username);
                            return (
                              <option key={m.id} value={m.username} disabled={isDisabled}>
                                {m.name}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="number"
                          placeholder="Ongkos"
                          value={mek.ongkos || ''}
                          onChange={e => {
                            const newList = [...formBayar.mekanikList];
                            newList[idx].ongkos = Number(e.target.value);
                            setFormBayar({ ...formBayar, mekanikList: newList });
                          }}
                          className="w-20 p-1 text-xs border border-gray-300 rounded-md bg-white"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Catatan nota"
                    value={formBayar.noteMenu}
                    onChange={e => setFormBayar({ ...formBayar, noteMenu: e.target.value })}
                    className="p-1.5 text-xs border border-gray-300 rounded-md bg-white"
                  />
                  <input
                    placeholder="Catatan jurnal"
                    value={formBayar.note}
                    onChange={e => setFormBayar({ ...formBayar, note: e.target.value })}
                    className="p-1.5 text-xs border border-gray-300 rounded-md bg-white"
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <div>
                    <span className="text-[9px] font-semibold text-gray-500 uppercase">Total</span>
                    <p className="text-xl font-semibold text-gray-800">Rp {grandTotal.toLocaleString('id-ID')}</p>
                  </div>
                  <button
                    onClick={handleCheckoutValidation}
                    className="px-5 py-2 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition"
                  >
                    {editSession ? 'SIMPAN' : 'CHECKOUT'}
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
      <Modal isOpen={showCheckoutReview} onClose={() => setShowCheckoutReview(false)} title="Konfirmasi Data Entry (Database)"> 
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 pb-6"> 
          <div className={`p-5 text-white rounded-3xl text-center ${editSession ? 'bg-blue-600' : 'bg-slate-900'}`}> 
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">{editSession ? 'Validasi Update Nota' : 'Total Invoice'}</p> 
            <p className="text-4xl font-black mt-1">Rp {grandTotal.toLocaleString('id-ID')}</p> 
          </div> 

          {/* Rincian Field Koleksi yang akan di Entry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium"> 
             {/* 1. KOLEKSI MENU */}
              <div className="bg-slate-50 p-4 rounded-2xl border space-y-1.5 shadow-sm">
                <p className="font-black text-[10px] text-slate-400 uppercase border-b pb-2 mb-3 flex items-center gap-1.5">
                  <Layers size={14} /> Koleksi: Menu
                </p>
                <p><span className="text-slate-400 w-24 inline-block">jenis:</span> {selectedMenu}</p>
                <p><span className="text-slate-400 w-24 inline-block">person:</span> {formBayar.personIdLama}</p>
                <p><span className="text-slate-400 w-24 inline-block">person_baru:</span> {personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '-'}</p>
                <p><span className="text-slate-400 w-24 inline-block">payment:</span> {formBayar.payment}</p>
                <p><span className="text-slate-400 w-24 inline-block">text:</span> {formBayar.noteMenu || '-'}</p>
                <p><span className="text-slate-400 w-24 inline-block">qty:</span> {totalQtyKeranjang}</p>
                <p><span className="text-slate-400 w-24 inline-block">total (menu):</span> Rp {totalBelanja.toLocaleString('id-ID')}</p>
                <p><span className="text-slate-400 w-24 inline-block">dibayar:</span> Rp {formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0).toLocaleString('id-ID')}</p>
                <p><span className="text-slate-400 w-24 inline-block">operator:</span> {operatorName}</p>
                <p><span className="text-slate-400 w-24 inline-block">created_at:</span> {editSession ? editSession.createdAt : 'Waktu Generate Auto'}</p>
                
                {/* Status dan date_lunas */}
                <p><span className="text-slate-400 w-24 inline-block">status:</span> 
                  {(() => {
                    const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                    return totalDibayar >= grandTotal ? 'lunas' : 'belum';
                  })()}
                </p>
                <p><span className="text-slate-400 w-24 inline-block">date_lunas:</span> 
                  {(() => {
                    const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                    if (editSession) {
                      // Saat edit, date_lunas akan diambil dari data lama (tidak ditampilkan di preview sederhana)
                      return '(diambil dari data lama)';
                    } else {
                      return totalDibayar >= grandTotal ? 'Akan diisi saat checkout' : '-';
                    }
                  })()}
                </p>

                {isOnlinePerson && (
                  <>
                    <p><span className="text-slate-400 w-24 inline-block">marketplace:</span> {formBayar.marketplace || '-'}</p>
                    <p><span className="text-slate-400 w-24 inline-block">admin:</span> {formBayar.adminFee || 0}</p>
                    <p><span className="text-slate-400 w-24 inline-block">cashback:</span> {formBayar.cashback || 0}</p>
                  </>
                )}
              </div>

             {/* 2. KOLEKSI CASHFLOW */}
             <div className="bg-slate-50 p-4 rounded-2xl border space-y-1.5 shadow-sm">
                <p className="font-black text-[10px] text-slate-400 uppercase border-b pb-2 mb-3 flex items-center gap-1.5"><Wallet size={14}/> Koleksi: Cashflow</p>
                <p><span className="text-slate-400 w-20 inline-block">id_lama:</span> -</p> 
                <p><span className="text-slate-400 w-20 inline-block">jenis:</span> {selectedMenu}</p> 
                <p><span className="text-slate-400 w-20 inline-block">nominal:</span> Rp {grandTotal.toLocaleString('id-ID')}</p> 
                <p><span className="text-slate-400 w-20 inline-block">mutasi:</span> {(selectedMenu.toLowerCase().includes('penjualan') || selectedMenu.toLowerCase().includes('service')) ? 'debet' : 'kredit'}</p> 
                <p><span className="text-slate-400 w-20 inline-block">account_1:</span> {formBayar.accountCashflow || '-'}</p> 
                <p><span className="text-slate-400 w-20 inline-block">account_2:</span> -</p> 
                <p><span className="text-slate-400 w-20 inline-block">note:</span> POS System: Nota [Auto ID]</p> 
                <p><span className="text-slate-400 w-20 inline-block">operator:</span> {operatorName}</p> 
                <p><span className="text-slate-400 w-20 inline-block">created_at:</span> {editSession ? editSession.createdAt : 'Waktu Generate Auto'}</p> 
                <p><span className="text-slate-400 w-20 inline-block">ref_baru:</span> [ID Relasi Menu]</p> 
             </div>

             {/* 3. KOLEKSI ONGKOS (Tampil Bersyarat) */}
             {selectedMenu.toLowerCase().includes('service') && formBayar.mekanikList.some(m => m.idLama && m.ongkos > 0) && (
               <div className="bg-blue-50/50 border-blue-100 p-5 rounded-2xl border col-span-1 md:col-span-2 shadow-sm">
                  <p className="font-black text-[10px] text-blue-500 uppercase border-b border-blue-100 pb-2 mb-4 flex items-center gap-1.5"><Wrench size={14}/> Koleksi: Ongkos</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0).map((mek, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-blue-100 space-y-1.5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                        <p className="font-bold text-slate-800 mb-2">Record Entry Mekanik {idx + 1}</p>
                        <p><span className="text-slate-400 w-20 inline-block">id_lama:</span> -</p>
                        <p><span className="text-slate-400 w-20 inline-block">person:</span> <span className="font-bold text-blue-600">{mek.idLama}</span></p>
                        <p><span className="text-slate-400 w-20 inline-block">ongkos:</span> Rp {mek.ongkos.toLocaleString('id-ID')}</p>
                        <p><span className="text-slate-400 w-20 inline-block">created_at:</span> {editSession ? editSession.createdAt.split(' ')[0] : 'Tanggal Transaksi'}</p>
                        <p><span className="text-slate-400 w-20 inline-block">ref:</span> -</p>
                        <p><span className="text-slate-400 w-20 inline-block">ref_baru:</span> [ID Relasi Menu]</p>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>

          <div className="space-y-2"> 
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Table: Log Stock (Rincian Item)</p> 
            <div className="border rounded-2xl overflow-hidden divide-y text-xs bg-white"> 
              {cartWithTierPrice.map(item => ( 
                <div key={item.id} className="p-3 flex justify-between items-center bg-slate-50/50"> 
                  <div> 
                    <p className="font-bold text-slate-800">{getFullLabel(item)}</p> 
                    <p className="text-slate-400 font-semibold">{item.qty} {item.unit} x Rp {item.priceSelected.toLocaleString('id-ID')}</p> 
                  </div> 
                  <p className="font-black text-slate-900">Rp {(item.priceSelected * item.qty).toLocaleString('id-ID')}</p> 
                </div> 
              ))} 
            </div> 
          </div> 

          <div className="flex gap-3 pt-4 border-t"> 
            <button type="button" onClick={() => setShowCheckoutReview(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400 text-xs">BATAL</button> 
            <button type="button" onClick={executeStoringData} disabled={isProcessing} className={`flex-1 py-4 text-white rounded-2xl font-black text-xs shadow-lg ${editSession ? 'bg-blue-600 shadow-blue-200' : 'bg-emerald-600 shadow-emerald-200'}`}> 
              {isProcessing ? 'MENYIMPAN DATA...' : 'KONFIRMASI'} 
            </button> 
          </div> 
        </div> 
      </Modal> 

      {/* ========================================================= */} 
      {/* 2. MODAL DETAIL HISTORI TRANSAKSI BESERTA SUB-DETAILS */} 
      {/* ========================================================= */} 
      <Modal isOpen={!!showDetailHistory} onClose={() => setShowDetailHistory(null)} title="Rincian Nota Finansial"> 
        {showDetailHistory && ( 
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1 pb-4"> 
            <div className="bg-slate-900 p-6 rounded-3xl text-center text-white relative"> 
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{showDetailHistory.ref || `INV-${showDetailHistory.id}`}</span> 

              <div className="mt-2">
                <h4 className="font-black text-white text-2xl uppercase leading-tight">
                  {(() => {
                    const person = allPersons.find(p => p.id_lama === showDetailHistory.person);
                    return person ? `${person.text_1} - ${person.text_2 || ''}` : (showDetailHistory.person || 'PELANGGAN UMUM');
                  })()}
                </h4>
                <p className="text-sm font-bold text-slate-300 mt-1">
                  Total Transaksi: Rp {totalTransaksi.toLocaleString('id-ID')}
                </p>
              </div>

              <p className="text-xs font-bold text-slate-400 mt-2">Operator: {showDetailHistory.operator || 'System'} | Tgl: {showDetailHistory.created_at}</p>

              {showDetailHistory.marketplace && (
                <div className="mt-2 text-[10px] text-slate-400 flex gap-3 justify-center">
                  <span>Marketplace: {showDetailHistory.marketplace}</span>
                  <span>Admin: {showDetailHistory.admin}</span>
                  <span>Cashback: {showDetailHistory.cashback}</span>
                </div>
              )}

              {userLevel === '1' && (
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-center gap-6">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Total Laba Kotor</p>
                    <p className="font-black text-emerald-400 text-lg">Rp {totalLabaKotor.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Margin (%)</p>
                    <p className="font-black text-white text-lg">{persentaseLaba}%</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2"> 
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Detail Koleksi Log Stock:</p> 
              <div className="border rounded-2xl bg-white divide-y text-xs"> 
                {historyItems.length === 0 ? ( 
                  <p className="p-4 text-center text-slate-400 font-bold">Memuat rincian log stok barang...</p> 
                ) : ( 
                  historyItems.map(item => ( 
                    <div key={item.id} className="p-4 bg-slate-50/30"> 
                      <div className="flex justify-between items-start mb-2">
                         <p className="font-bold text-slate-800 text-sm">{getFullLabel(item.expand?.item_baru)}</p>
                         <p className="font-black text-slate-900">Rp {(item.price_1 * item.qty)?.toLocaleString('id-ID')}</p> 
                      </div>
                      {userLevel === '1' && (
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-2">
                           <p>ID Record: <span className="font-mono text-slate-800">{item.id}</span></p>
                           <p>Item ID Lama: <span className="font-mono text-slate-800">{item.item}</span></p>
                           <p>Qty Transaksi: <span className="font-bold text-slate-800">{item.qty}</span></p>
                           <p>Mutasi (Boolean): <span className="font-bold text-slate-800">{item.boolean}</span></p>
                           <p>Price 1 (Jual Satuan): <span className="font-bold text-slate-800">Rp {item.price_1?.toLocaleString('id-ID')}</span></p>
                           <p>Price 2 (Total Modal): <span className="font-bold text-slate-800">Rp {item.price_2?.toLocaleString('id-ID')}</span></p>
                           {(() => {
                             const laba = (item.price_1 * item.qty) - item.price_2;
                             const pct = item.price_2 > 0 ? ((laba / item.price_2) * 100).toFixed(1) : 0;
                             return (
                               <div className="col-span-2 border-t border-dashed pt-2 mt-1 flex justify-between items-center">
                                 <p className="font-bold text-slate-400 uppercase tracking-widest">Laba Kotor Item Ini:</p>
                                 <p className="font-black text-emerald-600 text-sm">Rp {laba.toLocaleString('id-ID')} <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 ml-1">+{pct}%</span></p>
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

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border"> 
                <p className="font-black text-slate-400 text-[10px] uppercase">Aliran Dana (Cashflow)</p> 
                {historyCashflow ? ( 
                  <div className="mt-2 space-y-1 font-bold text-slate-700 text-[10px]"> 
                    <p>Nominal: <span className="text-blue-600">Rp {historyCashflow.nominal?.toLocaleString('id-ID')}</span></p> 
                    <p>Mutasi Jurnal: <span className="uppercase text-slate-500">{historyCashflow.mutasi}</span></p> 
                    <p>Akun Jurnal: {historyCashflow.account_1}</p> 
                    <p>Catatan: {historyCashflow.note}</p> 
                  </div> 
                ) : <p className="text-slate-400 italic mt-1 text-[10px]">Memuat data jurnal kas...</p>} 
              </div> 

              <div className="p-4 bg-slate-50 rounded-2xl border"> 
                <p className="font-black text-slate-400 text-[10px] uppercase">Ongkos Mekanik (Ongkos)</p> 
                <div className="mt-2 space-y-1 font-bold text-slate-700 text-[10px]"> 
                  {historyOngkos.length === 0 ? <p className="text-slate-400 italic">Bukan transaksi service / Kosong.</p> : ( 
                    historyOngkos.map(fee => ( 
                      <p key={fee.id} className="truncate">@{fee.person}: <span className="text-emerald-600">Rp {fee.ongkos?.toLocaleString('id-ID')}</span></p> 
                    )) 
                  )} 
                </div> 
              </div> 
            </div> 

            <div className="flex gap-2 pt-2 border-t mt-4 pt-4">
              {/* Tombol Delete: level 1,5 selalu; jika status 'belum', level 1-7 */}
              {(() => {
                const isStatusBelum = showDetailHistory?.status === 'belum';
                const bolehDelete = (userLevel === '1' || userLevel === '5') || (isStatusBelum && ['1','2','3','4','5','6','7'].includes(userLevel));
                return bolehDelete && (
                  <button 
                    onClick={() => confirmAction('Hapus Transaksi', 'Yakin ingin menghapus nota ini secara permanen?', () => handleDeleteHistory(showDetailHistory!))} 
                    className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                    <Trash2 size={18}/>
                  </button>
                );
              })()}

              {/* Tombol Edit: level 1-7 */}
              {['1','2','3','4','5','6','7'].includes(userLevel) && (
                <button 
                  onClick={() => {
                    if (showDetailHistory) handleEditHistoryToCart(showDetailHistory);
                  }} 
                  className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <Edit size={18}/>
                </button>
              )}

              {/* Tombol Print & Share: hanya jika status 'lunas' */}
              {showDetailHistory?.status === 'lunas' && (
                <>
                  <button onClick={handlePrint} 
                          className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Printer size={18}/></button>
                  <button onClick={() => alert('Fitur Share segera hadir!')} 
                          className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"><Share2 size={18}/></button>
                </>
              )}

              {/* Tombol Close */}
              <button onClick={() => setShowDetailHistory(null)} 
                      className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center font-bold text-xs">
                <X size={18} className="mr-2" /> TUTUP
              </button>
            </div>
          </div> 
        )} 
      </Modal> 

      {/* ========================================================= */} 
      {/* 3. LAYOUT TEMPLATE NOTA PRINTER THERMAL 58MM */} 
      {/* ========================================================= */} 
      <Modal isOpen={!!showReceiptPrint} onClose={() => setShowReceiptPrint(null)} title="Print Nota Kasir"> 
        {showReceiptPrint && ( 
          <div className="space-y-6"> 
            <div className="border border-dashed border-slate-300 p-4 bg-white mx-auto text-slate-800 font-mono text-xs shadow-inner rounded-xl max-w-[280px]" id="thermal-receipt-58mm"> 
              {/* HEADER TOKO */}
              <div className="text-center space-y-1 border-b border-dashed pb-3"> 
                <h4 className="font-black text-sm">PRIMA MOTOR GLADAG</h4> 
                <p className="text-[10px]">Gladag, Rogojampi, Banyuwangi</p> 
                <p className="text-[9px]">HP/WA: 081-XXXX-XXXX</p> 
              </div> 

              {/* INFORMASI NOTA (tanpa mekanik) */}
              <div className="py-2 border-b border-dashed text-[10px] space-y-0.5">
                <p>Nota: {showReceiptPrint.id}</p>
                <p>Waktu: {showReceiptPrint.timestamp}</p>
                <p>Pelanggan: {showReceiptPrint.customer}</p>
                <p>Kasir: {operatorName}</p>
                <p>Jenis Transaksi: {showReceiptPrint.jenis || '-'}</p>
              </div>

              {/* DAFTAR ITEM PRODUK & MEKANIK (dengan format seragam) */}
              <div className="py-2 border-b border-dashed text-[10px] space-y-2">
                {/* Item Produk */}
                {showReceiptPrint.items?.map((item: any, idx: number) => (
                  <div key={idx}>
                    <p className="font-bold uppercase">
                      {formatIdLamaDisplay(item.id_lama)} - {getFullLabel(item)}
                    </p>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>{item.qty} x Rp {item.priceSelected?.toLocaleString('id-ID')}</span>
                      <span className="font-mono text-slate-800">
                        Rp {(item.priceSelected * item.qty)?.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Separator jika ada mekanik */}
                {showReceiptPrint.mechanics && showReceiptPrint.mechanics.length > 0 && (
                  <div className="border-t border-dashed my-1"></div>
                )}

                {/* Servis Mekanik (format seperti item) */}
                {showReceiptPrint.mechanics?.map((m: any, idx: number) => (
                  <div key={`mech-${idx}`}>
                    <p className="font-bold uppercase">MEKANIK: {m.name}</p>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>1 x Rp {m.ongkos.toLocaleString('id-ID')}</span>
                      <span className="font-mono text-slate-800">
                        Rp {m.ongkos.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* TOTAL DAN PEMBAYARAN */}
              <div className="py-2 space-y-1 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>TOTAL:</span>
                  <span>Rp {showReceiptPrint.total?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span>BAYAR:</span>
                  <span>Rp {showReceiptPrint.cash?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span>KEMBALI:</span>
                  <span>Rp {showReceiptPrint.change?.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* TOMBOL CETAK & BATAL */}
            <div className="flex gap-2"> 
              <button 
                onClick={() => {
                  const receiptElement = document.getElementById('thermal-receipt-58mm');
                  if (receiptElement) {
                    const htmlContent = receiptElement.outerHTML;
                    printWithRawBT(htmlContent);
                  } else {
                    alert("Konten nota tidak ditemukan.");
                  }
                }} 
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs">
                CETAK NOTA (RAWBT)
              </button>
              <button onClick={() => setShowReceiptPrint(null)} 
                      className="py-4 px-6 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">
                LEWATI
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
            <div className="text-center p-4"> 
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-${themeColor}-50 text-${themeColor}-500`}> 
                {isAlert ? <AlertTriangle size={32} /> : <Info size={32} />} 
              </div> 
              <p className="font-bold text-slate-600 text-sm leading-relaxed mb-6">{dialog.message}</p> 
              <div className="flex gap-3"> 
                {dialog.type === 'confirm' && (
                  <button onClick={() => setDialog(prev => ({ ...prev, show: false }))} className="flex-1 py-3.5 bg-gray-100 text-gray-400 rounded-xl font-bold text-xs">
                    BATAL
                  </button>
                )} 
                <button 
                  onClick={dialog.onConfirm || (() => setDialog(prev => ({ ...prev, show: false })))} 
                  className={`flex-1 py-3.5 text-white rounded-xl font-bold text-xs shadow-md bg-${themeColor}-500 shadow-${themeColor}-200`}
                >
                  {dialog.type === 'confirm' ? 'YA, LANJUTKAN' : 'OKE'}
                </button> 
              </div> 
            </div> 
          );
        })()}
      </Modal>

    </div> 
  ); 
}