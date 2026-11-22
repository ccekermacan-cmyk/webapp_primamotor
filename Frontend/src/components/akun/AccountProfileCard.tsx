import React from 'react';
import { Camera, Edit3, Key, Mail, Shield, ShieldCheck, User } from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import type { UserData } from '../../types/akun';

interface AccountProfileCardProps {
  userData: UserData | null;
  headerStyle: React.CSSProperties;
  onOpenEdit: () => void;
  onOpenResetPassword: () => void;
}

export default function AccountProfileCard({
  userData,
  headerStyle,
  onOpenEdit,
  onOpenResetPassword,
}: AccountProfileCardProps) {
  return (
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
            onClick={onOpenEdit}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl font-black transition-all shadow-lg text-xs uppercase tracking-wider"
          >
            <Edit3 size={15} /> EDIT PROFIL
          </button>
          <button 
            onClick={onOpenResetPassword}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-black transition-all text-xs uppercase tracking-wider"
          >
            <Key size={15} /> RESET PASSWORD
          </button>
        </div>
      </div>
    </div>
  );
}
