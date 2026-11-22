import React, { useState } from 'react';
import {
  Wallet, Search, ChevronLeft, ChevronRight,
  ArrowDownRight, ArrowUpRight, Calendar, User,
  Layers, X, ArrowRight, Filter, RefreshCw
} from 'lucide-react';
import { formatRupiah } from '../../lib/money';
import type { Cashflow, DropdownItem } from './types';

interface CashflowHistoryTabProps {
  loading: boolean;
  groupedTransactions: Record<string, Cashflow[]>;
  filterMutasi: string;
  setFilterMutasi: (mutasi: string) => void;
  filterAccounts: string[];
  toggleFilterAccount: (id: string) => void;
  filterJenis: string[];
  toggleFilterJenis: (id: string) => void;
  availableJenisOptions: DropdownItem[];
  accountOptions: DropdownItem[];
  dateRange: { start: string; end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  searchInput: string;
  setSearchInput: (term: string) => void;
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onSelectTransaction: (tx: Cashflow) => void;
  onOpenMobileFilter: () => void;
  getPersonName: (personId: string | undefined, persontextFallback?: string) => string;
  getAccountName: (accountId: string | undefined) => string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function CashflowHistoryTab({
  loading,
  groupedTransactions,
  filterMutasi,
  setFilterMutasi,
  filterAccounts,
  toggleFilterAccount,
  filterJenis,
  toggleFilterJenis,
  availableJenisOptions,
  accountOptions,
  dateRange,
  setDateRange,
  searchInput,
  setSearchInput,
  page,
  totalPages,
  setPage,
  onSelectTransaction,
  onOpenMobileFilter,
  getPersonName,
  getAccountName,
  scrollContainerRef
}: CashflowHistoryTabProps) {
  const [activeFilter, setActiveFilter] = useState<'account' | 'jenis' | 'tanggal' | 'search' | null>(null);

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 flex-1 min-h-0 flex flex-col overflow-hidden relative">
      {/* FILTER BAR - STICKY TOP */}
      <div className="sticky top-0 z-10 p-3 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
        {/* === KIRI: Toggle Mutasi === */}
        <div 
          className={`bg-slate-100 rounded-lg transition-all duration-300 ease-in-out flex overflow-hidden ${
            activeFilter 
              ? 'w-0 max-w-0 p-0 opacity-0 sm:w-auto sm:max-w-[250px] sm:p-0.5 sm:opacity-100'
              : 'flex-1 max-w-[60%] p-0.5 opacity-100 min-w-0'
          }`}
        >
          {['semua', 'masuk', 'keluar'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilterMutasi(tab);
                setPage(1);
              }}
              className={`flex-1 py-1.5 px-2 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all duration-300 truncate ${
                filterMutasi === tab
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
              }`}
              title={tab}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* === TENGAH: Expandable Filter Area === */}
        <div
          className={`transition-all duration-300 ease-in-out flex items-center overflow-hidden ${
            activeFilter ? 'flex-1 opacity-100 max-w-full ml-2' : 'w-0 opacity-0 max-w-0 ml-0'
          }`}
        >
          {activeFilter === 'account' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 h-10 w-full shadow-sm flex-nowrap overflow-x-auto no-scrollbar">
              <Wallet size={16} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 scroll-smooth">
                {accountOptions.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => toggleFilterAccount(acc.id)}
                    className={`whitespace-nowrap px-3 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                      filterAccounts.includes(acc.id)
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {acc.text_1}
                  </button>
                ))}
              </div>
              <div className="w-[1px] h-4 bg-slate-300 shrink-0 mx-1"></div>
              <button onClick={() => setActiveFilter(null)} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {activeFilter === 'jenis' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 h-10 w-full shadow-sm flex-nowrap overflow-x-auto no-scrollbar">
              <Layers size={16} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 scroll-smooth">
                {availableJenisOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => toggleFilterJenis(opt.id_lama || opt.id)}
                    className={`whitespace-nowrap px-3 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                      filterJenis.includes(opt.id_lama || opt.id)
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {opt.text_1}
                  </button>
                ))}
              </div>
              <div className="w-[1px] h-4 bg-slate-300 shrink-0 mx-1"></div>
              <button onClick={() => setActiveFilter(null)} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {activeFilter === 'tanggal' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 h-10 w-full shadow-sm flex-nowrap overflow-x-auto no-scrollbar">
              <Calendar size={15} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="date"
                  className="bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 w-[105px]"
                  value={dateRange.start}
                  onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setPage(1); }}
                />
                <span className="text-slate-400 font-black text-xs shrink-0">-</span>
                <input
                  type="date"
                  className="bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 w-[105px]"
                  value={dateRange.end}
                  onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setPage(1); }}
                />
              </div>
              <div className="w-[1px] h-4 bg-slate-300 shrink-0 mx-0.5"></div>
              <div className="flex gap-1 shrink-0">
                {[
                  { label: 'Hari Ini', get: () => new Date().toISOString().split('T')[0] },
                  { label: '7 Hari', get: () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; } },
                  { label: '30 Hari', get: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; } },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setDateRange({ start: p.get(), end: new Date().toISOString().split('T')[0] }); setPage(1); }}
                    className="px-1.5 py-0.5 bg-white hover:bg-emerald-100 hover:text-emerald-700 border border-slate-200 rounded-md text-[9px] font-bold text-slate-600 transition-colors whitespace-nowrap"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="w-[1px] h-4 bg-slate-300 shrink-0 mx-0.5"></div>
              <button
                type="button"
                onClick={() => { setDateRange({ start: '', end: '' }); setActiveFilter(null); setPage(1); }}
                className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {activeFilter === 'search' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 h-10 w-full shadow-sm flex-nowrap focus-within:ring-1 focus-within:ring-emerald-400 focus-within:border-emerald-400 transition-all">
              <Search size={16} className="text-emerald-500 shrink-0" />
              <input
                type="text"
                placeholder="Cari transaksi (Nota/Ket)..."
                className="bg-transparent text-[11px] font-bold text-slate-700 outline-none flex-1 min-w-[150px]"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
              />
              <div className="w-[1px] h-4 bg-slate-300 shrink-0 mx-1"></div>
              <button onClick={() => { setSearchInput(''); setActiveFilter(null); }} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        {/* === KANAN: Ikon-ikon Filter === */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setActiveFilter(activeFilter === 'account' ? null : 'account')}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
              activeFilter === 'account'
                ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
            }`}
            title="Filter Akun"
          >
            <Wallet size={16} />
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'jenis' ? null : 'jenis')}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
              activeFilter === 'jenis'
                ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
            }`}
            title="Filter Jenis"
          >
            <Layers size={16} />
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'tanggal' ? null : 'tanggal')}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
              activeFilter === 'tanggal'
                ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
            }`}
            title="Filter Tanggal"
          >
            <Calendar size={16} />
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'search' ? null : 'search')}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${
              activeFilter === 'search'
                ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
            }`}
            title="Cari"
          >
            <Search size={16} />
          </button>

          {/* Tombol filter mobile */}
          <button
            onClick={onOpenMobileFilter}
            className="md:hidden w-8 h-8 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-600 shadow-sm"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* DAFTAR TRANSAKSI - SCROLLABLE */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth custom-scrollbar"
      >
        {loading ? (
          <div className="space-y-3 px-3 py-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 animate-pulse flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-2 bg-slate-200 rounded w-1/4" />
                </div>
                <div className="w-20 h-6 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            Belum ada data transaksi kas ditemukan.
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, items]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="bg-slate-800 px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest text-center shadow-sm">
                  {date !== 'Tanpa Tanggal' ? date : 'Tanpa Tanggal'}
                </span>
                <div className="h-[2px] flex-1 bg-slate-100" />
              </div>
              <div className="grid gap-3">
                {items.map((tx) => {
                  const isMasuk = tx.mutasi.toLowerCase() === 'in' || (filterAccounts.includes(tx.account_2) && !filterAccounts.includes(tx.account_1) && tx.jenis.toLowerCase().includes('transfer'));
                  const isTransfer = (tx.jenis || '').toLowerCase() === 'transfer';
                  const iconColor = isTransfer ? 'bg-indigo-50 text-indigo-600' : (isMasuk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600');
                  const textColor = isTransfer ? 'text-indigo-600' : (isMasuk ? 'text-emerald-600' : 'text-rose-600');

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onSelectTransaction(tx)}
                      className="group bg-white border-2 border-slate-100 rounded-2xl hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer overflow-hidden"
                    >
                      <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3 shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${iconColor}`}>
                            {isTransfer ? (
                              <RefreshCw size={18} strokeWidth={2.5} />
                            ) : isMasuk ? (
                              <ArrowDownRight strokeWidth={2.5} />
                            ) : (
                              <ArrowUpRight strokeWidth={2.5} />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                              {tx.id?.slice(-6) || tx.ref?.slice(-6)}
                            </span>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 text-center">
                              {tx.jenis}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm md:text-base truncate">
                            {tx.note || '-'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                              <User size={12} /> {getPersonName(tx.person, tx.persontext)}
                            </span>
                            <span className="text-slate-500 flex items-center gap-1">
                              <Wallet size={12} /> {getAccountName(tx.account_1)}
                            </span>
                            {tx.account_2 && (
                              <span className="text-slate-500 flex items-center gap-1">
                                <ArrowRight size={12} /> {getAccountName(tx.account_2)}
                              </span>
                            )}
                            <span className="text-slate-500 flex items-center gap-1">
                              <User size={12} /> {tx.operator || '-'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end shrink-0">
                          <p className={`text-base md:text-lg font-black tracking-tight ${textColor}`}>
                            {isTransfer ? '↔' : isMasuk ? '+' : '-'} {formatRupiah(tx.nominal)}
                          </p>
                        </div>
                      </div>
                      <div className={`px-4 pb-3 md:px-5 md:pb-4 border-t border-slate-100 flex justify-between items-center ${isTransfer ? 'bg-indigo-50/30' : 'bg-slate-50/50'}`}>
                        <span className="text-[9px] font-mono text-slate-400">
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                          {isTransfer && (
                            <span className="ml-2 text-indigo-400 font-bold uppercase">TRANSFER</span>
                          )}
                        </span>
                        {(tx.saldo_akhir !== undefined && tx.saldo_akhir !== null) && (
                          <span className={`text-[9px] font-bold ${Number(tx.saldo_akhir) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                            Saldo Akhir: {formatRupiah(Number(tx.saldo_akhir))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* PAGINASI */}
      <div className="sticky bottom-0 z-30 p-3 sm:p-4 md:p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 rounded-b-3xl shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-xl">
          Hal. {page} / {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 transition-all shadow-sm text-slate-600"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 transition-all shadow-sm text-slate-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
