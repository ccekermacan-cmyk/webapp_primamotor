import React, { useState, useMemo } from 'react';
import Modal from '../modal';
import DeleteAccess from '../delete-access';
import SalaryDetail from '../salary/SalaryDetail';
import { formatRupiah, formatAmount } from '../../lib/money';
import { pb } from '../../lib/pocketbase';
import type { HistoryMenu, LogStockDetail, CashflowDetail, OngkosDetail, DropdownItem } from '../../types/pos';
import { 
  Info, Package, Wallet, User, Users, Calendar, ShoppingBag, 
  FileText, ImagePlus, ExternalLink, Search, X, Box, Wrench, 
  Trash2, Edit, Printer, Share2 
} from 'lucide-react';

interface PosDetailModalProps {
  showDetailHistory: HistoryMenu | null;
  onClose: () => void;
  userLevel: string;
  operatorName: string;
  historyItems: LogStockDetail[];
  historyCashflow: CashflowDetail[];
  historyOngkos: OngkosDetail[];
  historyGajiSubItems: any[];
  cashflowAccounts: DropdownItem[];
  isDeleting: boolean;
  confirmAction: (title: string, desc: string, onConfirm: () => void) => void;
  handleDeleteHistory: (item: HistoryMenu) => void;
  openQuickSettle: (item: HistoryMenu) => void;
  handleEditGajiFromHistory: (item: HistoryMenu) => void;
  handleEditHistoryToCart: (item: HistoryMenu) => void;
  handleDetailPrintFn: () => void;
  detailPrintRef: React.RefObject<HTMLDivElement | null>;
  getThemeConfig: (menu: string) => any;
  getFullLabel: (p: any) => string;
  getPersonDisplayText: (personId: string | undefined | null, fallback?: string) => string;
  formatLocalDateTime: (isoString: string | undefined) => string;
  fetchFileWithAuth: (url: string) => Promise<string>;
  setDialog: React.Dispatch<React.SetStateAction<{
    show: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>>;
}

export const PosDetailModal: React.FC<PosDetailModalProps> = ({
  showDetailHistory,
  onClose,
  userLevel,
  operatorName,
  historyItems,
  historyCashflow,
  historyOngkos,
  historyGajiSubItems,
  cashflowAccounts,
  isDeleting,
  confirmAction,
  handleDeleteHistory,
  openQuickSettle,
  handleEditGajiFromHistory,
  handleEditHistoryToCart,
  handleDetailPrintFn,
  detailPrintRef,
  getThemeConfig,
  getFullLabel,
  getPersonDisplayText,
  formatLocalDateTime,
  fetchFileWithAuth,
  setDialog,
}) => {
  const [activeTab, setActiveTab] = useState<'detail' | 'items' | 'payments'>('detail');
  const [searchItemTerm, setSearchItemTerm] = useState('');
  const [fileBlobUrls, setFileBlobUrls] = useState<Record<string, string>>({});

  const filteredHistoryItems = useMemo(() => {
    if (!searchItemTerm.trim()) return historyItems;
    const term = searchItemTerm.toLowerCase();
    return historyItems.filter(item => {
      const label = getFullLabel(item.expand?.item_baru).toLowerCase();
      const code = (item.item || '').toLowerCase();
      return label.includes(term) || code.includes(term);
    });
  }, [historyItems, searchItemTerm, getFullLabel]);

  const totalLabaKotor = useMemo(() => {
    if (historyItems.length === 0) return 0;
    return historyItems.reduce((acc, item) => {
      const modal = item.price_2 || 0;
      const jual = (item.price_1 || 0) * (item.qty || 0);
      return acc + (jual - modal);
    }, 0);
  }, [historyItems]);

  const totalTransaksi = useMemo(() => {
    return historyItems.reduce((acc, item) => acc + ((item.price_1 || 0) * (item.qty || 0)), 0);
  }, [historyItems]);

  // Helper breakdown komponen gaji
  const getSalaryDetails = (gaji: any) => {
    const qty = Number(gaji.qty) || 1;
    const pokok = Number(gaji.number_1 || gaji.pokok || 0);
    const tunjangan = Number(gaji.number_2 || gaji.tunjangan || 0);
    const bonus_1 = Number(gaji.bonus_1 || 0);
    const bonus_2 = Number(gaji.bonus_2 || 0);
    const bonus_3 = Number(gaji.bonus_3 || 0);
    const bonus_4 = Number(gaji.bonus_4 || 0);
    const program = Number(gaji.program || 0);
    const lembur = Number(gaji.lembur || 0);

    const nilaiDasar = qty > 0 ? (pokok + tunjangan) / qty : 0;

    const t1 = { pokok, tunjangan, bonus_1, bonus_2, bonus_3, bonus_4, program, lembur };
    const total1 = Object.values(t1).reduce((sum, val) => sum + val, 0) || Number(gaji.total || 0);

    const t2 = {
      alfa: nilaiDasar * Number(gaji.alfa || 0),
      setengah_hari: (nilaiDasar / 2) * Number(gaji.setengah_hari || 0),
      sakit: (nilaiDasar * 0.9) * Number(gaji.sakit || 0),
      telat: Number(gaji.telat || 0) * 1000, 
    };
    const total2 = Object.values(t2).reduce((sum, val) => sum + val, 0);

    const t3 = {
      bpjs: Number(gaji.bpjs || 0),
      bon_diambil: Number(gaji.bon_diambil || 0),
      bon_dibayar: Number(gaji.bon_dibayar || 0),
    };
    const total3 = Object.values(t3).reduce((sum, val) => sum + val, 0);

    const grandTotal = Number(gaji.total) || (total1 - total2 - total3);
    const note = gaji.text || gaji.note || 'Slip Gaji Karyawan';
    const date = gaji.created_at || gaji.date || '';

    return { t1, total1, t2, total2, t3, total3, grandTotal, qty, note, date };
  };

  const renderFormattedNetto = (amount: number, mainTextSize: string = "text-xl sm:text-2xl", textColor: string = "text-emerald-300", rpColor: string = "text-emerald-400") => {
    const formatted = formatAmount(amount);
    return (
      <span className="inline-flex items-baseline font-black">
        <span className={`text-[10px] sm:text-xs font-extrabold ${rpColor} mr-1 uppercase`}>Rp</span>
        <span className={`${mainTextSize} ${textColor}`}>{formatted}</span>
      </span>
    );
  };

  const isGaji = showDetailHistory?.jenis?.toLowerCase().includes('gaji') ?? false;

  return (
    <>
      {/* Hidden printable thermal 58mm for detail transaction */}
      <div ref={detailPrintRef} className="hidden">
        {showDetailHistory && (
          <div style={{fontFamily:'monospace',fontSize:'11px',width:'280px',color:'#1e293b'}}>
            <div style={{textAlign:'center',borderBottom:'2px dashed #cbd5e1',padding:'12px 8px'}}>
              <h3 style={{fontWeight:900,fontSize:'14px',margin:'0 0 2px'}}>PRIMA MOTOR GLADAG</h3>
              <p style={{fontSize:'9px',margin:'1px 0'}}>Jl. Raya Gladag, Rogojampi</p>
              <p style={{fontSize:'9px',margin:'1px 0'}}>Banyuwangi - Jawa Timur</p>
              <p style={{fontSize:'10px',fontWeight:900,margin:'4px 0 0'}}>{showDetailHistory.jenis?.toUpperCase()}</p>
            </div>
            <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Nota:</span> <span>{showDetailHistory.ref || showDetailHistory.id}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Waktu:</span> <span>{formatLocalDateTime(showDetailHistory.created_at)}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Cust:</span> <span>{getPersonDisplayText(showDetailHistory.person, 'Umum')}</span></p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b'}}>Kasir:</span> <span>{showDetailHistory.operator || operatorName}</span></p>
            </div>
            {historyItems.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                {historyItems.map((item, i) => (
                  <div key={i} style={{marginBottom:'4px'}}>
                    <p style={{fontWeight:700,margin:'1px 0',fontSize:'10px',textTransform:'uppercase'}}>{getFullLabel(item.expand?.item_baru)}</p>
                    <p style={{margin:'1px 0',display:'flex',justifyContent:'space-between',color:'#475569'}}>
                      <span>{item.qty} x {formatRupiah(Number(item.price_1))}</span>
                      <b style={{color:'#1e293b'}}>{formatRupiah(Number(item.price_1 * item.qty))}</b>
                    </p>
                  </div>
                ))}
              </div>
            )}
            {historyCashflow.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                <p style={{fontWeight:900,fontSize:'9px',textAlign:'center',margin:'2px 0',color:'#64748b'}}>-- PEMBAYARAN --</p>
                {historyCashflow.map((cf, i) => (
                  <p key={i} style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}>
                    <span>{cf.mutasi === 'in' ? 'Masuk' : 'Keluar'} ({cashflowAccounts.find(a => a.id === cf.account_1)?.text_1 || 'Acc'})</span>
                    <b>{formatRupiah(Number(cf.nominal))}</b>
                  </p>
                ))}
              </div>
            )}
            {historyOngkos.length > 0 && (
              <div style={{padding:'8px',borderBottom:'2px dashed #cbd5e1',fontSize:'10px'}}>
                <p style={{fontWeight:900,fontSize:'9px',textAlign:'center',margin:'2px 0',color:'#64748b'}}>-- BIAYA SERVIS --</p>
                {historyOngkos.map((o, i) => (
                  <p key={i} style={{margin:'2px 0',display:'flex',justifyContent:'space-between'}}>
                    <span>Mek: {o.person}</span>
                    <b>{formatRupiah(Number(o.ongkos))}</b>
                  </p>
                ))}
              </div>
            )}
            <div style={{padding:'8px',backgroundColor:'#f8fafc',borderBottom:'2px dashed #cbd5e1'}}>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between',fontSize:'12px',fontWeight:900}}>
                <span>TOTAL:</span><span>{formatRupiah(Number(showDetailHistory.total))}</span>
              </p>
              <p style={{margin:'2px 0',display:'flex',justifyContent:'space-between',color:'#475569',fontSize:'10px'}}>
                <span>DIBAYAR:</span><span>{formatRupiah(Number(showDetailHistory.dibayar))}</span>
              </p>
            </div>
            <div style={{textAlign:'center',padding:'12px 8px'}}>
              <p style={{fontWeight:900,fontSize:'10px',margin:'2px 0'}}>TERIMA KASIH</p>
              <p style={{fontSize:'8px',color:'#64748b',margin:'2px 0'}}>Barang yang dibeli tidak dapat ditukar</p>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!showDetailHistory}
        onClose={onClose}
        maxWidth="max-w-2xl" compact
        title={isGaji ? "Rincian Perangkum & Slip Gaji Karyawan" : "Detail transaksi"}
      >
        {showDetailHistory && (
          <div className="pos-modal-layout pos-detail-fields">
            {!isGaji && (
              <nav className="pos-modal-tabs" aria-label="Bagian detail transaksi">
                {([
                  { id: 'detail', label: 'Ringkasan', Icon: Info },
                  { id: 'items', label: 'Barang & jasa', Icon: Package },
                  { id: 'payments', label: 'Pembayaran', Icon: Wallet }
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={activeTab === id}
                    onClick={() => setActiveTab(id)}
                    className={activeTab === id ? `${getThemeConfig(showDetailHistory.jenis).light} ${getThemeConfig(showDetailHistory.jenis).text}` : 'text-slate-500'}
                  >
                    <Icon size={16} />{label}
                  </button>
                ))}
              </nav>
            )}

            {/* KONTEN SCROLLABLE */}
            <div className="pos-modal-scroll space-y-4">
              {/* TAB RINGKASAN */}
              {(activeTab === 'detail' || isGaji) && (
                <>
                  {isGaji ? (() => {
                    const sal = getSalaryDetails(showDetailHistory);
                    const grandTotalVal = showDetailHistory.total || sal.grandTotal;

                    return (
                      <div className="space-y-5">
                        <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 p-6 sm:p-8 rounded-[2rem] text-center text-white shadow-2xl relative overflow-hidden border border-emerald-500/30">
                          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 block">
                            PERANGKUM GAJI BATCH (TOTAL NETTO)
                          </span>
                          <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter drop-shadow-md">
                            {renderFormattedNetto(grandTotalVal, "text-3xl sm:text-4xl md:text-5xl", "text-emerald-300", "text-emerald-400")}
                          </div>
                          
                          <div className="mt-5 flex flex-col items-center gap-2">
                            <h4 className="font-black text-white text-base sm:text-lg uppercase tracking-wider bg-white/10 px-4 py-1.5 rounded-2xl backdrop-blur-md border border-white/10">
                              📋 {showDetailHistory.text || 'Gaji Periode'}
                            </h4>
                            <div className="flex flex-wrap justify-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-emerald-200 bg-emerald-950/60 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-500/30">
                                <User size={12}/> Opr: {showDetailHistory.operator || 'System'}
                              </span>
                              <span className="text-[10px] font-black text-emerald-200 bg-emerald-950/60 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-500/30">
                                <Calendar size={12}/> {formatLocalDateTime ? formatLocalDateTime(sal.date) : sal.date}
                              </span>
                              <span className="text-[10px] font-black text-amber-300 bg-amber-950/60 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-amber-500/30">
                                Qty: {showDetailHistory.qty || 1} Hari Kerja / Bulan
                              </span>
                            </div>

                            <div className="mt-3 p-3.5 bg-emerald-950/80 rounded-2xl border border-emerald-500/40 max-w-2xl w-full">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-2 text-center">
                                👥 DAFTAR KARYAWAN PENERIMA GAJI ({(showDetailHistory.person || '').split(',').filter(Boolean).length} PERSON):
                              </span>
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {(showDetailHistory.person || '').split(',').map((pName, pIdx) => {
                                  const trimmed = pName.trim();
                                  if (!trimmed) return null;
                                  return (
                                    <span key={pIdx} className="text-xs font-black text-white bg-emerald-800/90 border border-emerald-400/60 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                                      <span>👤</span> {trimmed}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Users size={16} className="text-emerald-600" /> Rincian Slip Gaji Karyawan ({historyGajiSubItems.length > 0 ? historyGajiSubItems.length : 1} Person)
                          </h4>

                          {historyGajiSubItems.length > 0 ? (
                            historyGajiSubItems.map((gRec, gIdx) => (
                              <SalaryDetail key={gRec.id || gIdx} record={{ ...gRec, qty: showDetailHistory.qty || gRec.qty }} fileUrl={name => pb.files.getUrl(gRec, name)} />
                            ))
                          ) : (
                            <div className="space-y-3">
                              {(showDetailHistory.person || '').split(',').map((pName, pIdx) => {
                                const trimmed = pName.trim();
                                if (!trimmed) return null;
                                return (
                                  <div key={pIdx} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black">
                                        #{pIdx + 1}
                                      </span>
                                      <div>
                                        <h5 className="font-extrabold text-slate-900 text-sm uppercase">👤 {trimmed}</h5>
                                        <span className="text-[10px] text-slate-500 font-bold">Karyawan Penerima Gaji</span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">Status Slip</span>
                                      <span className="text-xs font-black text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-md">
                                        Tercatat di Batch Nota Gaji
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <section className={`rounded-2xl p-4 ${getThemeConfig(showDetailHistory.jenis).light}`}>
                      <div className="flex justify-between items-center gap-2 text-xs">
                        <span className={getThemeConfig(showDetailHistory.jenis).text}>{showDetailHistory.ref || showDetailHistory.id}</span>
                        <span className="rounded-lg bg-white px-2 py-1 text-slate-600">{showDetailHistory.status}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mt-3">{getPersonDisplayText(showDetailHistory.person, 'Pelanggan umum')}</h3>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User size={14}/>{showDetailHistory.operator || 'System'}</span>
                        <span className="flex items-center gap-1"><Calendar size={14}/>{formatLocalDateTime(showDetailHistory.created_at)}</span>
                      </div>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-slate-700 tabular-nums">
                        <div className="col-span-2 sm:col-span-1">
                          <dt className="text-xs">Total tagihan</dt>
                          <dd className={`text-xl font-semibold ${getThemeConfig(showDetailHistory.jenis).text}`}>{formatRupiah(Number(showDetailHistory.total || 0))}</dd>
                        </div>
                        <div>
                          <dt className="text-xs">Dibayar</dt>
                          <dd className="font-semibold">{formatRupiah(Number(showDetailHistory.dibayar || 0))}</dd>
                        </div>
                        <div>
                          <dt className="text-xs">{(showDetailHistory.dibayar || 0) > (showDetailHistory.total || 0) ? 'Kembalian' : 'Sisa tagihan'}</dt>
                          <dd className="font-semibold">{formatRupiah(Math.abs((showDetailHistory.total || 0) - (showDetailHistory.dibayar || 0)))}</dd>
                        </div>
                      </dl>
                    </section>
                  )}

                  {!isGaji && showDetailHistory.marketplace && (
                    <>
                      <div className="mt-4 p-3 bg-slate-800 rounded-xl text-xs text-white font-bold flex flex-wrap gap-4 justify-center relative z-10 border border-white/10">
                        <span className="flex items-center gap-1"><ShoppingBag size={12}/> {showDetailHistory.marketplace}</span>
                        <span className="text-rose-200">Admin: -Rp {showDetailHistory.admin}</span>
                        <span className="text-emerald-200">CB: +Rp {showDetailHistory.cashback}</span>
                      </div>

                      {userLevel === '1' && showDetailHistory.jenis?.toLowerCase() !== 'pembelian' && (
                        <div className="mt-6 pt-5 border-t border-white/20 flex justify-around relative z-10">
                          <div className="text-center bg-black/20 flex-1 rounded-l-xl p-2 border-r border-white/10">
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Laba Kotor</p>
                            <p className="font-black text-emerald-300 text-lg md:text-xl drop-shadow-sm mt-1">
                              {formatRupiah(totalLabaKotor)}
                            </p>
                          </div>
                          <div className="text-center bg-black/20 flex-1 rounded-r-xl p-2">
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Persentase Margin</p>
                            <p className="font-black text-white text-lg md:text-xl mt-1">
                              {(() => {
                                const totalOngkosHistory = historyOngkos.reduce((sum, o) => sum + o.ongkos, 0);
                                const menuGrandTotal = totalTransaksi + totalOngkosHistory - (showDetailHistory.admin || 0) + (showDetailHistory.cashback || 0);
                                return menuGrandTotal > 0 ? ((totalLabaKotor / menuGrandTotal) * 100).toFixed(1) : 0;
                              })()}%
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!isGaji && (
                    <>
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold flex items-center gap-2"><FileText size={16}/> Catatan nota</h3>
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{showDetailHistory.text || 'Tidak ada catatan nota.'}</p>
                      </section>

                      {/* SECTION: Lampiran Media */}
                      {showDetailHistory.file && showDetailHistory.file.length > 0 && (
                        <div id="section-media" className="scroll-mt-16">
                          <div className="bg-slate-50 p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                            <p className={`font-black text-[11px] ${getThemeConfig(showDetailHistory.jenis).text} uppercase border-b-2 border-slate-200 pb-3 mb-3 flex items-center gap-2`}>
                              <ImagePlus size={16}/> Lampiran Media Nota
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {showDetailHistory.file.map((f, i) => {
                                const fileUrl = pb.files.getUrl(showDetailHistory, f);
                                const blobUrl = fileBlobUrls[f];
                                if (!blobUrl) {
                                  fetchFileWithAuth(fileUrl).then(url => setFileBlobUrls(prev => ({ ...prev, [f]: url }))).catch(err => console.warn(`Gagal memuat file ${f}:`, err));
                                }
                                return (
                                  <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square bg-slate-100">
                                    {blobUrl ? (
                                      f.match(/\.(mp4|webm|ogg)$/i) ? (
                                        <video src={blobUrl} className="w-full h-full object-cover" />
                                      ) : (
                                        <img src={blobUrl} alt={`Lampiran ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                      )
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-slate-200 animate-pulse">
                                        <span className="text-xs text-slate-500">Loading...</span>
                                      </div>
                                    )}
                                    <a href={fileUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                      <ExternalLink size={24} className="text-white drop-shadow-lg scale-75 group-hover:scale-100 transition-transform" />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* TAB LIST ITEM */}
              {activeTab === 'items' && !isGaji && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                    <Search size={16} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari produk di nota ini..."
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder-slate-400"
                      value={searchItemTerm}
                      onChange={(e) => setSearchItemTerm(e.target.value)}
                    />
                    {searchItemTerm && (
                      <button onClick={() => setSearchItemTerm('')} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    )}
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                      {filteredHistoryItems.length} / {historyItems.length}
                    </span>
                  </div>

                  <div id="section-items" className="scroll-mt-16">
                    <div className="space-y-3">
                      <p className={`text-[11px] font-black ${getThemeConfig(showDetailHistory.jenis).text} uppercase tracking-widest ml-1 flex items-center gap-2`}>
                        <Box size={16}/> Rincian Item (Log Stok Terjual)
                      </p>
                      <div className="border-2 border-slate-200 rounded-[1.5rem] bg-white divide-y divide-slate-100 text-xs shadow-sm overflow-hidden">
                        {filteredHistoryItems.length === 0 ? (
                          <div className="p-8 text-center flex flex-col items-center">
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Tidak ada barang yang cocok.</p>
                          </div>
                        ) : (
                          filteredHistoryItems.map(item => (
                            <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <p className="font-black text-slate-800 text-sm md:text-base leading-snug">
                                    {getFullLabel(item.expand?.item_baru)}
                                  </p>
                                  <p className="text-[11px] font-bold text-slate-500 mt-1.5">
                                    Qty: {item.qty} @ {formatRupiah(item.price_1 ?? 0)}
                                  </p>
                                </div>
                                <p className="font-black text-slate-900 text-sm bg-slate-100 px-3 py-1 rounded-lg shrink-0">
                                  {formatRupiah((item.price_1 || 0) * (item.qty || 0))}
                                </p>
                              </div>

                              {userLevel === '1' && (
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] md:text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-3 shadow-inner">
                                  <p className="flex justify-between"><span className="font-bold">ID:</span> <span className="font-mono text-slate-800">{item.id}</span></p>
                                  <p className="flex justify-between"><span className="font-bold">Kode:</span> <span className="font-mono text-slate-800">{item.item}</span></p>
                                  <p className="flex justify-between"><span className="font-bold">Qty:</span> <span className="font-black text-slate-800 bg-slate-200 px-1.5 rounded">{item.qty}</span></p>
                                  <p className="flex justify-between"><span className="font-bold">In / Out:</span> <span className="font-black text-slate-800">{item.boolean}</span></p>
                                  <p className="flex justify-between"><span className="font-bold">Jual:</span> <span className="font-black text-slate-800">{formatRupiah(item.price_1 ?? 0)}</span></p>
                                  <p className="flex justify-between"><span className="font-bold">Modal:</span> <span className="font-black text-slate-800">{formatRupiah(item.price_2 ?? 0)}</span></p>
                                  {(['1', '2', '5'].includes(userLevel)) && (
                                    <>
                                      <p className="flex justify-between col-span-2 border-t border-slate-200 pt-2 mt-1"><span className="font-bold">Stok Awal:</span> <span className="font-black text-emerald-700">{item.stok_awal ?? '-'}</span></p>
                                      <p className="flex justify-between col-span-2"><span className="font-bold">Stok Akhir:</span> <span className="font-black text-emerald-700">{item.stok_akhir ?? '-'}</span></p>
                                    </>
                                  )}
                                  {(() => {
                                    const laba = ((item.price_1 || 0) * (item.qty || 0)) - (item.price_2 || 0);
                                    const totalJual = (item.price_1 || 0) * (item.qty || 0);
                                    const pct = totalJual > 0 ? (laba / totalJual) * 100 : 0;
                                    const isGreen = laba >= 0;
                                    const pctDisplay = Math.abs(pct).toFixed(1);

                                    return (
                                      <div className="col-span-2 border-t-2 border-dashed border-slate-200 pt-3 mt-2 flex justify-between items-center bg-white p-2 rounded-lg">
                                        <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Laba Margin Analitik:</p>
                                        <p className={`font-black text-sm flex items-center gap-2 ${isGreen ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          Rp {formatAmount(laba)}
                                          <span className={`text-[10px] px-2 py-0.5 rounded-md shadow-sm border ${isGreen ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-rose-100 border-rose-200 text-rose-700'}`}>
                                            {pct >= 0 ? `+${pctDisplay}%` : `${pctDisplay}%`}
                                          </span>
                                        </p>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {historyOngkos.length > 0 && (
                    <div id="section-ongkos" className="scroll-mt-16">
                      <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 blur-3xl opacity-5 rounded-full" />
                        <p className="font-black text-amber-500 text-[11px] uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-amber-100 pb-2">
                          <Wrench size={14}/> Potongan Mekanik
                        </p>
                        <div className="space-y-2 font-bold text-slate-600 text-[11px]">
                          {historyOngkos.map(fee => (
                            <div key={fee.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <span className="font-black text-slate-700 uppercase flex items-center gap-2">
                                <User size={12} className="text-slate-400"/> {fee.person}
                              </span>
                              <span className="font-black text-emerald-600 text-sm tracking-tight">{formatRupiah(fee.ongkos ?? 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB PEMBAYARAN & JURNAL KAS */}
              {activeTab === 'payments' && !isGaji && (
                <div id="section-cashflow" className="scroll-mt-16">
                  <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 blur-3xl opacity-5 rounded-full" />
                    <p className="font-black text-blue-500 text-[11px] uppercase tracking-widest flex items-center gap-1.5 mb-3 border-b border-blue-100 pb-2 relative z-10">
                      <Wallet size={14}/> Rekaman Jurnal Kas
                    </p>
                    {historyCashflow.length > 0 ? (
                      <div className="space-y-3 relative z-10">
                        {historyCashflow.map((cf, idx) => {
                          const accName = cashflowAccounts.find(a => a.id === cf.account_1)?.text_1 || cf.account_1;
                          return (
                            <div key={cf.id || idx} className="space-y-2 font-bold text-slate-600 text-[11px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="flex justify-between"><span>Nominal:</span> <span className="font-black text-blue-600 text-sm">{formatRupiah(cf.nominal ?? 0)}</span></p>
                              <p className="flex justify-between"><span>Mutasi:</span> <span className="uppercase text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{cf.mutasi}</span></p>
                              <p className="flex justify-between items-center gap-2"><span>Account:</span> <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-right truncate">{accName}</span></p>
                              {(['1', '2', '5'].includes(userLevel)) && (cf.saldo_awal !== undefined || cf.saldo_akhir !== undefined) && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                  <p className="flex justify-between text-[10px]"><span className="font-bold text-emerald-700">Saldo Awal:</span> <span className="font-black">{formatRupiah(Number(cf.saldo_awal || 0))}</span></p>
                                  <p className="flex justify-between text-[10px]"><span className="font-bold text-emerald-700">Saldo Akhir:</span> <span className="font-black">{formatRupiah(Number(cf.saldo_akhir || 0))}</span></p>
                                </div>
                              )}
                              {cf.note && (
                                <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-500 italic font-medium leading-relaxed">
                                  " {cf.note} "
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic mt-2 text-[10px] relative z-10">Data jurnal kas tidak ditemukan atau sedang diselaraskan...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER TOMBOL (STICKY) */}
            <div className="pos-modal-footer">
              <div className="flex flex-wrap gap-3 pb-1">
                {(() => {
                  const isStatusBelum = showDetailHistory?.status === 'belum';
                  const bolehDelete = (userLevel === '1' || userLevel === '5') || (isStatusBelum && ['1','2','3','4','5','6','7'].includes(userLevel));
                  return bolehDelete && (
                    <DeleteAccess collection="menu" id={showDetailHistory!.id}>
                      <button
                        onClick={() => !isDeleting && confirmAction(
                          'Hapus Permanen',
                          'Peringatan: Menghapus nota ini akan mengembalikan seluruh stok barang dan menghapus jejak jurnal kas terkait. Lanjutkan?',
                          () => handleDeleteHistory(showDetailHistory!)
                        )}
                        disabled={isDeleting}
                        className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-colors flex justify-center items-center gap-2 group ${
                          isDeleting
                            ? 'bg-rose-100 text-rose-400 border-rose-200 cursor-not-allowed opacity-70'
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border-rose-100'
                        }`}
                        title={isDeleting ? 'Sedang menghapus...' : 'Hapus Nota'}
                      >
                        {isDeleting ? (
                          <>
                            <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            <span className="text-[10px] font-black tracking-wider">MENGHAPUS...</span>
                          </>
                        ) : (
                          <><Trash2 size={16}/> Hapus</>
                        )}
                      </button>
                    </DeleteAccess>
                  );
                })()}

                {showDetailHistory && showDetailHistory.status !== 'lunas' && !isGaji && (
                  <button
                    type="button"
                    onClick={() => openQuickSettle(showDetailHistory)}
                    disabled={isDeleting}
                    className={`pos-action text-white ${getThemeConfig(showDetailHistory.jenis).main}`}
                    title="Pelunasan Pembayaran Cepat (Tanpa Ubah Keranjang)"
                  >
                    <Wallet size={18} />
                    <span>Pelunasan</span>
                  </button>
                )}

                {pb.authStore.isValid && (
                  <button
                    onClick={() => {
                      if (isDeleting || !showDetailHistory) return;
                      if (isGaji) {
                        handleEditGajiFromHistory(showDetailHistory);
                      } else {
                        handleEditHistoryToCart(showDetailHistory);
                      }
                    }}
                    disabled={isDeleting}
                    className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-colors flex justify-center items-center gap-1 group ${
                      isDeleting ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border-blue-100'
                    }`}
                    title={isDeleting ? 'Tunggu proses selesai' : (isGaji ? 'Edit Slip Gaji' : 'Revisi Nota')}
                  >
                    <Edit size={20} className="group-hover:scale-110 transition-transform"/>
                    <span>Edit</span>
                  </button>
                )}

                <button
                  onClick={() => !isDeleting && handleDetailPrintFn && handleDetailPrintFn()}
                  disabled={isDeleting}
                  className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-all flex justify-center items-center group ${
                    isDeleting ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-emerald-200 hover:border-emerald-600'
                  }`}
                  title={isDeleting ? 'Tunggu proses selesai' : 'Cetak Nota 58mm'}
                >
                  <Printer size={16} /> Cetak
                </button>

                {showDetailHistory?.status === 'lunas' && (
                  <button
                    onClick={() => {
                      if (isDeleting) return;
                      const detail = showDetailHistory;
                      if (!detail) return;
                      const items = historyItems.map(h => 
                        `${getFullLabel(h.expand?.item_baru)} | Qty: ${h.qty} @ Rp ${formatAmount(h.price_1)} = Rp ${formatAmount(Number(h.price_1) * h.qty)}`
                      ).join('\n');
                      const text = `*${detail.jenis?.toUpperCase()}*\nID: ${detail.ref || detail.id}\n${formatLocalDateTime(detail.created_at)}\nPelanggan: ${getPersonDisplayText(detail.person, 'Umum')}\nTotal: Rp ${formatAmount(detail.total)}\nDibayar: Rp ${formatAmount(detail.dibayar)}\n\nItems:\n${items}`;
                      navigator.clipboard.writeText(text).then(() => {
                        setDialog({ show: true, title: 'Berhasil', message: 'Detail transaksi disalin ke clipboard!', type: 'alert' });
                      }).catch(() => alert('Gagal menyalin ke clipboard'));
                    }}
                    disabled={isDeleting}
                    className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border transition-colors flex justify-center items-center group ${
                      isDeleting ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50' : 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border-amber-100'
                    }`}
                    title={isDeleting ? 'Tunggu proses selesai' : 'Share'}
                  >
                    <Share2 size={16} /> Bagikan
                  </button>
                )}

                <button
                  onClick={() => !isDeleting && onClose()}
                  disabled={isDeleting}
                  className={`h-14 min-w-[6rem] flex-[2] rounded-2xl transition-colors flex items-center justify-center font-bold text-xs tracking-wider ${
                    isDeleting ? 'bg-slate-400 text-white cursor-not-allowed opacity-60' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <X size={16}/>{isDeleting ? 'Tunggu…' : 'Tutup'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
