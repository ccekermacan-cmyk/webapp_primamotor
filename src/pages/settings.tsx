import React, { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  Check, 
  AlertTriangle, 
  Info, 
  Search, 
  FolderTree,
  Layers,
  Tag,
  Phone,
  MapPin,
  Sliders,
  Shield
} from 'lucide-react';

interface DropdownData {
  id: string;
  id_lama: string;
  kategori: string;
  jenis: string;
  text_1: string;
  text_2: string;
  text_3: string;
  text_4: string;
  text_5: string;
  text_6: string;
  text_7: string;
  text_8: string;
  text_9: string;
  text_10: string;
  number_1: number;
  number_2: number;
  number_3: number;
  number_4: number;
  number_5: number;
  phone: number;
  image: string;
  link_image: string;
  doc: string;
  address: string;
  latlong: string;
  enum_1: any;
  enum_2: any;
  enum_3: any;
  enum_4: any;
  visibilitas: any;
  operator: string;
}

export default function Settings() {
  const [data, setData] = useState<DropdownData[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<'form' | 'detail' | 'delete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<DropdownData | null>(null);
  const [formData, setFormData] = useState<Partial<DropdownData>>({});
  const [formTab, setFormTab] = useState<'basic' | 'extra' | 'access'>('basic');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Tab Jenis Aktif
  const [activeJenisTab, setActiveJenisTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [kategoriSearch, setKategoriSearch] = useState('');
  const [jenisSearch, setJenisSearch] = useState('');
  const [isKategoriOpen, setIsKategoriOpen] = useState(false);
  const [isJenisOpen, setIsJenisOpen] = useState(false);

  // Dialog State
  const [dialog, setDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
  }>({ show: false, title: '', message: '', type: 'alert' });

  useEffect(() => {
    const level = localStorage.getItem('user_level');
    if (!level || level === 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  // Fetch user untuk Enum
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await pb.collection('user').getFullList({ $autoCancel: false });
        setAllUsers(users);
      } catch (e) {
        console.error("Gagal memuat data pengguna:", e);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      setLoading(true);
      const records = await pb.collection('dropdown').getFullList<DropdownData>({
        sort: 'jenis,kategori,text_1',
        $autoCancel: false
      });
      setData(records);
    } catch (error) {
      console.error("Gagal load dropdown:", error);
    } finally {
      setLoading(false);
    }
  };

  const levelUserOptions = [
    { label: 'Level 1 (Super Admin)', value: 1 },
    { label: 'Level 2 (Admin)', value: 2 },
    { label: 'Level 3 (Manager)', value: 3 },
    { label: 'Level 4 (Supervisor)', value: 4 },
    { label: 'Level 5 (Kasir)', value: 5 },
    { label: 'Level 6 (Staff)', value: 6 },
    { label: 'Level 7 (Mekanik)', value: 7 },
    { label: 'Level 10 (Mekanik Senior)', value: 10 },
  ];

  // Daftar unik jenis untuk Pill Navigation Tabs
  const uniqueJenisList = useMemo(() => {
    const set = new Set(data.map(d => d.jenis).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const filteredKategoris = useMemo(() =>
    [...new Set(data.map(d => d.kategori))].filter(k => k && k.toLowerCase().includes(kategoriSearch.toLowerCase())),
    [data, kategoriSearch]
  );

  const filteredJenis = useMemo(() =>
    [...new Set(data.filter(d => !formData.kategori || d.kategori === formData.kategori).map(d => d.jenis))].filter(j => j && j.toLowerCase().includes(jenisSearch.toLowerCase())),
    [data, formData.kategori, jenisSearch]
  );

  // Grouping Data berdasarkan Section JENIS
  const groupedByJenis = useMemo(() => {
    const groups: { [jenis: string]: { [kategori: string]: DropdownData[] } } = {};

    const filteredData = data.filter(item => {
      const matchesSearch = 
        (item.jenis || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.kategori || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.text_1 || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesJenisTab = activeJenisTab === 'all' || item.jenis === activeJenisTab;

      return matchesSearch && matchesJenisTab;
    });

    filteredData.forEach(item => {
      const j = item.jenis || 'Lainnya';
      const k = item.kategori || 'Umum';
      if (!groups[j]) groups[j] = {};
      if (!groups[j][k]) groups[j][k] = [];
      groups[j][k].push(item);
    });

    return groups;
  }, [data, searchQuery, activeJenisTab]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.startsWith('number_') || name === 'phone' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const openAddModal = (presetJenis = '', presetKategori = '') => {
    setSelectedItem(null);
    setFormData({
      jenis: presetJenis,
      kategori: presetKategori,
      number_1: 0,
      number_2: 0,
      number_3: 0,
      number_4: 0,
      number_5: 0,
      phone: 0,
      enum_1: [],
      enum_2: [],
      enum_3: [],
      enum_4: [],
      visibilitas: [],
    });
    setFormTab('basic');
    setModalType('form');
  };

  const openEditModal = (item: DropdownData) => {
    setSelectedItem(item);
    const parseEnum = (val: any) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim());
      return [];
    };

    setFormData({
      ...item,
      enum_1: parseEnum(item.enum_1),
      enum_2: parseEnum(item.enum_2).map(Number).filter(n => !isNaN(n)),
      enum_3: parseEnum(item.enum_3).map(Number).filter(n => !isNaN(n)),
      enum_4: parseEnum(item.enum_4),
      visibilitas: parseEnum(item.visibilitas).map(Number).filter(n => !isNaN(n)),
    });
    setFormTab('basic');
    setModalType('form');
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const formatEnum = (val: any) => {
        if (Array.isArray(val)) return val.join(',');
        return val || '';
      };

      const payload = {
        kategori: formData.kategori || '',
        jenis: formData.jenis || '',
        text_1: formData.text_1 || '',
        text_2: formData.text_2 || '',
        text_3: formData.text_3 || '',
        text_4: formData.text_4 || '',
        text_5: formData.text_5 || '',
        text_6: formData.text_6 || '',
        text_7: formData.text_7 || '',
        text_8: formData.text_8 || '',
        text_9: formData.text_9 || '',
        text_10: formData.text_10 || '',
        number_1: Number(formData.number_1 || 0),
        number_2: Number(formData.number_2 || 0),
        number_3: Number(formData.number_3 || 0),
        number_4: Number(formData.number_4 || 0),
        number_5: Number(formData.number_5 || 0),
        phone: Number(formData.phone || 0),
        image: formData.image || '',
        link_image: formData.link_image || '',
        doc: formData.doc || '',
        address: formData.address || '',
        latlong: formData.latlong || '',
        enum_1: formatEnum(formData.enum_1),
        enum_2: formatEnum(formData.enum_2),
        enum_3: formatEnum(formData.enum_3),
        enum_4: formatEnum(formData.enum_4),
        visibilitas: formatEnum(formData.visibilitas),
        operator: pb.authStore.model?.username || 'Admin'
      };

      if (selectedItem?.id && modalType === 'form') {
        await pb.collection('dropdown').update(selectedItem.id, payload);
      } else {
        await pb.collection('dropdown').create(payload);
      }

      setModalType(null);
      await fetchDropdowns();

      setDialog({
        show: true,
        title: "Tersimpan",
        message: "Data master berhasil diperbarui di PocketBase.",
        type: 'alert'
      });

    } catch (error: any) {
      console.error("Gagal simpan dropdown:", error);
      setDialog({
        show: true,
        title: "Gagal Menyimpan",
        message: `Kendala: ${error.message || 'Bad Request (400)'}`,
        type: 'alert'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDelete = async () => {
    if (!selectedItem) return;
    setIsProcessing(true);
    try {
      await pb.collection('dropdown').delete(selectedItem.id);
      setModalType(null);
      await fetchDropdowns();

      setDialog({
        show: true,
        title: "Berhasil Dihapus",
        message: "Data master telah dihapus dari PocketBase.",
        type: 'alert'
      });
    } catch (error: any) {
      setDialog({
        show: true,
        title: "Gagal Menghapus",
        message: `Kendala: ${error.message}`,
        type: 'alert'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper Field Wrapper
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block text-xs font-semibold text-slate-500 mb-1 space-y-1">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );

  // Helper Multi-Select Enum
  const BeautifulEnumList = ({ label, options, selectedValues, gridCols = 'grid-cols-2', onChange }: {
    label: string;
    options: { label: string; value: any }[];
    selectedValues: any[];
    gridCols?: string;
    onChange: (updated: any[]) => void
  }) => {
    const currentList = Array.isArray(selectedValues) ? selectedValues : [];

    const toggleSelection = (val: any) => {
      if (currentList.includes(val)) {
        onChange(currentList.filter(item => item !== val));
      } else {
        onChange([...currentList, val]);
      }
    };

    return (
      <div className="space-y-1.5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`border border-slate-200 bg-slate-50 rounded-2xl p-3 max-h-36 overflow-y-auto grid ${gridCols} gap-2 custom-scrollbar`}>
          {options.map(opt => {
            const isChecked = currentList.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleSelection(opt.value)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold text-xs transition-all ${
                  isChecked
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isChecked && <Check size={12} strokeWidth={3} className="shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 md:pt-8 w-full pb-16 font-sans">
      
      {/* HEADER UTAMA */}
      <div className="flex items-center justify-between gap-4 mb-6 w-full">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="h-6 w-6 text-indigo-600 shrink-0" />
            Settings Master Data
          </h1>
        </div>

        {/* BUTTON DESKTOP */}
        <button 
          onClick={() => openAddModal()}
          className="hidden md:inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Master Data
        </button>
      </div>

      {/* FLOATING ACTION BUTTON DI SMARTPHONE (z-30 agar TIDAK MENUTUPI MODAL z-[100]) */}
      <button 
        onClick={() => openAddModal()}
        className="md:hidden fixed bottom-6 right-6 z-30 inline-flex items-center justify-center gap-2 rounded-full p-4 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-400/50 transition-all cursor-pointer"
        title="Tambah Master Data"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* HORIZONTAL PILL TAB NAVIGATION BY JENIS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 custom-scrollbar w-full">
        <button
          type="button"
          onClick={() => setActiveJenisTab('all')}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold border transition-colors cursor-pointer ${
            activeJenisTab === 'all'
              ? 'bg-indigo-600 text-white border-transparent shadow-sm'
              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" />
          Semua Jenis ({data.length})
        </button>

        {uniqueJenisList.map(j => {
          const count = data.filter(d => d.jenis === j).length;
          const active = activeJenisTab === j;
          return (
            <button
              key={j}
              type="button"
              onClick={() => setActiveJenisTab(j)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold border transition-colors uppercase tracking-wider cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white border-transparent shadow-sm'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              {j} ({count})
            </button>
          );
        })}
      </div>

      {/* SEARCH BAR */}
      <div className="mb-6 w-full">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Cari jenis, kategori, atau label master data..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-xs shadow-xs transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* SECTION CARDS CONTAINER BY JENIS */}
      <div className="space-y-6 w-full">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs w-full">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat Data Master...
          </div>
        ) : Object.keys(groupedByJenis).length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400 font-bold text-xs w-full">
            Tidak ada data master.
          </div>
        ) : (
          Object.entries(groupedByJenis).map(([jenis, kategoriGroup]) => {
            const totalJenisItems = Object.values(kategoriGroup).reduce((acc, curr) => acc + curr.length, 0);
            return (
              <section 
                key={jenis} 
                className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6 space-y-4 shadow-xs transition-all hover:border-slate-300 w-full"
              >
                {/* CARD HEADER SECTION BY JENIS */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 w-full">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base uppercase tracking-wide">
                    <FolderTree className="h-4 w-4 text-indigo-600 shrink-0" />
                    {jenis}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
                      {totalJenisItems} Item
                    </span>
                    <button
                      onClick={() => openAddModal(jenis)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                      title={`Tambah item di ${jenis}`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* KATEGORI SUB-GROUPS RESPONSIVE GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full pt-1">
                  {Object.entries(kategoriGroup).map(([kategori, items]) => (
                    <div 
                      key={kategori} 
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3 flex flex-col justify-between w-full"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/50">
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <h3 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider truncate">{kategori}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                          {items.length}
                        </span>
                      </div>

                      {/* ITEM LIST ROWS */}
                      <ul className="space-y-2 w-full">
                        {items.map(item => (
                          <li
                            key={item.id}
                            className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 flex items-center justify-between gap-2 hover:border-indigo-200 transition-colors shadow-2xs group w-full"
                          >
                            <div 
                              onClick={() => { setSelectedItem(item); setModalType('detail'); }}
                              className="min-w-0 flex-1 cursor-pointer overflow-hidden"
                            >
                              <p className="font-bold text-slate-800 text-xs truncate group-hover:text-indigo-600 transition-colors">
                                {item.text_1}
                              </p>
                              {item.text_2 && (
                                <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                                  {item.text_2}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.number_1 !== 0 && (
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200">
                                  {item.number_1}
                                </span>
                              )}
                              <button
                                onClick={() => { setSelectedItem(item); setModalType('detail'); }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Detail"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => { setSelectedItem(item); setModalType('delete'); }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* MODAL DETAIL DATA */}
      <Modal isOpen={modalType === 'detail'} onClose={() => setModalType(null)} title="Rincian Master Data">
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-center">
              <Tag className="mx-auto text-indigo-600 mb-1" size={24} />
              <h3 className="text-xl font-black text-indigo-950">{selectedItem.text_1}</h3>
              <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                {selectedItem.jenis} &bull; {selectedItem.kategori}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">Text 2</p>
                <p className="mt-0.5 font-bold text-slate-700">{selectedItem.text_2 || '-'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">Number 1</p>
                <p className="mt-0.5 font-mono font-bold text-slate-700">{selectedItem.number_1 ?? '0'}</p>
              </div>

              {selectedItem.address && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 flex items-start gap-2">
                  <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Alamat</p>
                    <p className="mt-0.5 font-bold text-slate-700">{selectedItem.address}</p>
                  </div>
                </div>
              )}

              {selectedItem.phone !== 0 && selectedItem.phone && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">No. Telepon</p>
                    <p className="mt-0.5 font-mono font-bold text-slate-700">{selectedItem.phone}</p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Visibilitas Akses</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedItem.visibilitas ? (
                    (Array.isArray(selectedItem.visibilitas) ? selectedItem.visibilitas : String(selectedItem.visibilitas).split(',')).map(v => (
                      <span key={v} className="bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md text-[10px]">Level {v}</span>
                    ))
                  ) : <span className="text-slate-400 font-medium italic">Global (Semua Level)</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => openEditModal(selectedItem)}
                className="flex-1 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Pencil size={14} /> Edit Data
              </button>
              <button
                onClick={() => setModalType('delete')}
                className="py-3 px-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
              <button 
                onClick={() => setModalType(null)} 
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL FORM EDIT / ADD DENGAN TAB DESIGN */}
      <Modal 
        isOpen={modalType === 'form'} 
        onClose={() => setModalType(null)} 
        title={selectedItem ? "Edit Master Data" : "Tambah Master Data"}
      >
        <form onSubmit={submitForm} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar pb-2">
          
          {/* TAB HEADER DESIGN INSIDE MODAL */}
          <div className="flex border-b border-slate-200 gap-2 pb-2">
            <button
              type="button"
              onClick={() => setFormTab('basic')}
              className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                formTab === 'basic'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Tag size={13} /> Utama
            </button>
            <button
              type="button"
              onClick={() => setFormTab('extra')}
              className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                formTab === 'extra'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Sliders size={13} /> Nilai & Extra
            </button>
            <button
              type="button"
              onClick={() => setFormTab('access')}
              className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                formTab === 'access'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Shield size={13} /> Enum & Akses
            </button>
          </div>

          {/* TAB 1: BASIC INFO */}
          {formTab === 'basic' && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 md:col-span-1 relative">
                  <Field label="Jenis (Section) *">
                    <input
                      name="jenis"
                      value={formData.jenis || ''}
                      onFocus={() => setIsJenisOpen(true)}
                      onBlur={() => setTimeout(() => setIsJenisOpen(false), 200)}
                      onChange={(e) => { handleInputChange(e as any); setJenisSearch(e.target.value); setIsJenisOpen(true); }}
                      required
                      placeholder="Ketik/pilih jenis..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </Field>
                  {isJenisOpen && filteredJenis.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-36 overflow-y-auto custom-scrollbar">
                      {filteredJenis.map(j => (
                        <div key={j} className="p-2.5 hover:bg-indigo-50 text-xs font-bold text-slate-700 cursor-pointer border-b border-slate-50 last:border-0"
                          onClick={() => { setFormData({ ...formData, jenis: j }); setJenisSearch(j); setIsJenisOpen(false); }}>
                          {j}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2 md:col-span-1 relative">
                  <Field label="Kategori *">
                    <input
                      name="kategori"
                      value={formData.kategori || ''}
                      onFocus={() => setIsKategoriOpen(true)}
                      onBlur={() => setTimeout(() => setIsKategoriOpen(false), 200)}
                      onChange={(e) => { handleInputChange(e as any); setKategoriSearch(e.target.value); setIsKategoriOpen(true); }}
                      required
                      placeholder="Ketik/pilih kategori..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </Field>
                  {isKategoriOpen && filteredKategoris.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-36 overflow-y-auto custom-scrollbar">
                      {filteredKategoris.map(k => (
                        <div key={k} className="p-2.5 hover:bg-indigo-50 text-xs font-bold text-slate-700 cursor-pointer border-b border-slate-50 last:border-0"
                          onClick={() => { setFormData({ ...formData, kategori: k }); setKategoriSearch(k); setIsKategoriOpen(false); }}>
                          {k}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Field label="Label Utama (text_1) *">
                <input 
                  name="text_1" 
                  value={formData.text_1 || ''} 
                  onChange={handleInputChange} 
                  required 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" 
                  placeholder="Nama item..." 
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Text 2">
                  <input name="text_2" value={formData.text_2 || ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="Keterangan..." />
                </Field>
                <Field label="Text 3">
                  <input name="text_3" value={formData.text_3 || ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="Catatan..." />
                </Field>
              </div>

              <Field label="Alamat">
                <input name="address" value={formData.address || ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="Alamat..." />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="No. Telepon">
                  <input type="number" name="phone" value={formData.phone ?? ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="628..." />
                </Field>
                <Field label="Lat Long">
                  <input name="latlong" value={formData.latlong || ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="-8.xxx, 114.xxx" />
                </Field>
              </div>
            </div>
          )}

          {/* TAB 2: NUMBERS & EXTRA */}
          {formTab === 'extra' && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Number 1">
                  <input type="number" name="number_1" value={formData.number_1 ?? ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
                </Field>
                <Field label="Number 2">
                  <input type="number" name="number_2" value={formData.number_2 ?? ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Field label="Number 3">
                  <input type="number" name="number_3" value={formData.number_3 ?? ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
                </Field>
                <Field label="Number 4">
                  <input type="number" name="number_4" value={formData.number_4 ?? ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
                </Field>
                <Field label="Number 5">
                  <input type="number" name="number_5" value={formData.number_5 ?? ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Link Gambar">
                  <input name="link_image" value={formData.link_image || ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="https://..." />
                </Field>
                <Field label="Link Dokumen">
                  <input name="doc" value={formData.doc || ''} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="https://..." />
                </Field>
              </div>
            </div>
          )}

          {/* TAB 3: ENUM & ACCESS VISIBILITY */}
          {formTab === 'access' && (
            <div className="space-y-3 pt-1">
              <BeautifulEnumList
                label="Visibilitas Akses (Level User)"
                gridCols="grid-cols-2 md:grid-cols-4"
                options={levelUserOptions}
                selectedValues={formData.visibilitas || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, visibilitas: vals }))}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BeautifulEnumList
                  label="Enum 1 (User)"
                  gridCols="grid-cols-2"
                  options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                  selectedValues={formData.enum_1 || []}
                  onChange={(vals) => setFormData(prev => ({ ...prev, enum_1: vals }))}
                />

                <BeautifulEnumList
                  label="Enum 4 (User Cadangan)"
                  gridCols="grid-cols-2"
                  options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                  selectedValues={formData.enum_4 || []}
                  onChange={(vals) => setFormData(prev => ({ ...prev, enum_4: vals }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BeautifulEnumList
                  label="Enum 2 (Level)"
                  gridCols="grid-cols-2"
                  options={levelUserOptions}
                  selectedValues={formData.enum_2 || []}
                  onChange={(vals) => setFormData(prev => ({ ...prev, enum_2: vals }))}
                />

                <BeautifulEnumList
                  label="Enum 3 (Level Tambahan)"
                  gridCols="grid-cols-2"
                  options={levelUserOptions}
                  selectedValues={formData.enum_3 || []}
                  onChange={(vals) => setFormData(prev => ({ ...prev, enum_3: vals }))}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setModalType(null)} 
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isProcessing} 
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md shadow-indigo-200 transition-colors cursor-pointer"
            >
              {isProcessing ? 'Memproses...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DELETE */}
      <Modal isOpen={modalType === 'delete'} onClose={() => setModalType(null)} title="Hapus Master Data">
        <div className="text-center p-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} />
          </div>
          <p className="font-bold text-slate-700 text-sm">Hapus <span className="text-rose-600 font-black">{selectedItem?.text_1}</span>?</p>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setModalType(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-500 text-xs uppercase cursor-pointer">Batal</button>
            <button onClick={submitDelete} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase shadow-md shadow-rose-200 cursor-pointer">Hapus</button>
          </div>
        </div>
      </Modal>

      {/* DIALOG POPUP */}
      <Modal isOpen={dialog.show} onClose={() => setDialog(prev => ({ ...prev, show: false }))} title={dialog.title}>
        <div className="text-center p-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${dialog.title.includes('Gagal') ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
            {dialog.title.includes('Gagal') ? <AlertTriangle size={24} /> : <Info size={24} />}
          </div>
          <p className="font-bold text-slate-700 text-xs leading-relaxed mb-5">{dialog.message}</p>
          <button
            onClick={() => setDialog(prev => ({ ...prev, show: false }))}
            className={`w-full py-2.5 text-white rounded-xl font-bold text-xs shadow-xs ${dialog.title.includes('Gagal') ? 'bg-rose-500 shadow-rose-200' : 'bg-emerald-600 shadow-emerald-200'}`}
          >
            Oke
          </button>
        </div>
      </Modal>

    </div>
  );
}