import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Wallet, FileText, UserCircle, Settings, LogOut, Users, ShieldAlert, Menu, X } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';

export default function Layout({ setAuth }: { setAuth: (status: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [navTarget, setNavTarget] = useState<string | null>(null);
  const [showConfirmNav, setShowConfirmNav] = useState(false);
  const [serverTime, setServerTime] = useState<string>('');
  const [systemAlert, setSystemAlert] = useState({ show: false, title: '', message: '', onConfirm: () => {} });
  
  const userName = pb.authStore.model?.name || pb.authStore.model?.username || 'Guest';
  const [userLevel, setUserLevel] = useState<string | null>(localStorage.getItem('user_level'));
  const isUserLoggedIn = pb.authStore.isValid;

  // Proteksi awal jika user_level hilang saat reload
  useEffect(() => {
    if (isUserLoggedIn && userLevel === null) {
      forceLogout();
    }
  }, [userLevel, isUserLoggedIn]);

  // Security Guard dengan URL Protection
  useEffect(() => {
    const checkSecurityGuard = async () => {
      const currentLevel = localStorage.getItem('user_level');
      if (!pb.authStore.isValid || !pb.authStore.model || currentLevel === null) {
        forceLogout();
        return;
      }

      // --- URL FORCE GUARD START ---
      const path = location.pathname;
      if (path === '/settings' && currentLevel !== '1') {
        navigate('/');
        setSystemAlert({ show: true, title: "Akses Ditolak", message: "Anda tidak memiliki izin ke halaman Pengaturan.", onConfirm: () => setSystemAlert(prev => ({...prev, show: false})) });
        return;
      }
      if (path === '/report' && !['1','2','3','4','5','6'].includes(currentLevel)) {
        navigate('/');
        setSystemAlert({ show: true, title: "Akses Ditolak", message: "Anda tidak memiliki izin ke halaman Report.", onConfirm: () => setSystemAlert(prev => ({...prev, show: false})) });
        return;
      }
      if (path === '/person' && !['1','2','3','4','5','6','7'].includes(currentLevel)) {
        navigate('/');
        setSystemAlert({ show: true, title: "Akses Ditolak", message: "Anda tidak memiliki izin ke halaman Person.", onConfirm: () => setSystemAlert(prev => ({...prev, show: false})) });
        return;
      }
      // --- URL FORCE GUARD END ---

      try {
        const freshUser = await pb.collection('user').getOne(pb.authStore.model.id, { $autoCancel: false });
        if (!freshUser || freshUser.status?.toLowerCase() !== 'active') {
          forceLogout();
          return;
        }
        // 🔐 Tambahkan pengecekan level dari database
        const dbLevel = freshUser.level?.toString();
        const localLevel = localStorage.getItem('user_level');
        if (dbLevel !== localLevel) {
          setSystemAlert({
            show: true,
            title: "Sesi Tidak Valid",
            message: "Level akses Anda tidak cocok dengan database. Sesi akan ditutup untuk keamanan.",
            onConfirm: () => { setSystemAlert(prev => ({...prev, show: false})); forceLogout(); }
          });
          return;
        }
      } catch (error) {
        console.error("Gagal verifikasi user:", error);
        forceLogout();
      }
    };
    checkSecurityGuard();
  }, [location.pathname, navigate]);

    // 🔐 Pantau konsistensi level user secara aktif (interval + event storage)
    useEffect(() => {
      const checkLevelConsistency = () => {
        const storedLevel = localStorage.getItem('user_level');
        const dbLevel = pb.authStore.model?.level?.toString();
        if (storedLevel && dbLevel && storedLevel !== dbLevel) {
          // Level di localStorage tidak cocok dengan database → paksa logout
          forceLogout();
        }
      };

      // Cek setiap 5 detik (untuk deteksi perubahan di tab yang sama)
      const intervalId = setInterval(checkLevelConsistency, 5000);

      // Tangkap perubahan localStorage dari tab lain
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'user_level') {
          checkLevelConsistency();
        }
      };
      window.addEventListener('storage', handleStorageChange);

      return () => {
        clearInterval(intervalId);
        window.removeEventListener('storage', handleStorageChange);
      };
    }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        try {
          await pb.collection('user').getOne(pb.authStore.model.id, { $autoCancel: false });
        } catch {
          forceLogout();
        }
      }
    }, 5 * 60 * 1000); // 5 menit
    return () => clearInterval(interval);
  }, []);

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
      setIsMobileMenuOpen(false);
    }
  };

  const marqueeStyle = `
    @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-100%); } }
    .animate-running-text { display: inline-block; white-space: nowrap; animation: marquee 10s linear infinite; }
    .animate-running-text:hover { animation-play-state: paused; }
  `;

  const allMenus = [
    { name: 'Kasir', path: '/', icon: ShoppingCart, color: 'text-blue-500', activeBg: 'bg-blue-50 border-blue-200', show: true },
    { name: 'Produk', path: '/produk', icon: Package, color: 'text-orange-500', activeBg: 'bg-orange-50 border-orange-200', show: true },
    { name: 'Person', path: '/person', icon: Users, color: 'text-cyan-500', activeBg: 'bg-cyan-50 border-cyan-200', show: isUserLoggedIn && userLevel !== null && ['1','2','3','4','5','6','7'].includes(userLevel) },
    { name: 'Cashflow', path: '/cashflow', icon: Wallet, color: 'text-green-500', activeBg: 'bg-green-50 border-green-200', show: true },
    { name: 'Report', path: '/report', icon: FileText, color: 'text-purple-500', activeBg: 'bg-purple-50 border-purple-200', show: isUserLoggedIn && userLevel !== null && ['1','2','3','4','5','6'].includes(userLevel) },
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
      <div className={`fixed md:relative w-64 md:w-52 lg:w-64 bg-white h-screen shadow-2xl md:shadow-sm flex flex-col z-40 border-r border-gray-100 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* HEADER SIDEBAR */}
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
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-white font-black flex items-center justify-center text-sm uppercase shadow-sm shrink-0 overflow-hidden">
            {pb.authStore.model?.link_image ? (
              <img src={pb.authStore.model.link_image} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              userName.substring(0, 2)
            )}
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
      <Modal
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        isAlert={true}
        showCancel={true}
        title="Konfirmasi Keluar"
        alertDescription="Apakah Anda yakin ingin menutup sesi kasir saat ini? Anda harus login kembali untuk bertransaksi."
        alertIcon={<ShieldAlert size={24} />}
        alertIconBg="bg-rose-50 text-rose-500 border-rose-100"
        onConfirm={performLogout}
        confirmText="Ya, Keluar"
        cancelText="Batal"
        confirmBg="bg-rose-600 hover:bg-rose-500 shadow-rose-200"
      />

      {/* --- MODAL CONFIRMATION NAVIGATION LEAVE EDIT MODE --- */}
      <Modal
        isOpen={showConfirmNav}
        onClose={() => setShowConfirmNav(false)}
        title="Hapus Perubahan?"
        alertDescription="Anda terdeteksi sedang mengubah data transaksi di Keranjang. Meninggalkan halaman akan membatalkan perubahan data."
        alertIcon={<ShieldAlert size={24} />}
        alertIconBg="bg-amber-50 text-amber-500 border-amber-100"
        onConfirm={() => {
          localStorage.removeItem('is_editing');
          setShowConfirmNav(false);
          setIsMobileMenuOpen(false);
          navigate(navTarget!);
        }}
        confirmText="Ya, Hapus"
        cancelText="Tidak"
        confirmBg="bg-blue-600 hover:bg-blue-500 shadow-blue-200"
      />

      {/* --- MODAL SYSTEM ALERT (Pengganti alert bawaan browser) --- */}
      <Modal
        isOpen={systemAlert.show}
        onClose={() => setSystemAlert(prev => ({ ...prev, show: false }))}
        title={systemAlert.title}
        alertDescription={systemAlert.message}
        alertIcon={<ShieldAlert size={24} />}
        alertIconBg="bg-rose-50 text-rose-500 border-rose-100"
        onConfirm={() => {
          systemAlert.onConfirm();
          setSystemAlert(prev => ({ ...prev, show: false }));
        }}
        confirmText="Mengerti"
        cancelText="Tutup"
        confirmBg="bg-rose-600 hover:bg-rose-500 shadow-rose-200"
      />
    </div>
  );
}