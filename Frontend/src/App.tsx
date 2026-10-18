import { hasPendingAtomic, recoverPendingAtomic } from './services/api/atomic';
import { hasPendingSync, flushPendingSync } from './services/api/laravel';
import React, { useState, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { pb } from './lib/pocketbase';
import Layout from './components/layout';
import Login from './pages/login';

// Lazy load halaman-halaman berat
const Pos = lazy(() => import('./pages/pos'));
const Produk = lazy(() => import('./pages/produk'));
const Cashflow = lazy(() => import('./pages/cashflow'));
const Akun = lazy(() => import('./pages/akun'));
const Settings = lazy(() => import('./pages/settings'));
const Person = lazy(() => import('./pages/person'));
const ReportPage = lazy(() => import('./pages/report'));

function ProtectedRoute({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Komponen fallback skeleton loader modern saat loading chunk
const PageLoader = () => (
  <div className="flex h-full min-h-[60vh] w-full items-center justify-center p-8 transition-opacity duration-300">
    <div className="flex flex-col items-center gap-4 bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
        <div className="absolute w-3 h-3 bg-red-600 rounded-full animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-xs font-black tracking-widest text-slate-800 uppercase">Memuat Halaman...</p>
        <p className="text-[10px] font-medium text-slate-400 mt-0.5">Prima Motor POS System</p>
      </div>
    </div>
  </div>
);


export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);

  const [atomicPending, setAtomicPending] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const retrySync = async () => {
    setSyncBusy(true);
    try {
      await flushPendingSync();
      if (hasPendingAtomic()) { await recoverPendingAtomic(); window.location.reload(); return; }
      setSyncError('');
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Pemeriksaan transaksi gagal.'); }
    finally { setSyncBusy(false); setAtomicPending(hasPendingAtomic()); }
  };
  useEffect(() => {
    const refresh = () => setAtomicPending(hasPendingAtomic());
    window.addEventListener('prima:sync-change', refresh);
    window.addEventListener('prima:atomic-change', refresh);
    const unsubscribe = pb.authStore.onChange(() => { setIsAuthenticated(pb.authStore.isValid); refresh(); });
    if (pb.authStore.isValid) {
      // Obsolete legacy outbox: drain best-effort in the background, never block the app.
      if (hasPendingSync()) void flushPendingSync();
      if (hasPendingAtomic()) void retrySync();
    }
    return () => { window.removeEventListener('prima:sync-change', refresh); window.removeEventListener('prima:atomic-change', refresh); unsubscribe(); };
  }, []);

  // Auto-reload jika ada versi baru di server (SPA staleness fix)
  useEffect(() => {
    let currentVersion = '';
    
    fetch('/version.json')
      .then(r => r.json())
      .then(data => { currentVersion = data.version; })
      .catch(() => {});

    const checkVersion = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch(`/version.json?t=${Date.now()}`);
          const data = await res.json();
          if (currentVersion && data.version && currentVersion !== data.version) {
            console.log('Versi baru terdeteksi! Memuat ulang aplikasi...');
            window.location.reload();
          }
        } catch (err) {
          // Abaikan error jika offline
        }
      }
    };

    document.addEventListener('visibilitychange', checkVersion);
    return () => document.removeEventListener('visibilitychange', checkVersion);
  }, []);

  return (
    <Router>
      {isAuthenticated && atomicPending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-6">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Status transaksi perlu diperiksa</h2>
            <p className="my-4 text-sm text-slate-600">Periksa hasil transaksi sebelum melanjutkan. Sistem akan memastikan transaksi sudah tersimpan lengkap atau dibatalkan. Jangan membuat ulang transaksi yang sama selama pemeriksaan belum selesai.</p>
            {syncError && <p role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{syncError}</p>}
            <button disabled={syncBusy} onClick={retrySync} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50">
              {syncBusy ? 'Memeriksa…' : 'Periksa dan lanjutkan'}
            </button>
          </div>
        </div>
      )}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login setAuth={setIsAuthenticated} />
          } />
          
          <Route element={<ProtectedRoute isAuthenticated={isAuthenticated}><Layout setAuth={setIsAuthenticated} /></ProtectedRoute>}>
            <Route path="/" element={<Pos />} />
            <Route path="/produk" element={<Produk />} />
            <Route path="/person" element={<Person />} />
            <Route path="/cashflow" element={<Cashflow />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/akun" element={<Akun />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}