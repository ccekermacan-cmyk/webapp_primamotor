import type PocketBase from 'pocketbase';
import { createRecordId } from '../lib/ids';
import { createFinancialBatch } from './api/financialBatch';
import type { GajiItemForm, DropdownItem } from '../types/pos';

export interface SaveGajiBatchParams {
  pb: PocketBase;
  isEditMode: boolean;
  gajiEditSession: { menuId: string } | null;
  menuId: string;
  gajiItemList: GajiItemForm[];
  gajiHeader: { date: string; qty: number; note: string };
  grandTotal: number;
  operatorName: string;
  allUsers: any[];
  allPersons: DropdownItem[];
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export async function saveGajiBatch(params: SaveGajiBatchParams): Promise<void> {
  const {
    pb, isEditMode, gajiEditSession,
    gajiItemList, gajiHeader, grandTotal,
    operatorName, allUsers, allPersons,
    onSuccess, onError
  } = params;

  try {
    let menuId = params.menuId;
    const existingSalaryIds = new Set<string>();
    const batch = createFinancialBatch();

  if (isEditMode) {
    menuId = gajiEditSession!.menuId;
    batch.collection('menu').update(menuId, {
      total: grandTotal,
      dibayar: grandTotal,
      qty: gajiHeader.qty,
      text: gajiHeader.note || `Gaji Periode ${gajiHeader.date}`,
      person: gajiItemList.map(i => i.person).join(', '),
      created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
    });

    const oldGajiList = await pb.collection('gaji').getFullList({
      filter: `ref = "${menuId}" || ref_baru = "${menuId}"`,
      $autoCancel: false
    });
    oldGajiList.forEach(salary => existingSalaryIds.add(salary.id));

    const oldBonList = await pb.collection('bon').getFullList({
      filter: [pb.filter('ref_menu = {:id}', { id: menuId }), ...oldGajiList.map(g => pb.filter('ref_gaji = {:id}', { id: g.id }))].join(' || '),
      $autoCancel: false
    });
    for (const ob of oldBonList) batch.collection('bon').delete(ob.id);
    for (const salary of oldGajiList) {
      if (!gajiItemList.some(item => item.id === salary.id)) batch.collection('gaji').delete(salary.id);
    }
  } else {
    menuId = createRecordId();
    batch.collection('menu').create({
      id: menuId,
      jenis: 'gaji',
      status: 'lunas',
      total: grandTotal,
      dibayar: grandTotal,
      qty: gajiHeader.qty,
      text: gajiHeader.note || `Gaji Periode ${gajiHeader.date}`,
      person: gajiItemList.map(i => i.person).join(', '),
      operator: operatorName || pb.authStore.model?.username || 'System',
      created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
    });
  }

  for (const item of gajiItemList) {
    const salaryExists = existingSalaryIds.has(item.id);
    const salaryId = salaryExists ? item.id : createRecordId();
    const formData = new FormData();
    formData.append('id', salaryId);
    formData.append('ref', menuId);
    formData.append('ref_baru', menuId);
    formData.append('person', item.person);
    formData.append('pokok', String(item.pokok || 0));
    formData.append('tunjangan', String(item.tunjangan || 0));
    formData.append('bonus_1', String(item.bonus_1 || 0));
    formData.append('bonus_2', String(item.bonus_2 || 0));
    formData.append('bonus_3', String(item.bonus_3 || 0));
    formData.append('bonus_4', String(item.bonus_4 || 0));
    formData.append('program', String(item.program || 0));
    formData.append('lembur', String(item.lembur || 0));
    formData.append('alfa', String(item.alfa || 0));
    formData.append('setengah_hari', String(item.setengah_hari || 0));
    formData.append('sakit', String(item.sakit || 0));
    formData.append('telat', String(item.telat || 0));
    formData.append('bpjs', String(item.bpjs || 0));
    formData.append('bon_diambil', String(item.bon_diambil || 0));
    formData.append('bon_dibayar', String(item.bon_dibayar || 0));
    formData.append('diterima', String(item.diterima || 0));
    if (item.note) formData.append('note', item.note);
    if (gajiHeader.date) formData.append('created_at', `${gajiHeader.date} 12:00:00`);

    if (item.files && item.files.length > 0) {
      item.files.forEach(file => {
        formData.append(salaryExists ? 'file+' : 'file', file);
      });
    }

    if (salaryExists) batch.collection('gaji').update(salaryId, formData);
    else batch.collection('gaji').create(formData);

    const foundUser = allUsers.find(u => u.username === item.person || u.name === item.person || u.id === item.person);
    let personDropdownId = '';
    if (foundUser) {
      const foundPerson = allPersons.find(p => p.id_lama === foundUser.username || p.text_1 === foundUser.name || p.id === item.person);
      if (foundPerson) personDropdownId = foundPerson.id;
    }

    if (Number(item.bon_dibayar) > 0) {
      batch.collection('bon').create({
        id: createRecordId(),
        person: item.person,
        person_baru: personDropdownId,
        ref_menu: menuId,
        ref_gaji: salaryId,
        nominal: Number(item.bon_dibayar),
        jenis: 'in',
        status: 'lunas',
        tipe: 'dibayar',
        created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
        operator: operatorName || pb.authStore.model?.username || 'System',
        note: `Potongan Bon via Slip Gaji Periode ${gajiHeader.date}`,
      });
    }

    if (Number(item.bon_diambil) > 0) {
      batch.collection('bon').create({
        id: createRecordId(),
        person: item.person,
        person_baru: personDropdownId,
        ref_menu: menuId,
        ref_gaji: salaryId,
        nominal: Number(item.bon_diambil),
        jenis: 'out',
        status: 'belum',
        tipe: 'diambil',
        created_at: gajiHeader.date ? `${gajiHeader.date} 12:00:00` : new Date().toISOString(),
        operator: operatorName || pb.authStore.model?.username || 'System',
        note: `Pinjaman Bon Baru via Slip Gaji Periode ${gajiHeader.date}`,
      });
    }
  }

  await batch.send([], () => {
    onSuccess();
  });
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
    throw err;
  }
}
