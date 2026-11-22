import { Link } from 'react-router-dom';
import Modal from '../modal';
import DeleteAccess from '../delete-access';
import { pb } from '../../lib/pocketbase';
import { formatRupiah } from '../../lib/money';
import { Layers, User, ExternalLink, FileText, ImagePlus, Trash2 } from 'lucide-react';
import type { Cashflow } from './types';

interface CashflowDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTx: Cashflow | null;
  formatLocalDateTime: (isoString: string | undefined) => string;
  getAccountName: (accountId: string | undefined) => string;
  getPersonName: (personId: string | undefined, persontextFallback?: string) => string;
  userLevel: string;
  isProcessing: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

export default function CashflowDetailModal({
  isOpen,
  onClose,
  selectedTx,
  formatLocalDateTime,
  getAccountName,
  getPersonName,
  userLevel,
  isProcessing,
  onDelete,
  onEdit,
}: CashflowDetailModalProps) {
  if (!selectedTx) return null;

  const isTransfer = (selectedTx.jenis || '').toLowerCase().includes('transfer');
  const isMasuk = selectedTx.mutasi?.toLowerCase() === 'in';
  const txtColor = isTransfer ? 'text-indigo-600' : (isMasuk ? 'text-emerald-600' : 'text-rose-600');
  const mutasiLabel = isTransfer ? 'TRANSFER INTERNAL KAS' : (isMasuk ? 'KAS MASUK (DEBET)' : 'KAS KELUAR (KREDIT)');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Log Transaksi Kas"
    >
      <div className="flex flex-col max-h-[75vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
        <div className={`flex flex-col p-5 sm:p-7 md:p-8 rounded-3xl sm:rounded-[2rem] text-white relative shadow-xl overflow-hidden shrink-0 ${isTransfer ? 'bg-indigo-500' : (isMasuk ? 'bg-emerald-500' : 'bg-rose-500')}`}>
          {/* Efek Latar Belakang */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl opacity-20 pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black rounded-full blur-3xl opacity-10 pointer-events-none" />
          
          {/* Label KAS MASUK / KELUAR */}
          <div className="relative z-10 flex justify-center mb-2">
            <span className="bg-white/20 border border-white/30 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest backdrop-blur-md shadow-sm">
              {mutasiLabel}
            </span>
          </div>
          
          {/* Nominal Transaksi */}
          <div className="relative z-10 flex flex-col justify-center items-center my-4 sm:my-6">
            <span className="text-white/80 text-[10px] sm:text-xs font-bold mb-1 uppercase tracking-wider">Total Nominal</span>
            <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter drop-shadow-md break-words text-center px-2 w-full leading-tight">
              {isTransfer ? '↔ ' : (isMasuk ? '+ ' : '- ')}{formatRupiah(selectedTx.nominal)}
            </p>
          </div>

          {/* Informasi Detail Ekstra (ID, Waktu, Operator) */}
          <div className="relative z-10 mt-auto bg-black/15 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-sm flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-center text-[10px] sm:text-xs shadow-inner">
             <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
                <span className="text-white/60 font-bold uppercase tracking-wider text-[9px]">ID Transaksi</span>
                <span className="font-mono font-bold truncate max-w-[150px] sm:max-w-[200px]">{selectedTx.ref || selectedTx.id}</span>
             </div>
             
             <div className="hidden sm:block w-px h-8 bg-white/20" />
             
             <div className="flex flex-col items-center text-center w-full sm:w-auto border-t border-white/10 sm:border-0 pt-2 sm:pt-0">
                <span className="text-white/60 font-bold uppercase tracking-wider text-[9px]">Waktu Transaksi</span>
                <span className="font-bold">{formatLocalDateTime(selectedTx.created_at)}</span>
             </div>
             
             <div className="hidden sm:block w-px h-8 bg-white/20" />
             
             <div className="flex flex-col items-center sm:items-end text-center sm:text-right w-full sm:w-auto border-t border-white/10 sm:border-0 pt-2 sm:pt-0">
                <span className="text-white/60 font-bold uppercase tracking-wider text-[9px]">Operator</span>
                <span className="font-bold flex items-center gap-1.5"><User size={12} /> {selectedTx.operator || '-'}</span>
             </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 text-xs font-medium">
          <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm space-y-3">
            <p className={`font-black text-[11px] ${txtColor} uppercase border-b-2 border-slate-200 pb-3 mb-2 flex items-center gap-2`}>
              <Layers size={16} /> Entitas: Data Jurnal Kas
            </p>
            <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-slate-400 font-bold">Waktu Transaksi:</span>
              <span className="font-bold text-slate-700 sm:text-right">{formatLocalDateTime(selectedTx.created_at)}</span>
            </p>
            <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-slate-400 font-bold">Operator:</span>
              <span className="font-bold text-slate-700 sm:text-right">{selectedTx.operator || '-'}</span>
            </p>
            <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-2 pt-2 border-t border-dashed border-slate-200">
              <span className="text-slate-400 font-bold">Kategori/Jenis:</span>
              <span className="font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded uppercase self-start sm:self-auto">{selectedTx.jenis}</span>
            </p>
            <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-slate-400 font-bold">Akun Sumber:</span>
              <span className="font-bold text-slate-700 sm:text-right">{getAccountName(selectedTx.account_1)}</span>
            </p>
            {selectedTx.account_2 && (
              <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-slate-400 font-bold">Akun Tujuan:</span>
                <span className="font-bold text-blue-600 sm:text-right">{getAccountName(selectedTx.account_2)}</span>
              </p>
            )}
            <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-slate-400 font-bold">Pihak Terkait:</span>
              <span className="font-bold text-slate-700 sm:text-right">{getPersonName(selectedTx.person, selectedTx.persontext)}</span>
            </p>
            {selectedTx.ref_baru && (
              <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mt-2 pt-2 border-t border-dashed border-slate-200">
                <span className="text-slate-400 font-bold">Ref Transaksi POS:</span>
                <Link
                  to={`/?ref=${encodeURIComponent(selectedTx.ref_baru)}`}
                  title="Buka detail transaksi di POS"
                  className="inline-flex items-center gap-1.5 font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 self-start sm:self-auto hover:bg-blue-100 hover:underline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  {selectedTx.ref_baru}
                  <ExternalLink size={13} aria-hidden="true" />
                </Link>
              </p>
            )}
            {(userLevel === '1' || userLevel === '2' || userLevel === '5') && (selectedTx.saldo_awal != null || selectedTx.saldo_akhir != null) && (
              <div className="mt-2 pt-3 border-t border-dashed border-slate-200 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Saldo akun sumber</p>
                <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="text-slate-500 font-bold">Saldo Sebelum Transaksi:</span>
                  <span className="font-bold text-slate-700 sm:text-right">
                    {selectedTx.saldo_awal == null ? 'Belum tersedia' : formatRupiah(selectedTx.saldo_awal)}
                  </span>
                </p>
                <p className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="text-slate-500 font-bold">Saldo Sesudah Transaksi:</span>
                  <span className="font-bold text-emerald-700 sm:text-right">
                    {selectedTx.saldo_akhir == null ? 'Belum tersedia' : formatRupiah(selectedTx.saldo_akhir)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm flex flex-col">
            <p className={`font-black text-[11px] ${txtColor} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
              <FileText size={16} /> Catatan & Keterangan
            </p>
            <p className="text-sm font-bold text-slate-700 italic leading-relaxed">
              "{selectedTx.note || 'Tidak ada catatan'}"
            </p>
          </div>

          {selectedTx.file && selectedTx.file.length > 0 && (
            <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm flex flex-col">
              <p className={`font-black text-[11px] ${txtColor} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
                <ImagePlus size={16} /> Bukti Lampiran Media
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {selectedTx.file.map((f, i) => {
                  const fileUrl = pb.files.getUrl(selectedTx, f);
                  return (
                    <div
                      key={i}
                      className={`relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square ${
                        isTransfer ? 'bg-indigo-100' : (isMasuk ? 'bg-emerald-100' : 'bg-rose-100')
                      }`}
                    >
                      {f.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={fileUrl} className="w-full h-full object-cover opacity-90" />
                      ) : (
                        <img src={fileUrl} alt={`Lampiran ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                      )}
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`absolute inset-0 ${
                          isTransfer ? 'bg-indigo-900/40' : (isMasuk ? 'bg-emerald-900/40' : 'bg-rose-900/40')
                        } opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm`}
                      >
                        <ExternalLink size={24} className="text-white drop-shadow-lg scale-75 group-hover:scale-100 transition-transform" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 pb-2 border-t-2 border-slate-100 sticky bottom-0 bg-white z-20">
          <div className="grid grid-cols-4 md:flex gap-3">
            {/* Tombol Hapus */}
            <DeleteAccess collection="cashflow" id={selectedTx.id}>
              <button
                onClick={onDelete}
                disabled={isProcessing}
                className="col-span-1 md:w-14 h-12 md:h-14 flex-shrink-0 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-500 hover:text-white border border-rose-100 hover:shadow-lg transition-all flex justify-center items-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-50 disabled:hover:text-rose-600"
                title="Hapus transaksi"
              >
                <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </DeleteAccess>
            
            {/* Tombol Edit */}
            <button 
              onClick={onEdit}
              disabled={isProcessing}
              className="col-span-3 md:flex-1 h-12 md:h-14 bg-blue-500 text-white rounded-xl font-black text-[11px] md:text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500"
            >
              Edit Transaksi
            </button>
            
            {/* Tombol Tutup */}
            <button 
              onClick={onClose} 
              className="col-span-4 md:flex-[2] h-12 md:h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs tracking-widest shadow-xl transition-all active:scale-95 uppercase flex items-center justify-center"
            >
              TUTUP DETAIL
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
