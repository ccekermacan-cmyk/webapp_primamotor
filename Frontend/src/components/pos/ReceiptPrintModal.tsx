import React from 'react';
import Modal from '../modal';
import { Share2, Printer } from 'lucide-react';

interface ReceiptPrintModalProps {
  showReceiptPrint: any;
  setShowReceiptPrint: (val: any) => void;
  receiptRef: React.RefObject<HTMLDivElement>;
  formatLocalDateTime: (isoString: string | undefined) => string;
  operatorName: string;
  getFullLabel: (item: any) => string;
  printWithRawBT: (htmlContent: string) => void;
  setDialog: (dialog: any) => void;
  activeTheme: any;
  setCart: (cart: any[]) => void;
  setIsPaymentFormOpen: (val: boolean) => void;
  setFormBayar: React.Dispatch<React.SetStateAction<any>>;
  getLocalDatetimeInput: () => string;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  showReceiptPrint,
  setShowReceiptPrint,
  receiptRef,
  formatLocalDateTime,
  operatorName,
  getFullLabel,
  printWithRawBT,
  setDialog,
  activeTheme,
  setCart,
  setIsPaymentFormOpen,
  setFormBayar,
  getLocalDatetimeInput,
}) => {
  if (!showReceiptPrint) return null;

  return (
    <Modal isOpen={!!showReceiptPrint} onClose={() => setShowReceiptPrint(null)} title="Print Antrian Kasir">
      <div className="space-y-6 flex flex-col items-center">
        <div className="bg-slate-100 p-4 w-full rounded-2xl flex justify-center items-center shadow-inner">
          {/* Box Putih simulasi kertas thermal */}
          <div ref={receiptRef} className="border-t-[8px] border-b-[8px] border-t-slate-800 border-b-white bg-white w-[280px] text-slate-900 font-mono text-xs shadow-xl rounded-sm" id="thermal-receipt-58mm"> 
            {/* HEADER TOKO */}
            <div className="text-center space-y-1.5 border-b-2 border-dashed border-slate-300 pb-4 pt-4 px-3"> 
              <h4 className="font-black text-base tracking-wide">PRIMA MOTOR GLADAG</h4> 
              <p className="text-[10px] font-bold">Jl. Raya Gladag, Rogojampi</p> 
              <p className="text-[10px] font-bold">Banyuwangi - Jawa Timur</p> 
              <p className="text-[10px] font-bold mt-1">WA: 081-XXXX-XXXX</p> 
            </div> 

            {/* INFORMASI NOTA */}
            <div className="py-3 px-3 border-b-2 border-dashed border-slate-300 text-[10px] space-y-1 font-bold">
              <div className="flex justify-between"><span className="text-slate-500">Nota:</span> <span>{showReceiptPrint.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Waktu:</span> <span>{formatLocalDateTime(showReceiptPrint.timestamp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cust:</span> <span>{showReceiptPrint.customer}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Kasir:</span> <span>{operatorName}</span></div>
              {showReceiptPrint.jenis && <div className="flex justify-between"><span className="text-slate-500">Jenis:</span> <span className="uppercase">{showReceiptPrint.jenis}</span></div>}
            </div>

            {/* DAFTAR ITEM PRODUK & MEKANIK */}
            <div className="py-3 px-3 border-b-2 border-dashed border-slate-300 text-[10px] space-y-3">
              {/* Item Produk */}
              {showReceiptPrint.items?.map((item: any, idx: number) => (
                <div key={idx} className="space-y-0.5">
                  <p className="font-bold uppercase break-words leading-tight">
                    {getFullLabel(item)}
                  </p>
                  <div className="flex justify-between text-slate-600 font-bold">
                    <span>{item.qty} {item.unit} x {item.priceSelected?.toLocaleString('id-ID')}</span>
                    <span className="text-slate-900 font-black">
                      {(item.priceSelected * item.qty)?.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}

              {/* Separator jika ada mekanik */}
              {showReceiptPrint.mechanics && showReceiptPrint.mechanics.length > 0 && (
                <div className="border-t border-slate-200 my-2 pt-2">
                  <p className="font-black text-center text-[9px] uppercase tracking-widest text-slate-500 mb-2">- BIAYA SERVIS JASA -</p>
                </div>
              )}

              {/* Servis Mekanik */}
              {showReceiptPrint.mechanics?.map((m: any, idx: number) => (
                <div key={`mech-${idx}`} className="space-y-0.5">
                  <p className="font-bold uppercase">MEK: {m.name}</p>
                  <div className="flex justify-between text-slate-600 font-bold">
                    <span>1 Jasa x {m.ongkos.toLocaleString('id-ID')}</span>
                    <span className="text-slate-900 font-black">
                      {m.ongkos.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* TOTAL DAN PEMBAYARAN */}
            <div className="py-3 px-3 space-y-1.5 text-[10px] bg-slate-50 border-b-2 border-dashed border-slate-300">
              <div className="flex justify-between font-black text-sm text-slate-900">
                <span>TOTAL:</span>
                <span>Rp {showReceiptPrint.total?.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>DIBAYAR:</span>
                <span>Rp {showReceiptPrint.cash?.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>KEMBALI:</span>
                <span>Rp {showReceiptPrint.change?.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* FOOTER */}
            <div className="py-4 text-center space-y-1 bg-white">
              <p className="font-black text-[10px]">TERIMA KASIH</p>
              <p className="font-bold text-[9px] text-slate-500">Barang yang dibeli tidak dapat ditukar</p>
            </div>
          </div>
        </div>

        {/* TOMBOL CETAK, SHARE & BATAL */}
        <div className="flex flex-col sm:flex-row w-full gap-3 mt-2"> 
          <button 
            type="button"
            onClick={() => {
              if (!showReceiptPrint?.id) return;
              const items = (showReceiptPrint.items || []).map((i: any) => 
                `${getFullLabel(i)} | Qty: ${i.qty} @ ${Number(i.priceSelected).toLocaleString('id-ID')} = ${Number(i.priceSelected * i.qty).toLocaleString('id-ID')}`
              ).join('\n');
              const text = `*NOTA ${showReceiptPrint.jenis?.toUpperCase() || ''}*\nID: ${showReceiptPrint.id}\n${formatLocalDateTime(showReceiptPrint.timestamp)}\nPelanggan: ${showReceiptPrint.customer}\nTotal: Rp ${Number(showReceiptPrint.total).toLocaleString('id-ID')}\nDibayar: Rp ${Number(showReceiptPrint.cash).toLocaleString('id-ID')}\n\nItems:\n${items}`;
              navigator.clipboard.writeText(text).then(() => {
                setDialog({ show: true, title: 'Berhasil', message: 'Detail nota disalin ke clipboard!', type: 'alert' });
              }).catch(() => alert('Gagal menyalin ke clipboard'));
            }}
            className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-amber-500/30 hover:-translate-y-1 active:translate-y-0 transition-all tracking-widest flex justify-center items-center gap-2">
            <Share2 size={18}/> SHARE
          </button>
          <button 
            type="button"
            onClick={() => {
              const receiptElement = document.getElementById('thermal-receipt-58mm');
              if (receiptElement) {
                printWithRawBT(receiptElement.outerHTML);
              } else {
                alert("Konten kertas nota gagal di-render oleh DOM.");
              }
            }} 
            className={`flex-[2] py-4 ${activeTheme.main} text-white rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-${activeTheme.main.replace('bg-','')}/40 hover:-translate-y-1 hover:brightness-110 active:translate-y-0 transition-all tracking-widest flex justify-center items-center gap-2`}>
            <Printer size={18}/> PRINT
          </button>
          <button 
            type="button"
            onClick={() => {
              setShowReceiptPrint(null);
              setCart([]);
              setIsPaymentFormOpen(false);
              setFormBayar({
                personIdLama: 'umum1',
                payment: 'Tunai',
                nominalBayar: 0,
                cashflowList: [{ accountId: '', nominal: 0 }],
                mekanikList: [{ idLama: '', ongkos: 0 }],
                note: '',
                noteMenu: '',
                tempoDate: '',
                marketplace: '',
                adminFee: 0,
                cashback: 0,
                createdAt: getLocalDatetimeInput()
              });
            }}
            className="px-6 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black text-xs md:text-sm transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </Modal>
  );
};
