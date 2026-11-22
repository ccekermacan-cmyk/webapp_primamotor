import { Calendar, ChevronLeft, ChevronRight, DollarSign, Eye } from 'lucide-react';
import { salaryDetails as getSalaryDetails } from '../../lib/account';
import { formatRupiah } from '../../lib/money';
import type { Gaji, UserData } from '../../types/akun';

interface AccountSalarySectionProps {
  salaryList: Gaji[];
  allSalary: Gaji[];
  userData: UserData | null;
  hideNominal: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectSalary: (item: Gaji) => void;
}

export default function AccountSalarySection({
  salaryList,
  allSalary,
  userData,
  hideNominal,
  page,
  totalPages,
  onPageChange,
  onSelectSalary,
}: AccountSalarySectionProps) {
  const totalGaji = allSalary.reduce((sum, row) => sum + getSalaryDetails(row).grandTotal, 0);
  const rataGaji = allSalary.length > 0 ? totalGaji / allSalary.length : 0;
  const formatNominalPrivasi = (value: number) => hideNominal ? 'Rp ••••••' : formatRupiah(value);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-600" /> Riwayat gaji karyawan
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          {allSalary.length > 0 ? 'Tercatat' : 'Belum ada'}
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-slate-700 tabular-nums">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs">Total gaji neto</dt>
          <dd className="text-xl font-semibold text-emerald-700">{formatNominalPrivasi(totalGaji)}</dd>
        </div>
        <div>
          <dt className="text-xs">Periode tercatat</dt>
          <dd className="font-semibold">{allSalary.length}</dd>
        </div>
        <div>
          <dt className="text-xs">Rata-rata per periode</dt>
          <dd className="font-semibold">{formatNominalPrivasi(rataGaji)}</dd>
        </div>
      </dl>

      <p className="text-[11px] text-slate-500 mt-3">
        Perhitungan: gaji pokok + tunjangan + lembur, dikurangi absensi, potongan lain, dan bon.
        Rincian slip hanya dibuka setelah verifikasi password.
      </p>

      <div className="space-y-3">
        {salaryList.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-bold text-sm">Belum ada riwayat gaji tercatat.</div>
        ) : (
          salaryList.map((item) => {
            const { grandTotal } = getSalaryDetails(item);
            const periode = new Date(item.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const personName = item.person === userData?.username ? userData.name || item.person : item.person || 'Karyawan tidak tercatat';

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelectSalary(item)}
                className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-lg shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{personName}</p>
                    <p className="font-semibold text-slate-800 text-sm">Gaji periode {periode}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Gaji neto</p>
                    <p className="font-semibold text-emerald-700 text-sm sm:text-base">
                      {formatNominalPrivasi(grandTotal)}
                    </p>
                  </div>
                  <span className="p-1.5 bg-slate-50 text-slate-500 rounded-lg shrink-0">
                    <Eye size={15} />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* PAGINATION GAJI */}
      {salaryList.length > 0 && (
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 transition-colors"
          ><ChevronLeft size={14} /> Sebelumnya</button>
          <span className="text-xs text-slate-500">Hal {page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >Berikutnya <ChevronRight size={14} /></button>
        </div>
      )}
    </section>
  );
}
