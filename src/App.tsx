import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { pb } from './lib/pocketbase';

import Layout from './components/layout';
import Login from './pages/login';
import Pos from './pages/pos';
import Produk from './pages/produk';
import Cashflow from './pages/cashflow';
import Akun from './pages/akun';
import Settings from './pages/settings';
import Person from './pages/person';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login setAuth={setIsAuthenticated} />
        } />
        
        <Route element={<ProtectedRoute><Layout setAuth={setIsAuthenticated} /></ProtectedRoute>}>
          <Route path="/" element={<Pos />} />
          <Route path="/produk" element={<Produk />} />
          <Route path="/person" element={<Person />} />
          <Route path="/cashflow" element={<Cashflow />} />
          <Route path="/report" element={<div className="p-8"><h2 className="text-2xl font-bold text-slate-800">Laporan Performa</h2></div>} />
          <Route path="/akun" element={<Akun />} />
          <Route path="/settings" element={<Settings />} /> 
        </Route>
      </Routes>
    </Router>
  );
}