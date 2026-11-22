import React from 'react';
import { formatRupiah } from '../../lib/money';
import { getFullLabel, formatIdLamaDisplay, formatLocalDateTime } from '../../lib/posFormatters';
import { POS_DRAFT_KEY } from '../../lib/posDraft';
import type { Produk, HistoryMenu } from '../../types/pos';
import {
  Plus, Package, Calendar, History, Wallet, Sparkles, CreditCard
} from 'lucide-react';

interface PosContentFeedProps {
  selectedMenu: string;
  products: Produk[];
  groupedHistory: Record<string, HistoryMenu[]>;
  activeTheme: {
    main: string;
    light: string;
    text: string;
    border: string;
    groupHoverText?: string;
  };
  viewMode: 'grid' | 'list';
  addToCart: (p: Produk) => void;
  loadHistorySubDetails: (item: HistoryMenu) => void;
  openQuickSettle: (h: HistoryMenu, e: React.MouseEvent) => void;
  getPersonDisplayText: (person?: string, fallback?: string) => string;
  getJenisColor: (jenis: string) => string;
  setIsGajiFormOpen: (open: boolean) => void;
  setSalaryPeriodTab: (tab: string) => void;
  setSalaryReview: (review: boolean) => void;
  draftRestored: boolean;
  setDraftRestored: (restored: boolean) => void;
  cartLength: number;
}

