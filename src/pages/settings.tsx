import React, { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { Settings as SettingsIcon, Plus, Edit2, Trash2, Tag, Eye, Check, AlertTriangle, Info } from 'lucide-react';

interface DropdownData {
  id: string;
  kategori: string;
  jenis: string;
  text_1: string;
  text_2: string;
  text_3: string;
  number_1: number;
  operator: string;
  enum_1: string[];
  enum_2: string[];
  enum_3: string[];
  visibilitas: number[]; // Duplikasi string telah dihapus
}

export default function Settings() {
  const [data, setData] = useState<DropdownData[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<'form' | 'detail' | 'delete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<DropdownData | null>(null);
  const [formData, setFormData] = useState<Partial<DropdownData>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Integrasi Dialog Box
  const [dialog, setDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, title: '', message: '', type: 'alert' });

  // Proteksi Sesi Jaga Sesi Kasir
  useEffect(() => {
    const level = localStorage.getItem('user_level');
    if (!level || level === 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  // Sinkronisasi data master user untuk pengisian enumlist
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

  const groupedData = useMemo(() => {
    const groups: { [key: string]: { [key: string]: DropdownData[] } } = {};
    data.forEach(item => {
      if (!groups[item.kategori]) groups[item.kategori] = {};
      if (!groups[item.kategori][item.jenis]) groups[item.kategori][item.jenis] = [];
      groups[item.kategori][item.jenis].push(item);
    });
    return groups;
  }, [data]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'number_1' ? (value === '' ? 0 : Number(value)) : value 
    }));
  };

  // --- FIX FIX: STRATEGI AMAN SINKRONISASI PAYLOAD DATABASE ---
  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      // Mencegah State Mutation Delay di React, Ambil array langsung secara defensif
      const cleanEnum1 = Array.isArray(formData.enum_1) ? [...formData.enum_1] : [];
      const cleanEnum2 = Array.isArray(formData.enum_2) ? [...formData.enum_2] : [];
      const cleanEnum3 = Array.isArray(formData.enum_3) ? [...formData.enum_3] : [];
      const cleanVisibilitas = Array.isArray(formData.visibilitas) ? formData.visibilitas.map(Number) : [];

      const payload = {
        kategori: formData.kategori || '',
        jenis: formData.jenis || '',
        text_1: formData.text_1 || '',
        text_2: formData.text_2 || '',
        text_3: formData.text_3 || '',
        number_1: Number(formData.number_1 || 0),
        enum_1: cleanEnum1,
        enum_2: cleanEnum2,
        enum_3: cleanEnum3,
        visibilitas: cleanVisibilitas,
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
      <div className="flex justify-between items-end mb-8 shrink-0">
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

      {/* DETAIL MODAL */}
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
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Daftar Penugasan Karyawan (EnumList)</p>
                </div>
                <div className="border-r pr-1">
                  <p className="text-[9px] font-bold text-slate-400">ENUM 1</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_1) ? selectedItem.enum_1.join(', ') : (selectedItem.enum_1 || '-')}
                  </p>
                </div>
                <div className="border-r pr-1">
                  <p className="text-[9px] font-bold text-slate-400">ENUM 2</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_2) ? selectedItem.enum_2.join(', ') : (selectedItem.enum_2 || '-')}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400">ENUM 3</p>
                  <p className="text-slate-700 font-bold text-xs truncate">
                    {Array.isArray(selectedItem.enum_3) ? selectedItem.enum_3.join(', ') : (selectedItem.enum_3 || '-')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setModalType('delete')} className="p-4 bg-rose-50 text-rose-600 rounded-2xl font-black hover:bg-rose-100 transition-all"><Trash2 size={20}/></button>
              <button 
                onClick={() => { 
                  setFormData({
                    ...selectedItem,
                    enum_1: Array.isArray(selectedItem.enum_1) ? selectedItem.enum_1 : (selectedItem.enum_1 ? [selectedItem.enum_1] : []),
                    enum_2: Array.isArray(selectedItem.enum_2) ? selectedItem.enum_2 : (selectedItem.enum_2 ? [selectedItem.enum_2] : []),
                    enum_3: Array.isArray(selectedItem.enum_3) ? selectedItem.enum_3 : (selectedItem.enum_3 ? [selectedItem.enum_3] : []),
                    visibilitas: Array.isArray(selectedItem.visibilitas) ? selectedItem.visibilitas.map(Number) : (selectedItem.visibilitas ? [Number(selectedItem.visibilitas)] : [])
                  }); 
                  setModalType('form'); 
                }} 
                className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black hover:bg-indigo-100 transition-all"
              >
                <Edit2 size={20}/>
              </button>
              <button onClick={() => setModalType(null)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black">TUTUP</button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- FORM MODAL DENGAN INTEGRASI TOTAL MULTI-SELECT --- */}
      <Modal isOpen={modalType === 'form'} onClose={() => setModalType(null)} title={selectedItem ? "Edit Master Data" : "Tambah Master Data"}>
        <form onSubmit={submitForm} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
          <div className="grid grid-cols-2 gap-4">
            
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Kategori (Grup Utama)</label>
              <input name="kategori" value={formData.kategori || ''} onChange={handleInputChange} required className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="Misal: cashflow, produk..." />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Jenis (Sub-Grup)</label>
              <input name="jenis" value={formData.jenis || ''} onChange={handleInputChange} required className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="Misal: jenis cashflow, satuan..." />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Label Utama (Text 1)</label>
              <input name="text_1" value={formData.text_1 || ''} onChange={handleInputChange} required className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="Masukkan nama item..." />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 2</label>
              <input name="text_2" value={formData.text_2 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Text 3</label>
              <input name="text_3" value={formData.text_3 || ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Number 1</label>
              <input type="number" name="number_1" value={formData.number_1 ?? ''} onChange={handleInputChange} className="w-full mt-1 p-3.5 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm" placeholder="0" />
            </div>

            <div className="col-span-2 border-t border-slate-100 my-2" />

            {/* SELEKTOR ENUMLIST DENGAN STATE DEFENSIF */}
            <div className="col-span-2 md:col-span-1">
              <BeautifulEnumList 
                label="Enum 1 (Akses Karyawan)"
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_1 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_1: vals }))}
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <BeautifulEnumList 
                label="Enum 2 (Cadangan Karyawan)"
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_2 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_2: vals }))}
              />
            </div>

            <div className="col-span-2">
              <BeautifulEnumList 
                label="Enum 3 (Pengawas Lapangan)"
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_3 || []}
                onChange={(vals) => setFormData(prev => ({ ...prev, enum_3: vals }))}
              />
            </div>

            <div className="col-span-2 border-t border-slate-100 my-2" />
            
            <div className="col-span-2">
              <BeautifulEnumList 
                label="Hak Akses Visibilitas (Multi-Level Enum)"
                gridCols="grid-cols-3"
                options={[1, 2, 3, 5, 6, 7, 8, 10, 15].map(level => ({ label: `Lv-${level}`, value: level }))}
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

      {/* DELETE CONFIRM */}
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

      {/* BOX DIALOG POPUP */}
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