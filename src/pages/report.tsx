import { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import { 
  Search, Calendar, ChevronLeft, ChevronRight, Download, 
  TrendingUp, TrendingDown, DollarSign, Wallet, FileText, 
  Filter, RefreshCw, BarChart3, Lightbulb, Coffee, Wrench, Store, X,
  Plus
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line
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
  piutang: number;   // tambahan
  hutang: number;    // tambahan
}

export default function ReportPage() {
  // --- STATES ---
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMetrics, setSelectedMetrics] = useState({
    Omset: true,
    Pengeluaran: true,
    Laba: false,
    Piutang: true,
    Hutang: true,
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 31;

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Tambahkan setelah state existing
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateDate, setGenerateDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [todayReportExists, setTodayReportExists] = useState(false);

  // --- FORMATTER HELPER ---
  const formatRp = (num: number | undefined) => {
    const val = num ?? 0;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const [detailModal, setDetailModal] = useState<{ type: string; title: string; items: { label: string; value: number }[] } | null>(null);

  // State untuk detail report
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [reportDetailData, setReportDetailData] = useState<{ menu: any[]; logStock: any[]; cashflow: any[] } | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'menu' | 'logstock' | 'cashflow'>('overview');

  // Filter untuk tab Menu
  const [menuFilterJenis, setMenuFilterJenis] = useState<string>('semua');
  // Filter untuk tab Log Stock
  const [logStockFilterRefJenis, setLogStockFilterRefJenis] = useState<string>('semua');
  // Filter untuk tab Cashflow
  const [cashflowFilterMutasi, setCashflowFilterMutasi] = useState<string>('semua');
  const [cashflowFilterAccount, setCashflowFilterAccount] = useState<string>('semua');
  const [cashflowFilterJenis, setCashflowFilterJenis] = useState<string>('semua');

  // Tambahkan setelah formatDate
  const getDayRange = (date: Date) => {
    const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
    return { start, end };
  };

  // --- FETCH DATA ---
  const fetchReports = async () => {
    setLoading(true);
    try {
      let conditions: string[] = [];
      let params: any = {};

      // Filter Search
      if (debouncedSearch) { 
        conditions.push(`(text ~ {:search} || id ~ {:search})`); 
        params.search = debouncedSearch; 
      }
      
      // Filter Tanggal - INI KUNCINYA
      // Helper function - letakkan di dalam komponen (setelah deklarasi state)
      const toLocalDateISO = (dateStr: string, endOfDay = false) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const hour = endOfDay ? 23 : 0;
        const minute = endOfDay ? 59 : 0;
        const second = endOfDay ? 59 : 0;
        const localDate = new Date(year, month - 1, day, hour, minute, second);
        return localDate.toISOString();
      };

      // Kemudian di dalam fetchReports, ganti filter dengan:
      if (dateRange.start) {
        conditions.push(`created_at >= {:start}`);
        params.start = toLocalDateISO(dateRange.start, false);
      }
      if (dateRange.end) {
        conditions.push(`created_at <= {:end}`);
        params.end = toLocalDateISO(dateRange.end, true);
      }

      const filterStr = conditions.length > 0 ? pb.filter(conditions.join(' && '), params) : '';

      // Fetch Laporan
      const res = await pb.collection('report').getList<ReportRecord>(page, perPage, {
        sort: '-created_at',
        filter: filterStr,
        $autoCancel: false
      });

      // Langsung set reports, karena field piutang dan hutang sudah ada di dalam setiap item report
      setReports(res.items);
      setTotalPages(res.totalPages);
    } catch (error) {
      console.error("Gagal:", error);
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

  // Tambahkan setelah useEffect fetchReports
  useEffect(() => {
    const checkTodayReport = async () => {
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      const { start, end } = getDayRange(todayUtc);
      try {
        const res = await pb.collection('report').getList(1, 1, {
          filter: pb.filter('created_at >= {:start} && created_at <= {:end}', { start: start.toISOString(), end: end.toISOString() }),
        });
        setTodayReportExists(res.totalItems > 0);
      } catch (e) {
        setTodayReportExists(false);
      }
    };
    checkTodayReport();
  }, [reports]);

  // --- SUMMARY & ANALYTICS CALCULATIONS ---
  const { summary, chartData, kesimpulan } = useMemo(() => {
    let totalOmsetToko = 0, totalOmsetServis = 0, totalOmsetMinum = 0;
    let totalLaba = 0, totalPengeluaran = 0, totalPemasukanLain = 0;

    // Untuk Chart (Dibalik agar kronologis dari kiri ke kanan)
    const reversedReports = [...reports].reverse();
    const chartData = reversedReports.map(r => {
      const tanggal = formatDate(r.created_at).split(' ')[0];
      return {
        tanggal,
        Omset: r.omset_toko + r.omset_servis + r.omset_minuman,
        Pengeluaran: r.operasional_toko + r.pengeluaran_lain,
        Laba: r.laba_penjualan,
        Piutang: r.piutang || 0,
        Hutang: r.hutang || 0,
      };
    });

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


    // Hitung breakdown dari semua laporan (untuk periode filter)
    const breakdown = useMemo(() => {
      let totalOmsetToko = 0, totalOmsetServis = 0, totalOmsetMinuman = 0;
      let totalLaba = 0, totalPemasukanLain = 0;
      let totalPengeluaranLain = 0, totalOperasional = 0;
      
      reports.forEach(r => {
        totalOmsetToko += r.omset_toko;
        totalOmsetServis += r.omset_servis;
        totalOmsetMinuman += r.omset_minuman;
        totalLaba += r.laba_penjualan;
        totalPemasukanLain += r.pemasukan_lain;
        totalPengeluaranLain += r.pengeluaran_lain;
        totalOperasional += r.operasional_toko;
      });

      return {
        omset: [
          { label: "Omset Toko", value: totalOmsetToko },
          { label: "Omset Servis", value: totalOmsetServis },
          { label: "Omset Minuman", value: totalOmsetMinuman },
        ],
        pemasukan: [
          { label: "Laba Penjualan", value: totalLaba },
          { label: "Pemasukan Lain", value: totalPemasukanLain },
        ],
        pengeluaran: [
          { label: "Operasional Toko", value: totalOperasional },
          { label: "Pengeluaran Lain", value: totalPengeluaranLain },
        ],
      };
    }, [reports]);

    const [addingReport, setAddingReport] = useState(false);

    // Fungsi untuk menambah laporan harian
    const handleAddReport = async () => {
      if (addingReport) return;
      setAddingReport(true);
      try {
        // 1. Dapatkan tanggal hari ini dalam zona waktu lokal (WIB)
        const now = new Date();
        const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // todayLocal adalah 00:00:00 WIB hari ini

        // Buat created_at = 00:00 UTC pada tanggal hari ini (lokal)
        // Karena WIB = UTC+7, 00:00 UTC = 07:00 WIB
        const todayUtc = new Date(Date.UTC(
          todayLocal.getFullYear(),
          todayLocal.getMonth(),
          todayLocal.getDate(),
          0, 0, 0, 0
        ));
        const created_at = todayUtc.toISOString();

        // CEK APAKAH LAPORAN HARI INI SUDAH ADA
        const { start, end } = getDayRange(todayUtc);
        const existing = await pb.collection('report').getList(1, 1, {
          filter: pb.filter('created_at >= {:start} && created_at <= {:end}', { 
            start: start.toISOString(), 
            end: end.toISOString() 
          }),
        });
        if (existing.totalItems > 0) {
          alert('Laporan untuk hari ini sudah ada!');
          setAddingReport(false);
          return;
        }

        // 2. Cari laporan kemarin (berdasarkan tanggal lokal)
        const yesterdayLocal = new Date(todayLocal);
        yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);
        
        // Rentang UTC untuk kemarin: dari 00:00:00 UTC sampai 23:59:59.999 UTC
        const startYesterday = new Date(Date.UTC(
          yesterdayLocal.getFullYear(),
          yesterdayLocal.getMonth(),
          yesterdayLocal.getDate(),
          0, 0, 0, 0
        ));
        const endYesterday = new Date(Date.UTC(
          yesterdayLocal.getFullYear(),
          yesterdayLocal.getMonth(),
          yesterdayLocal.getDate(),
          23, 59, 59, 999
        ));

        const yesterdayFilter = pb.filter(
          'created_at >= {:start} && created_at <= {:end}',
          { start: startYesterday.toISOString(), end: endYesterday.toISOString() }
        );

        const yesterdayReports = await pb.collection('report').getList(1, 1, {
          filter: yesterdayFilter,
          sort: '-created_at',
        });

        // Ambil nilai dari laporan kemarin (jika ada)
        const lastReport = yesterdayReports.items.length > 0 ? yesterdayReports.items[0] : null;
        const kasirKemarin = lastReport?.kasir_toko ?? 0;
        const piutangKemarin = lastReport?.piutang ?? 0;
        const hutangKemarin = lastReport?.hutang ?? 0;

        // 3. Buat data laporan baru dengan nilai default 0, kecuali yang diambil dari kemarin
        const newReport = {
          text: `Laporan harian ${todayLocal.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`,
          omset_toko: 0,
          omset_servis: 0,
          omset_minuman: 0,
          laba_penjualan: 0,
          operasional_toko: 0,
          pengeluaran_lain: 0,
          kasir_toko: kasirKemarin,
          pemasukan_lain: 0,
          piutang: piutangKemarin,
          hutang: hutangKemarin,
          created_at: created_at,
        };

        await pb.collection('report').create(newReport);

        // 4. Refresh data
        await fetchReports();
        alert('Laporan hari ini berhasil dibuat!');
      } catch (error) {
        console.error(error);
        alert('Gagal membuat laporan: ' + (error as any)?.message || '');
      } finally {
        setAddingReport(false);
      }
    };

    // Tambahkan setelah handleAddReport

    const calculateReportData = async (targetDate: Date) => {
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // --- 1. Ambil semua produk untuk mapping kategori ---
      const allProducts = await pb.collection('produk').getFullList({ fields: 'id,kategori' });
      const productMap = allProducts.reduce((acc, p) => { acc[p.id] = p.kategori; return acc; }, {});

      // --- 2. Log Stock (ambil semua, filter manual) ---
      const yearMonth = targetDateStr.substring(0, 7); // YYYY-MM
      const logStockFilter = pb.filter('created_at >= {:start} && created_at <= {:end}', {
        start: `${yearMonth}-01T00:00:00.000Z`,
        end: `${yearMonth}-31T23:59:59.999Z`
      });
      const logStockItems = await pb.collection('log_stock').getFullList({
        filter: logStockFilter,
        fields: 'created_at, item_baru, price_1, price_2, qty',
      });

      // Variabel untuk menyimpan hasil aggregasi
      let totalOmsetSemua = 0;      // total price_1 * qty semua produk
      let totalModalSemua = 0;      // total price_2 * qty semua produk
      let omsetPenjualan = 0;       // untuk omset_toko (non-minuman)
      let omsetMinuman = 0;         // untuk omset_minuman

      logStockItems.forEach(item => {
        const itemDate = new Date(item.created_at).toISOString().split('T')[0];
        if (itemDate !== targetDateStr) return;

        const kategori = productMap[item.item_baru] || '';
        const nilaiJual = (item.price_1 || 0) * (item.qty || 0);
        const nilaiModal = (item.price_2 || 0) * (item.qty || 0);

        totalOmsetSemua += nilaiJual;
        totalModalSemua += nilaiModal;

        if (kategori.toLowerCase() !== 'minuman') {
          omsetPenjualan += nilaiJual;
        } else {
          omsetMinuman += nilaiJual;
        }
      });

      // --- 3. Ongkos Servis (filter manual) ---
      const ongkosAll = await pb.collection('ongkos').getFullList({ fields: 'date, ongkos' });
      let omsetServis = 0;
      ongkosAll.forEach(item => {
        if (item.date === targetDateStr) {
          omsetServis += item.ongkos || 0;
        }
      });

      // --- 4. Cashflow ---
      const cashflowFilter = pb.filter('created_at >= {:start} && created_at <= {:end}', {
        start: `${yearMonth}-01T00:00:00.000Z`,
        end: `${yearMonth}-31T23:59:59.999Z`
      });
      const cashflowItems = await pb.collection('cashflow').getFullList({
        filter: cashflowFilter,
        fields: 'created_at, jenis, nominal, acc1, acc2, mutasi',
      });

      let operasionalToko = 0;
      let pengeluaranLain = 0;
      let pemasukanLain = 0;
      let cashKasir = 0;

      cashflowItems.forEach(cf => {
        const itemDate = new Date(cf.created_at).toISOString().split('T')[0];
        if (itemDate !== targetDateStr) return;

        const jenis = (cf.jenis || '').toLowerCase();
        const nominal = cf.nominal || 0;
        if (jenis.includes('operasional')) {
          operasionalToko += nominal;
        } else if (jenis.includes('pengeluaran')) {
          pengeluaranLain += nominal;
        } else if (jenis.includes('pemasukan')) {
          pemasukanLain += nominal;
        }

        const acc1 = (cf.acc1 || '').toLowerCase();
        const acc2 = (cf.acc2 || '').toLowerCase();
        const mutasi = (cf.mutasi || '').toLowerCase();
        if (acc1 === 'cashkasir' && mutasi === 'in') {
          cashKasir += nominal;
        } else if (acc2 === 'cashkasir' && mutasi === 'out') {
          cashKasir += nominal;
        } else if (acc1 === 'cashkasir' && mutasi === 'out') {
          cashKasir -= nominal;
        }
      });

      // --- 5. Menu untuk Hutang & Piutang ---
      const menuFilter = pb.filter('created_at >= {:start} && created_at <= {:end}', {
        start: `${yearMonth}-01T00:00:00.000Z`,
        end: `${yearMonth}-31T23:59:59.999Z`
      });
      const menuItems = await pb.collection('menu').getFullList({
        filter: menuFilter,
        fields: 'created_at, status, jenis, total, dibayar',
      });

      let totalPiutangPembelian = 0;
      let totalDibayarNonPembelian = 0;
      let totalHutang = 0;
      let totalDibayarHutang = 0;

      menuItems.forEach(m => {
        const itemDate = new Date(m.created_at).toISOString().split('T')[0];
        if (itemDate !== targetDateStr) return;

        const status = (m.status || '').toLowerCase();
        if (status === 'belum') {
          const total = m.total || 0;
          const dibayar = m.dibayar || 0;
          const jenis = (m.jenis || '').toLowerCase();
          totalHutang += total;
          totalDibayarHutang += dibayar;
          if (jenis === 'pembelian') {
            totalPiutangPembelian += total;
          } else {
            totalDibayarNonPembelian += dibayar;
          }
        }
      });

      const hutangFinal = totalHutang - totalDibayarHutang;
      const piutangFinal = totalPiutangPembelian - totalDibayarNonPembelian;

      // --- 6. Laba Penjualan (total omset semua produk - total modal semua produk) ---
      const labaPenjualan = totalOmsetSemua - totalModalSemua;

      return {
        omset_toko: omsetPenjualan,
        omset_servis: omsetServis,
        omset_minuman: omsetMinuman,
        laba_penjualan: labaPenjualan,
        operasional_toko: operasionalToko,
        pengeluaran_lain: pengeluaranLain,
        pemasukan_lain: pemasukanLain,
        hutang: hutangFinal,
        piutang: piutangFinal,
        kasir_toko: cashKasir,
      };
    };

    const handleGenerateReport = async (dateStr?: string) => {
      if (generating) return;
      setGenerating(true);
      try {
        let targetDate: Date;
        if (dateStr) {
          const parts = dateStr.split('-').map(Number);
          targetDate = new Date(Date.UTC(parts[0], parts[1]-1, parts[2], 0, 0, 0, 0));
        } else {
          const now = new Date();
          targetDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
        }

        const { start, end } = getDayRange(targetDate);
        const existing = await pb.collection('report').getList(1, 1, {
          filter: pb.filter('created_at >= {:start} && created_at <= {:end}', { start: start.toISOString(), end: end.toISOString() }),
        });
        if (existing.totalItems > 0) {
          if (!window.confirm(`Laporan untuk tanggal ${targetDate.toISOString().split('T')[0]} sudah ada. Hapus & buat ulang?`)) {
            setGenerating(false);
            return;
          }
          await pb.collection('report').delete(existing.items[0].id);
        }

        const reportData = await calculateReportData(targetDate);
        const newReport = {
          ...reportData,
          text: `Laporan otomatis ${targetDate.toISOString().split('T')[0]}`,
          created_at: targetDate.toISOString(),
        };
        await pb.collection('report').create(newReport);
        await fetchReports();
        setShowGenerateModal(false);
        alert('Laporan berhasil di-generate!');
      } catch (error) {
        console.error(error);
        alert('Gagal generate laporan: ' + (error as any)?.message);
      } finally {
        setGenerating(false);
      }
    };

    const fetchReportDetails = async (report: ReportRecord) => {
      if (!report) return;
      setReportDetailLoading(true);
      try {
        // AMAN: Ambil tanggal mentah YYYY-MM-DD langsung dari database
        const targetDateStr = report.created_at.split(' ')[0]; 

        // Buat range UTC penuh untuk hari tersebut
        const startISO = `${targetDateStr} 00:00:00`;
        const endISO = `${targetDateStr} 23:59:59`;

        // Ambil data menu
        const menuFilter = pb.filter('created_at >= {:start} && created_at <= {:end}', { start: startISO, end: endISO });
        const menuItems = await pb.collection('menu').getFullList({
          filter: menuFilter,
          sort: 'created_at',
          $autoCancel: false,
        });

        // Ambil data log_stock
        const logStockFilter = pb.filter('created_at >= {:start} && created_at <= {:end}', { start: startISO, end: endISO });
        const logStockItems = await pb.collection('log_stock').getFullList({
          filter: logStockFilter,
          sort: 'created_at',
          $autoCancel: false,
        });

        // Ambil data cashflow
        const cashflowFilter = pb.filter('created_at >= {:start} && created_at <= {:end}', { start: startISO, end: endISO });
        const cashflowItems = await pb.collection('cashflow').getFullList({
          filter: cashflowFilter,
          sort: 'created_at',
          $autoCancel: false,
        });

        setReportDetailData({
          menu: menuItems,
          logStock: logStockItems,
          cashflow: cashflowItems,
        });
      } catch (error) {
        console.error('Gagal mengambil detail:', error);
        setReportDetailData({ menu: [], logStock: [], cashflow: [] });
      } finally {
        setReportDetailLoading(false);
      }
    };

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
            <div className="flex gap-2 flex-wrap">
              {!todayReportExists && (
                <button
                  onClick={handleAddReport}
                  disabled={addingReport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl shadow-emerald-200 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {addingReport ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      MENYIMPAN...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      TAMBAH LAPORAN
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowGenerateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl shadow-blue-200 transition-all flex items-center gap-2 active:scale-95"
              >
                <BarChart3 size={16} />
                GENERATE OTOMATIS
              </button>
              <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl shadow-slate-200 transition-all flex items-center gap-2 active:scale-95">
                <Download size={16} /> UNDUH REPORT
              </button>
            </div>
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
              
              {/* 1. Omset Kotor */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                <div className="w-12 h-12 shrink-0 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingUp size={22} strokeWidth={2.5} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Omset Kotor</p>
                  <p className="text-xl font-black text-slate-800 truncate">{formatRp(summary.totalOmset)}</p>
                </div>
              </div>

              {/* 2. Laba Penjualan */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-colors">
                <div className="w-12 h-12 shrink-0 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><DollarSign size={22} strokeWidth={2.5} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Laba Penjualan</p>
                  <p className="text-xl font-black text-slate-800 truncate">{formatRp(summary.totalLaba)}</p>
                </div>
              </div>

              {/* 3. Pengeluaran */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:border-rose-200 transition-colors">
                <div className="w-12 h-12 shrink-0 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingDown size={22} strokeWidth={2.5} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Pengeluaran</p>
                  <p className="text-xl font-black text-slate-800 truncate">{formatRp(summary.totalPengeluaran)}</p>
                </div>
              </div>

              {/* 4. Estimasi Laba Bersih (Sudah diperbaiki urutan tag div-nya) */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-3xl shadow-lg shadow-indigo-900/20 flex items-center gap-4 text-white transform hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 shrink-0 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center"><Wallet size={22} strokeWidth={2.5} className="text-emerald-400"/></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-0.5">Estimasi Laba Bersih</p>
                  <p className={`text-xl font-black truncate ${summary.labaBersih < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatRp(summary.labaBersih)}
                  </p>  
                </div>
              </div>

              {/* 5. Piutang Penjualan */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:border-amber-200 transition-colors">
                <div className="w-12 h-12 shrink-0 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><Wallet size={22} strokeWidth={2.5} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Piutang Penjualan</p>
                  <p className="text-xl font-black text-amber-600 truncate">{formatRp(reports.reduce((sum, r) => sum + (r.piutang || 0), 0))}</p>
                </div>
              </div>

              {/* 6. Hutang Pembelian */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:border-purple-200 transition-colors">
                <div className="w-12 h-12 shrink-0 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><Wallet size={22} strokeWidth={2.5} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Hutang Pembelian</p>
                  <p className="text-xl font-black text-purple-600 truncate">{formatRp(reports.reduce((sum, r) => sum + (r.hutang || 0), 0))}</p>
                </div>
              </div>

            </div>

            {/* Kolom Kanan: Kesimpulan AI / Analisa Otomatis */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6 sm:p-8 rounded-3xl flex flex-col justify-center shadow-sm h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-100 rounded-xl">
                  <Lightbulb size={24} className="text-amber-600" strokeWidth={2.5} />
                </div>
                <h3 className="font-black text-amber-700 uppercase tracking-widest text-xs">Insight Sistem</h3>
              </div>
              <p className="text-sm font-bold text-amber-900 leading-relaxed italic opacity-90">
                "{kesimpulan}"
              </p>
            </div>
          </div>

          {/* GRAFIK PERKEMBANGAN */}
          {!loading && chartData.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 h-[300px] flex flex-col">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Grafik Tren Keuangan</h3>
              
              <div className="flex flex-wrap gap-4 mb-4 border-b border-slate-100 pb-3">
                {Object.keys(selectedMetrics).map(key => {
                  const color = key === 'Omset' ? '#3b82f6' : key === 'Pengeluaran' ? '#f43f5e' : key === 'Laba' ? '#10b981' : key === 'Piutang' ? '#f59e0b' : '#8b5cf6';
                  return (
                    <label key={key} className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMetrics[key as keyof typeof selectedMetrics]}
                        onChange={() => setSelectedMetrics(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="w-4 h-4 rounded border-gray-300 focus:ring-blue-500"
                        style={{ accentColor: color }}
                      />
                      <span style={{ color }}>{key}</span>
                    </label>
                  );
                })}
              </div>

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
                    <Tooltip formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, '']} />
                    {selectedMetrics.Omset && <Area type="monotone" dataKey="Omset" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOmset)" />}
                    {selectedMetrics.Pengeluaran && <Area type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorPengeluaran)" />}
                    {selectedMetrics.Laba && <Line type="monotone" dataKey="Laba" stroke="#10b981" strokeWidth={2} dot={false} />}
                    {selectedMetrics.Piutang && <Line type="monotone" dataKey="Piutang" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />}
                    {selectedMetrics.Hutang && <Line type="monotone" dataKey="Hutang" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} />}
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
                          <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Omset</th>
                          <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Laba</th>
                          <th className="p-4 text-[10px] font-black text-rose-600 uppercase tracking-widest text-right">Keluar</th>
                          <th className="p-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right">Piutang</th>
                          <th className="p-4 text-[10px] font-black text-purple-600 uppercase tracking-widest text-right">Hutang</th>
                          <th className="p-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-right">Kasir Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                        {reports.map((row) => {
                          const totalOmsetRow = row.omset_toko + row.omset_servis + row.omset_minuman;
                          const totalKeluarRow = row.operasional_toko + row.pengeluaran_lain;
                          const piutangVal = row.piutang || 0;
                          const hutangVal = row.hutang || 0;

                          const formatNeg = (num: number) => {
                            const formatted = Math.abs(num).toLocaleString('id-ID');
                            return num < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
                          };

                          return (
                            <tr 
                              key={row.id} 
                              className="hover:bg-slate-50/50 transition-colors group cursor-pointer" 
                              onClick={() => {
                                setSelectedReport(row);
                                fetchReportDetails(row);
                                setActiveDetailTab('overview');
                              }}
                            >
                              <td className="p-4 whitespace-nowrap text-slate-400">{formatDate(row.created_at)}</td>
                              <td className="p-4 max-w-[200px] truncate" title={row.text}>{row.text || '-'}</td>
                              <td className="p-4 text-right">
                                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg border border-emerald-100">
                                  {formatRp(totalOmsetRow)}
                                </span>
                              </td>
                              <td className="p-4 text-right text-emerald-600 font-bold">{formatRp(row.laba_penjualan)}</td>
                              <td className="p-4 text-right text-rose-600">{formatRp(totalKeluarRow)}</td>
                              <td className={`p-4 text-right font-black ${piutangVal < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                {formatNeg(piutangVal)}
                              </td>
                              <td className={`p-4 text-right font-black ${hutangVal < 0 ? 'text-rose-600' : 'text-purple-600'}`}>
                                {formatNeg(hutangVal)}
                              </td>
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

        {/* MODAL DETAIL BREAKDOWN */}
        {detailModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailModal(null)}>
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-800">{detailModal.title}</h3>
                <button onClick={() => setDetailModal(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                {detailModal.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-600">{item.label}</span>
                    <span className="font-black text-slate-900">{formatRp(item.value)}</span>
                  </div>
                ))}
                <div className="pt-3 mt-2 border-t-2 border-slate-200 flex justify-between">
                  <span className="font-black text-slate-800">Total</span>
                  <span className="font-black text-indigo-600">{formatRp(detailModal.items.reduce((sum, i) => sum + i.value, 0))}</span>
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} className="mt-6 w-full py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Tutup</button>
            </div>
          </div>
        )}

        {/* MODAL GENERATE LAPORAN */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGenerateModal(false)}>
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-800">Generate Laporan Otomatis</h3>
                <button onClick={() => setShowGenerateModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Tanggal Laporan</label>
                  <input
                    type="date"
                    className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-sm outline-none focus:border-blue-400 transition-all"
                    value={generateDate}
                    onChange={(e) => setGenerateDate(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan untuk hari ini</p>
                </div>
                <button
                  onClick={() => {
                    const targetDate = generateDate || undefined;
                    handleGenerateReport(targetDate);
                  }}
                  disabled={generating}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      GENERATING...
                    </>
                  ) : (
                    <>
                      <BarChart3 size={16} />
                      GENERATE SEKARANG
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETAIL REPORT */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setSelectedReport(null); setReportDetailData(null); }}>
            <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Detail Laporan {formatDate(selectedReport.created_at)}</h3>
                  <p className="text-sm text-slate-500">{selectedReport.text || 'Tidak ada keterangan'}</p>
                </div>
                <button onClick={() => { setSelectedReport(null); setReportDetailData(null); }} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-1 p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                {['overview', 'menu', 'logstock', 'cashflow'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDetailTab(tab as any)}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      activeDetailTab === tab
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {tab === 'overview' ? '📊 Overview' : 
                     tab === 'menu' ? '📋 Menu' : 
                     tab === 'logstock' ? '📦 Log Stock' : '💰 Cashflow'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {reportDetailLoading ? (
                  <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : activeDetailTab === 'overview' ? (
                  // Overview
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Omset Toko</p>
                      <p className="text-xl font-black text-emerald-600">{formatRp(selectedReport.omset_toko)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Omset Servis</p>
                      <p className="text-xl font-black text-blue-600">{formatRp(selectedReport.omset_servis)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Omset Minuman</p>
                      <p className="text-xl font-black text-amber-600">{formatRp(selectedReport.omset_minuman)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Laba Penjualan</p>
                      <p className="text-xl font-black text-emerald-600">{formatRp(selectedReport.laba_penjualan)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Pengeluaran</p>
                      <p className="text-xl font-black text-rose-600">{formatRp(selectedReport.operasional_toko + selectedReport.pengeluaran_lain)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Kasir Toko</p>
                      <p className="text-xl font-black text-slate-800">{formatRp(selectedReport.kasir_toko)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Piutang</p>
                      <p className="text-xl font-black text-amber-600">{formatRp(selectedReport.piutang)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase">Hutang</p>
                      <p className="text-xl font-black text-purple-600">{formatRp(selectedReport.hutang)}</p>
                    </div>
                  </div>
                ) : activeDetailTab === 'menu' ? (() => {
                  const filteredMenu = reportDetailData?.menu.filter(m => menuFilterJenis === 'semua' || m.jenis === menuFilterJenis) || [];
                  const sumQty = filteredMenu.reduce((acc, m) => acc + (m.qty || 0), 0);
                  const sumTotal = filteredMenu.reduce((acc, m) => acc + (m.total || 0), 0);
                  const sumDibayar = filteredMenu.reduce((acc, m) => acc + (m.dibayar || 0), 0);
                  const sumAdmin = filteredMenu.reduce((acc, m) => acc + (m.admin || 0), 0);
                  const sumCashback = filteredMenu.reduce((acc, m) => acc + (m.cashback || 0), 0);
                  const sumBelum = sumTotal - sumDibayar;

                  return (
                    <div>
                      <div className="flex gap-2 mb-4">
                        <select
                          className="p-2 border border-slate-200 rounded-xl text-sm font-bold bg-white"
                          value={menuFilterJenis}
                          onChange={(e) => setMenuFilterJenis(e.target.value)}
                        >
                          <option value="semua">Semua Jenis Menu</option>
                          {[...new Set(reportDetailData?.menu.map(m => m.jenis) || [])].map(j => (
                            <option key={String(j)} value={String(j)}>{j}</option>
                          ))}
                        </select>
                      </div>
                      <div className="overflow-x-auto overflow-y-auto max-h-[50vh] custom-scrollbar rounded-xl border border-slate-200 shadow-sm relative">
                        <table className="w-full text-xs border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr className="border-b border-slate-200">
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Waktu</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Operator</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Pihak/Orang</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Jenis</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Metode</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Status</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Qty</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Marketplace</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Admin</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Cashback</th>
                              <th className="p-3 text-right font-black text-slate-800 uppercase">Total Invoice</th>
                              <th className="p-3 text-right font-black text-emerald-600 uppercase">Terbayar</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {reportDetailData === null ? (
                              <tr><td colSpan={13} className="p-4 text-center text-slate-400">Memuat data...</td></tr>
                            ) : filteredMenu.length === 0 ? (
                              <tr><td colSpan={13} className="p-4 text-center text-slate-400">Tidak ada data menu.</td></tr>
                            ) : (
                              filteredMenu.map((m, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 text-slate-600 font-medium">
                                  <td className="p-3 font-mono text-[10px]">{new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="p-3 font-bold">{m.operator || '-'}</td>
                                  <td className="p-3 text-blue-600">{m.person || m.person_baru || 'Umum'}</td>
                                  <td className="p-3 font-black text-slate-700">{m.jenis}</td>
                                  <td className="p-3">{m.payment || '-'}</td>
                                  <td className="p-3"><span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${m.status === 'belum' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{m.status}</span></td>
                                  <td className="p-3 text-right font-bold">{m.qty || 0}</td>
                                  <td className="p-3 text-right">{m.marketplace || '-'}</td>
                                  <td className="p-3 text-right text-rose-500">{formatRp(m.admin)}</td>
                                  <td className="p-3 text-right text-emerald-500">{formatRp(m.cashback)}</td>
                                  <td className="p-3 text-right font-black text-slate-800">{formatRp(m.total)}</td>
                                  <td className="p-3 text-right font-black text-emerald-600">{formatRp(m.dibayar)}</td>
                                  <td className="p-3 text-[10px] max-w-[150px] truncate" title={m.text || m.note}>{m.text || m.note || '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* SUMMARY MENU */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Jml Transaksi</p>
                          <p className="text-sm font-black text-slate-800 mt-0.5">{filteredMenu.length} Nota</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Total Qty</p>
                          <p className="text-sm font-black text-slate-800 mt-0.5">{sumQty} Item</p>
                        </div>
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                          <p className="text-[10px] font-black text-rose-500 uppercase">Total Admin MP</p>
                          <p className="text-sm font-black text-rose-600 mt-0.5">{formatRp(sumAdmin)}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                          <p className="text-[10px] font-black text-blue-500 uppercase">Total Transaksi</p>
                          <p className="text-sm font-black text-blue-600 mt-0.5">{formatRp(sumTotal)}</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                          <p className="text-[10px] font-black text-emerald-500 uppercase">Telah Dibayar</p>
                          <p className="text-sm font-black text-emerald-600 mt-0.5">{formatRp(sumDibayar)}</p>
                        </div>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                          <p className="text-[10px] font-black text-amber-500 uppercase">Kurang / Piutang</p>
                          <p className="text-sm font-black text-amber-600 mt-0.5">{formatRp(sumBelum)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })() : activeDetailTab === 'logstock' ? (() => {
                  const filteredLogStock = reportDetailData?.logStock.filter(l => logStockFilterRefJenis === 'semua' || l.ref_baru === logStockFilterRefJenis) || [];
                  const sumQtyIn = filteredLogStock.filter(l => l.boolean === 'in').reduce((acc, l) => acc + (l.qty || 0), 0);
                  const sumQtyOut = filteredLogStock.filter(l => l.boolean === 'out').reduce((acc, l) => acc + (l.qty || 0), 0);
                  const sumNilaiJual = filteredLogStock.reduce((acc, l) => acc + ((l.price_1 || 0) * (l.qty || 0)), 0);
                  const sumNilaiModal = filteredLogStock.reduce((acc, l) => acc + ((l.price_2 || 0) * (l.qty || 0)), 0);
                  const sumLaba = sumNilaiJual - sumNilaiModal;

                  return (
                    <div>
                      <div className="flex gap-2 mb-4">
                        <select
                          className="p-2 border border-slate-200 rounded-xl text-sm font-bold bg-white"
                          value={logStockFilterRefJenis}
                          onChange={(e) => setLogStockFilterRefJenis(e.target.value)}
                        >
                          <option value="semua">Semua Referensi (Nota)</option>
                          {[...new Set(reportDetailData?.logStock.map(l => l.ref_baru) || [])].map(r => (
                            <option key={String(r)} value={String(r)}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="overflow-x-auto overflow-y-auto max-h-[50vh] custom-scrollbar rounded-xl border border-slate-200 shadow-sm relative">
                        <table className="w-full text-xs border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr className="border-b border-slate-200">
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Waktu</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Operator</th>
                              <th className="p-3 text-center font-black text-slate-500 uppercase">In/Out</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">ID Item</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Nama Produk</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Qty</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Harga Satuan</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Subtotal Jual</th>
                              <th className="p-3 text-right font-black text-slate-500 uppercase">Subtotal Modal</th>
                              <th className="p-3 text-right font-black text-emerald-600 uppercase">Laba Kotor</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Ref Nota</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {reportDetailData === null ? (
                              <tr><td colSpan={12} className="p-4 text-center text-slate-400">Memuat data...</td></tr>
                            ) : filteredLogStock.length === 0 ? (
                              <tr><td colSpan={12} className="p-4 text-center text-slate-400">Tidak ada data log stock.</td></tr>
                            ) : (
                              filteredLogStock.map((l, idx) => {
                                const subJual = (l.price_1 || 0) * (l.qty || 0);
                                const subModal = (l.price_2 || 0) * (l.qty || 0);
                                const labaItem = subJual - subModal;
                                return (
                                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 text-slate-600 font-medium">
                                    <td className="p-3 font-mono text-[10px]">{new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="p-3 font-bold">{l.operator || '-'}</td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${l.boolean === 'in' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {l.boolean}
                                      </span>
                                    </td>
                                    <td className="p-3 font-mono text-[10px]">{l.item || '-'}</td>
                                    <td className="p-3 font-black text-slate-800 max-w-[200px] truncate" title={l.item_baru}>{l.item_baru}</td>
                                    <td className="p-3 text-right font-bold">{l.qty}</td>
                                    <td className="p-3 text-right">{formatRp(l.price_1)}</td>
                                    <td className="p-3 text-right font-bold">{formatRp(subJual)}</td>
                                    <td className="p-3 text-right text-rose-500">{formatRp(subModal)}</td>
                                    <td className="p-3 text-right font-black text-emerald-600">{formatRp(labaItem)}</td>
                                    <td className="p-3 font-mono text-[10px] text-blue-500">{l.ref_baru || '-'}</td>
                                    <td className="p-3 text-[10px] max-w-[150px] truncate" title={l.note}>{l.note || '-'}</td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* SUMMARY LOG STOCK */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Jml Pergerakan</p>
                          <p className="text-sm font-black text-slate-800 mt-0.5">{filteredLogStock.length} Baris</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                          <p className="text-[10px] font-black text-blue-500 uppercase">Total Qty In</p>
                          <p className="text-sm font-black text-blue-600 mt-0.5">{sumQtyIn} Item</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-200">
                          <p className="text-[10px] font-black text-orange-500 uppercase">Total Qty Out</p>
                          <p className="text-sm font-black text-orange-600 mt-0.5">{sumQtyOut} Item</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-black text-slate-500 uppercase">Estimasi Penjualan</p>
                          <p className="text-sm font-black text-slate-800 mt-0.5">{formatRp(sumNilaiJual)}</p>
                        </div>
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                          <p className="text-[10px] font-black text-rose-500 uppercase">Total Modal</p>
                          <p className="text-sm font-black text-rose-600 mt-0.5">{formatRp(sumNilaiModal)}</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                          <p className="text-[10px] font-black text-emerald-500 uppercase">Laba Kotor Est.</p>
                          <p className="text-sm font-black text-emerald-600 mt-0.5">{formatRp(sumLaba)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })() : (() => {
                  // Cashflow Tab
                  const filteredCashflow = reportDetailData?.cashflow.filter(c => {
                    let match = true;
                    if (cashflowFilterMutasi !== 'semua') match = match && c.mutasi === cashflowFilterMutasi;
                    if (cashflowFilterAccount !== 'semua') match = match && (c.acc1 === cashflowFilterAccount || c.acc2 === cashflowFilterAccount);
                    if (cashflowFilterJenis !== 'semua') match = match && c.jenis === cashflowFilterJenis;
                    return match;
                  }) || [];

                  const sumMasuk = filteredCashflow.filter(c => c.mutasi === 'in' || c.mutasi === 'Masuk').reduce((acc, c) => acc + (c.nominal || 0), 0);
                  const sumKeluar = filteredCashflow.filter(c => c.mutasi === 'out' || c.mutasi === 'Keluar').reduce((acc, c) => acc + (c.nominal || 0), 0);
                  const nett = sumMasuk - sumKeluar;

                  return (
                    <div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <select
                          className="p-2 border border-slate-200 rounded-xl text-sm font-bold bg-white"
                          value={cashflowFilterMutasi}
                          onChange={(e) => setCashflowFilterMutasi(e.target.value)}
                        >
                          <option value="semua">Semua Mutasi</option>
                          <option value="in">Masuk (In)</option>
                          <option value="out">Keluar (Out)</option>
                        </select>
                        <select
                          className="p-2 border border-slate-200 rounded-xl text-sm font-bold bg-white"
                          value={cashflowFilterAccount}
                          onChange={(e) => setCashflowFilterAccount(e.target.value)}
                        >
                          <option value="semua">Semua Akun</option>
                          {[...new Set([
                            ...(reportDetailData?.cashflow.map(c => c.acc1) || []),
                            ...(reportDetailData?.cashflow.map(c => c.acc2) || [])
                          ].filter(Boolean))].map(a => (
                            <option key={String(a)} value={String(a)}>{a}</option>
                          ))}
                        </select>
                        <select
                          className="p-2 border border-slate-200 rounded-xl text-sm font-bold bg-white"
                          value={cashflowFilterJenis}
                          onChange={(e) => setCashflowFilterJenis(e.target.value)}
                        >
                          <option value="semua">Semua Jenis Cashflow</option>
                          {[...new Set(reportDetailData?.cashflow.map(c => c.jenis) || [])].map(j => (
                            <option key={String(j)} value={String(j)}>{j}</option>
                          ))}
                        </select>
                      </div>
                      <div className="overflow-x-auto overflow-y-auto max-h-[50vh] custom-scrollbar rounded-xl border border-slate-200 shadow-sm relative">
                        <table className="w-full text-xs border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr className="border-b border-slate-200">
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Waktu</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Operator</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Pihak / Note</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Jenis</th>
                              <th className="p-3 text-center font-black text-slate-500 uppercase">Mutasi</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Akun Sumber</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Akun Tujuan</th>
                              <th className="p-3 text-right font-black text-slate-800 uppercase">Nominal</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Ref Nota</th>
                              <th className="p-3 text-left font-black text-slate-500 uppercase">Catatan Tambahan</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                          {reportDetailData === null ? (
                            <tr><td colSpan={10} className="p-4 text-center text-slate-400">Memuat data...</td></tr>
                          ) : filteredCashflow.length === 0 ? (
                            <tr><td colSpan={10} className="p-4 text-center text-slate-400">Tidak ada data cashflow.</td></tr>
                          ) : (
                            filteredCashflow.map((c, idx) => {
                              const isIn = c.mutasi === 'in' || c.mutasi === 'Masuk';
                              return (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 text-slate-600 font-medium">
                                  <td className="p-3 font-mono text-[10px]">{new Date(c.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="p-3 font-bold">{c.operator || '-'}</td>
                                  <td className="p-3 text-blue-600">{c.persontext || c.person || '-'}</td>
                                  <td className="p-3 font-black text-slate-700">{c.jenis}</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isIn ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                      {c.mutasi}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold">{c.acc1 || c.account_1 || '-'}</td>
                                  <td className="p-3 font-bold">{c.acc2 || c.account_2 || '-'}</td>
                                  <td className={`p-3 text-right font-black ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isIn ? '+' : '-'}{formatRp(c.nominal)}
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-blue-500">{c.ref_baru || '-'}</td>
                                  <td className="p-3 text-[10px] max-w-[150px] truncate" title={c.note}>{c.note || '-'}</td>
                                </tr>
                              )
                            })
                          )}
                          </tbody>
                        </table>
                      </div>

                      {/* SUMMARY CASHFLOW */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Total Jurnal Kas</p>
                          <p className="text-base font-black text-slate-800 mt-0.5">{filteredCashflow.length} Aktivitas</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                          <p className="text-[10px] font-black text-emerald-500 uppercase">Total Kas Masuk</p>
                          <p className="text-base font-black text-emerald-600 mt-0.5">+{formatRp(sumMasuk)}</p>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                          <p className="text-[10px] font-black text-rose-500 uppercase">Total Kas Keluar</p>
                          <p className="text-base font-black text-rose-600 mt-0.5">-{formatRp(sumKeluar)}</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${nett >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                          <p className={`text-[10px] font-black uppercase ${nett >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>Nett / Selisih Kas</p>
                          <p className={`text-base font-black mt-0.5 ${nett >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatRp(nett)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-slate-100 bg-white rounded-b-3xl shrink-0 flex justify-end">
                <button onClick={() => { setSelectedReport(null); setReportDetailData(null); }} className="px-6 py-3 bg-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-300">Tutup</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

}