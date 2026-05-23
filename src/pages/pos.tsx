import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, ShoppingCart, Package, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Plus, Receipt, Layers, User, CreditCard, Printer, Share2, X,
  ArrowRight, Banknote, Calendar, History, Sparkles, CheckCircle2,
  Box, DollarSign, Wallet, AlertTriangle, Info, Users, Wrench, Edit
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
}

interface HistoryMenu {
  id: string; created_at: string; created: string; jenis: string; person: string; payment: string; 
  qty: number; text: string; tempo: string; marketplace: string; cashback: number; admin: number; operator: string; ref: string; person_baru: string;
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

  // --- 1. ALL STATES ---
  const [products, setProducts] = useState<Produk[]>([]);
  const [historyMenu, setHistoryMenu] = useState<HistoryMenu[]>([]);
  const [historyGaji, setHistoryGaji] = useState<Gaji[]>([]);
  const [menuOptions, setMenuOptions] = useState<DropdownItem[]>([]);
  const [personOptions, setPersonOptions] = useState<DropdownItem[]>([]);
  const [cashflowAccounts, setCashflowAccounts] = useState<DropdownItem[]>([]);
  const [mechanics, setMechanics] = useState<UserKaryawan[]>([]);
  const [personMap, setPersonMap] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<string>('Overview');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 12;

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
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
  if (j.includes('servis')) return 'text-blue-500 bg-blue-50';
  if (j.includes('pembelian')) return 'text-orange-500 bg-orange-50';
  return 'text-slate-500 bg-slate-100'; // Default
  };

  // Edit Session Tracker
  const [editSession, setEditSession] = useState<{ isEditing: boolean, menuId: string, createdAt: string } | null>(null);

  const [formBayar, setFormBayar] = useState({
      personIdLama: 'umum1',
      payment: 'Tunai',
      nominalBayar: 0,
      accountCashflow: '',
      mekanikList: [{ idLama: '', ongkos: 0 }],
      note: '',
      noteMenu: '',
      marketplace: '',
      adminFee: 0,
      cashback: 0
    });

  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(true);

  const [dialog, setDialog] = useState<{show: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void}>({
    show: false, title: '', message: '', type: 'alert'
  });

  const userLevel = localStorage.getItem('user_level') || '';
  const operatorName = localStorage.getItem('user_name') || 'Admin';

  // Helper untuk menyeragamkan nama produk
  const getFullLabel = (p: Produk | any) => {
    if (!p) return "Item Tidak Dikenal";
    return `${p.kategori} ${p.merk} ${p.jenis} ${p.keterangan} ${p.varian} ${p.tipe}`.replace(/\s+/g, ' ').trim();
  };

  // --- 2. INITIAL FETCH DATA ---
    useEffect(() => {
      const initData = async () => {
        try {
          const menus = await pb.collection('dropdown').getFullList<DropdownItem>({
            filter: `kategori ~ "menu" && jenis ~ "jenis menu" && visibilitas ~ "${userLevel}"`,
            sort: 'text_1', $autoCancel: false
          });
          setMenuOptions([{ id: 'ov-1', text_1: 'Overview' } as any, ...menus]);

          // Dropdown Cashflow Accounts (Perbaikan operator = menjadi ~)
          const accounts = await pb.collection('dropdown').getFullList<DropdownItem>({
            filter: `jenis ~ "cashflow account" && visibilitas ~ "${userLevel}"`,
            sort: 'text_1', $autoCancel: false
          });
          setCashflowAccounts(accounts);
          if (accounts.length > 0) {
            const kasirAcc = accounts.find(a => a.text_1.toLowerCase() === 'cashkasir');
            setFormBayar(prev => ({ ...prev, accountCashflow: kasirAcc ? kasirAcc.id_lama : accounts[0].id_lama }));
          }
          
          console.log("Cek Data Cashflow:", accounts); // <-- Cek di Inspect Element > Console
          setCashflowAccounts(accounts);
          
          const kasirAcc = accounts.find(a => a.text_1.toLowerCase().includes('cashkasir') || a.text_1.toLowerCase().includes('kasir'));
          // GUNAKAN .id BUKAN .id_lama
          setFormBayar(prev => ({ ...prev, accountCashflow: kasirAcc ? kasirAcc.id : accounts[0].id }));

          const mechs = await pb.collection('user').getFullList<UserKaryawan>({
            filter: `level = 10 && (status ~ "active")`,
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
    useEffect(() => {
        const fetchFilteredPersons = async () => {
            if (selectedMenu === 'Overview' || selectedMenu.toLowerCase().includes('gaji')) return;
            
            // Tentukan jenis berdasarkan menu
            const isPembelian = selectedMenu.toLowerCase().includes('pembelian');
            const jenisTarget = isPembelian ? 'supplier' : 'customer';

            try {
                const persons = await pb.collection('dropdown').getFullList<DropdownItem>({
                    filter: `kategori ~ "person" && jenis ~ "${jenisTarget}"`,
                    $autoCancel: false
                });
                setPersonOptions(persons);
                
                // Set default person jika kosong
                if (persons.length > 0 && !editSession?.isEditing) {
                    setFormBayar(prev => ({ ...prev, personIdLama: persons[0].id_lama }));
                }
            } catch (e) { console.error("Gagal filter persons:", e); }
        };
        
        fetchFilteredPersons();
    }, [selectedMenu]); // <-- Dependency ini yang membuatnya berubah saat pindah menu

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
          // Pencegahan Error Pencarian: Sesuaikan target kolom dengan koleksi yang aktif
          if (menuLower === 'overview') {
            conditions.push(`(id_lama ~ {:t${i}} || jenis ~ {:t${i}} || person ~ {:t${i}} || text ~ {:t${i}} || payment ~ {:t${i}})`);
          } else if (menuLower.includes('gaji')) {
            conditions.push(`(person ~ {:t${i}} || id_lama ~ {:t${i}})`);
          } else {
            conditions.push(`(id_lama ~ {:t${i}} || kategori ~ {:t${i}} || merk ~ {:t${i}} || jenis ~ {:t${i}} || keterangan ~ {:t${i}} || tipe ~ {:t${i}} || varian ~ {:t${i}})`);
          }
          params[`t${i}`] = t;
        });
      }
      const filterStr = conditions.length > 0 ? pb.filter(conditions.join(' && '), params) : '';

      if (menuLower === 'overview') {
        const res = await pb.collection('menu').getList<HistoryMenu>(page, perPage, { sort: '-created_at', filter: filterStr, $autoCancel: false });
        setHistoryMenu(res.items);
        setTotalPages(res.totalPages);
      } else if (menuLower.includes('gaji')) {
        const res = await pb.collection('gaji').getList<Gaji>(page, perPage, { sort: '-created_at', filter: filterStr, $autoCancel: false });
        setHistoryGaji(res.items);
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

  useEffect(() => { fetchData(); }, [page, searchTerm, selectedMenu]);

  const cartWithTierPrice = useMemo(() => {
      const isSpecialCustomer = !['umum1', 'online1'].includes(formBayar.personIdLama);

      return cart.map(item => {
        const basePriceDefault = isSpecialCustomer ? item.sell_5 : item.sell_6;
        let finalPrice = basePriceDefault;
        let isTiered = false;

        if (item.manualPrice !== undefined) {
          finalPrice = item.manualPrice;
        } else {
          if (item.min_3 > 0 && item.qty >= item.min_3) { finalPrice = item.sell_3; isTiered = true; }
          else if (item.min_2 > 0 && item.qty >= item.min_2) { finalPrice = item.sell_2; isTiered = true; }
          else if (item.min_1 > 0 && item.qty >= item.min_1) { finalPrice = item.sell_1; isTiered = true; }
        }

        return { ...item, priceSelected: finalPrice, isTiered, basePriceDefault };
      });
    }, [cart, formBayar.personIdLama]);

    const updatePrice = (id: string, newPrice: number) => {
      setCart(prev => prev.map(c => c.id === id ? { ...c, manualPrice: newPrice } : c));
    };

  const totalBelanja = cartWithTierPrice.reduce((sum, item) => sum + (item.priceSelected * item.qty), 0);
  const totalQtyKeranjang = cart.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => { setFormBayar(prev => ({ ...prev, nominalBayar: totalBelanja })); }, [totalBelanja]);

  // --- 5. GUARDS & INTERACTION HANDLERS ---
  const handleMenuChange = (menuName: string) => {
    if (cart.length > 0 && selectedMenu !== menuName) {
      setDialog({
        show: true, title: 'Batalkan Transaksi?',
        message: 'Keranjang belanja Anda saat ini akan dibersihkan jika Anda berpindah ke halaman menu lain. Lanjutkan?',
        type: 'confirm',
        onConfirm: () => { setCart([]); setEditSession(null); setSelectedMenu(menuName); setPage(1); setDialog(prev => ({ ...prev, show: false })); }
      });
    } else { setSelectedMenu(menuName); setPage(1); }
  };

  const addToCart = (prod: Produk) => {
    const existing = cart.find(c => c.id === prod.id);
    const currentQty = existing ? existing.qty : 0;
    if (currentQty + 1 > prod.stok_3) {
      setDialog({ show: true, title: 'Batas Stok Realtime', message: `Sisa pasokan fisik untuk barang ini hanya tersisa ${prod.stok_3} ${prod.unit}.`, type: 'alert' });
      return;
    }
    if (existing) { setCart(cart.map(c => c.id === prod.id ? { ...c, qty: c.qty + 1 } : c)); } 
    else { setCart([...cart, { ...prod, qty: 1, priceSelected: prod.sell_6, isTiered: false, basePriceDefault: prod.sell_6 }]); }
  };

  const updateQty = (id: string, delta: number, maxStok: number) => {
    const item = cart.find(c => c.id === id);
    if (item && item.qty + delta > maxStok) {
      setDialog({ show: true, title: 'Kapasitas Stok Habis', message: `Maksimal gudang (${maxStok} unit).`, type: 'alert' });
      return;
    }
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
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
      const isOnline = selectedPersonName.toLowerCase().includes('online');

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
      // --- GANTI BAGIAN INI KE BAWAH HINGGA menuRecordId ---
      // Payload Koleksi Menu (Diubah menjadi FormData untuk support file)
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
          boolean: (menuLower.includes('penjualan') || menuLower.includes('servis')) ? 'OUT' : 'IN',
          ref_baru: menuRecordId 
        });

        const deltaStok = (menuLower.includes('penjualan') || menuLower.includes('servis')) ? -item.qty : item.qty;
        await pb.collection('produk').update(item.id, { stok_3: Math.max(0, item.stok_3 + deltaStok) });
      }

      if (formBayar.accountCashflow) {
        await pb.collection('cashflow').create({
          id_lama: '',
          created_at: timestamp,
          operator: operatorName,
          nominal: totalBelanja,
          jenis: selectedMenu,
          mutasi: (menuLower.includes('penjualan') || menuLower.includes('servis')) ? 'debet' : 'kredit',
          account_1: formBayar.accountCashflow, // Pastikan ini berisi 15 digit ID, bukan nama akun
          account_2: '',
          note: formBayar.note || `POS System: Nota ${menuRecordId}`,
          ref_baru: menuRecordId 
        });
      }

      // Payload Koleksi ongkos (Khusus Servis)
      if (menuLower.includes('servis')) {
        for (const mek of formBayar.mekanikList) {
          if (mek.idLama && mek.ongkos > 0) {
            await pb.collection('ongkos').create({ 
              id_lama: '', created_at: timestamp.split(' ')[0], 
              person: mek.idLama, ongkos: mek.ongkos, ref: '', ref_baru: menuRecordId 
            });
          }
        }
      }

      setShowReceiptPrint({
        id: menuRecordId, timestamp, customer: selectedPersonName, items: cartWithTierPrice,
        total: totalBelanja, cash: formBayar.nominalBayar, change: formBayar.nominalBayar - totalBelanja,
        payment: formBayar.payment, 
        ongkos1: formBayar.mekanikList[0]?.ongkos || 0, 
        ongkos2: formBayar.mekanikList[1]?.ongkos || 0
      });

      setCart([]);
      setMenuFiles([]);
      setEditSession(null);
      setFormBayar(prev => ({ 
        ...prev, nominalBayar: 0, mekanikList: [{ idLama: '', ongkos: 0 }], 
        noteMenu: '', note: '' ,marketplace: '', adminFee: 0, cashback: 0
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

          // Ambil note dari cashflow lama jika ada
          const oldCf = await pb.collection('cashflow').getFullList({ filter: `ref_baru = "${menuItem.id}"` });
          const cfNote = oldCf.length > 0 ? oldCf[0].note : '';

          setFormBayar(prev => ({ 
            ...prev, 
            personIdLama: menuItem.person, 
            payment: menuItem.payment, 
            noteMenu: menuItem.text, 
            note: cfNote,
            marketplace: menuItem.marketplace || '',
            adminFee: menuItem.admin || 0,
            cashback: menuItem.cashback || 0,
            mekanikList: loadedMekanik
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
    // Sesuaikan dengan data yang diprint di modal receipt
    setShowReceiptPrint({
      id: showDetailHistory?.id,
      timestamp: showDetailHistory?.created_at,
      customer: personMap[showDetailHistory?.person || ''] || 'Umum',
      items: historyItems.map(h => ({ ...h.expand?.item_baru, qty: h.qty, priceSelected: h.price_1 })),
      total: totalTransaksi,
      cash: totalTransaksi, // Default
      change: 0,
      payment: showDetailHistory?.payment
    });
  };

  const handleDeleteHistory = (menuItem: HistoryMenu) => {
    setDialog({
      show: true, title: 'Hapus Nota Permanen?',
      message: 'Peringatan: Stok barang tidak akan dikembalikan otomatis jika Anda menghapus dari sini. Yakin ingin menghapus?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await pb.collection('menu').delete(menuItem.id);
          fetchData();
          setShowDetailHistory(null);
          setDialog(prev => ({ ...prev, show: false }));
        } catch (e) { alert("Gagal menghapus data."); }
      }
    });
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
    <div className="flex h-full bg-slate-100 overflow-hidden font-sans"> 
      
      {/* --- PANEL KIRI --- */} 
      <div className="flex-1 flex flex-col p-8 overflow-hidden"> 
         
        {/* Nav Tabs */} 
        <div className="mb-6 shrink-0 flex items-center bg-white p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto no-scrollbar"> 
          <div className="flex gap-2 px-2"> 
            {menuOptions.map(m => ( 
              <button key={m.id} onClick={() => handleMenuChange(m.text_1)} 
                className={`px-8 py-3.5 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all ${ 
                  selectedMenu === m.text_1 ? 'bg-slate-900 text-white shadow-xl scale-105' : 'text-slate-400 hover:bg-slate-50' 
                }`}> 
                {m.text_1} 
              </button> 
            ))} 
          </div> 
        </div> 

        {/* Search Engine */} 
        <div className="relative mb-6 shrink-0 group"> 
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" size={22} /> 
          <input type="text" placeholder={`Cari di menu ${selectedMenu}...`} 
            className="w-full pl-16 pr-8 py-5 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 outline-none font-bold text-slate-600 border-none text-base" 
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /> 
        </div> 

        {/* Content Dynamic */} 
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10"> 
          {loading ? ( 
            <div className="h-full flex items-center justify-center"><div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" /></div> 
          ) : ( 
            <div className="space-y-10"> 
               
              {/* LIST PRODUK */} 
              {selectedMenu.toLowerCase() !== 'overview' && !selectedMenu.toLowerCase().includes('gaji') && ( 
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"> 
                  {products.map(p => ( 
                    <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-6 rounded-[2.5rem] border-2 border-transparent hover:border-blue-500 shadow-sm hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between h-72"> 
                      <div> 
                        <div className="flex justify-between items-start mb-4"> 
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl tracking-tighter">#{p.id_lama}</span> 
                          <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase ${p.stok_3 > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}> 
                            SISA: {p.stok_3} {p.unit} 
                          </div> 
                        </div> 
                        <h3 className="font-black text-slate-800 text-sm uppercase leading-tight group-hover:text-blue-600 line-clamp-3 tracking-tight">{getFullLabel(p)}</h3> 
                      </div> 
                      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl group-hover:bg-blue-600 transition-all mt-4"> 
                        <p className="font-black text-blue-600 group-hover:text-white text-lg tracking-tighter">Rp {p.sell_6.toLocaleString('id-ID')}</p> 
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform"><Plus size={20} strokeWidth={3}/></div> 
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
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${getJenisColor(h.jenis)}`}>
                              {h.jenis}
                            </span>
                            <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-blue-500 transition-colors"><History size={16} /></div> 
                         </div> 
                         <div> 
                            <h4 className="font-black text-slate-800 text-base uppercase leading-none mb-2 truncate">{personMap[h.person] || h.person || 'PELANGGAN UMUM'}</h4> 
                            <p className="text-xs font-bold text-slate-400 line-clamp-2 italic">"{h.text || 'Tanpa deskripsi nota.'}"</p> 
                         </div> 
                         <div className="flex justify-between items-center border-t border-slate-100 pt-4"> 
                            <span className="text-[10px] font-black text-slate-300 flex items-center gap-1"><Calendar size={12}/> {h.created_at}</span> 
                            <div className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">{h.qty} Item</div> 
                         </div> 
                      </div> 
                    ))} 
                  </div> 
                </div> 
              ))} 

              {/* LIST GAJI */} 
              {selectedMenu.toLowerCase().includes('gaji') && Object.entries(groupedGaji).map(([date, items]) => ( 
                <div key={date} className="space-y-4"> 
                  <div className="flex items-center gap-4 px-4"> 
                    <span className="bg-emerald-100 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{date}</span> 
                    <div className="h-[1px] flex-1 bg-emerald-100" /> 
                  </div> 
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"> 
                    {items.map(g => ( 
                      <div key={g.id} className="bg-white p-6 rounded-[2.5rem] border border-emerald-100 shadow-sm hover:shadow-xl transition-all h-48 flex flex-col justify-between"> 
                        <div className="flex justify-between"> 
                          <span className="text-[10px] font-black text-emerald-500 uppercase">Slip Penggajian</span> 
                          <DollarSign className="text-emerald-500" size={18} /> 
                        </div> 
                        <div> 
                          <h4 className="font-black text-slate-800 text-base uppercase leading-none mb-1">{g.person}</h4> 
                          <p className="text-2xl font-black text-slate-900 tracking-tighter">Rp {g.pokok?.toLocaleString('id-ID')}</p> 
                        </div> 
                        <p className="text-[10px] font-black text-slate-300 flex items-center gap-1 uppercase tracking-widest"><Calendar size={12}/> {g.created_at}</p> 
                      </div> 
                    ))} 
                  </div> 
                </div> 
              ))} 
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

      {/* --- PANEL NOTA / KASIR BILLING (KANAN) --- */}
      <div className="w-[480px] bg-slate-50 border-l border-slate-200 flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.02)] z-30 overflow-hidden relative"> 
        {cart.length === 0 ? ( 
          <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-6"> 
            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-sm"> 
              <ShoppingCart size={64} className="text-slate-200" /> 
            </div> 
            <div> 
              <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Nota Kosong</h3> 
              <p className="text-sm text-slate-500 font-medium mt-2">Silakan pilih item atau jasa mekanik dari katalog.</p> 
            </div> 
          </div> 
        ) : ( 
          <> 
            {/* HEADER KERANJANG */}
            <div className="p-6 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10"> 
              <div className="flex items-center justify-between"> 
                <div> 
                  <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Receipt size={20} className="text-blue-500"/> Rincian Nota
                  </h2> 
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kategori: {selectedMenu} {editSession && <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded ml-1">(EDIT)</span>}</p> 
                </div> 
                <button onClick={() => { setCart([]); setEditSession(null); setMenuFiles([]); }} className="text-[10px] font-black text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors px-4 py-2.5 rounded-xl uppercase">Kosongkan</button> 
              </div> 
            </div> 

            {/* AREA DAFTAR ITEM (SCROLLABLE) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"> 
              {cartWithTierPrice.map(item => {
                const canEditPrice = userLevel === '1' || formBayar.personIdLama.toLowerCase().includes('online');

                return (
                  <div key={item.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors relative group"> 
                    
                    {/* Tombol Hapus Pojok Kanan Atas */}
                    <button onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={14}/>
                    </button> 

                    <div className="pr-10 mb-3"> 
                      <h4 className="font-bold text-slate-800 text-sm leading-snug">{getFullLabel(item)}</h4> 
                      <div className="flex items-center gap-2 mt-1"> 
                        {item.isTiered && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider"><Sparkles size={10}/> Harga Grosir</span>}
                        {item.priceSelected !== item.sell_6 && (
                            <span className="text-[10px] font-medium text-slate-400 line-through">Rp {item.sell_6.toLocaleString('id-ID')}</span> 
                        )}
                      </div> 
                    </div> 

                    {/* Baris Kontrol QTY, Harga Satuan & Total */}
                    <div className="flex justify-between items-center bg-slate-50/80 p-2 rounded-2xl"> 
                      
                      {/* QTY Control */}
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0"> 
                        <button onClick={() => updateQty(item.id, -1, item.stok_3)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 font-black hover:bg-slate-100 transition-colors">－</button> 
                        <span className="font-black text-slate-800 text-sm w-6 text-center tabular-nums">{item.qty}</span> 
                        <button onClick={() => updateQty(item.id, 1, item.stok_3)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 font-black hover:bg-slate-100 transition-colors">＋</button> 
                      </div> 
                      
                      {/* Harga Satuan */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] font-black text-slate-300">x</span>
                        {canEditPrice ? (
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[10px] font-bold text-blue-400">Rp</span>
                            <input 
                              type="number" 
                              className="w-[85px] py-1.5 pr-2 pl-6 text-right font-black text-blue-600 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                              value={item.manualPrice !== undefined ? item.manualPrice : item.priceSelected} 
                              onChange={e => updatePrice(item.id, Number(e.target.value))} 
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-600">
                            {item.priceSelected.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>

                      {/* Total Item (QTY x Harga) */}
                      <div className="flex-1 text-right border-l border-slate-200 ml-2 pl-2">
                         <span className="font-black text-slate-900 text-sm">Rp {(item.qty * item.priceSelected).toLocaleString('id-ID')}</span>
                      </div>

                    </div> 
                  </div> 
                );
              })}
            </div>

            {/* AREA FORM PEMBAYARAN & LAMPIRAN */}
            <div className="bg-white border-t border-slate-200 shrink-0 z-20">
              
              <button 
                onClick={() => setIsPaymentFormOpen(!isPaymentFormOpen)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 transition-colors"
              >
                {isPaymentFormOpen ? 'Sembunyikan Form' : 'Buka Form Pembayaran'} {isPaymentFormOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>

              {isPaymentFormOpen && (
                <div className="p-5 space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar"> 
                  
                  {/* Info Pelanggan & Pembayaran */}
                  <div className="grid grid-cols-2 gap-3"> 
                    <div className="space-y-1"> 
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Pelanggan</label> 
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={formBayar.personIdLama} onChange={e => setFormBayar({...formBayar, personIdLama: e.target.value})}> 
                        {personOptions.map(p => <option key={p.id} value={p.id_lama}>{p.text_1} ({p.jenis})</option>)}
                      </select>
                    </div> 
                    <div className="space-y-1"> 
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Metode Bayar</label> 
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={formBayar.payment} onChange={e => setFormBayar({...formBayar, payment: e.target.value})}> 
                        <option value="Tunai">Tunai / Cash</option> 
                        <option value="Transfer">Transfer Bank</option> 
                        <option value="Tempo">Kredit / Tempo</option> 
                      </select> 
                    </div> 
                  </div> 

                  <div className="grid grid-cols-2 gap-3"> 
                    <div className="space-y-1"> 
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Akun Keuangan</label> 
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" 
                        value={formBayar.accountCashflow} 
                        onChange={e => setFormBayar({...formBayar, accountCashflow: e.target.value})}
                      > 
                        <option value="">Pilih Akun Kas/Bank</option>
                        {cashflowAccounts.map(a => <option key={a.id} value={a.id}>{a.text_1}</option>)} 
                      </select> 
                    </div>
                  </div>

                  {/* Form Mekanik (Servis Saja) */}
                  {selectedMenu.toLowerCase().includes('servis') && (
                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3"> 
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><Wrench size={10}/> Ongkos Mekanik</p> 
                        <button onClick={() => setFormBayar(prev => ({...prev, mekanikList: [...prev.mekanikList, {idLama: '', ongkos: 0}]}))} className="text-[9px] bg-blue-600 text-white px-2 py-1 rounded-md font-bold hover:bg-blue-500">Tambah Mekanik</button>
                      </div>
                      <div className="space-y-2"> 
                        {formBayar.mekanikList.map((mek, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" value={mek.idLama} onChange={e => {
                              const newList = [...formBayar.mekanikList]; newList[idx].idLama = e.target.value; setFormBayar({...formBayar, mekanikList: newList});
                            }}> 
                              <option value="">Pilih Mekanik</option> 
                              {mechanics.map(m => <option key={m.id} value={m.username}>{m.name}</option>)} 
                            </select> 
                            <input type="number" placeholder="Ongkos" className="w-1/3 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" value={mek.ongkos || ''} onChange={e => {
                              const newList = [...formBayar.mekanikList]; newList[idx].ongkos = Number(e.target.value); setFormBayar({...formBayar, mekanikList: newList});
                            }} /> 
                            {formBayar.mekanikList.length > 1 && (
                              <button onClick={() => {
                                const newList = formBayar.mekanikList.filter((_, i) => i !== idx); setFormBayar({...formBayar, mekanikList: newList});
                              }} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white"><Trash2 size={14}/></button>
                            )}
                          </div>
                        ))}
                      </div> 
                    </div> 
                  )}

                  {/* LAMPIRAN & CATATAN (TERGABUNG AGAR RAPI) */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Catatan Nota</label> 
                        <input type="text" placeholder="Cth: Lunas..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={formBayar.noteMenu} onChange={e => setFormBayar({...formBayar, noteMenu: e.target.value})} /> 
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Catatan Jurnal (Cashflow)</label> 
                        <input type="text" placeholder="Opsional..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={formBayar.note} onChange={e => setFormBayar({...formBayar, note: e.target.value})} /> 
                      </div>
                    </div>

                    {/* FIELD UPLOAD FILE */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between mb-2">
                        <span>Lampiran Media (Opsional)</span>
                        <span className="text-slate-400">Maks. 5MB</span>
                      </label>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,video/*"
                        onChange={(e) => {
                          const selected = Array.from(e.target.files || []);
                          const valid = selected.filter(f => f.size <= 5 * 1024 * 1024 && (f.type.startsWith('image/') || f.type.startsWith('video/')));
                          if (valid.length !== selected.length) alert("Beberapa file dilewati karena melebihi 5MB atau format tidak didukung.");
                          setMenuFiles(valid);
                        }}
                        className="w-full text-xs font-bold text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                      />
                      
                      {/* WRAPPER PREVIEW GAMBAR LAMA & BARU */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200 border-dashed">
                        {/* Menampilkan Lampiran LAMA (Mode Edit) */}
                        {editSession && editSession.menuId && menuFiles.length === 0 && (
                          <div className="w-full text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">File Lama (Server):</div>
                        )}
                        {editSession && editSession.menuId && menuFiles.length === 0 && showDetailHistory?.file?.map((filename) => {
                           const isVid = isVideo(filename);
                           return (
                             <div key={filename} className="w-12 h-12 bg-slate-200 rounded-lg overflow-hidden relative shadow-sm border border-slate-300">
                               {isVid && <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white"><span className="text-[8px] font-black border border-white px-1 rounded">VID</span></div>}
                               {isVid 
                                 ? <video src={pb.files.getUrl(showDetailHistory, filename)} className="w-full h-full object-cover" /> 
                                 : <img src={pb.files.getUrl(showDetailHistory, filename)} alt="old" className="w-full h-full object-cover" />}
                             </div>
                           );
                        })}

                        {/* Menampilkan Lampiran BARU (Local Blob) */}
                        {menuPreviewUrls.length > 0 && <div className="w-full text-[9px] font-black text-blue-500 mb-1 uppercase tracking-widest">File Baru (Local):</div>}
                        {menuPreviewUrls.map((url, idx) => {
                          const isVid = menuFiles[idx].type.startsWith('video/');
                          return (
                            <div key={idx} className="w-12 h-12 bg-blue-50 rounded-lg overflow-hidden relative shadow-sm border border-blue-200">
                              {isVid && <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white"><span className="text-[8px] font-black border border-white px-1 rounded">VID</span></div>}
                              {isVid ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} alt="preview" className="w-full h-full object-cover" />}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>

                </div>
              )}

              {/* FOOTER TOTAL CHECKOUT */}
              <div className="p-6 bg-slate-900 text-white shrink-0"> 
                <div className="flex justify-between items-center mb-5"> 
                  <span className="font-black text-xs text-white/50 uppercase tracking-[0.2em]">Total</span> 
                  <span className="text-3xl font-black text-emerald-400 tabular-nums tracking-tighter">Rp {totalBelanja.toLocaleString('id-ID')}</span> 
                </div> 
                <button onClick={() => setShowCheckoutReview(true)} className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-colors ${editSession ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}> 
                  {editSession ? 'SIMPAN PERUBAHAN' : 'CHECKOUT TRANSAKSI'} <ArrowRight size={18} /> 
                </button> 
              </div> 
            </div>
          </> 
        )} 
      </div>

      {/* ========================================================= */} 
      {/* 1. MODAL OVERVIEW RE-CHECK SEBELUM EXECUTE STORING DATA */} 
      {/* ========================================================= */} 
      <Modal isOpen={showCheckoutReview} onClose={() => setShowCheckoutReview(false)} title="Konfirmasi Data Entry (Database)"> 
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 pb-6"> 
          <div className={`p-5 text-white rounded-3xl text-center ${editSession ? 'bg-blue-600' : 'bg-slate-900'}`}> 
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">{editSession ? 'Validasi Update Nota' : 'Total Invoice'}</p> 
            <p className="text-4xl font-black mt-1">Rp {totalBelanja.toLocaleString('id-ID')}</p> 
          </div> 

          {/* Rincian Field Koleksi yang akan di Entry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium"> 
             {/* 1. KOLEKSI MENU */}
             <div className="bg-slate-50 p-4 rounded-2xl border space-y-1.5 shadow-sm">
                <p className="font-black text-[10px] text-slate-400 uppercase border-b pb-2 mb-3 flex items-center gap-1.5"><Layers size={14}/> Koleksi: Menu</p>
                <p><span className="text-slate-400 w-24 inline-block">jenis:</span> {selectedMenu}</p> 
                <p><span className="text-slate-400 w-24 inline-block">person:</span> {formBayar.personIdLama}</p> 
                <p><span className="text-slate-400 w-24 inline-block">person_baru:</span> {personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '-'}</p> 
                <p><span className="text-slate-400 w-24 inline-block">payment:</span> {formBayar.payment}</p> 
                <p><span className="text-slate-400 w-24 inline-block">text:</span> {selectedMenu.toLowerCase().includes('penjualan') ? '-' : (formBayar.note || '-')}</p> 
                <p><span className="text-slate-400 w-24 inline-block">qty:</span> {totalQtyKeranjang}</p> 
                <p><span className="text-slate-400 w-24 inline-block">operator:</span> {operatorName}</p> 
                <p><span className="text-slate-400 w-24 inline-block">created_at:</span> {editSession ? editSession.createdAt : 'Waktu Generate Auto'}</p> 
                <p><span className="text-slate-400 w-24 inline-block">marketplace:</span> {(personMap[formBayar.personIdLama] || '').toLowerCase().includes('online') ? 'Online Store' : '-'}</p> 
                <p><span className="text-slate-400 w-24 inline-block">cashback:</span> {(personMap[formBayar.personIdLama] || '').toLowerCase().includes('online') ? '5000' : '0'}</p> 
                <p><span className="text-slate-400 w-24 inline-block">admin:</span> {(personMap[formBayar.personIdLama] || '').toLowerCase().includes('online') ? '2500' : '0'}</p> 
             </div>

             {/* 2. KOLEKSI CASHFLOW */}
             <div className="bg-slate-50 p-4 rounded-2xl border space-y-1.5 shadow-sm">
                <p className="font-black text-[10px] text-slate-400 uppercase border-b pb-2 mb-3 flex items-center gap-1.5"><Wallet size={14}/> Koleksi: Cashflow</p>
                <p><span className="text-slate-400 w-20 inline-block">id_lama:</span> -</p> 
                <p><span className="text-slate-400 w-20 inline-block">jenis:</span> {selectedMenu}</p> 
                <p><span className="text-slate-400 w-20 inline-block">nominal:</span> Rp {totalBelanja.toLocaleString('id-ID')}</p> 
                <p><span className="text-slate-400 w-20 inline-block">mutasi:</span> {(selectedMenu.toLowerCase().includes('penjualan') || selectedMenu.toLowerCase().includes('servis')) ? 'debet' : 'kredit'}</p> 
                <p><span className="text-slate-400 w-20 inline-block">account_1:</span> {formBayar.accountCashflow || '-'}</p> 
                <p><span className="text-slate-400 w-20 inline-block">account_2:</span> -</p> 
                <p><span className="text-slate-400 w-20 inline-block">note:</span> POS System: Nota [Auto ID]</p> 
                <p><span className="text-slate-400 w-20 inline-block">operator:</span> {operatorName}</p> 
                <p><span className="text-slate-400 w-20 inline-block">created_at:</span> {editSession ? editSession.createdAt : 'Waktu Generate Auto'}</p> 
                <p><span className="text-slate-400 w-20 inline-block">ref_baru:</span> [ID Relasi Menu]</p> 
             </div>

             {/* 3. KOLEKSI ONGKOS (Tampil Bersyarat) */}
             {selectedMenu.toLowerCase().includes('servis') && formBayar.mekanikList.some(m => m.idLama && m.ongkos > 0) && (
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
              <h3 className="text-2xl font-black mt-1 uppercase">
                {personMap[showDetailHistory.person] ? personMap[showDetailHistory.person] : (showDetailHistory.person || 'PELANGGAN UMUM')}
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-2">Operator: {showDetailHistory.operator || 'System'} | Tgl: {showDetailHistory.created_at}</p>

              {/* BAGIAN LABA KOTOR (HANYA LEVEL 1) */}
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
                  {historyOngkos.length === 0 ? <p className="text-slate-400 italic">Bukan transaksi servis / Kosong.</p> : ( 
                    historyOngkos.map(fee => ( 
                      <p key={fee.id} className="truncate">@{fee.person}: <span className="text-emerald-600">Rp {fee.ongkos?.toLocaleString('id-ID')}</span></p> 
                    )) 
                  )} 
                </div> 
              </div> 
            </div> 

            <div className="flex gap-2 pt-2 border-t mt-4 pt-4">
              {/* Tombol Delete (Level 1 & 5 saja) */}
              {(userLevel === '1' || userLevel === '5') && (
                <button onClick={() => confirmAction('Hapus Transaksi', 'Yakin ingin menghapus nota ini secara permanen?', () => handleDeleteHistory(showDetailHistory!))} 
                        className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"><Trash2 size={18}/></button>
              )}

              {/* Tombol Edit - Pastikan memanggil handleEditHistoryToCart dengan parameter yang benar */}
              <button 
                onClick={() => {
                  if (showDetailHistory) handleEditHistoryToCart(showDetailHistory);
                }} 
                className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <Edit size={18}/>
              </button>

              {/* Tombol Print */}
              <button onClick={handlePrint} 
                      className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Printer size={18}/></button>

              {/* Tombol Share */}
              <button onClick={() => alert('Fitur Share segera hadir!')} 
                      className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"><Share2 size={18}/></button>

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
               <div className="text-center space-y-1 border-b border-dashed pb-3"> 
                 <h4 className="font-black text-sm">PRIMA MOTOR GLADAG</h4> 
                 <p className="text-[10px]">Gladag, Rogojampi, Banyuwangi</p> 
                 <p className="text-[9px]">HP/WA: 081-XXXX-XXXX</p> 
               </div> 
               <div className="py-2 border-b border-dashed text-[10px] space-y-0.5"> 
                 <p>Nota: {showReceiptPrint.id}</p> 
                 <p>Waktu: {showReceiptPrint.timestamp}</p> 
                 <p>Pelanggan: {showReceiptPrint.customer}</p> 
                 <p>Kasir: {operatorName}</p> 
               </div> 
               <div className="py-2 border-b border-dashed text-[10px] space-y-2"> 
                 {showReceiptPrint.items.map((item: any) => ( 
                   <div key={item.id}> 
                     <p className="font-bold uppercase">{getFullLabel(item)}</p> 
                     <div className="flex justify-between text-[9px] text-slate-500"> 
                       <span>{item.qty} x Rp {item.priceSelected?.toLocaleString('id-ID')}</span> 
                       <span className="font-mono text-slate-800">Rp {(item.priceSelected * item.qty)?.toLocaleString('id-ID')}</span> 
                     </div> 
                   </div> 
                 ))} 
               </div> 
               <div className="py-2 space-y-1 text-[10px]"> 
                 <div className="flex justify-between font-bold"><span>TOTAL:</span><span>Rp {showReceiptPrint.total?.toLocaleString('id-ID')}</span></div> 
                 <div className="flex justify-between text-[9px]"><span>BAYAR:</span><span>Rp {showReceiptPrint.cash?.toLocaleString('id-ID')}</span></div> 
                 <div className="flex justify-between text-[9px]"><span>KEMBALI:</span><span>Rp {showReceiptPrint.change?.toLocaleString('id-ID')}</span></div> 
               </div> 
               <div className="text-center pt-4 border-t border-dashed text-[9px] text-slate-400 mt-2"> 
                 <p>Terima Kasih Atas Kunjungan Anda</p> 
                 <p>Barang Yang Sudah Dibeli Tidak Dapat Ditukar/Dikembalikan</p> 
               </div> 
             </div> 

             <div className="flex gap-2"> 
               <button onClick={() => { const printContents = document.getElementById('thermal-receipt-58mm')?.innerHTML; if (printContents) { const originalBody = document.body.innerHTML; document.body.innerHTML = printContents; window.print(); window.location.reload(); } }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs">CETAK NOTA (PRINT 58MM)</button> 
               <button onClick={() => setShowReceiptPrint(null)} className="py-4 px-6 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">LEWATI</button> 
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