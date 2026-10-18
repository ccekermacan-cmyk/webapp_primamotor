import PocketBase, { BaseAuthStore, ClientResponseError, type RecordModel } from 'pocketbase';
import { useNavigate } from 'react-router-dom';
import { accountHistoryFilters, salaryDetails as getSalaryDetails, loanSummary, passwordChangeError } from '../lib/account';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { User, Mail, Shield, Camera, Edit3, Lock, Eye, EyeOff, ChevronLeft, ChevronRight, DollarSign, Calendar, FileText, Award, Key, ShieldCheck } from 'lucide-react';

interface UserData extends RecordModel {
  id: string;
  username: string;
  email: string;
  name: string;
  status: string;
  avatar: string;
  link_image: string;
  level: number;
  number: number;
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
    ref_baru?: {
      qty: number;
    }
  };
  qty?: number;
  total?: number;
}

export default function AkunPage() {
  const navigate = useNavigate();
  const submitLockRef = useRef(false);
  const historyRequestRef = useRef(0);
  const [profileError, setProfileError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [allSalary, setAllSalary] = useState<Gaji[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Privacy Toggle State (Hide / Show Nominals)
  const [hideNominal, setHideNominal] = useState(true);

  // Pagination Gaji
  const [page, setPage] = useState(1);

  // States & Pagination Bon
  const [allBon, setAllBon] = useState<{id: string; nominal: number; jenis: string; note?: string; operator?: string; created_at: string}[]>([]);
  const [bonPage, setBonPage] = useState(1);
  const perPage = 5;

  const salaryList = allSalary.slice((page - 1) * perPage, page * perPage);
  const bonList = allBon.slice((bonPage - 1) * perPage, bonPage * perPage);
  const totalPages = Math.max(1, Math.ceil(allSalary.length / perPage));
  const bonTotalPages = Math.max(1, Math.ceil(allBon.length / perPage));
  const totalGaji = useMemo(() => allSalary.reduce((sum, row) => sum + getSalaryDetails(row).grandTotal, 0), [allSalary]);
  const loanTotals = useMemo(() => loanSummary(allBon, Number(userData?.number || 0)), [allBon, userData?.number]);
  const totalBon = loanTotals.balance;

  // Modal States
  const [modalType, setModalType] = useState<'editProfile' | 'verifyPassword' | 'salaryDetail' | 'changeEmail' | null>(null);
  const [selectedGaji, setSelectedGaji] = useState<Gaji | null>(null);
  const [verifyPass, setVerifyPass] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
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
    return () => { img.onload = null; img.onerror = null; };
  }, [userData?.link_image]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const relock = () => {
      if (document.hidden) {
        setHideNominal(true);
        setVerifyPass('');
        setModalType(current => current === 'salaryDetail' || current === 'verifyPassword' ? null : current);
      }
    };
    document.addEventListener('visibilitychange', relock);
    return () => document.removeEventListener('visibilitychange', relock);
  }, []);

  useEffect(() => {
    if (userData?.id && userData.username) fetchHistory(userData);
    return () => { historyRequestRef.current++; };
  }, [userData?.id, userData?.username, userData?.level]);

  const fetchProfile = async () => {
      try {
        setLoading(true);
        setProfileError('');
        const userId = pb.authStore.model?.id;
        if (!userId) throw new Error('Sesi berakhir. Silakan masuk kembali.');
        if (userId) {
          const record = await pb.collection('user').getOne<UserData>(userId, { $autoCancel: false });
          setUserData(record);
          setFormData(record);
          
          pb.authStore.save(pb.authStore.token, record);
          if (record.level) localStorage.setItem('user_level', String(record.level));
          if (record.name) localStorage.setItem('user_name', record.name);
        }
      } catch (error) {
        console.error("Gagal load profil:", error);
        setProfileError("Profil belum dapat dimuat. Periksa koneksi dan coba kembali.");
      } finally {
        setLoading(false);
      }
    };

  const fetchHistory = async (profile: UserData) => {
    const requestId = ++historyRequestRef.current;
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const filters = accountHistoryFilters(profile);
      const [salaries, loans] = await Promise.all([
        pb.collection('gaji').getFullList<Gaji>({filter: filters.salary, sort: '-created_at,-id', expand: 'ref_baru', $autoCancel: false}),
        pb.collection('bon').getFullList<{id: string; nominal: number; jenis: string; note?: string; operator?: string; created_at: string}>({filter: filters.loans, sort: '-created_at,-id', $autoCancel: false}),
      ]);
      if (requestId !== historyRequestRef.current) return;
      setAllSalary(salaries);
      setAllBon(loans);
      setPage(1);
      setBonPage(1);
    } catch (error) {
      if (requestId !== historyRequestRef.current) return;
      console.error('Gagal memuat riwayat akun:', error);
      setAllSalary([]);
      setAllBon([]);
      setHistoryError('Riwayat gaji dan bon belum dapat dimuat.');
    } finally {
      if (requestId === historyRequestRef.current) setLoadingHistory(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || submitLockRef.current) return;
    const passwordError = passwordChangeError(passwordData);
    if (passwordError) { alert(passwordError); return; }
    if (!formData.name?.trim()) { alert('Nama wajib diisi.'); return; }
    submitLockRef.current = true;
    setIsProcessing(true);
    try {
      const payload = {
        name: formData.name?.trim(),
        ...(passwordData.password ? {oldPassword: passwordData.oldPassword} : {}),
        link_image: formData.link_image,
        ...(passwordData.password ? {
           password: passwordData.password,
           passwordConfirm: passwordData.passwordConfirm
        } : {})
      };

      const updated = await pb.collection('user').update<UserData>(userData.id, payload);
      setModalType(null);
      setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
      setVerifyPass('');
      setHideNominal(true);
      if (passwordData.password) {
        try {
          await pb.collection('user').authWithPassword(userData.username, passwordData.password);
        } catch {
          pb.authStore.clear();
          alert('Perubahan profil berhasil disimpan. Silakan masuk kembali.');
          navigate('/login', {replace: true});
          return;
        }
      } else {
        pb.authStore.save(pb.authStore.token, updated);
      }
      setUserData(updated);
      setFormData(updated);
      try { localStorage.setItem('user_name', updated.name || updated.username); } catch { /* Profile is already committed; cache failure must not report a failed save. */ }
      await fetchHistory(updated);

      alert("Profil berhasil diperbarui!");
      setModalType(null);
      setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
    } catch (error: any) {
      alert("Gagal update: " + (error.message || "Periksa password lama Anda."));
    } finally {
      submitLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const requestEmailUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userData || submitLockRef.current) return;
    if (!newEmail.trim() || newEmail.trim().toLowerCase() === userData.email?.toLowerCase()) {
      alert('Masukkan alamat email baru yang berbeda.');
      return;
    }
    submitLockRef.current = true;
    setIsProcessing(true);
    try {
      await pb.collection('user').requestEmailChange(newEmail.trim());
      setNewEmail('');
      setModalType(null);
      alert('Tautan konfirmasi dikirim ke email baru. Email akun berubah setelah tautan dikonfirmasi dengan password Anda.');
    } catch {
      alert('Permintaan perubahan email belum berhasil. Periksa koneksi atau hubungi administrator untuk memeriksa layanan email.');
    } finally {
      submitLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const checkSalaryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || submitLockRef.current) return;
    submitLockRef.current = true;
    setIsProcessing(true);
    try {
      const verifier = new PocketBase(pb.baseURL, new BaseAuthStore());
      await verifier.collection('user').authWithPassword(userData.username, verifyPass);
      if (document.hidden) return;
      setHideNominal(false);
      if (selectedGaji) {
        setModalType('salaryDetail');
      } else {
        setModalType(null);
      }
      setVerifyPass('');
    } catch (error) {
      alert(error instanceof ClientResponseError && [400, 401].includes(error.status) ? 'Password salah! Akses ditolak.' : 'Verifikasi belum berhasil. Periksa koneksi dan coba kembali.');
    } finally {
      submitLockRef.current = false;
      setVerifyPass('');
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
    if (loadingHistory) return 'Memuat...';
    if (historyError) return 'Tidak tersedia';
    if (hideNominal) return 'Rp •••••••••';
    return formatRupiah(nominal);
  };

  if (loading) return <div className="flex h-full items-center justify-center font-bold text-slate-400 p-8">Memuat Profil...</div>;

  if (!userData || profileError) return <div className="p-8 text-center space-y-4"><p role="alert">{profileError || 'Sesi tidak tersedia.'}</p><button onClick={fetchProfile} className="px-4 py-2 bg-slate-900 text-white rounded-xl">Coba lagi</button></div>;

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

        {loadingHistory && <p role="status" className="p-3 text-slate-500">Memuat riwayat gaji dan bon...</p>}
        {historyError && <div role="alert" className="p-4 bg-amber-50 rounded-xl">{historyError} <button onClick={() => fetchHistory(userData)} className="font-bold underline">Coba lagi</button></div>}
        {/* 1. SECTION PROFILE - Responsive */}
        <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative group transition-all duration-300 hover:shadow-2xl">
          <div 
            className="h-28 md:h-32 transition-all duration-1000 ease-in-out" 
            style={headerStyle}
          />
          <div className="px-4 sm:px-8 pb-6 sm:pb-8 flex flex-col items-center -mt-12 sm:-mt-16 text-center">
            <div className="relative">
              <img 
                src={userData?.link_image || (userData?.avatar ? pb.files.getURL(userData, userData.avatar) : '/favicon.svg')}
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
                    {userData?.level === 1 ? 'Administrator' : userData?.level === 10 ? 'Mekanik Utama' : 'Karyawan / User'}
                  </p>
                </div>
              </div>
            </div>

            {/* TOMBOL AKSI: EDIT PROFIL & RESET PASSWORD */}
            <div className="flex flex-col sm:flex-row gap-3 w-full mt-6 px-2 sm:px-4">
              <button 
                onClick={() => { setFormData(userData || {}); setPasswordData({oldPassword: '', password: '', passwordConfirm: ''}); setModalType('editProfile'); }}
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
                  <h4 className="text-xl sm:text-2xl font-black text-white mt-2">Total Akumulasi Gaji Netto{userData.level === 1 ? ' Seluruh Karyawan' : ''}</h4>
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
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{allSalary.length}</span>
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
                const personName = item.person === userData?.username ? userData.name || item.person : item.person || 'Karyawan tidak tercatat';

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
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gaji Netto</p>
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

          {/* Ringkasan saldo dan seluruh mutasi bon */}
          <div className="mb-6 space-y-4">
            {/* 1. HORIZONTAL CARD UTAMA (Top Banner) */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-xl border border-purple-500/20 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-purple-400/30">
                    Ringkasan Pinjaman
                  </span>
                  <h4 className="text-xl sm:text-2xl font-black text-white mt-2">Sisa Bon Karyawan</h4>
                  <p className="text-xs text-purple-200/80 font-medium mt-0.5">Saldo bon saat ini sesuai catatan akun karyawan</p>
                </div>
                <div className="text-left sm:text-right shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest">Sisa Bon</p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                    {formatNominalPrivasi(totalBon)}
                  </p>
                </div>
              </div>
            </div>

            {/* 2 & 3. DUA VERTICAL CARDS (Sub-Cards Di Bawahnya) */}
            <div className="flex flex-col gap-4">
              {/* Rasio pelunasan dari seluruh riwayat bon */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <Award size={16} />
                    </div>
                    <div>
                      <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider">Ringkasan Pelunasan</h5>
                      <p className="text-[10px] text-slate-400 font-medium">Akumulasi dari seluruh riwayat bon, termasuk potongan gaji</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-xs ${totalBon > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {hideNominal ? 'Tersembunyi' : totalBon > 0 ? 'Ada Saldo Bon' : totalBon < 0 ? 'Saldo Kredit' : 'Saldo Nol'}
                  </span>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{hideNominal ? '•••' : loanTotals.rate === null ? '—' : `${loanTotals.rate}%`}</span>
                    <span className="text-[10px] font-bold text-slate-500">Pelunasan Tercatat</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    Rasio total pembayaran terhadap total pinjaman yang tercatat
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm p-5 bg-purple-50 rounded-2xl border border-purple-100">
                <div><p className="text-xs text-slate-500">Total pinjaman tercatat</p><strong>{formatNominalPrivasi(loanTotals.borrowed)}</strong></div>
                <div><p className="text-xs text-slate-500">Total pembayaran tercatat</p><strong>{formatNominalPrivasi(loanTotals.repaid)}</strong></div>
                <p className="sm:col-span-2 text-xs text-slate-500">Saldo awal atau koreksi dapat menyebabkan sisa bon berbeda dari selisih riwayat.</p>
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
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.jenis === 'in' ? 'Pembayaran Bon' : 'Pinjaman Bon'}</p>
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
      <Modal isOpen={modalType === 'editProfile'} onClose={() => { if (!isProcessing) { setModalType(null); setPasswordData({oldPassword: '', password: '', passwordConfirm: ''}); } }} title="Update Profil">
        <form onSubmit={handleUpdateProfile} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name</label>
              <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
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
              <input disabled type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
            </div>
            <button type="button" disabled={isProcessing} onClick={() => { setNewEmail(''); setPasswordData({oldPassword: '', password: '', passwordConfirm: ''}); setModalType('changeEmail'); }} className="sm:col-span-2 text-left text-blue-600 font-bold text-xs underline">Ubah email melalui tautan konfirmasi</button>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Image Link (Avatar URL)</label>
              <input type="url" value={formData.link_image || ''} onChange={e => setFormData({...formData, link_image: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-blue-500 font-bold text-slate-700" />
            </div>

          </div>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lock size={14} className="text-rose-500" /> Ganti Password (Opsional)
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password Saat Ini</label>
                <input 
                  type="password" autoComplete="current-password"
                  placeholder="Wajib jika mengubah password"
                  value={passwordData.oldPassword} 
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})} 
                  className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password Baru</label>
                  <input 
                    type="password" autoComplete="new-password" minLength={8}
                    value={passwordData.password} 
                    onChange={e => setPasswordData({...passwordData, password: e.target.value})} 
                    className="w-full mt-1 p-3 bg-slate-50 rounded-2xl outline-none border focus:border-rose-500 font-bold text-slate-700" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ulangi Password Baru</label>
                  <input 
                    type="password" autoComplete="new-password" minLength={8}
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

      <Modal isOpen={modalType === 'changeEmail'} onClose={() => { if (!isProcessing) { setModalType(null); setNewEmail(''); } }} title="Ubah Email">
        <form onSubmit={requestEmailUpdate} className="space-y-4">
          <p className="text-sm text-slate-600">Tautan konfirmasi dikirim ke email baru. Buka tautan dan masukkan password akun untuk menyelesaikan perubahan.</p>
          <label className="block text-xs font-bold">Email baru<input type="email" required autoComplete="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="block w-full mt-2 p-3 rounded-xl border" /></label>
          <button type="submit" disabled={isProcessing} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50">{isProcessing ? 'Mengirim...' : 'Kirim Tautan Konfirmasi'}</button>
        </form>
      </Modal>

      {/* --- MODAL: VERIFIKASI PASSWORD PRIVASI --- */}
      <Modal isOpen={modalType === 'verifyPassword'} onClose={() => { if (!isProcessing) { setModalType(null); setVerifyPass(''); } }} title="Otentikasi Keamanan & Privasi">
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
            <button type="button" disabled={isProcessing} onClick={() => { setModalType(null); setVerifyPass(''); setPasswordData({oldPassword: '', password: '', passwordConfirm: ''}); }} className="flex-1 py-3.5 sm:py-4 bg-slate-100 rounded-2xl font-black text-slate-500 text-xs uppercase tracking-wider hover:bg-slate-200">BATAL</button>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">Gaji Netto</p>
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