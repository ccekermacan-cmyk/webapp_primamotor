import { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import { 
  Search, Calendar, ChevronLeft, ChevronRight, Download, 
  TrendingUp, TrendingDown, DollarSign, Wallet, FileText, 
  Filter, RefreshCw, BarChart3, Lightbulb, Coffee, Wrench, Store
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

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

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchReports();
  }, [page, debouncedSearch, dateRange]);

  const handleResetFilter = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setPage(1);
  };

  // --- SUMMARY & ANALYTICS CALCULATIONS ---
  const { summary, chartData, kesimpulan } = useMemo(() => {
    let totalOmsetToko = 0, totalOmsetServis = 0, totalOmsetMinum = 0;
    let totalLaba = 0, totalPengeluaran = 0, totalPemasukanLain = 0;

    // Untuk Chart (Dibalik agar kronologis dari kiri ke kanan)
    const reversedReports = [...reports].reverse();
    const chartData = reversedReports.map(r => ({
      tanggal: formatDate(r.created_at).split(' ')[0],
      Omset: r.omset_toko + r.omset_servis + r.omset_minuman,
      Pengeluaran: r.operasional_toko + r.pengeluaran_lain,
      Laba: r.laba_penjualan
    }));

    reports.forEach(r => {
      totalOmsetToko += r.omset_toko;
      totalOmsetServis += r.omset_servis;
      totalOmsetMinum += r.omset_minuman;
      totalLaba += r.laba_penjualan;
      totalPengeluaran += (r.operasional_toko + r.pengeluaran_lain);
      totalPemasukanLain += r.pemasukan_lain;
    });

    const totalOmset = totalOmsetToko + totalOmsetServis + totalOmsetMinum;
    const labaBersih = (totalLaba + totalPemasukanLain) - totalPengeluaran;

    // Logic Kesimpulan Dinamis
    let insight = "Belum ada data cukup untuk dianalisa.";
    if (reports.length > 0) {
      const statusLaba = labaBersih > 0 ? "positif (menguntungkan)" : "negatif (merugi)";
      const penyumbangTerbesar = 
        Math.max(totalOmsetToko, totalOmsetServis, totalOmsetMinum) === totalOmsetToko ? 'Penjualan Toko' :
        Math.max(totalOmsetToko, totalOmsetServis, totalOmsetMinum) === totalOmsetServis ? 'Jasa Servis' : 'Penjualan Minuman';

      insight = `Berdasarkan data periode ini, performa bisnis menunjukkan tren ${statusLaba} dengan estimasi laba bersih mencapai Rp ${labaBersih.toLocaleString('id-ID')}. Mayoritas porsi pendapatan didominasi oleh sektor ${penyumbangTerbesar}. ${totalPengeluaran > totalLaba ? 'Perhatian: Total pengeluaran saat ini lebih tinggi dari laba penjualan kotor.' : 'Pengeluaran operasional masih dalam batas aman di bawah laba kotor.'}`;
    }

    return { 
      summary: { totalOmset, totalLaba, totalPengeluaran, labaBersih, totalOmsetToko, totalOmsetServis, totalOmsetMinum },
      chartData,
      kesimpulan: insight
    };
  }, [reports]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 md:p-8 pt-16 md:pt-10">
      
      {/* PEMBUNGKUS UTAMA: max-w-6xl mx-auto agar lebarnya proporsional dan sama dengan halaman Cashflow */}
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 relative">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-200">
                <BarChart3 size={24} />
              </div>
              Analitik Laporan
            </h1>
            <p className="text-sm font-bold text-slate-400 mt-2">Overview Mutasi & Performa Bisnis Prima Motor</p>
          </div>
          <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl shadow-slate-200 transition-all flex items-center gap-2 active:scale-95">
            <Download size={16} /> UNDUH REPORT
          </button>
        </div>

        {/* SEARCH & FILTER */}
        <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari keterangan mutasi..." 
              className="w-full pl-12 pr-4 py-4 bg-transparent font-bold text-sm text-slate-700 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full lg:w-[1px] h-[1px] lg:h-auto bg-slate-100" />
          <div className="flex flex-col sm:flex-row gap-2 flex-1 p-2">
            <div className="flex-1 flex items-center bg-slate-50 rounded-2xl px-4 border border-transparent focus-within:border-blue-200 focus-within:bg-white transition-all">
              <Calendar size={16} className="text-blue-400 mr-2" />
              <input 
                type="date" 
                className="w-full py-3 bg-transparent font-bold text-xs text-slate-600 outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>
            <div className="flex items-center justify-center text-slate-300 font-bold hidden sm:block mt-3">-</div>
            <div className="flex-1 flex items-center bg-slate-50 rounded-2xl px-4 border border-transparent focus-within:border-blue-200 focus-within:bg-white transition-all">
              <Calendar size={16} className="text-rose-400 mr-2" />
              <input 
                type="date" 
                className="w-full py-3 bg-transparent font-bold text-xs text-slate-600 outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
            <button onClick={handleResetFilter} className="bg-slate-100 text-slate-500 hover:bg-slate-200 font-black text-xs px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors">
              <RefreshCw size={14} /> RESET
            </button>
          </div>
        </div>

        {/* WIDGETS + KESIMPULAN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Kolom Kiri: Angka Ringkasan */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-emerald-200 transition-colors">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingUp size={24} strokeWidth={2.5} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Omset Kotor</p>
                <p className="text-2xl font-black text-slate-800">{formatRp(summary.totalOmset)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-emerald-200 transition-colors">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><DollarSign size={24} strokeWidth={2.5} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Laba Penjualan</p>
                <p className="text-2xl font-black text-slate-800">{formatRp(summary.totalLaba)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-rose-200 transition-colors">
              <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingDown size={24} strokeWidth={2.5} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Pengeluaran</p>
                <p className="text-2xl font-black text-slate-800">{formatRp(summary.totalPengeluaran)}</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl shadow-xl shadow-indigo-900/20 flex items-center gap-5 text-white transform hover:-translate-y-1 transition-transform">
              <div className="w-14 h-14 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center"><Wallet size={24} strokeWidth={2.5} className="text-emerald-400"/></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Estimasi Laba Bersih</p>
                <p className={`text-2xl font-black ${summary.labaBersih < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {formatRp(summary.labaBersih)}
                </p>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Kesimpulan AI / Analisa Otomatis */}
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={20} className="text-amber-500" strokeWidth={2.5} />
              <h3 className="font-black text-amber-700 uppercase tracking-widest text-xs">Insight Sistem</h3>
            </div>
            <p className="text-sm font-bold text-amber-900 leading-relaxed italic">
              "{kesimpulan}"
            </p>
          </div>
        </div>

        {/* GRAFIK PERKEMBANGAN */}
        {!loading && chartData.length > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 h-[300px] flex flex-col">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Grafik Tren Keuangan</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tanggal" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} tickFormatter={(val) => `Rp${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, undefined]}
                  />
                  <Area type="monotone" dataKey="Omset" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOmset)" />
                  <Area type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorPengeluaran)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* DAFTAR DATA */}
        <div className="flex-1 flex flex-col pb-10">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Detail Riwayat Laporan</h3>

          {loading ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-slate-400 text-xs font-bold uppercase tracking-widest">Sinkronisasi Data...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <Filter size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="font-bold text-slate-500">Tidak ada data laporan ditemukan untuk filter ini.</p>
            </div>
          ) : (
            <>
              {/* TAMPILAN MOBILE (HP) */}
              <div className="md:hidden space-y-4">
                {reports.map((row) => (
                  <div key={row.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-3xl" />
                    
                    <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
                      <div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg uppercase">{formatDate(row.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Kasir Toko</p>
                        <p className="font-black text-slate-800 text-sm">{formatRp(row.kasir_toko)}</p>
                      </div>
                    </div>
                    
                    <p className="font-bold text-slate-700 text-sm mb-4 leading-snug">{row.text || 'Tanpa keterangan'}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-1"><Store size={10}/> Omset Toko</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{formatRp(row.omset_toko)}</span>
                      </div>
                      <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                        <span className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1"><Wrench size={10}/> Omset Servis</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{formatRp(row.omset_servis)}</span>
                      </div>
                      <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1"><Coffee size={10}/> Omset Minum</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{formatRp(row.omset_minuman)}</span>
                      </div>
                      <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                        <span className="text-[9px] font-black text-rose-600 uppercase flex items-center gap-1"><TrendingDown size={10}/> Pengeluaran</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{formatRp(row.operasional_toko + row.pengeluaran_lain)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                      <span className="text-[10px] font-black text-emerald-600 uppercase">Laba Penjualan</span>
                      <span className="font-black text-emerald-600">{formatRp(row.laba_penjualan)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* TAMPILAN DESKTOP */}
              <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                      <tr>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                        <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Omset (Mix)</th>
                        <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Laba Jual</th>
                        <th className="p-4 text-[10px] font-black text-rose-600 uppercase tracking-widest text-right">Pengeluaran</th>
                        <th className="p-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-right">Masuk Lain</th>
                        <th className="p-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-right">Kasir Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                      {reports.map((row) => {
                        const totalOmsetRow = row.omset_toko + row.omset_servis + row.omset_minuman;
                        const totalKeluarRow = row.operasional_toko + row.pengeluaran_lain;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="p-4 whitespace-nowrap text-slate-400">{formatDate(row.created_at)}</td>
                            <td className="p-4 max-w-[250px] truncate" title={row.text}>{row.text || '-'}</td>
                            
                            <td className="p-4 text-right">
                              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg border border-emerald-100">{formatRp(totalOmsetRow)}</span>
                            </td>
                            <td className="p-4 text-right text-emerald-600 font-bold">{formatRp(row.laba_penjualan)}</td>
                            <td className="p-4 text-right">
                              <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg border border-rose-100">{formatRp(totalKeluarRow)}</span>
                            </td>
                            <td className="p-4 text-right text-blue-600">{formatRp(row.pemasukan_lain)}</td>
                            <td className="p-4 text-right text-slate-900 font-black">{formatRp(row.kasir_toko)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAGINATION */}
              <div className="bg-white mt-4 p-4 rounded-3xl border border-slate-100 flex justify-between items-center shrink-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg">
                  Hal. {page} / {totalPages || 1}
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page === totalPages || totalPages === 0}
                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}