import type PocketBase from 'pocketbase';
import { deleteFinancialRecord } from './api/laravel';
import { createFinancialBatch } from './api/financialBatch';
import { settlementRemaining, isIncomeTransaction } from '../lib/posTransactions';
import { getLocalDatetimeInput } from '../lib/posFormatters';
import { formatAmount } from '../lib/money';
import type { HistoryMenu, DropdownItem } from '../types/pos';

export interface QuickSettleState {
  show: boolean;
  menu: HistoryMenu | null;
  nominal: number;
  accountId: string;
  note: string;
  createdAt: string;
  settleFiles: File[];
}

export interface DeleteHistoryParams {
  menuItem: HistoryMenu;
  submitLockRef: React.MutableRefObject<boolean>;
  setIsDeleting: (v: boolean) => void;
  setIsProcessing: (v: boolean) => void;
  editSession: { menuId: string } | null;
  setEditSession: (v: any) => void;
  setEditOldItems: (v: any[]) => void;
  setCart: (v: any[]) => void;
  setMenuFiles: (v: any[]) => void;
  setExistingMenuFiles: (v: any[]) => void;
  fetchData: () => void;
  setShowDetailHistory: (v: HistoryMenu | null) => void;
  setDialog: (v: any) => void;
}

export async function openQuickSettleTransaction(
  pb: PocketBase,
  menu: HistoryMenu,
  cashflowAccounts: DropdownItem[],
  setCashflowAccounts: (accs: DropdownItem[]) => void,
  setQuickSettleData: (v: QuickSettleState) => void,
  e?: React.MouseEvent
): Promise<void> {
  if (e) e.stopPropagation();
  const sisa = Math.max(0, (menu.total || 0) - (menu.dibayar || 0));

  let currentAccounts = cashflowAccounts;
  try {
    currentAccounts = await pb.collection('dropdown').getFullList<DropdownItem>({
      filter: `jenis ~ "cashflow account"`,
      sort: 'text_1',
      $autoCancel: false
    });
    setCashflowAccounts(currentAccounts);
  } catch (err) {
    console.warn("Gagal merefresh akun kas untuk pelunasan cepat:", err);
  }

  const defaultAcc = currentAccounts.length > 0 ? currentAccounts[0].id : '';
  setQuickSettleData({
    show: true,
    menu,
    nominal: sisa,
    accountId: defaultAcc,
    note: `Pelunasan Nota ${menu.ref || menu.id}`,
    createdAt: getLocalDatetimeInput(),
    settleFiles: []
  });
}

export async function deleteHistoryTransaction(params: DeleteHistoryParams): Promise<void> {
  const {
    menuItem, submitLockRef, setIsDeleting, setIsProcessing,
    editSession, setEditSession, setEditOldItems, setCart,
    setMenuFiles, setExistingMenuFiles, fetchData,
    setShowDetailHistory, setDialog
  } = params;

  if (submitLockRef.current) return;
  submitLockRef.current = true;
  setIsDeleting(true);

  const blockUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', blockUnload);

  try {
    setIsProcessing(true);
    await deleteFinancialRecord('menu', menuItem.id);
    if (editSession?.menuId === menuItem.id) {
      setEditSession(null);
      setEditOldItems([]);
      setCart([]);
      setMenuFiles([]);
      setExistingMenuFiles([]);
    }
    fetchData();
    setShowDetailHistory(null);
    setDialog({ show: true, title: 'Sukses Hapus', message: 'Data transaksi berhasil dihapus. Stok produk dan data kas telah dikembalikan.', type: 'alert' });
  } catch (e: any) {
    console.error(e);
    setDialog({ show: true, title: 'Gagal Hapus', message: 'Gagal menghapus data transaksi: ' + (e.message || e), type: 'alert' });
  } finally {
    window.removeEventListener('beforeunload', blockUnload);
    submitLockRef.current = false;
    setIsDeleting(false);
    setIsProcessing(false);
  }
}

export interface ExecuteQuickSettleParams {
  pb: PocketBase;
  quickSettleData: QuickSettleState;
  submitLockRef: React.MutableRefObject<boolean>;
  setIsProcessing: (v: boolean) => void;
  setProcessingMsg: (v: string) => void;
  cashflowAccounts: DropdownItem[];
  operatorName: string;
  setQuickSettleData: (v: QuickSettleState | null) => void;
  setCashflowAccounts: (v: DropdownItem[]) => void;
  showDetailHistory: HistoryMenu | null;
  setShowDetailHistory: React.Dispatch<React.SetStateAction<HistoryMenu | null>>;
  fetchData: () => void;
  setDialog: (v: any) => void;
}

