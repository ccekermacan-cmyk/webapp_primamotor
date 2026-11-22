import React, { useMemo, useEffect } from 'react';
import Modal from '../modal';
import { FieldError } from './FieldError';
import { MechanicSection } from './MechanicSection';
import { formatRupiah, formatAmount } from '../../lib/money';
import { pb } from '../../lib/pocketbase';
import type { CartItem, CheckoutForm, DropdownItem, Produk, HistoryMenu } from '../../types/pos';
import type { FieldKey } from '../../lib/posValidation';
import {
  Package, Wallet, FileText, Edit2, X, Calendar, Users, ChevronUp, ChevronDown,
  Search, Plus, ChevronLeft, ChevronRight, Trash2, RotateCcw, AlertTriangle,
  CreditCard, Sparkles, AlertCircle, CheckCircle2, Zap, ShoppingBag, EyeOff,
  ImagePlus, Upload, Eye
} from 'lucide-react';

interface PosCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMenu: string;
  activeTheme: {
    main: string;
    light: string;
    text: string;
    border: string;
    focusRing: string;
  };
  cartTab: 'items' | 'payment' | 'notes';
  setCartTab: React.Dispatch<React.SetStateAction<'items' | 'payment' | 'notes'>>;
  setIsPaymentFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPersonDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPersonDropdownOpen: boolean;
  editSession: { isEditing: boolean; menuId: string; createdAt: string; snapshot?: HistoryMenu } | null;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setEditSession: React.Dispatch<React.SetStateAction<{ isEditing: boolean; menuId: string; createdAt: string; snapshot?: HistoryMenu } | null>>;
  setEditOldItems: React.Dispatch<React.SetStateAction<any[]>>;
  setMenuFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setExistingMenuFiles: React.Dispatch<React.SetStateAction<File[]>>;
  formBayar: CheckoutForm;
  setFormBayar: React.Dispatch<React.SetStateAction<CheckoutForm>>;
  confirmAction: (title: string, message: string, onConfirm: () => void, isDestructive?: boolean) => void;
  getLocalDatetimeInput: () => string;
  fieldErrors: Partial<Record<FieldKey, string>>;
  clearFieldError: (key: FieldKey) => void;
  getPersonDisplayText: (idLama?: string, fallback?: string) => string;
  personSearch: string;
  setPersonSearch: React.Dispatch<React.SetStateAction<string>>;
  personOptions: DropdownItem[];
  cart: CartItem[];
  showCartCatalog: boolean;
  setShowCartCatalog: React.Dispatch<React.SetStateAction<boolean>>;
  searchInput: string;
  setSearchInput: React.Dispatch<React.SetStateAction<string>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  page: number;
  totalPages: number;
  loading: boolean;
  products: Produk[];
  addToCart: (product: Produk) => void;
  getFullLabel: (item: any) => string;
  cartWithTierPrice: (CartItem & { isTiered?: boolean; activeTierName?: string })[];
  formatIdLamaDisplay: (id?: string) => string;
  updateQty: (id: string, delta: number, maxStock: number) => void;
  updatePrice: (id: string, newPrice: number) => void;
  grandTotal: number;
  mechanics: any[];
  setDialog: (dialog: any) => void;
  cashflowAccounts: DropdownItem[];
  isOnlinePerson: boolean;
  menuFiles: File[];
  existingMenuFiles: File[];
  menuPreviewUrls: string[];
  isVideo: (filename: string) => any;
  isProcessing: boolean;
  handleCheckoutValidation: () => void;
}

