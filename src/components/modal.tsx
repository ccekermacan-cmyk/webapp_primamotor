import React from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  maxWidth?: string;             // Kontrol lebar dinamis untuk modal standard
  
  // --- PROPS REUSABLE DARI LAYOUT.TSX (ALERT/CONFIRM DIALOG) ---
  isAlert?: boolean;             // Aktifkan mode alert/konfirmasi
  type?: 'success' | 'error' | 'warning' | 'info';
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
  type,
  alertIcon,
  alertIconBg,
  alertDescription,
  onConfirm,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  confirmBg,
  showCancel = true              
}: ModalProps) {
  
  if (!isOpen) return null;

  // Deteksi jenis status secara otomatis dari judul/deskripsi jika prop type tidak diisi
  const titleLower = (title || '').toLowerCase();
  const descLower = typeof alertDescription === 'string' ? alertDescription.toLowerCase() : '';

  let detectedType: 'success' | 'error' | 'warning' | 'info' = type || 'info';
  if (!type) {
    if (titleLower.includes('sukses') || titleLower.includes('berhasil') || descLower.includes('berhasil') || descLower.includes('sukses')) {
      detectedType = 'success';
    } else if (titleLower.includes('gagal') || titleLower.includes('error') || titleLower.includes('hapus') || descLower.includes('gagal') || descLower.includes('batal')) {
      detectedType = 'error';
    } else if (titleLower.includes('perhatian') || titleLower.includes('yakin') || titleLower.includes('peringatan') || descLower.includes('yakin')) {
      detectedType = 'warning';
    }
  }

  // Skema warna responsif bertema berdasarkan status
  const themeConfig = {
    success: {
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      icon: <CheckCircle2 size={28} className="text-emerald-500" />,
      buttonBg: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      cardBorder: 'border-emerald-100',
    },
    error: {
      iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
      icon: <XCircle size={28} className="text-rose-500" />,
      buttonBg: 'bg-rose-600 hover:bg-rose-500 shadow-rose-200',
      cardBorder: 'border-rose-100',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      icon: <AlertTriangle size={28} className="text-amber-500" />,
      buttonBg: 'bg-amber-600 hover:bg-amber-500 shadow-amber-200',
      cardBorder: 'border-amber-100',
    },
    info: {
      iconBg: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      icon: <Info size={28} className="text-cyan-500" />,
      buttonBg: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-200',
      cardBorder: 'border-cyan-100',
    }
  }[detectedType];

  const finalIconBg = alertIconBg || themeConfig.iconBg;
  const finalIcon = alertIcon || themeConfig.icon;
  const finalConfirmBg = confirmBg || themeConfig.buttonBg;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
      onClick={onClose} 
    >
      <div 
        // Desain kontainer dinamis tergantung mode (Default vs Alert)
        className={`bg-white shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200 overflow-hidden w-full ${
          isAlert 
            ? `p-6 max-w-sm rounded-[2.5rem] text-center space-y-4 border ${themeConfig.cardBorder}` 
            : `${maxWidth} rounded-2xl border border-slate-200`
        }`}
        onClick={(e) => e.stopPropagation()} 
      >
        {/* ========================================= */}
        {/* RENDER MODE ALERT/CONFIRM                 */}
        {/* ========================================= */}
        {isAlert ? (
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border shadow-sm ${finalIconBg}`}>
              {finalIcon}
            </div>
            <div>
              {title && <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{title}</h3>}
              {alertDescription && <div className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">{alertDescription}</div>}
            </div>
            
            <div className="flex gap-2 pt-2">
              {showCancel && (
                <button 
                  onClick={onClose} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors"
                >
                  {cancelText}
                </button>
              )}
              <button 
                onClick={onConfirm || onClose} 
                className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all transform active:scale-95 ${finalConfirmBg}`}
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
            <div className="flex justify-between items-center p-5 px-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>
              <button 
                onClick={onClose} 
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[80vh]">
              {children}
            </div>
          </>
        )}
      </div>
    </div>
  );
}