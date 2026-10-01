export type MemberStatus = 'aktif' | 'pasif' | 'keluar' | 'nonaktif';

export interface Member {
  id: string; // e.g. "BJS-001"
  nik: string;
  name: string;
  phone: string;
  address: string;
  joinDate: string;
  joinYear?: number | string; // Hasil kalkulasi tahun bergabung berdasarkan simpanan pokok (200rb) + wajib (50rb/bln) s/d Des 2025
  calculatedMonths?: number; // Akumulasi bulan simpanan wajib
  initialTotalSavings?: number; // Total simpanan pokok & wajib s/d Des 2025
  job: string;
  status: MemberStatus;
  notes?: string;
}

export type UserRole = 'pengurus' | 'anggota';

export const KOPERASI_OFFICIALS = {
  ketua: 'Durita, SH., MM.',
  sekretaris: 'Naufal Azhari, ST.',
  bendahara: 'Tri Hutomo Widodo Putra, SM.',
  manajerSimpanPinjam: 'Rizky Nur Amanda, SM.',
  manajerUSP: 'Rizky Nur Amanda, SM.',
  pengelolaApar: 'Irfan Susetya, S.Sos.',
  pengelolaAlatKebakaran: 'Nur Arby Maulana, ST.',
  pengelolaSembako: 'Ahmad Qori',
  pengelolaSimpanPinjam: 'Rizky Nur Amanda, SM.',
  pengelolaAtribut: 'Anan Wahid Hidayanto, ST.',
};

export const UNIT_MANAGERS: Record<string, { name: string; title: string; shortTitle: string }> = {
  apar: {
    name: 'Irfan Susetya, S.Sos.',
    title: 'Pengelola Unit Usaha Pengisian Ulang Alat Pemadam Api Ringan (APAR)',
    shortTitle: 'Pengelola Isi Ulang APAR',
  },
  apar_refill: {
    name: 'Irfan Susetya, S.Sos.',
    title: 'Pengelola Unit Usaha Pengisian Ulang Alat Pemadam Api Ringan (APAR)',
    shortTitle: 'Pengelola Isi Ulang APAR',
  },
  alat_kebakaran: {
    name: 'Nur Arby Maulana, ST.',
    title: 'Pengelola Unit Usaha Penjualan Alat Proteksi Kebakaran',
    shortTitle: 'Pengelola Penjualan Alat Kebakaran',
  },
  apar_sales: {
    name: 'Nur Arby Maulana, ST.',
    title: 'Pengelola Unit Usaha Penjualan Alat Proteksi Kebakaran',
    shortTitle: 'Pengelola Penjualan Alat Kebakaran',
  },
  sembako: {
    name: 'Ahmad Qori',
    title: 'Pengelola Unit Usaha Penjualan Sembako',
    shortTitle: 'Pengelola Penjualan Sembako',
  },
  simpan_pinjam: {
    name: 'Rizky Nur Amanda, SM.',
    title: 'Pengelola Unit Usaha Simpan Pinjam',
    shortTitle: 'Pengelola Simpan Pinjam',
  },
  atribut: {
    name: 'Anan Wahid Hidayanto, ST.',
    title: 'Pengelola Unit Usaha Penjualan Atribut',
    shortTitle: 'Pengelola Penjualan Atribut',
  },
};

export const UNIT_KERJA_OPTIONS = [
  'Dinas',
  'Sektor Weru',
  'Sektor Sumber',
  'Sektor Greged',
  'Sektor Gunungjati',
  'Sektor Palimanan',
  'Sektor Arjawinangun',
  'Sektor Lemahabang',
  'Sektor Pangenan',
  'Sektor Cikulak',
  'Sektor Ciledug',
  'Sektor Losari',
] as const;

export type UnitKerja = (typeof UNIT_KERJA_OPTIONS)[number];

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  memberId?: string;
  unitKerja?: string;
}

export type SavingsType = 'pokok' | 'wajib' | 'berjangka';
export type SavingsTransactionType = 'setor' | 'tarik';

export interface SavingsTransaction {
  id: string; // e.g. "SMP-2026-001"
  memberId: string;
  memberName: string;
  type: SavingsType;
  txType: SavingsTransactionType;
  amount: number;
  date: string;
  adminName: string;
  termMonths?: number; // 12 bulan (1 tahun) untuk Simpanan Berjangka
  annualInterestRate?: number; // 6.0 (%) sesuai ART Pasal 6 ayat 6
  maturityDate?: string; // Tanggal jatuh tempo pencairan
  accruedInterest?: number; // Estimasi bunga per tahun
  interestPaymentSchedule?: string; // e.g. "Dibayarkan saat RAT tahunan"
  statusBerjangka?: 'aktif' | 'selesai' | 'dibatalkan';
  completedDate?: string;
  notes?: string;
}

// 4-stage loan workflow: diajukan -> review -> disetujui -> dicairkan (plus ditolak & lunas)
export type LoanStatus = 'diajukan' | 'review' | 'disetujui' | 'dicairkan' | 'aktif' | 'menunggu' | 'lunas' | 'ditolak';

