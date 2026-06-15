import React, { useState, lazy, Suspense } from 'react';
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  // Komponen fallback saat loading chunk
  const PageLoader = () => (
    <div className="flex h-screen items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login setAuth={setIsAuthenticated} />
          } />
          
          <Route element={<ProtectedRoute><Layout setAuth={setIsAuthenticated} /></ProtectedRoute>}>
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