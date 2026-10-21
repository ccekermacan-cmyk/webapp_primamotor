import { useState } from 'react';
import { Banknote, CalendarDays, Wallet, FileText, Paperclip } from 'lucide-react';
import { salaryDetails, type SalaryEntry } from '../../lib/account';
import { formatRupiah as money } from '../../lib/money';
import '../pos/pos-modal.css';

export type SalaryRecord = SalaryEntry & { id?: string; person?: string; created_at?: string; note?: string; diterima?: number; file?: string[] };
export const salaryTabs = [
  { id: 'income', label: 'Pendapatan', Icon: Banknote },
  { id: 'deductions', label: 'Potongan', Icon: CalendarDays },
  { id: 'received', label: 'Penerimaan', Icon: Wallet },
  { id: 'notes', label: 'Catatan', Icon: FileText },
] as const;
export function SalaryTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <nav className="pos-modal-tabs" aria-label="Bagian slip gaji">{salaryTabs.map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)} className={value === id ? 'bg-teal-100 text-teal-800' : 'text-slate-500'}><Icon size={15} />{label}</button>)}</nav>;
}
export default function SalaryDetail({ record, fileUrl }: { record: SalaryRecord; fileUrl?: (name: string) => string }) {
  const [tab, setTab] = useState('income');
  const d = salaryDetails(record);
  const row = (label: string, value: number) => <div key={label} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-xs"><span className="text-slate-600">{label}</span><strong className="text-right">{money(value)}</strong></div>;
  return <div className="pos-modal-layout text-slate-800">
    <div className="p-4 bg-teal-50 rounded-xl"><div className="flex justify-between gap-3"><strong>{record.person || 'Slip gaji'}</strong><strong className="text-teal-800">{money(d.grandTotal)}</strong></div><p className="text-xs text-slate-500 mt-1">Netto • {record.created_at ? new Date(record.created_at).toLocaleDateString('id-ID') : 'Periode gaji'} • {record.qty ?? record.expand?.ref_baru?.qty ?? 1} hari kerja</p></div>
    <SalaryTabs value={tab} onChange={setTab} />
    <div className="pos-modal-scroll space-y-3">
      {tab === 'income' && <>{[['Gaji pokok', d.t1.pokok], ['Tunjangan', d.t1.tunjangan], ['Bonus 1', d.t1.bonus_1], ['Bonus 2', d.t1.bonus_2], ['Bonus 3', d.t1.bonus_3], ['Bonus 4', d.t1.bonus_4], ['Program', d.t1.program], ['Lembur', d.t1.lembur]].map(([label, value]) => row(String(label), Number(value)))}{row('Total pendapatan', d.total1)}</>}
      {tab === 'deductions' && <>{row(`Alfa (${record.alfa || 0} hari)`, d.t2.alfa)}{row(`Setengah hari (${record.setengah_hari || 0} hari)`, d.t2.setengah_hari)}{row(`Sakit (${record.sakit || 0} hari)`, d.t2.sakit)}{row(`Telat (${record.telat || 0} menit/kali)`, d.t2.telat)}{row('BPJS', d.t3.bpjs)}{row('Bon diambil', d.t3.bon_diambil)}{row('Bon dibayar', d.t3.bon_dibayar)}{row('Total potongan', d.total2 + d.total3)}</>}
      {tab === 'received' && <>{row('Netto hasil perhitungan', d.grandTotal)}{row('Jumlah diterima (input manual)', Number(record.diterima) || 0)}{row('Selisih diterima − netto', (Number(record.diterima) || 0) - d.grandTotal)}<p className="text-xs text-slate-500">Jumlah diterima dicatat terpisah. Selisih ini tidak otomatis menjadi bon atau pembayaran baru.</p></>}
      {tab === 'notes' && <><p className="text-sm whitespace-pre-wrap">{record.note || 'Tidak ada catatan.'}</p>{record.file?.map(name => fileUrl && <a key={name} href={fileUrl(name)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-teal-700 break-all"><Paperclip size={15} />{name}</a>)}{!record.file?.length && <p className="text-xs text-slate-500">Tidak ada lampiran.</p>}</>}
    </div>
  </div>;
}
