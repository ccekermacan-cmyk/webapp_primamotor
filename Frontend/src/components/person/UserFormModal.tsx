import React from 'react';
import Modal from '../modal';

interface UserFormModalProps {
  isOpen: boolean;
  isProcessingUser: boolean;
  editUserData: any;
  onClose: () => void;
  onEditUserDataChange: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function UserFormModal({
  isOpen,
  isProcessingUser,
  editUserData,
  onClose,
  onEditUserDataChange,
  onSubmit,
}: UserFormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editUserData?.id ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}>
      {editUserData && (
        <form onSubmit={onSubmit} className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
          <div className="space-y-4 p-1">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                required 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                value={editUserData.name || ''} 
                onChange={(e) => onEditUserDataChange({ ...editUserData, name: e.target.value })} 
                placeholder="Cth: Budi Santoso"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  disabled={!!editUserData.id} 
                  required 
                  className={`w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400 ${editUserData.id ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'}`} 
                  value={editUserData.username || ''} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, username: e.target.value })} 
                  placeholder="Cth: budi123"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="email" 
                  required 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={editUserData.email || ''} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, email: e.target.value })} 
                  placeholder="Cth: budi@primamotor.com"
                />
              </div>
            </div>
            {!editUserData.id && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Password Akses Login
                </label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  placeholder="Default: password123" 
                  value={editUserData.password || ''} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, password: e.target.value })} 
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Level Otoritas</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={editUserData.level ?? 2} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, level: Number(e.target.value) })}
                >
                  <option value={1}>Level 1 (Admin Utama)</option>
                  <option value={2}>Level 2 (Karyawan / Admin)</option>
                  <option value={3}>Level 3 (Manager)</option>
                  <option value={4}>Level 4 (Supervisor)</option>
                  <option value={5}>Level 5 (Kasir)</option>
                  <option value={6}>Level 6 (Staff)</option>
                  <option value={7}>Level 7 (Mekanik)</option>
                  <option value={10}>Level 10 (Mekanik Senior)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Status Akun</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={String(editUserData.status || 'active').toLowerCase()}
                  onChange={(e) => onEditUserDataChange({ ...editUserData, status: e.target.value })}
                >
                  <option value="active">Active (Aktif)</option>
                  <option value="inactive">Inactive (Nonaktif)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Upload Avatar (Foto Profil)
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-cyan-400" 
                  onChange={e => { if (e.target.files?.[0]) onEditUserDataChange({ ...editUserData, avatarFile: e.target.files[0] }); }} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Link URL Foto Profil (link_image)
                </label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={editUserData.link_image || ''} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, link_image: e.target.value })} 
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Nomor Telepon / HP (phone)
                </label>
                <input 
                  type="tel" 
                  inputMode="tel"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={editUserData.phone || ''} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, phone: e.target.value })} 
                  placeholder="Cth: 08123456789" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
                  Angka / Poin / Nominal Tambahan (number)
                </label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan-400" 
                  value={editUserData.number ?? 0} 
                  onChange={(e) => onEditUserDataChange({ ...editUserData, number: Number(e.target.value) })} 
                  placeholder="0" 
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-400" 
                  checked={editUserData.emailVisibility !== false} 
                  onChange={e => onEditUserDataChange({ ...editUserData, emailVisibility: e.target.checked })} 
                />
                <span>Tampilkan Email (emailVisibility)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-400" 
                  checked={editUserData.verified !== false} 
                  onChange={e => onEditUserDataChange({ ...editUserData, verified: e.target.checked })} 
                />
                <span>Status Terverifikasi (verified)</span>
              </label>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 flex gap-2 sticky bottom-0 bg-white">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs tracking-widest uppercase transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isProcessingUser} 
              className="flex-[2] py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-md transition-colors"
            >
              {isProcessingUser ? 'MENYIMPAN...' : 'SIMPAN USER'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
