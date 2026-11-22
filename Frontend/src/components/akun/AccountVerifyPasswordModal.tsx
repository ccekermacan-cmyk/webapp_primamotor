import React from 'react';
import { Lock } from 'lucide-react';
import Modal from '../modal';

interface AccountVerifyPasswordModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  verifyPass: string;
  onClose: () => void;
  onVerifyPassChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AccountVerifyPasswordModal({
  isOpen,
  isProcessing,
  verifyPass,
  onClose,
  onVerifyPassChange,
  onSubmit,
}: AccountVerifyPasswordModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Otentikasi Keamanan & Privasi">
      <form onSubmit={onSubmit} className="text-center space-y-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
          <Lock size={28} className="sm:w-8 sm:h-8" />
        </div>
        <div>
          <h4 className="font-black text-slate-800 uppercase tracking-tight">Verifikasi Akses Privasi</h4>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Masukkan password akun Anda untuk membuka tampilan nominal gaji & bon.</p>
        </div>
        <input 
          type="password" 
          required
          value={verifyPass}
          onChange={e => onVerifyPassChange(e.target.value)}
          placeholder="Password Login Anda"
          className="w-full p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg sm:text-xl outline-none focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-800"
        />
        <div className="flex gap-3">
          <button 
            type="button" 
            disabled={isProcessing} 
            onClick={onClose} 
            className="flex-1 py-3.5 sm:py-4 bg-slate-100 rounded-2xl font-black text-slate-500 text-xs uppercase tracking-wider hover:bg-slate-200"
          >
            BATAL
          </button>
          <button 
            type="submit" 
            disabled={isProcessing} 
            className="flex-1 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg"
          >
            BUKA PRIVASI
          </button>
        </div>
      </form>
    </Modal>
  );
}
