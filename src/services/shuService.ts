import {
  Member,
  SavingsTransaction,
  LoanRepayment,
  CooperativeSummary,
} from '../types';
import { calculateMemberSavings } from '../utils/storage';

export interface ShuCalculationSummary {
  totalRevenue: number;
  totalExpenses: number;
  netShu: number;
  hasOperationalActivity: boolean;
  alokasiShuAnggotaTotal: number;
  cadanganModal: number;
  danaPengurus: number;
  danaPengawas: number;
  danaSosial: number;
  danaPendidikan: number;
  danaPembangunanKerja: number;
}

export interface MemberShuDetail {
  memberId: string;
  name: string;
  job: string;
  status: string;
  simpananPokokWajib: number;
  bungaPinjaman: number;
  jasaUsaha: number;
  jasaSimpanan: number;
  jasaPinjaman: number;
  totalShu: number;
}

export interface ShuSimulationResult {
  simulatedNetShu: number;
  alokasiShuAnggotaTotal: number; // 40%
  cadanganModal: number;          // 30%
  danaPengurus: number;           // 10%
  danaPengawas: number;           // 5%
  danaSosial: number;             // 5%
  danaPendidikan: number;         // 5%
  danaPembangunanKerja: number;   // 5%
  totalAlokasi: number;           // 100%
  poolJasaUsaha90: number;        // 90% dari 40% (36% total)
  poolJasaSimpanan5: number;      // 5% dari 40% (2% total)
  poolJasaPinjaman5: number;      // 5% dari 40% (2% total)
}

/**
 * Menghitung simulasi skenario (What-If) pembagian SHU Koperasi.
 * Menggunakan persentase dan aturan alokasi AD/ART yang 100% identik dengan calculateCooperativeShu
 * (Single Source of Truth), tanpa mengubah data riil ataupun database.
 */
export function calculateShuSimulation(simulatedNetShu: number): ShuSimulationResult {
  const safeShu = Math.max(0, Number(simulatedNetShu) || 0);

  const alokasiShuAnggotaTotal = Math.round(safeShu * 0.40); // 40% Hak Anggota
  const cadanganModal = Math.round(safeShu * 0.30);          // 30% Cadangan Modal
  const danaPengurus = Math.round(safeShu * 0.10);           // 10% Pengurus
  const danaPengawas = Math.round(safeShu * 0.05);           // 5% Pengawas
  const danaSosial = Math.round(safeShu * 0.05);             // 5% Sosial
  const danaPendidikan = Math.round(safeShu * 0.05);         // 5% Pendidikan
  const danaPembangunanKerja = Math.round(safeShu * 0.05);   // 5% Pembangunan Daerah Kerja

  const totalAlokasi =
    alokasiShuAnggotaTotal +
    cadanganModal +
    danaPengurus +
    danaPengawas +
    danaSosial +
    danaPendidikan +
    danaPembangunanKerja;

  const poolJasaUsaha90 = Math.round(alokasiShuAnggotaTotal * 0.90);
  const poolJasaSimpanan5 = Math.round(alokasiShuAnggotaTotal * 0.05);
  const poolJasaPinjaman5 = Math.round(alokasiShuAnggotaTotal * 0.05);

  return {
    simulatedNetShu: safeShu,
    alokasiShuAnggotaTotal,
    cadanganModal,
    danaPengurus,
    danaPengawas,
    danaSosial,
    danaPendidikan,
    danaPembangunanKerja,
    totalAlokasi,
    poolJasaUsaha90,
    poolJasaSimpanan5,
    poolJasaPinjaman5,
  };
}

/**
 * Menghitung Sisa Hasil Usaha (SHU) Koperasi secara objektif dan jujur
 * berdasarkan aktivitas ekonomi riil yang tercatat di database:
 *
 * SHU Bersih = Pendapatan Riil - Beban Riil
 * di mana:
 * - Pendapatan Riil = Laba Bersih Unit Usaha + Pendapatan Jasa/Bunga Pinjaman
 * - Beban Riil = Beban Operasional Koperasi (dari buku kas)
 *
 * PRINSIP KERAS:
 * - Tidak menggunakan angka balancing/plug untuk menyeimbangkan neraca.
 * - Tidak memasukkan simpanan pokok, simpanan wajib, atau simpanan berjangka sebagai pendapatan.
 * - Tidak menggunakan Math.max(0, ...) agar jika terjadi rugi riil, nilainya tetap tercermin secara transparan.
 * - Jika belum ada aktivitas ekonomi riil, SHU Bersih adalah Rp 0.
 */
