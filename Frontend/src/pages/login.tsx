import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { loginErrorMessage } from '../lib/login';
import { Wrench, Lock, User, AlertCircle } from 'lucide-react';

export default function Login({ setAuth }: { setAuth: (status: boolean) => void }) {
  const [sessionMessage] = useState(() => {
    try { const message = sessionStorage.getItem('prima:login-reason') || ''; sessionStorage.removeItem('prima:login-reason'); return message; } catch { return ''; }
  });
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const loginLock = useRef(false);
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLock.current) return;
    if (!identity.trim() || !password) {
      setErrorModal({ show: true, message: 'Isi username/email dan password terlebih dahulu.' });
      return;
    }
    loginLock.current = true;
    setLoading(true);

    try {
      // Normalize identity to lowercase (case-insensitive username)
      const normalizedIdentity = identity.toLowerCase().trim();
      const authData = await pb.collection('user').authWithPassword(normalizedIdentity, password);
      
      // 2. Cek apakah record user ada
      if (!authData.record) throw new Error("User tidak ditemukan");

      // 3. Cek Status User (Active)
      // Pastikan status di database bernilai 'active' (lowercase)
      const statusLower = String(authData.record.status || '').toLowerCase();
      
      if (statusLower !== 'active') {
        pb.authStore.clear(); // Bersihkan sesi karena status tidak aktif
        setErrorModal({
          show: true,
          message: 'Akun Anda tidak aktif. Silakan hubungi admin.'
        });
        return;
      }

      // 4. Simpan ke LocalStorage
      // String() digunakan agar tidak error saat data level null
      localStorage.setItem('user_name', authData.record.name || '');
      localStorage.setItem('user_username', authData.record.username || '');
      localStorage.setItem('user_level', String(authData.record.level || ''));

      // 5. Sukses
      setAuth(true);
      navigate('/');

    } catch (err: unknown) {
      pb.authStore.clear();
      
      setErrorModal({ 
        show: true, 
        message: loginErrorMessage(err)
      });
    } finally {
      loginLock.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      {/* Container utama diubah menjadi flex baris di desktop (lg:flex-row) */}
      <div className="max-w-md lg:max-w-4xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-white flex flex-col lg:flex-row">
        
        {/* --- BAGIAN BRANDING KIRI (Desktop) / ATAS (Mobile & Tablet) --- */}
        <div className="bg-gradient-to-br from-red-600 to-red-800 p-10 lg:p-14 text-center lg:text-left relative flex flex-col justify-center lg:w-1/2 overflow-hidden">
          <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none flex items-center justify-center lg:justify-end">
            <Wrench size={240} className="-rotate-12 translate-x-10 lg:translate-x-24" />
          </div>
          <div className="mx-auto lg:mx-0 bg-white w-20 h-20 lg:w-24 lg:h-24 rounded-3xl flex items-center justify-center mb-6 shadow-xl rotate-3 relative z-10">
            <Wrench className="text-red-600" size={40} />
          </div>
          {/* Tag br disembunyikan di HP agar tidak patah, tampilkan di PC */}
          <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tighter relative z-10 leading-tight mb-2">PRIMA <br className="hidden lg:block"/>MOTOR</h1>
          <p className="text-red-100 font-bold text-xs lg:text-sm tracking-[0.2em] uppercase relative z-10">Gladag POS System</p>
        </div>
        
        {/* --- BAGIAN FORM KANAN (Desktop) / BAWAH (Mobile & Tablet) --- */}
        <div className="p-10 lg:p-14 flex flex-col justify-center lg:w-1/2 bg-white">
          <div className="mb-8 hidden lg:block">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Selamat Datang!</h2>
            <p className="text-sm font-bold text-slate-400 mt-1">Silakan masuk menggunakan kredensial Anda.</p>
          </div>

          {sessionMessage && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{sessionMessage}</p>}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username / Email</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-500 transition-colors" size={20} />
                <input 
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500/20 outline-none font-bold text-slate-700 transition-all"
                  placeholder="Ketik username..."
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-500 transition-colors" size={20} />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={loading}
                  onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500/20 outline-none font-bold text-slate-700 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showPassword} disabled={loading} onChange={e => setShowPassword(e.target.checked)} />
                Tampilkan password
              </label>
              {capsLock && <span role="status" className="text-amber-700">Caps Lock aktif</span>}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-slate-200 transition-all active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
            >
              {loading ? 'MENGECEK AKSES...' : 'MASUK SEKARANG'}
            </button>
          </form>
        </div>
      </div>

      {/* --- PENGGUNAAN ULANG MODAL SEBAGAI ALERT --- */}
      <Modal 
        isOpen={errorModal.show} 
        onClose={() => setErrorModal({ ...errorModal, show: false })} 
        isAlert={true}
        showCancel={false}
        title="Opps! Ada Kendala"
        alertDescription={errorModal.message}
        alertIcon={<AlertCircle size={28} />}
        alertIconBg="bg-red-50 text-red-600 border-red-100"
        confirmText="SAYA MENGERTI"
        confirmBg="bg-slate-900 hover:bg-slate-800 shadow-slate-200"
      />
    </div>
  );
}