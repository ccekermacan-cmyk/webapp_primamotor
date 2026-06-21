import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  maxWidth?: string;             // Kontrol lebar dinamis untuk modal standard
  
  // --- PROPS REUSABLE DARI LAYOUT.TSX (ALERT/CONFIRM DIALOG) ---
  isAlert?: boolean;             // Aktifkan mode alert/konfirmasi
  alertIcon?: React.ReactNode;   // Ikon di tengah atas
  alertIconBg?: string;          // Class warna ikon (cth: 'bg-rose-50 text-rose-500 border-rose-100')
  alertDescription?: React.ReactNode; // Menggunakan ReactNode agar bisa menerima tag HTML
  onConfirm?: () => void;        // Fungsi saat tombol kanan diklik
  confirmText?: string;          // Teks tombol kanan
  cancelText?: string;           // Teks tombol kiri
  confirmBg?: string;            // Class warna tombol kanan 
  showCancel?: boolean;          // Sembunyikan tombol batal jika hanya alert info
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  maxWidth = 'max-w-md',         
  isAlert = false,
  alertIcon,
  alertIconBg = 'bg-rose-50 text-rose-500 border-rose-100',
  alertDescription,
  onConfirm,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  confirmBg = 'bg-rose-600 hover:bg-rose-500 shadow-rose-200',
  showCancel = true              
}: ModalProps) {
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
      onClick={onClose} 
    >
      <div 
        // Desain kontainer dinamis tergantung mode (Default vs Alert)
        className={`bg-white shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200 overflow-hidden w-full ${
          isAlert ? 'p-6 max-w-sm rounded-[2rem] text-center space-y-4' : `${maxWidth} rounded-3xl border border-gray-100`
        }`}
        onClick={(e) => e.stopPropagation()} 
      >
        {/* ========================================= */}
        {/* RENDER MODE ALERT/CONFIRM                 */}
        {/* ========================================= */}
        {isAlert ? (
          <>
            {alertIcon && (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border shadow-sm ${alertIconBg}`}>
                {alertIcon}
              </div>
            )}
            <div>
              {title && <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{title}</h3>}
              {alertDescription && <p className="text-xs text-slate-400 font-medium mt-1">{alertDescription}</p>}
            </div>
            
            <div className="flex gap-2 pt-2">
              {showCancel && (
                <button 
                  onClick={onClose} 
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 border rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  {cancelText}
                </button>
              )}
              <button 
                onClick={onConfirm || onClose} 
                className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-colors ${confirmBg}`}
              >
                {confirmText}
              </button>
            </div>
          </>
        ) : (
        /* ========================================= */
        /* RENDER MODE MODAL STANDARD                */
        /* ========================================= */
          <>
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
              <button 
                onClick={onClose} 
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {children}
            </div>
          </>
        )}
      </div>
    </div>
  );
}