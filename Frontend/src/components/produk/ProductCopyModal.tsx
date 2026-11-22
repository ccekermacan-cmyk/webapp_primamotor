import Modal from '../modal';
import { Copy } from 'lucide-react';
import type { Produk } from '../../types/produk';

interface ProductCopyModalProps {
  isOpen: boolean;
  selectedProduct: Produk | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ProductCopyModal({
  isOpen,
  selectedProduct,
  onClose,
  onConfirm,
}: ProductCopyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isAlert={true}
      title="Salin Produk Ini?"
      alertDescription={
        <>
          Anda akan menduplikasi semua atribut dari <span className="font-bold text-slate-800">{selectedProduct?.kategori} {selectedProduct?.merk} {selectedProduct?.jenis} {selectedProduct?.varian}</span>. Stok awal pada produk baru akan di-reset menjadi 0.
        </>
      }
      alertIcon={<Copy size={24} />}
      alertIconBg="bg-blue-50 text-blue-600 border-blue-100"
      onConfirm={onConfirm}
      confirmText="Ya, Salin Data"
      cancelText="Batal"
      confirmBg="bg-blue-600 hover:bg-blue-500 shadow-blue-200"
    />
  );
}
