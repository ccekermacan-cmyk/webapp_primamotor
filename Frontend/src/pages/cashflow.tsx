import { businessDate, businessDateBoundary, editableBalance } from '../lib/cashflow';
import { createRecordId } from '../lib/ids';
import { createFinancialBatch } from '../services/api/financialBatch';
import { flushPendingSync, deleteFinancialRecord } from '../services/api/laravel';
import { formatRupiah } from '../lib/money';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import CashflowHistoryTab from '../components/cashflow/CashflowHistoryTab';
import CashflowAccountsTab from '../components/cashflow/CashflowAccountsTab';
import CashflowTempoTab from '../components/cashflow/CashflowTempoTab';
import CashflowModalForm from '../components/cashflow/CashflowModalForm';
import CashflowBonModal from '../components/cashflow/CashflowBonModal';
import CashflowMobileFilterModal from '../components/cashflow/CashflowMobileFilterModal';
import CashflowDetailModal from '../components/cashflow/CashflowDetailModal';
import CashflowBonHistoryModal from '../components/cashflow/CashflowBonHistoryModal';
import type { Cashflow, DropdownItem } from '../components/cashflow/types';
import { 
  Wallet, FileText, Plus
} from 'lucide-react';

export default function CashflowPage() {
    const submitLockRef = useRef(false);
    const cashflowRequestRef = useRef(0);
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
    const scrollContainerAccountsRef = useRef<HTMLDivElement>(null);
    const scrollTempoRef = useRef<HTMLDivElement>(null);
    const [showHeader, setShowHeader] = useState(true);
    const [showTabs, setShowTabs] = useState(true);


    // Helper untuk mengkonversi tanggal lokal (dari input date picker) ke ISO UTC
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

    const [personOptions, setPersonOptions] = useState<{ id: string; id_lama: string; text_1: string; text_2?: string; jenis?: string; source: 'dropdown' | 'user' }[]>([]);
    
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const perPage = 20; 

    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);


    // State untuk filter jenis
    const [filterJenis, setFilterJenis] = useState<string[]>([]);
    
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAccounts, setFilterAccounts] = useState<string[]>([]); // State filter dompet
    const [filterMutasi, setFilterMutasi] = useState<string>('semua');
    
    // State baru untuk filter tanggal
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const [modalType, setModalType] = useState<'detail' | 'form' | 'formBon' | 'delete' | null>(null);
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
    const [wallets, setWallets] = useState<DropdownItem[]>([]);
    const walletsMap = useMemo(() => {
      const map = new Map<string, any>();
      wallets.forEach(w => {
        if (w.id) map.set(w.id, w);
        if (w.id_lama) map.set(w.id_lama, w);
      });
      return map;
    }, [wallets]);

    const availableJenisOptions = useMemo(() => {
      if (filterMutasi === 'masuk') return jenisOptionsIn;
      if (filterMutasi === 'keluar') return jenisOptionsOut;
      const map = new Map<string, DropdownItem>();
      [...jenisOptionsIn, ...jenisOptionsOut].forEach(j => {
        const key = j.id_lama || j.id;
        if (!map.has(key)) map.set(key, j);
      });
      return Array.from(map.values());
    }, [filterMutasi, jenisOptionsIn, jenisOptionsOut]);
    const [loadingWallets, setLoadingWallets] = useState(false);
    const [activeTab, setActiveTab] = useState<'accounts' | 'history' | 'tempo'>('history');
    
    // --- STATE BARU UNTUK SUB-TAB AKUN ---
    // --- STATE BARU UNTUK SUB-TAB AKUN ---
    const [activeAccountTab, setActiveAccountTab] = useState<'kas' | 'customer' | 'supplier' | 'karyawan'>('kas');
    const [showZeroBalances, setShowZeroBalances] = useState(false);
    const [calculating, setCalculating] = useState(false);
    
    const [, setIsFormDirty] = useState(false);

    const [filterPerson, setFilterPerson] = useState<string | null>(null);

    const userLevel = String(pb.authStore.record?.level || localStorage.getItem('user_level') || '');
    const [tempoGroups, setTempoGroups] = useState<{ date: string; items: any[] }[]>([]);
    const [loadingTempo, setLoadingTempo] = useState(false);
    const [tempoPage, setTempoPage] = useState(1);
    const [tempoCategoryFilter, setTempoCategoryFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');
    const tempoPerPage = 10;
    
    // TAMBAHAN: State untuk System Alert/Confirm Modal
    const [systemAlert, setSystemAlert] = useState({ show: false, title: '', message: '', type: 'alert' as 'alert'|'confirm', onConfirm: () => {} });

    // BON HISTORY MODAL STATES
    const [bonHistoryModalOpen, setBonHistoryModalOpen] = useState(false);
    const [bonHistoryUser, setBonHistoryUser] = useState<DropdownItem | null>(null);
    const [bonHistoryData, setBonHistoryData] = useState<any[]>([]);
    const [loadingBonHistory, setLoadingBonHistory] = useState(false);

    const openBonHistory = async (wallet: DropdownItem) => {
      setBonHistoryUser(wallet);
      setBonHistoryModalOpen(true);
      setLoadingBonHistory(true);
      try {
        const username = wallet.id_lama || ''; // username
        const name = wallet.text_1 || '';
        // Cari ID dropdown yang sesuai dengan user ini agar aman filter di bon.person
        const dropdownPerson = await pb.collection('dropdown').getFullList({
          filter: pb.filter('kategori ~ "person" && ((id_lama != "" && id_lama = {:username}) || (text_1 != "" && text_1 = {:name}))', { username, name }),
          $autoCancel: false
        });
        const dId = dropdownPerson.length > 0 ? dropdownPerson[0].id : '';

        // Filter bon yang memiliki username, nama, atau ID dropdown yang cocok
        const records = await pb.collection('bon').getFullList({
          filter: pb.filter('user = {:user} || (persontext != "" && (persontext = {:username} || persontext = {:name})) || (person != "" && person = {:person})', { user: wallet.id, username, name, person: dId }),
          sort: '-created_at',
          $autoCancel: false,
          expand: 'ref_gaji'
        });
        setBonHistoryData(records);
      } catch (err) {
        console.error("Gagal load bon history", err);
      } finally {
        setLoadingBonHistory(false);
      }
    };

    const handleDeleteBon = async (bonId: string) => {
      const bRec = bonHistoryData.find(b => b.id === bonId);
      if (!bRec) return;

      setSystemAlert({
        show: true,
        title: 'Hapus Riwayat Bon?',
        message: 'Aksi ini akan mengembalikan (revert) saldo bon karyawan sesuai dengan nominal riwayat ini. Apakah Anda yakin?',
        type: 'confirm',
        onConfirm: async () => {
          if (submitLockRef.current) return;
          submitLockRef.current = true;
          setSystemAlert(prev => ({ ...prev, show: false }));
          setIsProcessing(true);
          try {
            if (bRec.ref_gaji) {
              showAlert("Bon terkait gaji", "Ubah atau hapus melalui transaksi gaji agar perhitungan slip dan pembayaran tetap konsisten.");
              return;
            }
            if (bRec.ref_cashflow) await deleteFinancialRecord('cashflow', bRec.ref_cashflow);
            else await deleteFinancialRecord('bon', bonId);
            showAlert("Berhasil", "Riwayat Bon dihapus dan saldo di-revert.");
            
            // Reload history
            if (bonHistoryUser) {
              openBonHistory(bonHistoryUser);
              fetchWallets(); // refresh tab view
            }
          } catch (e) {
            console.error(e);
            showAlert("Gagal", e instanceof Error ? e.message : "Gagal menghapus riwayat bon.");
          } finally {
            submitLockRef.current = false;
            setIsProcessing(false);
          }
        }
      });
    };

    const isEditMode = !!(selectedTx && selectedTx.id);

    // --- STATE & LOGIKA KHUSUS TAMBAH BON ---
    const [configBon, setConfigBon] = useState<DropdownItem | null>(null);

    const [formDataBon, setFormDataBon] = useState({
      catatCashflow: false,
      created_at: formatToLocalDatetimeInput(new Date().toISOString()),
      akun_asal: '',    // Sesuai field 'akun_asal'
      person: '',       // Sesuai field 'person'
      persontext: '',   // Sesuai field 'persontext'
      nominal: 0,       // Sesuai field 'nominal'
      jenis: 'out',     // Sesuai field 'jenis' (in/out)
      note: ''          // Sesuai field 'note'
    });

    useEffect(() => {
      const checkConfigVisibility = async () => {
        try {
          const configs = await pb.collection('dropdown').getFullList<DropdownItem>({
            filter: `id_lama="addbon"`,
            $autoCancel: false
          });
          setConfigBon(configs.find(c => c.id_lama === 'addbon') || null);
        } catch(e) {
          setConfigBon(null);
        }
      };
      checkConfigVisibility();
    }, []);

    const submitFormBon = async (e: React.FormEvent) => {
      e.preventDefault();
      // Validasi
      if (!formDataBon.person) return showAlert("Validasi Gagal", "Pihak (Person) wajib dipilih!");
      if (!formDataBon.nominal || formDataBon.nominal <= 0) return showAlert("Validasi Gagal", "Nominal harus diisi!");
      if (formDataBon.catatCashflow && !formDataBon.akun_asal) return showAlert("Validasi Gagal", "Akun asal wajib dipilih!");
      if (!formDataBon.note || formDataBon.note.trim() === '') return showAlert("Validasi Gagal", "Catatan wajib diisi!");

      if (submitLockRef.current) return;
      submitLockRef.current = true;
      setIsProcessing(true);
      try {
        const currentUser = pb.authStore.model;
        const operatorName = currentUser?.name || currentUser?.username || 'Admin';
        
        // Konversi waktu lokal ke UTC (hindari double timezone offset)
        const [datePart, timePart] = formDataBon.created_at.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        const utcDate = new Date(year, month - 1, day, hours, minutes, 0).toISOString();

        const batch = createFinancialBatch();
        const cashflowId = formDataBon.catatCashflow ? createRecordId() : '';
        const selectedPerson = personOptions.find(p => p.id === formDataBon.person);
        const employee = selectedPerson?.source === 'user' ? { id: selectedPerson.id } : await pb.collection('user').getFirstListItem(pb.filter('username = {:username}', { username: formDataBon.persontext })).catch(() => null);

        // 1. Queue TULIS KE CASHFLOW (Jika dicentang)
        if (formDataBon.catatCashflow && formDataBon.akun_asal) {
          const cfData = new FormData();
          cfData.append("id", cashflowId);
          cfData.append("created_at", utcDate);
          cfData.append("operator", operatorName);
          cfData.append("jenis", "bonkaryawan");
          cfData.append("mutasi", "out");
          cfData.append("account_1", formDataBon.akun_asal);
          cfData.append("account_2", selectedPerson?.source === "user" ? selectedPerson.id : "");
          cfData.append("person", selectedPerson?.source === "dropdown" ? formDataBon.person : "");
          cfData.append("persontext", formDataBon.persontext);
          cfData.append("nominal", String(formDataBon.nominal));
          cfData.append("note", formDataBon.note);
          
          files.forEach(f => { if (!f.isOld) cfData.append("file", f); });

          batch.collection('cashflow').create(cfData);

        }

        // 2. Queue TULIS KE BON
        const bonData = new FormData();
        bonData.append("created_at", utcDate);
        bonData.append("person", selectedPerson?.source === "dropdown" ? formDataBon.person : "");
        bonData.append("user", employee?.id || "");
        bonData.append("ref_cashflow", cashflowId);
        bonData.append("persontext", formDataBon.persontext);
        bonData.append("nominal", String(formDataBon.nominal));
        bonData.append("note", formDataBon.note);
        bonData.append("jenis", "out");
        bonData.append("operator", operatorName);
        
        if (formDataBon.catatCashflow) {
          bonData.append("akun_asal", formDataBon.akun_asal);
        }

        files.forEach(f => { if (!f.isOld) bonData.append("file", f); });

        batch.collection('bon').create(bonData);

        // EKSEKUSI POCKETBASE ATOMIC BATCH
        await batch.send([], () => setModalType(null));

        showAlert("Sukses", "Data Bon berhasil disimpan!");
        setModalType(null);
        setFiles([]);
        setFormDataBon({
          catatCashflow: false, 
          created_at: formatToLocalDatetimeInput(new Date().toISOString()),
          akun_asal: '', person: '', persontext: '', nominal: 0, note: '', jenis: 'out'
        } as any);
        fetchCashflow();
        fetchWallets();
      } catch (error: any) {
        showAlert("Gagal Simpan", error.message);
      } finally {
        submitLockRef.current = false;
        setIsProcessing(false);
      }
    };

    const fetchTempo = async () => {
      setLoadingTempo(true);
      try {
        const todayKey = businessDate();

        const result = await pb.collection('menu').getFullList({
          filter: `jenis ~ "pembelian" && status = "belum" && tempo != ""`,
          sort: 'tempo',
          $autoCancel: false,
        });
        const items = result;

        // Kelompokkan berdasarkan tanggal (YYYY-MM-DD)
        const groups: Record<string, any[]> = {};
        items.forEach(item => {
          const dateKey = businessDate(item.tempo);
          if (!dateKey) return;
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(item);
        });

        // Urutkan grup: upcoming (>= hari ini) dulu, lalu overdue
        const sortedKeys = Object.keys(groups).sort((a, b) => {
          const aMs = new Date(a).getTime();
          const bMs = new Date(b).getTime();
          const aIsUpcoming = a >= todayKey;
          const bIsUpcoming = b >= todayKey;
          if (aIsUpcoming && !bIsUpcoming) return -1;
          if (!aIsUpcoming && bIsUpcoming) return 1;
          return aMs - bMs;
        });

        const grouped = sortedKeys.map(key => ({ date: key, items: groups[key] }));
        setTempoGroups(grouped);
      } catch (error) {
        console.error('Gagal mengambil data jatuh tempo:', error);
      } finally {
        setLoadingTempo(false);
      }
    };

    // TAMBAHAN: Helper memanggil alert
    const showAlert = (title: string, message: string) => {
      setSystemAlert({ show: true, title, message, type: 'alert', onConfirm: () => setSystemAlert(prev => ({...prev, show: false})) });
    };

    const checkFormDirty = () => {
      return !!(formData.jenis || formData.account_1 || formData.nominal || formData.note);
    };

    const getAccountName = (idOrName: string | undefined) => {
      if (!idOrName) return '-';
      const acc = accountOptions.find(opt => opt.id === idOrName || opt.text_1 === idOrName);
      return acc ? acc.text_1 : idOrName;
    };

    const getPersonName = (personId: string | undefined, persontextFallback?: string) => {
      if (!personId && !persontextFallback) return '-';
      if (!personId) return persontextFallback || '-';
      // Cari di personOptions
      const person = personOptions.find(opt => opt.id === personId || opt.id_lama === personId);
      
      if (!person) return persontextFallback || personId;
      
      // Jika source-nya 'dropdown', gunakan text_1 dan text_2
      if (person.source === 'dropdown') {
         const pData = person as any;
         // Pastikan text_2 ada dan tidak kosong
         return pData.text_2 ? `${pData.text_1} - ${pData.text_2}` : pData.text_1;
      }
      
      // Jika source-nya 'user', return text_1 (karena di fetchPersonOptions kita set text_1 = user.name)
      return person.text_1 || persontextFallback || personId;
    };

    const fetchDropdowns = async () => {
      try {
        const records = await pb.collection('dropdown').getFullList<DropdownItem>({
          filter: `kategori ~ "Cashflow" && (jenis ~ "jenis" || jenis ~ "account") `,
          $autoCancel: false
        });
        // Pisahkan berdasarkan jenis
        const visibleRecords = records;
        const jenisRecords = visibleRecords.filter(r => String(r.jenis).toLowerCase().includes('jenis'));
        const accountRecords = visibleRecords.filter(r => String(r.jenis).toLowerCase().includes('account'));
        
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
        const userLevel = String(pb.authStore.record?.level || localStorage.getItem('user_level') || '');

        // 1. Kondisi untuk Akun Kas (Cashflow)
        let cashflowCond = `(kategori ~ "cashflow" && jenis ~ "cashflow account"`;
        cashflowCond += `)`;

        // 2. Kondisi untuk Person (Customer, Supplier)
        // Karyawan akan diambil langsung dari koleksi 'user'
        let personCond = `(kategori ~ "person" && (jenis ~ "customer" || jenis ~ "supplier"))`;

        // Gabungkan kedua kondisi
        let filterCondition = `${cashflowCond} || ${personCond}`;

        const [records, userRecordsRaw] = await Promise.all([
          pb.collection('dropdown').getFullList<DropdownItem>({
            filter: filterCondition,
            $autoCancel: false
          }),
          pb.collection('user').getFullList({
            filter: userLevel === '1' ? '' : `id = "${currentUser?.id}"`,
            $autoCancel: false
          })
        ]);

        const userAsDropdown = userRecordsRaw.map(u => ({
          id: u.id,
          id_lama: u.username || u.id,
          text_1: u.name || u.username,
          kategori: 'Person',
          jenis: 'User',
          number_1: Number(u.number) || 0,
          link_image: u.avatar || '',
          enum_4: u.level || ''
        } as unknown as DropdownItem));

        setWallets([...records, ...userAsDropdown]);
      } catch (error) {
        console.error("Gagal memuat dompet:", error);
      } finally {
        setLoadingWallets(false);
      }
    };

    // ========== FUNGSI HITUNG ULANG (PIUTANG CUSTOMER & HUTANG SUPPLIER) ==========
    const calculateBalances = async () => {
      if (calculating || submitLockRef.current) return;
      submitLockRef.current = true;
      setCalculating(true);
      
      try {
        await flushPendingSync();
        const dateStr = businessDate();
        
        // Ambil data wallet sesuai activeAccountTab
        let targetItems: DropdownItem[] = [];
        
        if (activeAccountTab === 'customer') {
          // Piutang Customer
          targetItems = wallets.filter(w => 
            (w.kategori || '').toLowerCase().includes('person') && 
            (w.jenis || '').toLowerCase().includes('customer')
          );
        } else if (activeAccountTab === 'supplier') {
          // Hutang Supplier
          targetItems = wallets.filter(w => 
            (w.kategori || '').toLowerCase().includes('person') && 
            (w.jenis || '').toLowerCase().includes('supplier')
          );
        } else {
          showAlert('Info', 'Fitur hitung ulang hanya untuk tab Piutang dan Hutang.');
          setCalculating(false);
          return;
        }
        
        if (targetItems.length === 0) {
          showAlert('Info', 'Tidak ada data untuk kategori ini.');
          setCalculating(false);
          return;
        }
        
        const batch = createFinancialBatch();
        for (const item of targetItems) {
          batch.collection('dropdown').update(item.id, {recalculate_person:true,text_8:dateStr});
        }
        const updateCount = targetItems.length;
        await batch.send();

        // Refresh data wallets
        await fetchWallets();
        showAlert('Sukses', `Berhasil menghitung ulang & memperbarui ${updateCount} data!`);
        
      } catch (error: any) {
        console.error('Gagal menghitung:', error);
        showAlert('Gagal', 'Terjadi kesalahan saat menghitung: ' + error.message);
      } finally {
        submitLockRef.current = false;
        setCalculating(false);
      }
    };

    const fetchPersonOptions = async () => {
      try {
        const cacheKey = 'cashflow:personOptions:v1';
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPersonOptions(parsed);
              return;
            }
          } catch { /* parse error, fetch fresh */ }
        }

        // Ambil SEMUA person dari dropdown (customer, supplier, user) dengan case-insensitive
        const [persons, users] = await Promise.all([
          pb.collection('dropdown').getFullList({
            filter: `kategori ~ "person"`,
            $autoCancel: false
          }),
          pb.collection('user').getFullList({
            filter: `status = "Active" || status = "active"`,
            $autoCancel: false
          })
        ]);
        const dropdownList = persons.map(p => ({
          id: p.id,
          id_lama: p.id_lama || '',
          text_1: p.text_1,
          text_2: (p as any).text_2 || '',
          source: 'dropdown' as const,
          jenis: p.jenis || '' // akan berisi 'customer', 'supplier', atau 'user'
        }));

        const userList = users.map(u => ({
          id: u.id,
          id_lama: u.username || u.id,
          text_1: u.name || u.username,
          source: 'user' as const,
          text_2: '',
          jenis: 'user'
        }));

        // Gabungkan dan hilangkan duplikat berdasarkan id_lama
        const combined = [...dropdownList, ...userList];
        const uniqueMap = new Map();
        combined.forEach(item => {
          const key = item.id_lama || item.id;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        const result = Array.from(uniqueMap.values());
        setPersonOptions(result);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
      } catch (error) {
        console.error("Gagal memuat person:", error);
      }
    };

    const fetchCashflow = async () => {
      const requestId = ++cashflowRequestRef.current;
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
          if (filterAccounts.length) {
            const source = filterAccounts.map((id, i) => { params[`wallet${i}`] = id; return `account_1 = {:wallet${i}}`; }).join(' || ');
            const target = filterAccounts.map((_, i) => `account_2 = {:wallet${i}}`).join(' || ');
            if (filterMutasi === 'masuk') conditions.push(`((mutasi = "in" && (${source})) || (mutasi = "out" && jenis ~ "transfer" && (${target}) && !(${source})))`);
            else conditions.push(`mutasi = "out" && (${source})`);
          } else conditions.push(filterMutasi === 'masuk' ? `mutasi = "in"` : `mutasi = "out"`);
        } else if (filterAccounts.length > 0) {
          const accountConditions = filterAccounts.map((id, i) => {
            params[`wallet${i}`] = id;
            return `(account_1 = {:wallet${i}} || account_2 = {:wallet${i}})`;
          }).join(' || ');
          conditions.push(`(${accountConditions})`);
        }

        // --- LOGIKA FILTER TANGGAL ---
        if (dateRange.start) {
          conditions.push(`created_at >= {:start}`);
          params.start = businessDateBoundary(dateRange.start);
        }
        if (dateRange.end) {
          conditions.push(`created_at < {:end}`);
          params.end = businessDateBoundary(dateRange.end, true);
        }

        if (filterJenis.length > 0) {
          const jenisConditions = filterJenis.map(id => `jenis = "${id}"`).join(' || ');
          conditions.push(`(${jenisConditions})`);
        }

        // --- FILTER PERSON (untuk customer/supplier) ---
        if (filterPerson) {
          conditions.push(`person = {:person}`);
          params.person = filterPerson;
        }

        const requestOptions: any = { sort: '-created_at' };
        if (conditions.length > 0) requestOptions.filter = pb.filter(conditions.join(' && '), params);

        const result = await pb.collection('cashflow').getList<Cashflow>(page, perPage, {
          ...requestOptions,
          $autoCancel: false 
        });
        if (requestId !== cashflowRequestRef.current) return;
        setTransactions(result.items);
        setTotalPages(result.totalPages);
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        if (requestId === cashflowRequestRef.current) setLoading(false);
      }
    };

    useEffect(() => { 
      fetchDropdowns(); 
      fetchPersonOptions(); 
    }, []);
    useEffect(() => {
      const delayDebounce = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 250);
      return () => clearTimeout(delayDebounce);
    }, [searchInput]);
    
    // Hanya fetch data tab yang sedang aktif
    useEffect(() => {
      if (activeTab === 'history') {
        fetchCashflow();
      }
    }, [activeTab, page, searchTerm, filterMutasi, dateRange, filterAccounts, filterJenis, filterPerson]);

    useEffect(() => {
      if (activeTab === 'accounts') {
        fetchWallets();
      } else if (activeTab === 'tempo') {
        fetchTempo();
      }
    }, [activeTab]);

    // Muat data dompet bila form transaksi dibuka saat wallets masih kosong
    useEffect(() => {
      if ((modalType === 'form' || modalType === 'formBon') && wallets.length === 0) {
        fetchWallets();
      }
    }, [modalType, wallets.length]);

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
      const containerTempo = scrollTempoRef.current;

      const handleScroll = () => {
        const activeContainer = activeTab === 'tempo' ? containerTempo : (activeTab === 'history' ? containerHistory : containerAccounts);
        if (!activeContainer) return;
        const scrollTop = activeContainer.scrollTop;
        if (scrollTop > 20) { setShowHeader(false); setShowTabs(false); }
        else { setShowHeader(true); setShowTabs(true); }
      };

      if (containerHistory) containerHistory.addEventListener('scroll', handleScroll);
      if (containerAccounts) containerAccounts.addEventListener('scroll', handleScroll);
      if (containerTempo) containerTempo.addEventListener('scroll', handleScroll);

      return () => {
        if (containerHistory) containerHistory.removeEventListener('scroll', handleScroll);
        if (containerAccounts) containerAccounts.removeEventListener('scroll', handleScroll);
        if (containerTempo) containerTempo.removeEventListener('scroll', handleScroll);
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
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value, ...(name === 'jenis' && !value.toLowerCase().includes('transfer') ? { account_2: '' } : {}) }));
      setIsFormDirty(true);
    };

    const handleMutasiChange = (newMutasi: string) => {
      if (formData.jenis && formData.jenis !== '') {
        setSystemAlert({
          show: true,
          title: "Ubah Jenis Mutasi?",
          message: "Mengubah jenis mutasi akan mereset pilihan Jenis Cashflow. Lanjutkan?",
          type: 'confirm',
          onConfirm: () => {
            setFormData(prev => ({ ...prev, mutasi: newMutasi, jenis: '', account_2: '' }));
            setIsFormDirty(true);
            setSystemAlert(prev => ({ ...prev, show: false }));
          }
        });
      } else {
        setFormData(prev => ({ ...prev, mutasi: newMutasi, account_2: '' }));
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
      if (!Number.isFinite(Number(formData.nominal)) || Number(formData.nominal) <= 0) {
        showAlert("Validasi Gagal", "Nominal harus diisi dan lebih dari 0!");
        return;
      }
      if (!formData.note || formData.note.trim() === '') {
        showAlert("Validasi Gagal", "Keterangan wajib diisi!");
        return;
      }
      if (formData.jenis?.toLowerCase() === 'transfer' && (!formData.account_2 || formData.account_2 === formData.account_1)) {
        showAlert("Validasi Gagal", "Akun tujuan transfer harus berbeda dari akun sumber!");
        return;
      }
      // Validasi saldo cukup untuk transfer & pengeluaran
      if ((formData.jenis?.toLowerCase() === 'transfer' || formData.mutasi?.toLowerCase() === 'keluar') && formData.account_1) {
        try {
          const acc = await pb.collection('dropdown').getOne(formData.account_1, {$autoCancel:false});
          if (editableBalance(Number(acc.number_1) || 0, formData.account_1, isEditMode && selectedTx ? selectedTx : undefined) < Number(formData.nominal || 0)) {
            showAlert("Validasi Gagal", `Saldo tidak cukup! Saldo saat ini: ${formatRupiah(acc.number_1)}, dibutuhkan: ${formatRupiah(formData.nominal)}`);
            return;
          }
        } catch { showAlert("Validasi Gagal", "Saldo belum dapat diperiksa. Silakan coba kembali."); return; }
      }

      if (submitLockRef.current) return;
      submitLockRef.current = true;
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

        const mLower = (formData.mutasi || '').toLowerCase();
        const mutasiValue = (mLower === 'masuk' || mLower === 'in') ? 'in' : 'out';
        formDataObj.append("mutasi", mutasiValue);
        formDataObj.append("account_1", formData.account_1 || "");
        const selectedPersonObj = personOptions.find(p => p.id === formData.person);
        const isBonKaryawan = formData.jenis.toLowerCase() === 'bonkaryawan' && mutasiValue === 'out';
        formDataObj.append("account_2", formData.jenis.toLowerCase().includes("transfer") ? formData.account_2 || "" : (isBonKaryawan && selectedPersonObj?.source === "user" ? selectedPersonObj.id : ""));
        formDataObj.append("nominal", String(formData.nominal || 0));
        formDataObj.append("note", formData.note || "");
        formDataObj.append("created_at", formattedDate);
        formDataObj.append("operator", operatorName);
        formDataObj.append("person", selectedPersonObj?.source === "user" ? "" : formData.person || "");
        formDataObj.append("persontext", formData.persontext || "");
        formDataObj.append("acc1", accountIdLama);
        formDataObj.append("acc2", formData.jenis.toLowerCase().includes("transfer") ? account2IdLama : "");

        // Di PocketBase, cukup kirim 'string' nama file lama untuk dipertahankan, dan 'File object' untuk file baru
        // Abaikan file lama agar dipertahankan oleh server, dan kirim object File untuk upload baru.
        if (files && files.length > 0) {
          files.forEach(f => {
            if (!f.isOld) {
              formDataObj.append(isEditMode ? "file+" : "file", f); // Upload file baru ini
            }
          });
        }

        // Khusus mode Edit: Hapus file lama di database jika user men-delete dari preview UI
        if (isEditMode && selectedTx?.file) {
          // Ambil daftar file lama yang masih disisakan oleh user di UI
          const retainedOldFiles = files.filter(f => f.isOld).map(f => f.name);
          
          // Filter file yang ada di database, namun sudah tidak ada di UI (dihapus user)
          const deletedFiles = selectedTx.file.filter(oldName => !retainedOldFiles.includes(oldName));
          
          // Beritahu PocketBase untuk menghapus file-file tersebut menggunakan modifier "-"
          deletedFiles.forEach(deletedName => {
            formDataObj.append("file-", deletedName);
          });
        }

        if (isEditMode && selectedTx) formDataObj.set('atomic_expected',JSON.stringify(selectedTx));
        const batch = createFinancialBatch();
        if (isEditMode && selectedTx) batch.collection('cashflow').update(selectedTx.id, formDataObj);
        else batch.collection('cashflow').create(formDataObj);
        await batch.send([], () => setModalType(null));

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
        fetchWallets();
      } catch (error: any) {
        showAlert("Gagal Simpan", error.data?.message || error.message || "Terjadi kesalahan saat menyimpan transaksi.");
      } finally {
        submitLockRef.current = false;
        setIsProcessing(false);
      }
    };

    const submitDelete = async () => {
      if (!selectedTx || submitLockRef.current) return;
      submitLockRef.current = true;
      setIsProcessing(true);
      try {
        await deleteFinancialRecord('cashflow', selectedTx.id);

        setModalType(null);
        fetchCashflow();
        fetchWallets();
      } catch (error) {
        showAlert("Gagal Menghapus", error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus data.");
      } finally {
        submitLockRef.current = false;
        setIsProcessing(false);
      }
    };



    return (
      <fieldset disabled={isProcessing} className="h-full min-w-0 border-0 m-0 p-0">
      <div className="p-4 sm:p-6 lg:p-8 pt-16 md:pt-8 h-full bg-slate-50 flex flex-col overflow-hidden font-sans">
        {/* PEMBUNGKUS UTAMA */}
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col relative">
          
          {/* ============================================================ */}
          {/* HEADER */}
          {/* ============================================================ */}
          <div
            className={`flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 transition-all duration-300 ${
              showHeader
                ? ''
                : 'h-0 overflow-hidden mb-0 opacity-0'
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
            
            {/* CONTAINER TOMBOL AKSI */}
            <div className="hidden md:flex items-center gap-2.5 flex-wrap">
              {/* Tombol Tambah Bon (Merespon Visibilitas) */}
              {configBon && (
                <button
                  onClick={() => {
                    setFormDataBon({
                      catatCashflow: false,
                      created_at: formatToLocalDatetimeInput(new Date().toISOString()),
                      akun_asal: '', person: '', persontext: '', nominal: 0, note: '', jenis: 'out'
                    });
                    setFiles([]);
                    setModalType('formBon' as any);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={16} className="text-purple-200" />
                  <span>TAMBAH BON</span>
                </button>
              )}

              {/* Tombol Catat Kas Utama */}
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
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} className="text-slate-300" />
                <span>CATAT TRANSAKSI KAS</span>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* TAB NAVIGATION */}
          {/* ============================================================ */}
          <div
            className={`flex p-1.5 bg-slate-200/60 rounded-2xl mb-6 w-full sm:w-fit transition-all duration-300 ${
              showTabs ? '' : 'h-0 overflow-hidden mb-0 opacity-0'
            }`}
          >
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                activeTab === 'accounts'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
              }`}
            >
              Buku Kas & Saldo
            </button>

            <button
              onClick={() => { setActiveTab('history'); setPage(1); }}
              className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                activeTab === 'history'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
              }`}
            >
              Histori Kas
            </button>

            {['1', '2', '5', '6'].includes(userLevel) && (
              <button
                onClick={() => setActiveTab('tempo')}
                className={`flex-1 sm:w-40 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                  activeTab === 'tempo'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-emerald-700 hover:bg-white/50'
                }`}
              >
                Jatuh Tempo
              </button>
            )}
          </div>

      {/* ============================================================ */}
      {/* CONTAINER HISTORY */}
      {/* ============================================================ */}
      {activeTab === 'history' && (
        <CashflowHistoryTab
          loading={loading}
          groupedTransactions={groupedTransactions}
          filterMutasi={filterMutasi}
          setFilterMutasi={setFilterMutasi}
          filterAccounts={filterAccounts}
          toggleFilterAccount={toggleFilterAccount}
          filterJenis={filterJenis}
          toggleFilterJenis={toggleFilterJenis}
          availableJenisOptions={availableJenisOptions}
          accountOptions={accountOptions}
          dateRange={dateRange}
          setDateRange={setDateRange}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          onSelectTransaction={(tx) => { setSelectedTx(tx); setModalType('detail'); }}
          onOpenMobileFilter={() => setIsMobileFilterOpen(true)}
          getPersonName={getPersonName}
          getAccountName={getAccountName}
          scrollContainerRef={scrollContainerRef}
        />
      )}

      {/* ============================================================ */}
      {/* CONTAINER ACCOUNTS / WALLET */}
      {/* ============================================================ */}
      {activeTab === 'accounts' && (
        <CashflowAccountsTab
          wallets={wallets}
          loadingWallets={loadingWallets}
          activeAccountTab={activeAccountTab}
          setActiveAccountTab={setActiveAccountTab}
          showZeroBalances={showZeroBalances}
          setShowZeroBalances={setShowZeroBalances}
          calculating={calculating}
          calculateBalances={calculateBalances}
          onOpenBonHistory={openBonHistory}
          onFilterKasWallet={(walletId) => { setFilterPerson(null); setFilterAccounts([walletId]); setActiveTab('history'); setPage(1); }}
          scrollContainerAccountsRef={scrollContainerAccountsRef}
        />
      )}

      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* CONTAINER JATUH TEMPO – DENGAN INTERAKSI FILTER & RESPONSIF MOBIL/TABLET */}
      {/* ============================================================ */}
      {activeTab === 'tempo' && ['1', '2', '5', '6'].includes(userLevel) && (
        <CashflowTempoTab
          tempoGroups={tempoGroups}
          loadingTempo={loadingTempo}
          tempoPage={tempoPage}
          setTempoPage={setTempoPage}
          tempoCategoryFilter={tempoCategoryFilter}
          setTempoCategoryFilter={setTempoCategoryFilter}
          tempoPerPage={tempoPerPage}
          getPersonName={getPersonName}
          formatLocalDateTime={formatLocalDateTime}
          scrollTempoRef={scrollTempoRef}
        />
      )}

          {/* MODAL TRANSAKSI FORM */}
          <CashflowModalForm
            isOpen={modalType === 'form'}
            onClose={handleCloseModal}
            isEditMode={isEditMode}
            formData={formData}
            setFormData={setFormData}
            handleMutasiChange={handleMutasiChange}
            handleInputChange={handleInputChange}
            accountOptions={accountOptions}
            jenisOptionsIn={jenisOptionsIn}
            jenisOptionsOut={jenisOptionsOut}
            personOptions={personOptions}
            walletsMap={walletsMap}
            files={files}
            setFiles={setFiles}
            previewUrls={previewUrls}
            setIsFormDirty={setIsFormDirty}
            isProcessing={isProcessing}
            onSubmit={submitForm}
          />

          {/* MODAL FORM TAMBAH BON */}
          <CashflowBonModal
            isOpen={modalType === 'formBon'}
            onClose={() => setModalType(null)}
            formDataBon={formDataBon}
            setFormDataBon={setFormDataBon}
            personOptions={personOptions}
            accountOptions={accountOptions}
            files={files}
            setFiles={setFiles}
            previewUrls={previewUrls}
            isProcessing={isProcessing}
            onSubmit={submitFormBon}
          />

          {/* MODAL FILTER MOBILE */}
          <CashflowMobileFilterModal
            isOpen={isMobileFilterOpen}
            onClose={() => setIsMobileFilterOpen(false)}
            accountOptions={accountOptions}
            filterAccounts={filterAccounts}
            toggleFilterAccount={toggleFilterAccount}
            availableJenisOptions={availableJenisOptions}
            filterJenis={filterJenis}
            toggleFilterJenis={toggleFilterJenis}
            dateRange={dateRange}
            setDateRange={setDateRange}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
          />

          {/* MODAL DETAIL */}
          <CashflowDetailModal
            isOpen={modalType === 'detail'}
            onClose={() => setModalType(null)}
            selectedTx={selectedTx}
            formatLocalDateTime={formatLocalDateTime}
            getAccountName={getAccountName}
            getPersonName={getPersonName}
            userLevel={userLevel}
            isProcessing={isProcessing}
            onDelete={() => {
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
            onEdit={() => {
              if (!selectedTx) return;
              const localCreatedAt = selectedTx.created_at ? formatToLocalDatetimeInput(selectedTx.created_at) : '';
              const oldFiles = (selectedTx.file || []).map(fileName => ({
                isOld: true,
                name: fileName,
                url: pb.files.getUrl(selectedTx, fileName)
              }));
              setFiles(oldFiles);
              const matchedPersonOpt = personOptions.find(
                p => p.id === selectedTx.person || (selectedTx.persontext && (p.id_lama === selectedTx.persontext || p.text_1 === selectedTx.persontext))
              );
              setFormData({
                mutasi: selectedTx.mutasi?.toLowerCase() === 'in' ? 'Masuk' : 'Keluar',
                created_at: localCreatedAt,
                jenis: selectedTx.jenis,
                account_1: selectedTx.account_1,
                account_2: selectedTx.account_2 || '',
                person: selectedTx.person || matchedPersonOpt?.id || '',
                persontext: selectedTx.persontext || '',
                nominal: selectedTx.nominal,
                note: selectedTx.note
              });
              setModalType('form');
            }}
          />

          {/* MODAL RIWAYAT BON KARYAWAN */}
          <CashflowBonHistoryModal
            isOpen={bonHistoryModalOpen}
            onClose={() => setBonHistoryModalOpen(false)}
            bonHistoryUser={bonHistoryUser}
            bonHistoryData={bonHistoryData}
            loadingBonHistory={loadingBonHistory}
            userLevel={userLevel}
            formatLocalDateTime={formatLocalDateTime}
            onDeleteBon={handleDeleteBon}
          />

        </div>
        
        {/* TOMBOL-TOMBOL FLOATING MOBILE */}
        <div className="md:hidden fixed bottom-24 right-5 z-50 flex flex-col items-end gap-2.5">
          
          {/* Tombol Bon */}
          {configBon && (
            <button
              onClick={() => {
                setFormDataBon({
                  catatCashflow: false,
                  created_at: formatToLocalDatetimeInput(new Date().toISOString()),
                  akun_asal: '', person: '', persontext: '', nominal: 0, note: '', jenis: 'out'
                });
                setFiles([]);
                setModalType('formBon' as any);
              }}
              className="py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-xl shadow-purple-600/30 flex items-center gap-2 text-xs font-black tracking-wider active:scale-95 transition-all border border-purple-400/30"
            >
              <FileText size={15} />
              <span>+ BON</span>
            </button>
          )}

          {/* Tombol Kas Utama */}
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
            className="p-3.5 bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-900/50 flex items-center justify-center active:scale-95 transition-all border border-slate-700"
            title="Catat Kas Baru"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* SYSTEM ALERT & CONFIRMATION MODAL */}
        <Modal
          isOpen={systemAlert.show}
          onClose={() => setSystemAlert(prev => ({...prev, show: false}))}
          isAlert={true}
          title={systemAlert.title}
          alertDescription={systemAlert.message}
          showCancel={systemAlert.type === 'confirm'}
          onConfirm={systemAlert.onConfirm}
          confirmText={systemAlert.type === 'confirm' ? "Ya, Lanjutkan" : "SAYA MENGERTI"}
          cancelText="Batal"
        />
      </div>
      </fieldset>
    );
  }