/**
 * Indonesian Rupiah and Date formatting utilities
 */

export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(amount);
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Konversi angka ke kalimat terbilang bahasa Indonesia untuk kwitansi resmi
 */
export function terbilang(nilai: number): string {
  const bilangan = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
    'sepuluh',
    'sebelas',
  ];

  const n = Math.floor(Math.abs(nilai));

  if (n < 12) {
    return bilangan[n];
  } else if (n < 20) {
    return `${terbilang(n - 10)} belas`;
  } else if (n < 100) {
    const satuan = n % 10;
    const puluhan = Math.floor(n / 10);
    return `${bilangan[puluhan]} puluh ${satuan > 0 ? bilangan[satuan] : ''}`.trim();
  } else if (n < 200) {
    return `seratus ${terbilang(n - 100)}`.trim();
  } else if (n < 1000) {
    const ratusan = Math.floor(n / 100);
    const sisa = n % 100;
    return `${bilangan[ratusan]} ratus ${sisa > 0 ? terbilang(sisa) : ''}`.trim();
  } else if (n < 2000) {
    return `seribu ${terbilang(n - 1000)}`.trim();
  } else if (n < 1000000) {
    const ribuan = Math.floor(n / 1000);
    const sisa = n % 1000;
    return `${terbilang(ribuan)} ribu ${sisa > 0 ? terbilang(sisa) : ''}`.trim();
  } else if (n < 1000000000) {
    const jutaan = Math.floor(n / 1000000);
    const sisa = n % 1000000;
    return `${terbilang(jutaan)} juta ${sisa > 0 ? terbilang(sisa) : ''}`.trim();
  } else if (n < 1000000000000) {
    const miliaran = Math.floor(n / 1000000000);
    const sisa = n % 1000000000;
    return `${terbilang(miliaran)} miliar ${sisa > 0 ? terbilang(sisa) : ''}`.trim();
  }
  return n.toString();
}

export function terbilangRupiah(nilai: number): string {
  if (!nilai || nilai === 0) return 'Nol rupiah';
  const hasil = terbilang(nilai);
  return `${hasil.charAt(0).toUpperCase() + hasil.slice(1)} rupiah`;
}
