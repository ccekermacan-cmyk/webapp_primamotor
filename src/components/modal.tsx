import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    // Menambahkan onClick={onClose} di sini untuk deteksi klik di luar (backdrop)
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose} 
    >
      {/* Menambahkan e.stopPropagation() agar klik di dalam form/kotak putih tidak menutup modal */}
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md transform scale-100 animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  );
}