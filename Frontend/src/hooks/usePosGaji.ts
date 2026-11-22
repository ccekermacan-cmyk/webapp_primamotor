import { useState, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import { flushPendingSync } from '../services/api/laravel';
import { saveGajiBatch } from '../services/posGajiService';
import type { DropdownItem, HistoryMenu, GajiItemForm, UserKaryawan } from '../types/pos';

export const calculateWorkingDays = (dateStr: string) => {
  if (!dateStr) return 26;
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return 26;

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  const totalDays = new Date(year, month + 1, 0).getDate();
  let sundays = 0;

  for (let day = 1; day <= totalDays; day++) {
    if (new Date(year, month, day).getDay() === 0) {
      sundays++;
    }
  }

  return totalDays - sundays;
};

export const calculateItemNetto = (item: GajiItemForm, headerQty: number) => {
  const qty = Math.max(1, Number(headerQty) || 1);
  const pokok = Number(item.pokok) || 0;
  const tunjangan = Number(item.tunjangan) || 0;
  const nilaiDasar = qty > 0 ? (pokok + tunjangan) / qty : 0;

  const t1 = pokok + tunjangan + Number(item.bonus_1) + Number(item.bonus_2) + Number(item.bonus_3) + Number(item.bonus_4) + Number(item.program) + Number(item.lembur);
  const t2 = (nilaiDasar * Number(item.alfa)) + ((nilaiDasar / 2) * Number(item.setengah_hari)) + (nilaiDasar * 0.9 * Number(item.sakit)) + (Number(item.telat) * 1000);
  const t3 = Number(item.bpjs) + Number(item.bon_diambil) + Number(item.bon_dibayar);

  return t1 - t2 - t3;
};

interface UsePosGajiDeps {
  allUsers: UserKaryawan[];
  allPersons: DropdownItem[];
  showAlert: (title: string, message: string) => void;
  submitLockRef: React.MutableRefObject<boolean>;
  setIsProcessing: (v: boolean) => void;
  setProcessingMsg: (v: string) => void;
  operatorName: string;
  historyGajiSubItems: any[];
  setShowDetailHistory: (v: HistoryMenu | null) => void;
}

export function usePosGaji(deps: UsePosGajiDeps) {
  const {
    allUsers, allPersons, showAlert, submitLockRef,
    setIsProcessing, setProcessingMsg, operatorName,
    historyGajiSubItems, setShowDetailHistory,
  } = deps;

  const [salaryTab, setSalaryTab] = useState('income');
  const [salaryPeriodTab, setSalaryPeriodTab] = useState('period');
  const [salaryReview, setSalaryReview] = useState(false);
  const [isGajiFormOpen, setIsGajiFormOpen] = useState(false);
  const [gajiEditSession, setGajiEditSession] = useState<{ menuId: string } | null>(null);
  const [gajiHeader, setGajiHeader] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      date: todayStr,
      qty: calculateWorkingDays(todayStr),
      note: '',
    };
  });

  const [gajiItemList, setGajiItemList] = useState<GajiItemForm[]>([]);
  const [editingGajiItemIndex, setEditingGajiItemIndex] = useState<number | null>(null);
  const [showGajiBonus, setShowGajiBonus] = useState(false);
  const [isGajiItemSubModalOpen, setIsGajiItemSubModalOpen] = useState(false);
  const [gajiItemSubData, setGajiItemSubData] = useState<GajiItemForm>({
    id: '', person: '', pokok: 0, tunjangan: 0, bonus_1: 0, bonus_2: 0, bonus_3: 0, bonus_4: 0,
    program: 0, lembur: 0, alfa: 0, setengah_hari: 0, sakit: 0, telat: 0, bpjs: 0, bon_diambil: 0, bon_dibayar: 0, netto: 0,
    diterima: 0, note: '', files: [], fileUrls: []
  });

  const [employeeActiveBon, setEmployeeActiveBon] = useState<number>(0);
  const [isFetchingEmployeeData, setIsFetchingEmployeeData] = useState<boolean>(false);
  const [hasLoadedPreviousSlip, setHasLoadedPreviousSlip] = useState<boolean>(false);

  // Daftar karyawan yang tersedia (belum ada di list item gaji)
  const availableUsers = useMemo(() => {
    const source = allUsers.length > 0 ? allUsers : allPersons.map(p => ({
      id: p.id,
      username: p.id_lama || p.text_1,
      name: p.text_1,
      level: 10
    }));

    return source.filter((u: any) => {
      if (Number(u.level) === 1) return false;
      const userVal = String(u.username || u.name || u.id);
      if (!userVal) return false;

      // Saat mode edit item sedang aktif, karyawan yang sedang diedit tetap bisa dipilih
      if (editingGajiItemIndex !== null && String(gajiItemSubData?.person) === userVal) {
        return true;
      }

      // Karyawan yang sudah ada di list tidak ditampilkan (mencegah duplikat)
      return !gajiItemList.some(item => String(item.person) === userVal);
    });
  }, [allUsers, allPersons, gajiItemList, editingGajiItemIndex, gajiItemSubData?.person]);

  // Handler saat user memilih karyawan di form detail gaji
  const handleSelectPerson = async (personVal: string, isEditMode: boolean = false) => {
    setGajiItemSubData(prev => ({ ...prev, person: personVal }));
    if (!personVal) {
      setEmployeeActiveBon(0);
      setHasLoadedPreviousSlip(false);
      return;
    }

    setIsFetchingEmployeeData(true);
    try {
      let activeBon = 0;
      try {
        const foundUser = allUsers.find(u => u.username === personVal || u.name === personVal || u.id === personVal);
        if (foundUser) {
          activeBon = Number(foundUser.number) || 0;
        }
      } catch (bonErr) {
        console.warn("Notice: Fetching bon items fallback:", bonErr);
      }
      setEmployeeActiveBon(activeBon);

      if (!isEditMode && editingGajiItemIndex === null && !gajiItemSubData.id) {
        let foundPrevious = false;
        try {
          const allGajiList = await pb.collection('gaji').getFullList({
            filter: `person = "${personVal}"`,
            sort: '-created_at',
            $autoCancel: false
          });

          const lastSlip = allGajiList.find((g: any) => String(g.person) === String(personVal));

          if (lastSlip) {
            setGajiItemSubData(prev => ({
              ...prev,
              person: personVal,
              pokok: Number(lastSlip.pokok) || 0,
              tunjangan: Number(lastSlip.tunjangan) || 0,
              bonus_1: Number(lastSlip.bonus_1) || 0,
              bonus_2: Number(lastSlip.bonus_2) || 0,
              bonus_3: Number(lastSlip.bonus_3) || 0,
              bonus_4: Number(lastSlip.bonus_4) || 0,
              program: Number(lastSlip.program) || 0,
              lembur: Number(lastSlip.lembur) || 0,
              bpjs: Number(lastSlip.bpjs) || 0,
              diterima: Number(lastSlip.diterima) || 0,
              alfa: prev.alfa || 0,
              setengah_hari: prev.setengah_hari || 0,
              sakit: prev.sakit || 0,
              telat: prev.telat || 0,
              bon_diambil: prev.bon_diambil || 0,
              bon_dibayar: prev.bon_dibayar || 0
            }));
            foundPrevious = true;
          }
        } catch (gajiErr) {
          console.warn("Notice: Fetching previous gaji slip fallback:", gajiErr);
        }
        setHasLoadedPreviousSlip(foundPrevious);
      }
    } catch (err) {
      console.error("Error fetching employee bon/slip data:", err);
    } finally {
      setIsFetchingEmployeeData(false);
    }
  };

  // Helper File Upload untuk Detail Gaji Karyawan
  const handleGajiSubItemFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const existing = gajiItemSubData.files || [];
      const updatedFiles = [...existing, ...newFiles];
      const previewUrls = updatedFiles.map(f => URL.createObjectURL(f));
      setGajiItemSubData(prev => ({
        ...prev,
        files: updatedFiles,
        fileUrls: previewUrls
      }));
    }
  };

  const handleRemoveGajiSubItemFile = (index: number) => {
    const updatedFiles = (gajiItemSubData.files || []).filter((_, i) => i !== index);
    const previewUrls = updatedFiles.map(f => URL.createObjectURL(f));
    setGajiItemSubData(prev => ({
      ...prev,
      files: updatedFiles,
      fileUrls: previewUrls
    }));
  };

  // Tambah/Edit Item Penerima Gaji dari Sub-Modal ke List
  const handleSaveSubGajiItem = () => {
    if (!gajiItemSubData.person) {
      showAlert('Perhatian', 'Pilih Karyawan penerima gaji terlebih dahulu!');
      return;
    }
    const netto = calculateItemNetto(gajiItemSubData, gajiHeader.qty);
    const itemToSave = { ...gajiItemSubData, netto };

    if (editingGajiItemIndex !== null) {
      const updated = [...gajiItemList];
      updated[editingGajiItemIndex] = itemToSave;
      setGajiItemList(updated);
    } else {
      setGajiItemList([...gajiItemList, { ...itemToSave, id: 'tmp_' + Date.now() }]);
    }

    setSalaryPeriodTab('employees');
    setIsGajiItemSubModalOpen(false);
    setEditingGajiItemIndex(null);
    setGajiItemSubData({
      id: '', person: '', pokok: 0, tunjangan: 0, bonus_1: 0, bonus_2: 0, bonus_3: 0, bonus_4: 0,
      program: 0, lembur: 0, alfa: 0, setengah_hari: 0, sakit: 0, telat: 0, bpjs: 0, bon_diambil: 0, bon_dibayar: 0, netto: 0,
      diterima: 0, note: '', files: [], fileUrls: []
    });
  };

  const handleEditGajiItem = (index: number) => {
    setEditingGajiItemIndex(index);
    const item = gajiItemList[index];
    setGajiItemSubData({ ...item });
    setSalaryTab('income');
    setIsGajiItemSubModalOpen(true);
    handleSelectPerson(item.person, true);
  };

  const handleDeleteGajiItem = (index: number) => {
    setGajiItemList(gajiItemList.filter((_, i) => i !== index));
  };

  // Helper Simpan Seluruh Batch Slip Gaji (Perangkum + Children)
  const handleSaveGaji = async () => {
    if (gajiItemList.length === 0) {
      showAlert('Perhatian', 'Tambahkan minimal 1 Penerima Gaji ke dalam daftar!');
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsProcessing(true);
    setProcessingMsg('Menyiapkan batch slip gaji...');
    try {
      await flushPendingSync();
      const grandTotal = gajiItemList.reduce((sum, item) => sum + calculateItemNetto(item, gajiHeader.qty), 0);
      const isEditMode = gajiEditSession !== null;

      await saveGajiBatch({
        pb,
        isEditMode,
        gajiEditSession,
        menuId: isEditMode ? gajiEditSession!.menuId : '',
        gajiItemList,
        gajiHeader,
        grandTotal,
        operatorName,
        allUsers,
        allPersons,
        onSuccess: () => {
          showAlert('Berhasil 🎉', `Slip Gaji Karyawan (${gajiItemList.length} Penerima) berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}!`);
          setIsGajiFormOpen(false);
          setSalaryReview(false);
          setSalaryPeriodTab('period');
          setGajiEditSession(null);
          setGajiItemList([]);
          setSalaryTab('income');
        },
        onError: (msg: string) => {
          showAlert('Gagal Menyimpan', msg);
        },
      });
    } catch (err: any) {
      console.error(err);
      showAlert('Gagal Menyimpan', 'Gagal menyimpan slip gaji: ' + (err.message || err));
    } finally {
      submitLockRef.current = false;
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  // Buka Form Gaji dalam Mode Edit – mengisi form dari data histori
  const handleEditGajiFromHistory = async (menuItem: HistoryMenu) => {
    try {
      const dateStr = menuItem.created_at
        ? menuItem.created_at.split('T')[0].split(' ')[0]
        : new Date().toISOString().split('T')[0];

      setGajiHeader({
        date: dateStr,
        qty: menuItem.qty || calculateWorkingDays(dateStr),
        note: menuItem.text || '',
      });

      let gajiRecords = historyGajiSubItems;
      if (gajiRecords.length === 0) {
        gajiRecords = await pb.collection('gaji').getFullList({
          filter: `ref = "${menuItem.id}" || ref_baru = "${menuItem.id}"`,
          $autoCancel: false
        });
      }

      const mappedItems: GajiItemForm[] = gajiRecords.map((g: any) => ({
        id: g.id,
        person: g.person || '',
        pokok: Number(g.pokok) || 0,
        tunjangan: Number(g.tunjangan) || 0,
        bonus_1: Number(g.bonus_1) || 0,
        bonus_2: Number(g.bonus_2) || 0,
        bonus_3: Number(g.bonus_3) || 0,
        bonus_4: Number(g.bonus_4) || 0,
        program: Number(g.program) || 0,
        lembur: Number(g.lembur) || 0,
        alfa: Number(g.alfa) || 0,
        setengah_hari: Number(g.setengah_hari) || 0,
        sakit: Number(g.sakit) || 0,
        telat: Number(g.telat) || 0,
        bpjs: Number(g.bpjs) || 0,
        bon_diambil: Number(g.bon_diambil) || 0,
        bon_dibayar: Number(g.bon_dibayar) || 0,
        netto: calculateItemNetto(g, Number(menuItem.qty) || 0),
        diterima: Number(g.diterima) || 0,
        note: g.note || '',
        files: [],
        fileUrls: [],
      }));

      setGajiItemList(mappedItems);
      setGajiEditSession({ menuId: menuItem.id });
      setShowDetailHistory(null);
      setSalaryReview(false);
      setIsGajiFormOpen(true);
    } catch (err: any) {
      console.error('Gagal memuat data gaji untuk diedit:', err);
      showAlert('Error', 'Gagal memuat data gaji: ' + (err.message || 'Error server'));
    }
  };

  return {
    salaryTab, setSalaryTab,
    salaryPeriodTab, setSalaryPeriodTab,
    salaryReview, setSalaryReview,
    isGajiFormOpen, setIsGajiFormOpen,
    gajiEditSession, setGajiEditSession,
    gajiHeader, setGajiHeader,
    gajiItemList, setGajiItemList,
    editingGajiItemIndex, setEditingGajiItemIndex,
    showGajiBonus, setShowGajiBonus,
    isGajiItemSubModalOpen, setIsGajiItemSubModalOpen,
    gajiItemSubData, setGajiItemSubData,
    employeeActiveBon,
    isFetchingEmployeeData,
    hasLoadedPreviousSlip,
    availableUsers,
    handleSelectPerson,
    handleGajiSubItemFileAdd,
    handleRemoveGajiSubItemFile,
    handleSaveSubGajiItem,
    handleEditGajiItem,
    handleDeleteGajiItem,
    handleSaveGaji,
    handleEditGajiFromHistory,
  };
}
