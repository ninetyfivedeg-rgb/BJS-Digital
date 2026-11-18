import { supabase } from '../lib/supabase';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CashFlowRecord,
  BusinessUnitTransaction,
  BusinessUnitReport,
  CooperativeSummary,
  SimpanPinjamCashMutation,
  UserRole,
} from '../types';
import { mapSupabaseMemberToMember } from './memberService';
import { mapSupabaseSavingsToSavings } from './savingsService';
import { mapSupabaseLoanToLoan, mapSupabaseRepaymentToRepayment } from './loanService';
import { mapSupabaseCashFlowToCashFlow } from './cashFlowService';
import { mapSupabaseBuTxToBusinessUnitTransaction } from './businessUnitService';
import { extractSpCashMutationsFromCashFlow } from './spCashService';
import {
  computeCooperativeSummary,
  calculateBusinessUnitReports,
} from '../utils/storage';

export interface ReportNeracaSakEtap {
  kasKoperasi: number; // Total Kas & Bank
  kasTunaiFisik: number; // 1a. Kas Tunai Fisik
  kasDiBank: number; // 1b. Kas di Bank
  piutangPinjaman: number;
  totalAktiva: number;
  totalKewajiban: number;
  simpananBerjangka: number;
  simpananPokok: number;
  simpananWajib: number;
  modalAwal: number;
  labaUnitUsaha: number;
  pendapatanJasa: number;
  shuTahunBerjalan: number;
  totalEkuitas: number;
  totalPasiva: number;
  selisihNeraca: number;
  isBalanced: boolean;
}

export interface ReportAggregateResult {
  summary: CooperativeSummary;
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  cashFlow: CashFlowRecord[];
  businessTransactions: BusinessUnitTransaction[];
  unitReports: BusinessUnitReport[];
  neraca: ReportNeracaSakEtap;
  fromSupabase: boolean;
  error: string | null;
}

/**
 * Menghitung neraca posisi keuangan standar SAK ETAP Koperasi
 * secara jujur dan transparan:
 * - SHU Tahun Berjalan murni dihitung dari realisasi pendapatan dikurangi beban (bukan angka balancing artifisial).
 * - Selisih neraca dihitung dari Total Aktiva - Total Pasiva tanpa plug balancing paksa.
 */
export function computeNeracaSakEtap(summary: CooperativeSummary): ReportNeracaSakEtap {
  const kasKoperasi = summary.totalCash || 0;
  const kasTunaiFisik = summary.totalCashFisik ?? 0;
  const kasDiBank = summary.totalCashBank ?? 0;
  const piutangPinjaman = summary.totalOutstandingLoans || 0;
  const totalAktiva = kasKoperasi + piutangPinjaman;

  // Pasiva: Kewajiban (Simpanan Berjangka 6% p.a.)
  const simpananBerjangka = summary.totalSavings.berjangka || 0;
  const totalKewajiban = simpananBerjangka;

  // Ekuitas: Modal Sendiri & SHU Realisasi
  const simpananPokok = summary.totalSavings.pokok || 0;
  const simpananWajib = summary.totalSavings.wajib || 0;
  const modalAwal = summary.modalAwal || 0;
  const labaUnitUsaha = summary.totalBusinessProfit || 0;
  const pendapatanJasa = summary.totalInterestEarned || 0;

  // Realisasi SHU Tahun Berjalan murni dari hasil usaha riil (pendapatan jasa + laba unit usaha - beban operasional)
  // TIDAK menggunakan angka penyeimbang artifisial, dan tidak menggunakan Math.max(0, ...) agar jika rugi tetap tercermin secara transparan.
  const shuTahunBerjalan =
    (summary.totalBusinessProfit || 0) +
    (summary.totalInterestEarned || 0) -
    (summary.totalExpenses || 0);

  // Total Ekuitas = Modal Sendiri (Pokok + Wajib + Modal Awal) + SHU Realisasi Tahun Berjalan
  // Catatan Akuntansi SAK ETAP: Laba Unit Usaha dan Pendapatan Jasa Pinjaman adalah komponen pembentuk
  // SHU Tahun Berjalan (Laba/Rugi), sehingga TIDAK boleh ditambahkan ulang agar tidak terjadi double-counting.
  const totalEkuitas =
    simpananPokok +
    simpananWajib +
    modalAwal +
    shuTahunBerjalan;

  const totalPasiva = totalKewajiban + totalEkuitas;
  const selisihNeraca = totalAktiva - totalPasiva;
  const isBalanced = Math.abs(selisihNeraca) === 0;

  return {
    kasKoperasi,
    kasTunaiFisik,
    kasDiBank,
    piutangPinjaman,
    totalAktiva,
    totalKewajiban,
    simpananBerjangka,
    simpananPokok,
    simpananWajib,
    modalAwal,
    labaUnitUsaha,
    pendapatanJasa,
    shuTahunBerjalan,
    totalEkuitas,
    totalPasiva,
    selisihNeraca,
    isBalanced,
  };
}

/**
 * Mengambil dan mengagregasi data resmi Laporan Keuangan langsung dari tabel Supabase PostgreSQL:
 * 1. members (anggota)
 * 2. savings_transactions (simpanan pokok, wajib, berjangka)
 * 3. loans (pinjaman & plafon)
 * 4. loan_repayments (angsuran pokok & bunga pinjaman) -> PERHATIAN: menggunakan created_at (bukan payment_date)
 * 5. cash_flow_records (arus kas masuk & keluar)
 * 6. business_units (unit usaha aktif)
 * 7. business_unit_transactions (pendapatan & beban unit usaha)
 *
 * Menerapkan pola READ-ONLY:
 * - Tidak melakukan INSERT, UPDATE, atau DELETE apa pun.
 * - Tidak membuat audit log baru.
 * - Menghormati batasan RLS per role pengguna (Pengurus vs Anggota).
 * - Menggunakan fallback ke dummy/localStorage jika koneksi database mengalami kendala.
 */
