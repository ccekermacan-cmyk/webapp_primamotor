import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Search, Plus, Edit, Trash2, Users, UserCheck, 
  UserX, ChevronLeft, ChevronRight,
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

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 5;

  // --- FETCH PEOPLE (dengan filter yang benar dan fallback) ---
  const fetchPeople = async () => {
    setLoading(true);
    try {
      const filters = [];
      // Filter kategori harus "Person" (case-sensitive, sesuai data di DB)
      filters.push(pb.filter('kategori = {:kategori}', { kategori: 'Person' }));

      // Filter jenis
      if (filterJenis !== 'all') {
        const jenisValue = filterJenis === 'customer' ? 'Customer' : 'Supplier';
        filters.push(pb.filter('jenis = {:jenis}', { jenis: jenisValue }));
      }

      // Filter pencarian teks pada text_1 atau text_2
      if (searchTerm.trim() !== '') {
        const term = searchTerm.trim();
        filters.push(pb.filter('(text_1 ~ {:term} || text_2 ~ {:term})', { term }));
      }

      const filterString = filters.join(' && ');
      console.log('Filter yang dikirim ke server:', filterString);

      const result = await pb.collection('dropdown').getList<Person>(page, perPage, {
        filter: filterString,
        sort: '-created',
        $autoCancel: false,
      });

      setPeople(result.items);
      setTotalPages(result.totalPages);
    } catch (error: any) {
      console.error('Gagal fetch dengan filter server, gunakan fallback client-side:', error);

      // FALLBACK: ambil semua data lalu filter manual di frontend
      try {
        const allData = await pb.collection('dropdown').getFullList<Person>({
          sort: '-created',
          $autoCancel: false,
        });

        let filtered = allData.filter(item => item.kategori === 'Person');

        if (filterJenis !== 'all') {
          const jenisTarget = filterJenis === 'customer' ? 'Customer' : 'Supplier';
          filtered = filtered.filter(item => item.jenis === jenisTarget);
        }

        if (searchTerm.trim() !== '') {
          const term = searchTerm.trim().toLowerCase();
          filtered = filtered.filter(item =>
            item.text_1?.toLowerCase().includes(term) ||
            item.text_2?.toLowerCase().includes(term)
          );
        }

        // Paginasi manual
        const start = (page - 1) * perPage;
        const paginated = filtered.slice(start, start + perPage);
        setPeople(paginated);
        setTotalPages(Math.ceil(filtered.length / perPage));
      } catch (fallbackError) {
        console.error('Fallback juga gagal:', fallbackError);
        setPeople([]);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  // Efek untuk reload ketika page, filterJenis, atau searchTerm berubah
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchPeople();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, filterJenis, searchTerm]);

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
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto">
            <button
              onClick={() => { setFilterJenis('all'); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${filterJenis === 'all' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Users size={14} /> Semua
            </button>
            <button
              onClick={() => { setFilterJenis('customer'); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${filterJenis === 'customer' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <UserCheck size={14} /> Customers
            </button>
            <button
              onClick={() => { setFilterJenis('supplier'); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap ${filterJenis === 'supplier' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <UserX size={14} /> Suppliers
            </button>
          </div>

          <div className="relative w-full lg:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-cyan-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Cari data berdasarkan nama partner..."
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-cyan-500 transition-all text-slate-700"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="py-5 px-6">People</th>
                  <th className="py-5 px-6">Status Type</th>
                  <th className="py-5 px-6">Reference ID</th>
                  <th className="py-5 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <div className="w-10 h-10 border-4 border-slate-100 border-t-cyan-600 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sinkronisasi Data...</p>
                    </td>
                  </tr>
                ) : people.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-slate-400 font-bold text-sm">
                      Tidak ada data partner bisnis terdaftar pada klaster ini.
                    </td>
                  </tr>
                ) : (
                  people.map((p) => {
                    const isCustomer = String(p.jenis).toLowerCase().includes('customer');
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
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
                              onClick={() => { setCurrentPerson(p); setIsModalOpen(true); }}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 border border-slate-100 rounded-xl transition-all"
                              title="Ubah Data"
                            >
                              <Edit size={14} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
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
                disabled={page === 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl disabled:opacity-40 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                disabled={page >= totalPages || loading}
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
    </div>
  );
}