export const PosCartModal: React.FC<PosCartModalProps> = ({
  isOpen,
  onClose,
  selectedMenu,
  activeTheme,
  cartTab,
  setCartTab,
  setIsPaymentFormOpen,
  setIsPersonDropdownOpen,
  isPersonDropdownOpen,
  editSession,
  setCart,
  setEditSession,
  setEditOldItems,
  setMenuFiles,
  setExistingMenuFiles,
  formBayar,
  setFormBayar,
  confirmAction,
  getLocalDatetimeInput,
  fieldErrors,
  clearFieldError,
  getPersonDisplayText,
  personSearch,
  setPersonSearch,
  personOptions,
  cart,
  showCartCatalog,
  setShowCartCatalog,
  searchInput,
  setSearchInput,
  setPage,
  page,
  totalPages,
  loading,
  products,
  addToCart,
  getFullLabel,
  cartWithTierPrice,
  formatIdLamaDisplay,
  updateQty,
  updatePrice,
  grandTotal,
  mechanics,
  setDialog,
  cashflowAccounts,
  isOnlinePerson,
  menuFiles,
  existingMenuFiles,
  menuPreviewUrls,
  isVideo,
  isProcessing,
  handleCheckoutValidation,
}) => {
  const existingUrls = useMemo(() => existingMenuFiles.map(f => URL.createObjectURL(f)), [existingMenuFiles]);
  useEffect(() => {
    return () => {
      existingUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [existingUrls]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${editSession ? 'Edit' : 'Transaksi'} ${selectedMenu}`} maxWidth="max-w-2xl" compact>
      <div className="pos-modal-layout">
        <nav className="pos-modal-tabs" aria-label="Bagian form transaksi">
          {([{id:'items',label:'Barang & jasa',Icon:Package},{id:'payment',label:'Pembayaran',Icon:Wallet},{id:'notes',label:'Catatan',Icon:FileText}] as const).map(({id,label,Icon}) => (
            <button
              type="button"
              key={id}
              aria-pressed={cartTab===id}
              onClick={() => { setCartTab(id); setIsPaymentFormOpen(id==='payment'); setIsPersonDropdownOpen(false); }}
              className={cartTab===id ? `${activeTheme.light} ${activeTheme.text}` : 'text-slate-500'}
            >
              <Icon size={16}/>{label}
            </button>
          ))}
        </nav>
        <div className="pos-modal-scroll pos-form-fields">
          {editSession?.isEditing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-2 mb-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-blue-900">
                  Mode Edit Nota ({editSession.menuId.slice(0, 8)}...)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  confirmAction(
                    'Batalkan Edit?',
                    'Keranjang akan dibersihkan dan kembali ke mode transaksi baru. Lanjutkan?',
                    () => {
                      setCart([]);
                      setEditSession(null);
                      setEditOldItems([]);
                      setMenuFiles([]);
                      setExistingMenuFiles([]);
                      setFormBayar({
                        personIdLama: 'umum1',
                        payment: 'Tunai',
                        nominalBayar: 0,
                        mekanikList: [{ idLama: '', ongkos: 0 }],
                        noteMenu: '',
                        note: '',
                        marketplace: '',
                        adminFee: 0,
                        cashback: 0,
                        cashflowList: [{ accountId: '', nominal: 0 }],
                        tempoDate: '',
                        createdAt: getLocalDatetimeInput(),
                      });
                    }
                  );
                }}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold uppercase transition-colors"
              >
                <X size={14}/> Batal edit
              </button>
            </div>
          )}

          <section hidden={cartTab !== 'items'} className="space-y-4">
            <div data-field="cart" tabIndex={-1} className="outline-none">
              <FieldError message={fieldErrors.cart} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tanggal Transaksi */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}>
                    <Calendar size={14} /> Waktu Transaksi
                  </label>
                  <input
                    type="datetime-local"
                    value={formBayar.createdAt}
                    onChange={e => setFormBayar({ ...formBayar, createdAt: e.target.value })}
                    className={`w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all`}
                  />
                </div>
              </div>

              {/* Pelanggan & Bayar */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><Users size={14}/> Pelanggan</label>
                  
                  {/* Custom Searchable Dropdown */}
                  <div className="relative mt-2">
                    <div 
                      onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)}
                      className={`w-full p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border ${activeTheme.border} rounded-xl cursor-pointer flex justify-between items-center hover:border-slate-300 transition-colors`}
                    >
                      <span className="truncate">
                        {getPersonDisplayText(formBayar.personIdLama, 'Pilih Pelanggan...')}
                      </span>
                      {isPersonDropdownOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                    </div>

                    {isPersonDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsPersonDropdownOpen(false)}></div>
                        
                        <div className={`absolute z-50 w-full mt-1 bg-white border ${activeTheme.border} rounded-xl shadow-xl overflow-hidden flex flex-col`}>
                          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <Search size={14} className="text-slate-400 shrink-0" />
                            <input 
                              type="text"
                              autoFocus
                              placeholder="Cari nama / HP pelanggan..."
                              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-700 placeholder-slate-400"
                              value={personSearch}
                              onChange={e => setPersonSearch(e.target.value)}
                            />
                          </div>
                          
                          <div className="max-h-48 overflow-y-auto custom-scrollbar bg-white">
                            {personOptions.filter(p => p.text_1.toLowerCase().includes(personSearch.toLowerCase()) || ((p as any).text_2 && (p as any).text_2.toLowerCase().includes(personSearch.toLowerCase())) || p.id_lama.toLowerCase().includes(personSearch.toLowerCase())).length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400 font-semibold">Pelanggan tidak ditemukan</div>
                            ) : (
                              personOptions
                                .filter(p => p.text_1.toLowerCase().includes(personSearch.toLowerCase()) || ((p as any).text_2 && (p as any).text_2.toLowerCase().includes(personSearch.toLowerCase())) || p.id_lama.toLowerCase().includes(personSearch.toLowerCase()))
                                .map(p => (
                                  <div 
                                    key={p.id}
                                    onClick={() => {
                                      setFormBayar({ ...formBayar, personIdLama: p.id_lama });
                                      setIsPersonDropdownOpen(false);
                                      setPersonSearch('');
                                    }}
                                    className={`p-2.5 text-xs md:text-sm font-semibold cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${formBayar.personIdLama === p.id_lama ? `${activeTheme.light} ${activeTheme.text}` : 'text-slate-700 hover:bg-slate-50'}`}
                                  >
                                    <span className="truncate">{p.text_1}{(p as any).text_2 ? ` - ${(p as any).text_2}` : ''}</span>
                                    <span className="text-[11px] text-slate-400 font-mono">{p.id_lama}</span>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">Item transaksi ({cart.length})</h3>
              <button type="button" className={`pos-action ${activeTheme.light} ${activeTheme.text}`} onClick={() => setShowCartCatalog((v: boolean) => !v)}>
                <Plus size={16}/> Tambah item
              </button>
            </div>

            {showCartCatalog && (
              <div className="p-3 border border-slate-200 rounded-xl space-y-2">
                <label className="text-xs font-medium block">
                  Cari barang di katalog
                  <input
                    aria-label="Cari barang di katalog"
                    value={searchInput}
                    onChange={e => { setSearchInput(e.target.value); setPage(1); }}
                    className="w-full mt-2 p-2 border border-slate-200 rounded-lg"
                    placeholder="Nama / kode barang"
                  />
                </label>
                {loading ? (
                  <p role="status" className="text-xs">Memuat barang…</p>
                ) : products.length === 0 ? (
                  <p className="text-xs">Barang tidak ditemukan.</p>
                ) : products.map(product => {
                  const stokHabis = !selectedMenu.toLowerCase().includes('pembelian') && Number(product.stok_3) <= 0;
                  return (
                    <button
                      type="button"
                      key={product.id}
                      disabled={stokHabis}
                      onClick={() => addToCart(product)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-100 py-2 text-left text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>
                        {getFullLabel(product)}
                        <small className={`block ${stokHabis ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                          {stokHabis ? 'Stok habis' : `Stok: ${product.stok_3} ${product.unit}`}
                        </small>
                      </span>
                      <span className="pos-action"><Plus size={14}/> {stokHabis ? 'Kosong' : 'Tambah'}</span>
                    </button>
                  );
                })}
                <div className="flex justify-between items-center text-xs">
                  <button type="button" className="pos-action" disabled={page<=1 || loading} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={14}/> Sebelumnya
                  </button>
                  <span>{page} / {Math.max(1,totalPages)}</span>
                  <button type="button" className="pos-action" disabled={page>=totalPages || loading} onClick={() => setPage(p => p + 1)}>
                    Berikutnya <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {cart.length === 0 && selectedMenu.toLowerCase().includes('service') && (
                <div className="text-center py-8 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Tidak ada sparepart/item fisik. Hanya mencatat nota jasa service.
                </div>
              )}
              {cartWithTierPrice.map(item => {
                const canEditPrice = pb.authStore.isValid;
                return (
                  <div key={item.id} className={`bg-slate-50/70 hover:bg-white border ${activeTheme.border} rounded-2xl p-3 sm:p-3.5 relative group transition-all shadow-sm`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`font-black ${activeTheme.text} bg-white px-2 py-0.5 rounded-md text-[10px] tracking-tight border border-slate-200 shadow-2xs`}>
                            #{formatIdLamaDisplay(item.id_lama)}
                          </span>
                          {(item.isTiered || item.activeTierName) && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${activeTheme.light} ${activeTheme.text} border border-slate-200/50`}>
                              {item.activeTierName}
                            </span>
                          )}
                          {item.priceSelected !== item.sell_6 && !selectedMenu.toLowerCase().includes('pembelian') && (
                            <span className="text-[10px] text-slate-400 line-through font-bold">
                              {formatRupiah(item.sell_6)}
                            </span>
                          )}
                        </div>
                        <p className="font-black text-slate-800 text-xs md:text-sm line-clamp-1 leading-snug">
                          {getFullLabel(item)}
                        </p>
                      </div>

                      <button
                        onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                        className="text-rose-500 hover:text-rose-600 pos-action rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                        title="Hapus dari keranjang"
                      >
                        <Trash2 size={16} /> Hapus
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                      <span className="text-xs text-slate-500">
                        {item.manualPrice !== undefined ? 'Harga manual tetap saat jumlah berubah' : 'Harga otomatis sesuai jumlah & pelanggan'}
                      </span>
                      {item.manualPrice !== undefined && canEditPrice && (
                        <button
                          type="button"
                          className="pos-action text-slate-600"
                          onClick={() => setCart(prev => prev.map(row => {
                            if (row.id !== item.id) return row;
                            const { manualPrice: _manual, ...automatic } = row;
                            return automatic;
                          }))}
                        >
                          <RotateCcw size={14}/> Harga otomatis
                        </button>
                      )}
                    </div>
                    <details className="mt-2 text-xs text-slate-600">
                      <summary className="cursor-pointer">Aturan harga barang ini</summary>
                      <dl className="grid grid-cols-2 gap-2 pt-2">
                        {selectedMenu.toLowerCase().includes('pembelian') ? (
                          <>
                            <dt>Beli lama</dt>
                            <dd>{formatRupiah(Number(item.beli))}</dd>
                          </>
                        ) : (
                          <>
                            <dt>Eceran</dt><dd>{formatRupiah(Number(item.sell_6))}</dd>
                            <dt>Pelanggan</dt><dd>{formatRupiah(Number(item.sell_5))}</dd>
                            {([[item.min_3,item.sell_3,'Grosir kecil'],[item.min_2,item.sell_2,'Grosir sedang'],[item.min_1,item.sell_1,'Grosir besar']] as const)
                              .filter(([min]) => min > 0)
                              .map(([min, price, label]) => (
                                <div className="contents" key={label}>
                                  <dt>{label} · ≥ {min}</dt>
                                  <dd>{formatRupiah(Number(price))}</dd>
                                </div>
                              ))}
                          </>
                        )}
                      </dl>
                    </details>

                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-200/50 gap-2">
                      <div className={`flex items-center border ${activeTheme.border} rounded-xl bg-white overflow-hidden shadow-2xs shrink-0`}>
                        <button
                          onClick={() => updateQty(item.id, -1, item.stok_3)}
                          className={`w-7 h-7 flex items-center justify-center text-slate-600 hover:${activeTheme.text} hover:${activeTheme.light} active:scale-95 transition-all text-base font-bold`}
                          aria-label="Kurangi jumlah"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          aria-label={`Jumlah ${getFullLabel(item)}`}
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateQty(item.id, val - item.qty, item.stok_3);
                          }}
                          className={`w-10 text-center text-xs font-black ${activeTheme.text} bg-transparent outline-none p-0 border-none focus:ring-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                          min="1"
                          max={item.stok_3}
                        />
                        <button
                          onClick={() => updateQty(item.id, 1, item.stok_3)}
                          className={`w-7 h-7 flex items-center justify-center text-slate-600 hover:${activeTheme.text} hover:${activeTheme.light} active:scale-95 transition-all text-base font-bold`}
                          aria-label="Tambah jumlah"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">@</span>
                          {canEditPrice ? (
                            <div className="relative inline-block w-24 sm:w-28">
                              <input
                                type="number"
                                className={`w-full py-1 pl-6 pr-2 text-right text-xs font-black text-slate-700 bg-white border ${activeTheme.border} rounded-lg ${activeTheme.focusRing} outline-none transition-all [&::-webkit-inner-spin-button]:appearance-none`}
                                aria-label={`Harga satuan ${getFullLabel(item)}`}
                                value={item.manualPrice !== undefined ? item.manualPrice : item.priceSelected}
                                onChange={e => updatePrice(item.id, Number(e.target.value))}
                                placeholder="0"
                              />
                              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black ${activeTheme.text}`}>
                                Rp
                              </span>
                            </div>
                          ) : (
                            <span className={`text-xs font-bold ${activeTheme.text} px-1 truncate max-w-[90px]`}>
                              {formatAmount(item.priceSelected)}
                            </span>
                          )}
                        </div>

                        <div className={`text-xs md:text-sm font-black text-white ${activeTheme.main} px-3 py-1.5 rounded-lg shadow-sm text-right min-w-[90px]`}>
                          {formatRupiah((item.qty * item.priceSelected))}
                        </div>
                      </div>

                      {item.beli > 0 && (item.manualPrice !== undefined ? item.manualPrice : item.priceSelected) < item.beli && (
                        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <AlertTriangle size={11} aria-hidden="true" />
                          Harga di bawah harga beli ({formatRupiah(item.beli)})
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <MechanicSection
              selectedMenu={selectedMenu}
              activeTheme={activeTheme}
              formBayar={formBayar}
              setFormBayar={setFormBayar}
              grandTotal={grandTotal}
              mechanics={mechanics}
              setDialog={setDialog}
              error={fieldErrors.mechanic || fieldErrors.mechanicOngkos}
              onChange={() => { clearFieldError('mechanic'); clearFieldError('mechanicOngkos'); }}
            />
          </section>

          <section hidden={cartTab !== 'payment'} className="space-y-4">
            <div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><CreditCard size={14}/> Tipe Bayar</label>
                <div className={`flex bg-white rounded-xl p-1 mt-2 border ${activeTheme.border} gap-1`}>
                  {['Tunai', 'Tempo'].map(m => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setFormBayar({ ...formBayar, payment: m })}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                        formBayar.payment === m 
                          ? `${activeTheme.main} text-white` 
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {m === 'Tunai' ? 'CASH' : 'TEMPO'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`${activeTheme.light} p-5 rounded-3xl border-2 ${activeTheme.border} space-y-4 shadow-sm`}>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <label className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-wider flex items-center gap-2`}>
                  <Wallet size={16} /> Akun Kas & Nominal
                </label>
                <button
                  type="button"
                  onClick={() => setFormBayar(prev => ({
                    ...prev,
                    cashflowList: [...prev.cashflowList, { id: '', created_at: '', accountId: '', nominal: 0 }]
                  }))}
                  className={`pos-action bg-white ${activeTheme.text} border ${activeTheme.border}`}
                >
                  <Plus size={14}/> Tambah pembayaran
                </button>
              </div>
              
              <div className="space-y-2">
                {formBayar.cashflowList.map((cf, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-white p-2.5 rounded-2xl border border-white/80 shadow-sm">
                    {formBayar.cashflowList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormBayar(prev => ({
                            ...prev,
                            cashflowList: prev.cashflowList.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="pos-action text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 self-end sm:self-auto"
                        title="Hapus baris pembayaran"
                      >
                        <Trash2 size={16} /> Hapus
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <select
                        value={cf.accountId}
                        data-field="paymentAccount"
                        onChange={e => {
                          const nextAccountId = e.target.value;
                          setFormBayar(prev => ({
                            ...prev,
                            cashflowList: prev.cashflowList.map((row, i) => i === idx ? { ...row, accountId: nextAccountId } : row)
                          }));
                          clearFieldError('paymentAccount');
                        }}
                        className="w-full p-2.5 text-xs md:text-sm font-semibold text-slate-700 border border-slate-200/70 bg-slate-50 hover:bg-slate-100 rounded-xl outline-none cursor-pointer"
                      >
                        <option value="">Pilih Akun Bank/Tunai...</option>
                        {cashflowAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.text_1}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative w-full sm:w-44 shrink-0">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold ${activeTheme.text}`}>Rp</span>
                      <input
                        type="number"
                        placeholder="Nominal"
                        value={cf.nominal || ''}
                        data-field="paymentNominal"
                        onChange={e => {
                          const nextNominal = Number(e.target.value);
                          setFormBayar(prev => ({
                            ...prev,
                            cashflowList: prev.cashflowList.map((row, i) => i === idx ? { ...row, nominal: nextNominal } : row)
                          }));
                          clearFieldError('paymentNominal');
                        }}
                        className="w-full pl-9 pr-3 py-2.5 text-xs md:text-sm font-semibold text-slate-800 border border-slate-200/70 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div data-field="paymentRows" tabIndex={-1} className="outline-none">
                <FieldError message={fieldErrors.paymentAccount || fieldErrors.paymentNominal} />
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-black/5">
                <span className={`text-xs font-semibold ${activeTheme.text}`}>Total Dibayar:</span>
                <span className="text-sm md:text-base font-semibold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 tabular-nums">
                  {formatRupiah(formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0))}
                </span>
              </div>

              {(() => {
                const totalDibayarCalc = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);
                const selisih = totalDibayarCalc - grandTotal;
                if (selisih > 0) {
                  return (
                    <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex justify-between items-center text-xs font-semibold text-emerald-800 animate-in fade-in">
                      <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-500"/> Kembalian:</span>
                      <span className="font-semibold text-emerald-700 text-xs md:text-sm tabular-nums">{formatRupiah(selisih)}</span>
                    </div>
                  );
                } else if (selisih < 0) {
                  return (
                    <div className="p-2.5 bg-rose-50/90 border border-rose-200 rounded-xl flex justify-between items-center text-xs font-semibold text-rose-800 animate-in fade-in">
                      <span className="flex items-center gap-1.5"><AlertCircle size={14} className="text-rose-500"/> Sisa Kurang (Piutang):</span>
                      <span className="font-semibold text-rose-700 text-xs md:text-sm tabular-nums">{formatRupiah(Math.abs(selisih))}</span>
                    </div>
                  );
                } else if (totalDibayarCalc > 0) {
                  return (
                    <div className="p-2.5 bg-white/80 border border-emerald-200/80 rounded-xl flex justify-between items-center text-xs font-semibold text-slate-700 animate-in fade-in">
                      <span className="flex items-center gap-1.5 text-slate-500"><CheckCircle2 size={14} className="text-emerald-500"/> Status Pembayaran:</span>
                      <span className="font-semibold text-emerald-700 text-xs bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">Pas / Lunas</span>
                    </div>
                  );
                }
                return null;
              })()}

              <button
                type="button"
                onClick={() => {
                  const kasirAcc = cashflowAccounts.find(a => a.text_1.toLowerCase().includes('kasir') || a.text_1.toLowerCase().includes('cash')) || cashflowAccounts[0];
                  setFormBayar(prev => {
                    const sumOther = prev.cashflowList.reduce((acc, curr, i) => i !== 0 ? acc + (curr.nominal || 0) : acc, 0);
                    const remaining = Math.max(0, grandTotal - sumOther);
                    const newList = prev.cashflowList.length > 0
                      ? prev.cashflowList.map((row, i) => i === 0 ? { ...row, nominal: remaining, accountId: row.accountId || (kasirAcc ? kasirAcc.id : '') } : row)
                      : [{ id: '', created_at: '', accountId: kasirAcc ? kasirAcc.id : '', nominal: remaining }];
                    return {
                      ...prev,
                      payment: 'Tunai',
                      nominalBayar: grandTotal,
                      cashflowList: newList
                    };
                  });
                }}
                className="pos-action w-full bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                title="Auto Lunas (Isi Uang Pas & Akun Kas Kasir)"
              >
                <Zap size={16} fill="currentColor" /> Uang Pas (Auto Lunas)
              </button>
            </div>

            {formBayar.payment === 'Tempo' && (
              <div className="animate-in fade-in zoom-in duration-300 bg-rose-50 p-3 rounded-2xl border border-rose-200">
                <label className="text-[10px] md:text-[11px] font-black text-rose-500 uppercase tracking-wider ml-1 flex items-center gap-1.5"><Calendar size={14}/> Tanggal Jatuh Tempo</label>
                <input
                  type="date"
                  value={formBayar.tempoDate}
                  data-field="tempoDate"
                  onChange={e => { setFormBayar({ ...formBayar, tempoDate: e.target.value }); clearFieldError('tempoDate'); }}
                  className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold text-slate-700 bg-white border border-rose-200 rounded-xl focus:border-rose-400 outline-none transition-all"
                />
                <FieldError message={fieldErrors.tempoDate} />
              </div>
            )}

            {isOnlinePerson && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50 p-3 rounded-2xl border border-amber-200 animate-in fade-in">
                <div>
                  <label className="text-[10px] font-black text-amber-600 uppercase ml-1 flex items-center gap-1.5"><ShoppingBag size={12}/> Platform</label>
                  <input
                    list="marketplaceOptions"
                    placeholder="Shopee/Tokped"
                    value={formBayar.marketplace}
                    data-field="marketplace"
                    onChange={e => { setFormBayar({ ...formBayar, marketplace: e.target.value }); clearFieldError('marketplace'); }}
                    className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold bg-white border border-amber-200 focus:border-amber-400 rounded-xl outline-none"
                  />
                  <FieldError message={fieldErrors.marketplace} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-amber-600 uppercase ml-1">Biaya admin (−)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formBayar.adminFee}
                    data-field="adminFee"
                    onChange={e => { setFormBayar({ ...formBayar, adminFee: Number(e.target.value) }); clearFieldError('adminFee'); }}
                    className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold bg-white border border-amber-200 focus:border-amber-400 rounded-xl outline-none"
                  />
                  <FieldError message={fieldErrors.adminFee} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-amber-600 uppercase ml-1">Cashback (+)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formBayar.cashback}
                    onChange={e => setFormBayar({ ...formBayar, cashback: Number(e.target.value) })}
                    className="w-full mt-2 p-2.5 text-xs md:text-sm font-semibold bg-white border border-amber-200 focus:border-amber-400 rounded-xl outline-none"
                  />
                </div>
              </div>
            )}
          </section>

          <section hidden={cartTab !== 'notes'} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><FileText size={14}/> Catatan nota</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Garansi 1 Minggu..."
                  value={formBayar.noteMenu}
                  data-field="note"
                  onChange={e => { setFormBayar({ ...formBayar, noteMenu: e.target.value }); clearFieldError('note'); }}
                  className={`w-full mt-2 p-2.5 text-xs md:text-sm font-medium text-slate-700 bg-white border ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all`}
                />
                <FieldError message={fieldErrors.note} />
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <label className={`text-[10px] md:text-[11px] font-black ${activeTheme.text} uppercase tracking-wider ml-1 flex items-center gap-1.5`}><EyeOff size={14}/> Catatan kas (internal)</label>
                <textarea
                  rows={3}
                  placeholder="Informasi kasir (tidak di-print)..."
                  value={formBayar.note}
                  onChange={e => setFormBayar({ ...formBayar, note: e.target.value })}
                  className={`w-full mt-2 p-2.5 text-xs md:text-sm font-medium text-slate-700 bg-white border ${activeTheme.border} rounded-xl ${activeTheme.focusRing} outline-none transition-all`}
                />
              </div>
            </div>

            <div className={`${activeTheme.light} p-5 rounded-3xl border-2 ${activeTheme.border} space-y-4 shadow-sm`}>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <label className={`text-[11px] md:text-xs font-black ${activeTheme.text} uppercase tracking-wider flex items-center gap-2`}>
                  <ImagePlus size={16} />
                  Lampiran Media / Bukti
                  {selectedMenu.toLowerCase().includes('pembelian') && (
                    <span className="text-rose-500 bg-rose-100 px-2 py-0.5 rounded text-[9px] ml-1">Untuk status lunas</span>
                  )}
                </label>

                <label className={`cursor-pointer pos-action bg-white ${activeTheme.text} border ${activeTheme.border}`}>
                  <Upload size={14}/> Tambah file
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setMenuFiles(prev => [...prev, ...files]);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {menuPreviewUrls.length === 0 && existingMenuFiles.length === 0 ? (
                <div className={`text-center py-5 rounded-2xl border border-dashed ${activeTheme.border} bg-white/60`}>
                  <p className={`text-xs font-semibold ${activeTheme.text} opacity-70`}>
                    Belum ada file media yang dilampirkan
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {editSession?.isEditing && existingMenuFiles.map((file, idx) => {
                    const existingUrl = existingUrls[idx];
                    return (
                    <div key={`existing-${idx}`} className="relative group rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-md aspect-square bg-slate-100">
                      {isVideo(file.name) ? (
                        <video src={existingUrl} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={existingUrl} alt={`existing-${idx}`} className="w-full h-full object-cover" />
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(existingUrl, '_blank')}
                          className="pos-action bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                          title="Lihat file"
                        >
                          <Eye size={16} /> Lihat
                        </button>
                      </div>

                      <span className="absolute top-1.5 left-1.5 text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded-md">Tersimpan</span>

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2 text-white text-[9px] truncate font-bold">
                        {file.name}
                      </div>
                    </div>
                  );
                  })}

                  {menuPreviewUrls.map((url, idx) => (
                    <div key={`new-${idx}`} className="relative group rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                      {isVideo(menuFiles[idx]?.name) ? (
                        <video src={url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(url, '_blank')}
                          className="pos-action bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                          title="Lihat file di tab baru"
                        >
                          <Eye size={16} /> Lihat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuFiles(prev => prev.filter((_, i) => i !== idx));
                            URL.revokeObjectURL(url);
                          }}
                          className="pos-action bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg"
                          title="Hapus file"
                        >
                          <Trash2 size={16} /> Hapus
                        </button>
                      </div>

                      <span className="absolute top-1.5 left-1.5 text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5 rounded-md">Belum disimpan</span>

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-2 px-2 text-white text-[9px] truncate font-bold">
                        {menuFiles[idx]?.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {menuFiles.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-black/5">
                  <span className={`text-[11px] font-black ${activeTheme.text}`}>
                    {menuFiles.length} file baru dilampirkan
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      menuPreviewUrls.forEach(url => URL.revokeObjectURL(url));
                      setMenuFiles([]);
                    }}
                    className="text-[10px] font-black text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={14}/> Hapus file baru
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
        <footer className="pos-modal-footer">
          <div>
            <span className="text-xs text-slate-500">Total tagihan</span>
            <p className={`text-xl font-bold tabular-nums ${activeTheme.text}`}>{formatRupiah(grandTotal)}</p>
            <small className="text-slate-500">{cart.length} item · Dibayar {formatRupiah(formBayar.cashflowList.reduce((sum,cf) => sum+(cf.nominal||0),0))}</small>
          </div>
          <button type="button" disabled={isProcessing} onClick={handleCheckoutValidation} className={`pos-action ${activeTheme.main} text-white`}>
            <CheckCircle2 size={16}/>{isProcessing ? 'Menyimpan…' : 'Periksa transaksi'}
          </button>
        </footer>
      </div>
    </Modal>
  );
};
