import { displayProductCode } from './products';

export const formatIdLamaDisplay = (id: string | number | undefined | null): string => {
  return displayProductCode(id);
};

export const getFullLabel = (p: any): string => {
  if (!p) return 'Item Tidak Dikenal';
  const idLamaFormatted = formatIdLamaDisplay(p.id_lama);
  const parts = [p.kategori, p.merk, p.jenis, p.keterangan, p.varian, p.tipe].filter(Boolean).join(' ').trim();
  const name = parts || p.nama || 'Item';
  return idLamaFormatted !== 'N/A' ? `${idLamaFormatted} - ${name}` : name;
};

export const getLocalDatetimeInput = (dateString?: string): string => {
  const d = dateString ? new Date(dateString.replace(' ', 'T')) : new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatLocalDateTime = (isoString: string | undefined): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};
