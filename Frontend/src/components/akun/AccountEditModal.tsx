import React from 'react';
import { Lock } from 'lucide-react';
import Modal from '../modal';
import type { UserData } from '../../types/akun';

interface PasswordData {
  oldPassword: string;
  password: string;
  passwordConfirm: string;
}

interface AccountEditModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  formData: Partial<UserData>;
  passwordData: PasswordData;
  onClose: () => void;
  onFormDataChange: (data: Partial<UserData>) => void;
  onPasswordDataChange: (data: PasswordData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenChangeEmail: () => void;
}

export default function AccountEditModal({
  isOpen,
  isProcessing,
  formData,
  passwordData,
  onClose,
  onFormDataChange,
  onPasswordDataChange,
  onSubmit,
  onOpenChangeEmail,
}: AccountEditModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Profil">
      <form onSubmit={onSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name</label>
            <input 
              type="text" 
              required 
              value={formData.name || ''} 
              onChange={e => onFormDataChange({ ...formData, name: e.target.value })} 
              className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username</label>
            <input 
              disabled 
              type="text" 
              value={formData.username || ''} 
              className="w-full mt-1 p-3 bg-slate-200 text-slate-500 rounded-2xl outline-none border border-transparent font-bold cursor-not-allowed" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Status</label>
            <input 
              disabled 
              type="text" 
              value={formData.status || ''} 
              className="w-full mt-1 p-3 bg-slate-200 text-slate-500 rounded-2xl outline-none border border-transparent font-bold cursor-not-allowed" 
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
            <input 
              disabled 
              type="email" 
              value={formData.email || ''} 
              onChange={e => onFormDataChange({ ...formData, email: e.target.value })} 
              className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" 
            />
          </div>
          <button 
            type="button" 
            disabled={isProcessing} 
            onClick={onOpenChangeEmail} 
            className="sm:col-span-2 text-left text-blue-600 font-bold text-xs underline"
          >
            Ubah email melalui tautan konfirmasi
          </button>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Image Link (Avatar URL)</label>
            <input 
              type="url" 
              value={formData.link_image || ''} 
              onChange={e => onFormDataChange({ ...formData, link_image: e.target.value })} 
              className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" 
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Lock size={14} className="text-rose-500" /> Ganti Password (Opsional)
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password Saat Ini</label>
              <input 
                type="password" 
                autoComplete="current-password"
                placeholder="Wajib jika mengubah password"
                value={passwordData.oldPassword} 
                onChange={e => onPasswordDataChange({ ...passwordData, oldPassword: e.target.value })} 
                className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password Baru</label>
                <input 
                  type="password" 
                  autoComplete="new-password" 
                  minLength={8}
                  value={passwordData.password} 
                  onChange={e => onPasswordDataChange({ ...passwordData, password: e.target.value })} 
                  className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ulangi Password Baru</label>
                <input 
                  type="password" 
                  autoComplete="new-password" 
                  minLength={8}
                  value={passwordData.passwordConfirm} 
                  onChange={e => onPasswordDataChange({ ...passwordData, passwordConfirm: e.target.value })} 
                  className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={isProcessing} className="w-full py-3.5 sm:py-4 bg-slate-800 text-white rounded-2xl font-black shadow-xl mt-4">
          {isProcessing ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
        </button>
      </form>
    </Modal>
  );
}