export async function executeQuickSettleTransaction(params: ExecuteQuickSettleParams): Promise<void> {
  const {
    pb, quickSettleData, submitLockRef, setIsProcessing,
    setProcessingMsg, cashflowAccounts, operatorName,
    setQuickSettleData, setCashflowAccounts,
    showDetailHistory, setShowDetailHistory, fetchData, setDialog
  } = params;

  if (!quickSettleData || !quickSettleData.menu || submitLockRef.current) return;
  const { menu: displayedMenu, nominal, accountId, note, createdAt } = quickSettleData;
  if (!accountId) {
    setDialog({ show: true, title: 'Validasi Gagal', message: 'Pilih akun kas penerima pembayaran!', type: 'alert' });
    return;
  }
  if (!Number.isFinite(Number(nominal)) || Number(nominal) <= 0) {
    setDialog({ show: true, title: 'Validasi Gagal', message: 'Nominal pelunasan harus lebih besar dari 0!', type: 'alert' });
    return;
  }

  submitLockRef.current = true;
  setIsProcessing(true);
  setProcessingMsg('Menyimpan pelunasan atomic batch...');

  try {
    const [menu, personRec] = await Promise.all([
      pb.collection('menu').getOne<HistoryMenu>(displayedMenu.id, { $autoCancel: false }),
      displayedMenu.person && displayedMenu.person !== 'umum1'
        ? pb.collection('dropdown').getFirstListItem(`id_lama = "${displayedMenu.person}"`, { $autoCancel: false }).catch(() => null)
        : Promise.resolve(null)
    ]);
    settlementRemaining(Number(menu.total), Number(menu.dibayar), Number(nominal));
    const selectedAccount = cashflowAccounts.find(acc => acc.id === accountId);
    const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
    const mutasiValue = isIncomeTransaction(menu.jenis || '') ? 'in' : 'out';
    const timestamp = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
    const personRecordId = personRec ? personRec.id : '';

    const saldoAwal = Number(selectedAccount?.number_1) || 0;
    const saldoAkhir = mutasiValue === 'in' ? (saldoAwal + Number(nominal)) : (saldoAwal - Number(nominal));

    if (saldoAkhir < 0) throw new Error('Saldo akun tidak cukup untuk pelunasan ini.');

    const currentPaid = Number(menu.dibayar || 0);
    const grandTotalVal = Number(menu.total || 0);
    const newPaid = currentPaid + Number(nominal);
    const newStatus = newPaid >= grandTotalVal ? 'lunas' : 'belum';
    const dateLunas = newStatus === 'lunas' ? (menu.date_lunas || new Date().toISOString()) : null;

    const updateData = new FormData();
    updateData.append('dibayar', String(newPaid));
    updateData.append('status', newStatus);
    if (dateLunas) updateData.append('date_lunas', dateLunas);

    if (quickSettleData.settleFiles && quickSettleData.settleFiles.length > 0) {
      quickSettleData.settleFiles.forEach((f: File) => {
        updateData.append('file+', f);
      });
    }

    const batch = createFinancialBatch();

    batch.collection('cashflow').create({
      id_lama: '',
      operator: operatorName || pb.authStore.model?.username || 'Kasir',
      nominal: Number(nominal),
      jenis: menu.jenis || 'Penjualan',
      mutasi: mutasiValue,
      account_1: accountId,
      account_2: '',
      note: note || `Pelunasan POS Nota ${menu.id}`,
      ref_baru: menu.id,
      person: personRecordId,
      persontext: menu.person || '',
      acc1: accountIdLama,
      acc2: '',
      created_at: timestamp
    });

    updateData.set('atomic_expected', JSON.stringify(menu));
    batch.collection('menu').update(menu.id, updateData);

    await batch.send([], () => setQuickSettleData(null));

    const updatedMenuRecord = await pb.collection('menu').getOne(menu.id).catch(() => null);
    const finalStatus = updatedMenuRecord?.status || newStatus;

    try {
      const freshAccounts = await pb.collection('dropdown').getFullList<DropdownItem>({
        filter: `jenis ~ "cashflow account"`,
        sort: 'text_1',
        $autoCancel: false
      });
      setCashflowAccounts(freshAccounts);
    } catch {}

    setQuickSettleData(null);
    if (showDetailHistory?.id === menu.id) {
      setShowDetailHistory(prev => prev ? {
        ...prev,
        dibayar: newPaid,
        status: finalStatus as any,
        date_lunas: dateLunas || prev.date_lunas,
        file: updatedMenuRecord?.file || prev.file
      } : null);
    }
    fetchData();
    setDialog({
      show: true,
      title: 'Pelunasan Sukses!',
      message: `Pembayaran sebesar Rp ${formatAmount(nominal)} berhasil dicatat. Status nota saat ini: ${String(finalStatus).toUpperCase()}`,
      type: 'alert'
    });
  } catch (err: any) {
    console.error('Quick Settle Error:', err);
    setDialog({ show: true, title: 'Gagal Pelunasan', message: 'Terjadi kesalahan saat menyimpan pelunasan: ' + (err.message || err), type: 'alert' });
  } finally {
    submitLockRef.current = false;
    setIsProcessing(false);
    setProcessingMsg('');
  }
}
