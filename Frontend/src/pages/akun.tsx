import React, { useState, useEffect, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  User, Mail, Shield, Camera, Edit3, Lock, 
  Eye, EyeOff, ChevronLeft, ChevronRight, DollarSign, Calendar, FileText,
  Award, TrendingUp, AlertTriangle, Key, ShieldCheck
} from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  email: string;
  name: string;
  status: string;
  avatar: string;
  link_image: string;
  tokenkey: string;
  user_level: number;
}

interface Gaji {
  id: string;
  person: string;
  pokok: number;
  tunjangan: number;
  bonus_1: number;
  bonus_2: number;
  bonus_3: number;
  bonus_4: number;
  program: number;
  lembur: number;
  alfa: number;
  sakit: number;
  setengah_hari: number;
  telat: number;
  bpjs: number;
  bon_diambil: number;
  bon_dibayar: number;
  created_at: string;
  ref: string;
  note?: string;
  operator?: string;
  expand?: {
    ref?: {
      qty: number;
    }
  };
  qty?: number;
  total?: number;
}

export default function AkunPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [salaryList, setSalaryList] = useState<Gaji[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Privacy Toggle State (Hide / Show Nominals)
  const [hideNominal, setHideNominal] = useState(true);

  // Pagination Gaji
  const [totalGaji, setTotalGaji] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // States & Pagination Bon
  const [bonList, setBonList] = useState<any[]>([]);
  const [totalBon, setTotalBon] = useState(0);
  const [bonPage, setBonPage] = useState(1);
  const [bonTotalPages, setBonTotalPages] = useState(1);
  const perPage = 5;

  // Kalkulasi Skor Kredit Karyawan (diambil dari rasio pelunasan bon)
  const creditAnalysis = useMemo(() => {
    let totalBonDiambil = 0;
    let totalBonDibayar = 0;

    salaryList.forEach(g => {
      totalBonDiambil += (g.bon_diambil || 0);
      totalBonDibayar += (g.bon_dibayar || 0);
    });

    bonList.forEach(b => {
      if (b.id_lama === 'addbon' || (b.note && b.note.toLowerCase().includes('bon'))) {
        totalBonDiambil += (b.nominal || 0);
      }
    });

    if (totalBonDiambil === 0 && totalBon === 0) {
      return { rate: 100, status: 'SANGAT BAGUS', color: 'bg-emerald-500 text-white border-emerald-600', desc: 'Tidak Memiliki Penunggakan Bon (100% Bersih)' };
    }

    const effectiveTotalDiambil = totalBonDiambil || totalBon;
    const rate = effectiveTotalDiambil > 0 ? Math.round((totalBonDibayar / effectiveTotalDiambil) * 100) : 0;

    if (rate >= 15) {
      return { rate, status: 'BAGUS', color: 'bg-emerald-500 text-white border-emerald-600', desc: 'Pelunasan Cepat & Lancar (≥ 15% / bln)' };
    } else if (rate >= 10) {
      return { rate, status: 'SEDANG', color: 'bg-blue-500 text-white border-blue-600', desc: 'Pelunasan Cukup (10% - 14% / bln)' };
    } else if (rate >= 0) {
      return { rate, status: 'KURANG', color: 'bg-amber-500 text-white border-amber-600', desc: 'Pelunasan Lambat (< 10% / bln)' };
    } else {
      return { rate, status: 'JELEK POL', color: 'bg-rose-600 text-white border-rose-700 animate-pulse', desc: 'Penunggakan Bon Tinggi (< 0% / bln)' };
    }
  }, [salaryList, bonList, totalBon]);

  // Modal States
  const [modalType, setModalType] = useState<'editProfile' | 'verifyPassword' | 'salaryDetail' | null>(null);
  const [selectedGaji, setSelectedGaji] = useState<Gaji | null>(null);
  const [verifyPass, setVerifyPass] = useState('');
  
  const [formData, setFormData] = useState<Partial<UserData>>({});
  const [passwordData, setPasswordData] = useState({ oldPassword: '', password: '', passwordConfirm: '' });

  const [headerStyle, setHeaderStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const defaultGradient = 'linear-gradient(to right, rgb(37, 99, 235), rgb(79, 70, 229), rgb(147, 51, 234))';
    
    if (!userData?.link_image) {
      setHeaderStyle({ background: defaultGradient });
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);

      try {
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        
        const count = data.length / 4;
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        const color1 = `rgb(${r}, ${g}, ${b})`;
        const color2 = `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`;
        
        setHeaderStyle({ background: `linear-gradient(to right, ${color1}, ${color2})` });
      } catch (e) {
        setHeaderStyle({ background: defaultGradient });
      }
    };
    
    img.onerror = () => setHeaderStyle({ background: defaultGradient });
    img.src = userData.link_image;
  }, [userData?.link_image]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchGaji();
    fetchBon();
  }, [userData?.username, userData?.user_level, page, bonPage]);

  const fetchProfile = async () => {
      try {
        setLoading(true);
        const userId = pb.authStore.model?.id;
        if (userId) {
          const record = await pb.collection('user').getOne<UserData>(userId, { $autoCancel: false });
          setUserData(record);
          setFormData(record);
          
          if (record.user_level) localStorage.setItem('user_level', String(record.user_level));
          if (record.name) localStorage.setItem('user_name', record.name);
        }
      } catch (error) {
        console.error("Gagal load profil:", error);
      } finally {
        setLoading(false);
      }
    };

  const fetchGaji = async () => {
    try {
      const currentUsername = localStorage.getItem('user_username') || userData?.username || '';
      const userLevel = userData?.user_level ?? parseInt(localStorage.getItem('user_level') || '10');
      const isSuperUser = userLevel === 1 || userLevel === 2;

      // Jika level 1 atau 2, tampilkan semua data tanpa terkecuali (tanpa filter username)
      const filterClause = isSuperUser ? '' : (currentUsername ? `person = "${currentUsername}"` : '');

      const result = await pb.collection('gaji').getList<Gaji>(page, perPage, {
        ...(filterClause ? { filter: filterClause } : {}),
        sort: '-created_at',
        expand: 'ref',
        $autoCancel: false 
      });
      setSalaryList(result.items);
      setTotalPages(result.totalPages);

      const allGaji = await pb.collection('gaji').getFullList<Gaji>({
        ...(filterClause ? { filter: filterClause } : {}),
        expand: 'ref',
        $autoCancel: false
      });
      const total = allGaji.reduce((sum, g) => {
        const { grandTotal } = getSalaryDetails(g);
        return sum + grandTotal;
      }, 0);
      setTotalGaji(total);
    } catch (error) {
      console.error("Gagal load gaji:", error);
    }
  };

  const fetchBon = async () => {
    try {
      const currentUsername = localStorage.getItem('user_username') || userData?.username || '';
      const userLevel = userData?.user_level ?? parseInt(localStorage.getItem('user_level') || '10');
      const isSuperUser = userLevel === 1 || userLevel === 2;

      // Jika level 1 atau 2, tampilkan semua data bon tanpa terkecuali
      const baseBonFilter = '(id_lama = "addbon" || note ~ "bon")';
      const filterClause = isSuperUser 
        ? baseBonFilter 
        : (currentUsername ? `${baseBonFilter} && (person = "${currentUsername}" || persontext = "${currentUsername}")` : baseBonFilter);

      const result = await pb.collection('cashflow').getList(bonPage, perPage, {
        filter: filterClause,
        sort: '-created_at',
        $autoCancel: false 
      });
      setBonList(result.items);
      setBonTotalPages(result.totalPages);

      const allBon = await pb.collection('cashflow').getFullList({
        filter: filterClause,
        $autoCancel: false
      });
      const total = allBon.reduce((sum, b) => sum + (b.nominal || 0), 0);
      setTotalBon(total);
    } catch (error) {
      console.error("Gagal load bon:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    setIsProcessing(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        link_image: formData.link_image,
        tokenkey: formData.tokenkey,
        ...(passwordData.password ? {
           oldPassword: passwordData.oldPassword,
           password: passwordData.password,
           passwordConfirm: passwordData.passwordConfirm
        } : {})
      };

      await pb.collection('user').update(userData.id, payload);
      await fetchProfile(); 
      
      alert("Profil berhasil diperbarui!");
      setModalType(null);
      setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
    } catch (error: any) {
      console.error(error);
      alert("Gagal update: " + (error.message || "Periksa password lama Anda."));
    } finally {
      setIsProcessing(false);
    }
  };

  const checkSalaryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await pb.collection('user').authWithPassword(userData?.username || '', verifyPass);
      setHideNominal(false); // Membuka sensitivitas privasi nominal seluruh halaman
      if (selectedGaji) {
        setModalType('salaryDetail');
      } else {
        setModalType(null);
      }
      setVerifyPass('');
    } catch (error) {
      alert("Password salah! Akses ditolak.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSensitivity = () => {
    if (hideNominal) {
      // Memerlukan konfirmasi password untuk membuka sensitivitas nominal
      setSelectedGaji(null);
      setModalType('verifyPassword');
    } else {
      // Menyembunyikan kembali tanpa perlu password
      setHideNominal(true);
    }
  };

  const handleSelectSalaryItem = (item: Gaji) => {
    setSelectedGaji(item);
    if (hideNominal) {
      setModalType('verifyPassword');
    } else {
      setModalType('salaryDetail');
    }
  };

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };

  const formatNominalPrivasi = (nominal: number) => {
    if (hideNominal) return 'Rp •••••••••';
    return formatRupiah(nominal);
  };

  const getSalaryDetails = (gaji: Gaji) => {
    const qty = Number(gaji.qty) || gaji.expand?.ref?.qty || 1;
    const pokok = gaji.pokok || 0;
    const tunjangan = gaji.tunjangan || 0;

    const nilaiDasar = qty > 0 ? (pokok + tunjangan) / qty : 0;

    const t1 = {
      pokok: pokok,
      tunjangan: tunjangan,
      bonus_1: gaji.bonus_1 || 0,
      bonus_2: gaji.bonus_2 || 0,
      bonus_3: gaji.bonus_3 || 0,
      bonus_4: gaji.bonus_4 || 0,
      program: gaji.program || 0,
      lembur: gaji.lembur || 0,
    };
    const total1 = Object.values(t1).reduce((sum, val) => sum + val, 0);

    const t2 = {
      alfa: nilaiDasar * (gaji.alfa || 0),
      setengah_hari: (nilaiDasar / 2) * (gaji.setengah_hari || 0),
      sakit: (nilaiDasar * 0.9) * (gaji.sakit || 0),
      telat: (gaji.telat || 0) * 1000, 
    };
    const total2 = Object.values(t2).reduce((sum, val) => sum + val, 0);

    const t3 = {
      bpjs: gaji.bpjs || 0,
      bon_diambil: gaji.bon_diambil || 0,
      bon_dibayar: gaji.bon_dibayar || 0,
    };
    const total3 = Object.values(t3).reduce((sum, val) => sum + val, 0);

    const grandTotal = Number(gaji.total) || (total1 - total2 - total3);

    return { t1, total1, t2, total2, t3, total3, grandTotal };
  };

  if (loading) return <div className="flex h-full items-center justify-center font-bold text-slate-400 p-8">Memuat Profil...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4 sm:p-6 lg:p-8 pt-16 md:pt-8">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* HEADER BAR & PRIVACY TOGGLE */}
        <div className="flex justify-between items-center bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Akun Saya</h1>
            <p className="text-xs font-bold text-slate-400">Pengaturan profil, riwayat gaji, dan transaksi bon</p>
          </div>
          <button
            onClick={handleToggleSensitivity}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm border ${
              hideNominal
                ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Sembunyikan / Tampilkan Nominal Privasi"
          >
            {hideNominal ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">{hideNominal ? 'Sensitivitas: Tersembunyi' : 'Sensitivitas: Terlihat'}</span>
          </button>
        </div>

        {/* 1. SECTION PROFILE - Responsive */}
        <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative group transition-all duration-300 hover:shadow-2xl">
          <div 
            className="h-28 md:h-32 transition-all duration-1000 ease-in-out" 
            style={headerStyle}
          />
          <div className="px-4 sm:px-8 pb-6 sm:pb-8 flex flex-col items-center -mt-12 sm:-mt-16 text-center">
            <div className="relative">
              <img 
                src={userData?.link_image || 'https://via.placeholder.com/150'} 
                alt="Avatar" 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl object-cover border-4 border-white shadow-xl bg-white"
              />
              <div className="absolute bottom-0 right-0 p-1.5 sm:p-2 bg-blue-600 text-white rounded-xl border-2 border-white shadow-lg">
                <Camera size={14} className="sm:w-4 sm:h-4" />
              </div>
            </div>
            
            <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{userData?.name || userData?.username}</h2>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] sm:text-xs font-black uppercase rounded-lg border border-blue-100 flex items-center gap-1">
                <Shield size={12} /> {userData?.status || 'User'}
              </span>
              <span className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[10px] sm:text-xs font-black uppercase rounded-lg border border-slate-100 flex items-center gap-1">
                <User size={12} /> @{userData?.username}
              </span>
            </div>

            {/* HAL PENTING: EMAIL & STATUS JABATAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-5 sm:mt-6 px-2 sm:px-4">
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                <div className="p-2.5 bg-white rounded-xl shadow-xs text-blue-600 shrink-0"><Mail size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Terdaftar</p>
                  <p className="font-bold text-slate-800 text-sm sm:text-base truncate">{userData?.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                <div className="p-2.5 bg-white rounded-xl shadow-xs text-emerald-600 shrink-0"><ShieldCheck size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Jabatan</p>
                  <p className="font-bold text-slate-800 text-sm sm:text-base truncate">
                    {userData?.user_level === 1 ? 'Administrator' : userData?.user_level === 10 ? 'Mekanik Utama' : 'Karyawan / User'}
                  </p>
                </div>
              </div>
            </div>

            {/* TOMBOL AKSI: EDIT PROFIL & RESET PASSWORD */}
            <div className="flex flex-col sm:flex-row gap-3 w-full mt-6 px-2 sm:px-4">
              <button 
                onClick={() => setModalType('editProfile')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl font-black transition-all shadow-lg text-xs uppercase tracking-wider"
              >
                <Edit3 size={15} /> EDIT PROFIL
              </button>
              <button 
                onClick={() => {
                  setFormData(userData || {});
                  setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
                  setModalType('editProfile');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-black transition-all text-xs uppercase tracking-wider"
              >
                <Key size={15} /> RESET PASSWORD
              </button>
            </div>
          </div>
        </div>

        {/* 2. SECTION GAJI - RIWAYAT (Ditingkatkan setema dengan UI Bon) */}
        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-slate-100 p-4 sm:p-6 md:p-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign size={18} className="sm:w-5 sm:h-5" />
              </div>
              RIWAYAT GAJI KARYAWAN
            </h3>
          </div>

          {/* GAJI CONTAINER (1 HORIZONTAL TOP + 2 VERTICAL SUB-CARDS BELOW) */}
          <div className="mb-6 space-y-4">
            {/* 1. HORIZONTAL CARD UTAMA (Top Banner Gaji) */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl shadow-xl border border-emerald-500/20 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-400/30">
                    Ringkasan Penghasilan
                  </span>
                  <h4 className="text-xl sm:text-2xl font-black text-white mt-2">Total Akumulasi Gaji Diterima</h4>
                  <p className="text-xs text-emerald-200/80 font-medium mt-0.5">Akumulasi pendapatan bersih dari seluruh slip gaji yang telah tercatat</p>
                </div>
                <div className="text-left sm:text-right shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">Total Gaji Netto</p>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1">
                    {formatNominalPrivasi(totalGaji)}
                  </p>
                </div>
              </div>
            </div>

            {/* 2 & 3. DUA VERTICAL CARDS GAJI */}
            <div className="flex flex-col gap-4">
              {/* Sub-Card 1: Status Pembayaran Gaji */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider">Status Pembayaran Gaji</h5>
                      <p className="text-[10px] text-slate-400 font-medium">Periode & kelancaran penerimaan gaji</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                    {salaryList.length > 0 ? 'TERCATAT' : 'BELUM ADA'}
                  </span>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{salaryList.length}</span>
                    <span className="text-[10px] font-bold text-slate-500">Periode Slip Tercatat</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    📌 Rincian detail dapat dibuka via verifikasi password
                  </span>
                </div>
              </div>

              {/* Sub-Card 2: Privasi & Keamanan Slip Gaji */}
              <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50/60 rounded-2xl border border-emerald-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-2 border-b border-emerald-200/50 pb-3">
                  <div className="p-2 bg-white text-emerald-600 rounded-xl shadow-xs">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h5 className="font-black text-emerald-900 text-xs uppercase tracking-wider">Perhitungan Komponen Gaji</h5>
                    <p className="text-[10px] text-emerald-600/80 font-medium">Meliputi pendapatan dasar, bonus, tunjangan, dan potongan</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-xs font-bold text-emerald-950">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Pendapatan Utama:</span>
                    <span className="text-emerald-700 font-black">Gaji Pokok + Tunjangan + Lembur</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Pengurangan:</span>
                    <span className="text-rose-700 font-black">Potongan Absensi + Potongan Lain + Bon</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {salaryList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold text-sm">Belum ada riwayat gaji tercatat.</div>
            ) : (
              salaryList.map((item) => {
                const { grandTotal } = getSalaryDetails(item);
                const periode = new Date(item.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                const personName = userData?.name || userData?.username || 'Karyawan';

                return (
                  <div 
                    key={item.id}
                    onClick={() => handleSelectSalaryItem(item)}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-0">
                      <div className="p-2.5 sm:p-3 bg-white text-emerald-600 rounded-xl sm:rounded-2xl shadow-xs shrink-0">
                        <Calendar size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{personName}</p>
                        <p className="font-bold text-slate-800 text-sm">Gaji Periode {periode}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Diterima</p>
                        <p className="font-black text-emerald-600 text-base sm:text-lg">
                          {formatNominalPrivasi(grandTotal)}
                        </p>
                      </div>
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                        <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PAGINATION GAJI */}
          {salaryList.length > 0 && (
            <div className="flex justify-between items-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
                className="p-2 sm:p-3 bg-slate-100 rounded-xl disabled:opacity-30 transition hover:bg-slate-200"
              ><ChevronLeft size={18} className="sm:w-5 sm:h-5" /></button>
              <span className="text-xs sm:text-sm font-black text-slate-400 uppercase">Hal {page} / {totalPages}</span>
              <button 
                disabled={page >= totalPages} 
                onClick={() => setPage(p => p + 1)}
                className="p-2 sm:p-3 bg-slate-100 rounded-xl disabled:opacity-30 transition hover:bg-slate-200"
              ><ChevronRight size={18} className="sm:w-5 sm:h-5" /></button>
            </div>
          )}
        </div>

        {/* 3. SECTION BON - RIWAYAT BON KARYAWAN */}
        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-slate-100 p-4 sm:p-6 md:p-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <FileText size={18} className="sm:w-5 sm:h-5" />
              </div>
              RIWAYAT BON KARYAWAN
            </h3>
          </div>

          {/* TOTAL BON & SKOR KREDIT CONTAINER (1 HORIZONTAL TOP + 2 VERTICAL SUB-CARDS BELOW) */}
          <div className="mb-6 space-y-4">
            {/* 1. HORIZONTAL CARD UTAMA (Top Banner) */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-xl border border-purple-500/20 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-purple-400/30">
                    Ringkasan Pinjaman
                  </span>
                  <h4 className="text-xl sm:text-2xl font-black text-white mt-2">Total Akumulasi Bon Karyawan</h4>
                  <p className="text-xs text-purple-200/80 font-medium mt-0.5">Seluruh nominal pinjaman bon yang telah dicatat dan dalam proses pelunasan</p>
                </div>
                <div className="text-left sm:text-right shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest">Total Akumulasi Bon</p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                    {formatNominalPrivasi(totalBon)}
                  </p>
                </div>
              </div>
            </div>

            {/* 2 & 3. DUA VERTICAL CARDS (Sub-Cards Di Bawahnya) */}
            <div className="flex flex-col gap-4">
              {/* Vertical Card 1: Analisa Skor Kredit & Status */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <Award size={16} />
                    </div>
                    <div>
                      <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider">Skor Kredit & Kelancaran</h5>
                      <p className="text-[10px] text-slate-400 font-medium">Kategori reputasi pembayaran pinjaman</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-xs ${creditAnalysis.color}`}>
                    {creditAnalysis.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{creditAnalysis.rate}%</span>
                    <span className="text-[10px] font-bold text-slate-500">Pelunasan / Bln</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    📌 {creditAnalysis.desc}
                  </span>
                </div>
              </div>

              {/* Vertical Card 2: Indikator & Catatan Pengajuan Bon */}
              <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50/60 rounded-2xl border border-purple-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-2 border-b border-purple-200/50 pb-3">
                  <div className="p-2 bg-white text-purple-600 rounded-xl shadow-xs">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h5 className="font-black text-purple-900 text-xs uppercase tracking-wider">Ketentuan Pengajuan Bon</h5>
                    <p className="text-[10px] text-purple-600/80 font-medium">Standar kelayakan pinjaman karyawan</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-xs font-bold text-purple-950">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">≥ 15% / Bulan:</span>
                    <span className="text-emerald-700 font-black bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">BAGUS (Lancar)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">10% - 14% / Bulan:</span>
                    <span className="text-blue-700 font-black bg-blue-100 px-2 py-0.5 rounded border border-blue-200">SEDANG (Cukup)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">&lt; 10% / Bulan:</span>
                    <span className="text-amber-700 font-black bg-amber-100 px-2 py-0.5 rounded border border-amber-200">KURANG (Lambat)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">&lt; 0% / Menunggak:</span>
                    <span className="text-rose-700 font-black bg-rose-100 px-2 py-0.5 rounded border border-rose-200">JELEK POL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {bonList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold text-sm">Belum ada riwayat bon tercatat.</div>
            ) : (
              bonList.map((item) => {
                const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

                return (
                  <div 
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-purple-200 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-0">
                      <div className="p-2.5 sm:p-3 bg-white text-purple-600 rounded-xl sm:rounded-2xl shadow-xs shrink-0">
                        <FileText size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dateStr}</p>
                        <p className="font-bold text-slate-700 text-sm">{item.note || 'Bon Karyawan'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nominal Bon</p>
                        <p className="font-black text-purple-600 text-base sm:text-lg">
                          {formatNominalPrivasi(item.nominal || 0)}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-black uppercase rounded-lg border border-purple-200 shrink-0">
                        {item.operator ? `Opr: ${item.operator}` : 'Bon'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PAGINATION BON */}
          {bonList.length > 0 && (
            <div className="flex justify-between items-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100">
              <button 
                disabled={bonPage === 1} 
                onClick={() => setBonPage(p => p - 1)}
                className="p-2 sm:p-3 bg-slate-100 rounded-xl disabled:opacity-30 transition hover:bg-slate-200"
              ><ChevronLeft size={18} className="sm:w-5 sm:h-5" /></button>
              <span className="text-xs sm:text-sm font-black text-slate-400 uppercase">Hal {bonPage} / {bonTotalPages}</span>
              <button 
                disabled={bonPage >= bonTotalPages} 
                onClick={() => setBonPage(p => p + 1)}
                className="p-2 sm:p-3 bg-slate-100 rounded-xl disabled:opacity-30 transition hover:bg-slate-200"
              ><ChevronRight size={18} className="sm:w-5 sm:h-5" /></button>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL: EDIT PROFILE & PASSWORD (Responsive) --- */}
      <Modal isOpen={modalType === 'editProfile'} onClose={() => setModalType(null)} title="Update Profil">
        <form onSubmit={handleUpdateProfile} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name</label>
              <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username</label>
              <input disabled type="text" value={formData.username || ''} className="w-full mt-1 p-3 bg-slate-200 text-slate-500 rounded-2xl outline-none border border-transparent font-bold cursor-not-allowed" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Status</label>
              <input disabled type="text" value={formData.status || ''} className="w-full mt-1 p-3 bg-slate-200 text-slate-500 rounded-2xl outline-none border border-transparent font-bold cursor-not-allowed" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
              <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Image Link (Avatar URL)</label>
              <input type="text" value={formData.link_image || ''} onChange={e => setFormData({...formData, link_image: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Token Key</label>
              <input type="text" value={formData.tokenkey || ''} onChange={e => setFormData({...formData, tokenkey: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lock size={14} className="text-rose-500" /> Ganti Password (Opsional)
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password Lama</label>
                <input 
                  type="password" 
                  placeholder="Kosongkan jika tidak diganti"
                  value={passwordData.oldPassword} 
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})} 
                  className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password Baru</label>
                  <input 
                    type="password" 
                    value={passwordData.password} 
                    onChange={e => setPasswordData({...passwordData, password: e.target.value})} 
                    className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ulangi Password Baru</label>
                  <input 
                    type="password" 
                    value={passwordData.passwordConfirm} 
                    onChange={e => setPasswordData({...passwordData, passwordConfirm: e.target.value})} 
                    className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                  />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={isProcessing} className="w-full py-3.5 sm:py-4 bg-slate-800 text-white rounded-2xl font-black shadow-xl mt-4">
            {isProcessing ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
          </button>
        </form>
      </Modal>

      {/* --- MODAL: VERIFIKASI PASSWORD PRIVASI --- */}
      <Modal isOpen={modalType === 'verifyPassword'} onClose={() => setModalType(null)} title="Otentikasi Keamanan & Privasi">
        <form onSubmit={checkSalaryPassword} className="text-center space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
            <Lock size={28} className="sm:w-8 sm:h-8" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 uppercase tracking-tight">Verifikasi Akses Privasi</h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Masukkan password akun Anda untuk membuka tampilan nominal gaji & bon.</p>
          </div>
          <input 
            type="password" 
            required
            value={verifyPass}
            onChange={e => setVerifyPass(e.target.value)}
            placeholder="Password Login Anda"
            className="w-full p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg sm:text-xl outline-none focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-800"
          />
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalType(null)} className="flex-1 py-3.5 sm:py-4 bg-slate-100 rounded-2xl font-black text-slate-500 text-xs uppercase tracking-wider hover:bg-slate-200">BATAL</button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg">BUKA PRIVASI</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL: DETAIL GAJI (REDESIGNED PREMIUM UI WITH ORIGINAL FIELD LOGIC) --- */}
      <Modal isOpen={modalType === 'salaryDetail'} onClose={() => setModalType(null)} title="Slip Rincian Gaji">
        {selectedGaji && (() => {
          const { t1, total1, t2, total2, t3, total3, grandTotal } = getSalaryDetails(selectedGaji);
          const periodeDate = new Date(selectedGaji.created_at);
          const periodeString = periodeDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

          return (
            <div className="space-y-5 max-h-[82vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Top Banner Netto Header */}
              <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 p-6 sm:p-7 rounded-3xl text-center text-white shadow-xl relative overflow-hidden border border-emerald-500/30">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">Gaji Netto Diterima</p>
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-300">
                  {formatRupiah(grandTotal)}
                </h3>
                <div className="mt-3 pt-3 border-t border-emerald-800/80 flex items-center justify-center gap-2 text-xs font-bold text-emerald-200">
                  <span>ID: <code className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50 text-[11px]">{selectedGaji.id}</code></span>
                  <span>•</span>
                  <span>Periode: <strong className="text-white uppercase">{periodeString}</strong></span>
                </div>
              </div>

              {/* Info Penerima */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penerima Slip Gaji</p>
                  <p className="font-extrabold text-slate-800 text-sm sm:text-base">
                    {selectedGaji.person}
                    {selectedGaji.note && <span className="text-slate-400 text-xs font-normal ml-1">— {selectedGaji.note}</span>}
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase rounded-xl border border-emerald-200">
                  Resmi / Valid
                </span>
              </div>

              {/* FIELD NOTE (CATATAN SLIP GAJI) */}
              {(selectedGaji.note || selectedGaji.ref) && (
                <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText size={14} /> Catatan Slip Gaji (Note)
                  </p>
                  <p className="text-xs font-bold text-amber-950 mt-1">{selectedGaji.note || selectedGaji.ref}</p>
                </div>
              )}

              {/* Rincian Komponen Breakdown */}
              <div className="space-y-4">
                {/* 1. PENDAPATAN */}
                <div className="border border-emerald-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white flex justify-between items-center">
                    <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={16} /> 1. Pendapatan
                    </span>
                    <span className="font-black text-sm sm:text-base text-emerald-100">{formatRupiah(total1)}</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-100 text-xs">
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Gaji Pokok</span><span className="font-black text-slate-800">{formatRupiah(t1.pokok)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Tunjangan</span><span className="font-black text-slate-800">{formatRupiah(t1.tunjangan)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Bonus 1</span><span className="font-black text-slate-800">{formatRupiah(t1.bonus_1)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Bonus 2</span><span className="font-black text-slate-800">{formatRupiah(t1.bonus_2)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Bonus 3</span><span className="font-black text-slate-800">{formatRupiah(t1.bonus_3)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Bonus 4</span><span className="font-black text-slate-800">{formatRupiah(t1.bonus_4)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Program</span><span className="font-black text-slate-800">{formatRupiah(t1.program)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Lembur</span><span className="font-black text-slate-800">{formatRupiah(t1.lembur)}</span></div>
                  </div>
                </div>

                {/* 2. POTONGAN KEHADIRAN */}
                <div className="border border-amber-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white flex justify-between items-center">
                    <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={16} /> 2. Potongan Kehadiran
                    </span>
                    <span className="font-black text-sm sm:text-base text-amber-100">-{formatRupiah(total2)}</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-100 text-xs">
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Alfa ({selectedGaji.alfa || 0}x)</span><span className="font-black text-amber-600">{formatRupiah(t2.alfa)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Setengah Hari ({selectedGaji.setengah_hari || 0}x)</span><span className="font-black text-amber-600">{formatRupiah(t2.setengah_hari)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Sakit ({selectedGaji.sakit || 0}x)</span><span className="font-black text-amber-600">{formatRupiah(t2.sakit)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Telat ({selectedGaji.telat || 0}x)</span><span className="font-black text-amber-600">{formatRupiah(t2.telat)}</span></div>
                  </div>
                </div>

                {/* 3. POTONGAN LAINNYA & BON */}
                <div className="border border-rose-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3 text-white flex justify-between items-center">
                    <span className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={16} /> 3. Potongan Lain & Bon
                    </span>
                    <span className="font-black text-sm sm:text-base text-rose-100">-{formatRupiah(total3)}</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-100 text-xs">
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">BPJS</span><span className="font-black text-rose-600">{formatRupiah(t3.bpjs)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Bon Diambil</span><span className="font-black text-rose-600">{formatRupiah(t3.bon_diambil)}</span></div>
                    <div className="flex justify-between p-3"><span className="text-slate-600 font-semibold">Bon Dibayar</span><span className="font-black text-rose-600">{formatRupiah(t3.bon_dibayar)}</span></div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setModalType(null)} 
                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black transition-all shadow-lg text-xs uppercase tracking-wider mt-2"
              >
                TUTUP RINCIAN SLIP GAJI
              </button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}