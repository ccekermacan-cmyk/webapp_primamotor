import React, { useState, useEffect, useMemo, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { Package, Search, Trash2, Edit, Copy, ChevronLeft, ChevronRight, X, Filter, LayoutGrid, List, ArrowUp, ArrowDown, ImagePlus, ExternalLink, Plus } from 'lucide-react';
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
  file?: string[]; // field untuk menyimpan file gambar
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
  const [sortField, setSortField] = useState<'id_lama' | 'nama' | 'stok' | 'harga_customer' | 'harga_retail'>('id_lama');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Pagination & Search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 12; 
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKategori, setFilterKategori] = useState<string>('all');
  const [filterStok, setFilterStok] = useState<string>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ========== SCROLL HEADER & FLOATING BUTTON ==========
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [showFloatingAdd, setShowFloatingAdd] = useState(false);

  // Modal States
  const [modalType, setModalType] = useState<'detail' | 'form' | 'delete' | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Produk | null>(null);
  const [formData, setFormData] = useState<Partial<Produk>>({});
  const [existingTipe, setExistingTipe] = useState<string[]>([]);
  // State untuk file gambar produk
  const [productFiles, setProductFiles] = useState<(File | { isOld: boolean; name: string; url: string })[]>([]);
  const [productPreviewUrls, setProductPreviewUrls] = useState<string[]>([]);

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
      let conditions: string[] = [];

      // Filter kategori
      if (filterKategori !== 'all') {
        conditions.push(`kategori = "${filterKategori}"`);
      }

      // Filter stok
      if (filterStok === 'menipis') {
        conditions.push(`stok_3 <= stok_2 && stok_3 > 0`);
      } else if (filterStok === 'habis') {
        conditions.push(`stok_3 = 0`);
      }

      // Filter pencarian
      if (searchTerm) {
        const terms = searchTerm.trim().toLowerCase().split(/\s+/);
        const searchConditions: string[] = [];
        const bindings: any = {};

        terms.forEach((term, idx) => {
          // Untuk id_lama, tambahkan juga pencarian exact match dengan nilai numerik tanpa leading zero
          const numericValue = parseInt(term, 10);
          let idCondition = `id_lama ~ {:t${idx}}`;
          if (!isNaN(numericValue)) {
            idCondition = `(id_lama ~ {:t${idx}} || id_lama = "${numericValue}")`;
          }
          searchConditions.push(`(${idCondition} || kategori ~ {:t${idx}} || merk ~ {:t${idx}} || jenis ~ {:t${idx}} || varian ~ {:t${idx}} || keterangan ~ {:t${idx}} || tipe ~ {:t${idx}})`);
          bindings[`t${idx}`] = term;
        });
        const searchFilter = pb.filter(searchConditions.join(' && '), bindings);
        if (searchFilter) conditions.push(`(${searchFilter})`);
      }

      const filterString = conditions.length ? conditions.join(' && ') : '';
      console.log("Filter Query:", filterString);

      const result = await pb.collection('produk').getList<Produk>(page, perPage, {
        sort: 'id_lama',
        filter: filterString,
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

  const sortedProducts = useMemo(() => {
    if (products.length === 0) return [];
    const sorted = [...products];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'id_lama':
          aVal = parseInt(a.id_lama, 10) || 0;
          bVal = parseInt(b.id_lama, 10) || 0;
          break;
        case 'nama':
          aVal = `${a.kategori} ${a.merk} ${a.jenis} ${a.varian} ${a.keterangan || ''} ${a.tipe || ''}`.trim().toLowerCase();
          bVal = `${b.kategori} ${b.merk} ${b.jenis} ${b.varian} ${b.keterangan || ''} ${b.tipe || ''}`.trim().toLowerCase();
          break;
        case 'stok':
          aVal = a.stok_3;
          bVal = b.stok_3;
          break;
        case 'harga_customer':
          aVal = a.sell_5;
          bVal = b.sell_5;
          break;
        case 'harga_retail':
          aVal = a.sell_6;
          bVal = b.sell_6;
          break;
        default:
          aVal = a.id_lama;
          bVal = b.id_lama;
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [products, sortField, sortOrder]);

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

  // BLOK 1: Hanya jalan 1x saat aplikasi baru dibuka untuk ambil enumlist Tipe Motor
  const hasFetchedTipe = useRef(false);
    useEffect(() => {
      if (hasFetchedTipe.current) return;
      hasFetchedTipe.current = true;
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
    }, []);

  // BLOK 2: Jalan setiap kali ganti halaman atau ketik pencarian
  useEffect(() => {
    fetchProducts();
  }, [page, searchTerm, filterKategori, filterStok]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1); 
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

const [kategoriOptions, setKategoriOptions] = useState<string[]>([]);

const hasFetchedKategori = useRef(false);
useEffect(() => {
  if (hasFetchedKategori.current) return;
  hasFetchedKategori.current = true;
  const fetchKategoriOptions = async () => {
    try {
      const records = await pb.collection('produk').getFullList({ fields: 'kategori', $autoCancel: false });
      const uniqueKategori = Array.from(new Set(records.map(r => r.kategori).filter(Boolean)));
      setKategoriOptions(uniqueKategori);
    } catch (e) { console.error(e); }
  };
  fetchKategoriOptions();
}, []);

  // Deteksi scroll untuk menyembunyikan header dan menampilkan floating button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      // Jika scroll ke bawah > 50px, sembunyikan header
      if (scrollTop > 50 && scrollTop > lastScrollTop) {
        setShowHeader(false);
        setShowFloatingAdd(true);
      } 
      // Jika scroll ke atas (mendekati top), tampilkan header
      else if (scrollTop < 30) {
        setShowHeader(true);
        setShowFloatingAdd(false);
      }
      setLastScrollTop(scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [lastScrollTop]);

// Effect untuk membuat preview URLs dari productFiles
useEffect(() => {
  if (productFiles.length === 0) {
    setProductPreviewUrls([]);
    return;
  }
  const urls = productFiles.map(f => {
    if (typeof f === 'object' && 'isOld' in f && f.isOld) {
      return f.url;
    }
    if (f instanceof File) {
      return URL.createObjectURL(f);
    }
    return '';
  }).filter(Boolean);
  setProductPreviewUrls(urls);
  
  return () => {
    urls.forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  };
}, [productFiles]);

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
    setCurrentImageIndex(0); // reset slideshow ke gambar pertama
    setLogPage(1);
    fetchLogHistory(prod.id, 1);
    setModalType('detail');
  };

  const handleOpenEdit = async (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    setSelectedProduct(prod);
    setFormData({
      ...prod,
      id_lama: formatIdLamaDisplay(prod.id_lama) 
    });
    
    // Ambil file lama (jika ada)
    const oldFiles: { isOld: boolean; name: string; url: string }[] = [];
    if (prod.file && prod.file.length > 0) {
      for (const fileName of prod.file) {
        const fileUrl = pb.files.getUrl(prod, fileName);
        oldFiles.push({
          isOld: true,
          name: fileName,
          url: fileUrl
        });
      }
    }
    setProductFiles(oldFiles);
    
    setModalType('form');
  };

  const handleOpenCopy = (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const { id, created, updated, ...restData } = prod;
    const copyData: Partial<Produk> = { ...restData };
    copyData.id_lama = generateRawRandomId();
    // Reset stok ke 0 saat membuat salinan baru
    copyData.stok_1 = 0; 
    copyData.stok_3 = 0; 
    
    setSelectedProduct(null); 
    setFormData(copyData);
    setProductFiles([]); // reset file
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

      // Buat FormData untuk mengirim file
      const formDataObj = new FormData();

      // Append semua field text/number ke FormData
      for (const key in payload) {
        if (payload.hasOwnProperty(key) && payload[key] !== undefined && key !== 'file') {
          formDataObj.append(key, String(payload[key]));
        }
      }

      // Append file
      if (productFiles && productFiles.length > 0) {
        productFiles.forEach(f => {
          if (typeof f === 'object' && 'isOld' in f && f.isOld) {
            // Pertahankan file lama
            formDataObj.append('file', f.name);
          } else if (f instanceof File) {
            // Upload file baru
            formDataObj.append('file', f);
          }
        });
      } else if (selectedProduct && selectedProduct.id) {
        // Jika tidak ada file sama sekali (user hapus semua), kirim string kosong untuk hapus
        formDataObj.append('file', '');
      }

      if (selectedProduct && selectedProduct.id) {
        // EDIT
        await pb.collection('produk').update(selectedProduct.id, formDataObj);
      } else {
        // CREATE
        let success = false;
        let attempts = 0;
        const maxAttempts = 15;
        while (!success && attempts < maxAttempts) {
          try {
            await pb.collection('produk').create(formDataObj);
            success = true;
          } catch (error: any) {
            const isUniqueError = error?.response?.data?.id_lama?.code === 'validation_not_unique' || error?.status === 400;
            if (isUniqueError) {
              // Ganti id_lama dan update FormData
              const newId = generateRawRandomId();
              formDataObj.set('id_lama', newId);
              attempts++;
            } else {
              throw error;
            }
          }
        }
        if (!success) throw new Error("Gagal mendapatkan ID unik.");
      }
      
      setModalType(null);
      setProductFiles([]); // reset file
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
    <div className={`h-full flex flex-col transition-all duration-300 ${showHeader ? 'p-8' : 'px-4 pb-4 pt-0'}`}>
      {/* Header Halaman - akan hilang saat scroll ke bawah */}
      <div 
        className={`flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-0 mb-6 sm:mb-8 shrink-0 transition-all duration-300 ${
          showHeader ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 pointer-events-none mb-0'
        }`}
        style={{ overflow: 'hidden' }}
      >
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight">Manajemen Produk</h2>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Total {totalItems} produk terdaftar</p>
        </div>
        <button 
          onClick={() => {
            setSelectedProduct(null);
            setFormData({ id_lama: generateRawRandomId() });
            setProductFiles([]);
            setModalType('form');
          }}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/30 hover:-translate-y-1 transition-all text-sm sm:text-base"
        >
          + Produk Baru
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
        
        {/* Search Bar */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex flex-col gap-3">
            {/* Baris 1: Tombol Grid/List + Input Pencarian (selalu 1 baris di semua device) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  title="Tampilan Grid"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  title="Tampilan List"
                >
                  <List size={18} />
                </button>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Cari produk..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm text-sm"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            {/* Baris 2: Filter Desktop (khusus layar >= sm) dan Tombol Filter Mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Filter untuk desktop */}
              <div className="hidden sm:flex items-center gap-3 flex-1">
                <div className="w-[25%]">
                  <select
                    value={filterKategori}
                    onChange={(e) => { setFilterKategori(e.target.value); setPage(1); }}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none shadow-sm appearance-none bg-no-repeat bg-[position:right_1rem_center] bg-[length:1.5em_1.5em]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    <option value="all">Semua Kategori</option>
                    {kategoriOptions.map(kat => (
                      <option key={kat} value={kat}>{kat}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => { setFilterStok('all'); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStok === 'all' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => { setFilterStok('menipis'); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStok === 'menipis' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Menipis
                  </button>
                  <button
                    onClick={() => { setFilterStok('habis'); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      filterStok === 'habis' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Habis
                  </button>
                </div>
              </div>

              {/* Tombol filter mobile */}
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="sm:hidden flex items-center justify-center gap-2 w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition shadow-sm"
              >
                <Filter size={18} />
                {showMobileFilters ? 'Sembunyikan Filter' : 'Tampilkan Filter'}
              </button>
            </div>

            {/* Filter mobile (tampil jika tombol ditekan) */}
            {showMobileFilters && (
              <div className="sm:hidden flex flex-col gap-3 mt-2 animate-in slide-in-from-top-2 duration-200">
                <select
                  value={filterKategori}
                  onChange={(e) => { setFilterKategori(e.target.value); setPage(1); }}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                >
                  <option value="all">Semua Kategori</option>
                  {kategoriOptions.map(kat => (
                    <option key={kat} value={kat}>{kat}</option>
                  ))}
                </select>
                <div className="flex gap-2 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  {[
                    { value: 'all', label: 'Semua' },
                    { value: 'menipis', label: 'Menipis' },
                    { value: 'habis', label: 'Habis' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setFilterStok(opt.value); setPage(1); }}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                        filterStok === opt.value ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List Grid Produk */}
        <div className="flex-1 overflow-y-auto p-6" ref={scrollContainerRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Package size={64} className="mb-4 opacity-20" />
              <p className="font-medium">Tidak ada produk ditemukan.</p>
            </div>
          ) : 
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {sortedProducts.map((prod) => (
                  <div 
                    key={prod.id} 
                    onClick={() => handleOpenDetail(prod)}
                    className="group bg-white border border-orange-200 p-5 rounded-2xl hover:border-orange-500 hover:shadow-lg hover:shadow-orange-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
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
                      <div className="text-right">
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-lg">
                          {prod.unit || '-'}
                        </span>
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
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => { if (sortField === 'id_lama') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortField('id_lama'); setSortOrder('asc'); } }}>
                        <div className="flex items-center gap-1">
                          Kode
                          {sortField === 'id_lama' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => { if (sortField === 'nama') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortField('nama'); setSortOrder('asc'); } }}>
                        <div className="flex items-center gap-1">
                          Nama Produk
                          {sortField === 'nama' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => { if (sortField === 'stok') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortField('stok'); setSortOrder('asc'); } }}>
                        <div className="flex items-center justify-end gap-1">
                          Stok
                          {sortField === 'stok' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => { if (sortField === 'harga_customer') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortField('harga_customer'); setSortOrder('asc'); } }}>
                        <div className="flex items-center justify-end gap-1">
                          Harga Pelanggan
                          {sortField === 'harga_customer' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => { if (sortField === 'harga_retail') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortField('harga_retail'); setSortOrder('asc'); } }}>
                        <div className="flex items-center justify-end gap-1">
                          Harga Retail
                          {sortField === 'harga_retail' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-600">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenDetail(prod)}>
                        <td className="py-3 px-4 font-mono text-xs">{formatIdLamaDisplay(prod.id_lama)}</td>
                        <td className="py-3 px-4 font-medium text-gray-800">
                          {`${prod.kategori} ${prod.merk} ${prod.jenis} ${prod.varian} ${prod.keterangan || ''} ${prod.tipe || ''}`.trim()}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">
                          <span className={prod.stok_3 <= 0 ? 'text-red-500' : 'text-green-600'}>
                            {prod.stok_3} {prod.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-purple-600">
                          Rp {prod.sell_5?.toLocaleString('id-ID') || 0}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-600">
                          Rp {prod.sell_6?.toLocaleString('id-ID') || 0}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center">
                            <button onClick={(e) => handleOpenEdit(prod, e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition" title="Edit">
                              <Edit size={14} />
                            </button>
                            <button onClick={(e) => handleOpenCopy(prod, e)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition" title="Copy">
                              <Copy size={14} />
                            </button>
                            <button onClick={(e) => handleOpenDelete(prod, e)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition" title="Hapus">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>

        {/* Floating Add Button (muncul saat header hilang) */}
        {showFloatingAdd && (
          <button 
            onClick={() => {
              setSelectedProduct(null);
              setFormData({ id_lama: generateRawRandomId() });
              setProductFiles([]);
              setModalType('form');
            }}
            className="fixed bottom-27 right-10 z-50 w-15 h-15 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full shadow-2xl shadow-orange-500/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        )}

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
              <div className="relative">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-orange-500 shrink-0 overflow-hidden">
                  {selectedProduct.file && selectedProduct.file.length > 0 ? (
                    <img 
                      src={pb.files.getUrl(selectedProduct, selectedProduct.file[currentImageIndex])} 
                      alt="produk" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={32} />
                  )}
                </div>
                
                {/* Tombol navigasi hanya muncul jika ada lebih dari 1 file */}
                {selectedProduct.file && selectedProduct.file.length > 1 && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 bg-black/50 rounded-full px-1 py-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(prev => (prev === 0 ? selectedProduct.file.length - 1 : prev - 1));
                      }}
                      className="w-4 h-4 text-white text-[8px] font-bold hover:bg-white/20 rounded-full flex items-center justify-center"
                    >
                      ‹
                    </button>
                    <span className="text-[8px] text-white font-bold">
                      {currentImageIndex + 1}/{selectedProduct.file.length}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(prev => (prev === selectedProduct.file.length - 1 ? 0 : prev + 1));
                      }}
                      className="w-4 h-4 text-white text-[8px] font-bold hover:bg-white/20 rounded-full flex items-center justify-center"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-orange-600 mb-1">
                  ID: {formatIdLamaDisplay(selectedProduct.id_lama)}
                </p>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {`${selectedProduct.kategori} ${selectedProduct.merk} ${selectedProduct.jenis} ${selectedProduct.varian} ${selectedProduct.keterangan || ''} ${selectedProduct.tipe || ''}`.trim()}
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    <Package size={12} />
                    Stok: {selectedProduct.stok_3 ?? 0} {selectedProduct.unit || ''}
                  </span>
                  {selectedProduct.stok_3 <= 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      Habis
                    </span>
                  )}
                  {selectedProduct.stok_3 > 0 && selectedProduct.stok_3 <= (selectedProduct.stok_2 ?? 0) && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Menipis
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-b pb-4">
              <button onClick={() => handleOpenEdit(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"><Edit size={16} /> Edit Data</button>
              <button onClick={() => handleOpenCopy(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"><Copy size={16} /> Salin</button>
              <button onClick={() => handleOpenDelete(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={16} /> Hapus</button>
            </div>

            <div>
            <div className="bg-white p-4 rounded-2xl border border-gray-200 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">Harga Beli (Modal)</span>
                <span className="text-lg font-black text-gray-800">Rp {selectedProduct.beli?.toLocaleString('id-ID') || 0}</span>
              </div>
            </div>
            <div className="overflow-hidden border border-gray-200 rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr><th className="px-4 py-3">Tier</th><th className="px-4 py-3 text-center">Minimum</th><th className="px-4 py-3 text-right">Harga</th><th className="px-4 py-3 text-right">Profit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 1 (Grosir Besar)</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_1 || 0}</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_1?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_1 ? ((selectedProduct.sell_1 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 2 (Grosir Sedang)</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_2 || 0}</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_2?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_2 ? ((selectedProduct.sell_2 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 3 (Grosir Kecil)</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_3 || 0}</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_3?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_3 ? ((selectedProduct.sell_3 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 4</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_4?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_4 ? ((selectedProduct.sell_4 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr className="bg-orange-50/30">
                  <td className="px-4 py-3 font-bold text-purple-600">Tier 5 (Pelanggan)</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                  <td className="px-4 py-3 text-right font-black text-purple-600">Rp {selectedProduct.sell_5?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_5 ? ((selectedProduct.sell_5 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr className="bg-blue-50/30">
                  <td className="px-4 py-3 font-bold text-blue-600">Tier 6 (Default Ecer)</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                  <td className="px-4 py-3 text-right font-black text-blue-600">Rp {selectedProduct.sell_6?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_6 ? ((selectedProduct.sell_6 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
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
                          onClick={() => { window.location.href = `/?ref=${log.ref_baru}`; }}
                        >
                          <td className="px-4 py-3 text-slate-500 font-medium">
                            {(() => {
                              const dateStr = log.created_at || log.created;
                              if (!dateStr) return '-';
                              const date = new Date(dateStr);
                              if (isNaN(date.getTime())) return dateStr;
                              const tanggal = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                              const waktu = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                              return (
                                <div className="flex flex-col">
                                  <span>{tanggal}</span>
                                  <span className="text-[9px] text-slate-400">{waktu}</span>
                                </div>
                              );
                            })()}
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

            {/* Lampiran Gambar */}
            {selectedProduct.file && selectedProduct.file.length > 0 && (
              <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                <p className={`font-black text-[11px] text-blue-600 uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
                  <ImagePlus size={16}/> Lampiran Gambar Produk
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedProduct.file.map((f, i) => {
                    const fileUrl = pb.files.getUrl(selectedProduct, f);
                    return (
                      <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                        {f.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video src={fileUrl} className="w-full h-full object-cover" />
                        ) : (
                          <img src={fileUrl} alt={`lampiran-${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
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
                Manajemen Stok {isReadOnly && !['5','6','7','10'].includes(userLevel) && <span className="text-[10px] text-gray-400">(Read-Only)</span>}
                {['6','7','10'].includes(userLevel) && <span className="text-[10px] text-amber-500 ml-2">(Edit hanya stok menipis)</span>}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {/* Stok Awal - level 1, 5, atau saat pembuatan baru/salinan */}
                <div>
                  <label className="text-xs font-bold text-gray-500">Stok Awal</label>
                  <input 
                    type="number" 
                    name="stok_1" 
                    disabled={!(userLevel === '1' || userLevel === '5' || !isEditMode)} 
                    value={formData.stok_1 ?? ''} 
                    onChange={handleInputChange} 
                    className={`w-full p-2 border rounded-lg outline-none ${!(userLevel === '1' || userLevel === '5' || !isEditMode) ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                  />
                </div>
                
                {/* Stok Menipis - level 1,6,7,10 bisa edit */}
                <div>
                  <label className="text-xs font-bold text-gray-500">Stok Menipis</label>
                  <input 
                    type="number" 
                    name="stok_2" 
                    disabled={!['1','6','7','10'].includes(userLevel)} 
                    value={formData.stok_2 ?? ''} 
                    onChange={handleInputChange} 
                    className={`w-full p-2 border rounded-lg outline-none font-bold ${!['1','6','7','10'].includes(userLevel) ? 'bg-gray-100 text-gray-500' : 'bg-white text-amber-700'}`}
                  />
                </div>
                
                {/* Stok Realtime - level 1, 5, atau saat pembuatan baru/salinan */}
                <div>
                  <label className="text-xs font-bold text-green-600">Stok Realtime</label>
                  <input 
                    type="number" 
                    name="stok_3" 
                    disabled={!(userLevel === '1' || userLevel === '5' || !isEditMode)} 
                    value={formData.stok_3 ?? ''} 
                    onChange={handleInputChange} 
                    className={`w-full p-2 border rounded-lg outline-none font-bold ${!(userLevel === '1' || userLevel === '5' || !isEditMode) ? 'bg-gray-100 text-gray-500' : 'bg-green-50'}`}
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
              <h4 className="font-bold text-blue-700 text-sm border-b border-blue-200 pb-2">Skema Harga (Tiering)</h4>
              <div><label className="text-xs font-bold text-gray-500">Harga Beli Dasar (Modal)</label><input type="number" name="beli" value={formData.beli ?? ''} onChange={handleInputChange} disabled={isReadOnly} className={`w-full p-2 border rounded-lg outline-none mb-4 ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-400'}`}/></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tier 1 */}
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min 1 Qty</label>
                  <input type="number" name="min_1" value={formData.min_1 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 mb-3" />
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 1</label>
                  <div className="flex items-center gap-2">
                    <input type="number" name="sell_1" value={formData.sell_1 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {formData.beli && formData.sell_1 && formData.beli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{((formData.sell_1 - formData.beli) / formData.beli * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min 2 Qty</label>
                  <input type="number" name="min_2" value={formData.min_2 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 mb-3" />
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 2</label>
                  <div className="flex items-center gap-2">
                    <input type="number" name="sell_2" value={formData.sell_2 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {formData.beli && formData.sell_2 && formData.beli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{((formData.sell_2 - formData.beli) / formData.beli * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 3 */}
                <div className="bg-white p-3 rounded-lg border">
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min 3 Qty</label>
                  <input type="number" name="min_3" value={formData.min_3 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 mb-3" />
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 3</label>
                  <div className="flex items-center gap-2">
                    <input type="number" name="sell_3" value={formData.sell_3 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {formData.beli && formData.sell_3 && formData.beli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{((formData.sell_3 - formData.beli) / formData.beli * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 4 */}
                <div className="bg-white p-3 rounded-lg border">
                  <div className="h-8"></div> {/* Spacer untuk menyamakan tinggi dengan yang punya label Min */}
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 4</label>
                  <div className="flex items-center gap-2">
                    <input type="number" name="sell_4" value={formData.sell_4 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {formData.beli && formData.sell_4 && formData.beli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{((formData.sell_4 - formData.beli) / formData.beli * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 5 (Pelanggan) - Warna ungu */}
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <div className="h-8"></div>
                  <label className="text-xs font-bold text-purple-600 block mb-1">Sell 5 (Pelanggan)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" name="sell_5" value={formData.sell_5 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-purple-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-purple-100 font-bold text-purple-700" />
                    {formData.beli && formData.sell_5 && formData.beli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{((formData.sell_5 - formData.beli) / formData.beli * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 6 (Default Ecer) - Warna biru */}
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="h-8"></div>
                  <label className="text-xs font-bold text-blue-600 block mb-1">Sell 6 (Default Ecer)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" name="sell_6" value={formData.sell_6 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 bg-blue-100 font-bold text-blue-700" />
                    {formData.beli && formData.sell_6 && formData.beli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{((formData.sell_6 - formData.beli) / formData.beli * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bagian Upload File Gambar */}
            <div className="bg-yellow-50/30 p-4 rounded-xl border border-yellow-100 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-black text-yellow-600 uppercase tracking-wider flex items-center gap-2">
                  <ImagePlus size={16} /> Gambar Produk
                </label>
                <label 
                  htmlFor="product-file-input" 
                  className="cursor-pointer text-[10px] font-black bg-white px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-yellow-200 text-yellow-600"
                >
                  + Upload
                </label>
                <input 
                  id="product-file-input"
                  type="file" 
                  multiple 
                  accept="image/*,video/*" 
                  className="hidden" 
                  onChange={e => {
                    const selectedFiles = Array.from(e.target.files || []);
                    if (selectedFiles.length > 0) {
                      setProductFiles(prev => [...prev, ...selectedFiles]);
                    }
                    e.target.value = '';
                  }} 
                />
              </div>
              {productPreviewUrls.length === 0 ? (
                <div className="text-center py-5 rounded-2xl border-2 border-dashed border-yellow-200">
                  <p className="text-[10px] font-bold text-yellow-600 opacity-70">Belum ada file gambar</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {productPreviewUrls.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-white shadow-sm aspect-square bg-white">
                      {productFiles[idx] && typeof productFiles[idx] === 'object' && 'isOld' in productFiles[idx] && productFiles[idx].isOld ? (
                        <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                      ) : (
                        productFiles[idx] instanceof File && productFiles[idx].type.startsWith('video/') ? (
                          <video src={url} className="w-full h-full object-cover opacity-80" muted />
                        ) : (
                          <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                        )
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          type="button" 
                          onClick={() => setProductFiles(prev => prev.filter((_, i) => i !== idx))} 
                          className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 shadow-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {productFiles.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-yellow-200">
                  <span className="text-[11px] font-black text-yellow-600">{productFiles.length} file terpilih</span>
                  <button
                    type="button"
                    onClick={() => setProductFiles([])}
                    className="text-[10px] font-black text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Hapus Semua
                  </button>
                </div>
              )}
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