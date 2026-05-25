import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { 
  User, Mail, Shield, Camera, Edit3, Lock, 
  Eye, ChevronLeft, ChevronRight, DollarSign, Calendar,
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
  expand?: {
    ref?: {
      qty: number;
    }
  };
}

export default function AkunPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [salaryList, setSalaryList] = useState<Gaji[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination Gaji
  const [totalGaji, setTotalGaji] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 5;

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
    if (userData?.username) fetchGaji();
  }, [userData?.username, page]);

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
      // Ambil username dari localStorage (lebih langsung)
      const currentUsername = localStorage.getItem('user_username') || userData?.username || '';
      if (!currentUsername) return;

      const result = await pb.collection('gaji').getList<Gaji>(page, perPage, {
        filter: `person = "${currentUsername}"`,
        sort: '-created_at',
        expand: 'ref',
        $autoCancel: false 
      });
      setSalaryList(result.items);
      setTotalPages(result.totalPages);

      // Hitung total gaji bersih (akumulasi semua halaman? hanya untuk halaman saat ini atau semua? 
      // Di sini kita hitung dari seluruh data yang ada (panggil getFullList untuk akumulasi)
      const allGaji = await pb.collection('gaji').getFullList<Gaji>({
        filter: `person = "${currentUsername}"`,
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
      setModalType('salaryDetail');
      setVerifyPass('');
    } catch (error) {
      alert("Password salah! Akses ditolak.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };

  const getSalaryDetails = (gaji: Gaji) => {
    const qty = gaji.expand?.ref?.qty || 0;
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

    const grandTotal = total1 - total2 - total3;

    return { t1, total1, t2, total2, t3, total3, grandTotal };
  };

  if (loading) return <div className="flex h-full items-center justify-center font-bold text-slate-400 p-8">Memuat Profil...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-5 sm:mt-6 px-2 sm:px-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                <div className="p-2 bg-white rounded-xl shadow-sm text-blue-500 shrink-0"><Mail size={18} className="sm:w-5 sm:h-5" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Email Address</p>
                  <p className="font-bold text-slate-700 text-sm sm:text-base truncate">{userData?.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-500 shrink-0"><Lock size={18} className="sm:w-5 sm:h-5" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Token Key</p>
                  <p className="font-bold text-slate-700 text-sm sm:text-base truncate">{userData?.tokenkey || 'Not Set'}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setModalType('editProfile')}
              className="mt-6 sm:mt-8 flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-slate-800 text-white rounded-2xl font-black hover:bg-slate-900 transition-all shadow-xl shadow-slate-200 text-sm"
            >
              <Edit3 size={16} className="sm:w-[18px] sm:h-[18px]" /> EDIT PROFIL
            </button>
          </div>
        </div>

        {/* 2. SECTION GAJI - RIWAYAT (Responsive list) */}
        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-slate-100 p-4 sm:p-6 md:p-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={18} className="sm:w-5 sm:h-5" /></div>
              RIWAYAT GAJI
            </h3>
          </div>

          {totalGaji > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Seluruh Gaji Diterima</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 blur-sm">
                {formatRupiah(totalGaji)}
              </p>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Akumulasi dari semua periode gaji yang telah tercatat</p>
          </div>
        )}

          <div className="space-y-3">
            {salaryList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold text-sm">Belum ada riwayat gaji tercatat.</div>
            ) : (
              salaryList.map((item) => {
                const { grandTotal } = getSalaryDetails(item);
                const periode = new Date(item.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

                return (
                  <div 
                    key={item.id}
                    onClick={() => { setSelectedGaji(item); setModalType('verifyPassword'); }}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-emerald-200 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-0">
                      <div className="p-2 sm:p-3 bg-white text-emerald-600 rounded-xl sm:rounded-2xl shadow-sm shrink-0"><Calendar size={18} className="sm:w-5 sm:h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{periode}</p>
                        <p className="font-bold text-slate-700 text-sm">Slip Gaji Bulanan</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Diterima</p>
                        <p className="font-black text-emerald-600 text-base sm:text-lg">******</p>
                      </div>
                      <div className="p-2 bg-slate-200/50 text-slate-400 rounded-full group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
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

      {/* --- MODAL: VERIFIKASI PASSWORD --- */}
      <Modal isOpen={modalType === 'verifyPassword'} onClose={() => setModalType(null)} title="Security Check">
        <form onSubmit={checkSalaryPassword} className="text-center space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Lock size={28} className="sm:w-8 sm:h-8" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 uppercase tracking-tight">Konfirmasi Password</h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Masukkan password login Anda untuk melihat rincian gaji.</p>
          </div>
          <input 
            type="password" 
            required
            value={verifyPass}
            onChange={e => setVerifyPass(e.target.value)}
            placeholder="Password Anda"
            className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg sm:text-xl outline-none focus:ring-4 focus:ring-rose-100 transition-all text-slate-800"
          />
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalType(null)} className="flex-1 py-3 sm:py-4 bg-slate-100 rounded-2xl font-black text-slate-400 text-sm">BATAL</button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-3 sm:py-4 bg-slate-800 text-white rounded-2xl font-black text-sm">VERIFIKASI</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL: DETAIL GAJI --- */}
      <Modal isOpen={modalType === 'salaryDetail'} onClose={() => setModalType(null)} title="Slip Rincian Gaji">
        {selectedGaji && (() => {
          const { t1, total1, t2, total2, t3, total3, grandTotal } = getSalaryDetails(selectedGaji);
          const periodeDate = new Date(selectedGaji.created_at);
          const periodeString = periodeDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

          return (
            <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
              <div className="bg-slate-900 p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2rem] text-center text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Total Bersih (T1 - T2 - T3)</p>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-white">
                  {formatRupiah(grandTotal)}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Rekap</p>
                  <p className="font-bold text-slate-700 text-xs break-all">{selectedGaji.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Periode Gaji</p>
                  <p className="font-bold text-slate-700 text-xs uppercase">{periodeString}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 mt-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Diterima Oleh (Person)</p>
                  <p className="font-bold text-slate-800 text-sm">{userData?.name} <span className="text-slate-400 font-medium">(@{selectedGaji.person})</span></p>
                </div>
              </div>

              <div className="max-h-[40vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {/* Pendapatan */}
                <div className="border border-blue-100 rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="bg-blue-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-blue-100 flex justify-between items-center">
                    <span className="font-black text-[10px] text-blue-600 uppercase tracking-widest">Pendapatan (Total 1)</span>
                    <span className="font-black text-blue-700 text-sm">{formatRupiah(total1)}</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-50 text-xs">
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Gaji Pokok</span><span className="font-bold text-slate-800">{formatRupiah(t1.pokok)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Tunjangan</span><span className="font-bold text-slate-800">{formatRupiah(t1.tunjangan)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Bonus 1</span><span className="font-bold text-slate-800">{formatRupiah(t1.bonus_1)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Bonus 2</span><span className="font-bold text-slate-800">{formatRupiah(t1.bonus_2)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Bonus 3</span><span className="font-bold text-slate-800">{formatRupiah(t1.bonus_3)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Bonus 4</span><span className="font-bold text-slate-800">{formatRupiah(t1.bonus_4)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Program</span><span className="font-bold text-slate-800">{formatRupiah(t1.program)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Lembur</span><span className="font-bold text-slate-800">{formatRupiah(t1.lembur)}</span></div>
                  </div>
                </div>

                {/* Potongan Kehadiran */}
                <div className="border border-rose-100 rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-rose-100 flex justify-between items-center">
                    <span className="font-black text-[10px] text-rose-600 uppercase tracking-widest">Potongan Kehadiran (Total 2)</span>
                    <span className="font-black text-rose-700 text-sm">-{formatRupiah(total2)}</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-50 text-xs">
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Alfa ({selectedGaji.alfa || 0}x)</span><span className="font-bold text-rose-600">{formatRupiah(t2.alfa)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Setengah Hari ({selectedGaji.setengah_hari || 0}x)</span><span className="font-bold text-rose-600">{formatRupiah(t2.setengah_hari)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Sakit ({selectedGaji.sakit || 0}x)</span><span className="font-bold text-rose-600">{formatRupiah(t2.sakit)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Telat ({selectedGaji.telat || 0}x)</span><span className="font-bold text-rose-600">{formatRupiah(t2.telat)}</span></div>
                  </div>
                </div>

                {/* Potongan Lainnya */}
                <div className="border border-orange-100 rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="bg-orange-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-orange-100 flex justify-between items-center">
                    <span className="font-black text-[10px] text-orange-600 uppercase tracking-widest">Potongan Lainnya (Total 3)</span>
                    <span className="font-black text-orange-700 text-sm">-{formatRupiah(total3)}</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-50 text-xs">
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">BPJS</span><span className="font-bold text-orange-600">{formatRupiah(t3.bpjs)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Bon Diambil</span><span className="font-bold text-orange-600">{formatRupiah(t3.bon_diambil)}</span></div>
                    <div className="flex justify-between p-2.5 sm:p-3"><span className="text-slate-500 font-medium">Bon Dibayar</span><span className="font-bold text-orange-600">{formatRupiah(t3.bon_dibayar)}</span></div>
                  </div>
                </div>
              </div>

              <button onClick={() => setModalType(null)} className="w-full py-3 sm:py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl sm:rounded-2xl font-black transition-colors text-sm">TUTUP RINCIAN</button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}