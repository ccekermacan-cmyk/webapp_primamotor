import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, Plus, Edit, Trash2, Users, UserCheck, 
  UserX, ChevronLeft, ChevronRight, Eye,
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

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 5;

  const [selectedPersonForBon, setSelectedPersonForBon] = useState<Person | null>(null);
  const [isBonModalOpen, setIsBonModalOpen] = useState(false);
  const [bonList, setBonList] = useState<any[]>([]);

  // Modal Detail User
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<any>(null);
  const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
  
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState<any>(null);
  const [isProcessingUser, setIsProcessingUser] = useState(false);  

  // State untuk tab di modal detail user
  const [activeDetailTab, setActiveDetailTab] = useState<'Overview' | 'Gaji' | 'Bon'>('Overview');
  const [dummySalaryList, setDummySalaryList] = useState<any[]>([]);
  const [salaryPage, setSalaryPage] = useState(1);
  const [salaryTotalPages, setSalaryTotalPages] = useState(1);
  const [dummyBonList, setDummyBonList] = useState<any[]>([]);
  const [bonPage, setBonPage] = useState(1);
  const [bonTotalPages, setBonTotalPages] = useState(1);

  // --- FETCH PEOPLE (dengan filter yang benar dan fallback) ---
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
      console.log('Filter string:', filterString);

      const result = await pb.collection('dropdown').getList<Person>(page, perPage, {
        filter: filterString,
        sort: 'text_1'
      });
      setPeople(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error(error);
      // fallback...
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      let filterParts = [];
      if (userFilterLevel !== 'all') {
        filterParts.push(`level = ${userFilterLevel}`);
      }
      if (userFilterStatus !== 'all') {
        filterParts.push(`status ?= "${userFilterStatus}"`); // ← case‑insensitive
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

  // Efek untuk reload ketika page, filterJenis, atau searchTerm berubah
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'user') {
        fetchUsers();
      } else {
        fetchPeople();
      }
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
      const payload = {
        text_1: currentPerson.text_1,
        text_2: currentPerson.text_2 || '-',
        jenis: formattedJenis,
        kategori: 'Person',
        id_lama: currentPerson.id_lama || `PSN-${Date.now().toString().slice(-4)}`,
      };

      if (currentPerson.id) {
        await pb.collection('dropdown').update(currentPerson.id, payload);
      } else {
        await pb.collection('dropdown').create(payload);
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

  const showBonDetail = (person: Person) => {
    setSelectedPersonForBon(person);
    // Data dummy bon (sementara)
    const dummyBon = [
      { id: 1, tanggal: '2025-05-01', jumlah: 500000, status: 'Lunas', sisa: 0, sumber: 'Kas Perusahaan' },
      { id: 2, tanggal: '2025-05-15', jumlah: 300000, status: 'Aktif', sisa: 200000, sumber: 'Dana Pribadi Owner' },
      { id: 3, tanggal: '2025-05-20', jumlah: 150000, status: 'Aktif', sisa: 150000, sumber: 'Kas Perusahaan' },
    ];
    setBonList(dummyBon);
    setIsBonModalOpen(true);
  };

  // Modal Detail User
  const showUserDetail = (user: any) => {
    setSelectedUserForDetail(user);
    setIsUserDetailModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserData) return;
    setIsProcessingUser(true);
    try {
      const payload = {
        name: editUserData.name,
        email: editUserData.email,
        status: editUserData.status,
        level: editUserData.level,
        link_image: editUserData.link_image,
        tokenkey: editUserData.tokenkey,
      };
      await pb.collection('user').update(editUserData.id, payload);
      setIsEditUserModalOpen(false);
      fetchUsers(); // refresh daftar user
      if (selectedUserForDetail?.id === editUserData.id) {
        setSelectedUserForDetail({ ...selectedUserForDetail, ...payload });
      }
      alert('User berhasil diupdate');
    } catch (error) {
      console.error(error);
      alert('Gagal mengupdate user');
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
            onClick={() => { setCurrentPerson({ jenis: 'customer' }); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-200 transition-all self-start md:self-auto transform hover:-translate-y-0.5"
          >
            <Plus size={16} strokeWidth={3} /> Add New Partner
          </button>
        </div>

        {/* FILTER TABS & SEARCH */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto">
          <button
  onClick={() => { setActiveTab('person'); setFilterJenis('all'); setPage(1); }}
  className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
    activeTab === 'person' && filterJenis === 'all' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
  }`}
>
  <Users size={14} /> Semua (Person)
          </button>
          <button
            onClick={() => { setActiveTab('person'); setFilterJenis('customer'); setPage(1); }}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'person' && filterJenis === 'customer' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserCheck size={14} /> Customers
          </button>
          <button
            onClick={() => { setActiveTab('person'); setFilterJenis('supplier'); setPage(1); }}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'person' && filterJenis === 'supplier' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserX size={14} /> Suppliers
          </button>
          {isAdmin && (
            <button
              onClick={() => { setActiveTab('user'); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'user' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users size={14} /> Karyawan
            </button>
          )}
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
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-cyan-600 rounded-xl transition" title="Edit (belum tersedia)">
                              <Edit size={14} />
                            </button>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition" title="Hapus (belum tersedia)">
                              <Trash2 size={14} />
                            </button>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition" title="Lihat Detail">
                              <Eye size={14} />
                            </button>
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
                        onClick={() => showBonDetail(p)}
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

      {/* MODAL ADD / EDIT */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentPerson.id ? 'Edit Rekor Partner' : 'Tambah Partner Baru'}>
        <form onSubmit={handleSave} className="space-y-4 p-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nama Lengkap Partner</label>
            <input
              type="text"
              required
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-cyan-500 transition-colors text-slate-700"
              placeholder="Contoh: Fanny / Leo Manny"
              value={currentPerson.text_1 || ''}
              onChange={e => setCurrentPerson({ ...currentPerson, text_1: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Deskripsi / Jabatan / Keterangan</label>
            <input
              type="text"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-cyan-500 transition-colors text-slate-700"
              placeholder="Contoh: Ketua RT / Anggota / Supplier Jasa"
              value={currentPerson.text_2 || ''}
              onChange={e => setCurrentPerson({ ...currentPerson, text_2: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Jenis Hubungan Dagang</label>
              <select
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-cyan-500 transition-colors text-slate-700"
                value={currentPerson.jenis || 'customer'}
                onChange={e => setCurrentPerson({ ...currentPerson, jenis: e.target.value })}
              >
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">ID Unik Custom (Opsional)</label>
              <input
                type="text"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-cyan-500 transition-colors text-slate-700 font-mono"
                placeholder="Auto jika dikosongkan"
                value={currentPerson.id_lama || ''}
                onChange={e => setCurrentPerson({ ...currentPerson, id_lama: e.target.value })}
              />
            </div>
          </div>
          <div className="pt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md shadow-cyan-100 transition-colors"
            >
              {isProcessing ? 'MENYIMPAN...' : 'SAVE PARTNER'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL EDIT USER */}
        <Modal isOpen={isEditUserModalOpen} onClose={() => setIsEditUserModalOpen(false)} title="Edit Data Karyawan">
          {editUserData && (
            <form onSubmit={handleUpdateUser} className="space-y-4 p-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                  value={editUserData.name || ''}
                  onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Username</label>
                <input
                  type="text"
                  disabled
                  className="w-full p-3 bg-slate-100 border rounded-xl text-sm font-bold text-slate-500"
                  value={editUserData.username || ''}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Email</label>
                <input
                  type="email"
                  required
                  className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                  value={editUserData.email || ''}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Level</label>
                  <select
                    className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                    value={editUserData.level || 0}
                    onChange={(e) => setEditUserData({ ...editUserData, level: Number(e.target.value) })}
                  >
                    <option value={2}>Karyawan Biasa (Level 2)</option>
                    <option value={5}>Supervisor (Level 5)</option>
                    <option value={10}>Mekanik (Level 10)</option>
                    <option value={1}>Admin (Level 1)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Status</label>
                  <select
                    className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                    value={editUserData.status || 'active'}
                    onChange={(e) => setEditUserData({ ...editUserData, status: e.target.value })}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Link Image (URL Foto)</label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                  value={editUserData.link_image || ''}
                  onChange={(e) => setEditUserData({ ...editUserData, link_image: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Token Key</label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-mono"
                  value={editUserData.tokenkey || ''}
                  onChange={(e) => setEditUserData({ ...editUserData, tokenkey: e.target.value })}
                />
              </div>
              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setIsEditUserModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs">Batal</button>
                <button type="submit" disabled={isProcessingUser} className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-bold text-xs">
                  {isProcessingUser ? 'MENYIMPAN...' : 'SIMPAN'}
                </button>
              </div>
            </form>
          )}
        </Modal>

      {/* MODAL DETAIL BON */}
      <Modal isOpen={isBonModalOpen} onClose={() => setIsBonModalOpen(false)} title={`Detail Bon - ${selectedPersonForBon?.text_1 || ''}`}>
        <div className="space-y-4">
          {bonList.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Belum ada data bon.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Tanggal</th>
                    <th className="p-2 text-right">Jumlah (Rp)</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-right">Sisa (Rp)</th>
                    <th className="p-2 text-left">Sumber Dana</th>
                  </tr>
                </thead>
                <tbody>
                  {bonList.map(bon => (
                    <tr key={bon.id} className="border-b border-slate-100">
                      <td className="p-2">{bon.tanggal}</td>
                      <td className="p-2 text-right font-mono">{bon.jumlah.toLocaleString('id-ID')}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          bon.status === 'Lunas' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {bon.status}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono">{bon.sisa.toLocaleString('id-ID')}</td>
                      <td className="p-2">{bon.sumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button 
              onClick={() => setIsBonModalOpen(false)} 
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL DETAIL USER */}
      <Modal isOpen={isUserDetailModalOpen} onClose={() => setIsUserDetailModalOpen(false)} title="Detail Karyawan">
        {selectedUserForDetail && (
          <div className="p-6 overflow-y-auto max-h-[80vh]">
            {/* Header dengan avatar, nama, dan tombol edit/delete tetap dipertahankan */}
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-4">
                {selectedUserForDetail.link_image ? (
                  <img src={selectedUserForDetail.link_image} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                    {getAvatarInitials(selectedUserForDetail.name || selectedUserForDetail.username)}
                  </div>
                )}
                <div>
                  <h3 className="font-black text-slate-800 text-xl">{selectedUserForDetail.name || selectedUserForDetail.username}</h3>
                  <p className="text-sm text-slate-500">@{selectedUserForDetail.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].includes(Number(userLevelFromStorage)) && (
                  <button
                    onClick={() => { setEditUserData(selectedUserForDetail); setIsEditUserModalOpen(true); }}
                    className="p-2 bg-cyan-50 text-cyan-600 rounded-xl hover:bg-cyan-100 transition"
                    title="Edit User"
                  >
                    <Edit size={18} />
                  </button>
                )}
                {userLevelFromStorage === '1' && (
                  <button
                    onClick={() => handleDeleteUser(selectedUserForDetail.id)}
                    className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition"
                    title="Hapus User"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Tab navigasi - pill style premium dengan ikon dan efek hover */}
            <div className="flex gap-1 bg-slate-100/50 p-1 rounded-xl mb-4">
              {['Overview', 'Gaji', 'Bon'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDetailTab(tab as 'Overview' | 'Gaji' | 'Bon')}
                  className={`
                    flex-1 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all duration-200
                    ${activeDetailTab === tab 
                      ? 'bg-white text-cyan-700 shadow-sm' 
                      : 'text-slate-500 hover:text-cyan-600 hover:bg-white/50'
                    }
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Konten berdasarkan tab */}
            <div className="mt-4">
              {activeDetailTab === 'Overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                      <p className="text-[10px] font-black text-indigo-500 uppercase">Nama Lengkap</p>
                      <p className="font-bold text-slate-800">{selectedUserForDetail.name || '-'}</p>
                    </div>
                    <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                      <p className="text-[10px] font-black text-indigo-500 uppercase">Username</p>
                      <p className="font-bold text-slate-800">@{selectedUserForDetail.username}</p>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-50 to-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-black text-emerald-500 uppercase">Email</p>
                      <p className="font-bold text-slate-800 break-all">{selectedUserForDetail.email || '-'}</p>
                    </div>
                    <div className="bg-gradient-to-r from-amber-50 to-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                      <p className="text-[10px] font-black text-amber-500 uppercase">Level / Jabatan</p>
                      <p className="font-bold text-slate-800">
                        {selectedUserForDetail.level === 1 ? 'Admin' : selectedUserForDetail.level === 10 ? 'Mekanik' : 'Karyawan'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-rose-50 to-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                      <p className="text-[10px] font-black text-rose-500 uppercase">Status Akun</p>
                      <p className={`font-bold ${selectedUserForDetail.status?.toLowerCase() === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedUserForDetail.status?.toLowerCase() === 'active' ? 'Aktif' : 'Nonaktif'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                      <p className="text-[10px] font-black text-purple-500 uppercase">Token Key</p>
                      <p className="font-mono text-xs text-slate-600 truncate">{selectedUserForDetail.tokenkey || '-'}</p>
                    </div>
                  </div>
                  {selectedUserForDetail.link_image && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-xl border">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Foto Profil</p>
                      <img src={selectedUserForDetail.link_image} alt="Avatar" className="w-24 h-24 rounded-xl object-cover border shadow-sm" />
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'Gaji' && (
                <div>
                  <div className="space-y-3">
                    {dummySalaryList.slice((salaryPage-1)*5, salaryPage*5).map((salary, idx) => (
                      <div key={idx} className="bg-gradient-to-r from-slate-50 to-white p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Periode: {salary.periode}</p>
                          <p className="text-[10px] text-slate-500">Total: Rp {salary.total.toLocaleString('id-ID')}</p>
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Lunas</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t">
                    <button
                      disabled={salaryPage === 1}
                      onClick={() => setSalaryPage(p => p-1)}
                      className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30"
                    >Prev</button>
                    <span className="text-[10px] text-slate-400">Halaman {salaryPage} dari {salaryTotalPages}</span>
                    <button
                      disabled={salaryPage === salaryTotalPages}
                      onClick={() => setSalaryPage(p => p+1)}
                      className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30"
                    >Next</button>
                  </div>
                </div>
              )}

              {activeDetailTab === 'Bon' && (
                <div>
                  <div className="space-y-3">
                    {dummyBonList.slice((bonPage-1)*5, bonPage*5).map((bon, idx) => (
                      <div key={idx} className="bg-gradient-to-r from-slate-50 to-white p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Tanggal: {bon.tanggal}</p>
                          <p className="text-[10px] text-slate-500">Jumlah: Rp {bon.jumlah.toLocaleString('id-ID')} | Sisa: Rp {bon.sisa.toLocaleString('id-ID')}</p>
                          <p className="text-[10px] text-slate-400">Sumber: {bon.sumber}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${bon.status === 'Lunas' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {bon.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t">
                    <button
                      disabled={bonPage === 1}
                      onClick={() => setBonPage(p => p-1)}
                      className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30"
                    >Prev</button>
                    <span className="text-[10px] text-slate-400">Halaman {bonPage} dari {bonTotalPages}</span>
                    <button
                      disabled={bonPage === bonTotalPages}
                      onClick={() => setBonPage(p => p+1)}
                      className="p-1 px-3 bg-slate-100 rounded-lg text-xs disabled:opacity-30"
                    >Next</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-3 border-t">
              <button onClick={() => setIsUserDetailModalOpen(false)} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs transition-colors">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>

    
  );
}