import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { Wrench, Lock, User, AlertCircle } from 'lucide-react';

export default function Login({ setAuth }: { setAuth: (status: boolean) => void }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Autentikasi dengan PocketBase
      const authData = await pb.collection('user').authWithPassword(identity, password);
      
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

    } catch (err: any) {
      console.error("Login Error:", err);
      pb.authStore.clear();
      
      setErrorModal({ 
        show: true, 
        message: 'Username, Email, atau Password yang Anda masukkan salah.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-white">
        <div className="bg-gradient-to-br from-red-600 to-red-700 p-10 text-center relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <Wrench size={120} className="-rotate-12 translate-x-40" />
          </div>
          <div className="mx-auto bg-white w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-xl rotate-3">
            <Wrench className="text-red-600" size={40} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">PRIMA MOTOR</h1>
          <p className="text-red-100 font-bold text-xs tracking-[0.2em] uppercase mt-1">Gladag POS System</p>
        </div>
        
        <div className="p-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username / Email</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-500 transition-colors" size={20} />
                <input 
                  type="text" 
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
                  type="password" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500/20 outline-none font-bold text-slate-700 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
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

      <Modal 
        isOpen={errorModal.show} 
        onClose={() => setErrorModal({ ...errorModal, show: false })} 
        title="Opps! Ada Kendala"
      >
        <div className="text-center p-4">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={44} />
          </div>
          <p className="font-bold text-slate-700 text-lg leading-tight">{errorModal.message}</p>
          <button 
            onClick={() => setErrorModal({ ...errorModal, show: false })}
            className="w-full mt-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl transition-all"
          >
            SAYA MENGERTI
          </button>
        </div>
      </Modal>
    </div>
  );
}