export const PosContentFeed: React.FC<PosContentFeedProps> = ({
  selectedMenu,
  products,
  groupedHistory,
  activeTheme,
  viewMode,
  addToCart,
  loadHistorySubDetails,
  openQuickSettle,
  getPersonDisplayText,
  getJenisColor,
  setIsGajiFormOpen,
  setSalaryPeriodTab,
  setSalaryReview,
  draftRestored,
  setDraftRestored,
  cartLength,
}) => {
  const isOverview = selectedMenu.toLowerCase() === 'overview';
  const isGaji = selectedMenu.toLowerCase().includes('gaji');

  return (
    <div className="space-y-10">
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-800">
            <Sparkles size={14} className="text-amber-500 shrink-0" aria-hidden="true" />
            Keranjang dan form sebelumnya dipulihkan dari draft lokal ({cartLength} item).
          </p>
          <button
            type="button"
            onClick={() => {
              try { localStorage.removeItem(POS_DRAFT_KEY); } catch { /* ignore */ }
              setDraftRestored(false);
            }}
            className="shrink-0 text-[10px] font-black uppercase tracking-wider text-amber-700 hover:text-amber-900 bg-white border border-amber-200 rounded-lg px-2 py-1"
          >
            Hapus draft
          </button>
        </div>
      )}

      {/* 1. LIST PRODUK (PENJUALAN/SERVICE/PEMBELIAN) */}
      {!isOverview && !isGaji && products && products.length > 0 && (
        <div className={
          viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 will-change-transform"
            : "flex flex-col gap-4 will-change-transform"
        }>
          {products.map(p => (
            <div
              key={p.id}
              onClick={() => addToCart(p)}
              className={`bg-white rounded-3xl border-2 border-transparent hover:${activeTheme.border} shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${
                viewMode === 'grid' ? 'flex flex-col justify-between h-72 p-6' : 'flex flex-row items-center justify-between p-4 min-h-[120px]'
              }`}
            >
              <div className={`absolute -top-12 -right-12 w-40 h-40 ${activeTheme.light} rounded-full blur-sm md:blur-3xl opacity-20 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none`} />

              <div className={`relative z-10 ${viewMode === 'list' ? 'flex-1 pr-6' : ''}`}>
                <div className={`flex items-start mb-4 ${viewMode === 'grid' ? 'justify-between' : 'gap-4'}`}>
                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl tracking-tighter">
                    #{formatIdLamaDisplay(p.id_lama)}
                  </span>
                  <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm ${p.stok_3 > 5 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'}`}>
                    {p.stok_3 > 0 ? <>SISA: {p.stok_3} {p.unit}</> : 'STOK HABIS'}
                  </div>
                </div>
                <h3 className={`font-black text-slate-800 text-sm md:text-base uppercase leading-snug ${activeTheme.groupHoverText || 'group-hover:text-blue-600'} line-clamp-2 md:line-clamp-3 tracking-tight transition-colors`}>
                  {getFullLabel(p)}
                </h3>
              </div>

              <div className={`flex justify-between items-center ${activeTheme.light} rounded-2xl group-hover:${activeTheme.main} transition-all duration-300 relative z-10 ${
                viewMode === 'grid' ? 'p-4 mt-4' : 'p-3 px-5 min-w-[200px]'
              }`}>
                <p className={`font-black ${activeTheme.text} group-hover:text-white text-base md:text-lg tracking-tighter transition-colors`}>
                  {formatRupiah((p.sell_6 || 0))}
                </p>
                <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center ${activeTheme.text} shadow-sm group-hover:scale-110 transition-transform`}>
                  <Plus size={20} strokeWidth={3}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Jika produk kosong dan menu bukan overview/gaji */}
      {!isOverview && !isGaji && (!products || products.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Package size={32} className="text-slate-400" />
          </div>
          <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Tidak ada produk</span>
        </div>
      )}

      {/* 2. LIST OVERVIEW (RIWAYAT TRANSAKSI TERGROUPING TANGGAL) */}
      {isOverview && groupedHistory && Object.keys(groupedHistory).length > 0 && (
        Object.entries(groupedHistory).map(([date, items]) => (
          <div key={date} className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <div className={`w-2 h-2 rounded-full ${activeTheme.main}`} />
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{date}</span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-200 to-transparent rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map(h => (
                <div
                  key={h.id}
                  onClick={() => loadHistorySubDetails(h)}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 transition-all cursor-pointer group h-auto min-h-[15rem] flex flex-col justify-between relative overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${h.status === 'lunas' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${getJenisColor(h.jenis)}`}>
                        {h.jenis}
                      </span>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm ${
                        h.status === 'lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {h.status === 'lunas' ? 'LUNAS' : 'BELUM'}
                      </span>
                    </div>
                    <div className={`p-2 rounded-xl transition-colors ${activeTheme.light} ${activeTheme.text} opacity-50 group-hover:opacity-100`}>
                      <History size={16} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="relative z-10 mt-4">
                    <h4 className="font-black text-slate-800 text-lg uppercase leading-tight mb-2 truncate group-hover:text-blue-600 transition-colors">
                      {getPersonDisplayText(h.person, 'PELANGGAN UMUM')}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      Operator: {h.operator || '-'}
                    </div>
                    <p className="text-xs font-bold text-slate-500 line-clamp-2 italic mt-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                      "{h.text || 'Tanpa deskripsi nota.'}"
                    </p>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-4 relative z-10">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                        <Calendar size={12} /> {formatLocalDateTime(h.created_at)}
                      </span>
                      {h.status === 'lunas' ? (
                        <span className="text-xs font-black text-emerald-600">Total: {formatRupiah((h.total || 0))}</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-slate-500 line-through">{formatRupiah((h.total || 0))}</span>
                          <span className="text-xs font-black text-rose-600">Sisa: {formatRupiah(Math.max(0, (h.total || 0) - (h.dibayar || 0)))}</span>
                          <button
                            type="button"
                            onClick={(e) => openQuickSettle(h, e)}
                            className="mt-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-1 transition-colors"
                            title="Pelunasan Cepat"
                          >
                            <Wallet size={12} />
                            <span>Pelunasan Cepat</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={`font-black text-white ${activeTheme.main} shadow-md shadow-${activeTheme.main.replace('bg-', '')}/30 px-3 py-1.5 rounded-xl text-xs`}>
                      {h.qty} Item
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Jika overview kosong */}
      {isOverview && (!groupedHistory || Object.keys(groupedHistory).length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Calendar size={32} className="text-slate-400" />
          </div>
          <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Belum ada riwayat transaksi</span>
        </div>
      )}

      {/* 3. LIST GAJI & BANNER PEMBUATAN GAJI */}
      {isGaji && (
        <div className="space-y-6">
          <div className="p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <CreditCard size={24} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">Kelola Slip Gaji Karyawan</h3>
                <p className="text-xs text-emerald-200/80">Buat slip gaji baru, tetapkan periode & rincian penambahan/pengurangan gaji.</p>
              </div>
            </div>
            <button
              onClick={() => { setSalaryPeriodTab('period'); setSalaryReview(false); setIsGajiFormOpen(true); }}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0"
            >
              <Plus size={18} /> Buat Slip Gaji Baru
            </button>
          </div>

          {groupedHistory && Object.keys(groupedHistory).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                <Calendar size={32} className="text-teal-500" />
              </div>
              <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Belum ada data slip gaji</span>
            </div>
          ) : (
            Object.entries(groupedHistory || {}).map(([date, items]) => (
              <div key={date} className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-sm" />
                  <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">{date}</span>
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-teal-100 to-transparent rounded-full" />
                </div>
                <div className={
                  viewMode === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 will-change-transform"
                    : "flex flex-col gap-4 will-change-transform"
                }>
                  {(items || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(item => (
                    <div
                      key={item.id}
                      onClick={() => loadHistorySubDetails(item)}
                      className={`bg-white rounded-3xl border-2 border-teal-100/60 hover:border-teal-400 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${
                        viewMode === 'grid' ? 'flex flex-col justify-between min-h-[240px] p-6' : 'flex flex-row items-center justify-between p-4 min-h-[100px]'
                      }`}
                    >
                      <div className="absolute -top-12 -right-12 w-40 h-40 bg-teal-50 rounded-full blur-3xl opacity-20 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

                      <div className={`relative z-10 ${viewMode === 'list' ? 'flex-1 pr-6' : ''}`}>
                        <div className={`flex items-start mb-3 ${viewMode === 'grid' ? 'justify-between' : 'gap-4 mb-2'}`}>
                          <span className="text-[10px] font-black bg-teal-50 text-teal-600 border border-teal-100 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                            SLIP GAJI
                          </span>
                          <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            Op: {item.operator || '-'}
                          </span>
                        </div>

                        <h3 className="font-black text-slate-800 text-base md:text-lg uppercase leading-snug group-hover:text-teal-600 transition-colors line-clamp-1">
                          {item.text || 'Gaji Karyawan'}
                        </h3>
                        <div className="mt-2 space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                            Penerima Gaji ({(item.person || '').split(',').filter(Boolean).length} Person):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(item.person || 'Karyawan').split(',').map((pName, pIdx) => {
                              const trimmed = pName.trim();
                              if (!trimmed) return null;
                              return (
                                <span key={pIdx} className="text-[10px] font-extrabold text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                                  👤 {trimmed}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mt-3">
                          <Calendar size={12} /> {formatLocalDateTime(item.created_at)}
                        </span>
                      </div>

                      <div className={`flex justify-between items-center bg-teal-50/80 rounded-2xl group-hover:bg-teal-500 transition-all duration-300 relative z-10 ${
                        viewMode === 'grid' ? 'p-3.5 px-4 mt-4' : 'p-3 px-5 min-w-[200px]'
                      }`}>
                        <div>
                          <span className="text-[9px] font-black text-teal-600 group-hover:text-teal-100 uppercase tracking-widest block">Total Bersih</span>
                          <p className="font-black text-teal-700 group-hover:text-white text-base md:text-lg tracking-tight transition-colors">
                            {formatRupiah((item.total || 0))}
                          </p>
                        </div>
                        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-teal-600 shadow-sm group-hover:scale-110 transition-transform">
                          <History size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
