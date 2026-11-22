import React from 'react';
import { Package, Edit, Copy, Trash2 } from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { displayProductCode } from '../../lib/products';
import DeleteAccess from '../delete-access';
import ProductMedia from './ProductMedia';
import type { Produk } from '../../types/produk';

interface ProductCardGridProps {
  products: Produk[];
  userLevel: string;
  isProcessing: boolean;
  onOpenDetail: (prod: Produk) => void;
  onOpenEdit: (prod: Produk, e: React.MouseEvent) => void;
  onOpenCopy: (prod: Produk, e: React.MouseEvent) => void;
  onOpenDelete: (prod: Produk, e: React.MouseEvent) => void;
  onQuickStockChange: (prod: Produk, delta: number) => void;
}

export default function ProductCardGrid({
  products,
  userLevel,
  isProcessing,
  onOpenDetail,
  onOpenEdit,
  onOpenCopy,
  onOpenDelete,
  onQuickStockChange,
}: ProductCardGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
      {products.map((prod) => (
        <div
          key={prod.id}
          onClick={() => onOpenDetail(prod)}
          className="group bg-white border border-orange-200 rounded-2xl hover:border-orange-500 hover:shadow-lg hover:shadow-orange-300 transition-all duration-300 cursor-pointer flex flex-col overflow-hidden"
        >
          {/* Thumbnail */}
          <div className="relative w-full aspect-[3/2] sm:aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
            {prod.file && prod.file.length > 0 ? (
              <ProductMedia
                src={`${pb.files.getUrl(prod, prod.file[0])}?thumb=300x225`}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <Package size={40} className="text-gray-300" />
            )}
            {prod.stok_3 <= 0 && (
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-lg">HABIS</span>
            )}
            {prod.stok_3 > 0 && prod.stok_3 <= (prod.stok_2 || 0) && (
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-lg animate-pulse">MENIPIS</span>
            )}
          </div>

          <div className="p-1.5 sm:p-2 xl:p-3 flex flex-col flex-1">
            {/* ID + Unit */}
            <div className="flex justify-between items-start gap-2 mb-2">
              <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{displayProductCode(prod.id_lama)}</span>
              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">{prod.unit || '-'}</span>
            </div>

            {/* Nama */}
            <h3 className="font-bold text-gray-800 text-xs sm:text-sm leading-snug group-hover:text-orange-600 line-clamp-2 mb-2 flex-1">
              {`${prod.kategori} ${prod.merk} ${prod.jenis} ${prod.varian} ${prod.keterangan || ''} ${prod.tipe || ''}`.trim()}
            </h3>

            {/* Stok + Harga */}
            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-xl mb-2">
              <div>
                <p className="text-[9px] text-gray-400 font-medium mb-0.5">Stok</p>
                <p className={`font-black text-base ${prod.stok_3 <= 0 ? 'text-red-500' : prod.stok_3 <= (prod.stok_2 || 0) ? 'text-amber-500' : 'text-green-600'}`}>
                  {prod.stok_3} <span className="text-[9px] font-normal text-gray-400">{prod.unit}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-400 font-medium mb-0.5">Harga</p>
                <p className="font-black text-blue-600 text-sm">Rp {prod.sell_6?.toLocaleString('id-ID') || 0}</p>
                {(userLevel === '1' || userLevel === '2' || userLevel === '5' || userLevel === '6') && prod.beli > 0 && prod.sell_6 > 0 && (
                  <p className={`text-[8px] font-bold mt-0.5 ${prod.sell_6 > prod.beli ? 'text-emerald-600' : 'text-red-500'}`}>
                    Mgn {Math.round((1 - prod.beli / prod.sell_6) * 100)}%
                  </p>
                )}
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex gap-1 justify-between items-center border-t border-gray-100 pt-1.5">
              <div className="flex gap-0.5">
                <button onClick={(e) => onOpenEdit(prod, e)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200" title="Edit">
                  <Edit size={13} />
                </button>
                <button onClick={(e) => onOpenCopy(prod, e)} className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-500 bg-blue-50 hover:bg-blue-100" title="Copy">
                  <Copy size={13} />
                </button>
                {userLevel === '1' && (
                  <DeleteAccess collection="produk" id={prod.id}>
                    <button onClick={(e) => onOpenDelete(prod, e)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 bg-red-50 hover:bg-red-100" title="Hapus">
                      <Trash2 size={13} />
                    </button>
                  </DeleteAccess>
                )}
              </div>
              <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                <button disabled={isProcessing} onClick={() => onQuickStockChange(prod, -1)} className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black">−</button>
                <span className="text-[9px] font-bold text-gray-400 w-4 text-center">{prod.stok_3}</span>
                <button disabled={isProcessing} onClick={() => onQuickStockChange(prod, 1)} className="w-6 h-6 flex items-center justify-center rounded-md bg-green-50 hover:bg-green-100 text-green-600 text-xs font-black">+</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
