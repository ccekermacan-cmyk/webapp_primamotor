import SalaryDetail from '../components/salary/SalaryDetail';
import { salaryDetails } from '../lib/account';
import DeleteAccess from '../components/delete-access';
import { financialPatch } from '../lib/financialPatch';
import { createFinancialBatch } from '../services/api/financialBatch';
import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, Plus, Edit, Trash2, Users, UserCheck, 
  UserX, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import type { Person } from '../types/person';
import PersonFormModal from '../components/person/PersonFormModal';
import UserFormModal from '../components/person/UserFormModal';
import PersonDetailModal from '../components/person/PersonDetailModal';

export default function PeoplePage() {
  // --- STATES ---
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Partial<Person>>({});
  const [isProcessing, setIsProcessing] = useState(false);



  // State untuk tab di modal detail person (Customer/Supplier)
  const [personDetailTab, setPersonDetailTab] = useState<'Overview' | 'History'>('Overview');
  // Data history (menu) untuk person
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySummary, setHistorySummary] = useState({ totalBelanja: 0, totalSisa: 0 });
  // Data dummy gaji dan bon untuk user (karyawan)
  // Data dummy gaji dan bon untuk user (karyawan)
  const [dummySalaryList, setDummySalaryList] = useState<any[]>([]);
  const [selectedSalary, setSelectedSalary] = useState<any>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const salaryRequest = useRef(0);
  const [salaryPage, setSalaryPage] = useState(1);
  const [salaryTotalPages, setSalaryTotalPages] = useState(1);
  const [dummyBonList, setDummyBonList] = useState<any[]>([]);
  const [bonPage, setBonPage] = useState(1);
  const [bonTotalPages, setBonTotalPages] = useState(1);

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
  
  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJenis, setFilterJenis] = useState<'all' | 'customer' | 'supplier'>('all');

  // Tambahan untuk user / karyawan
  const [activeTab, setActiveTab] = useState<'person' | 'customer' | 'supplier' | 'user'>('person');
  const [userFilterLevel, setUserFilterLevel] = useState<string>('all');
  const [userFilterStatus, setUserFilterStatus] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const userLevelFromStorage = localStorage.getItem('user_level') || '';
  const isAdmin = userLevelFromStorage === '1';

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(5);

  // Dynamic screen height calculation ensuring MINIMUM 5 items
  useEffect(() => {
    const calculatePerPage = () => {
      const vh = window.innerHeight;
      const availableHeight = vh - 360;
      const calculated = Math.floor(availableHeight / 62);
      const newPerPage = Math.max(5, Math.min(12, calculated));
      setPerPage(newPerPage);
    };

    calculatePerPage();
    window.addEventListener('resize', calculatePerPage);
    return () => window.removeEventListener('resize', calculatePerPage);
  }, []);

  // Modal Detail User & Person
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<any>(null);
  const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
  
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState<any>(null);
  const [isProcessingUser, setIsProcessingUser] = useState(false);
  const userMutationLockRef = useRef(false);
  const originalUserRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (isEditUserModalOpen) originalUserRef.current = editUserData ? {...editUserData} : null;
  }, [isEditUserModalOpen, editUserData?.id]);


  // State untuk tab di modal detail user
  const [activeDetailTab, setActiveDetailTab] = useState<'Overview' | 'Gaji' | 'Bon'>('Overview');

  // --- FETCH PEOPLE ---
  const fetchPeople = async () => {
    setLoading(true);
    try {
      let filterString = 'kategori ?= "Person"';
      if (filterJenis !== 'all') {
        const jenisValue = filterJenis === 'customer' ? 'Customer' : 'Supplier';
        filterString += ` && jenis ?= "${jenisValue}"`;
      }
      if (searchTerm.trim() !== '') {
        const term = searchTerm.trim();
        filterString += ` && (text_1 ~ "${term}" || text_2 ~ "${term}")`;
      }
      const result = await pb.collection('dropdown').getList<Person>(page, perPage, {
        filter: filterString,
        sort: 'text_1'
      });
      setPeople(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      let filterParts = [];
      if (userFilterLevel !== 'all') filterParts.push(`level = ${userFilterLevel}`);
      if (userFilterStatus !== 'all') filterParts.push(`status ?= "${userFilterStatus}"`);
      if (searchTerm.trim() !== '') {
        const term = searchTerm.trim();
        filterParts.push(`(name ~ "${term}" || username ~ "${term}")`);
      }
      const filterString = filterParts.length ? filterParts.join(' && ') : '';

      const result = await pb.collection('user').getList(page, perPage, {
        filter: filterString,
        sort: 'name',
        $autoCancel: false,
      });
      setUsers(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Gagal load user:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPersonHistory = async (_personId: string, pageNum: number = 1) => {
    try {
      const targetIdLama = selectedUserForDetail?.id_lama;

      if (!targetIdLama) {
        console.warn("Person tidak memiliki id_lama, tidak bisa mencari riwayat.");
        setHistoryList([]);
        return;
      }

      const filterString = `person = "${targetIdLama}"`;
      
      // 1. Ambil data per halaman untuk daftar
      const result = await pb.collection('menu').getList(pageNum, 5, { 
        filter: filterString, 
        sort: '-created_at',
        $autoCancel: false 
      });
      
      setHistoryList(result.items);
      setHistoryTotalPages(result.totalPages);

      // 2. Kalkulasi Summary (Hanya saat halaman 1)
      if (pageNum === 1) {
        try {
          const fullData = await pb.collection('menu').getFullList({ 
            filter: `${filterString} && status = "belum"`, 
            fields: 'total,dibayar',
            $autoCancel: false 
          });
          
          let tBelanja = 0;
          let tSisa = 0;
          
          fullData.forEach((item: any) => {
            const total = item.total || 0;
            const dibayar = item.dibayar || 0;
            const selisih = total - dibayar;
            
            tBelanja += total;
            // Hanya akumulasikan jika ada kekurangan pembayaran (sisa > 0)
            if (selisih > 0) {
              tSisa += selisih;
            }
          });
          
          setHistorySummary({ totalBelanja: tBelanja, totalSisa: tSisa });
        } catch (sumErr) {
          console.error("Gagal menghitung summary:", sumErr);
        }
      }
    } catch (error) {
      console.error("Gagal mengambil history:", error);
      setHistoryList([]);
    }
  };

  // Trigger otomatis saat tab History dibuka atau user berganti
  useEffect(() => {
    if (isUserDetailModalOpen && selectedUserForDetail && personDetailTab === 'History') {
      fetchPersonHistory(selectedUserForDetail.id, 1);
      setHistoryPage(1); // Reset page ke 1 setiap kali ganti user
    }
  }, [isUserDetailModalOpen, selectedUserForDetail, personDetailTab]);

  const fetchUserGaji = async (username: string, pageNum: number = 1) => {
    const request = ++salaryRequest.current;
    setSalaryLoading(true);
    setDummySalaryList([]);
    try {
      if (!username) return;
      const res = await pb.collection('gaji').getList(pageNum, 5, {
        filter: pb.filter('person = {:username}', { username }),
        sort: '-created_at', expand: 'ref_baru', $autoCancel: false
      });
      if (request !== salaryRequest.current) return;
      setDummySalaryList(res.items.map(item => ({
        ...item, record: item,
        created_at: formatLocalDateTime(item.created_at || item.created),
        nominal: salaryDetails(item).grandTotal,
        operator: item.operator || item.persontext || 'Admin'
      })));
      setSalaryPage(pageNum);
      setSalaryTotalPages(Math.max(1, res.totalPages));
    } catch (err) {
      if (request === salaryRequest.current) setDummySalaryList([]);
      console.warn('Gagal memuat riwayat gaji:', err);
    } finally {
      if (request === salaryRequest.current) setSalaryLoading(false);
    }
  };

  const fetchUserBon = async (username: string, pageNum: number = 1) => {
    try {
      if (!username) return;
      // Mencocokkan field person / persontext dari koleksi cashflow dengan field username user
      const res = await pb.collection('cashflow').getList(pageNum, 5, {
        filter: `(id_lama = "addbon" || note ~ "bon") && (person = "${username}" || persontext = "${username}")`,
        sort: '-created_at',
        $autoCancel: false
      });
      if (res.items.length > 0) {
        const formatted = res.items.map(item => ({
          id: item.id,
          created_at: formatLocalDateTime(item.created_at || item.created),
          cicilan: item.nominal || 0,
          sisa: item.nominal || 0,
          operator: item.operator || 'Admin',
          note: item.note || ''
        }));
        setDummyBonList(formatted);
        setBonTotalPages(res.totalPages);
      } else {
        setDummyBonList([]);
        setBonTotalPages(1);
      }
    } catch (err) {
      console.warn("Gagal memuat data bon real:", err);
      setDummyBonList([]);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'user') fetchUsers();
      else fetchPeople();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, perPage, filterJenis, searchTerm, activeTab, userFilterLevel, userFilterStatus]);

  // --- CRUD HANDLERS ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPerson.text_1 || !currentPerson.jenis) {
      alert('Nama dan Jenis Transaksi wajib diisi!');
      return;
    }

    setIsProcessing(true);
    try {
      const formattedJenis = currentPerson.jenis.charAt(0).toUpperCase() + currentPerson.jenis.slice(1).toLowerCase();
      
      const formData = new FormData();
      formData.append('text_1', currentPerson.text_1);
      formData.append('text_2', currentPerson.text_2 || '');
      formData.append('jenis', formattedJenis); // Tidak ditampilkan di form, diisi otomatis dari tab
      formData.append('kategori', 'Person');
      formData.append('id_lama', currentPerson.id_lama || `PSN-${Date.now().toString().slice(-4)}`); // Auto-generate jika baru
      
      // Field yang ditampilkan sesuai request
      formData.append('text_3', currentPerson.text_3 || '');
      formData.append('text_4', currentPerson.text_4 || '');
      formData.append('text_5', currentPerson.text_5 || '');
      formData.append('text_6', currentPerson.text_6 || '');
      formData.append('text_7', currentPerson.text_7 || '');
      formData.append('text_9', currentPerson.text_9 || (formattedJenis === 'Customer' ? 'Pelanggan' : 'Supplier'));
      
      formData.append('number_2', String(currentPerson.number_2 ?? '0')); // RT
      formData.append('number_3', String(currentPerson.number_3 ?? '0')); // RW
      formData.append('number_4', String((currentPerson as any).number_4 ?? '0')); // NIK
      formData.append('phone', String((currentPerson as any).phone ?? '0')); // No HP
      
      // Field tersembunyi yang tetap dikirim
      formData.append('operator', localStorage.getItem('user_name') || 'Admin');
      // 🟢 Visibilitas di-hardcode sesuai instruksi
      formData.append('visibilitas', '1,2,3,4,5,6,7');

      // Menggunakan 'file' sesuai JSON untuk menyimpan file foto aktual
      if ((currentPerson as any).imageFile) {
        formData.append('file', (currentPerson as any).imageFile);
      }

      const batch = createFinancialBatch();
      if (currentPerson.id) {
        batch.collection('dropdown').update(currentPerson.id, formData);
      } else {
        batch.collection('dropdown').create(formData);
      }
      await batch.send();

      setIsModalOpen(false);
      setCurrentPerson({});
      setPage(1);
      fetchPeople();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan data ke database.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data person ini secara permanen?')) {
      try {
        const batch = createFinancialBatch();
        batch.collection('dropdown').delete(id);
        await batch.send();

        fetchPeople();
      } catch (err) {
        alert('Gagal menghapus data.');
      }
    }
  };

  const showUserDetail = (data: any) => {
    setSelectedUserForDetail(data);
    setPersonDetailTab('Overview'); // Reset ke tab awal
    setActiveDetailTab('Overview'); // Reset ke tab awal untuk karyawan
    setIsUserDetailModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserData || userMutationLockRef.current) return;
    userMutationLockRef.current = true;
    setIsProcessingUser(true);
    try {
      const emailVal = (editUserData.email || '').trim();
      const formData = new FormData();
      formData.append('name', editUserData.name || '');
      formData.append('email', emailVal);
      formData.append('phone', editUserData.phone || '');
      formData.append('status', editUserData.status || 'active');
      formData.append('level', String(editUserData.level ?? 2));
      formData.append('link_image', editUserData.link_image || '');
      const original = editUserData.id ? originalUserRef.current : null;
      if (editUserData.id && original?.id !== editUserData.id) throw new Error('Data form sudah berubah. Buka ulang profil karyawan.');
      const current = editUserData.id ? await pb.collection('user').getOne(editUserData.id, {$autoCancel:false}) : undefined;
      const balancePatch = financialPatch({number: editUserData.number ?? 0}, original, ['number'], current);
      if ('number' in balancePatch) formData.append('number', String(balancePatch.number));
      // PocketBase menyembunyikan field email jika emailVisibility false. Selalu set 'true' agar email dapat dibaca.
      formData.append('emailVisibility', editUserData.emailVisibility === false ? 'false' : 'true');
      formData.append('verified', editUserData.verified === true ? 'true' : 'false');

      if (editUserData.avatarFile) {
        formData.append('avatar', editUserData.avatarFile);
      }

      const batch = createFinancialBatch();
      if (editUserData.id) {
        batch.collection('user').update(editUserData.id, formData);
      } else {
        formData.append('username', editUserData.username || '');
        const pwd = editUserData.password || 'password123';
        formData.append('password', pwd);
        formData.append('passwordConfirm', pwd);
        batch.collection('user').create(formData);
      }
      await batch.send();

      if (editUserData.id) {
        alert('Data karyawan berhasil diperbarui.');
      } else {
        alert('Karyawan baru berhasil ditambahkan (Password Default: password123).');
      }

      setIsEditUserModalOpen(false);
      fetchUsers(); 
      if (selectedUserForDetail?.id === editUserData.id) {
        setSelectedUserForDetail({ ...selectedUserForDetail, ...editUserData });
      }
    } catch (error: any) {
      console.error('Gagal menyimpan user:', error);
      alert(`Gagal menyimpan user: ${error?.message || 'Periksa kembali input masukan.'}`);
    } finally {
      userMutationLockRef.current = false;
      setIsProcessingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Yakin ingin menghapus user ini secara permanen?')) return;
    try {
      const batch = createFinancialBatch();
      batch.collection('user').delete(userId);
      await batch.send();

      setIsUserDetailModalOpen(false);
      fetchUsers();
      alert('User berhasil dihapus');
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus user');
    }
  };

  const getAvatarInitials = (name: string) => {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 md:pt-8 bg-[#f8fafc] min-h-screen font-sans text-slate-600">
      <div className="w-full space-y-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">People</h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">Kelola data mitra utama entitas usaha dagang desa</p>
          </div>
          <button
            onClick={() => { 
              if (activeTab === 'user') {
                setEditUserData({ 
                  name: '',
                  username: '',
                  email: '',
                  phone: '',
                  password: '',
                  level: 2,
                  status: 'active',
                  link_image: '',
                  number: 0,
                  emailVisibility: true,
                  verified: true
                }); 
                setIsEditUserModalOpen(true);
              } else {
                // Inisialisasi default field saat tambah baru
                const defaultJenis = (activeTab === 'person' && filterJenis === 'supplier') ? 'Supplier' : 'Customer';
                const defaultText9 = defaultJenis === 'Customer' ? 'Pelanggan' : 'Supplier';
                setCurrentPerson({ 
                  jenis: defaultJenis,
                  text_9: defaultText9,
                  visibilitas: '1,2,3,4,5,6,7'
                }); 
                setIsModalOpen(true);
              }
            }}
            
            className="hidden sm:flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-200 transition-all self-start md:self-auto transform hover:-translate-y-0.5"
          >
            <Plus size={16} strokeWidth={3} /> 
            {activeTab === 'user' ? 'Add Karyawan' : 
             (activeTab === 'person' && filterJenis === 'customer') ? 'Add Customer' : 
             (activeTab === 'person' && filterJenis === 'supplier') ? 'Add Supplier' : 'Add Cust / Supp'}
          </button>
        </div>

        {/* FILTER TABS & SEARCH */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-100 p-1.5 rounded-2xl w-full gap-3 shadow-inner">
          <div className="flex overflow-x-auto w-full lg:w-auto no-scrollbar gap-1">
            <button
              onClick={() => { setActiveTab('person'); setFilterJenis('all'); setPage(1); }}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'person' && filterJenis === 'all' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users size={14} /> Semua (Person)
            </button>
            <button
              onClick={() => { setActiveTab('person'); setFilterJenis('customer'); setPage(1); }}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'person' && filterJenis === 'customer' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
            >
              <UserCheck size={14} /> Customers
            </button>
            <button
              onClick={() => { setActiveTab('person'); setFilterJenis('supplier'); setPage(1); }}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'person' && filterJenis === 'supplier' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
            >
              <UserX size={14} /> Suppliers
            </button>
            {isAdmin && (
              <button
                onClick={() => { setActiveTab('user'); setPage(1); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'user' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Users size={14} /> Karyawan
              </button>
            )}
          </div>
          
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={`Cari ${activeTab === 'user' ? 'Karyawan...' : 'Customer/Supplier...'}`} 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
  
          {/* Filter untuk user (khusus level 1 dan 2) */}
          {activeTab === 'user' && (userLevelFromStorage === '1' || userLevelFromStorage === '2') && (
            <div className="flex flex-wrap gap-2 p-4 bg-white border-b border-slate-100">
              <select
                value={userFilterLevel}
                onChange={(e) => { setUserFilterLevel(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="all">Semua Level</option>
                <option value="1">Admin</option>
                <option value="2">Karyawan Biasa</option>
                <option value="10">Mekanik</option>
              </select>
              <select
                value={userFilterStatus}
                onChange={(e) => { setUserFilterStatus(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          )}
          
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left border-collapse min-w-full">
              <thead>
                <tr className="bg-slate-50/70 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  {activeTab === 'user' ? (
                    <>
                      <th className="py-4 px-4 sm:py-5 sm:px-6">Nama / Username</th>
                      <th className="py-4 px-4 sm:py-5 sm:px-6 hidden sm:table-cell">Level</th>
                      <th className="py-4 px-4 sm:py-5 sm:px-6 hidden sm:table-cell">Status Akun</th>
                      <th className="py-4 px-4 sm:py-5 sm:px-6 text-center">Action</th>
                    </>
                  ) : (
                    <>
                      <th className="py-4 px-4 sm:py-5 sm:px-6">People</th>
                      <th className="py-4 px-4 sm:py-5 sm:px-6 hidden sm:table-cell">Status Type</th>
                      <th className="py-4 px-4 sm:py-5 sm:px-6 hidden sm:table-cell">Reference ID</th>
                      <th className="py-4 px-4 sm:py-5 sm:px-6 text-center">Action</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTab === 'user' ? (
                  loadingUsers ? (
                    <tr><td colSpan={4} className="py-20 text-center">Loading...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={4} className="py-20 text-center">Tidak ada data karyawan.</td></tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => showUserDetail(user)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs tracking-tight shadow-inner bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {getAvatarInitials(user.name || user.username)}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-800 text-sm group-hover:text-cyan-600 transition-colors">{user.name || user.username}</p>
                              <p className="text-xs text-slate-400 font-medium">{user.email ? `${user.email} • @${user.username}` : `@${user.username}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-indigo-50/70 text-indigo-700 border border-indigo-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            {user.level === 1 ? 'Admin' : user.level === 10 ? 'Mekanik' : 'Karyawan'}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                            user.status?.toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status?.toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {user.status?.toLowerCase() === 'active' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 border border-slate-100 rounded-xl transition-all" title="Edit" onClick={() => { setEditUserData(user); setIsEditUserModalOpen(true); }}><Edit size={14} strokeWidth={2.5} /></button>
                            <DeleteAccess collection="user" id={user.id}><button className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 rounded-xl transition-all" title="Hapus" onClick={() => handleDeleteUser(user.id)}><Trash2 size={14} strokeWidth={2.5} /></button></DeleteAccess>
                            <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-100 rounded-xl transition-all" title="Detail" onClick={() => showUserDetail(user)}><Eye size={14} strokeWidth={2.5} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  people.map((p) => {
                    const isCustomer = String(p.jenis).toLowerCase().includes('customer');
                    return (
                        <tr 
                          key={p.id} 
                          onClick={() => showUserDetail(p)}
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        >
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs tracking-tight shadow-inner ${
                              isCustomer ? 'bg-cyan-50 text-cyan-600 border border-cyan-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {getAvatarInitials(p.text_1)}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-800 text-sm group-hover:text-cyan-600 transition-colors">{p.text_1}</p>
                              <p className="text-xs text-slate-400 font-medium">{p.text_2 || 'No description'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                            isCustomer ? 'bg-cyan-50/60 text-cyan-700 border-cyan-100' : 'bg-amber-50/60 text-amber-700 border-amber-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isCustomer ? 'bg-cyan-500' : 'bg-amber-500'}`} />
                            {p.jenis || 'Customer'}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap hidden sm:table-cell">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg">
                            #{p.id_lama || 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setCurrentPerson(p); setIsModalOpen(true); }}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 border border-slate-100 rounded-xl transition-all"
                              title="Ubah Data"
                            >
                              <Edit size={14} strokeWidth={2.5} />
                            </button>
                            <DeleteAccess collection="dropdown" id={p.id}><button
                              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 rounded-xl transition-all"
                              title="Hapus Data"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button></DeleteAccess>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Halaman {page} Dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1 || (activeTab === 'user' ? loadingUsers : loading)}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl disabled:opacity-40 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                disabled={page >= totalPages || (activeTab === 'user' ? loadingUsers : loading)}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl disabled:opacity-40 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ADD / EDIT PERSON */}
      <PersonFormModal
        isOpen={isModalOpen}
        isProcessing={isProcessing}
        currentPerson={currentPerson}
        userLevelFromStorage={userLevelFromStorage}
        onClose={() => setIsModalOpen(false)}
        onCurrentPersonChange={setCurrentPerson}
        onSubmit={handleSave}
      />

      {/* MODAL EDIT / ADD USER */}
      <UserFormModal
        isOpen={isEditUserModalOpen}
        isProcessingUser={isProcessingUser}
        editUserData={editUserData}
        onClose={() => setIsEditUserModalOpen(false)}
        onEditUserDataChange={setEditUserData}
        onSubmit={handleUpdateUser}
      />

      {/* MODAL DETAIL (TABS & DINAMIS) */}
      <PersonDetailModal
        isOpen={isUserDetailModalOpen && !!selectedUserForDetail && !selectedSalary}
        selectedUserForDetail={selectedUserForDetail}
        personDetailTab={personDetailTab}
        activeDetailTab={activeDetailTab}
        historySummary={historySummary}
        historyList={historyList}
        historyPage={historyPage}
        historyTotalPages={historyTotalPages}
        dummySalaryList={dummySalaryList}
        salaryLoading={salaryLoading}
        salaryPage={salaryPage}
        salaryTotalPages={salaryTotalPages}
        dummyBonList={dummyBonList}
        bonPage={bonPage}
        bonTotalPages={bonTotalPages}
        userLevelFromStorage={userLevelFromStorage}
        getAvatarInitials={getAvatarInitials}
        formatLocalDateTime={formatLocalDateTime}
        onClose={() => setIsUserDetailModalOpen(false)}
        onPersonDetailTabChange={setPersonDetailTab}
        onActiveDetailTabChange={(tab) => {
          setActiveDetailTab(tab);
          const uname = selectedUserForDetail?.username || selectedUserForDetail?.id_lama || selectedUserForDetail?.name || '';
          if (tab === 'Gaji') fetchUserGaji(uname, 1);
          if (tab === 'Bon') fetchUserBon(uname, 1);
        }}
        onFetchPersonHistory={fetchPersonHistory}
        onFetchUserGaji={fetchUserGaji}
        onSelectSalary={(rec) => setSelectedSalary(rec)}
        onBonPageChange={setBonPage}
        onOpenEditPerson={(person) => {
          setCurrentPerson(person);
          setIsModalOpen(true);
          setIsUserDetailModalOpen(false);
        }}
        onOpenEditUser={(user) => {
          setEditUserData(user);
          setIsEditUserModalOpen(true);
          setIsUserDetailModalOpen(false);
        }}
      />
      {/* Floating Add Button (mobile only, karyawan only for level 1) */}
      {(activeTab !== 'user' || isAdmin) && (
      <button
        onClick={() => { 
          if (activeTab === 'user') {
            setEditUserData({ name:'',username:'',email:'',phone:'',password:'',level:2,status:'active',link_image:'',number:0,emailVisibility:true,verified:true }); 
            setIsEditUserModalOpen(true);
          } else {
            const defaultJenis = filterJenis === 'supplier' ? 'supplier' : (filterJenis === 'customer' ? 'customer' : 'customer');
            const defaultText9 = activeTab === 'person' && defaultJenis === 'customer' ? 'pelanggan' : (activeTab === 'person' && defaultJenis === 'supplier' ? 'supplier' : 'pelanggan');
            setCurrentPerson({ jenis: defaultJenis, text_9: defaultText9, visibilitas: '1,2,3,4,5,6,7' }); 
            setIsModalOpen(true);
          }
        }}
        className="sm:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-cyan-600 text-white rounded-full shadow-2xl shadow-cyan-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
      )}
      <Modal isOpen={!!selectedSalary && isUserDetailModalOpen} onClose={() => setSelectedSalary(null)} title="Slip rincian gaji" compact maxWidth="max-w-2xl">
        {selectedSalary && <SalaryDetail key={selectedSalary.id} record={selectedSalary} fileUrl={name => pb.files.getUrl(selectedSalary, name)} />}
      </Modal>
    </div>
  );
}