export interface LoanScheduleItem {
  month: number;
  dueDate: string;
  principal: number; // Pokok
  interest: number;  // Bunga
  totalInstallment: number; // Pokok + Bunga
  isPaid: boolean;
  paidDate?: string;
  receiptId?: string;
  notes?: string;
  paymentMethod?: string;
}

export interface Loan {
  id: string; // e.g. "PJM-2026-001"
  memberId: string;
  memberName: string;
  amount: number; // Plafon pinjaman
  tenorMonths: number; // Lama cicilan (bulan)
  interestRatePerMonth: number; // 1.1% or 1.2% flat
  adminFee: number; // Biaya administrasi 1% (masuk ke Kas Operasional Unit Simpan Pinjam)
  monthlyPrincipal: number; // amount / tenor
  monthlyInterest: number; // amount * (interestRate / 100)
  monthlyTotal: number; // monthlyPrincipal + monthlyInterest
  totalLoanAmount: number; // amount + (monthlyInterest * tenor)
  startDate: string;
  status: LoanStatus;
  purpose: string;
  approvedDate?: string;
  disbursedDate?: string;
  schedules: LoanScheduleItem[];
  notes?: string;
}

export interface LoanRepayment {
  id: string; // e.g. "ANG-2026-001"
  loanId: string;
  memberId: string;
  memberName: string;
  installmentNo: number;
  principalAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  totalPaid: number;
  date: string;
  adminName: string;
  notes?: string;
}

// Mutasi Kas Unit Simpan Pinjam (Penyesuaian / Adjustment Saldo)
export type SimpanPinjamCashMutationType = 'penambahan' | 'pengurangan';

export interface SimpanPinjamCashMutation {
  id: string; // e.g. "KAS-SP-2026-001"
  date: string;
  type: SimpanPinjamCashMutationType;
  category: string;
  amount: number;
  description: string;
  sourceOrRecipient?: string;
  recordedBy: string;
  notes?: string;
  createdAt?: string;
}

export interface CashFlowRecord {
  id: string;
  date: string;
  type: 'masuk' | 'keluar';
  category:
    | 'simpanan'
    | 'tarik_simpanan'
    | 'pencairan_pinjaman'
    | 'angsuran_pokok'
    | 'angsuran_bunga'
    | 'biaya_admin'
    | 'operasional_sp'
    | 'unit_usaha'
    | 'operasional';
  amount: number;
  referenceId: string;
  description: string;
  targetAccount?: 'kas_koperasi' | 'kas_operasional_sp' | 'kas_unit_usaha';
}

// 4 Unit Usaha
export type BusinessUnitId = 'alat_kebakaran' | 'apar' | 'sembako' | 'atribut';
export type BusinessUnitKey = BusinessUnitId | 'apar_sales' | 'apar_refill';

export interface BusinessUnitInfo {
  key: BusinessUnitKey;
  name: string;
  iconName: string;
  description: string;
}

export type BusinessUnitTxType =
  | 'penjualan'
  | 'hpp_beli_barang'
  | 'beban_operasional'
  | 'pendapatan'
  | 'hpp'
  | 'operasional';

export interface BusinessUnitTransaction {
  id: string;
  unitId?: BusinessUnitId;
  unitKey?: BusinessUnitKey;
  date: string;
  type: BusinessUnitTxType;
  title?: string;
  amount: number;
  description?: string;
  partyName?: string; // Pelanggan / Supplier
  notes?: string;
  recordedBy?: string;
  createdBy?: string;
}

export interface BusinessUnitReport {
  unitId: BusinessUnitId;
  key: BusinessUnitKey;
  unitName?: string;
  name: string;
  totalRevenue: number;
  totalHPP: number;
  totalOperasional: number;
  grossProfit?: number;
  netProfit: number;
}

export interface CooperativeSummary {
  totalCash: number; // Kas Koperasi untuk simpan pinjam
  totalOperasionalSP: number; // Kas Operasional Unit Simpan Pinjam (dari admin fee 1%)
  kasUnitSP?: number; // Saldo Kas Unit Simpan Pinjam (sinkron dari mutasi kas SP)
  totalSavings: {
    pokok: number;
    wajib: number;
    berjangka: number;
    sukarela?: number;
    total: number;
  };
  totalDisbursedLoans: number;
  totalOutstandingLoans: number;
  totalInterestEarned: number;
  membersCount: {
    aktif: number;
    pasif: number;
    keluar: number;
    total: number;
  };
  loanWorkflowCount: {
    diajukan: number;
    review: number;
    disetujui: number;
    dicairkan: number;
  };
  businessUnitProfits: Record<BusinessUnitKey, number>;
  totalBusinessProfit: number;
  modalAwal?: number;
  totalExpenses?: number;
  activeMembersCount: number;
  activeLoansCount: number;
}
