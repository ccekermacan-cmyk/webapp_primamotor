import React from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../../lib/pocketbase';
import { formatRupiah } from '../../lib/money';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { DropdownItem } from './types';

interface CashflowAccountsTabProps {
  wallets: DropdownItem[];
  loadingWallets: boolean;
  activeAccountTab: 'kas' | 'customer' | 'supplier' | 'karyawan';
  setActiveAccountTab: (tab: 'kas' | 'customer' | 'supplier' | 'karyawan') => void;
  showZeroBalances: boolean;
  setShowZeroBalances: React.Dispatch<React.SetStateAction<boolean>>;
  calculating: boolean;
  calculateBalances: () => Promise<void>;
  onOpenBonHistory: (wallet: DropdownItem) => void;
  onFilterKasWallet: (walletId: string) => void;
  scrollContainerAccountsRef?: React.RefObject<HTMLDivElement | null>;
}

const FLAT_CARD_PALETTE = [
  { bg: 'bg-emerald-600', border: 'border-emerald-500', shadow: 'shadow-emerald-600/20' },
  { bg: 'bg-blue-600', border: 'border-blue-500', shadow: 'shadow-blue-600/20' },
  { bg: 'bg-amber-600', border: 'border-amber-500', shadow: 'shadow-amber-600/20' },
  { bg: 'bg-purple-600', border: 'border-purple-500', shadow: 'shadow-purple-600/20' },
  { bg: 'bg-rose-600', border: 'border-rose-500', shadow: 'shadow-rose-600/20' },
  { bg: 'bg-cyan-600', border: 'border-cyan-500', shadow: 'shadow-cyan-600/20' },
  { bg: 'bg-indigo-600', border: 'border-indigo-500', shadow: 'shadow-indigo-600/20' },
  { bg: 'bg-teal-600', border: 'border-teal-500', shadow: 'shadow-teal-600/20' },
  { bg: 'bg-violet-600', border: 'border-violet-500', shadow: 'shadow-violet-600/20' },
  { bg: 'bg-orange-600', border: 'border-orange-500', shadow: 'shadow-orange-600/20' },
  { bg: 'bg-pink-600', border: 'border-pink-500', shadow: 'shadow-pink-600/20' },
  { bg: 'bg-sky-600', border: 'border-sky-500', shadow: 'shadow-sky-600/20' },
];

const THEME_STYLES: Record<string, { title: string; subtotalLabel: string; subtotalVal: string }> = {
  emerald: { title: 'text-emerald-600', subtotalLabel: 'text-emerald-500', subtotalVal: 'text-emerald-600' },
  blue: { title: 'text-blue-600', subtotalLabel: 'text-blue-500', subtotalVal: 'text-blue-600' },
  amber: { title: 'text-amber-600', subtotalLabel: 'text-amber-500', subtotalVal: 'text-amber-600' },
  purple: { title: 'text-purple-600', subtotalLabel: 'text-purple-500', subtotalVal: 'text-purple-600' },
};

