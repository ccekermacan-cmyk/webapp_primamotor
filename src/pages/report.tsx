import { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import { 
  Search, Calendar, ChevronLeft, ChevronRight, Download, 
  TrendingUp, TrendingDown, DollarSign, Wallet, FileText, Filter, RefreshCw
} from 'lucide-react';

// --- INTERFACE DATA REPORT ---
interface ReportRecord {
  id: string;
  text: string;
  created_at: string;
  omset_toko: number;
  omset_servis: number;
  omset_minuman: number;
  laba_penjualan: number;
  operasional_toko: number;
  pengeluaran_lain: number;
  kasir_toko: number;
  pemasukan_lain: number;
}

export default function ReportPage() {
  // --- STATES ---
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 31; // 🔄 Diubah dari 15 menjadi 31 (maksimal baris per halaman)

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // --- FORMATTER HELPER ---
  const formatRp = (num: number | undefined) => `Rp ${(num || 0).toLocaleString('id-ID')}`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // --- FETCH DATA ---
  const fetchReports = async () => {
    setLoading(true);
    try {
      let conditions: string[] = [];
      let params: any = {};

      // 1. Logika Pencarian Teks
      if (debouncedSearch) {
        conditions.push(`(text ~ {:search} || id ~ {:search})`);
        params.search = debouncedSearch;
      }

      // 2. Logika Filter Rentang Tanggal
      if (dateRange.start) {
        conditions.push(`created_at >= {:start}`);
        params.start = `${dateRange.start} 00:00:00`;
      }
      if (dateRange.end) {
        conditions.push(`created_at <= {:end}`);
        params.end = `${dateRange.end} 23:59:59`;
      }

      const filterStr = conditions.length > 0 ? pb.filter(conditions.join(' && '), params) : '';

      const res = await pb.collection('report').getList<ReportRecord>(page, perPage, {
        sort: '-created_at',
        filter: filterStr,
        $autoCancel: false
      });

      setReports(res.items);
      setTotalPages(res.totalPages);
    } catch (error) {
      console.error("Gagal mengambil data report:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset page jika search berubah
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Trigger Fetching
  useEffect(() => {
    fetchReports();
  }, [page, debouncedSearch, dateRange]);

  const handleResetFilter = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setPage(1);
  };

  // --- SUMMARY CALCULATIONS (Berdasarkan data yang tampil di tabel saat ini) ---
  const summary = useMemo(() => {
    let totalOmset = 0;
    let totalLaba = 0;
    let totalPengeluaran = 0;
    let totalPemasukanLain = 0;

    reports.forEach(r => {
      totalOmset += (r.omset_toko + r.omset_servis + r.omset_minuman);
      totalLaba += r.laba_penjualan;
      totalPengeluaran += (r.operasional_toko + r.pengeluaran_lain);
      totalPemasukanLain += r.pemasukan_lain;
    });

    const labaBersih = (totalLaba + totalPemasukanLain) - totalPengeluaran;

    return { totalOmset, totalLaba, totalPengeluaran, labaBersih };
  }, [reports]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans p-4 md:p-8 pt-24 md:pt-8 overflow-hidden w-full">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="text-blue-600" size={32} /> Laporan Keuangan
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Overview Mutasi & Performa Bisnis
          </p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="bg-white border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 font-bold text-xs px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Download size={16} /> EXCEL / PDF
        </button>
      </div>

      {/* FILTER & SEARCH BAR SECTION */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4 mb-6 shrink-0 z-10 relative">
        
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Cari ID atau Keterangan/Teks..." 
            className="w-full pl-14 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-sm text-slate-700 outline-none border border-transparent focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="flex items-center bg-slate-50 rounded-2xl pr-4 border border-transparent focus-within:border-blue-200 transition-all">
            <div className="pl-5 pr-2 text-slate-400"><Calendar size={18}/></div>
            <input 
              type="date" 
              className="py-4 bg-transparent font-bold text-xs text-slate-600 outline-none cursor-pointer uppercase"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            />
          </div>
          <div className="hidden sm:flex items-center text-slate-300 font-black">-</div>
          <div className="flex items-center bg-slate-50 rounded-2xl pr-4 border border-transparent focus-within:border-blue-200 transition-all">
            <div className="pl-5 pr-2 text-slate-400"><Calendar size={18}/></div>
            <input 
              type="date" 
              className="py-4 bg-transparent font-bold text-xs text-slate-600 outline-none cursor-pointer uppercase"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>
        </div>

        {/* Reset Button */}
        <button 
          onClick={handleResetFilter}
          className="bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-bold text-xs px-6 py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw size={16} /> RESET
        </button>
      </div>

      {/* SUMMARY WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-[2rem] shadow-lg shadow-blue-200 text-white relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-1 flex items-center gap-1"><TrendingUp size={14} /> Total Omset</p>
          <p className="text-2xl font-black tabular-nums">{formatRp(summary.totalOmset)}</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-6 rounded-[2rem] shadow-lg shadow-emerald-200 text-white relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1 flex items-center gap-1"><DollarSign size={14} /> Laba Penjualan</p>
          <p className="text-2xl font-black tabular-nums">{formatRp(summary.totalLaba)}</p>
        </div>

        <div className="bg-gradient-to-br from-rose-400 to-rose-500 p-6 rounded-[2rem] shadow-lg shadow-rose-200 text-white relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-100 mb-1 flex items-center gap-1"><TrendingDown size={14} /> Pengeluaran</p>
          <p className="text-2xl font-black tabular-nums">{formatRp(summary.totalPengeluaran)}</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-800 to-slate-900 p-6 rounded-[2rem] shadow-lg shadow-indigo-200 text-white relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1 flex items-center gap-1"><Wallet size={14} /> Est. Laba Bersih</p>
          <p className={`text-2xl font-black tabular-nums ${summary.labaBersih < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {formatRp(summary.labaBersih)}
          </p>
        </div>
      </div>

      {/* DATA TABLE SECTION */}
      <div className="flex-1 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 p-10">
              <Filter size={48} className="opacity-20" />
              <p className="font-bold">Tidak ada data laporan ditemukan.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Keterangan</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Omset Toko</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Omset Servis</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Omset Minum</th>
                  <th className="p-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-right bg-emerald-50/50">Laba Jual</th>
                  <th className="p-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right bg-rose-50/50">Operasional</th>
                  <th className="p-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-right bg-rose-50/50">Keluar Lain</th>
                  <th className="p-4 text-[10px] font-black text-blue-500 uppercase tracking-widest text-right bg-blue-50/50">Masuk Lain</th>
                  <th className="p-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right bg-slate-100">Kasir Toko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {reports.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 whitespace-nowrap text-slate-400">{formatDate(row.created_at)}</td>
                    <td className="p-4 max-w-[200px] truncate group-hover:text-clip group-hover:whitespace-normal transition-all" title={row.text}>
                      {row.text || '-'}
                    </td>
                    <td className="p-4 text-right tabular-nums">{formatRp(row.omset_toko)}</td>
                    <td className="p-4 text-right tabular-nums">{formatRp(row.omset_servis)}</td>
                    <td className="p-4 text-right tabular-nums">{formatRp(row.omset_minuman)}</td>
                    <td className="p-4 text-right tabular-nums text-emerald-600 bg-emerald-50/10 font-bold">{formatRp(row.laba_penjualan)}</td>
                    <td className="p-4 text-right tabular-nums text-rose-500 bg-rose-50/10">{formatRp(row.operasional_toko)}</td>
                    <td className="p-4 text-right tabular-nums text-rose-500 bg-rose-50/10">{formatRp(row.pengeluaran_lain)}</td>
                    <td className="p-4 text-right tabular-nums text-blue-600 bg-blue-50/10">{formatRp(row.pemasukan_lain)}</td>
                    <td className="p-4 text-right tabular-nums text-slate-900 bg-slate-50 font-black">{formatRp(row.kasir_toko)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION */}
        <div className="bg-white p-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
            Halaman {page} dari {totalPages || 1}
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
              className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages || totalPages === 0}
              className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}