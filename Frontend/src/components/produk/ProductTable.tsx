import React from 'react';
import { Package, Edit, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { displayProductCode } from '../../lib/products';
import DeleteAccess from '../delete-access';
import ProductMedia from './ProductMedia';
import type { Produk } from '../../types/produk';

interface ProductTableProps {
  products: Produk[];
  userLevel: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'id_lama' | 'nama' | 'stok' | 'harga_customer' | 'harga_retail') => void;
  onOpenDetail: (prod: Produk) => void;
  onOpenEdit: (prod: Produk, e: React.MouseEvent) => void;
  onOpenCopy: (prod: Produk, e: React.MouseEvent) => void;
  onOpenDelete: (prod: Produk, e: React.MouseEvent) => void;
}

export default function ProductTable({
  products,
  userLevel,
  sortField,
  sortOrder,
  onSort,
  onOpenDetail,
  onOpenEdit,
  onOpenCopy,
  onOpenDelete,
}: ProductTableProps) {
  const sortIcon = (field: string) =>
    sortField === field ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => onSort('id_lama')}>
              <div className="flex items-center gap-1">Kode {sortIcon('id_lama')}</div>
            </th>
            <th className="text-left py-3 px-2 font-semibold text-gray-600 w-12"></th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => onSort('nama')}>
              <div className="flex items-center gap-1">Nama Produk {sortIcon('nama')}</div>
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => onSort('stok')}>
              <div className="flex items-center justify-end gap-1">Stok {sortIcon('stok')}</div>
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => onSort('harga_customer')}>
              <div className="flex items-center justify-end gap-1">Harga Pelanggan {sortIcon('harga_customer')}</div>
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => onSort('harga_retail')}>
              <div className="flex items-center justify-end gap-1">Harga Retail {sortIcon('harga_retail')}</div>
            </th>
            <th className="text-center py-3 px-4 font-semibold text-gray-600">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((prod) => (
            <tr key={prod.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onOpenDetail(prod)}>
              <td className="py-3 px-4 font-mono text-xs">{displayProductCode(prod.id_lama)}</td>
              <td className="py-2 px-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {prod.file && prod.file.length > 0 ? (
                    <ProductMedia src={`${pb.files.getUrl(prod, prod.file[0])}?thumb=80x80`} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={14} className="text-gray-300" />
                  )}
                </div>
              </td>
              <td className="py-3 px-4 font-medium text-gray-800">
                {`${prod.kategori} ${prod.merk} ${prod.jenis} ${prod.varian} ${prod.keterangan || ''} ${prod.tipe || ''}`.trim()}
              </td>
              <td className="py-3 px-4 text-right font-semibold">
                <span className={prod.stok_3 <= 0 ? 'text-red-500' : 'text-green-600'}>
                  {prod.stok_3} {prod.unit}
                </span>
              </td>
              <td className="py-3 px-4 text-right font-semibold text-purple-600">
                Rp {prod.sell_5?.toLocaleString('id-ID') || 0}
              </td>
              <td className="py-3 px-4 text-right font-semibold text-blue-600">
                Rp {prod.sell_6?.toLocaleString('id-ID') || 0}
              </td>
              <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1 justify-center">
                  <button onClick={(e) => onOpenEdit(prod, e)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition" title="Edit">
                    <Edit size={14} />
                  </button>
                  <button onClick={(e) => onOpenCopy(prod, e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition" title="Copy">
                    <Copy size={14} />
                  </button>
                  {userLevel === '1' && (
                    <DeleteAccess collection="produk" id={prod.id}>
                      <button onClick={(e) => onOpenDelete(prod, e)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition" title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </DeleteAccess>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
