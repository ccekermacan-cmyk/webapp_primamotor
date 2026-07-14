import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, Plus, Edit, Trash2, Users, UserCheck, 
  UserX, ChevronLeft, ChevronRight, Eye, X,
} from 'lucide-react';

interface Person {
  id: string;
  id_lama?: string;
  text_1: string;   // Nama Lengkap
  text_2: string;   // Jabatan / Deskripsi / Perusahaan
  jenis: string;    // Customer / Supplier
  kategori: string; // Harus "Person"
}

export default function PeoplePage() {
  // --- STATES ---
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Partial<Person>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

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
  const perPage = 5;

  // Modal Detail User & Person
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<any>(null);
  const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
  
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState<any>(null);
  const [isProcessingUser, setIsProcessingUser] = useState(false);

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

  const fetchPersonHistory = async (personId: string, pageNum: number = 1) => {
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

  const generateDummyGaji = () => {
    const dummy = [];
    for (let i = 1; i <= 10; i++) {
      dummy.push({ id: i, created_at: `2025-${String(i).padStart(2,'0')}-01`, nominal: 5000000 + i * 500000, operator: 'Admin' });
    }
    setDummySalaryList(dummy);
    setSalaryTotalPages(Math.ceil(dummy.length / 5));
  };

  const generateDummyBon = () => {
    const dummy = [];
    for (let i = 1; i <= 8; i++) {
      dummy.push({ id: i, created_at: `2025-05-${String(i).padStart(2,'0')}`, cicilan: 200000, sisa: 1000000 - i * 200000, operator: 'System' });
    }
    setDummyBonList(dummy);
    setBonTotalPages(Math.ceil(dummy.length / 5));
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'user') fetchUsers();
      else fetchPeople();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, filterJenis, searchTerm, activeTab, userFilterLevel, userFilterStatus]);

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
      formData.append('text_9', currentPerson.text_9 || '');
      
      formData.append('number_2', String(currentPerson.number_2 || 0)); // RT
      formData.append('number_3', String(currentPerson.number_3 || 0)); // RW
      formData.append('number_4', String((currentPerson as any).number_4 || 0)); // NIK
      formData.append('phone', String((currentPerson as any).phone || 0)); // No HP
      
      // Field tersembunyi yang tetap dikirim
      formData.append('operator', localStorage.getItem('user_name') || 'Admin');
      // 🟢 Visibilitas di-hardcode sesuai instruksi
      formData.append('visibilitas', '1,2,3,4,5,6,7');

      // Set fallback text_9 (Kategori) jika user tidak mengisi apa-apa
      if (!currentPerson.text_9) {
        formData.append('text_9', formattedJenis === 'Customer' ? 'Pelanggan' : 'Supplier');
      }

      // Menggunakan 'file' sesuai JSON untuk menyimpan file foto aktual
      if ((currentPerson as any).imageFile) {
        formData.append('file', (currentPerson as any).imageFile);
      }

      if (currentPerson.id) {
        await pb.collection('dropdown').update(currentPerson.id, formData);
      } else {
        await pb.collection('dropdown').create(formData);
      }

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
        await pb.collection('dropdown').delete(id);
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
    if (!editUserData) return;
    setIsProcessingUser(true);
    try {
      const payload: any = {
        name: editUserData.name,
        email: editUserData.email,
        status: editUserData.status,
        level: editUserData.level,
        link_image: editUserData.link_image,
        tokenkey: editUserData.tokenkey,
        phone: editUserData.phone || '',
      };

      if (editUserData.id) {
        await pb.collection('user').update(editUserData.id, payload);
        alert('User berhasil diupdate');
      } else {
        payload.username = editUserData.username;
        payload.password = editUserData.password || 'password123';
        payload.passwordConfirm = editUserData.password || 'password123';
        await pb.collection('user').create(payload);
        alert('User berhasil ditambahkan (Password Default: password123)');
      }

      setIsEditUserModalOpen(false);
      fetchUsers(); 
      if (selectedUserForDetail?.id === editUserData.id) {
        setSelectedUserForDetail({ ...selectedUserForDetail, ...payload });
      }
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan user');
    } finally {
      setIsProcessingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Yakin ingin menghapus user ini secara permanen?')) return;
    try {
      await pb.collection('user').delete(userId);
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
    <div className="p-8 bg-[#f8fafc] min-h-screen font-sans text-slate-600">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">People</h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">Kelola data mitra utama entitas usaha dagang desa</p>
          </div>
          <button
            onClick={() => { 
              if (activeTab === 'user') {
                setEditUserData({ status: 'active', level: 2 }); 
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
            
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-200 transition-all self-start md:self-auto transform hover:-translate-y-0.5"
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
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  {activeTab === 'user' ? (
                    <>
                      <th className="py-5 px-6">Nama / Username</th>
                      <th className="py-5 px-6">Level</th>
                      <th className="py-5 px-6">Status Akun</th>
                      <th className="py-5 px-6 text-center">Action</th>
                    </>
                  ) : (
                    <>
                      <th className="py-5 px-6">People</th>
                      <th className="py-5 px-6">Status Type</th>
                      <th className="py-5 px-6">Reference ID</th>
                      <th className="py-5 px-6 text-center">Action</th>
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
                        <td className="py-3 px-4 sm:py-4 sm:px-6">
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm">{user.name || user.username}</p>
                            <p className="text-xs text-slate-400 font-medium">@{user.username}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 sm:py-4 sm:px-6">
                          <span className="inline-flex px-3 py-1 rounded-xl text-[10px] font-black bg-indigo-50 text-indigo-600">
                            {user.level === 1 ? 'Admin' : user.level === 10 ? 'Mekanik' : 'Karyawan'}
                          </span>
                        </td>
                        <td className="py-3 px-4 sm:py-4 sm:px-6">
                          <span className={`inline-flex px-3 py-1 rounded-xl text-[10px] font-black ${user.status?.toLowerCase() === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {user.status?.toLowerCase() === 'active' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 sm:py-4 sm:px-6">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-cyan-600 rounded-xl transition" title="Edit"><Edit size={14} /></button>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition" title="Hapus"><Trash2 size={14} /></button>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition" title="Lihat Detail"><Eye size={14} /></button>
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
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                            isCustomer ? 'bg-cyan-50/60 text-cyan-700 border-cyan-100' : 'bg-amber-50/60 text-amber-700 border-amber-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isCustomer ? 'bg-cyan-500' : 'bg-amber-500'}`} />
                            {p.jenis || 'Customer'}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
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
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 rounded-xl transition-all"
                              title="Hapus Data"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentPerson.id ? 'Edit Rekor Partner' : 'Tambah Partner Baru'}>
        <form onSubmit={handleSave} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
          <div className="space-y-4 p-1">
            
            {/* Header Form & Jenis Enum */}
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner w-full mb-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentPerson({ ...currentPerson, jenis: 'Customer', text_9: 'Pelanggan' });
                }}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  currentPerson.jenis === 'Customer' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                }`}
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentPerson({ ...currentPerson, jenis: 'Supplier', text_9: 'Supplier' });
                }}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  currentPerson.jenis === 'Supplier' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                }`}
              >
                Supplier
              </button>
            </div>

            {/* Baris 1: Nama & Perusahaan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nama Cust / Supplier <span className="text-rose-500">*</span></label>
                <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_1 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_1: e.target.value })} placeholder="Cth: Budi Santoso" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nama Bengkel / Perusahaan</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_2 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_2: e.target.value })} placeholder="Cth: PT Makmur Jaya" />
              </div>
            </div>

            {/* Baris 2: NIK & HP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">NIK</label>
                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={(currentPerson as any).number_4 || ''} onChange={e => setCurrentPerson({ ...currentPerson, number_4: Number(e.target.value) } as any)} placeholder="Cth: 3500000000000" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nomor HP / WhatsApp</label>
                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={(currentPerson as any).phone || ''} onChange={e => setCurrentPerson({ ...currentPerson, phone: Number(e.target.value) } as any)} placeholder="Cth: 6281234567" />
              </div>
            </div>

            {/* Baris 3: Dusun, RT, RW */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1 col-span-1 sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Dusun / Jalan</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_3 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_3: e.target.value })} placeholder="Cth: Dusun Krajan" />
              </div>
              <div className="space-y-1 flex gap-2 col-span-2 sm:col-span-1">
                <div className="w-1/2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RT</label>
                  <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.number_2 || ''} onChange={e => setCurrentPerson({ ...currentPerson, number_2: Number(e.target.value) })} placeholder="00" />
                </div>
                <div className="w-1/2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RW</label>
                  <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.number_3 || ''} onChange={e => setCurrentPerson({ ...currentPerson, number_3: Number(e.target.value) })} placeholder="00" />
                </div>
              </div>
            </div>

            {/* Baris 4: Desa & Kecamatan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Desa</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_4 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_4: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Kecamatan</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_5 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_5: e.target.value })} />
              </div>
            </div>

            {/* Baris 5: Kota & Provinsi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Kota / Kabupaten</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_6 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_6: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Provinsi</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_7 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_7: e.target.value })} />
              </div>
            </div>

            {/* Baris 6: Kategori (Text_9 Enum / Custom) & Upload Foto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Tipe / Kelompok</label>
                {['1', '2'].includes(userLevelFromStorage) ? (
                  <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_9 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_9: e.target.value })} placeholder="Bebas ketik kategori (Misal: VIP)" />
                ) : (
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" value={currentPerson.text_9 || 'Pelanggan'} onChange={e => setCurrentPerson({ ...currentPerson, text_9: e.target.value })}>
                    <option value="Pelanggan">Pelanggan</option>
                    <option value="Supplier">Supplier</option>
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Upload Foto / Berkas</label>
                <input type="file" accept="image/*,application/pdf" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-cyan-400" onChange={e => { if(e.target.files?.[0]) setCurrentPerson({ ...currentPerson, imageFile: e.target.files[0] as any }) }} />
              </div>
            </div>

          </div>
          
          <div className="mt-6 pt-5 border-t border-slate-100 flex gap-2 sticky bottom-0 bg-white p-1">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors">Batalkan</button>
            <button 
              type="submit" 
              disabled={isProcessing} 
              className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-colors ${
                currentPerson.jenis === 'Supplier' 
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/30' 
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30'
              }`}
            >
              {isProcessing ? 'MENYIMPAN...' : 'SAVE PARTNER'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL EDIT / ADD USER */}
        <Modal isOpen={isEditUserModalOpen} onClose={() => setIsEditUserModalOpen(false)} title={editUserData?.id ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}>
          {editUserData && (
            <form onSubmit={handleUpdateUser} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
              <div className="space-y-4 p-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nama Lengkap</label>
                  <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editUserData.name || ''} onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Username</label>
                    <input type="text" disabled={!!editUserData.id} required className={`w-full p-3 border border-slate-200 rounded-xl text-sm font-bold ${editUserData.id ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'}`} value={editUserData.username || ''} onChange={(e) => setEditUserData({ ...editUserData, username: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Email</label>
                    <input type="email" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editUserData.email || ''} onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })} />
                  </div>
                </div>
                {!editUserData.id && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Password Akses</label>
                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Default: password123" value={editUserData.password || ''} onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Level Otoritas</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editUserData.level || 2} onChange={(e) => setEditUserData({ ...editUserData, level: Number(e.target.value) })}>
                      <option value={2}>Karyawan (Lvl 2)</option>
                      <option value={5}>Supervisor (Lvl 5)</option>
                      <option value={10}>Mekanik (Lvl 10)</option>
                      <option value={1}>Admin Utama (Lvl 1)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Status Akun</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editUserData.status || 'active'} onChange={(e) => setEditUserData({ ...editUserData, status: e.target.value })}>
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Link URL Foto Profil</label>
                  <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editUserData.link_image || ''} onChange={(e) => setEditUserData({ ...editUserData, link_image: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nomor Telepon / HP</label>
                  <input type="tel" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editUserData.phone || ''} onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100 flex gap-2 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setIsEditUserModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs tracking-widest uppercase">Batal</button>
                <button type="submit" disabled={isProcessingUser} className="flex-[2] py-4 bg-cyan-600 text-white rounded-2xl font-black text-xs tracking-widest uppercase">
                  {isProcessingUser ? 'MENYIMPAN...' : 'SIMPAN USER'}
                </button>
              </div>
            </form>
          )}
        </Modal>

      {/* MODAL DETAIL (TABS & DINAMIS) */}
      {isUserDetailModalOpen && selectedUserForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl transform scale-100 animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            
            {/* === HEADER DINAMIS === */}
            {(() => {
              let gradient = '';
              let typeLabel = '';
              if (selectedUserForDetail.kategori === 'Person') {
                const isCustomer = String(selectedUserForDetail.jenis).toLowerCase() === 'customer';
                gradient = isCustomer ? 'from-emerald-500 to-teal-600' : 'from-amber-500 to-orange-600';
                typeLabel = isCustomer ? 'Customer' : 'Supplier';
              } else {
                gradient = 'from-blue-500 to-indigo-600';
                typeLabel = selectedUserForDetail.level === 1 ? 'Admin' : (selectedUserForDetail.level === 10 ? 'Mekanik' : 'Karyawan');
              }
              return (
                <div className={`bg-gradient-to-br ${gradient} p-6 text-white relative shrink-0`}>
                  <button 
                    onClick={() => setIsUserDetailModalOpen(false)} 
                    className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-md"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-4 mt-2">
                    {selectedUserForDetail.link_image ? (
                      <img src={selectedUserForDetail.link_image} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md bg-white" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white text-cyan-600 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                        {getAvatarInitials(selectedUserForDetail.text_1 || selectedUserForDetail.name || selectedUserForDetail.username)}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h3 className="font-black text-xl leading-tight truncate">
                        {selectedUserForDetail.text_1 || selectedUserForDetail.name || selectedUserForDetail.username}
                      </h3>
                      <p className="text-white/80 text-sm font-medium mt-0.5 truncate">
                        {selectedUserForDetail.text_2 || (selectedUserForDetail.username ? `@${selectedUserForDetail.username}` : 'Partner Eksternal')}
                      </p>
                      <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                        {typeLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* === TAB NAVIGASI === */}
            <div className="flex border-b border-gray-200 bg-white px-4">
              {selectedUserForDetail.kategori === 'Person' ? (
                <>
                  <button
                    onClick={() => { setPersonDetailTab('Overview'); }}
                    className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                      personDetailTab === 'Overview'
                        ? 'border-b-2 border-cyan-600 text-cyan-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setPersonDetailTab('History')}
                    className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                      personDetailTab === 'History'
                        ? 'border-b-2 border-cyan-600 text-cyan-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    History
                  </button>
                </>
              ) : (
                <>
                  {['Overview', 'Gaji', 'Bon'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { 
                        setActiveDetailTab(tab as any);
                        if (tab === 'Gaji' && dummySalaryList.length === 0) generateDummyGaji();
                        if (tab === 'Bon' && dummyBonList.length === 0) generateDummyBon();
                      }}
                      className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                        activeDetailTab === tab
                          ? 'border-b-2 border-cyan-600 text-cyan-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* === KONTEN TAB === */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {selectedUserForDetail.kategori === 'Person' ? (
                <>
                  {personDetailTab === 'Overview' && (() => {
                    // Penentuan tema warna berdasarkan jenis
                    const isCust = String(selectedUserForDetail.jenis).toLowerCase() === 'customer';
                    const themeBg = isCust ? 'bg-cyan-50/50' : 'bg-amber-50/50';
                    const themeBorder = isCust ? 'border-cyan-100' : 'border-amber-100';
                    const themeText = isCust ? 'text-cyan-800' : 'text-amber-800';
                    const themeMuted = isCust ? 'text-cyan-600/70' : 'text-amber-600/70';
                    
                    // Meracik susunan alamat lengkap
                    const jalan = selectedUserForDetail.text_3 || '';
                    const rt = selectedUserForDetail.number_2 ? `RT ${selectedUserForDetail.number_2}` : '';
                    const rw = selectedUserForDetail.number_3 ? `RW ${selectedUserForDetail.number_3}` : '';
                    const rtrw = [rt, rw].filter(Boolean).join('/');
                    const desa = selectedUserForDetail.text_4 ? `Ds. ${selectedUserForDetail.text_4}` : '';
                    const kec = selectedUserForDetail.text_5 ? `Kec. ${selectedUserForDetail.text_5}` : '';
                    const kota = selectedUserForDetail.text_6 || '';
                    const prov = selectedUserForDetail.text_7 || '';

                    // Gabungkan hanya data yang terisi, pisahkan dengan koma
                    const fullAddress = [jalan, rtrw, desa, kec, kota, prov].filter(Boolean).join(', ');

                    return (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        
                        {/* 1. Card Alamat Tergabung & Bertema */}
                        <div className={`p-5 md:p-6 rounded-3xl border ${themeBorder} ${themeBg} relative overflow-hidden shadow-sm`}>
                          {/* Efek visual / Blur di background */}
                          <div className={`absolute -top-10 -right-10 w-32 h-32 blur-2xl opacity-40 rounded-full pointer-events-none ${isCust ? 'bg-cyan-400' : 'bg-amber-400'}`} />
                          
                          <div className="relative z-10">
                            <p className={`text-[10px] font-black uppercase tracking-widest ${themeMuted} mb-1.5`}>
                              Alamat Lengkap
                            </p>
                            <p className={`font-bold text-sm md:text-base leading-relaxed ${themeText}`}>
                              {fullAddress || 'Belum ada data alamat yang diinputkan.'}
                            </p>
                          </div>
                        </div>

                        {/* 2. Grid Info Pendukung */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kontak (HP/WA)</p>
                            <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.phone || '-'}</p>
                          </div>
                          
                          <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Induk (NIK)</p>
                            <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.number_4 || '-'}</p>
                          </div>

                          <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center col-span-2 sm:col-span-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe / Kelompok</p>
                            <p className="font-bold text-slate-700 text-sm mt-1.5">
                              <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${themeBorder} ${themeBg} ${themeText}`}>
                                {selectedUserForDetail.text_9 || '-'}
                              </span>
                            </p>
                          </div>
                          
                          <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-center col-span-2 sm:col-span-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Rekam Internal</p>
                            <p className="font-black text-slate-400 text-sm mt-1 uppercase">#{selectedUserForDetail.id_lama || selectedUserForDetail.id}</p>
                          </div>
                        </div>
                        
                      </div>
                    );
                  })()}
                  {personDetailTab === 'History' && (
                    <div className="animate-in fade-in duration-300">
                      
                      {/* 🟢 SUMMARY CARDS (Total Belanja & Total Sisa) */}
                      <div className={`grid gap-3 mb-5 ${historySummary.totalSisa > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-cyan-500/30 relative overflow-hidden flex flex-col justify-center min-h-[5rem]">
                          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-100 mb-0.5 relative z-10">Total Belanja</p>
                          <p className="text-xl md:text-2xl font-black tracking-tight relative z-10">Rp {historySummary.totalBelanja.toLocaleString('id-ID')}</p>
                        </div>
                        
                        {/* 🟢 Gunakan historySummary.totalSisa */}
                        {historySummary.totalSisa > 0 && (
                          <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-4 rounded-2xl text-white shadow-lg shadow-rose-500/30 relative overflow-hidden flex flex-col justify-center min-h-[5rem]">
                            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-100 mb-0.5 relative z-10">
                              Belum Dibayar (Sisa)
                            </p>
                            <p className="text-xl md:text-2xl font-black tracking-tight relative z-10">
                              Rp {historySummary.totalSisa.toLocaleString('id-ID')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 🟢 LIST TRANSAKSI */}
                      <div className="space-y-3">
                        {historyList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <span className="text-2xl mb-2 opacity-40">📭</span>
                            <p className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest">Belum ada riwayat transaksi</p>
                          </div>
                        ) : (
                          historyList.map(item => (
                            <div
                              key={item.id}
                              onClick={() => { window.location.href = `/?ref=${item.id}`; }}
                              className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-cyan-400 hover:shadow-md transition-all group flex flex-col gap-3 relative overflow-hidden"
                              title="Klik untuk melihat detail nota"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-50/0 via-transparent to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                              
                              <div className="flex justify-between items-center border-b border-slate-100 pb-2 relative z-10">
                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-cyan-400 transition-colors" />
                                  {formatLocalDateTime(item.created_at)}
                                </span>
                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm ${
                                  item.status === 'lunas' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                                }`}>
                                  {item.status === 'lunas' ? 'LUNAS' : 'BELUM'}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-end relative z-10">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-cyan-600 transition-colors">
                                  {item.jenis || 'Transaksi'}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-1 font-bold">
                                  Opr: <span className="text-slate-500">{item.operator || '-'}</span>
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-slate-900 group-hover:scale-105 transition-transform origin-right block">
                                  Rp {item.total?.toLocaleString('id-ID') || 0}
                                </span>
                                {item.status !== 'lunas' && (() => {
                                  const sisa = (item.total || 0) - (item.dibayar || 0);
                                  return sisa > 0 ? (
                                    <span className="text-[10px] font-bold text-rose-500 block mt-0.5">
                                      Sisa: Rp {sisa.toLocaleString('id-ID')}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* 🟢 TOTAL PER HALAMAN & PAGINATION */}
                      {historyList.length > 0 && (
                        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner">
                          <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-200">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Halaman Ini</span>
                            <span className="text-sm font-black text-slate-700">
                              Rp {historyList.reduce((acc, curr) => acc + (curr.total || 0), 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          
                          {historyTotalPages > 1 ? (
                            <div className="flex justify-between items-center">
                              <button
                                disabled={historyPage === 1}
                                onClick={() => {
                                  const newPage = historyPage - 1;
                                  setHistoryPage(newPage);
                                  fetchPersonHistory(selectedUserForDetail.id, newPage);
                                }}
                                className="py-2 px-4 bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-black uppercase tracking-wider rounded-xl text-[10px] disabled:opacity-40 transition-colors shadow-sm"
                              >
                                Prev
                              </button>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                Hal {historyPage} / {historyTotalPages}
                              </span>
                              <button
                                disabled={historyPage === historyTotalPages}
                                onClick={() => {
                                  const newPage = historyPage + 1;
                                  setHistoryPage(newPage);
                                  fetchPersonHistory(selectedUserForDetail.id, newPage);
                                }}
                                className="py-2 px-4 bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-black uppercase tracking-wider rounded-xl text-[10px] disabled:opacity-40 transition-colors shadow-sm"
                              >
                                Next
                              </button>
                            </div>
                          ) : (
                            <div className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Semua data telah dimuat
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {activeDetailTab === 'Overview' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Username</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.username || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                        <p className={`font-black text-sm mt-1 ${selectedUserForDetail.status === 'inactive' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {selectedUserForDetail.status === 'inactive' ? 'Nonaktif' : 'Aktif'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Email</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.email || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Nomor Telepon</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.phone || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Level</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">
                          {selectedUserForDetail.level === 1 ? 'Admin' : selectedUserForDetail.level === 10 ? 'Mekanik' : 'Karyawan'}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeDetailTab === 'Gaji' && (
                    <div>
                      <div className="space-y-2">
                        {dummySalaryList.slice((salaryPage-1)*5, salaryPage*5).map((gaji, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-mono text-slate-500">{gaji.created_at}</span>
                              <span className="text-xs font-bold text-slate-800">Rp {gaji.nominal?.toLocaleString('id-ID')}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Operator: {gaji.operator || '-'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-2 border-t">
                        <button disabled={salaryPage === 1} onClick={() => setSalaryPage(p => p-1)} className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30">Prev</button>
                        <span className="text-[10px] text-slate-400">Hal {salaryPage} / {salaryTotalPages}</span>
                        <button disabled={salaryPage === salaryTotalPages} onClick={() => setSalaryPage(p => p+1)} className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30">Next</button>
                      </div>
                    </div>
                  )}
                  {activeDetailTab === 'Bon' && (
                    <div>
                      <div className="space-y-2">
                        {dummyBonList.slice((bonPage-1)*5, bonPage*5).map((bon, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-mono text-slate-500">{bon.created_at}</span>
                              <span className="text-xs font-bold text-slate-800">Cicilan: Rp {bon.cicilan?.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-slate-500">Sisa: Rp {bon.sisa?.toLocaleString('id-ID')}</span>
                              <span className="text-[10px] text-slate-500">Operator: {bon.operator}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-2 border-t">
                        <button disabled={bonPage === 1} onClick={() => setBonPage(p => p-1)} className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30">Prev</button>
                        <span className="text-[10px] text-slate-400">Hal {bonPage} / {bonTotalPages}</span>
                        <button disabled={bonPage === bonTotalPages} onClick={() => setBonPage(p => p+1)} className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30">Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* === FOOTER TOMBOL === */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-2">
              <button 
                onClick={() => setIsUserDetailModalOpen(false)} 
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
              >
                Tutup
              </button>
              {selectedUserForDetail.kategori === 'Person' ? (
                <button
                  onClick={() => { setCurrentPerson(selectedUserForDetail); setIsModalOpen(true); setIsUserDetailModalOpen(false); }}
                  className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-cyan-700 transition-colors"
                >
                  Edit {selectedUserForDetail.jenis === 'Customer' ? 'Customer' : 'Supplier'}
                </button>
              ) : (
                [1,2,3,4,5,6].includes(Number(userLevelFromStorage)) && (
                  <button
                    onClick={() => { setEditUserData(selectedUserForDetail); setIsEditUserModalOpen(true); setIsUserDetailModalOpen(false); }}
                    className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-cyan-700 transition-colors"
                  >
                    Edit User
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}