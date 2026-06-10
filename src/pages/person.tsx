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

  // State untuk tab di modal detail person (Customer/Supplier)
  const [personDetailTab, setPersonDetailTab] = useState<'Overview' | 'History'>('Overview');
  // Data history (menu) untuk person
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  // Data dummy gaji dan bon untuk user (karyawan)
  const [dummySalaryList, setDummySalaryList] = useState<any[]>([]);
  const [salaryPage, setSalaryPage] = useState(1);
  const [salaryTotalPages, setSalaryTotalPages] = useState(1);
  const [dummyBonList, setDummyBonList] = useState<any[]>([]);
  const [bonPage, setBonPage] = useState(1);
  const [bonTotalPages, setBonTotalPages] = useState(1);
  
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
      let filterString = `person_baru = "${personId}"`;
      let result = await pb.collection('menu').getList(pageNum, 5, { filter: filterString, sort: '-created_at' });
      if (result.items.length === 0 && selectedUserForDetail?.id_lama) {
        filterString = `person = "${selectedUserForDetail.id_lama}"`;
        result = await pb.collection('menu').getList(pageNum, 5, { filter: filterString, sort: '-created_at' });
      }
      setHistoryList(result.items);
      setHistoryTotalPages(result.totalPages);
    } catch (error) {
      setHistoryList([]);
    }
  };

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
      formData.append('text_2', currentPerson.text_2 || '-');
      formData.append('jenis', formattedJenis);
      formData.append('kategori', 'Person');
      formData.append('id_lama', currentPerson.id_lama || `PSN-${Date.now().toString().slice(-4)}`);
      
      // Tambahan Field Baru
      formData.append('text_3', currentPerson.text_3 || '');
      formData.append('text_4', currentPerson.text_4 || '');
      formData.append('text_5', currentPerson.text_5 || '');
      formData.append('text_6', currentPerson.text_6 || '');
      formData.append('text_7', currentPerson.text_7 || '');
      formData.append('text_9', currentPerson.text_9 || '');
      formData.append('text_10', currentPerson.text_10 || '');
      formData.append('number_1', String(currentPerson.number_1 || 0));
      formData.append('number_2', String(currentPerson.number_2 || 0));
      formData.append('number_3', String(currentPerson.number_3 || 0));
      formData.append('link_image', currentPerson.link_image || '');
      formData.append('visibilitas', currentPerson.visibilitas || '1');

      if ((currentPerson as any).imageFile) {
        formData.append('image', (currentPerson as any).imageFile);
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
              } else if (activeTab === 'person' && filterJenis === 'customer') {
                setCurrentPerson({ jenis: 'Customer' }); setIsModalOpen(true);
              } else if (activeTab === 'person' && filterJenis === 'supplier') {
                setCurrentPerson({ jenis: 'Supplier' }); setIsModalOpen(true);
              } else {
                setCurrentPerson({ jenis: 'Customer' }); setIsModalOpen(true);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">ID Lama (Opsional)</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={currentPerson.id_lama || ''} onChange={e => setCurrentPerson({ ...currentPerson, id_lama: e.target.value })} placeholder="Auto jika kosong" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Jenis Hubungan</label>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={currentPerson.jenis || 'customer'} onChange={e => setCurrentPerson({ ...currentPerson, jenis: e.target.value })}>
                  <option value="Customer">Customer</option>
                  <option value="Supplier">Supplier</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nama Partner (text_1)</label>
                <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={currentPerson.text_1 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_1: e.target.value })} placeholder="Nama Lengkap" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Keterangan / Jabatan (text_2)</label>
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={currentPerson.text_2 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_2: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Alamat/Kontak (text_3 - text_7)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" placeholder="Text 3 (Jalan)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.text_3 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_3: e.target.value })} />
                <input type="text" placeholder="Text 4 (Kecamatan)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.text_4 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_4: e.target.value })} />
                <input type="text" placeholder="Text 5 (Kota)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.text_5 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_5: e.target.value })} />
                <input type="text" placeholder="Text 6 (Provinsi)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.text_6 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_6: e.target.value })} />
                <input type="text" placeholder="Text 7 (No HP/WA)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold col-span-1 sm:col-span-2" value={currentPerson.text_7 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_7: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Text 9 (Kategori Lain)</label>
                <input type="text" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.text_9 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_9: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Text 10 (Info Ekstra)</label>
                <input type="text" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.text_10 || ''} onChange={e => setCurrentPerson({ ...currentPerson, text_10: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Number 1</label>
                <input type="number" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.number_1 || ''} onChange={e => setCurrentPerson({ ...currentPerson, number_1: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Number 2</label>
                <input type="number" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.number_2 || ''} onChange={e => setCurrentPerson({ ...currentPerson, number_2: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Number 3</label>
                <input type="number" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.number_3 || ''} onChange={e => setCurrentPerson({ ...currentPerson, number_3: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Link Image URL</label>
                <input type="text" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold" value={currentPerson.link_image || ''} onChange={e => setCurrentPerson({ ...currentPerson, link_image: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Visibilitas (Level) - Pilih lebih dari satu</label>
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {[...Array(16)].map((_, i) => {
                    const level = (i+1).toString();
                    const selected = (currentPerson.visibilitas || '1').split(',').includes(level);
                    return (
                      <label key={level} className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <input
                          type="checkbox"
                          value={level}
                          checked={selected}
                          onChange={(e) => {
                            const newValue = currentPerson.visibilitas || '1';
                            let selectedLevels = newValue.split(',');
                            if (e.target.checked) {
                              if (!selectedLevels.includes(level)) selectedLevels.push(level);
                            } else {
                              selectedLevels = selectedLevels.filter(l => l !== level);
                            }
                            // Jika kosong, default ke '1' (jika tidak ingin kosong bisa diatur)
                            const finalValue = selectedLevels.length ? selectedLevels.join(',') : '1';
                            setCurrentPerson({ ...currentPerson, visibilitas: finalValue });
                          }}
                          className="accent-cyan-600"
                        />
                        <span>Level {level}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[9px] text-slate-400 italic">Level yang dipilih: {currentPerson.visibilitas || '1'}</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Upload Foto (Image)</label>
              <input type="file" accept="image/*" className="w-full p-2 bg-slate-50 border rounded-xl text-xs" onChange={e => { if(e.target.files?.[0]) setCurrentPerson({ ...currentPerson, imageFile: e.target.files[0] as any }) }} />
            </div>

          </div>
          
          <div className="mt-6 pt-5 border-t border-slate-100 flex gap-2 sticky bottom-0 bg-white">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors">Batalkan</button>
            <button type="submit" disabled={isProcessing} className="flex-[2] py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-colors">{isProcessing ? 'MENYIMPAN...' : 'SAVE PARTNER'}</button>
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
                    onClick={() => { 
                      setPersonDetailTab('History');
                      if (historyList.length === 0) fetchPersonHistory(selectedUserForDetail.id, 1);
                    }}
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
                  {personDetailTab === 'Overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 md:col-span-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Alamat Lengkap (Text 3 - 6)</p>
                        <p className="font-medium text-slate-700 text-sm mt-1">
                          {[selectedUserForDetail.text_3, selectedUserForDetail.text_4, selectedUserForDetail.text_5, selectedUserForDetail.text_6].filter(Boolean).join(', ') || '-'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Kontak HP/WA (Text 7)</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.text_7 || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Kategori Lain (Text 9)</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.text_9 || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Info Ekstra (Text 10)</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">{selectedUserForDetail.text_10 || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Visibilitas</p>
                        <p className="font-bold text-slate-700 text-sm mt-1">Level {selectedUserForDetail.visibilitas || '1'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 md:col-span-2 flex justify-between gap-4 text-center">
                        <div className="flex-1"><p className="text-[10px] font-black text-slate-400 uppercase">Number 1</p><p className="font-bold mt-1 text-cyan-600">{selectedUserForDetail.number_1 || 0}</p></div>
                        <div className="flex-1 border-l border-r border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase">Number 2</p><p className="font-bold mt-1 text-cyan-600">{selectedUserForDetail.number_2 || 0}</p></div>
                        <div className="flex-1"><p className="text-[10px] font-black text-slate-400 uppercase">Number 3</p><p className="font-bold mt-1 text-cyan-600">{selectedUserForDetail.number_3 || 0}</p></div>
                      </div>
                    </div>
                  )}
                  {personDetailTab === 'History' && (
                    <div>
                      <div className="space-y-2">
                        {historyList.length === 0 ? (
                          <p className="text-center text-slate-500 py-6">Belum ada transaksi.</p>
                        ) : (
                          historyList.map(item => (
                            <div
                              key={item.id}
                              onClick={() => { window.location.href = `/?ref=${item.id}`; }}
                              className="bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50 transition"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-mono text-slate-500">{item.created_at}</span>
                                <span className="text-xs font-bold text-slate-800">Rp {item.total?.toLocaleString('id-ID') || 0}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">Operator: {item.operator || '-'}</p>
                            </div>
                          ))
                        )}
                      </div>
                      {historyTotalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 pt-2 border-t">
                          <button
                            disabled={historyPage === 1}
                            onClick={() => {
                              const newPage = historyPage - 1;
                              setHistoryPage(newPage);
                              fetchPersonHistory(selectedUserForDetail.id, newPage);
                            }}
                            className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30"
                          >Prev</button>
                          <span className="text-[10px] text-slate-400">Hal {historyPage} / {historyTotalPages}</span>
                          <button
                            disabled={historyPage === historyTotalPages}
                            onClick={() => {
                              const newPage = historyPage + 1;
                              setHistoryPage(newPage);
                              fetchPersonHistory(selectedUserForDetail.id, newPage);
                            }}
                            className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30"
                          >Next</button>
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