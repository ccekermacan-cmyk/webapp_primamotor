import PocketBase, { BaseAuthStore } from 'pocketbase';
import { createRecordId } from '../lib/ids';
import { normalizeProductCode, productValidationError, stockAdjustment, isProductCodeConflict, displayProductCode } from '../lib/products';
import { createFinancialBatch } from '../services/api/financialBatch';
import { flushPendingSync } from '../services/api/laravel';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import { Package, Search, ChevronLeft, ChevronRight, X, Filter, LayoutGrid, List, Plus, AlertTriangle } from 'lucide-react';
import ProductCardGrid from '../components/produk/ProductCardGrid';
import ProductTable from '../components/produk/ProductTable';
import ProductDetailModal from '../components/produk/ProductDetailModal';
import ProductFormModal from '../components/produk/ProductFormModal';
import ProductDeleteModal from '../components/produk/ProductDeleteModal';
import ProductCopyModal from '../components/produk/ProductCopyModal';
import type { Produk } from '../types/produk';

export default function Produk() {
  const [products, setProducts] = useState<Produk[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const mutationLockRef = useRef(false);
  const productsRequestRef = useRef(0);
  const logRequestRef = useRef(0);
  const relatedRequestRef = useRef(0);
  const [logError, setLogError] = useState('');

  const [logHistory, setLogHistory] = useState<any[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  const [inputValue, setInputValue] = useState('');

  const userLevel = String(pb.authStore.record?.level || '');
  const [sortField, setSortField] = useState<'id_lama' | 'nama' | 'stok' | 'harga_customer' | 'harga_retail'>('id_lama');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Pagination & Search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(12);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKategori, setFilterKategori] = useState<string>('all');
  const [filterStok, setFilterStok] = useState<string>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ========== SCROLL HEADER & FLOATING BUTTON ==========
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [showFloatingAdd, setShowFloatingAdd] = useState(false);

  // Modal States
  const [modalType, setModalType] = useState<'detail' | 'form' | 'delete' | 'copy' | null>(null);
  const [deletePass, setDeletePass] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Produk | null>(null);
  const [formData, setFormData] = useState<Partial<Produk>>({});
  const [existingTipe, setExistingTipe] = useState<string[]>([]);
  // State untuk file gambar produk
  const [productFiles, setProductFiles] = useState<(File | { isOld: boolean; name: string; url: string })[]>([]);
  const [productPreviewUrls, setProductPreviewUrls] = useState<string[]>([]);
  const [relatedProductsList, setRelatedProductsList] = useState<Produk[]>([]);

  const [kategoriSearch, setKategoriSearch] = useState('');
  const [isKategoriDropdownOpen, setIsKategoriDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // FUNGSI PEMBANTU (HELPERS)
  // ==========================================
  const isReadOnly = false;

  const generateRawRandomId = () => {
    return String(Math.floor(Math.random() * 100000));
  };

  const formatIdLamaDisplay = (id: string | number | undefined) => {
    return displayProductCode(id);
  };

  const cleanIdLamaStorage = (id: string | number) => {
    return normalizeProductCode(id);
  };

  // ==========================================
  // FETCH DATA & PENCARIAN (REVISI MULTI-WORD)
  // ==========================================
  const fetchProducts = async () => {
    const requestId = ++productsRequestRef.current;
    try {
      setLoading(true);
      let conditions: string[] = [];

      // Filter kategori
      if (filterKategori !== 'all') {
        conditions.push(pb.filter('kategori = {:category}', {category: filterKategori}));
      }

      // Filter stok
      if (filterStok === 'menipis') {
        conditions.push(`stok_3 <= stok_2 && stok_3 > 0`);
      } else if (filterStok === 'habis') {
        conditions.push(`stok_3 <= 0`);
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
          if (/^\d+$/.test(term) && Number.isSafeInteger(numericValue)) {
            idCondition = `(id_lama ~ {:t${idx}} || id_lama = "${numericValue}")`;
          }
          searchConditions.push(`(${idCondition} || kategori ~ {:t${idx}} || merk ~ {:t${idx}} || jenis ~ {:t${idx}} || varian ~ {:t${idx}} || keterangan ~ {:t${idx}} || tipe ~ {:t${idx}})`);
          bindings[`t${idx}`] = term;
        });
        const searchFilter = pb.filter(searchConditions.join(' && '), bindings);
        if (searchFilter) conditions.push(`(${searchFilter})`);
      }

      const filterString = conditions.length ? conditions.join(' && ') : '';

      const sortMap: Record<string, string> = {
        id_lama: '+id_lama',
        nama: '+kategori,+merk,+jenis,+varian,+keterangan,+tipe',
        stok: '+stok_3',
        harga_customer: '+sell_5',
        harga_retail: '+sell_6',
      };
      const sortStr = sortOrder === 'desc' ? (sortMap[sortField] || '+id_lama').replace(/\+/g,'-') : (sortMap[sortField] || '+id_lama');

      const result = await pb.collection('produk').getList<Produk>(page, perPage, {
        sort: `${sortStr},+id`,
        filter: filterString,
        $autoCancel: false,
      });
      
      if (requestId !== productsRequestRef.current) return;
      if (page > Math.max(1, result.totalPages)) { setPage(Math.max(1, result.totalPages)); return; }
      setProducts(result.items);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
      setFetchError('');
    } catch (error: any) {
      if (requestId === productsRequestRef.current && !error.isAbort) {
        console.error("Gagal mengambil data:", error);
        setFetchError('Gagal memuat data: ' + (error.message || 'Koneksi gagal'));
      }
    } finally {
      if (requestId === productsRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsKategoriDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedProducts = useMemo(() => products, [products]);

  // Helper untuk menampilkan datetime lokal dari string ISO UTC


  const [kategoriOptions, setKategoriOptions] = useState<string[]>([]);
  const hasFetchedOptions = useRef(false);
  useEffect(() => {
    if (hasFetchedOptions.current) return;
    // Tunda background fetch opsi 800ms agar fetchProducts (tabel utama) selesai seketika
    const timer = setTimeout(() => {
      hasFetchedOptions.current = true;
      fetchDropdownOptions();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

    const fetchDropdownOptions = async () => {
      try {
        // Cache di localStorage (awet 24 jam) agar tidak mendownload 8.540 row tiap sesi baru
        const cacheKey = 'produk:options:v2';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const isFresh = parsed.timestamp && (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000);
            if (isFresh && Array.isArray(parsed.kategori) && Array.isArray(parsed.tipe)) {
              setExistingTipe(parsed.tipe);
              setKategoriOptions(parsed.kategori);
              return;
            }
          } catch { /* cache rusak, ambil ulang */ }
        }

        // Ambil paralel 9 page agar hemat waktu (~800ms vs ~2.5s serial)
        const fetchPage = async (p: number) => {
          return pb.collection('produk').getList(p, 1000, {
            fields: 'tipe,kategori',
            skipTotal: true,
            $autoCancel: false,
          });
        };
        const results = await Promise.all(Array.from({ length: 9 }, (_, i) => fetchPage(i + 1)));
        const records = results.flatMap(r => r.items);
        const allTypes = Array.from(new Set(records.flatMap(r => r.tipe?.split(',').map((s: string) => s.trim()).filter(Boolean))));
        const uniqueKategori = Array.from(new Set(records.map(r => r.kategori).filter(Boolean)));
        setExistingTipe(allTypes);
        setKategoriOptions(uniqueKategori);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            tipe: allTypes,
            kategori: uniqueKategori,
            timestamp: Date.now()
          }));
        } catch { /* storage penuh */ }
      } catch (e) {
        console.error("Gagal memuat opsi tipe/kategori", e);
      }
    };

  // Jalan setiap kali ganti halaman atau ketik pencarian
  useEffect(() => {
    fetchProducts();
  }, [page, searchTerm, filterKategori, filterStok, sortField, sortOrder, perPage]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1); 
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [perPage]);

  // Dynamic perPage based on screen width (3 rows × columns)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const cols = w < 640 ? 2 : w < 768 ? 3 : w < 1024 ? 4 : w < 1280 ? 5 : 6;
      setPerPage(cols * 6);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let prevScrollTop = 0;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      if (scrollTop > 50 && scrollTop > prevScrollTop) {
        setShowHeader(false);
        setShowFloatingAdd(true);
      } else if (scrollTop < 30) {
        setShowHeader(true);
        setShowFloatingAdd(false);
      }
      prevScrollTop = scrollTop;
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
  const requestId = ++logRequestRef.current;
  setLogHistory([]);
  setLogError('');
  try {
    const filterString = pb.filter('item_baru = {:id}', { id: prodId });
    
    const result = await pb.collection('log_stock').getList(pageNum, 5, {
      filter: filterString, 
      sort: '-created_at', // REVISI: Sesuaikan dengan nama kolom di DB Anda
      $autoCancel: false
    });
    
    if (requestId !== logRequestRef.current) return;
    setLogHistory(result.items);
    setLogTotalPages(result.totalPages);
  } catch (e) {
    if (requestId === logRequestRef.current) setLogError("Riwayat stok belum dapat dimuat.");
  }
};

