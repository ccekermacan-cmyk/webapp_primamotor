import { Trash2 } from 'lucide-react';
import Modal from '../modal';
import type { DropdownData } from '../../types/settings';

interface SettingsDeleteModalProps {
  isOpen: boolean;
  selectedItem: DropdownData | null;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export default function SettingsDeleteModal({
  isOpen,
  selectedItem,
  onClose,
  onConfirmDelete,
}: SettingsDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hapus Master Data">
      <div className="text-center p-4">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={28} />
        </div>
        <p className="font-bold text-slate-700 text-sm">Hapus <span className="text-rose-600 font-black">{selectedItem?.text_1}</span>?</p>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-500 text-xs uppercase cursor-pointer">Batal</button>
          <button onClick={onConfirmDelete} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase shadow-md shadow-rose-200 cursor-pointer">Hapus</button>
        </div>
      </div>
    </Modal>
  );
}
