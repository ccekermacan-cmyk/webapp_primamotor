import Modal from '../modal';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export interface DialogState {
  show: boolean;
  title: string;
  message: string;
  type?: 'alert' | 'confirm';
  confirmLabel?: string;
  onConfirm?: () => void;
}

interface PosAlertDialogProps {
  dialog: DialogState;
  onClose: () => void;
}

export function PosAlertDialog({ dialog, onClose }: PosAlertDialogProps) {
  if (!dialog.show) return null;

  const titleLower = (dialog.title || '').toLowerCase();
  const msgLower = (dialog.message || '').toLowerCase();
  const isSuccess = titleLower.includes('sukses') || titleLower.includes('berhasil') || msgLower.includes('berhasil') || msgLower.includes('sukses');
  const isError = !isSuccess && (
    titleLower.includes('gagal') ||
    titleLower.includes('error') ||
    titleLower.includes('hapus') ||
    titleLower.includes('habis') ||
    titleLower.includes('batas') ||
    titleLower.includes('ganda') ||
    msgLower.includes('gagal') ||
    msgLower.includes('error')
  );

  const dialogTheme = isSuccess
    ? {
        iconWrap: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        btn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30',
        icon: <CheckCircle2 size={36} className="text-emerald-500" />
      }
    : isError
    ? {
        iconWrap: 'bg-rose-50 text-rose-600 border-rose-200',
        btn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30',
        icon: <AlertTriangle size={36} className="text-rose-500 animate-pulse" />
      }
    : {
        iconWrap: 'bg-amber-50 text-amber-600 border-amber-200',
        btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30',
        icon: <AlertTriangle size={36} className="text-amber-500" />
      };

  return (
    <Modal isOpen={dialog.show} onClose={onClose} title={dialog.title}>
      <div className="text-center p-4 sm:p-6">
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-inner border ${dialogTheme.iconWrap}`}>
          {dialogTheme.icon}
        </div>
        <p className="font-bold text-slate-700 text-sm sm:text-base leading-relaxed mb-6 whitespace-pre-line">{dialog.message}</p>
        <div className="flex gap-3">
          {dialog.type === 'confirm' && (
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs tracking-wider transition-colors cursor-pointer"
            >
              BATALKAN
            </button>
          )}
          <button
            onClick={dialog.onConfirm || onClose}
            className={`flex-[2] py-3.5 text-white rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all tracking-wider cursor-pointer ${dialogTheme.btn}`}
          >
            {dialog.confirmLabel || (dialog.type === 'confirm' ? 'YA, LANJUTKAN PROSES' : 'MENGERTI')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
