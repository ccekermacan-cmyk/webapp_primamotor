import React from 'react';
import { Wrench, Trash2 } from 'lucide-react';

interface MekanikItem {
  idLama: string;
  ongkos: number;
}

interface MechanicSectionProps {
  selectedMenu: string;
  activeTheme: any;
  formBayar: {
    mekanikList: MekanikItem[];
    [key: string]: any;
  };
  setFormBayar: React.Dispatch<React.SetStateAction<any>>;
  grandTotal: number;
  mechanics: any[];
  setDialog: (dialog: any) => void;
}

export const MechanicSection: React.FC<MechanicSectionProps> = React.memo(({
  selectedMenu,
  activeTheme,
  formBayar,
  setFormBayar,
  grandTotal,
  mechanics,
  setDialog,
}) => {
  if (!selectedMenu.toLowerCase().includes('service')) return null;

  return (
    <div className={`${activeTheme.light} p-5 rounded-3xl border-2 ${activeTheme.border} space-y-4 shadow-sm`}>
      <div className="flex justify-between items-center flex-wrap gap-2">
        <span className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-wider flex items-center gap-2`}>
          <Wrench size={16}/> Alokasi Mekanik & Ongkos
        </span>
        <div className="flex items-center gap-1.5">
          {formBayar.mekanikList.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const count = formBayar.mekanikList.length;
                if (count === 0) return;
                const totalOngkosEst = grandTotal > 0 ? grandTotal : 0;
                const divided = Math.floor(totalOngkosEst / count);
                const remainder = totalOngkosEst % count;
                const newList = formBayar.mekanikList.map((m, idx) => ({
                  ...m,
                  ongkos: idx === 0 ? divided + remainder : divided
                }));
                setFormBayar(prev => ({ ...prev, mekanikList: newList }));
              }}
              className={`text-[10px] font-black bg-white ${activeTheme.text} px-3 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border} flex items-center gap-1`}
              title="Bagi rata ongkos ke semua mekanik"
            >
              ⚖️ Bagi Rata
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setFormBayar(prev => ({
                ...prev,
                mekanikList: [...prev.mekanikList, { idLama: '', ongkos: 0 }]
              }));
            }}
            className={`text-[10px] font-black bg-white ${activeTheme.text} px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent hover:${activeTheme.border}`}
          >
            + Tambah Mekanik
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
      {formBayar.mekanikList.map((mek, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-white p-2.5 rounded-2xl border border-white/50 shadow-sm">
          {/* Tombol Hapus Baris Mekanik */}
          {formBayar.mekanikList.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setFormBayar(prev => ({
                  ...prev,
                  mekanikList: prev.mekanikList.filter((_, i) => i !== idx)
                }));
              }}
              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors self-end sm:self-auto order-1 sm:order-none"
              title="Hapus mekanik"
            >
              <Trash2 size={16} />
            </button>
          )}
          <select
            value={mek.idLama}
            onChange={e => {
              const selectedMekanik = e.target.value;
              const isDuplicate = formBayar.mekanikList.some((m, i) => i !== idx && m.idLama === selectedMekanik);
              if (selectedMekanik && isDuplicate) {
                setDialog({ show: true, title: 'Mekanik Ganda', message: 'Mekanik sudah dipilih di baris lain!', type: 'alert' });
                return;
              }
              const newList = [...formBayar.mekanikList];
              newList[idx].idLama = selectedMekanik;
              setFormBayar(prev => ({ ...prev, mekanikList: newList }));
            }}
            className="flex-1 p-3 text-xs md:text-sm font-bold text-slate-700 border-none bg-slate-50 hover:bg-slate-100 rounded-xl outline-none cursor-pointer w-full"
          >
            <option value="">Pilih Nama Mekanik...</option>
            {mechanics.map(m => {
              const isDisabled = formBayar.mekanikList.some((mekItem, i) => i !== idx && mekItem.idLama === m.username);
              return (
                <option key={m.id} value={m.username} disabled={isDisabled}>
                  {m.name}
                </option>
              );
            })}
          </select>
          <div className="relative w-full sm:w-auto">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black ${activeTheme.text}`}>Rp</span>
            <input
              type="number"
              placeholder="Ongkos Kerja"
              value={mek.ongkos || ''}
              onChange={e => {
                const newList = [...formBayar.mekanikList];
                newList[idx].ongkos = Number(e.target.value);
                setFormBayar(prev => ({ ...prev, mekanikList: newList }));
              }}
              className="w-full sm:w-40 pl-9 pr-3 py-3 text-xs md:text-sm font-black text-slate-800 border-none bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
});