function getEmptyReportData(errorMessage: string): ReportAggregateResult {
  const emptyReports = calculateBusinessUnitReports([]);
  const emptySummary = computeCooperativeSummary([], [], [], [], [], [], []);
  const emptyNeraca = computeNeracaSakEtap(emptySummary);
  return {
    summary: emptySummary,
    members: [],
    savings: [],
    loans: [],
    repayments: [],
    cashFlow: [],
    businessTransactions: [],
    unitReports: emptyReports.reports,
    neraca: emptyNeraca,
    fromSupabase: false,
    error: errorMessage,
  };
}

/**
 * Mengambil dan mengagregasi data resmi Laporan Keuangan langsung dari tabel Supabase PostgreSQL
 * tanpa mencampur data dummy atau cadangan localStorage.
 */
export async function fetchReportDataFromSupabase(
  userRole: UserRole = 'super_admin',
  memberId?: string
): Promise<ReportAggregateResult> {
  try {
    const [
      membersRes,
      savingsRes,
      loansRes,
      repaymentsRes,
      schedulesRes,
      cashFlowRes,
      businessUnitsRes,
      buTxRes,
    ] = await Promise.all([
      supabase.from('members').select('*').order('id', { ascending: true }),
      supabase.from('savings_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('loan_repayments').select('*').order('created_at', { ascending: false }),
      supabase.from('loan_schedules').select('*').order('installment_no', { ascending: true }),
      supabase.from('cash_flow_records').select('*').order('transaction_date', { ascending: false }),
      supabase.from('business_units').select('*'),
      supabase.from('business_unit_transactions').select('*').order('transaction_date', { ascending: false }),
    ]);

    const failedQueries: string[] = [];
    if (membersRes.error) failedQueries.push(`members: ${membersRes.error.message}`);
    if (savingsRes.error) failedQueries.push(`savings_transactions: ${savingsRes.error.message}`);
    if (loansRes.error) failedQueries.push(`loans: ${loansRes.error.message}`);
    if (repaymentsRes.error) failedQueries.push(`loan_repayments: ${repaymentsRes.error.message}`);
    if (cashFlowRes.error) failedQueries.push(`cash_flow_records: ${cashFlowRes.error.message}`);
    if (businessUnitsRes.error) failedQueries.push(`business_units: ${businessUnitsRes.error.message}`);
    if (buTxRes.error) failedQueries.push(`business_unit_transactions: ${buTxRes.error.message}`);

    if (failedQueries.length > 0) {
      console.warn('Gagal memuat agregasi laporan dari Supabase pada query:', failedQueries.join('; '));
      return getEmptyReportData('Gagal memuat data laporan dari server.');
    }

    const rawMembers = membersRes.data || [];
    let mappedMembers: Member[] = rawMembers.map(mapSupabaseMemberToMember);

    const rawSavings = savingsRes.data || [];
    let mappedSavings: SavingsTransaction[] = rawSavings.map((s: any) =>
      mapSupabaseSavingsToSavings(s, mappedMembers)
    );

    const rawRepayments = repaymentsRes.data || [];
    let mappedRepayments: LoanRepayment[] = rawRepayments.map((r: any, idx: number) =>
      mapSupabaseRepaymentToRepayment(r, idx, mappedMembers)
    );

    const rawSchedules = schedulesRes.data || [];
    const rawLoans = loansRes.data || [];
    let mappedLoans: Loan[] = rawLoans.map((l: any) =>
      mapSupabaseLoanToLoan(l, mappedRepayments, mappedMembers, rawSchedules)
    );

    const rawCashFlow = cashFlowRes.data || [];
    const mappedCashFlow: CashFlowRecord[] = rawCashFlow.map(mapSupabaseCashFlowToCashFlow);

    const rawBuTx = buTxRes.data || [];
    const mappedBuTx: BusinessUnitTransaction[] = rawBuTx.map(mapSupabaseBuTxToBusinessUnitTransaction);

    // Mutasi Kas Unit SP langsung dari cash_flow_records
    const spCashMutations: SimpanPinjamCashMutation[] =
      extractSpCashMutationsFromCashFlow(mappedCashFlow);

    if (userRole === 'anggota' && memberId) {
      const cleanMemberId = memberId.toLowerCase().trim();
      mappedMembers = mappedMembers.filter((m) => m.id.toLowerCase().trim() === cleanMemberId);
      mappedSavings = mappedSavings.filter((s) => s.memberId?.toLowerCase().trim() === cleanMemberId);
      mappedLoans = mappedLoans.filter((l) => l.memberId?.toLowerCase().trim() === cleanMemberId);
      mappedRepayments = mappedRepayments.filter((r) => r.memberId?.toLowerCase().trim() === cleanMemberId);
    }

    const buCalc = calculateBusinessUnitReports(mappedBuTx);
    const summary = computeCooperativeSummary(
      mappedMembers,
      mappedSavings,
      mappedLoans,
      mappedRepayments,
      mappedCashFlow,
      mappedBuTx,
      spCashMutations
    );

    const neraca = computeNeracaSakEtap(summary);

    return {
      summary,
      members: mappedMembers,
      savings: mappedSavings,
      loans: mappedLoans,
      repayments: mappedRepayments,
      cashFlow: mappedCashFlow,
      businessTransactions: mappedBuTx,
      unitReports: buCalc.reports,
      neraca,
      fromSupabase: true,
      error: null,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat agregasi laporan:', err);
    return getEmptyReportData('Terjadi kendala jaringan saat memuat laporan.');
  }
}
