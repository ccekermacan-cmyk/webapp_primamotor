import { Tag, MapPin, Phone, Pencil, Trash2 } from 'lucide-react';
import Modal from '../modal';
import DeleteAccess from '../delete-access';
import type { DropdownData } from '../../types/settings';

interface SettingsDetailModalProps {
  isOpen: boolean;
  selectedItem: DropdownData | null;
  onClose: () => void;
  onOpenEdit: (item: DropdownData) => void;
  onOpenDelete: () => void;
  getFieldLabel: (field: string, kategori: string, jenis: string) => string;
}

export default function SettingsDetailModal({
  isOpen,
  selectedItem,
  onClose,
  onOpenEdit,
  onOpenDelete,
  getFieldLabel,
}: SettingsDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rincian Master Data">
      {selectedItem && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-center">
            <Tag className="mx-auto text-indigo-600 mb-1" size={24} />
            <h3 className="text-xl font-black text-indigo-950">{selectedItem.text_1}</h3>
            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
              {selectedItem.jenis} &bull; {selectedItem.kategori}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase">{getFieldLabel('text_2', selectedItem.kategori, selectedItem.jenis)}</p>
              <p className="mt-0.5 font-bold text-slate-700">{selectedItem.text_2 || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase">{getFieldLabel('number_1', selectedItem.kategori, selectedItem.jenis)}</p>
              <p className="mt-0.5 font-mono font-bold text-slate-700">
                {selectedItem.kategori?.toLowerCase() === 'cashflow' || selectedItem.jenis?.toLowerCase().includes('akun') 
                  ? `Rp ${selectedItem.number_1?.toLocaleString('id-ID')}` 
                  : selectedItem.number_1 ?? '0'}
              </p>
            </div>

            {selectedItem.address && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 flex items-start gap-2">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Alamat</p>
                  <p className="mt-0.5 font-bold text-slate-700">{selectedItem.address}</p>
                </div>
              </div>
            )}

            {selectedItem.phone !== 0 && selectedItem.phone && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">No. Telepon</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-700">{selectedItem.phone}</p>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase">Visibilitas Akses</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedItem.visibilitas ? (
                  (Array.isArray(selectedItem.visibilitas) ? selectedItem.visibilitas : String(selectedItem.visibilitas).split(',')).map(v => (
                    <span key={v} className="bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md text-[10px]">Level {v}</span>
                  ))
                ) : <span className="text-slate-400 font-medium italic">Global (Semua Level)</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onOpenEdit(selectedItem)}
              className="flex-1 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Pencil size={14} /> Edit Data
            </button>
            {selectedItem.id_lama !== 'umum1' && (
              <DeleteAccess collection="dropdown" id={selectedItem.id}><button
                onClick={onOpenDelete}
                className="py-3 px-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button></DeleteAccess>
            )}
            <button 
              onClick={onClose} 
              className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
