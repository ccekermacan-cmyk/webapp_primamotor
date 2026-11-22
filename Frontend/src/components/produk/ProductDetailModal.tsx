import React from 'react';
import Modal from '../modal';
import { Package, Trash2, Edit, Copy, ChevronLeft, ChevronRight, ImagePlus, ExternalLink, Check } from 'lucide-react';
import DeleteAccess from '../delete-access';
import ProductMedia from './ProductMedia';
import { isProductVideo } from '../../lib/products';
import { pb } from '../../lib/pocketbase';
import type { Produk } from '../../types/produk';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: Produk | null;
  currentImageIndex: number;
  setCurrentImageIndex: React.Dispatch<React.SetStateAction<number>>;
  isCopied: boolean;
  setIsCopied: (v: boolean) => void;
  userLevel: string;
  formatIdLamaDisplay: (id: string) => string;
  handleOpenEdit: (p: Produk) => void;
  handleOpenCopy: (p: Produk) => void;
  handleOpenDelete: (p: Produk) => void;
  handleOpenDetail: (p: Produk) => void;
  logHistory: any[];
  logPage: number;
  logTotalPages: number;
  logError: string;
  fetchLogHistory: (id: string, page: number) => void;
  setLogPage: React.Dispatch<React.SetStateAction<number>>;
  relatedProductsList: Produk[];
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  selectedProduct,
  currentImageIndex,
  setCurrentImageIndex,
  isCopied,
  setIsCopied,
  userLevel,
  formatIdLamaDisplay,
  handleOpenEdit,
  handleOpenCopy,
  handleOpenDelete,
  handleOpenDetail,
  logHistory,
  logPage,
  logTotalPages,
  logError,
  fetchLogHistory,
  setLogPage,
  relatedProductsList,
}: ProductDetailModalProps) {
  if (!selectedProduct) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Spesifikasi Produk" maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Hero image */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden">
          {selectedProduct.file && (selectedProduct.file || []).length > 0 ? (
            <>
              <ProductMedia
                controls
                src={pb.files.getUrl(selectedProduct, selectedProduct.file[currentImageIndex])}
                alt=""
                className="w-full h-full object-cover"
              />
              {(selectedProduct.file || []).length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur rounded-full px-3 py-1.5">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setCurrentImageIndex(p => p === 0 ? (selectedProduct.file || []).length - 1 : p - 1);
                    }}
                    className="text-white text-xs font-black px-1"
                  >
                    ‹
                  </button>
                  <span className="text-white text-[10px] font-bold">
                    {currentImageIndex + 1}/{(selectedProduct.file || []).length}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setCurrentImageIndex(p => p === (selectedProduct.file || []).length - 1 ? 0 : p + 1);
                    }}
                    className="text-white text-xs font-black px-1"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <Package size={56} className="text-gray-300" />
          )}
          {selectedProduct.stok_3 <= 0 && (
            <span className="absolute top-3 left-3 px-2.5 py-1 bg-red-500 text-white text-[10px] font-black rounded-lg">HABIS</span>
          )}
        </div>

        {/* Info header */}
        <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono text-gray-400 mb-0.5">ID: {formatIdLamaDisplay(selectedProduct.id_lama)}</p>
            <h3 className="font-black text-gray-800 text-base leading-snug">
              {`${selectedProduct.kategori} ${selectedProduct.merk} ${selectedProduct.jenis} ${selectedProduct.varian} ${selectedProduct.keterangan || ''} ${selectedProduct.tipe || ''}`.trim()}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="px-2 py-1 bg-orange-100 text-orange-600 text-[10px] font-black rounded-lg">{selectedProduct.unit || '-'}</span>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const fullName = `${selectedProduct.kategori} ${selectedProduct.merk} ${selectedProduct.jenis} ${selectedProduct.varian} ${selectedProduct.keterangan || ''} ${selectedProduct.tipe || ''}`.trim();
                try {
                  await navigator.clipboard.writeText(fullName);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                } catch { alert('Nama produk belum dapat disalin. Periksa izin clipboard browser.'); }
              }}
              className="p-1.5 mt-1 bg-white text-orange-500 hover:text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors shadow-sm"
              title="Salin Nama Produk"
            >
              {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <Package size={12} />
            Stok: {selectedProduct.stok_3 ?? 0} {selectedProduct.unit || ''}
          </span>
          {selectedProduct.stok_3 <= 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              Habis
            </span>
          )}
          {selectedProduct.stok_3 > 0 && selectedProduct.stok_3 <= (selectedProduct.stok_2 ?? 0) && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              Menipis
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2 border-b pb-4">
          <button onClick={() => handleOpenEdit(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"><Edit size={16} /> Edit Data</button>
          <button onClick={() => handleOpenCopy(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"><Copy size={16} /> Salin</button>
          {userLevel === '1' && (
            <DeleteAccess collection="produk" id={selectedProduct.id}><button onClick={() => handleOpenDelete(selectedProduct)} className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={16} /> Hapus</button></DeleteAccess>
          )}
        </div>

        <div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">Harga Beli (Modal)</span>
              <span className="text-lg font-black text-gray-800">Rp {selectedProduct.beli?.toLocaleString('id-ID') || 0}</span>
            </div>
          </div>
          <div className="overflow-hidden border border-gray-200 rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr><th className="px-4 py-3">Tier</th><th className="px-4 py-3 text-center">Minimum</th><th className="px-4 py-3 text-right">Harga</th><th className="px-4 py-3 text-right">Profit</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 1 (Grosir Besar)</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_1 || 0}</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_1?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_1 ? ((selectedProduct.sell_1 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 2 (Grosir Sedang)</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_2 || 0}</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_2?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_2 ? ((selectedProduct.sell_2 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 3 (Grosir Kecil)</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">&ge; {selectedProduct.min_3 || 0}</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_3?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_3 ? ((selectedProduct.sell_3 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tier 4</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                  <td className="px-4 py-3 text-right font-bold">Rp {selectedProduct.sell_4?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_4 ? ((selectedProduct.sell_4 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr className="bg-orange-50/30">
                  <td className="px-4 py-3 font-bold text-purple-600">Tier 5 (Pelanggan)</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                  <td className="px-4 py-3 text-right font-black text-purple-600">Rp {selectedProduct.sell_5?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_5 ? ((selectedProduct.sell_5 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
                <tr className="bg-blue-50/30">
                  <td className="px-4 py-3 font-bold text-blue-600">Tier 6 (Default Ecer)</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                  <td className="px-4 py-3 text-right font-black text-blue-600">Rp {selectedProduct.sell_6?.toLocaleString('id-ID') || 0}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                    {selectedProduct.beli && selectedProduct.sell_6 ? ((selectedProduct.sell_6 - selectedProduct.beli) / selectedProduct.beli * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* History Table */}
        <div className="mt-8">
          <h4 className="font-bold text-slate-700 text-sm mb-4">Riwayat Keluar/Masuk</h4>
          <div className="bg-white border border-slate-100 rounded-[1.25rem] shadow-sm overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Operator</th>
                  <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-center">Qty</th>
                  <th className="px-4 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider text-right">Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {logHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                      Belum ada riwayat transaksi.
                    </td>
                  </tr>
                ) : (
                  logHistory.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => { window.location.href = `/?ref=${log.ref_baru}`; }}
                    >
                      <td className="px-4 py-3 text-slate-500 font-medium">
                        {(() => {
                          const dateStr = log.created_at || log.created;
                          if (!dateStr) return '-';
                          const date = new Date(dateStr);
                          if (isNaN(date.getTime())) return dateStr;
                          const tanggal = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                          const waktu = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          return (
                            <div className="flex flex-col">
                              <span>{tanggal}</span>
                              <span className="text-[9px] text-slate-400">{waktu}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-semibold capitalize">
                        {log.operator || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest uppercase border ${
                          log.boolean?.toLowerCase() === 'in'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-rose-50 text-rose-600 border-rose-100'
                        }`}>
                          {log.boolean}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-700 text-center">
                        {log.qty}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-800">
                        Rp {log.price_1?.toLocaleString('id-ID') || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {logError && <p role="alert" className="text-red-600 text-xs mt-2">{logError} <button onClick={() => fetchLogHistory(selectedProduct.id, logPage)} className="underline cursor-pointer">Coba lagi</button></p>}
          <div className="flex justify-between items-center mt-4 px-1">
            <button
              disabled={logPage === 1}
              onClick={() => { setLogPage(p => p - 1); fetchLogHistory(selectedProduct.id, logPage - 1); }}
              className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm cursor-pointer"
            >
              <ChevronLeft size={16}/>
            </button>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
              Hal {logPage} / {logTotalPages || 1}
            </span>
            <button
              disabled={logPage >= logTotalPages}
              onClick={() => { setLogPage(p => p + 1); fetchLogHistory(selectedProduct.id, logPage + 1); }}
              className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm cursor-pointer"
            >
              <ChevronRight size={16}/>
            </button>
          </div>
        </div>

        {/* Lampiran Gambar */}
        {selectedProduct.file && (selectedProduct.file || []).length > 0 && (
          <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
            <p className="font-black text-[11px] text-blue-600 uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2">
              <ImagePlus size={16}/> Lampiran Gambar Produk
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(selectedProduct.file || []).map((f, i) => {
                const fileUrl = pb.files.getUrl(selectedProduct, f);
                return (
                  <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                    {isProductVideo(f) ? (
                      <video src={fileUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={fileUrl} alt={`lampiran-${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                    )}
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <ExternalLink size={24} className="text-white drop-shadow-lg scale-75 group-hover:scale-100 transition-transform" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Produk Terkait */}
        {relatedProductsList.length > 0 && (
          <div className="mt-8">
            <h4 className="font-bold text-slate-700 text-sm mb-4">Produk Serupa / Terkait</h4>
            <div className="flex flex-col gap-2">
              {relatedProductsList.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => handleOpenDetail(prod)}
                  className="group flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-2 hover:border-orange-200 hover:shadow-md hover:bg-orange-50/50 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 shrink-0 bg-slate-50/80 rounded-xl overflow-hidden relative border border-slate-100/50">
                    {prod.file && prod.file.length > 0 ? (
                      <ProductMedia src={pb.files.getUrl(prod, prod.file[0])} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-700 leading-snug truncate group-hover:text-orange-600 transition-colors">
                      {`${prod.kategori} ${prod.merk} ${prod.jenis} ${prod.varian} ${prod.keterangan || ''} ${prod.tipe || ''}`.trim()}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">ID: {formatIdLamaDisplay(prod.id_lama)}</span>
                      {prod.stok_3 <= 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-md">HABIS</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md flex items-center gap-1">
                          <Package size={10} /> Stok: {prod.stok_3 ?? 0}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 pl-2 pr-1">
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-[1.25rem] transition-colors mt-4 cursor-pointer">
          Tutup
        </button>
      </div>
    </Modal>
  );
}
