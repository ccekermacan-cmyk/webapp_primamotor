import React from 'react';
import Modal from '../modal';
import { X, ImagePlus, Trash2 } from 'lucide-react';
import ProductMedia from './ProductMedia';
import { isProductVideo } from '../../lib/products';
import type { Produk } from '../../types/produk';

interface ProductFormModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  isReadOnly: boolean;
  isProcessing: boolean;
  formData: Partial<Produk>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Produk>>>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  existingTipe: string[];
  productFiles: any[];
  setProductFiles: React.Dispatch<React.SetStateAction<any[]>>;
  productPreviewUrls: string[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProductFormModal({
  isOpen,
  isEditMode,
  isReadOnly,
  isProcessing,
  formData,
  setFormData,
  handleInputChange,
  inputValue,
  setInputValue,
  existingTipe,
  productFiles,
  setProductFiles,
  productPreviewUrls,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Produk" : "Tambah/Copy Produk"}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">

          {/* ── INFORMASI DASAR ─────────────────────────────────────── */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="font-bold text-gray-700 text-sm border-b pb-2">Informasi Dasar</h4>

            {/* Baris 1: ID Lama + Kategori */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500">ID Lama</label>
                <input
                  required
                  type="text"
                  name="id_lama"
                  maxLength={5}
                  value={formData.id_lama || ''}
                  onChange={handleInputChange}
                  disabled={isEditMode}
                  className={`w-full p-2 border rounded-lg outline-none ${isEditMode ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-transparent' : 'bg-white focus:ring-2 focus:ring-orange-400'}`}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">Kategori</label>
                <input required type="text" name="kategori" value={formData.kategori || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
            </div>

            {/* Baris 2: Merk (Wajib) + Jenis (Opsional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500">Merk <span className="text-rose-500">*</span></label>
                <input required type="text" name="merk" value={formData.merk || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">Jenis</label>
                <input type="text" name="jenis" value={formData.jenis || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
            </div>

            {/* Baris 3: Varian + Keterangan */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500">Varian</label>
                <input type="text" name="varian" value={formData.varian || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">Keterangan</label>
                <input type="text" name="keterangan" value={formData.keterangan || ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>
            </div>

            {/* Baris 4: Satuan */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500">Satuan (Unit)</label>
                <select name="unit" value={formData.unit || 'pcs'} onChange={handleInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                  <option value="pcs">pcs</option>
                  <option value="m">m</option>
                </select>
              </div>
            </div>

            {/* Tipe Motor */}
            <div>
              <label className="font-bold text-orange-700 text-sm mb-2 block">Tipe Motor <span className="text-xs font-normal text-gray-400">(Tekan Enter untuk menambah)</span></label>

              {/* Tag list */}
              <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                {(formData.tipe?.split(',').map(s => s.trim()).filter(Boolean) || []).map((t, idx) => (
                  <span key={idx} className="px-3 py-1 bg-orange-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm">
                    {t}
                    <X size={12} className="cursor-pointer hover:text-orange-200" onClick={() => {
                      const current = formData.tipe?.split(',').map(s => s.trim()).filter(Boolean) || [];
                      setFormData({ ...formData, tipe: current.filter((_, i) => i !== idx).join(', ') });
                    }} />
                  </span>
                ))}
              </div>

              {/* Input + Dropdown */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik tipe motor..."
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        const current = formData.tipe ? formData.tipe.split(',').map(s => s.trim()).filter(Boolean) : [];
                        if (!current.includes(val)) setFormData({ ...formData, tipe: [...current, val].join(', ') });
                        setInputValue('');
                      }
                    }
                  }}
                />
                {inputValue.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    <div
                      className="px-4 py-2 text-xs font-black text-orange-600 bg-orange-50 cursor-pointer border-b border-orange-100"
                      onClick={() => {
                        const current = formData.tipe ? formData.tipe.split(',').map(s => s.trim()).filter(Boolean) : [];
                        if (!current.includes(inputValue)) setFormData({ ...formData, tipe: [...current, inputValue].join(', ') });
                        setInputValue('');
                      }}
                    >
                      + Tambah "{inputValue}" sebagai tipe baru
                    </div>
                    {existingTipe
                      .filter(t => t.toLowerCase().includes(inputValue.toLowerCase()))
                      .map((t) => (
                        <div
                          key={t}
                          className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-orange-50 cursor-pointer border-b last:border-0"
                          onClick={() => {
                            const current = formData.tipe ? formData.tipe.split(',').map(s => s.trim()).filter(Boolean) : [];
                            if (!current.includes(t)) setFormData({ ...formData, tipe: [...current, t].join(', ') });
                            setInputValue('');
                          }}
                        >
                          {t}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── MANAJEMEN STOK ──────────────────────────────────────── */}
          <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 space-y-4">
            <h4 className="font-bold text-green-700 text-sm border-b border-green-200 pb-2">
              Manajemen Stok
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500">Stok Awal</label>
                <input
                  type="number" min="0" step="1"
                  name="stok_1"
                  disabled={isReadOnly}
                  value={formData.stok_1 ?? ''}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded-lg outline-none ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-white focus:ring-2 focus:ring-green-400'}`}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">Stok Menipis</label>
                <input
                  type="number" min="0" step="1"
                  name="stok_2"
                  disabled={isReadOnly}
                  value={formData.stok_2 ?? ''}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded-lg outline-none font-bold ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-white text-amber-700 focus:ring-2 focus:ring-amber-400'}`}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-green-600">Stok Realtime</label>
                <input
                  type="number" min="0" step="1"
                  name="stok_3"
                  disabled={isReadOnly}
                  value={formData.stok_3 ?? ''}
                  onChange={handleInputChange}
                  className={`w-full p-2 border rounded-lg outline-none font-bold ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-green-50 focus:ring-2 focus:ring-green-400'}`}
                />
              </div>
            </div>
          </div>

          {/* ── SKEMA HARGA ─────────────────────────────────────────── */}
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
            <h4 className="font-bold text-blue-700 text-sm border-b border-blue-200 pb-2">Skema Harga (Tiering)</h4>

            {/* Harga Beli */}
            <div>
              <label className="text-xs font-bold text-gray-500">Harga Beli Dasar (Modal)</label>
              <input
                type="number" min="0" step="1"
                name="beli"
                value={formData.beli ?? ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className={`w-full p-2 border rounded-lg outline-none ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-400'}`}
              />
            </div>

            {/* Tier Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Tier 1 */}
              <div className="bg-white p-3 rounded-lg border space-y-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min 1 Qty</label>
                  <input type="number" min="0" step="1" name="min_1" value={formData.min_1 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 1</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" name="sell_1" value={formData.sell_1 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {(formData.beli || 0) > 0 && formData.sell_1 && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">+{((formData.sell_1 - (formData.beli || 0)) / (formData.beli || 0) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </div>

              {/* Tier 2 */}
              <div className="bg-white p-3 rounded-lg border space-y-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min 2 Qty</label>
                  <input type="number" min="0" step="1" name="min_2" value={formData.min_2 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 2</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" name="sell_2" value={formData.sell_2 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {(formData.beli || 0) > 0 && formData.sell_2 && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">+{((formData.sell_2 - (formData.beli || 0)) / (formData.beli || 0) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </div>

              {/* Tier 3 */}
              <div className="bg-white p-3 rounded-lg border space-y-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min 3 Qty</label>
                  <input type="number" min="0" step="1" name="min_3" value={formData.min_3 ?? ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 3</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" name="sell_3" value={formData.sell_3 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {(formData.beli || 0) > 0 && formData.sell_3 && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">+{((formData.sell_3 - (formData.beli || 0)) / (formData.beli || 0) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </div>

              {/* Tier 4 */}
              <div className="bg-white p-3 rounded-lg border space-y-2">
                <div className="h-[56px]" />
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sell 4</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" name="sell_4" value={formData.sell_4 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
                    {(formData.beli || 0) > 0 && formData.sell_4 && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">+{((formData.sell_4 - (formData.beli || 0)) / (formData.beli || 0) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </div>

              {/* Tier 5 */}
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 space-y-2">
                <div className="h-[56px]" />
                <div>
                  <label className="text-xs font-bold text-purple-600 block mb-1">Sell 5 (Pelanggan)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" name="sell_5" value={formData.sell_5 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-purple-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-purple-100 font-bold text-purple-700" />
                    {(formData.beli || 0) > 0 && formData.sell_5 && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">+{((formData.sell_5 - (formData.beli || 0)) / (formData.beli || 0) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </div>

              {/* Tier 6 */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                <div className="h-[56px]" />
                <div>
                  <label className="text-xs font-bold text-blue-600 block mb-1">Sell 6 (Default Ecer)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" name="sell_6" value={formData.sell_6 ?? ''} onChange={handleInputChange} className="flex-1 p-2 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 bg-blue-100 font-bold text-blue-700" />
                    {(formData.beli || 0) > 0 && formData.sell_6 && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">+{((formData.sell_6 - (formData.beli || 0)) / (formData.beli || 0) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── GAMBAR PRODUK ───────────────────────────────────────── */}
          <div className="bg-yellow-50/30 p-4 rounded-xl border border-yellow-100 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-black text-yellow-600 uppercase tracking-wider flex items-center gap-2">
                <ImagePlus size={16} /> Gambar Produk
              </label>
              <label htmlFor="product-file-input" className="cursor-pointer text-[10px] font-black bg-white px-4 py-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all border border-yellow-200 text-yellow-600">
                + Upload
              </label>
              <input
                id="product-file-input"
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={e => {
                  const selectedFiles = Array.from(e.target.files || []);
                  if (productFiles.length + selectedFiles.length > 10) { alert('Maksimal 10 file per produk.'); e.target.value = ''; return; }
                  if (selectedFiles.length > 0) setProductFiles(prev => [...prev, ...selectedFiles]);
                  e.target.value = '';
                }}
              />
            </div>

            {productPreviewUrls.length === 0 ? (
              <div className="text-center py-5 rounded-2xl border-2 border-dashed border-yellow-200">
                <p className="text-[10px] font-bold text-yellow-600 opacity-70">Belum ada file gambar</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {productPreviewUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-white shadow-sm aspect-square bg-white">
                    <ProductMedia src={url} video={isProductVideo(productFiles[idx])} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => setProductFiles(prev => prev.filter((_, i) => i !== idx))} className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 shadow-lg cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {productFiles.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-yellow-200">
                <span className="text-[11px] font-black text-yellow-600">{productFiles.length} file terpilih</span>
                <button type="button" onClick={() => setProductFiles([])} className="text-[10px] font-black text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                  Hapus Semua
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ── TOMBOL AKSI ─────────────────────────────────────────── */}
        <div className="flex gap-3 pt-4 border-t">
          <button type="button" disabled={isProcessing} onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 cursor-pointer">
            Batal
          </button>
          <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50 cursor-pointer">
            {isProcessing ? 'Menyimpan...' : 'Simpan Data'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
