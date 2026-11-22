import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle, X, DollarSign, User, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRupiah } from '../../lib/money';
import { businessDate } from '../../lib/cashflow';

interface CashflowTempoTabProps {
  tempoGroups: { date: string; items: any[] }[];
  loadingTempo: boolean;
  tempoPage: number;
  setTempoPage: React.Dispatch<React.SetStateAction<number>>;
  tempoCategoryFilter: 'all' | 'overdue' | 'upcoming';
  setTempoCategoryFilter: React.Dispatch<React.SetStateAction<'all' | 'overdue' | 'upcoming'>>;
  tempoPerPage?: number;
  getPersonName: (personId: string | undefined, persontextFallback?: string) => string;
  formatLocalDateTime: (isoString: string | undefined) => string;
  scrollTempoRef?: React.RefObject<HTMLDivElement | null>;
}

export default function CashflowTempoTab({
  tempoGroups,
  loadingTempo,
  tempoPage,
  setTempoPage,
  tempoCategoryFilter,
  setTempoCategoryFilter,
  tempoPerPage = 10,
  getPersonName,
  formatLocalDateTime,
  scrollTempoRef
}: CashflowTempoTabProps) {
  const navigate = useNavigate();

  // Flatten data dari tempoGroups
  const allItems = tempoGroups.flatMap(g => g.items.map(item => ({ ...item, tempoDate: g.date })));
  const totalItemsCount = allItems.length;
  const todayKey = businessDate();

  // Perhitungan Ringkasan Metrik (Overdue vs Upcoming)
  let overdueCount = 0;
  let overdueSisaTotal = 0;
  let upcomingCount = 0;
  let upcomingSisaTotal = 0;
  let grandSisaTotal = 0;

  allItems.forEach(item => {
    const groupDate = item.tempoDate;
    const sisa = Math.max(0, Number(item.total || 0) - Number(item.dibayar || 0));
    grandSisaTotal += sisa;

    if (groupDate < todayKey) {
      overdueCount += 1;
      overdueSisaTotal += sisa;
    } else {
      upcomingCount += 1;
      upcomingSisaTotal += sisa;
    }
  });

  // Filtering data berdasarkan kategori
  const filteredAllItems = allItems.filter(item => {
    const groupDate = item.tempoDate;
    if (tempoCategoryFilter === 'overdue') return groupDate < todayKey;
    if (tempoCategoryFilter === 'upcoming') return groupDate >= todayKey;
    return true;
  });

  const totalFilteredItems = filteredAllItems.length;
  const totalPages = Math.ceil(totalFilteredItems / tempoPerPage) || 1;
  const startIndex = (tempoPage - 1) * tempoPerPage;
  const endIndex = Math.min(startIndex + tempoPerPage, totalFilteredItems);
  const currentPageItems = filteredAllItems.slice(startIndex, endIndex);

  const totalHalaman = currentPageItems.reduce((acc, item) => acc + Math.max(0, Number(item.total || 0) - Number(item.dibayar || 0)), 0);

  const getDaysDiffText = (dateStr: string) => {
    const diffMs = new Date(dateStr).getTime() - new Date(todayKey).getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Lewat ${Math.abs(diffDays)} Hari`;
    if (diffDays === 0) return `Jatuh Tempo Hari Ini`;
    return `Sisa ${diffDays} Hari`;
  };

  const tempoCategoryLabels: Record<string, string> = {
    all: 'Semua',
    overdue: 'Terlambat',
    upcoming: 'Akan Datang'
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 flex-1 min-h-0 flex flex-col overflow-hidden relative">
      {/* HEADER CONTAINER */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calendar size={18} className="text-amber-500 shrink-0" />
            Daftar Pembelian Belum Lunas (Monitoring Jatuh Tempo Hutang)
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Klik pada banner metrik di bawah untuk menyaring data berdasarkan keterlambatan pelunasan.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {tempoCategoryFilter !== 'all' && (
            <button
              onClick={() => { setTempoCategoryFilter('all'); setTempoPage(1); }}
              className="px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 text-[10px] font-black uppercase rounded-xl border border-rose-200 transition-colors flex items-center gap-1"
            >
              <X size={12} /> Reset Filter ({tempoCategoryLabels[tempoCategoryFilter] || tempoCategoryFilter})
            </button>
          )}
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-xl border border-amber-200">
            {totalFilteredItems} Transaksi Tampil
          </span>
        </div>
      </div>

      {/* MAIN SCROLLABLE CONTENT BODY */}
      <div ref={scrollTempoRef} className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 space-y-5 sm:space-y-6 custom-scrollbar">
        {/* RINGKASAN STATISTIK METRIK INTERAKTIF */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pb-2 border-b border-slate-100">
          {/* Card 1: Overdue */}
          <div 
            onClick={() => {
              setTempoCategoryFilter(tempoCategoryFilter === 'overdue' ? 'all' : 'overdue');
              setTempoPage(1);
            }}
            className={`p-3.5 sm:p-4 bg-gradient-to-br from-rose-50 to-red-50/80 border-2 rounded-2xl flex flex-col justify-between shadow-xs cursor-pointer transition-all duration-200 active:scale-98 ${
              tempoCategoryFilter === 'overdue'
                ? 'border-rose-600 ring-4 ring-rose-200 shadow-md scale-[1.01]'
                : 'border-rose-200 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                <AlertCircle size={14} /> Lewat Jatuh Tempo
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                tempoCategoryFilter === 'overdue'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-rose-200/60 text-rose-800 border-rose-300/50'
              }`}>
                {overdueCount} Nota
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <p className="text-lg sm:text-2xl font-black text-rose-700 tracking-tight">
                {formatRupiah(overdueSisaTotal)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-rose-500">Sisa Hutang Terlambat</p>
                <span className="text-[9px] font-black text-rose-700 uppercase tracking-wider underline">
                  {tempoCategoryFilter === 'overdue' ? '✓ Filter Aktif' : 'Klik Filter ↗'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Upcoming */}
          <div 
            onClick={() => {
              setTempoCategoryFilter(tempoCategoryFilter === 'upcoming' ? 'all' : 'upcoming');
              setTempoPage(1);
            }}
            className={`p-3.5 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-50/80 border-2 rounded-2xl flex flex-col justify-between shadow-xs cursor-pointer transition-all duration-200 active:scale-98 ${
              tempoCategoryFilter === 'upcoming'
                ? 'border-amber-500 ring-4 ring-amber-200 shadow-md scale-[1.01]'
                : 'border-amber-200 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={14} /> Akan Jatuh Tempo
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                tempoCategoryFilter === 'upcoming'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-amber-200/60 text-amber-800 border-amber-300/50'
              }`}>
                {upcomingCount} Nota
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <p className="text-lg sm:text-2xl font-black text-amber-700 tracking-tight">
                {formatRupiah(upcomingSisaTotal)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-amber-600">Dalam Tenggat Waktu</p>
                <span className="text-[9px] font-black text-amber-800 uppercase tracking-wider underline">
                  {tempoCategoryFilter === 'upcoming' ? '✓ Filter Aktif' : 'Klik Filter ↗'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Sisa Tagihan */}
          <div 
            onClick={() => {
              setTempoCategoryFilter('all');
              setTempoPage(1);
            }}
            className={`p-3.5 sm:p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-2 rounded-2xl flex flex-col justify-between shadow-md cursor-pointer transition-all duration-200 active:scale-98 ${
              tempoCategoryFilter === 'all'
                ? 'border-emerald-400 ring-4 ring-emerald-400/30 scale-[1.01]'
                : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-400" /> Total Sisa Tagihan
              </span>
              <span className="px-2 py-0.5 bg-white/10 text-emerald-300 rounded-lg text-[10px] font-black border border-white/10">
                {totalItemsCount} Nota
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <p className="text-lg sm:text-2xl font-black text-emerald-400 tracking-tight">
                {formatRupiah(grandSisaTotal)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-300">Total Kewajiban Pembayaran</p>
                <span className="text-[9px] font-black text-emerald-300 uppercase tracking-wider underline">
                  {tempoCategoryFilter === 'all' ? '✓ Tampil Semua' : 'Tampilkan Semua ↗'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {loadingTempo ? (
          <div className="space-y-3 px-3 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 animate-pulse flex gap-3">
                <div className="w-1.5 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-2 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="w-20 h-6 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : totalFilteredItems === 0 ? (
          <div className="text-center py-16 sm:py-20 text-slate-400 font-bold bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 px-4">
            <p className="text-base sm:text-lg">🎉 Tidak ada pembelian dalam kategori filter ini ({tempoCategoryLabels[tempoCategoryFilter] || tempoCategoryFilter}).</p>
            <button 
              onClick={() => { setTempoCategoryFilter('all'); setTempoPage(1); }}
              className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Tampilkan Semua Transaksi Jatuh Tempo
            </button>
          </div>
        ) : (
          (() => {
            const groupedPageItems: Record<string, any[]> = {};
            currentPageItems.forEach(item => {
              const key = item.tempoDate;
              if (!groupedPageItems[key]) groupedPageItems[key] = [];
              groupedPageItems[key].push(item);
            });
            const sortedGroupKeys = Object.keys(groupedPageItems).sort((a, b) => a.localeCompare(b));

            return sortedGroupKeys.map((dateKey) => {
              const isOverdueGroup = dateKey < todayKey;
              const items = groupedPageItems[dateKey];
              const daysDiffText = getDaysDiffText(dateKey);

              return (
                <div key={dateKey} className="space-y-3">
                  {/* Header Kelompok Tanggal Tempo */}
                  <div className="flex items-center gap-2 sm:gap-3 px-1 flex-wrap">
                    <span className={`px-2.5 sm:px-3 py-1 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-xs ${
                      isOverdueGroup 
                        ? 'bg-rose-600 text-white border-rose-700' 
                        : 'bg-amber-500 text-white border-amber-600'
                    }`}>
                      {isOverdueGroup ? <AlertCircle size={13} /> : <Calendar size={13} />}
                      {isOverdueGroup ? `LEWAT JATUH TEMPO (${daysDiffText})` : `AKAN JATUH TEMPO (${daysDiffText})`}
                    </span>
                    <span className="text-[10px] sm:text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                      Batas: {formatLocalDateTime(dateKey)}
                    </span>
                    <div className="h-px flex-1 bg-slate-200 min-w-[30px]" />
                  </div>

                  {/* List Items Card */}
                  {items.map((item) => {
                    const personName = getPersonName(item.person) || item.person || 'Supplier Umum';
                    const dibayar = item.dibayar || 0;
                    const total = item.total || 0;
                    const sisa = total - dibayar;
                    const percentPaid = total > 0 ? Math.min(100, Math.round((dibayar / total) * 100)) : 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/?ref=${item.id}`)}
                        className={`group bg-white border-2 rounded-2xl p-3.5 sm:p-4 md:p-5 hover:shadow-xl transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3.5 md:gap-4 relative overflow-hidden ${
                          isOverdueGroup 
                            ? 'border-rose-200 hover:border-rose-400 bg-rose-50/20' 
                            : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/10'
                        }`}
                      >
                        {/* Left Color Indicator Bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isOverdueGroup ? 'bg-rose-500' : 'bg-amber-500'}`} />

                        <div className="flex flex-col gap-2 min-w-0 flex-1 pl-1.5 sm:pl-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] sm:text-xs font-mono font-black bg-slate-100 text-slate-700 px-2 sm:px-2.5 py-0.5 rounded-lg border border-slate-200">
                              ID: #{item.id.slice(-6).toUpperCase()}
                            </span>
                            <span className={`text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 rounded-lg uppercase tracking-wider border ${
                              isOverdueGroup ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              {isOverdueGroup ? '🔴 TERLAMBAT' : '🟡 MENUNGGU PELUNASAN'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <User size={16} className="text-slate-400 shrink-0" />
                            <p className="font-extrabold text-slate-800 text-sm sm:text-base truncate">
                              {personName}
                            </p>
                          </div>

                          {/* Progress Bar Pelunasan */}
                          <div className="mt-1 w-full max-w-md">
                            <div className="flex justify-between items-center text-[10px] font-bold mb-1 flex-wrap gap-1">
                              <span className="text-slate-500">Progress: <strong className="text-emerald-700">{percentPaid}%</strong></span>
                              <span className="text-slate-500">Terbayar: <strong className="text-emerald-700">{formatRupiah(dibayar)}</strong></span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 flex">
                              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${percentPaid}%` }} />
                              <div className={`h-full transition-all duration-500 ${isOverdueGroup ? 'bg-rose-400' : 'bg-amber-400'}`} style={{ width: `${100 - percentPaid}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Sisa Tagihan */}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 md:border-t-0 md:border-l md:flex-col md:items-end md:justify-center md:pt-0 md:pl-4 shrink-0">
                          <div className="text-left md:text-right min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-black text-rose-500 uppercase tracking-wider truncate">Sisa Belum Lunas</p>
                            <p className="text-sm sm:text-lg font-black text-rose-600 tracking-tight">
                              {formatRupiah(sisa)}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400">dari {formatRupiah(total)}</p>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black text-blue-600 group-hover:text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-lg">
                            LIHAT <ArrowRight size={12} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()
        )}
      </div>

      {/* FOOTER DENGAN PAGINATION & SUMMARY */}
      <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white rounded-b-3xl flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center sm:text-left">
          <span>Tampil {totalFilteredItems} / {totalItemsCount} Transaksi</span>
          <span className="hidden sm:inline">|</span>
          <span>Subtotal Hal: <strong className="text-slate-800">{formatRupiah(totalHalaman)}</strong></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTempoPage(p => Math.max(1, p - 1))}
            disabled={tempoPage === 1}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition font-black text-[11px] sm:text-xs flex items-center gap-1"
          >
            <ChevronLeft size={15} /> SEBELUMNYA
          </button>
          <span className="text-[11px] sm:text-xs font-black text-slate-700 bg-slate-100 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200">
            {tempoPage} / {totalPages}
          </span>
          <button
            onClick={() => setTempoPage(p => Math.min(totalPages, p + 1))}
            disabled={tempoPage === totalPages}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition font-black text-[11px] sm:text-xs flex items-center gap-1"
          >
            SELANJUTNYA <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
