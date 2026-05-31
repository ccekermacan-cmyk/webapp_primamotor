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
  const perPage = 31;

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

      if (debouncedSearch) {
        conditions.push(`(text ~ {:search} || id ~ {:search})`);
        params.search = debouncedSearch;
      }
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
      setPage(1);
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

  // --- SUMMARY CALCULATIONS ---
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
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 md:p-8 pt-16 md:pt-20">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0 mt-2 sm:mt-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="text-blue-600" size={28} /> Laporan Keuangan
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Overview Mutasi & Performa Bisnis
          </p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="bg-white border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Download size={16} /> EXCEL / PDF
        </button>
      </div>

      {/* FILTER & SEARCH BAR SECTION */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4 mb-6">
        {/* Search input */}
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari ID atau Keterangan..." 
            className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl font-medium text-sm text-slate-700 outline-none border focus:border-blue-300 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date range & reset button - responsive row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-1 gap-2">
            <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-3 border focus-within:border-blue-300">
              <Calendar size={16} className="text-slate-400 mr-2" />
              <input 
                type="date" 
                className="w-full py-3 bg-transparent font-medium text-xs text-slate-600 outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>
            <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-3 border focus-within:border-blue-300">
              <Calendar size={16} className="text-slate-400 mr-2" />
              <input 
                type="date" 
                className="w-full py-3 bg-transparent font-medium text-xs text-slate-600 outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
          </div>
          <button 
            onClick={handleResetFilter}
            className="bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw size={14} /> RESET
          </button>
        </div>
      </div>

      {/* SUMMARY WIDGETS - Responsif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-md shadow-blue-200 text-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-100 mb-1 flex items-center gap-1"><TrendingUp size={14} /> Total Omset</p>
          <p className="text-xl font-black">{formatRp(summary.totalOmset)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-5 rounded-2xl shadow-md shadow-emerald-200 text-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100 mb-1 flex items-center gap-1"><DollarSign size={14} /> Laba Penjualan</p>
          <p className="text-xl font-black">{formatRp(summary.totalLaba)}</p>
        </div>
        <div className="bg-gradient-to-br from-rose-400 to-rose-500 p-5 rounded-2xl shadow-md shadow-rose-200 text-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-100 mb-1 flex items-center gap-1"><TrendingDown size={14} /> Pengeluaran</p>
          <p className="text-xl font-black">{formatRp(summary.totalPengeluaran)}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-800 to-slate-900 p-5 rounded-2xl shadow-md shadow-indigo-200 text-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-200 mb-1 flex items-center gap-1"><Wallet size={14} /> Est. Laba Bersih</p>
          <p className={`text-xl font-black ${summary.labaBersih < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
            {formatRp(summary.labaBersih)}
          </p>
        </div>
      </div>

      {/* DATA TABLE SECTION */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[800px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Keterangan</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Omset Toko</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Omset Servis</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Omset Minum</th>
                  <th className="p-3 text-[10px] font-black text-emerald-600 uppercase tracking-wider text-right bg-emerald-50/50">Laba Jual</th>
                  <th className="p-3 text-[10px] font-black text-rose-600 uppercase tracking-wider text-right bg-rose-50/50">Operasional</th>
                  <th className="p-3 text-[10px] font-black text-rose-600 uppercase tracking-wider text-right bg-rose-50/50">Keluar Lain</th>
                  <th className="p-3 text-[10px] font-black text-blue-600 uppercase tracking-wider text-right bg-blue-50/50">Masuk Lain</th>
                  <th className="p-3 text-[10px] font-black text-slate-700 uppercase tracking-wider text-right bg-slate-100">Kasir Toko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                      <p className="mt-3 text-slate-400 text-xs">Memuat data...</p>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center text-slate-400">
                      <Filter size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Tidak ada data laporan ditemukan.</p>
                    </td>
                  </tr>
                ) : (
                  reports.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-3 whitespace-nowrap text-slate-500 text-[11px]">{formatDate(row.created_at)}</td>
                      <td className="p-3 max-w-[200px] truncate" title={row.text}>{row.text || '-'}</td>
                      <td className="p-3 text-right tabular-nums text-slate-600">{formatRp(row.omset_toko)}</td>
                      <td className="p-3 text-right tabular-nums text-slate-600">{formatRp(row.omset_servis)}</td>
                      <td className="p-3 text-right tabular-nums text-slate-600">{formatRp(row.omset_minuman)}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-600 font-semibold bg-emerald-50/20">{formatRp(row.laba_penjualan)}</td>
                      <td className="p-3 text-right tabular-nums text-rose-500">{formatRp(row.operasional_toko)}</td>
                      <td className="p-3 text-right tabular-nums text-rose-500">{formatRp(row.pengeluaran_lain)}</td>
                      <td className="p-3 text-right tabular-nums text-blue-600">{formatRp(row.pemasukan_lain)}</td>
                      <td className="p-3 text-right tabular-nums text-slate-800 font-bold bg-slate-50">{formatRp(row.kasir_toko)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        {!loading && reports.length > 0 && (
          <div className="bg-white p-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Halaman {page} dari {totalPages || 1}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages || totalPages === 0}
                className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}