import type PocketBase from "pocketbase";
import { createRecordId } from "../lib/ids";
import { createFinancialBatch } from "./api/financialBatch";
import { flushPendingSync } from "./api/laravel";
import { matchUnusedStockLog } from "../lib/posTransactions";
import { getLocalDatetimeInput } from "../lib/posFormatters";
import type { CartItem, CheckoutForm, DropdownItem, HistoryMenu } from "../types/pos";

export interface PosCheckoutContext {
  pb: PocketBase;
  selectedMenu: string;
  formBayar: CheckoutForm;
  editSession: { isEditing: boolean; menuId: string; createdAt: string; snapshot?: HistoryMenu } | null;
  submitLockRef: React.MutableRefObject<boolean>;
  setIsProcessing: (v: boolean) => void;
  setProcessingMsg: (v: string) => void;
  personOptions: DropdownItem[];
  cartWithTierPrice: CartItem[];
  grandTotal: number;
  totalQtyKeranjang: number;
  isOnlinePerson: boolean;
  menuFiles: File[];
  operatorName: string;
  cashflowAccounts: DropdownItem[];
  mechanics: any[];
  setShowReceiptPrint: (v: any) => void;
  setDialog: (v: any) => void;
  setShowCheckoutReview: (v: boolean) => void;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setEditSession: React.Dispatch<React.SetStateAction<{ isEditing: boolean; menuId: string; createdAt: string; snapshot?: HistoryMenu } | null>>;
  setEditOldItems: React.Dispatch<React.SetStateAction<any[]>>;
  setIsCartModalOpen: (v: boolean) => void;
  setFormBayar: React.Dispatch<React.SetStateAction<CheckoutForm>>;
  setIsPaymentFormOpen: (v: boolean) => void;
  setMenuFiles: React.Dispatch<React.SetStateAction<File[]>>;
  fetchData: () => void;
}

