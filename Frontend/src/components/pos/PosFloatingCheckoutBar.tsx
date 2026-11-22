import { ShoppingCart, Zap } from 'lucide-react';
import { formatRupiah } from '../../lib/money';

interface PosFloatingCheckoutBarProps {
  cartLength: number;
  isPaymentFormOpen: boolean;
  showReceiptPrint: boolean;
  activeTheme: { main: string };
  totalQtyKeranjang: number;
  selectedMenu: string;
  grandTotal: number;
  isProcessing: boolean;
  processingMsg?: string;
  onOpenPayment: () => void;
}

export function PosFloatingCheckoutBar({
  cartLength,
  isPaymentFormOpen,
  showReceiptPrint,
  activeTheme,
  totalQtyKeranjang,
  selectedMenu,
  grandTotal,
  isProcessing,
  processingMsg,
  onOpenPayment,
}: PosFloatingCheckoutBarProps) {
  if (cartLength === 0 || isPaymentFormOpen || showReceiptPrint) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-slate-900/95 backdrop-blur-md text-white p-3.5 px-5 flex items-center justify-between border-t border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-10 h-10 rounded-xl ${activeTheme.main} flex items-center justify-center font-black text-sm text-white shadow-sm`}>
            <ShoppingCart size={18} />
          </div>
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm">
            {totalQtyKeranjang}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total ({selectedMenu})</p>
          <p className="text-base font-black text-white tracking-tight">{formatRupiah(grandTotal)}</p>
        </div>
      </div>
      <button
        onClick={onOpenPayment}
        className={`py-3 px-5 ${activeTheme.main} hover:brightness-110 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-60 cursor-pointer`}
        disabled={isProcessing}
      >
        {isProcessing ? processingMsg || 'Menyimpan...' : <><Zap size={15} fill="currentColor" /> BAYAR (1-TAP)</>}
      </button>
    </div>
  );
}
