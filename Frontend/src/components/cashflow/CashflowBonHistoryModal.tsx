import { Link } from 'react-router-dom';
import Modal from '../modal';
import DeleteAccess from '../delete-access';
import { formatRupiah } from '../../lib/money';
import { FileText, Trash2 } from 'lucide-react';
import type { DropdownItem } from './types';

interface CashflowBonHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bonHistoryUser: DropdownItem | null;
  bonHistoryData: any[];
  loadingBonHistory: boolean;
  userLevel: string;
  formatLocalDateTime: (isoString: string | undefined) => string;
  onDeleteBon: (bonId: string) => void;
}

export default function CashflowBonHistoryModal({
  isOpen,
  onClose,
  bonHistoryUser,
  bonHistoryData,
  loadingBonHistory,
  userLevel,
  formatLocalDateTime,
  onDeleteBon,
}: CashflowBonHistoryModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Riwayat Bon: ${bonHistoryUser?.text_1 || ''}`}
      maxWidth="max-w-4xl"
    >
      <div className="p-4 bg-slate-50 flex flex-col max-h-[80vh] overflow-hidden rounded-b-2xl">
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 flex justify-between items-center shrink-0">
          <div>
            <p className="text-xs text-slate-500">Total saldo bon saat ini</p>
            <p className="text-2xl font-semibold text-purple-700 tabular-nums">{formatRupiah(bonHistoryUser?.number_1 || 0)}</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-xl border border-slate-200">
          {loadingBonHistory ? (
            <div className="flex justify-center p-10">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : bonHistoryData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-bold">Belum ada riwayat bon.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider z-10">
                <tr>
                  <th className="p-3 pl-4">Waktu</th>
                  <th className="p-3">Jenis</th>
                  <th className="p-3">Nominal</th>
                  <th className="p-3">Keterangan</th>
                  {userLevel === '1' && <th className="p-3 pr-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bonHistoryData.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 pl-4 text-slate-700 whitespace-nowrap">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-xs font-bold text-slate-800 flex justify-between">
                          {formatLocalDateTime(b.created_at || b.created).split(' ')[0]} <br />
                          <span className="text-[10px] text-slate-400">{formatLocalDateTime(b.created_at || b.created).split(' ')[1]}</span>
                        </p>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                        (b.jenis || '').toLowerCase() === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {(b.jenis || '').toLowerCase() === 'in' ? 'BAYAR BON' : 'AMBIL BON'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                      {formatRupiah(b.nominal || 0)}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[200px] truncate" title={b.note}>
                      {b.note}
                      {b.ref_gaji && (
                        b.expand?.ref_gaji?.ref_baru ? (
                          <Link to={`/?ref=${encodeURIComponent(b.expand.ref_gaji.ref_baru)}`} className="ml-2 inline-flex items-center gap-1 text-teal-700 text-xs font-semibold" title="Buka slip dan ubah melalui transaksi gaji">
                            <FileText size={13} /> Buka gaji
                          </Link>
                        ) : (
                          <span className="ml-2 text-xs text-slate-500">Via Gaji</span>
                        )
                      )}
                    </td>
                    {userLevel === '1' && (
                      <td className="p-3 pr-4 text-right whitespace-nowrap flex justify-end space-x-2">
                        <DeleteAccess collection="bon" id={b.id}>
                          <button
                            onClick={() => onDeleteBon(b.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-semibold transition-colors"
                            title="Hapus riwayat bon"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        </DeleteAccess>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
