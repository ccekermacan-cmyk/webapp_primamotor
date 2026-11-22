import SalaryDetail from '../components/salary/SalaryDetail';
import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';
import { useNavigate } from 'react-router-dom';
import { accountHistoryFilters, passwordChangeError } from '../lib/account';
import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import Modal from '../components/modal';
import { Eye, EyeOff } from 'lucide-react';
import AccountProfileCard from '../components/akun/AccountProfileCard';
import AccountSalarySection from '../components/akun/AccountSalarySection';
import AccountBonSection from '../components/akun/AccountBonSection';
import AccountEditModal from '../components/akun/AccountEditModal';
import AccountVerifyPasswordModal from '../components/akun/AccountVerifyPasswordModal';
import type { UserData, Gaji, BonItem } from '../types/akun';

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
  const [allBon, setAllBon] = useState<BonItem[]>([]);
  const [bonPage, setBonPage] = useState(1);
  const perPage = 5;

  const salaryList = allSalary.slice((page - 1) * perPage, page * perPage);
  const bonList = allBon.slice((bonPage - 1) * perPage, bonPage * perPage);
  const totalPages = Math.max(1, Math.ceil(allSalary.length / perPage));
  const bonTotalPages = Math.max(1, Math.ceil(allBon.length / perPage));

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
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        setHeaderStyle({
          background: `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)}) 100%)`
        });
      } catch {
        setHeaderStyle({ background: defaultGradient });
      }
    };

    img.onerror = () => {
      setHeaderStyle({ background: defaultGradient });
    };

    img.src = userData.link_image;
    return () => { img.onload = null; img.onerror = null; };
  }, [userData?.link_image]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const relock = () => {
      if (document.hidden) setHideNominal(true);
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
        pb.collection('bon').getFullList<BonItem>({filter: filters.loans, sort: '-created_at,-id', $autoCancel: false}),
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
      try { localStorage.setItem('user_name', updated.name || updated.username); } catch { /* Profile committed */ }
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
      setSelectedGaji(null);
      setModalType('verifyPassword');
    } else {
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

        {/* 1. SECTION PROFILE */}
        <AccountProfileCard
          userData={userData}
          headerStyle={headerStyle}
          onOpenEdit={() => {
            setFormData(userData || {});
            setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
            setModalType('editProfile');
          }}
          onOpenResetPassword={() => {
            setFormData(userData || {});
            setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
            setModalType('editProfile');
          }}
        />

        {/* 2. SECTION GAJI */}
        <AccountSalarySection
          salaryList={salaryList}
          allSalary={allSalary}
          userData={userData}
          hideNominal={hideNominal}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onSelectSalary={handleSelectSalaryItem}
        />

        {/* 3. SECTION BON */}
        <AccountBonSection
          bonList={bonList}
          allBon={allBon}
          userData={userData}
          hideNominal={hideNominal}
          bonPage={bonPage}
          bonTotalPages={bonTotalPages}
          onBonPageChange={setBonPage}
        />
      </div>

      {/* --- MODAL: EDIT PROFILE & PASSWORD --- */}
      <AccountEditModal
        isOpen={modalType === 'editProfile'}
        isProcessing={isProcessing}
        formData={formData}
        passwordData={passwordData}
        onClose={() => {
          if (!isProcessing) {
            setModalType(null);
            setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
          }
        }}
        onFormDataChange={setFormData}
        onPasswordDataChange={setPasswordData}
        onSubmit={handleUpdateProfile}
        onOpenChangeEmail={() => {
          setNewEmail('');
          setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
          setModalType('changeEmail');
        }}
      />

      {/* --- MODAL: UBAH EMAIL --- */}
      <Modal isOpen={modalType === 'changeEmail'} onClose={() => { if (!isProcessing) { setModalType(null); setNewEmail(''); } }} title="Ubah Email">
        <form onSubmit={requestEmailUpdate} className="space-y-4">
          <p className="text-sm text-slate-600">Tautan konfirmasi dikirim ke email baru. Buka tautan dan masukkan password akun untuk menyelesaikan perubahan.</p>
          <label className="block text-xs font-bold">Email baru<input type="email" required autoComplete="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="block w-full mt-2 p-3 rounded-xl border" /></label>
          <button type="submit" disabled={isProcessing} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50">{isProcessing ? 'Mengirim...' : 'Kirim Tautan Konfirmasi'}</button>
        </form>
      </Modal>

      {/* --- MODAL: VERIFIKASI PASSWORD PRIVASI --- */}
      <AccountVerifyPasswordModal
        isOpen={modalType === 'verifyPassword'}
        isProcessing={isProcessing}
        verifyPass={verifyPass}
        onClose={() => {
          if (!isProcessing) {
            setModalType(null);
            setVerifyPass('');
            setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
          }
        }}
        onVerifyPassChange={setVerifyPass}
        onSubmit={checkSalaryPassword}
      />

      {/* --- MODAL: DETAIL GAJI --- */}
      <Modal isOpen={modalType === 'salaryDetail'} onClose={() => setModalType(null)} title="Slip rincian gaji" maxWidth="max-w-2xl" compact>
        {selectedGaji && <SalaryDetail key={selectedGaji.id} record={selectedGaji} fileUrl={name => pb.files.getUrl({ ...selectedGaji, collectionName: 'gaji' }, name)} />}
      </Modal>
    </div>
  );
}
