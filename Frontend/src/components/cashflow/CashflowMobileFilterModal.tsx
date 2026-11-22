import React from 'react';
import Modal from '../modal';
import { Wallet, Layers } from 'lucide-react';
import type { DropdownItem } from './types';

interface CashflowMobileFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountOptions: DropdownItem[];
  filterAccounts: string[];
  toggleFilterAccount: (accId: string) => void;
  availableJenisOptions: DropdownItem[];
  filterJenis: string[];
  toggleFilterJenis: (jenisId: string) => void;
  dateRange: { start: string; end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  searchInput: string;
  setSearchInput: (val: string) => void;
}

export default function CashflowMobileFilterModal({
  isOpen,
  onClose,
  accountOptions,
  filterAccounts,
  toggleFilterAccount,
  availableJenisOptions,
  filterJenis,
  toggleFilterJenis,
  dateRange,
  setDateRange,
  searchInput,
  setSearchInput,
}: CashflowMobileFilterModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Riwayat Kas"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 p-2">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Wallet size={14} /> Filter Dompet / Akun
          </label>
          <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar pb-2">
            {accountOptions.map(acc => (
              <button 
                key={acc.id}
                onClick={() => toggleFilterAccount(acc.id)}
                className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border ${
                  filterAccounts.includes(acc.id) 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {acc.text_1}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Layers size={14} /> Filter Jenis
          </label>
          <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar pb-2">
            {availableJenisOptions.map(opt => (
              <button 
                key={opt.id}
                onClick={() => toggleFilterJenis(opt.id_lama || opt.id)}
                className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border ${
                  filterJenis.includes(opt.id_lama || opt.id) 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {opt.text_1}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Rentang Tanggal</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <input
              type="date"
              className="p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Pencarian</label>
          <input
            type="text"
            placeholder="Cari kata kunci..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
        >
          Terapkan Filter
        </button>
      </div>
    </Modal>
  );
}