const fetchRelatedProducts = async (sp: Produk) => {
  const requestId = ++relatedRequestRef.current;
  try {
    setRelatedProductsList([]); // Clear previous
    let records: Produk[] = [];
    
    // Optimasi: Jika punya kategori, ambil produk dengan kategori yang sama (atau memuat string serupa)
    // Jika tidak, ambil full list. getFullList PocketBase sangat cepat untuk < 10k data
    if (sp.kategori) {
      records = await pb.collection('produk').getFullList<Produk>({
        filter: pb.filter('kategori ~ {:kat}', { kat: sp.kategori }),
        $autoCancel: false,
      });
    } else {
      return;
    }

    const levenshteinDistance = (a: string, b: string) => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
          }
        }
      }
      return matrix[b.length][a.length];
    };

    const checkMatch = (str1?: string, str2?: string) => {
      if (!str1 || !str2) return { match: false, exact: false };
      const s1 = str1.toString().toLowerCase().trim();
      const s2 = str2.toString().toLowerCase().trim();
      if (s1 === '' || s2 === '') return { match: false, exact: false };
      
      const norm1 = s1.replace(/[^a-z0-9]/g, '').replace(/x/g, '');
      const norm2 = s2.replace(/[^a-z0-9]/g, '').replace(/x/g, '');
      if (norm1 !== '' && norm2 !== '' && (norm1.includes(norm2) || norm2.includes(norm1))) {
        return { match: true, exact: true };
      }
      
      const words1 = s1.split(/[\s,.\/-]+/).filter(w => w.length > 2);
      const words2 = s2.split(/[\s,.\/-]+/).filter(w => w.length > 2);
      
      for (const w1 of words1) {
        for (const w2 of words2) {
          const maxTypos = Math.max(w1.length, w2.length) >= 5 ? 2 : 1;
          if (levenshteinDistance(w1, w2) <= maxTypos) {
            return { match: true, exact: false };
          }
        }
      }
      return { match: false, exact: false };
    };

    const related = records
      .filter(p => p.id !== sp.id)
      .map(p => {
        const matchKategori = sp.kategori ? checkMatch(p.kategori, sp.kategori).match : true;
        const resJenis = checkMatch(p.jenis, sp.jenis);
        const resVarian = checkMatch(p.varian, sp.varian);
        const resKet = checkMatch(p.keterangan, sp.keterangan);
        const resTipe = checkMatch(p.tipe, sp.tipe);
        const resMerk = checkMatch(p.merk, sp.merk);
        
        const hasStrongMatch = resJenis.match || resVarian.match || resKet.match || resTipe.match;
        const isFallbackMatch = matchKategori && resMerk.match;
        
        const isValid = (matchKategori && hasStrongMatch) || isFallbackMatch;

        const exactBonus = (resTipe.exact ? 5 : 0) + (resJenis.exact ? 2 : 0) + (resVarian.exact ? 2 : 0) + (resKet.exact ? 2 : 0);
        const score = (resTipe.match ? 20 : 0) + (resJenis.match ? 5 : 0) + (resVarian.match ? 4 : 0) + (resKet.match ? 3 : 0) + exactBonus + (isFallbackMatch && !hasStrongMatch ? 1 : 0);
        
        return { prod: p, isValid, score };
      })
      .filter(p => p.isValid)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => p.prod);

    if (requestId === relatedRequestRef.current) setRelatedProductsList(related);
  } catch (e) {
    console.error("Gagal memuat produk terkait:", e);
  }
};

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleOpenDetail = (prod: Produk) => {
    setSelectedProduct(prod);
    setCurrentImageIndex(0); // reset slideshow ke gambar pertama
    setLogPage(1);
    // Buka modal dulu, data pendukung (riwayat & terkait) diambil di background
    setModalType('detail');
    fetchLogHistory(prod.id, 1);
    fetchRelatedProducts(prod);
  };

  const handleOpenEdit = async (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    setSelectedProduct(prod);
    
    // Buat salinan produk dengan default numerik
    const formDataCopy: Partial<Produk> = { ...prod };
    
    // Pastikan field numerik punya nilai default 0 jika undefined/null
    const numericFields = ['beli', 'sell_1', 'sell_2', 'sell_3', 'sell_4', 'sell_5', 'sell_6', 'min_1', 'min_2', 'min_3', 'stok_1', 'stok_2', 'stok_3'];
    numericFields.forEach(field => {
      if (formDataCopy[field as keyof Produk] === undefined || formDataCopy[field as keyof Produk] === null) {
        formDataCopy[field as keyof Produk] = 0 as any;
      }
    });
    
    // id_lama diambil asli (tanpa padding)
    formDataCopy.id_lama = prod.id_lama; 
    
    setFormData(formDataCopy);
    
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
    setSelectedProduct(prod);
    setModalType('copy'); // Buka dialog konfirmasi terlebih dahulu
  };

  const executeCopy = () => {
    if (!selectedProduct) return;
    const { id, created, updated, ...restData } = selectedProduct;
    const copyData: Partial<Produk> = { ...restData };
    copyData.id_lama = generateRawRandomId();
    // Reset stok ke 0 saat membuat salinan baru
    copyData.stok_1 = 0; 
    copyData.stok_3 = 0;
    
    setSelectedProduct(null); 
    setFormData(copyData);
    setProductFiles([]); // reset file
    setModalType('form'); // Lanjut buka form setelah dikonfirmasi
  };

  const handleOpenDelete = (prod: Produk, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(prod);
    setDeletePass('');
    setDeleteError('');
    setModalType('delete');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    if (!selectedProduct || mutationLockRef.current || userLevel !== '1') return;
    if (!deletePass) { setDeleteError('Password wajib diisi'); return; }
    setIsProcessing(true);
    setDeleteError('');
    mutationLockRef.current = true;
    try {
      const email = pb.authStore.model?.email || localStorage.getItem('user_email') || '';
      const username = pb.authStore.model?.username || localStorage.getItem('user_username') || '';
      const identity = email || username;
      if (identity) await new PocketBase(pb.baseURL, new BaseAuthStore()).collection('user').authWithPassword(identity, deletePass);
      else throw new Error('no identity');
    } catch {
      setDeleteError('Verifikasi gagal. Periksa password dan koneksi.');
      setDeletePass('');
      mutationLockRef.current = false;
      setIsProcessing(false);
      return;
    }
    try {
      await flushPendingSync();
      // Eksekusi Hapus Produk via PocketBase Atomic Batch
      const batch = createFinancialBatch();
      batch.collection('produk').delete(selectedProduct.id);
      await batch.send();


      setModalType(null);
      setDeletePass('');
      fetchProducts(); 
    } catch (error: any) {
      alert("Gagal menghapus: " + (error.message || 'Koneksi gagal'));
    } finally {
      mutationLockRef.current = false;
      setIsProcessing(false);
    }
  };

  // Helper Penyesuaian Stok Cepat Atomic Batch (+ / - stok_3)
  const handleQuickStockChange = async (prod: Produk, delta: number) => {
    if (mutationLockRef.current || ![-1,1].includes(delta)) return;
    mutationLockRef.current = true;
    setIsProcessing(true);
    try {
      await flushPendingSync();
      const current = await pb.collection('produk').getOne<Produk>(prod.id, {$autoCancel:false});
      if (Number(current.stok_3) + delta < 0) throw new Error('Stok tidak cukup.');
      const batch = createFinancialBatch();
      batch.collection('log_stock').create({
        created_at: new Date().toISOString(), operator: pb.authStore.record?.name || pb.authStore.record?.username || 'Admin',
        item: current.id_lama || current.id, item_baru: current.id, qty: Math.abs(delta), boolean: delta > 0 ? 'in' : 'out',
        price_1: 0, price_2: 0, normal: 0,
      });
      await batch.send();
      await fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Penyesuaian stok gagal.');
    } finally {
      mutationLockRef.current = false;
      setIsProcessing(false);
    }
  };

  // ==========================================
  // CRUD ACTIONS
  // ==========================================
  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mutationLockRef.current) return;
    const validationError = productValidationError(formData);
    if (validationError) { alert(validationError); return; }

    // 🟢 VALIDASI SAFETY GUARD
    const required = [
      { key: 'kategori', label: 'Kategori' },
      { key: 'merk', label: 'Merk' },
      { key: 'sell_6', label: 'Harga Retail (Sell 6)' },
      { key: 'unit', label: 'Unit' }
    ];

    for (const field of required) {
      if (!formData[field.key as keyof Produk] || formData[field.key as keyof Produk] === '') {
        alert(`${field.label} tidak boleh kosong!!`);
        return;
      }
    }

    mutationLockRef.current = true;
    setIsProcessing(true);
    try {
      let payload = { ...formData };

      // Hapus field yang dikontrol PB dari payload agar tidak konflik
      delete payload.id;
      delete payload.created;
      delete payload.updated;
      delete payload.file; // File dihandle via FormData secara manual
      delete payload.collectionId;
      delete payload.collectionName;
      delete payload.expand;

      const numericFields = ['beli', 'sell_1', 'sell_2', 'sell_3', 'sell_4', 'sell_5', 'sell_6', 'min_1', 'min_2', 'min_3', 'stok_1', 'stok_2', 'stok_3'];

      // Pastikan field numerik valid
      numericFields.forEach(field => {
        if (payload[field as keyof Produk] === undefined || payload[field as keyof Produk] === null || payload[field as keyof Produk] === '') {
          payload[field as keyof Produk] = 0 as any;
        } else {
          payload[field as keyof Produk] = Number(payload[field as keyof Produk]) as any;
        }
      });

      // Pastikan field string ada dan bersih
      const stringFields = ['kategori', 'merk', 'jenis', 'varian', 'keterangan', 'tipe', 'unit'];
      stringFields.forEach(field => {
        if (payload[field as keyof Produk] === undefined || payload[field as keyof Produk] === null) {
          payload[field as keyof Produk] = '' as any;
        }
      });

      // Set ID Lama
      if (isEditMode) {
        payload.id_lama = selectedProduct?.id_lama || payload.id_lama;
      } else {
        payload.id_lama = payload.id_lama ? cleanIdLamaStorage(payload.id_lama) : generateRawRandomId();
      }

      // Format tipe menjadi string unik yang rapi
      if (typeof payload.tipe === 'string') {
        const tipeArray = payload.tipe.split(',').map(s => s.trim()).filter(Boolean);
        payload.tipe = Array.from(new Set(tipeArray)).sort().join(', ');
      }

      // 🟢 PEMBUATAN FORMDATA UNTUK POCKETBASE 🟢
      const formDataObj = new FormData();
      
      // 1. Masukkan semua key value biasa
      for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          if (isEditMode && selectedProduct && String(payload[key] ?? '') === String(selectedProduct[key] ?? '')) continue;
          formDataObj.append(key, String(payload[key]));
        }
      }

      // 2. Tentukan status File
      const oldFilesToKeep = productFiles.filter(f => typeof f === 'object' && 'isOld' in f).map((f: any) => f.name);
      const newFilesToUpload = productFiles.filter(f => f instanceof File);

      if (isEditMode && selectedProduct) {
        const originalFiles = selectedProduct.file || [];
        const filesToDelete = originalFiles.filter(fName => !oldFilesToKeep.includes(fName));
        filesToDelete.forEach((deletedFileName) => {
          const idx = originalFiles.indexOf(deletedFileName);
          if (idx !== -1) {
            formDataObj.append("file-", deletedFileName);
          }
        });
      }

      if (newFilesToUpload.length > 0) {
        newFilesToUpload.forEach((f) => {
          formDataObj.append(isEditMode ? 'file+' : 'file', f as File);
        });
      }

      const oldStok = isEditMode && selectedProduct ? Number(selectedProduct.stok_3 || 0) : 0;
      const newStok = Number(payload.stok_3 || 0);
      let stockDiff = newStok - oldStok;
      const operatorName = pb.authStore.model?.name || pb.authStore.model?.username || 'Admin';
      const timestamp = new Date().toISOString();

      await flushPendingSync();
      if (isEditMode && selectedProduct) {
        const current = await pb.collection('produk').getOne<Produk>(selectedProduct.id, {$autoCancel:false});
        stockDiff = stockAdjustment(oldStok, newStok, Number(current.stok_3));
      }
      formDataObj.delete('stok_3');
      if (!isEditMode) formDataObj.set('stok_3', '0');
      // 🟢 EKSEKUSI API VIA POCKETBASE ATOMIC BATCH
      if (isEditMode && selectedProduct) {
        const batch = createFinancialBatch();
        batch.collection('produk').update(selectedProduct.id, formDataObj);

        // INCREMENTAL DIFF LOG STOK: Jika stok berubah saat edit, queue pencatatan log_stock
        if (stockDiff !== 0) {
          batch.collection('log_stock').create({
            expected_stock: oldStok,
            id_lama: '',
            created_at: timestamp,
            operator: operatorName,
            item: selectedProduct.id_lama || selectedProduct.id || '',
            item_baru: selectedProduct.id,
            qty: Math.abs(stockDiff),
            boolean: stockDiff > 0 ? 'in' : 'out',
            price_1: 0,
            price_2: 0,
            normal: 0,
          });
        }

        await batch.send([], () => setModalType(null));

      } else {
        const productId = createRecordId();
        formDataObj.set('id', productId);
        const batch = createFinancialBatch();
        batch.collection('produk').create(formDataObj);
        if (newStok > 0) batch.collection('log_stock').create({
          created_at: timestamp, operator: operatorName, item: String(formDataObj.get('id_lama') || ''),
          item_baru: productId, qty: newStok, boolean: 'in', price_1: 0, price_2: 0, normal: 0,
        });
        await batch.send([], () => setModalType(null));
      }
      
      // Jika berhasil
      setModalType(null);
      setProductFiles([]); // reset file state
      fetchProducts(); // Refresh list grid
      fetchDropdownOptions();
      
    } catch (error: any) {
      const errorMsg = isProductCodeConflict(error) ? 'Kode produk sudah digunakan. Pilih kode lain; produk belum disimpan.' : error?.response?.data?.message
        || error?.message 
        || "Gagal menyimpan data. Kemungkinan koneksi internet terputus atau server mati.";
      alert(`GAGAL: ${errorMsg}`);
    } finally {
      mutationLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const isEditMode = !!(selectedProduct && selectedProduct.id);

  return (
    <div className={`absolute inset-0 flex flex-col transition-all duration-300 ${showHeader ? 'p-4 sm:p-6 lg:p-8 pt-16 md:pt-8' : 'px-4 pb-4 pt-16 md:pt-0'}`}>
      {/* Header Halaman - akan hilang saat scroll ke bawah */}
      <div 
        className={`flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 sm:gap-0 mb-3 sm:mb-8 transition-all duration-300 ${
          showHeader ? '' : 'h-0 overflow-hidden mb-0 opacity-0'
        }`}
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
          className="hidden sm:inline-flex bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/30 hover:-translate-y-1 transition-all text-sm sm:text-base"
        >
          + Produk Baru
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex-1 flex flex-col overflow-hidden relative">
        
        {/* Search Bar */}
        <div className="p-3 sm:p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
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
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`sm:hidden p-3 rounded-xl border transition-all ${showMobileFilters ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >
                <Filter size={18} />
              </button>
            </div>

            {/* Baris 2: Filter Desktop (khusus layar >= sm) dan Tombol Filter Mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Filter untuk desktop */}
              <div className="hidden sm:flex items-center gap-3 flex-1">
                <div ref={categoryDropdownRef} className="w-[25%] relative">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari kategori..."
                      value={kategoriSearch}
                      onChange={(e) => {
                        setKategoriSearch(e.target.value);
                        setIsKategoriDropdownOpen(true);
                      }}
                      onFocus={() => setIsKategoriDropdownOpen(true)}
                      className="w-full pl-9 pr-8 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                    />
                    {filterKategori !== 'all' && (
                      <button
                        onClick={() => {
                          setFilterKategori('all');
                          setKategoriSearch('');
                          setPage(1);
                          setIsKategoriDropdownOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {isKategoriDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div
                        className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-orange-50 cursor-pointer"
                        onClick={() => {
                          setFilterKategori('all');
                          setKategoriSearch('');
                          setPage(1);
                          setIsKategoriDropdownOpen(false);
                        }}
                      >
                        Semua Kategori
                      </div>
                      {kategoriOptions
                        .filter(k => k.toLowerCase().includes(kategoriSearch.toLowerCase()))
                        .map(kat => (
                          <div
                            key={kat}
                            className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-orange-50 cursor-pointer"
                            onClick={() => {
                              setFilterKategori(kat);
                              setKategoriSearch(kat);
                              setPage(1);
                              setIsKategoriDropdownOpen(false);
                            }}
                          >
                            {kat}
                          </div>
                        ))}
                    </div>
                  )}
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

            </div>

            {/* Filter mobile (tampil jika tombol ditekan) */}
            {showMobileFilters && (
              <div className="sm:hidden flex flex-col gap-3 mt-2 animate-in slide-in-from-top-2 duration-200">
                <div className="relative w-full">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari kategori..."
                      onChange={(e) => {
                        setKategoriSearch(e.target.value);
                        setIsKategoriDropdownOpen(true);
                      }}
                      onFocus={() => setIsKategoriDropdownOpen(true)}
                      className="w-full pl-9 pr-8 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                    />
                    {filterKategori !== 'all' && (
                      <button
                        onClick={() => {
                          setFilterKategori('all');
                          setKategoriSearch('');
                          setPage(1);
                          setIsKategoriDropdownOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {isKategoriDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div
                        className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-orange-50 cursor-pointer"
                        onClick={() => {
                          setFilterKategori('all');
                          setKategoriSearch('');
                          setPage(1);
                          setIsKategoriDropdownOpen(false);
                        }}
                      >
                        Semua Kategori
                      </div>
                      {kategoriOptions
                        .filter(k => k.toLowerCase().includes(kategoriSearch.toLowerCase()))
                        .map(kat => (
                          <div
                            key={kat}
                            className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-orange-50 cursor-pointer"
                            onClick={() => {
                              setFilterKategori(kat);
                              setKategoriSearch(kat);
                              setPage(1);
                              setIsKategoriDropdownOpen(false);
                            }}
                          >
                            {kat}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
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

        {fetchError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-center gap-2 mx-6 mt-4">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            {fetchError}
            <button onClick={()=>{setFetchError('');fetchProducts();}} className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-[10px] font-black uppercase">Retry</button>
          </div>
        )}

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
              <ProductCardGrid
                products={sortedProducts}
                userLevel={userLevel}
                isProcessing={isProcessing}
                onOpenDetail={handleOpenDetail}
                onOpenEdit={handleOpenEdit}
                onOpenCopy={handleOpenCopy}
                onOpenDelete={handleOpenDelete}
                onQuickStockChange={handleQuickStockChange}
              />
            ) : (
              <ProductTable
                products={sortedProducts}
                userLevel={userLevel}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={(field) => {
                  if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortField(field); setSortOrder('asc'); }
                }}
                onOpenDetail={handleOpenDetail}
                onOpenEdit={handleOpenEdit}
                onOpenCopy={handleOpenCopy}
                onOpenDelete={handleOpenDelete}
              />
            )}
        </div>

        {/* Floating Add Button (selalu tampil di mobile, di desktop hanya saat scroll) */}
        <button 
          onClick={() => {
            setSelectedProduct(null);
            setFormData({ id_lama: generateRawRandomId() });
            setProductFiles([]);
            setModalType('form');
          }}
          className={`fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full shadow-2xl shadow-orange-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 sm:hidden ${showFloatingAdd ? 'sm:flex' : 'sm:hidden'}`}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>

        {/* Pagination */}
        <div className="sticky bottom-0 z-30 p-2.5 sm:p-4 border-t border-gray-100 bg-white flex justify-between items-center shrink-0 rounded-b-3xl shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)]">
          <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Hal <span className="font-bold">{page}</span>/<span className="font-bold">{totalPages || 1}</span></p>
          <div className="flex gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-1.5 sm:p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={18} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0 || loading} className="p-1.5 sm:p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. MODAL DETAIL PRODUK */}
      {/* ========================================================= */}
      <ProductDetailModal
        isOpen={modalType === 'detail'}
        onClose={() => setModalType(null)}
        selectedProduct={selectedProduct}
        currentImageIndex={currentImageIndex}
        setCurrentImageIndex={setCurrentImageIndex}
        isCopied={isCopied}
        setIsCopied={setIsCopied}
        userLevel={userLevel}
        formatIdLamaDisplay={formatIdLamaDisplay}
        handleOpenEdit={handleOpenEdit}
        handleOpenCopy={handleOpenCopy}
        handleOpenDelete={handleOpenDelete}
        handleOpenDetail={handleOpenDetail}
        logHistory={logHistory}
        logPage={logPage}
        logTotalPages={logTotalPages}
        logError={logError}
        fetchLogHistory={fetchLogHistory}
        setLogPage={setLogPage}
        relatedProductsList={relatedProductsList}
      />
      {/* ========================================================= */}
      {/* 2. MODAL FORM (TAMBAH / EDIT / COPY) */}
      {/* ========================================================= */}
      <ProductFormModal
        isOpen={modalType === 'form'}
        isEditMode={isEditMode}
        isReadOnly={isReadOnly}
        isProcessing={isProcessing}
        formData={formData}
        setFormData={setFormData}
        handleInputChange={handleInputChange}
        inputValue={inputValue}
        setInputValue={setInputValue}
        existingTipe={existingTipe}
        productFiles={productFiles}
        setProductFiles={setProductFiles}
        productPreviewUrls={productPreviewUrls}
        onClose={() => { if (!mutationLockRef.current) setModalType(null); }}
        onSubmit={submitForm}
      />
      {/* ========================================================= */}
      {/* 3. MODAL HAPUS */}
      {/* ========================================================= */}
      <ProductDeleteModal
        isOpen={modalType === 'delete'}
        selectedProduct={selectedProduct}
        deletePass={deletePass}
        deleteError={deleteError}
        isProcessing={isProcessing}
        onClose={() => { setModalType(null); setDeletePass(''); setDeleteError(''); }}
        onDeletePassChange={val => { setDeletePass(val); setDeleteError(''); }}
        onSubmit={submitDelete}
      />

      {/* ========================================================= */}
      {/* 4. MODAL KONFIRMASI COPY */}
      {/* ========================================================= */}
      <ProductCopyModal
        isOpen={modalType === 'copy'}
        selectedProduct={selectedProduct}
        onClose={() => setModalType(null)}
        onConfirm={executeCopy}
      />
      
    </div>
  );
}