import React from 'react';
import { Tag, Sliders, Shield } from 'lucide-react';
import Modal from '../modal';
import type { DropdownData } from '../../types/settings';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export const Field = ({ label, children }: FieldProps) => (
  <label className="block text-xs font-semibold text-slate-500 mb-1 space-y-1">
    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    {children}
  </label>
);

export const getFieldLabel = (field: string, kategori: string, jenis: string) => {
  const k = (kategori || '').toLowerCase();
  const j = (jenis || '').toLowerCase();

  if (field === 'text_1') {
    if (k === 'cashflow' && j.includes('akun')) return 'Nama Akun / Kas *';
    if (k === 'cashflow') return 'Nama Transaksi *';
    if (k === 'person') return 'Nama Pihak (Lengkap) *';
    if (k === 'persenan') return 'Label Persentase *';
    if (k === 'user') return 'Nama Jabatan / Level *';
    return 'Label Utama (Text 1) *';
  }
  if (field === 'text_2') {
    if (k === 'cashflow') return 'Tipe (in / out)';
    if (k === 'person') return 'Nama Bengkel / Toko';
    return 'Text 2';
  }
  if (field === 'number_1') {
    if (k === 'cashflow' && j.includes('akun')) return 'Saldo Awal (Rp)';
    if (k === 'person') return 'Limit / Saldo (Rp)';
    return 'Number 1';
  }
  if (field === 'number_2') {
    if (k === 'person') return 'Tier / Level Harga (1-5)';
    if (k === 'persenan') return 'Nilai Persentase (%)';
    if (k === 'user') return 'ID / Kode Level';
    return 'Number 2';
  }
  if (field === 'enum_1') {
    if (k === 'cashflow' && j.includes('akun')) return 'Akses User (Enum 1)';
    return 'Enum 1 (User)';
  }
  return field;
};

export const levelUserOptions = [
  { label: 'Level 1 (Super Admin)', value: 1 },
  { label: 'Level 2 (Admin)', value: 2 },
  { label: 'Level 3 (Manager)', value: 3 },
  { label: 'Level 4 (Supervisor)', value: 4 },
  { label: 'Level 5 (Kasir)', value: 5 },
  { label: 'Level 6 (Staff)', value: 6 },
  { label: 'Level 7 (Mekanik)', value: 7 },
  { label: 'Level 10 (Mekanik Senior)', value: 10 },
];

interface BeautifulEnumListProps {
  label: string;
  options: { label: string; value: any }[];
  selectedValues: any[];
  gridCols?: string;
  onChange: (updated: any[]) => void;
}

