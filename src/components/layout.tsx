import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Wallet, FileText, UserCircle, Settings, LogOut, Users, ShieldAlert, Menu, X } from 'lucide-react';
import { pb } from '../lib/pocketbase';

export default function Layout({ setAuth }: { setAuth: (status: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [navTarget, setNavTarget] = useState<string | null>(null);
  const [showConfirmNav, setShowConfirmNav] = useState(false);
  const [serverTime, setServerTime] = useState<string>('');
  
  const userName = pb.authStore.model?.name || pb.authStore.model?.username || 'Guest';
  const [userLevel, setUserLevel] = useState<string | null>(localStorage.getItem('user_level'));
  const isUserLoggedIn = pb.authStore.isValid;

  // REVISI TOTAL: Guard Sesi
  useEffect(() => {
    const validateSession = () => {
      const storedLevel = localStorage.getItem('user_level');
      if (!pb.authStore.isValid || !storedLevel || storedLevel === 'undefined') {
        console.warn("Sesi tidak valid, mengalihkan ke login...");
        forceLogout();
      } else {
        setUserLevel(storedLevel);
      }
    };
    validateSession();
  }, [location.pathname]);

  // Proteksi awal jika user_level hilang saat reload
  useEffect(() => {
    if (isUserLoggedIn && userLevel === null) {
      forceLogout();
    }
  }, [userLevel, isUserLoggedIn]);

  // Perbaikan blok Security Guard
  useEffect(() => {
    const checkSecurityGuard = async () => {
      if (!pb.authStore.isValid || !pb.authStore.model || localStorage.getItem('user_level') === null) {
        forceLogout();
        return;
      }
      try {
        const freshUser = await pb.collection('user').getOne(pb.authStore.model.id, { $autoCancel: false });
        if (!freshUser || freshUser.status?.toLowerCase() !== 'active') {
          alert("Sesi Anda ditolak. Akun Anda tidak aktif atau ditangguhkan.");
          forceLogout();
        }
      } catch (err) {
        if ((err as any)?.status === 401) {
          forceLogout();
        }
      }
    };
    checkSecurityGuard();
  }, [location.pathname]);

  // Jam Detik Digital
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setServerTime(now.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }));
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const forceLogout = () => {
    pb.authStore.clear();
    localStorage.clear();
    setAuth(false);
    navigate('/login');
  };

  const performLogout = () => {
    pb.authStore.clear();
    localStorage.clear();
    setAuth(false);
    setShowLogoutDialog(false);
    navigate('/login');
  };

  const handleMenuClick = (e: React.MouseEvent, path: string) => {
    const isEditing = localStorage.getItem('is_editing') === 'true';
    if (isEditing) {
      e.preventDefault();
      setNavTarget(path);
      setShowConfirmNav(true);
    } else {
      setIsMobileMenuOpen(false); // Tutup sidebar di mobile setelah klik menu
    }
  };

  const marqueeStyle = `
    @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-100%); } }
    .animate-running-text { display: inline-block; white-space: nowrap; animation: marquee 10s linear infinite; }
    .animate-running-text:hover { animation-play-state: paused; }
  `;

  const allMenus = [
    { name: 'Kasir', path: '/', icon: ShoppingCart, color: 'text-blue-500', activeBg: 'bg-blue-50 border-blue-200' },
    { name: 'Produk', path: '/produk', icon: Package, color: 'text-orange-500', activeBg: 'bg-orange-50 border-orange-200' },
    { name: 'Person', path: '/person', icon: Users, color: 'text-cyan-500', activeBg: 'bg-cyan-50 border-cyan-200', show: isUserLoggedIn && userLevel === "1" },
    { name: 'Cashflow', path: '/cashflow', icon: Wallet, color: 'text-green-500', activeBg: 'bg-green-50 border-green-200' },
    { name: 'Report', path: '/report', icon: FileText, color: 'text-purple-500', activeBg: 'bg-purple-50 border-purple-200' },
    { name: 'Akun', path: '/akun', icon: UserCircle, color: 'text-pink-500', activeBg: 'bg-pink-50 border-pink-200', show: isUserLoggedIn },
    { name: 'Settings', path: '/settings', icon: Settings, color: 'text-slate-500', activeBg: 'bg-gray-100 border-gray-300', show: isUserLoggedIn && userLevel === "1" },
  ];

  const visibleMenus = allMenus.filter(m => m.show === undefined || m.show);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans relative">
      
      {/* Overlay Hitam saat Sidebar Terbuka di HP */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Sembunyi di HP, Tampil di PC) */}
      <div className={`fixed md:relative w-64 bg-white h-screen shadow-2xl md:shadow-sm flex flex-col z-40 border-r border-gray-100 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* HEADER SIDEBAR (Diperbaiki strukturnya) */}
        <div className="p-8 border-b border-gray-50 text-center shrink-0 relative">
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 bg-slate-50 rounded-full transition-colors">
            <X size={18} />
          </button>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 mb-3">
            <ShoppingCart className="text-red-600" size={24} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight leading-none">PRIMA <span className="text-red-600">MOTOR</span></h1>
        </div>
        
        {/* --- DYNAMIC USER PROFILE INFO --- */}
        <div className="px-6 py-4 mx-4 mt-4 md:mt-2 mb-2 bg-slate-50/70 border border-slate-100 rounded-2xl flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-white font-black flex items-center justify-center text-sm uppercase shadow-sm shrink-0">
            {userName.substring(0, 2)}
          </div>
          <div className="flex-1 overflow-hidden">
            <style>{marqueeStyle}</style> 
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Kasir Aktif</p>
            <div className="w-full overflow-hidden relative min-h-[14px] mb-1">
              {userName.length > 18 ? (
                <div className="animate-running-text pl-[100%] font-extrabold text-gray-800 text-xs leading-none">
                  {userName} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {userName}
                </div>
              ) : (
                <p className="font-extrabold text-gray-800 text-xs truncate leading-none">{userName}</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/50">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase">Lv-{userLevel || '0'}</span>
              </div>
              <span className="text-[10px] font-mono font-black text-slate-600 tracking-wider bg-slate-200/60 px-1.5 py-0.5 rounded">
                {serverTime || '00:00:00'}
              </span>
            </div>
          </div>
        </div>

        {/* MENU LIST */}
        <div className="flex-1 py-4 flex flex-col gap-1.5 px-4 overflow-y-auto custom-scrollbar">
          {visibleMenus.map((menu) => {
            const isActive = location.pathname === menu.path;
            const Icon = menu.icon;
            return (
              <Link 
                key={menu.name} 
                to={menu.path}
                onClick={(e) => handleMenuClick(e, menu.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                  isActive ? `${menu.activeBg} shadow-sm` : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-xl bg-white shadow-sm ${menu.color}`}>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`font-bold text-xs uppercase tracking-wider ${isActive ? 'text-gray-900' : 'text-slate-500'}`}>
                  {menu.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-50 shrink-0">
          <button 
            onClick={() => setShowLogoutDialog(true)} 
            className="flex w-full items-center justify-center gap-2 px-4 py-3.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all font-black text-xs uppercase tracking-widest border border-rose-100 shadow-sm"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>
      
      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-y-auto flex flex-col relative">
        {/* Tombol Hamburger Mobile (Mengambang Kiri Atas) */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden absolute top-6 left-6 z-20 p-3 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-100"
        >
          <Menu size={24} />
        </button>
        <Outlet /> 
      </main>

      {/* --- MODAL CONFIRMATION LOGOUT --- */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white p-6 max-w-sm w-full rounded-[2rem] shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Konfirmasi Keluar</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Apakah Anda yakin ingin menutup sesi kasir saat ini? Anda harus login kembali untuk bertransaksi.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowLogoutDialog(false)} 
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 border rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={performLogout} 
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-rose-200 transition-colors"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIRMATION NAVIGATION LEAVE EDIT MODE --- */}
      {showConfirmNav && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white p-6 max-w-sm w-full rounded-[2rem] shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-100 shadow-sm">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Hapus Perubahan?</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Anda terdeteksi sedang mengubah data transaksi di Keranjang. Meninggalkan halaman akan membatalkan perubahan data.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowConfirmNav(false)} 
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 border rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Tidak
              </button>
              <button 
                onClick={() => { localStorage.removeItem('is_editing'); setShowConfirmNav(false); setIsMobileMenuOpen(false); navigate(navTarget!); }} 
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-blue-200 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}