export default function CashflowAccountsTab({
  wallets,
  loadingWallets,
  activeAccountTab,
  setActiveAccountTab,
  showZeroBalances,
  setShowZeroBalances,
  calculating,
  calculateBalances,
  onOpenBonHistory,
  onFilterKasWallet,
  scrollContainerAccountsRef
}: CashflowAccountsTabProps) {
  const navigate = useNavigate();

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

  const listCashflow = wallets.filter(w => (w.kategori || '').toLowerCase().includes('cashflow')).sort((a, b) => ((b as any).number_1 || 0) - ((a as any).number_1 || 0));
  const listCustomer = wallets.filter(w => (w.kategori || '').toLowerCase().includes('person') && (w.jenis || '').toLowerCase().includes('customer')).sort((a, b) => ((b as any).number_1 || 0) - ((a as any).number_1 || 0));
  const listSupplier = wallets.filter(w => (w.kategori || '').toLowerCase().includes('person') && (w.jenis || '').toLowerCase().includes('supplier')).sort((a, b) => ((b as any).number_1 || 0) - ((a as any).number_1 || 0));
  const listUser = wallets.filter(w => (w.kategori || '').toLowerCase().includes('person') && (w.jenis || '').toLowerCase().includes('user')).sort((a, b) => ((b as any).number_1 || 0) - ((a as any).number_1 || 0));

  let currentList: DropdownItem[] = [];
  let colorTheme = 'emerald';
  let title = '';

  if (activeAccountTab === 'kas') { currentList = listCashflow; colorTheme = 'emerald'; title = 'Akun Kas & Bank'; }
  else if (activeAccountTab === 'customer') { currentList = listCustomer; colorTheme = 'blue'; title = 'Piutang Customer'; }
  else if (activeAccountTab === 'supplier') { currentList = listSupplier; colorTheme = 'amber'; title = 'Hutang Supplier'; }
  else if (activeAccountTab === 'karyawan') { currentList = listUser; colorTheme = 'purple'; title = 'Bon Karyawan'; }

  const subtotal = currentList.reduce((acc, w) => acc + ((w as any).number_1 || 0), 0);
  const activeList = currentList.filter(w => ((w as any).number_1 || 0) > 0);
  const zeroList = currentList.filter(w => ((w as any).number_1 || 0) <= 0);

  const getFlatColor = (name: string, id: string) => {
    let hash = 0;
    const str = (name || '') + (id || '');
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const idx = Math.abs(hash) % FLAT_CARD_PALETTE.length;
    return FLAT_CARD_PALETTE[idx];
  };

  const currentThemeStyle = THEME_STYLES[colorTheme] || THEME_STYLES.emerald;

  const renderGrid = (listToRender: DropdownItem[]) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {listToRender.map((wallet) => {
          const wData = wallet as any;
          const flatColor = getFlatColor(wallet.text_1, wallet.id);
          return (
            <div
              key={wallet.id}
              onClick={() => {
                if (activeAccountTab === 'customer' || activeAccountTab === 'supplier') {
                  navigate(`/?person=${wallet.id_lama}&status=belum`);
                } else if (activeAccountTab === 'karyawan') {
                  onOpenBonHistory(wallet);
                } else {
                  onFilterKasWallet(wallet.id);
                }
              }}
              className={`relative overflow-hidden rounded-[2rem] p-5 sm:p-6 text-white ${flatColor.bg} border ${flatColor.border} shadow-lg ${flatColor.shadow} hover:-translate-y-1 transition-all duration-200 group cursor-pointer`}
            >
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center font-black text-sm text-white shadow-sm overflow-hidden">
                  {wData.link_image && !wData.link_image.startsWith('#') ? (
                    <img
                      src={wData.link_image.startsWith('http') ? wData.link_image : pb.files.getUrl(wallet, wData.link_image)}
                      alt="PP"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.classList.add('hidden');
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={wData.link_image && !wData.link_image.startsWith('#') ? 'hidden' : ''}>
                    {getInitials(wallet.text_1)}
                  </span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white bg-white/20 border border-white/30 px-3 py-1 rounded-full">
                  {wallet.jenis || 'DOMPET'}
                </span>
              </div>
              <div className="relative z-10">
                <p className="text-xs font-extrabold text-white/90 mb-1 truncate">{wallet.text_1}</p>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">{formatRupiah(wData.number_1 || 0)}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={scrollContainerAccountsRef}
      className="accounts-scroll-container flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-10"
    >
      <div className="mb-6">
        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
          Buku Rekening & Kas
        </h3>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Sisa saldo aktif untuk setiap penyimpanan dan pencatatan bon
        </p>
      </div>

      {/* Sub-tab Kategori Akun */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 flex-wrap">
          {[
            { id: 'kas', label: 'Kas & Bank', color: 'emerald' },
            { id: 'customer', label: 'Piutang Customer', color: 'blue' },
            { id: 'supplier', label: 'Hutang Supplier', color: 'amber' },
            { id: 'karyawan', label: 'Bon Karyawan', color: 'purple' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveAccountTab(tab.id as any);
                setShowZeroBalances(false);
              }}
              className={`shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${
                activeAccountTab === tab.id
                  ? (tab.id === 'kas' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 
                    tab.id === 'customer' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' :
                    tab.id === 'supplier' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' :
                    'bg-purple-500 text-white shadow-md shadow-purple-500/30')
                  : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Tombol Hitung Ulang - hanya tampil jika tab piutang atau hutang */}
        {(activeAccountTab === 'customer' || activeAccountTab === 'supplier') && (
          <button
            onClick={calculateBalances}
            disabled={calculating}
            className={`shrink-0 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center gap-2 ${
              activeAccountTab === 'customer' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30' :
              activeAccountTab === 'supplier' ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/30' :
              'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/30'
            } ${calculating ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {calculating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                MENGHITUNG...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                HITUNG ULANG
              </>
            )}
          </button>
        )}
      </div>

      {loadingWallets ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200 shadow-sm">
          Tidak ada data yang tersedia.
        </div>
      ) : currentList.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
          Belum ada data untuk kategori ini.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Section dengan Subtotal */}
          <div className="flex justify-between items-end border-b-2 border-slate-200 pb-3 px-2">
            <h4 className={`text-xl md:text-2xl font-black ${currentThemeStyle.title} uppercase tracking-widest`}>{title}</h4>
            <div className="text-right">
              <span className={`text-[10px] font-black ${currentThemeStyle.subtotalLabel} uppercase tracking-widest block`}>Subtotal Saldo</span>
              <span className={`text-lg md:text-xl font-black ${currentThemeStyle.subtotalVal}`}>{formatRupiah(subtotal)}</span>
            </div>
          </div>

          {/* Menampilkan list yang saldonya > 0 */}
          {activeList.length > 0 ? renderGrid(activeList) : (
            <div className="text-sm font-bold text-slate-400 bg-slate-100 p-4 rounded-xl text-center">Tidak ada akun aktif (saldo diatas 0) di kategori ini.</div>
          )}

          {/* Menampilkan list yang saldonya <= 0 dalam keadaan terlipat */}
          {zeroList.length > 0 && (
            <div className="mt-8">
              <button 
                onClick={() => setShowZeroBalances(!showZeroBalances)}
                className="w-full py-3 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
              >
                {showZeroBalances ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showZeroBalances ? 'Sembunyikan Akun Kosong/Minus' : `Tampilkan ${zeroList.length} Akun Kosong/Minus`}
              </button>
              
              <div className={`transition-all duration-500 overflow-hidden ${showZeroBalances ? 'max-h-[5000px] mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                {renderGrid(zeroList)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