export const BeautifulEnumList = ({ label, options, selectedValues, gridCols = 'grid-cols-2', onChange }: BeautifulEnumListProps) => {
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
              {isChecked && <CheckIcon />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CheckIcon = () => (
  <svg className="shrink-0 ml-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface SettingsFormModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  selectedItem: DropdownData | null;
  formData: Partial<DropdownData>;
  formTab: 'basic' | 'extra' | 'access';
  allUsers: any[];
  filteredKategoris: string[];
  filteredJenis: string[];
  isKategoriOpen: boolean;
  isJenisOpen: boolean;
  onClose: () => void;
  onFormTabChange: (tab: 'basic' | 'extra' | 'access') => void;
  onFormDataChange: React.Dispatch<React.SetStateAction<Partial<DropdownData>>>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKategoriSearchChange: (value: string) => void;
  onJenisSearchChange: (value: string) => void;
  onKategoriOpenChange: (open: boolean) => void;
  onJenisOpenChange: (open: boolean) => void;
}

export default function SettingsFormModal({
  isOpen,
  isProcessing,
  selectedItem,
  formData,
  formTab,
  allUsers,
  filteredKategoris,
  filteredJenis,
  isKategoriOpen,
  isJenisOpen,
  onClose,
  onFormTabChange,
  onFormDataChange,
  onInputChange,
  onSubmit,
  onKategoriSearchChange,
  onJenisSearchChange,
  onKategoriOpenChange,
  onJenisOpenChange,
}: SettingsFormModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={selectedItem ? "Edit Master Data" : "Tambah Master Data"}
    >
      <form onSubmit={onSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar pb-2">
        
        {/* TAB HEADER DESIGN INSIDE MODAL */}
        <div className="flex border-b border-slate-200 gap-2 pb-2">
          <button
            type="button"
            onClick={() => onFormTabChange('basic')}
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
            onClick={() => onFormTabChange('extra')}
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
            onClick={() => onFormTabChange('access')}
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
                    onFocus={() => onJenisOpenChange(true)}
                    onBlur={() => setTimeout(() => onJenisOpenChange(false), 200)}
                    onChange={(e) => { onInputChange(e); onJenisSearchChange(e.target.value); onJenisOpenChange(true); }}
                    required
                    placeholder="Ketik/pilih jenis..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </Field>
                {isJenisOpen && filteredJenis.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-36 overflow-y-auto custom-scrollbar">
                    {filteredJenis.map(j => (
                      <div key={j} className="p-2.5 hover:bg-indigo-50 text-xs font-bold text-slate-700 cursor-pointer border-b border-slate-50 last:border-0"
                        onClick={() => { onFormDataChange({ ...formData, jenis: j }); onJenisSearchChange(j); onJenisOpenChange(false); }}>
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
                    onFocus={() => onKategoriOpenChange(true)}
                    onBlur={() => setTimeout(() => onKategoriOpenChange(false), 200)}
                    onChange={(e) => { onInputChange(e); onKategoriSearchChange(e.target.value); onKategoriOpenChange(true); }}
                    required
                    placeholder="Ketik/pilih kategori..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </Field>
                {isKategoriOpen && filteredKategoris.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-36 overflow-y-auto custom-scrollbar">
                    {filteredKategoris.map(k => (
                      <div key={k} className="p-2.5 hover:bg-indigo-50 text-xs font-bold text-slate-700 cursor-pointer border-b border-slate-50 last:border-0"
                        onClick={() => { onFormDataChange({ ...formData, kategori: k }); onKategoriSearchChange(k); onKategoriOpenChange(false); }}>
                        {k}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Field label={getFieldLabel('text_1', formData.kategori || '', formData.jenis || '')}>
              <input 
                name="text_1" 
                value={formData.text_1 || ''} 
                onChange={onInputChange} 
                required 
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" 
                placeholder="Nama item..." 
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={getFieldLabel('text_2', formData.kategori || '', formData.jenis || '')}>
                <input name="text_2" value={formData.text_2 || ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="Keterangan..." />
              </Field>
              <Field label="Text 3">
                <input name="text_3" value={formData.text_3 || ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="Catatan..." />
              </Field>
            </div>

            <Field label="Alamat">
              <input name="address" value={formData.address || ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="Alamat..." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="No. Telepon">
                <input type="number" name="phone" value={formData.phone ?? ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="628..." />
              </Field>
              <Field label="Lat Long">
                <input name="latlong" value={formData.latlong || ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="-8.xxx, 114.xxx" />
              </Field>
            </div>
          </div>
        )}

        {/* TAB 2: NUMBERS & EXTRA */}
        {formTab === 'extra' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label={getFieldLabel('number_1', formData.kategori || '', formData.jenis || '')}>
                <input type="number" name="number_1" value={formData.number_1 ?? ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
              </Field>
              <Field label={getFieldLabel('number_2', formData.kategori || '', formData.jenis || '')}>
                <input type="number" name="number_2" value={formData.number_2 ?? ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Number 3">
                <input type="number" name="number_3" value={formData.number_3 ?? ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
              </Field>
              <Field label="Number 4">
                <input type="number" name="number_4" value={formData.number_4 ?? ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
              </Field>
              <Field label="Number 5">
                <input type="number" name="number_5" value={formData.number_5 ?? ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="0" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Link Gambar">
                <input name="link_image" value={formData.link_image || ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="https://..." />
              </Field>
              <Field label="Link Dokumen">
                <input name="doc" value={formData.doc || ''} onChange={onInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="https://..." />
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
              onChange={(vals) => onFormDataChange(prev => ({ ...prev, visibilitas: vals }))}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <BeautifulEnumList
                label={getFieldLabel('enum_1', formData.kategori || '', formData.jenis || '')}
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_1 || []}
                onChange={(vals) => onFormDataChange(prev => ({ ...prev, enum_1: vals }))}
              />

              <BeautifulEnumList
                label="Enum 4 (User Cadangan)"
                gridCols="grid-cols-2"
                options={allUsers.map(u => ({ label: u.name || u.username, value: u.name || u.username }))}
                selectedValues={formData.enum_4 || []}
                onChange={(vals) => onFormDataChange(prev => ({ ...prev, enum_4: vals }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <BeautifulEnumList
                label="Enum 2 (Level)"
                gridCols="grid-cols-2"
                options={levelUserOptions}
                selectedValues={formData.enum_2 || []}
                onChange={(vals) => onFormDataChange(prev => ({ ...prev, enum_2: vals }))}
              />

              <BeautifulEnumList
                label="Enum 3 (Level Tambahan)"
                gridCols="grid-cols-2"
                options={levelUserOptions}
                selectedValues={formData.enum_3 || []}
                onChange={(vals) => onFormDataChange(prev => ({ ...prev, enum_3: vals }))}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            onClick={onClose} 
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
  );
}
