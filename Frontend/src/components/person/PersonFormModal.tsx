import React from 'react';
import Modal from '../modal';
import type { Person } from '../../types/person';

interface PersonFormModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  currentPerson: Partial<Person>;
  userLevelFromStorage: string;
  onClose: () => void;
  onCurrentPersonChange: (person: Partial<Person>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function PersonFormModal({
  isOpen,
  isProcessing,
  currentPerson,
  userLevelFromStorage,
  onClose,
  onCurrentPersonChange,
  onSubmit,
}: PersonFormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={currentPerson.id ? 'Edit Rekor Partner' : 'Tambah Partner Baru'}>
      <form onSubmit={onSubmit} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
        <div className="space-y-4 p-1">
          
          {/* Header Form & Jenis Enum */}
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner w-full mb-2">
            <button
              type="button"
              onClick={() => {
                onCurrentPersonChange({ ...currentPerson, jenis: 'Customer', text_9: 'Pelanggan' });
              }}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                currentPerson.jenis === 'Customer' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
              }`}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => {
                onCurrentPersonChange({ ...currentPerson, jenis: 'Supplier', text_9: 'Supplier' });
              }}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                currentPerson.jenis === 'Supplier' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
              }`}
            >
              Supplier
            </button>
          </div>

          {/* Baris 1: Nama & Perusahaan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nama Cust / Supplier <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                required 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_1 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_1: e.target.value })} 
                placeholder="Cth: Budi Santoso" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nama Bengkel / Perusahaan</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_2 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_2: e.target.value })} 
                placeholder="Cth: PT Makmur Jaya" 
              />
            </div>
          </div>

          {/* Baris 2: NIK & HP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">NIK</label>
              <input 
                type="text" 
                inputMode="numeric"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={(currentPerson as any).number_4 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, number_4: e.target.value } as any)} 
                placeholder="Cth: 3500000000000" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nomor HP / WhatsApp</label>
              <input 
                type="text" 
                inputMode="tel"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={(currentPerson as any).phone || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, phone: e.target.value } as any)} 
                placeholder="Cth: 08123456789" 
              />
            </div>
          </div>

          {/* Baris 3: Dusun, RT, RW */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Dusun / Jalan</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_3 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_3: e.target.value })} 
                placeholder="Cth: Dusun Krajan" 
              />
            </div>
            <div className="space-y-1 flex gap-2 col-span-2 sm:col-span-1">
              <div className="w-1/2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RT</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={currentPerson.number_2 ?? ''} 
                  onChange={e => onCurrentPersonChange({ ...currentPerson, number_2: e.target.value as any })} 
                  placeholder="00" 
                />
              </div>
              <div className="w-1/2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RW</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={currentPerson.number_3 ?? ''} 
                  onChange={e => onCurrentPersonChange({ ...currentPerson, number_3: e.target.value as any })} 
                  placeholder="00" 
                />
              </div>
            </div>
          </div>

          {/* Baris 4: Desa & Kecamatan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Desa</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_4 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_4: e.target.value })} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Kecamatan</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_5 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_5: e.target.value })} 
              />
            </div>
          </div>

          {/* Baris 5: Kota & Provinsi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Kota / Kabupaten</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_6 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_6: e.target.value })} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Provinsi</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={currentPerson.text_7 || ''} 
                onChange={e => onCurrentPersonChange({ ...currentPerson, text_7: e.target.value })} 
              />
            </div>
          </div>

          {/* Baris 6: Kategori & Upload Foto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Tipe / Kelompok</label>
              {['1', '2'].includes(userLevelFromStorage) ? (
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={currentPerson.text_9 || ''} 
                  onChange={e => onCurrentPersonChange({ ...currentPerson, text_9: e.target.value })} 
                  placeholder="Bebas ketik kategori (Misal: VIP)" 
                />
              ) : (
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={currentPerson.text_9 || 'Pelanggan'} 
                  onChange={e => onCurrentPersonChange({ ...currentPerson, text_9: e.target.value })}
                >
                  <option value="Pelanggan">Pelanggan</option>
                  <option value="Supplier">Supplier</option>
                </select>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Upload Foto / Berkas</label>
              <input 
                type="file" 
                accept="image/*,application/pdf" 
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-cyan-400" 
                onChange={e => { if(e.target.files?.[0]) onCurrentPersonChange({ ...currentPerson, imageFile: e.target.files[0] as any }) }} 
              />
            </div>
          </div>

        </div>
        
        <div className="mt-6 pt-5 border-t border-slate-100 flex gap-2 sticky bottom-0 bg-white p-1">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors"
          >
            Batalkan
          </button>
          <button 
            type="submit" 
            disabled={isProcessing} 
            className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-colors ${
              currentPerson.jenis === 'Supplier' 
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/30' 
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30'
            }`}
          >
            {isProcessing ? 'MENYIMPAN...' : 'SAVE PARTNER'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
