import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { Package, Search, Trash2, Edit, Copy, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Produk {
  [key: string]: any; 
  id: string;
  id_lama: string;
  kategori: string;
  merk: string;
  jenis: string;
  varian: string;
  keterangan: string; 
  tipe: string;
  unit: string;
  beli: number;
  sell_1: number;
  sell_2: number;
  sell_3: number;
  sell_4: number;
  sell_5: number;
  sell_6: number;
  min_1: number;
  min_2: number;
  min_3: number;
  stok_1: number;
  stok_2: number;
  stok_3: number;
  date: string;
}

export default function Produk() {
  const [products, setProducts] = useState<Produk[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [logHistory, setLogHistory] = useState<any[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  const [inputValue, setInputValue] = useState('');

  const [userLevel, setUserLevel] = useState(localStorage.getItem('user_level') || '');
  
  // Pagination & Search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 12; 
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [modalType, setModalType] = useState<'detail' | 'form' | 'delete' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Produk | null>(null);
  const [formData, setFormData] = useState<Partial<Produk>>({});
  const [existingTipe, setExistingTipe] = useState<string[]>([]);

  // ==========================================
  // FUNGSI PEMBANTU (HELPERS)
  // ==========================================
  const isReadOnly = userLevel !== '1';

  const generateRawRandomId = () => {
    return String(Math.floor(Math.random() * 100000));
  };

  const formatIdLamaDisplay = (id: string | number | undefined) => {
    if (id === undefined || id === null || id === '') return 'N/A';
    return String(id).padStart(5, '0');
  };

  const cleanIdLamaStorage = (id: string | number) => {
    return String(Number(id)); 
  };

  // ==========================================
  // FETCH DATA & PENCARIAN (REVISI MULTI-WORD)
  // ==========================================
  const fetchProducts = async () => {
  try {
    setLoading(true);
    let filterQuery = '';
    
    if (searchTerm) {
      const terms = searchTerm.trim().toLowerCase().split(/\s+/);
      const bindings: any = {};
      const conditions: string[] = [];

      terms.forEach((term, idx) => {
        const isNumeric = /^\d+$/.test(term);
        if (isNumeric) {
          // Hilangkan leading zero, lalu cari dengan operator = (eksak) karena ID unik
          const numericId = parseInt(term, 10);
          conditions.push(`id_lama = {:t${idx}}`);
          bindings[`t${idx}`] = numericId.toString(); // binding sebagai string
        } else {
          conditions.push(`(id_lama ~ {:t${idx}} || kategori ~ {:t${idx}} || merk ~ {:t${idx}} || jenis ~ {:t${idx}} || varian ~ {:t${idx}} || keterangan ~ {:t${idx}} || tipe ~ {:t${idx}})`);
          bindings[`t${idx}`] = term;
        }
      });

      filterQuery = pb.filter(conditions.join(' && '), bindings);
      console.log("Filter Query:", filterQuery); // Debug: lihat hasil filter
    }

      const result = await pb.collection('produk').getList<Produk>(page, perPage, {
        sort: 'id_lama',     // ascending sesuai ID string (alfabetis, tapi ID angka akan terurut secara numerik jika panjangnya sama)
        filter: filterQuery,
        $autoCancel: false,
      });
      
      setProducts(result.items);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
    } catch (error: any) {
      if (!error.isAbort) console.error("Gagal mengambil data:", error);
    } finally {
      setLoading(false);
    }
  };

  // BLOK 1: Hanya jalan 1x saat aplikasi baru dibuka untuk ambil enumlist Tipe Motor
  useEffect(() => {
    const fetchTipeOptions = async () => {
      try {
        const records = await pb.collection('produk').getFullList({ fields: 'tipe', $autoCancel: false });
        const allTypes = Array.from(new Set(records.flatMap(r => r.tipe?.split(',').map((s: string) => s.trim()).filter(Boolean))));
        setExistingTipe(allTypes);
      } catch (e) {
        console.error("Gagal memuat tipe motor", e);
      }
    };
    fetchTipeOptions();
  }, []); // <--- array kosong memastikan ini hanya dirender 1x

  // BLOK 2: Jalan setiap kali ganti halaman atau ketik pencarian
  useEffect(() => {
    fetchProducts();
  }, [page, searchTerm]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1); 
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    fetchProducts();
  }, [page, searchTerm]);

const fetchLogHistory = async (prodId: string, pageNum: number = 1) => {
  try {
    const filterString = pb.filter('item_baru = {:id}', { id: prodId });
    
    const result = await pb.collection('log_stock').getList(pageNum, 5, {
      filter: filterString, 
      sort: '-created_at', // REVISI: Sesuaikan dengan nama kolom di DB Anda
      $autoCancel: false
    });
    
    setLogHistory(result.items);
    setLogTotalPages(result.totalPages);
  } catch (e) {
    console.error("Gagal load history:", e);
  }
};

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleOpenDetail = (prod: Produk) => {
    setSelectedProduct(prod);
    setLogPage(1); // Reset page history
    fetchLogHistory(prod.id, 1);
    setModalType('detail');
  };

  const handleOpenEdit = (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    setSelectedProduct(prod);
    setFormData({
      ...prod,
      id_lama: formatIdLamaDisplay(prod.id_lama) 
    }); 
    setModalType('form');
  };

  const handleOpenCopy = (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const { id, created, updated, ...restData } = prod;
    const copyData: Partial<Produk> = { ...restData };
    copyData.id_lama = generateRawRandomId();
    
    setSelectedProduct(null); 
    setFormData(copyData);
    setModalType('form');
  };

  const handleOpenDelete = (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(prod);
    setModalType('delete');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));
  };

  // ==========================================
  // CRUD ACTIONS
  // ==========================================
  const submitDelete = async () => {
    if (!selectedProduct) return;
    setIsProcessing(true);
    try {
      await pb.collection('produk').delete(selectedProduct.id);
      setModalType(null);
      fetchProducts(); 
    } catch (error) {
      alert("Terjadi kesalahan saat menghapus data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      let payload = { ...formData };

      if (payload.id_lama) {
        payload.id_lama = cleanIdLamaStorage(payload.id_lama);
      } else {
        payload.id_lama = generateRawRandomId();
      }

      // Pastikan format tipe rapi (hilang spasi, unik, urut) sebelum kirim ke DB
      if (typeof payload.tipe === 'string') {
        const tipeArray = payload.tipe.split(',').map(s => s.trim()).filter(Boolean);
        payload.tipe = Array.from(new Set(tipeArray)).sort().join(', ');
      }

      if (selectedProduct && selectedProduct.id) {
        // PROSES EDIT
        await pb.collection('produk').update(selectedProduct.id, payload);
      } else {
        let success = false;
        let attempts = 0;
        const maxAttempts = 15;

        while (!success && attempts < maxAttempts) {
          try {
            await pb.collection('produk').create(payload);
            success = true;
          } catch (error: any) {
            const isUniqueError = error?.response?.data?.id_lama?.code === 'validation_not_unique' || error?.status === 400;
            if (isUniqueError) {
              payload.id_lama = generateRawRandomId(); 
              attempts++;
            } else {
              throw error; 
            }
          }
        }
        if (!success) throw new Error("Gagal mendapatkan ID unik.");
      }
      
      setModalType(null);
      fetchProducts(); 
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan data. Pastikan format isian benar.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isEditMode = !!(selectedProduct && selectedProduct.id);

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header Halaman */}
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight">Manajemen Produk</h2>
          <p className="text-gray-500 mt-1">Total {totalItems} produk terdaftar</p>
        </div>
        <button 
          onClick={() => {
            setSelectedProduct(null);
            setFormData({ id_lama: generateRawRandomId() });
            setModalType('form');
          }}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/30 hover:-translate-y-1 transition-all"
        >
          + Produk Baru
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
        
        {/* Search Bar */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex gap-4 items-center shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Cari ID, Kategori, atau Varian..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {/* List Grid Produk */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Package size={64} className="mb-4 opacity-20" />
              <p className="font-medium">Tidak ada produk ditemukan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {products.map((prod) => (
                <div 
                  key={prod.id} 
                  onClick={() => handleOpenDetail(prod)}
                  className="group bg-white border border-gray-100 p-5 rounded-2xl hover:border-orange-400 hover:shadow-lg hover:shadow-orange-100 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg mb-2">
                        ID: {formatIdLamaDisplay(prod.id_lama)}
                      </span>
                      <h3 className="font-bold text-gray-800 text-lg leading-tight group-hover:text-orange-600 line-clamp-2">
                        {`${prod.kategori} ${prod.merk} ${prod.jenis} ${prod.varian} ${prod.keterangan || ''} ${prod.tipe || ''}`.trim()}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-xl mb-4">
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Stok (Realtime)</p>
                      <p className={`font-black text-lg ${prod.stok_3 <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {prod.stok_3} <span className="text-xs font-medium text-gray-500">{prod.unit}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-medium mb-1">Harga Default</p>
                      <p className="font-black text-blue-600">Rp {prod.sell_6?.toLocaleString('id-ID') || 0}</p>
                      <p className="text-xs font-bold text-purple-600 mt-1">Plg: Rp {prod.sell_5?.toLocaleString('id-ID') || 0}</p>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex gap-2 justify-end border-t border-gray-100 pt-4">
                    <button onClick={(e) => handleOpenEdit(prod, e)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">
                      <Edit size={14} /> Edit
                    </button>
                    <button onClick={(e) => handleOpenCopy(prod, e)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg">
                      <Copy size={14} /> Copy
                    </button>
                    <button onClick={(e) => handleOpenDelete(prod, e)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
          <p className="text-sm text-gray-500 font-medium">Halaman <span className="font-bold">{page}</span> dari <span className="font-bold">{totalPages || 1}</span></p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={20} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0 || loading} className="p-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. MODAL DETAIL PRODUK */}
      {/* ========================================================= */}
      <Modal isOpen={modalType === 'detail'} onClose={() => setModalType(null)} title="Detail Spesifikasi Produk">
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex gap-4 items-center p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-orange-500 shrink-0"><Package size={32} /></div>
              <div>
                <p className="text-sm font-bold text-orange-600 mb-1">
                  ID: {formatIdLamaDisplay(selectedProduct.id_lama)}
                </p>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {`${selectedProduct.kategori} ${selectedProduct.merk} ${selectedProduct.jenis} ${selectedProduct.varian} ${selectedProduct.keterangan || ''} ${selectedProduct.tipe || ''}`.trim()}
                </h3>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-b pb-4">
              <button onClick={() => handleOpenEdit(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"><Edit size={16} /> Edit Data</button>
              <button onClick={() => handleOpenCopy(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"><Copy size={16} /> Salin</button>
              <button onClick={() => handleOpenDelete(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={16} /> Hapus</button>
            </div>

            <div>
              <div className="overflow-hidden border border-gray-200 rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr><th className="px-4 py-3">Tier</th><th className="px-4 py-3 text-center">Minimum</th><th className="px-4 py-3 text-right">Harga</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="px-4 py-3 font-medium">Tier 1 (Grosir)</td><td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_1 || 0}</td><td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_1?.toLocaleString('id-ID') || 0}</td></tr>
                    <tr><td className="px-4 py-3 font-medium">Tier 2</td><td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_2 || 0}</td><td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_2?.toLocaleString('id-ID') || 0}</td></tr>
                    <tr><td className="px-4 py-3 font-medium">Tier 3</td><td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_3 || 0}</td><td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_3?.toLocaleString('id-ID') || 0}</td></tr>
                    <tr><td className="px-4 py-3 font-medium">Tier 4</td><td className="px-4 py-3 text-center text-gray-400">-</td><td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_4?.toLocaleString('id-ID') || 0}</td></tr>
                    <tr className="bg-orange-50/30"><td className="px-4 py-3 font-bold text-purple-600">Tier 5 (Pelanggan)</td><td className="px-4 py-3 text-center">-</td><td className="px-4 py-3 text-right font-black text-purple-600">Rp {selectedProduct.sell_5?.toLocaleString('id-ID') || 0}</td></tr>
                    <tr className="bg-blue-50/30"><td className="px-4 py-3 font-bold text-blue-600">Tier 6 (Default Ecer)</td><td className="px-4 py-3 text-center">-</td><td className="px-4 py-3 text-right font-black text-blue-600">Rp {selectedProduct.sell_6?.toLocaleString('id-ID') || 0}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* History Table */}
            <div className="mt-8">
              <h4 className="font-bold text-slate-700 text-sm mb-4">Riwayat Keluar/Masuk</h4>
              
              <div className="bg-white border border-slate-100 rounded-[1.25rem] shadow-sm overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Tanggal</th>
                      <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Operator</th>
                      <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-center">Status</th>
                      <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-center">Qty</th>
                      <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-right">Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {logHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                          Belum ada riwayat transaksi.
                        </td>
                      </tr>
                    ) : (
                      logHistory.map((log) => (
                        <tr 
                          key={log.id} 
                          className="hover:bg-blue-50/40 transition-colors cursor-pointer group" 
                          onClick={() => window.open(`/?ref=${log.ref_baru}`, '_blank')}
                        >
                          <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                            {new Date(log.created_at || log.created).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-semibold capitalize">
                            {log.operator || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest uppercase border ${
                              log.boolean?.toLowerCase() === 'in' 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                              {log.boolean}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black text-slate-700 text-center">
                            {log.qty}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-800">
                            Rp {log.price_1?.toLocaleString('id-ID') || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination History */}
              <div className="flex justify-between items-center mt-4 px-1">
                <button 
                  disabled={logPage === 1}
                  onClick={() => { setLogPage(p => p - 1); fetchLogHistory(selectedProduct!.id, logPage - 1); }}
                  className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronLeft size={16}/>
                </button>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                  Hal {logPage} / {logTotalPages || 1}
                </span>
                <button 
                  disabled={logPage >= logTotalPages}
                  onClick={() => { setLogPage(p => p + 1); fetchLogHistory(selectedProduct!.id, logPage + 1); }}
                  className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>

            <button onClick={() => setModalType(null)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Tutup</button>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* 2. MODAL FORM (TAMBAH / EDIT / COPY) */}
      {/* ========================================================= */}
      <Modal isOpen={modalType === 'form'} onClose={() => setModalType(null)} title={isEditMode ? "Edit Produk" : "Tambah/Copy Produk"}>
        <form onSubmit={submitForm} className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <h4 className="font-bold text-gray-700 text-sm border-b pb-2">Informasi Dasar</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500">ID Lama</label>
                  <input 
                    required 
                    type="text" 
                    name="id_lama" 
                    maxLength={5}
                    value={formData.id_lama || ''} 
                    onChange={handleInputChange} 
                    disabled={isEditMode}
                    className={`w-full p-2 border rounded-lg outline-none ${isEditMode ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-transparent' : 'bg-white focus:ring-2 focus:ring-orange-400'}`}
                  />
                </div>
                <div><label className="text-xs font-bold text-gray-500">Kategori</label><input required type="text" name="kategori" value={formData.kategori || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"/></div>
                <div><label className="text-xs font-bold text-gray-500">Merk</label><input type="text" name="merk" value={formData.merk || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"/></div>
                <div><label className="text-xs font-bold text-gray-500">Jenis</label><input type="text" name="jenis" value={formData.jenis || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"/></div>
                <div><label className="text-xs font-bold text-gray-500">Varian</label><input type="text" name="varian" value={formData.varian || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"/></div>
                <div className="col-span-2"><label className="text-xs font-bold text-gray-500">Keterangan</label><input type="text" name="keterangan" value={formData.keterangan || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"/></div>
                <div className="col-span-2 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                  <label className="font-bold text-orange-700 text-sm mb-2 block">Tipe Motor (Tekan Enter untuk menambah)</label>
                  
                  {/* Daftar Chip Terpilih */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(formData.tipe?.split(',').filter(Boolean) || []).map((t, idx) => (
                      <span key={idx} className="px-3 py-1 bg-orange-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm">
                        {t.trim()}
                        <X size={12} className="cursor-pointer hover:text-orange-200" onClick={() => {
                          const current = formData.tipe?.split(',').map(s => s.trim()).filter(Boolean) || [];
                          setFormData({...formData, tipe: current.filter((_, i) => i !== idx).join(', ')});
                        }} />
                      </span>
                    ))}
                  </div>

                  {/* Input Field dengan Autocomplete */}
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Ketik tipe motor..."
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                      onChange={(e) => setInputValue(e.target.value)} // Tambahkan state ini
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val) {
                            const current = formData.tipe ? formData.tipe.split(',').map(s => s.trim()).filter(Boolean) : [];
                            if (!current.includes(val)) setFormData({...formData, tipe: [...current, val].join(', ')});
                            e.currentTarget.value = '';
                            setInputValue(''); // Reset input
                          }
                        }
                      }}
                    />
                    
                    {/* Dropdown hanya muncul jika ada input (inputValue.length > 0) */}
                    {inputValue.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {existingTipe
                          .filter(t => 
                            t.toLowerCase().includes(inputValue.toLowerCase()) && 
                            !(formData.tipe?.split(',').map(s => s.trim()) || []).includes(t)
                          )
                          .map((t) => (
                            <div 
                              key={t} 
                              className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-orange-50 cursor-pointer"
                              onClick={() => {
                                const current = formData.tipe ? formData.tipe.split(',').map(s => s.trim()).filter(Boolean) : [];
                                setFormData({...formData, tipe: [...current, t].join(', ')});
                                setInputValue(''); // Reset input setelah klik
                              }}
                            >
                              {t}
                            </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div><label className="text-xs font-bold text-gray-500">Satuan (Unit)</label><input type="text" name="unit" value={formData.unit || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"/></div>
            </div>

            <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 space-y-4">
              <h4 className="font-bold text-green-700 text-sm border-b border-green-200 pb-2">
                Manajemen Stok {isReadOnly && <span className="text-[10px] text-gray-400">(Read-Only)</span>}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500">Stok Awal</label>
                  <input type="number" name="stok_1" disabled={isReadOnly} value={formData.stok_1 ?? ''} onChange={handleInputChange} className={`w-full p-2 border rounded-lg outline-none ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Stok Menipis</label>
                  <input type="number" name="stok_2" disabled={isReadOnly} value={formData.stok_2 ?? ''} onChange={handleInputChange} className={`w-full p-2 border rounded-lg outline-none ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <label className="text-xs font-bold text-green-600">Stok Realtime</label>
                  <input type="number" name="stok_3" disabled={isReadOnly} value={formData.stok_3 ?? ''} onChange={handleInputChange} className={`w-full p-2 border rounded-lg outline-none font-bold ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-green-50'}`}/>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
              <h4 className="font-bold text-blue-700 text-sm border-b border-blue-200 pb-2">Skema Harga (Tiering)</h4>
              <div><label className="text-xs font-bold text-gray-500">Harga Beli Dasar (Modal)</label><input type="number" name="beli" value={formData.beli ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none mb-4"/></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500">Min 1 Qty</label><input type="number" name="min_1" value={formData.min_1 ?? ''} onChange={handleInputChange} className="w-full p-2 border-b outline-none mb-2"/>
                  <label className="text-xs font-bold text-gray-500">Sell 1</label><input type="number" name="sell_1" value={formData.sell_1 ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded-md outline-none bg-gray-50"/>
                </div>
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500">Min 2 Qty</label><input type="number" name="min_2" value={formData.min_2 ?? ''} onChange={handleInputChange} className="w-full p-2 border-b outline-none mb-2"/>
                  <label className="text-xs font-bold text-gray-500">Sell 2</label><input type="number" name="sell_2" value={formData.sell_2 ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded-md outline-none bg-gray-50"/>
                </div>
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500">Min 3 Qty</label><input type="number" name="min_3" value={formData.min_3 ?? ''} onChange={handleInputChange} className="w-full p-2 border-b outline-none mb-2"/>
                  <label className="text-xs font-bold text-gray-500">Sell 3</label><input type="number" name="sell_3" value={formData.sell_3 ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded-md outline-none bg-gray-50"/>
                </div>
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500">-</label><div className="h-10"></div>
                  <label className="text-xs font-bold text-gray-500">Sell 4</label><input type="number" name="sell_4" value={formData.sell_4 ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded-md outline-none bg-gray-50"/>
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-200">
                  <label className="text-xs font-bold text-purple-500">Pelanggan</label><div className="h-10"></div>
                  <label className="text-xs font-bold text-purple-600">Sell 5</label><input type="number" name="sell_5" value={formData.sell_5 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-purple-300 rounded-md outline-none bg-purple-50 font-bold text-purple-700"/>
                </div>
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <label className="text-xs font-bold text-blue-500">Ecer (Default)</label><div className="h-10"></div>
                  <label className="text-xs font-bold text-blue-600">Sell 6</label><input type="number" name="sell_6" value={formData.sell_6 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-blue-300 rounded-md outline-none bg-blue-50 font-bold text-blue-700"/>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalType(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50">
              {isProcessing ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* 3. MODAL HAPUS */}
      {/* ========================================================= */}
      <Modal isOpen={modalType === 'delete'} onClose={() => setModalType(null)} title="Konfirmasi Hapus">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Trash2 size={32} /></div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Hapus Produk Ini?</h3>
          <p className="text-gray-500 mb-6">Yakin menghapus <span className="font-bold">{selectedProduct?.varian}</span>?</p>
          
          <div className="flex gap-3">
            <button onClick={() => setModalType(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl">Batal</button>
            <button onClick={submitDelete} disabled={isProcessing} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50">
              {isProcessing ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
      
    </div>
  );
}