export const executePosCheckout = async (ctx: PosCheckoutContext) => {
  const {
    pb, selectedMenu, formBayar, editSession, submitLockRef,
    setIsProcessing, setProcessingMsg, personOptions,
    cartWithTierPrice, grandTotal, totalQtyKeranjang, isOnlinePerson, menuFiles,
    operatorName, cashflowAccounts, mechanics, setShowReceiptPrint, setDialog,
    setShowCheckoutReview, setCart, setEditSession, setEditOldItems,
    setIsCartModalOpen, setFormBayar, setIsPaymentFormOpen, setMenuFiles, fetchData
  } = ctx;
    if (submitLockRef.current) return; // anti double-submit (tombol disabled + watchdog tidak bisa menembus ini)
    submitLockRef.current = true;
    setIsProcessing(true);
    setProcessingMsg('Menyimpan...');
    // A slow response is still in flight: keep the submit lock and avoid encouraging duplicate input.
    const watchdog = setTimeout(() => {
      setProcessingMsg('Server masih memproses. Jangan membuat transaksi yang sama lagi.');
    }, 60000);
    const isEditing = !!(editSession?.isEditing && editSession?.menuId);
    let menuRecordId = isEditing ? editSession.menuId : '';
    let oldMenuData: any = null;
    let oldCashflows: any[] = [];
    let oldOngkos: any[] = [];
    let oldLogs: any[] = [];

    try {
      await flushPendingSync();
      // Browser otomatis mengubah string lokal (YYYY-MM-DDTHH:mm) menjadi format UTC (Z) yang diterima PB
      const timestamp = formBayar.createdAt
        ? new Date(formBayar.createdAt).toISOString()
        : new Date().toISOString();
        
      const menuLower = selectedMenu.toLowerCase();

      const selectedPersonRecordId = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.id || '';
      const selectedPersonName = personOptions.find(p => p.id_lama === formBayar.personIdLama)?.text_1 || 'Umum';



      if (isEditing) {
        oldMenuData = await pb.collection('menu').getOne(editSession.menuId);
        
        oldLogs = await pb.collection('log_stock').getFullList({ filter: `ref = "${editSession.menuId}" || ref_baru = "${editSession.menuId}"` });
        oldCashflows = await pb.collection('cashflow').getFullList({ filter: `ref = "${editSession.menuId}" || ref_baru = "${editSession.menuId}"` });
        oldOngkos = await pb.collection('ongkos').getFullList({ filter: `ref = "${editSession.menuId}" || ref_baru = "${editSession.menuId}"` });
      }

      // Hitung akumulasi parameter keuangan pembayaran kasir
      const totalDibayar = formBayar.cashflowList.reduce((sum, cf) => sum + (cf.nominal || 0), 0);

      // === PRE-FLIGHT: ambil snapshot stok & saldo sebelum write ===
      setProcessingMsg('Memverifikasi stok & saldo...');
      const preflightStocks: Record<string, number> = {};
      const preflightBalances: Record<string, number> = {};
      try {
        const stockIds = Array.from(new Set([...cartWithTierPrice.map(item => item.id), ...oldLogs.map(log => log.item_baru)].filter(Boolean)));
        const stockPromises = stockIds.map(id => pb.collection('produk').getOne(id, { $autoCancel: false }).then(p => ({ id, stok: Number(p.stok_3) || 0 })));
        
        const oldAccountIds = isEditing ? oldCashflows.flatMap((c: any) => [c.account_1, c.account_2]) : [];
        const newAccountIds = formBayar.cashflowList.map((cf: any) => cf.accountId);
        const allAccountIds = Array.from(new Set([...oldAccountIds, ...newAccountIds].filter(Boolean)));

        const balancePromises = allAccountIds
          .map(accId => pb.collection('dropdown').getOne(accId, { $autoCancel: false }).then(a => ({ id: accId, bal: Number(a.number_1) || 0 })));
        const [stocks, balances] = await Promise.all([Promise.all(stockPromises), Promise.all(balancePromises)]);
        stocks.forEach(s => { preflightStocks[s.id] = s.stok; });
        balances.forEach(b => { preflightBalances[b.id] = b.bal; });

        // Jika mode edit, revert saldo transaksi cashflow lama pada preflightBalances
        if (isEditing && oldCashflows.length > 0) {
          for (const oldCf of oldCashflows) {
            const acc1 = oldCf.account_1;
            const acc2 = oldCf.account_2;
            const nom = Number(oldCf.nominal || 0);
            const mut = String(oldCf.mutasi || '').toLowerCase();
            const isOut = mut === 'out' || mut === 'keluar';
            const isTransfer = String(oldCf.jenis || '').toLowerCase().includes('transfer');

            if (acc1 && preflightBalances[acc1] !== undefined) {
              preflightBalances[acc1] = isOut
                ? preflightBalances[acc1] + nom
                : preflightBalances[acc1] - nom;
            }
            if (acc2 && isTransfer && preflightBalances[acc2] !== undefined) {
              preflightBalances[acc2] = isOut
                ? preflightBalances[acc2] - nom
                : preflightBalances[acc2] + nom;
            }
          }
        }
      } catch { throw new Error('Gagal memverifikasi stok dan saldo. Silakan coba lagi.'); }
      setProcessingMsg('Menyimpan transaksi...');

      // Logika baru: Untuk pembelian, jika belum ada file → tetap 'belum' meski sudah dibayar penuh
      let statusBaru = totalDibayar >= grandTotal ? 'lunas' : 'belum';

      if (menuLower.includes('pembelian') && menuFiles.length === 0 && !isEditing) {
        statusBaru = 'belum'; // Paksa belum lunas jika belum upload bukti
        console.warn("Pembelian tanpa media → status tetap 'belum'");
      }
      let dateLunas = null;

      if (isEditing && oldMenuData) {
        const oldStatus = oldMenuData.status;
        if (statusBaru === 'lunas' && oldStatus !== 'lunas') {
          dateLunas = new Date().toISOString();
        } else if (statusBaru === 'lunas') {
          dateLunas = oldMenuData.date_lunas || new Date().toISOString(); // Pertahankan track records tgl lunas lama
        }
      } else if (statusBaru === 'lunas') {
        dateLunas = new Date().toISOString();
      }

      // Pembentukan Dokumen Jurnal Formulir Data Menu Baru
      const menuFormData = new FormData();
      if (isEditing && editSession?.snapshot) menuFormData.set('atomic_expected',JSON.stringify(editSession.snapshot));
      menuFormData.append('jenis', selectedMenu);
      menuFormData.append('person', formBayar.personIdLama);
      menuFormData.append('person_baru', selectedPersonRecordId);
      menuFormData.append('text', formBayar.noteMenu);
      const paymentValue = formBayar.payment === 'Tunai' ? 'cash' : 'tempo';
      menuFormData.append('payment', paymentValue);
      menuFormData.append('operator', operatorName);
      menuFormData.append('created_at', timestamp);
      menuFormData.append('qty', String(totalQtyKeranjang));
      // 🟢 KEAMANAN GANDA: Pastikan nilai yang dikirim ke DB benar-benar 0 jika bukan pelanggan online
      menuFormData.append('marketplace', isOnlinePerson ? formBayar.marketplace : '');
      menuFormData.append('cashback', isOnlinePerson ? String(formBayar.cashback) : '0');
      menuFormData.append('admin', isOnlinePerson ? String(formBayar.adminFee) : '0');
      menuFormData.append('status', statusBaru);
      menuFormData.append('total', String(grandTotal));
      menuFormData.append('dibayar', String(totalDibayar));
      menuFormData.append('date_lunas', dateLunas || '');
      
      // 🟢 Simpan tanggal tempo jika pembayaran di-set ke Tempo
      menuFormData.append('tempo', formBayar.payment === 'Tempo' ? formBayar.tempoDate : '');

      if (menuFiles && menuFiles.length > 0) {
        menuFiles.forEach(file => menuFormData.append(isEditing ? 'file+' : 'file', file));
      }

      const batch = createFinancialBatch({draftKey:'pos_draft_cart'});
      if (!isEditing) {
        menuRecordId = createRecordId();
        menuFormData.set('id', menuRecordId);
        batch.collection('menu').create(menuFormData);
      }

      // ========== MODE EDIT: hapus children lama terlebih dahulu (di-queue ke batch) ==========
      if (isEditing) {
        const newCfIds = formBayar.cashflowList.filter(cf => cf.accountId && cf.nominal > 0).map((cf: any) => cf.id).filter(id => id);
        for (const cf of oldCashflows) {
          if (!newCfIds.includes(cf.id)) {
            batch.collection('cashflow').delete(cf.id);
          }
        }

        // Dynamic Incremental Diff for Ongkos (Service Mechanics)
        const validMekanik = formBayar.mekanikList.filter((m: any) => m.idLama && m.ongkos > 0);
        const keptOngkosIds = new Set<string>();
        const matchedPersons = new Set<string>();
        for (const ong of oldOngkos) {
          if (validMekanik.some((m: any) => m.idLama === ong.person) && !matchedPersons.has(ong.person)) {
            matchedPersons.add(ong.person);
            keptOngkosIds.add(ong.id);
          }
        }
        const unmatchedMekaniks = validMekanik.filter((m: any) => !matchedPersons.has(m.idLama));
        let replaceIdx = 0;
        for (const ong of oldOngkos) {
          if (!keptOngkosIds.has(ong.id)) {
            if (replaceIdx < unmatchedMekaniks.length) {
              keptOngkosIds.add(ong.id);
              replaceIdx++;
            } else {
              batch.collection('ongkos').delete(ong.id);
            }
          }
        }
      }

      // ========== INCREMENTAL DIFF PENYIMPANAN LOG STOCK ==========
      const processedLogIds = new Set<string>();
      const runningStock: Record<string, number> = {};

      for (const item of cartWithTierPrice) {
        const booleanValue = (menuLower.includes('penjualan') || menuLower.includes('service') || menuLower.includes('servis')) ? 'out' : 'in';
        
        let price2Value = (item.beli || 0) * item.qty;
        let normalValue = (item.sell_6 || 0) * item.qty;

        if (booleanValue === 'in') {
            price2Value = 0;
            normalValue = 0;
        }

        const prodId = item.id || '';
        if (prodId && runningStock[prodId] === undefined) {
          runningStock[prodId] = preflightStocks[prodId] ?? 0;
        }
        const logQty = Number(item.qty);
        if (!Number.isInteger(logQty) || logQty <= 0) throw new Error('Jumlah barang harus bilangan bulat positif.');
        const qtyAwal = runningStock[prodId] ?? 0;

        const matchedOldLog = isEditing ? matchUnusedStockLog(oldLogs, prodId, item.id_lama || '', processedLogIds) : undefined;

        if (matchedOldLog) {
          processedLogIds.add(matchedOldLog.id);
          const isLogChanged = Number(matchedOldLog.qty) !== logQty || 
                               Number(matchedOldLog.price_1) !== Number(item.priceSelected || 0) ||
                               matchedOldLog.boolean !== booleanValue ||
                               Number(matchedOldLog.price_2) !== Number(price2Value) ||
                               Number(matchedOldLog.normal) !== Number(normalValue);

          if (!isLogChanged) {
            // UNCHANGED ITEM: Skip DB update & webhook, retain stock & ID in-place
            runningStock[prodId] = qtyAwal;
          } else {
            // CHANGED ITEM: Update existing log_stock in-place via Batch
            const afterRevert = matchedOldLog.boolean === 'in'
              ? qtyAwal - Number(matchedOldLog.qty || 0)
              : qtyAwal + Number(matchedOldLog.qty || 0);
            const qtyAkhir = booleanValue === 'in' ? afterRevert + logQty : afterRevert - logQty;
            if (qtyAkhir < 0) throw new Error('Stok barang tidak cukup.');
            runningStock[prodId] = qtyAkhir;

            batch.collection('log_stock').update(matchedOldLog.id, {
              expected_stock: preflightStocks[prodId],
              qty: logQty,
              price_1: Number(item.priceSelected || 0),
              price_2: Number(price2Value || 0),
              normal: Number(normalValue || 0),
              boolean: booleanValue,
            });
          }
        } else {
          // NEW ITEM ADDED TO CART DURING EDIT / NEW TRANSACTION
          const qtyAkhir = booleanValue === 'in' ? qtyAwal + logQty : qtyAwal - logQty;
          if (qtyAkhir < 0) throw new Error('Stok barang tidak cukup.');
          runningStock[prodId] = qtyAkhir;

          // Dalam batch mode, jika item baru dibuat, buat id sementara atau serahkan ke PB batch
          // Catatan: PocketBase batch membuat entri baru secara otomatis
          batch.collection('log_stock').create({
            expected_stock: preflightStocks[prodId],
            id_lama: '',
            created_at: timestamp,
            operator: operatorName || pb.authStore.model?.username || 'Kasir',
            item: item.id_lama || item.id || '',
            qty: logQty,
            item_baru: prodId,
            price_1: Number(item.priceSelected || 0),
            price_2: Number(price2Value || 0),
            number_1: 0,
            number_2: 0,
            boolean: booleanValue,
            ref: menuRecordId || '',
            ref_baru: menuRecordId || '',
            normal: Number(normalValue || 0),
          });
          // Webhook notification untuk created log_stock
        }
      }

      // DELETE REMOVED LOGS (Items that were removed from cart during edit) & REVERT THEIR STOCK
      if (isEditing && oldLogs.length > 0) {
        for (const log of oldLogs) {
          if (!processedLogIds.has(log.id)) {
            if (log.item_baru) {
              const stock = runningStock[log.item_baru] ?? preflightStocks[log.item_baru];
              if (stock === undefined) throw new Error('Stok item yang dihapus belum dapat diverifikasi.');
              const afterRemoval = stock + (log.boolean === 'in' ? -Number(log.qty) : Number(log.qty));
              if (afterRemoval < 0) throw new Error('Item pembelian tidak dapat dihapus karena stoknya sudah terpakai.');
              runningStock[log.item_baru] = afterRemoval;
            }
            batch.collection('log_stock').delete(log.id);


          }
        }
      }

      // Cari person record ID berdasarkan personIdLama (jika ada)
      let personRecordId = '';
      if (formBayar.personIdLama && formBayar.personIdLama !== 'umum1') {
        try {
          const personRecord = await pb.collection('dropdown').getFirstListItem(`id_lama = "${formBayar.personIdLama}"`, { $autoCancel: false });
          personRecordId = personRecord.id;
        } catch (e) {
          console.warn("Person tidak ditemukan:", formBayar.personIdLama);
        }
      }

      // Simpan pemetaan pemisahan multi cashflow aliran dana masuk/keluar & UPDATE SALDO DOMPET

      for (const cf of formBayar.cashflowList) {
        if (cf.accountId && cf.nominal > 0) {
          const selectedAccount = cashflowAccounts.find(acc => acc.id === cf.accountId);
          const accountIdLama = selectedAccount ? selectedAccount.id_lama : '';
          const mutasiValue = (menuLower.includes('penjualan') || menuLower.includes('service') || menuLower.includes('servis')) ? 'in' : 'out';
          
          let saldoAwal = preflightBalances[cf.accountId] ?? 0;
          const saldoAkhir = mutasiValue === 'in' ? (saldoAwal + cf.nominal) : (saldoAwal - cf.nominal);
          preflightBalances[cf.accountId] = saldoAkhir;

          const cfData = {
            id_lama: '',
            operator: operatorName,
            nominal: cf.nominal,
            jenis: selectedMenu,
            mutasi: mutasiValue,
            account_1: cf.accountId,          
            account_2: '',                    
            note: formBayar.note || `POS System: Nota ${menuRecordId}`,
            ref_baru: menuRecordId,
            person: personRecordId,
            persontext: formBayar.personIdLama || '',
            acc1: accountIdLama,              
            acc2: '',
          };

          if (cf.id) {
            // Update exist via Batch
            batch.collection('cashflow').update(cf.id, cfData);
          } else {
            // Create new via Batch
            batch.collection('cashflow').create({
              ...cfData,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      if (Object.values(preflightBalances).some(balance => balance < -0.00001)) throw new Error('Saldo akun tidak cukup untuk perubahan pembayaran ini.');

      // Alokasikan alur pembagian komisi upah ke sub-koleksi ongkos (Khusus Jenis Service)
      if (menuLower.includes('service') || menuLower.includes('servis')) {
        const mekanikValid = formBayar.mekanikList.filter(m => m.idLama && m.ongkos > 0);
        
        if (mekanikValid.length > 0) {
          const usedOngkosIds = new Set<string>();
          for (const mek of mekanikValid) {
            const existingOng = oldOngkos.find(o => o.person === mek.idLama && !usedOngkosIds.has(o.id)) ||
                                oldOngkos.find(o => !usedOngkosIds.has(o.id) && !mekanikValid.some(m => m.idLama === o.person));
            if (existingOng) {
              usedOngkosIds.add(existingOng.id);
              if (existingOng.ongkos !== mek.ongkos || existingOng.person !== mek.idLama) {
                batch.collection('ongkos').update(existingOng.id, { person: mek.idLama, ongkos: mek.ongkos });
              }
            } else {
              batch.collection('ongkos').create({
                id_lama: '',
                date: timestamp,
                person: mek.idLama,
                ongkos: mek.ongkos,
                operator: operatorName,
                ref: '',
                ref_baru: menuRecordId
              });
            }
          }
        }
      }

      // MODE EDIT: queue update menu terakhir (setelah semua children tersusun)
      if (isEditing) {
        batch.collection('menu').update(menuRecordId, menuFormData);
      }

      // EKSEKUSI POCKETBASE ATOMIC BATCH TRANSACTION
      setProcessingMsg('Mengeksekusi transaksi atomic batch ke PocketBase...');
      await batch.send();
      setIsPaymentFormOpen(false);
      try { localStorage.removeItem('pos_draft_cart'); } catch { /* Draft cleanup must not interrupt financial synchronization. */ }
      setCart([]);
      setEditSession(null);


      // Siapkan State Nota Cetak Thermal Printer
      const mechanicsForPrint = formBayar.mekanikList
        .filter(m => m.idLama && m.ongkos > 0)
        .map(m => {
          const mech = mechanics.find(me => me.username === m.idLama);
          return { name: mech?.name || m.idLama, ongkos: m.ongkos };
        });

      setShowReceiptPrint({
        id: menuRecordId,
        timestamp,
        customer: selectedPersonName,
        items: cartWithTierPrice,
        total: grandTotal,
        cash: formBayar.nominalBayar,
        change: formBayar.nominalBayar - grandTotal,
        payment: formBayar.payment,
        jenis: selectedMenu,
        mechanics: mechanicsForPrint
      });

      setDialog({ show: true, title: 'SUKSES', message: isEditing ? "Perubahan transaksi berhasil diperbarui!" : "Transaksi berhasil disimpan!", type: 'alert' });
      
      // Reset State Form input kasir kembali bersih
      setShowCheckoutReview(false);
      setCart([]);
      try { localStorage.removeItem('pos_draft_cart'); } catch { /* ignore */ }
      setMenuFiles([]);
      setEditSession(null);
      setEditOldItems([]);
      setIsCartModalOpen(false);
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
        createdAt: getLocalDatetimeInput(), // 🟢 Reset dengan akurat
      });

      fetchData(); // Muat ulang grid inventaris barang & list overview di screen utama

    } catch (err: any) {
      console.error(err);
      // Never delete committed records after an uncertain network response. The durable sync queue
      // keeps the same request ID for retries, so server effects cannot be applied twice.
      setDialog({
        show: true,
        title: 'Sinkronisasi Gagal',
        message: "Gagal menyimpan data entri: " + (err.message || err) + "\n\nKeranjang dan form Anda tetap tersimpan. Anda dapat mencoba menyimpan ulang.",
        type: 'confirm',
        confirmLabel: 'COBA LAGI',
        onConfirm: () => {
          setDialog((prev: any) => ({ ...prev, show: false }));
          void executePosCheckout(ctx);
        }
      });
    } finally {
      clearTimeout(watchdog);
      submitLockRef.current = false;
      setIsProcessing(false);
      setProcessingMsg('');
    }
};
