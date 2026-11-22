import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { loanSummary } from '../../lib/account';
import { formatRupiah } from '../../lib/money';
import type { BonItem, UserData } from '../../types/akun';

interface AccountBonSectionProps {
  bonList: BonItem[];
  allBon: BonItem[];
  userData: UserData | null;
  hideNominal: boolean;
  bonPage: number;
  bonTotalPages: number;
  onBonPageChange: (page: number) => void;
}

export default function AccountBonSection({
  bonList,
  allBon,
  userData,
  hideNominal,
  bonPage,
  bonTotalPages,
  onBonPageChange,
}: AccountBonSectionProps) {
  const loanTotals = loanSummary(allBon, Number(userData?.number || 0));
  const totalBon = loanTotals.balance;
  const formatNominalPrivasi = (value: number) => hideNominal ? 'Rp ••••••' : formatRupiah(value);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <FileText size={16} className="text-purple-600" /> Riwayat bon karyawan
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          {hideNominal ? 'Tersembunyi' : totalBon > 0 ? 'Ada saldo bon' : totalBon < 0 ? 'Saldo kredit' : 'Saldo nol'}
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-slate-700 tabular-nums">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs">Sisa bon saat ini</dt>
          <dd className="text-xl font-semibold text-purple-700">{formatNominalPrivasi(totalBon)}</dd>
        </div>
        <div>
          <dt className="text-xs">Total pinjaman</dt>
          <dd className="font-semibold">{formatNominalPrivasi(loanTotals.borrowed)}</dd>
        </div>
        <div>
          <dt className="text-xs">Total pembayaran</dt>
          <dd className="font-semibold">{formatNominalPrivasi(loanTotals.repaid)}</dd>
        </div>
      </dl>

      <p className="text-[11px] text-slate-500 mt-3">
        Rasio pelunasan {hideNominal ? '•••' : loanTotals.rate === null ? '—' : `${loanTotals.rate}%`} terhadap total pinjaman tercatat.
        Saldo awal atau koreksi dapat membuat sisa bon berbeda dari selisih riwayat.
      </p>
      <div className="space-y-3">
        {bonList.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-bold text-sm">Belum ada riwayat bon tercatat.</div>
        ) : (
          bonList.map((item) => {
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl hover:border-purple-200 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-slate-50 text-purple-600 rounded-lg shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{dateStr}</p>
                    <p className="font-semibold text-slate-700 text-sm truncate">{item.note || 'Bon karyawan'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.jenis === 'in' ? 'Pembayaran bon' : 'Pinjaman bon'}</p>
                    <p className="font-semibold text-purple-700 text-sm sm:text-base">
                      {formatNominalPrivasi(item.nominal || 0)}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold uppercase rounded-lg border border-purple-100 shrink-0">
                    {item.operator ? `Opr: ${item.operator}` : 'Bon'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION BON */}
      {bonList.length > 0 && (
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={bonPage === 1}
            onClick={() => onBonPageChange(bonPage - 1)}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 transition-colors"
          ><ChevronLeft size={14} /> Sebelumnya</button>
          <span className="text-xs text-slate-500">Hal {bonPage} / {bonTotalPages}</span>
          <button
            type="button"
            disabled={bonPage >= bonTotalPages}
            onClick={() => onBonPageChange(bonPage + 1)}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >Berikutnya <ChevronRight size={14} /></button>
        </div>
      )}
    </section>
  );
}
