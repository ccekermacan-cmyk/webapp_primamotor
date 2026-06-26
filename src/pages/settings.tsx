import React, { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { Settings as SettingsIcon, Plus, Edit2, Trash2, Tag, Eye, Check, AlertTriangle, Info, Search } from 'lucide-react';
interface DropdownData {
  id: string; id_lama: string; kategori: string; jenis: string;
  text_1: string; text_2: string; text_3: string; text_4: string;
  text_5: string; text_6: string; text_7: string; text_8: string;
  text_9: string; text_10: string;
  number_1: number; number_2: number; number_3: number; number_4: number; number_5: number;
  phone: number;
  image: string; link_image: string; doc: string; address: string; latlong: string;
  enum_1: string[]; enum_2: any[]; enum_3: any[]; enum_4: string[];
  visibilitas: string[]; operator: string;
}

export default function Settings() {
  const [data, setData] = useState<DropdownData[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<'form' | 'detail' | 'delete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<DropdownData | null>(null);
  const [formData, setFormData] = useState<Partial<DropdownData>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog state
  const [dialog, setDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, title: '', message: '', type: 'alert' });

  // Proteksi Sesi
  useEffect(() => {
    const level = localStorage.getItem('user_level');
    if (!level || level === 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  // User list untuk enum
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await pb.collection('user').getFullList({ $autoCancel: false });
        setAllUsers(users);
      } catch (e) {
        console.error("Gagal memuat data master pengguna:", e);
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
        sort: 'kategori,jenis,text_1',
        $autoCancel: false
      });
      setData(records);
    } catch (error) {
      console.error("Gagal load dropdown:", error);
    } finally {
      setLoading(false);
    }
  };

  const [masterSearch, setMasterSearch] = useState('');

  const [kategoriSearch, setKategoriSearch] = useState('');
  const [jenisSearch, setJenisSearch] = useState('');
  const [isKategoriOpen, setIsKategoriOpen] = useState(false);
  const [isJenisOpen, setIsJenisOpen] = useState(false);

  // Opsi level user
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

  const filteredKategoris = useMemo(() =>
    [...new Set(data.map(d => d.kategori))].filter(k => k.toLowerCase().includes(kategoriSearch.toLowerCase())),
    [data, kategoriSearch]
  );

  const filteredJenis = useMemo(() =>
    [...new Set(data.filter(d => d.kategori === formData.kategori).map(d => d.jenis))].filter(j => j.toLowerCase().includes(jenisSearch.toLowerCase())),
    [data, formData.kategori, jenisSearch]
  );

  const groupedData = useMemo(() => {
    const groups: { [key: string]: { [key: string]: DropdownData[] } } = {};
    
    // Filter data terlebih dahulu berdasarkan pencarian
    const filteredData = data.filter(item => 
      item.kategori.toLowerCase().includes(masterSearch.toLowerCase()) ||
      item.jenis.toLowerCase().includes(masterSearch.toLowerCase()) ||
      item.text_1.toLowerCase().includes(masterSearch.toLowerCase())
    );

    filteredData.forEach(item => {
      if (!groups[item.kategori]) groups[item.kategori] = {};
      if (!groups[item.kategori][item.jenis]) groups[item.kategori][item.jenis] = [];
      groups[item.kategori][item.jenis].push(item);
    });
    return groups;
  }, [data, masterSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.startsWith('number_') || name === 'phone' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const payload = {
        kategori: formData.kategori || '',
        jenis: formData.jenis || '',
        text_1: formData.text_1 || '', text_2: formData.text_2 || '', text_3: formData.text_3 || '',
        text_4: formData.text_4 || '', text_5: formData.text_5 || '', text_6: formData.text_6 || '',
        text_7: formData.text_7 || '', text_8: formData.text_8 || '', text_9: formData.text_9 || '',
        text_10: formData.text_10 || '',
        number_1: Number(formData.number_1 || 0), number_2: Number(formData.number_2 || 0),
        number_3: Number(formData.number_3 || 0), number_4: Number(formData.number_4 || 0),
        number_5: Number(formData.number_5 || 0), phone: Number(formData.phone || 0),
        image: formData.image || '', link_image: formData.link_image || '', doc: formData.doc || '',
        address: formData.address || '', latlong: formData.latlong || '',
        enum_1: Array.isArray(formData.enum_1) ? formData.enum_1.join(',') : formData.enum_1,
        enum_2: Array.isArray(formData.enum_2) ? formData.enum_2.join(',') : formData.enum_2,
        enum_3: Array.isArray(formData.enum_3) ? formData.enum_3.join(',') : formData.enum_3,
        enum_4: Array.isArray(formData.enum_4) ? formData.enum_4.join(',') : formData.enum_4,
        visibilitas: Array.isArray(formData.visibilitas) ? formData.visibilitas.join(',') : formData.visibilitas,
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
        title: "Sinkronisasi Berhasil",
        message: "Data master baru Anda telah terkirim dan disimpan di server database dengan aman.",
        type: 'alert'
      });

    } catch (error: any) {
      console.error("Gagal sinkronisasi ke PocketBase:", error);
      setDialog({
        show: true,
        title: "Koneksi Terputus / Gagal",
        message: `Gagal menyimpan data master. Detail kendala: ${error.message || 'Bad Request (400)'}`,
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
        title: "Penghapusan Berhasil",
        message: "Data master tersebut telah dihapus secara permanen dari server database.",
        type: 'alert'
      });
    } catch (error: any) {
      setDialog({
        show: true,
        title: "Gagal Menghapus",
        message: `Sistem menolak perintah hapus. Kendala: ${error.message}`,
        type: 'alert'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Komponen pembantu untuk multi-select
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
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
        <div className={`border border-slate-200 bg-slate-50 rounded-2xl p-3 max-h-40 overflow-y-auto grid ${gridCols} gap-2 custom-scrollbar`}>
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
    <div className="p-8 h-full flex flex-col bg-slate-50">
      <div className="flex flex-col gap-6 mb-8 shrink-0">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-200">
                <SettingsIcon size={28} />
              </div>
              Pengaturan Master Data
            </h2>
            <p className="text-slate-500 mt-1 font-medium">Kelola seluruh pilihan menu dan kategori sistem</p>
          </div>
          <button 
            onClick={() => { setSelectedItem(null); setFormData({}); setModalType('form'); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <Plus size={20} /> Tambah Dropdown
          </button>
        </div>

        {/* 🆕 Search Bar Baru */}
        <div className="relative max-w-xl w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Cari kategori, jenis, atau label master data..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm shadow-sm"
            value={masterSearch}
            onChange={(e) => setMasterSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-10 pr-2">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : Object.keys(groupedData).length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-300 font-bold">Belum ada data master.</div>
        ) : (
          Object.entries(groupedData).map(([kategori, jenisGroup]) => (
            <div key={kategori} className="space-y-4">
              <h3 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em] ml-4 drop-shadow-sm">KATEGORI: {kategori}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(jenisGroup).map(([jenis, items]) => (
                  <div key={jenis} className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden flex flex-col">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="font-black text-slate-700 text-sm uppercase tracking-tight">{jenis}</h4>
                      <span className="bg-white px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-200">{items.length} ITEM</span>
                    </div>

                    <div className="p-4 space-y-2">
                      {items.map(item => (
                        <div
                          key={item.id}
                          onClick={() => { setSelectedItem(item); setModalType('detail'); }}
                          className="group flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 transition-all cursor-pointer border border-transparent hover:border-indigo-100"
                        >
                          <span className="font-bold text-slate-600 group-hover:text-indigo-700">{item.text_1}</span>
                          <Eye size={14} className="text-slate-300 group-hover:text-indigo-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DETAIL */}
      <Modal isOpen={modalType === 'detail'} onClose={() => setModalType(null)} title="Rincian Master Data">
        {selectedItem && (
          <div className="space-y-6">
            <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 text-center">
              <Tag className="mx-auto text-indigo-500 mb-2" size={32} />
              <h3 className="text-2xl font-black text-indigo-900">{selectedItem.text_1}</h3>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">{selectedItem.kategori} &bull; {selectedItem.jenis}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">TEXT 2</p>
                <p className="mt-1 font-bold text-slate-700">{selectedItem.text_2 || '-'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">TEXT 3</p>
                <p className="mt-1 font-bold text-slate-700">{selectedItem.text_3 || '-'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">NUMBER 1</p>
                <p className="mt-1 font-bold text-slate-700">{selectedItem.number_1 ?? '0'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">VISIBILITAS AKTIF (ENUM)</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {Array.isArray(selectedItem.visibilitas) && selectedItem.visibilitas.length > 0 ? (
                    selectedItem.visibilitas.map(v => <span key={v} className="bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md text-[10px]">Lv-{v}</span>)
                  ) : <span className="text-slate-400 font-medium italic">Global (Semua Level)</span>}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Daftar Penugasan Karyawan & Parameter (EnumList)</p>
                </div>
                <div className="border-r pr-1 overflow-hidden">
                  <p className="text-[9px] font-bold text-slate-400">ENUM 1 (User)</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_1) ? selectedItem.enum_1.join(', ') : (selectedItem.enum_1 || '-')}
                  </p>
                </div>
                <div className="border-r pr-1 overflow-hidden">
                  <p className="text-[9px] font-bold text-slate-400">ENUM 2 (Level)</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_2) ? selectedItem.enum_2.join(', ') : (selectedItem.enum_2 || '-')}
                  </p>
                </div>
                <div className="border-r pr-1 overflow-hidden">
                  <p className="text-[9px] font-bold text-slate-400">ENUM 3 (Level)</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_3) ? selectedItem.enum_3.join(', ') : (selectedItem.enum_3 || '-')}
                  </p>
                </div>
                <div className="overflow-hidden">
                  <p className="text-[9px] font-bold text-slate-400">ENUM 4 (User)</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_4) ? selectedItem.enum_4.join(', ') : (selectedItem.enum_4 || '-')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  const splitStr = (val: any) => (typeof val === 'string' && val ? val.split(',') : []);
                  setFormData({
                    ...selectedItem,
                    enum_1: splitStr(selectedItem.enum_1),
                    enum_2: splitStr(selectedItem.enum_2).map(Number),
                    enum_3: splitStr(selectedItem.enum_3).map(Number),
                    enum_4: splitStr(selectedItem.enum_4),
                    visibilitas: splitStr(selectedItem.visibilitas).map(Number)
                  });
                  setModalType('form');
                }}
                className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black hover:bg-indigo-100 transition-all"
              >
                <Edit2 size={20} />
              </button>
              <button onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black">TUTUP</button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL FORM */}
      <Modal isOpen={modalType === 'form'} onClose={() => setModalType(null)} title={selectedItem ? "Edit Master Data" : "Tambah Master Data"}>
        <form onSubmit={submitForm} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Kategori</label>
              <input
                name="kategori"
                value={formData.kategori || ''}
                onFocus={() => setIsKategoriOpen(true)}
                onBlur={() => setTimeout(() => setIsKategoriOpen(false), 200)}
                onChange={(e) => { handleInputChange(e as any); setKategoriSearch(e.target.value); setIsKategoriOpen(true); }}
                required
                placeholder="Cari atau ketik kategori baru..."
                className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm"
              />
              {isKategoriOpen && filteredKategoris.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredKategoris.map(k => (
                    <div key={k} className="p-3 hover:bg-indigo-50 text-sm font-bold text-slate-700 cursor-pointer border-b border-slate-50 last:border-0"
                      onClick={() => { setFormData({ ...formData, kategori: k }); setKategoriSearch(k); setIsKategoriOpen(false); }}>
                      {k}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Jenis</label>
              <input
                name="jenis"
                value={formData.jenis || ''}
                onFocus={() => setIsJenisOpen(true)}
                onBlur={() => setTimeout(() => setIsJenisOpen(false), 200)}
                onChange={(e) => { handleInputChange(e as any); setJenisSearch(e.target.value); setIsJenisOpen(true); }}
                required
                placeholder="Cari atau ketik jenis baru..."
                className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm"
              />
              {isJenisOpen && filteredJenis.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredJenis.map(j => (
                    <div key={j} className="p-3 hover:bg-indigo-50 text-sm font-bold text-slate-700 cursor-pointer border-b border-slate-50 last:border-0"
                      onClick={() => { setFormData({ ...formData, jenis: j }); setJenisSearch(j); setIsJenisOpen(false); }}>
                      {j}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Label Utama (Text 1)</label>
              <input name="text_1" value={formData.text_1 || ''} onChange={handleInputChange} required className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="Masukkan nama item..." />
            </div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 2</label><input name="text_2" value={formData.text_2 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 3</label><input name="text_3" value={formData.text_3 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 4</label><input name="text_4" value={formData.text_4 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 5</label><input name="text_5" value={formData.text_5 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 6</label><input name="text_6" value={formData.text_6 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 7</label><input name="text_7" value={formData.text_7 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 8</label><input name="text_8" value={formData.text_8 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 9</label><input name="text_9" value={formData.text_9 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 10</label><input name="text_10" value={formData.text_10 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>

            <div className="col-span-2 border-t border-slate-100 my-2" />
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Number 1</label><input type="number" name="number_1" value={formData.number_1 ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="0" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Number 2</label><input type="number" name="number_2" value={formData.number_2 ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="0" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Number 3</label><input type="number" name="number_3" value={formData.number_3 ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="0" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Number 4</label><input type="number" name="number_4" value={formData.number_4 ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="0" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Number 5</label><input type="number" name="number_5" value={formData.number_5 ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="0" /></div>
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Phone</label><input type="number" name="phone" value={formData.phone ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="628..." /></div>

            <div className="col-span-2 border-t border-slate-100 my-2" />
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Address</label><input name="address" value={formData.address || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lat Long</label><input name="latlong" value={formData.latlong || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="-8.xxxx, 114.xxxx" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Image (Name)</label><input name="image" value={formData.image || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Link Image (URL)</label><input name="link_image" value={formData.link_image || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Document (Doc Link)</label><input name="doc" value={formData.doc || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" /></div>

            <div className="col-span-2 border-t border-slate-100 my-2" />

            <div className="col-span-2 md:col-span-1">
              <BeautifulEnumList
                label="Enum 1 (Nama User Karyawan)"
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_1 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_1: vals }))}
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <BeautifulEnumList
                label="Enum 4 (Nama User Cadangan)"
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_4 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_4: vals }))}
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <BeautifulEnumList
                label="Enum 2 (Level User)"
                gridCols="grid-cols-2"
                options={levelUserOptions}
                selectedValues={formData.enum_2 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_2: vals }))}
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <BeautifulEnumList
                label="Enum 3 (Level Pengawas)"
                gridCols="grid-cols-2"
                options={levelUserOptions}
                selectedValues={formData.enum_3 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_3: vals }))}
              />
            </div>

            <div className="col-span-2 border-t border-slate-100 my-2" />

            <div className="col-span-2">
              <BeautifulEnumList
                label="Hak Akses Visibilitas (Sesuai Level User)"
                gridCols="grid-cols-3"
                options={levelUserOptions}
                selectedValues={formData.visibilitas || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, visibilitas: vals }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400 text-xs uppercase tracking-wider">BATAL</button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100">
              {isProcessing ? 'PROSES...' : 'SIMPAN DATA MASTER'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DELETE */}
      <Modal isOpen={modalType === 'delete'} onClose={() => setModalType(null)} title="Hapus Master Data">
        <div className="text-center p-4">
          <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
          <p className="font-bold text-slate-600">Yakin ingin menghapus <span className="text-rose-600 font-black">{selectedItem?.text_1}</span>?</p>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400">BATAL</button>
            <button onClick={submitDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200">HAPUS</button>
          </div>
        </div>
      </Modal>

      {/* DIALOG POPUP */}
      <Modal isOpen={dialog.show} onClose={() => setDialog(prev => ({ ...prev, show: false }))} title={dialog.title}>
        <div className="text-center p-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${dialog.title.includes('Gagal') ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
            {dialog.title.includes('Gagal') ? <AlertTriangle size={32} /> : <Info size={32} />}
          </div>
          <p className="font-bold text-slate-600 text-sm leading-relaxed mb-6">{dialog.message}</p>
          <button
            onClick={() => setDialog(prev => ({ ...prev, show: false }))}
            className={`w-full py-3.5 text-white rounded-xl font-bold text-xs shadow-md ${dialog.title.includes('Gagal') ? 'bg-rose-500 shadow-rose-200' : 'bg-emerald-600 shadow-emerald-200'}`}
          >
            OKE, MENGERTI
          </button>
        </div>
      </Modal>
    </div>
  );
}