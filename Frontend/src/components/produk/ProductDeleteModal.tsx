import Modal from '../modal';
import type { Produk } from '../../types/produk';

interface ProductDeleteModalProps {
  isOpen: boolean;
  selectedProduct: Produk | null;
  deletePass: string;
  deleteError: string;
  isProcessing: boolean;
  onClose: () => void;
  onDeletePassChange: (val: string) => void;
  onSubmit: () => void;
}

export default function ProductDeleteModal({
  isOpen,
  selectedProduct,
  deletePass,
  deleteError,
  isProcessing,
  onClose,
  onDeletePassChange,
  onSubmit,
}: ProductDeleteModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Konfirmasi Hapus Produk"
    >
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-600">
          Yakin ingin menghapus <b>{selectedProduct?.kategori} {selectedProduct?.merk} {selectedProduct?.jenis} {selectedProduct?.varian}</b>? Tindakan ini <b className="text-red-600">tidak dapat dibatalkan</b>.
        </p>
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Password Admin</label>
          <input
            type="password"
            value={deletePass}
            onChange={e => onDeletePassChange(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-400"
            placeholder="Masukkan password untuk konfirmasi"
          />
          {deleteError && <p className="text-xs text-red-500 font-bold mt-1">{deleteError}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs uppercase cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? 'Menghapus...' : 'Hapus Permanen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