export function calculateCooperativeShu(
  summary: CooperativeSummary,
  repayments: LoanRepayment[] = []
): ShuCalculationSummary {
  // 1. Pendapatan Riil:
  const labaUnitUsaha = Number(summary.totalBusinessProfit) || 0;

  let pendapatanJasa = Number(summary.totalInterestEarned) || 0;
  if (pendapatanJasa === 0 && repayments.length > 0) {
    pendapatanJasa = repayments.reduce((sum, r) => sum + (Number(r.interestAmount) || 0), 0);
  }

  const totalRevenue = labaUnitUsaha + pendapatanJasa;

  // 2. Beban Riil:
  const totalExpenses = Number(summary.totalExpenses) || 0;

  // 3. SHU Bersih Riil:
  // Tanpa Math.max(0, ...) agar mencerminkan kondisi riil (surplus, nihil, atau defisit).
  const netShu = totalRevenue - totalExpenses;

  // Indikator keberadaan aktivitas transaksi riil
  const hasOperationalActivity = totalRevenue > 0 || totalExpenses > 0;

  // 4. Pembagian SHU (hanya jika ada surplus usaha riil netShu > 0 sesuai UU Perkoperasian):
  const distributableShu = netShu > 0 ? netShu : 0;

  const alokasiShuAnggotaTotal = Math.round(distributableShu * 0.40); // 40% Hak Anggota
  const cadanganModal = Math.round(distributableShu * 0.30);          // 30% Cadangan Modal
  const danaPengurus = Math.round(distributableShu * 0.10);           // 10% Pengurus
  const danaPengawas = Math.round(distributableShu * 0.05);           // 5% Pengawas
  const danaSosial = Math.round(distributableShu * 0.05);             // 5% Sosial
  const danaPendidikan = Math.round(distributableShu * 0.05);         // 5% Pendidikan
  const danaPembangunanKerja = Math.round(distributableShu * 0.05);   // 5% Pembangunan Daerah Kerja

  return {
    totalRevenue,
    totalExpenses,
    netShu,
    hasOperationalActivity,
    alokasiShuAnggotaTotal,
    cadanganModal,
    danaPengurus,
    danaPengawas,
    danaSosial,
    danaPendidikan,
    danaPembangunanKerja,
  };
}

/**
 * Menghitung rincian pembagian SHU per anggota secara proporsional.
 * Jika alokasi SHU anggota adalah 0, maka seluruh hak anggota bernilai Rp 0.
 */
export function calculateMembersShuDetails(
  members: Member[],
  savings: SavingsTransaction[],
  repayments: LoanRepayment[],
  alokasiShuAnggotaTotal: number
): MemberShuDetail[] {
  // ATURAN BISNIS: Anggota dengan status 'keluar' TIDAK BOLEH muncul sebagai penerima SHU
  // dan TIDAK BOLEH dialokasikan bagian SHU apapun.
  const eligibleMembers = members.filter((m) => m.status !== 'keluar');

  // Jika tidak ada SHU yang dapat dibagikan, kembalikan nilai 0 hanya untuk anggota yang berhak (bukan 'keluar')
  if (alokasiShuAnggotaTotal <= 0) {
    return eligibleMembers.map((m) => {
      const s = calculateMemberSavings(m.id, savings);
      const memberBunga = repayments
        .filter((r) => r.memberId === m.id)
        .reduce((sum, r) => sum + (Number(r.interestAmount) || 0), 0);

      return {
        memberId: m.id,
        name: m.name,
        job: m.job,
        status: m.status,
        simpananPokokWajib: s.pokok + s.wajib,
        bungaPinjaman: memberBunga,
        jasaUsaha: 0,
        jasaSimpanan: 0,
        jasaPinjaman: 0,
        totalShu: 0,
      };
    });
  }

  // Jika terdapat surplus SHU riil:
  const poolJasaUsaha90 = Math.round(alokasiShuAnggotaTotal * 0.90);
  const poolJasaSimpanan5 = Math.round(alokasiShuAnggotaTotal * 0.05);
  const poolJasaPinjaman5 = Math.round(alokasiShuAnggotaTotal * 0.05);

  const eligibleForJasaUsaha = eligibleMembers.filter((m) => m.status === 'aktif' || m.status === 'pasif');
  const countEligible = Math.max(1, eligibleForJasaUsaha.length);
  const jasaUsahaPerAnggota = Math.round(poolJasaUsaha90 / countEligible);

  // Total simpanan pokok + wajib seluruh anggota penerima SHU yang sah (bukan status keluar)
  let grandTotalSimpananPokokWajib = 0;
  const memberSavingsMap: Record<string, number> = {};
  eligibleMembers.forEach((m) => {
    const s = calculateMemberSavings(m.id, savings);
    const pokokWajib = s.pokok + s.wajib;
    memberSavingsMap[m.id] = pokokWajib;
    grandTotalSimpananPokokWajib += pokokWajib;
  });
  grandTotalSimpananPokokWajib = Math.max(1, grandTotalSimpananPokokWajib);

  // Total bunga pinjaman yang telah dibayar seluruh anggota penerima SHU yang sah (bukan status keluar)
  let grandTotalBungaPinjaman = 0;
  const memberInterestMap: Record<string, number> = {};
  const eligibleMemberIdSet = new Set(eligibleMembers.map((m) => m.id));
  repayments.forEach((r) => {
    if (eligibleMemberIdSet.has(r.memberId)) {
      const amt = Number(r.interestAmount) || 0;
      memberInterestMap[r.memberId] = (memberInterestMap[r.memberId] || 0) + amt;
      grandTotalBungaPinjaman += amt;
    }
  });

  return eligibleMembers.map((m) => {
    const isEligibleForJasaUsaha = m.status === 'aktif' || m.status === 'pasif';
    const jasaUsaha = isEligibleForJasaUsaha ? jasaUsahaPerAnggota : 0;

    const memberSimpanan = memberSavingsMap[m.id] || 0;
    const jasaSimpanan = Math.round((memberSimpanan / grandTotalSimpananPokokWajib) * poolJasaSimpanan5);

    const memberBunga = memberInterestMap[m.id] || 0;
    const jasaPinjaman = grandTotalBungaPinjaman > 0
      ? Math.round((memberBunga / grandTotalBungaPinjaman) * poolJasaPinjaman5)
      : 0;

    const totalShu = jasaUsaha + jasaSimpanan + jasaPinjaman;

    return {
      memberId: m.id,
      name: m.name,
      job: m.job,
      status: m.status,
      jasaUsaha,
      jasaSimpanan,
      jasaPinjaman,
      totalShu,
      simpananPokokWajib: memberSimpanan,
      bungaPinjaman: memberBunga,
    };
  });
}
