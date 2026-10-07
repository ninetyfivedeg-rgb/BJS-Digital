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
import {
  computeCooperativeSummary,
  calculateBusinessUnitReports,
  loadMembers,
  loadSavings,
  loadLoans,
  loadRepayments,
  loadCashFlow,
  loadBusinessTransactions,
  loadSpCashMutations,
} from '../utils/storage';

export interface DashboardAggregateResult {
  summary: CooperativeSummary;
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  cashFlow: CashFlowRecord[];
  businessTransactions: BusinessUnitTransaction[];
  unitReports: BusinessUnitReport[];
  activeUnitsCount: number;
  fromSupabase: boolean;
  error: string | null;
}

/**
 * Mengambil dan mengagregasi data resmi Dashboard langsung dari tabel Supabase PostgreSQL:
 * 1. members (status anggota: total, aktif, pasif, keluar)
 * 2. savings_transactions (total simpanan, pokok, wajib, berjangka)
 * 3. loans (total pinjaman, jumlah pinjaman, outstanding, status pinjaman)
 * 4. loan_repayments (total pembayaran angsuran, pendapatan bunga)
 * 5. cash_flow_records (total kas masuk, kas keluar, saldo mutasi kas)
 * 6. business_units (jumlah unit usaha aktif)
 * 7. business_unit_transactions (pendapatan & laba unit usaha)
 *
 * Menerapkan pola READ-ONLY:
 * - Tidak melakukan INSERT, UPDATE, atau DELETE apa pun.
 * - Tidak membuat audit log baru.
 * - Menghormati batasan RLS per role pengguna (Pengurus vs Anggota).
 * - Menggunakan fallback ke dummy/localStorage jika koneksi database mengalami kendala.
 */
export async function fetchDashboardDataFromSupabase(
  userRole: UserRole = 'pengurus',
  memberId?: string
): Promise<DashboardAggregateResult> {
  try {
    const [
      membersRes,
      savingsRes,
      loansRes,
      repaymentsRes,
      cashFlowRes,
      businessUnitsRes,
      buTxRes,
    ] = await Promise.all([
      supabase.from('members').select('*').order('id', { ascending: true }),
      supabase.from('savings_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('loan_repayments').select('*').order('created_at', { ascending: false }),
      supabase.from('cash_flow_records').select('*').order('transaction_date', { ascending: false }),
      supabase.from('business_units').select('*'),
      supabase.from('business_unit_transactions').select('*').order('transaction_date', { ascending: false }),
    ]);

    // Identifikasi aman query mana yang mengalami kendala (tanpa mengekspos token/rahasia)
    const failedQueries: string[] = [];
    if (membersRes.error) failedQueries.push(`members: ${membersRes.error.message}`);
    if (savingsRes.error) failedQueries.push(`savings_transactions: ${savingsRes.error.message}`);
    if (loansRes.error) failedQueries.push(`loans: ${loansRes.error.message}`);
    if (repaymentsRes.error) failedQueries.push(`loan_repayments: ${repaymentsRes.error.message}`);
    if (cashFlowRes.error) failedQueries.push(`cash_flow_records: ${cashFlowRes.error.message}`);
    if (businessUnitsRes.error) failedQueries.push(`business_units: ${businessUnitsRes.error.message}`);
    if (buTxRes.error) failedQueries.push(`business_unit_transactions: ${buTxRes.error.message}`);

    if (failedQueries.length > 0) {
      console.warn(
        'Gagal memuat agregasi dashboard dari Supabase pada query:',
        failedQueries.join('; '),
        '-> beralih ke cadangan lokal.'
      );
      return getFallbackDashboardData('Gagal memuat data dashboard dari server. Menampilkan data cadangan lokal.');
    }

    // Mapping data dari Supabase (snake_case ke camelCase)
    const rawMembers = membersRes.data || [];
    let mappedMembers: Member[] = rawMembers.map(mapSupabaseMemberToMember);

    const rawSavings = savingsRes.data || [];
    const localSavingsFallback = loadSavings();
    const mappedRawSavings = rawSavings.map((s: any) =>
      mapSupabaseSavingsToSavings(s, mappedMembers)
    );
    const existingSavingsIds = new Set(mappedRawSavings.map((s) => s.id));
    let mappedSavings: SavingsTransaction[] = [
      ...mappedRawSavings,
      ...localSavingsFallback.filter((s) => !existingSavingsIds.has(s.id)),
    ];

    const rawRepayments = repaymentsRes.data || [];
    let mappedRepayments: LoanRepayment[] = rawRepayments.map((r: any, idx: number) =>
      mapSupabaseRepaymentToRepayment(r, idx, mappedMembers)
    );

    const rawLoans = loansRes.data || [];
    let mappedLoans: Loan[] = rawLoans.map((l: any) =>
      mapSupabaseLoanToLoan(l, mappedRepayments, mappedMembers)
    );

    const rawCashFlow = cashFlowRes.data || [];
    const mappedCashFlow: CashFlowRecord[] = rawCashFlow.map(mapSupabaseCashFlowToCashFlow);

    const rawUnits = businessUnitsRes.data || [];
    const activeUnitsCount = rawUnits.filter((u: any) => u.active !== false).length;

    const rawBuTx = buTxRes.data || [];
    const mappedBuTx: BusinessUnitTransaction[] = rawBuTx.map(mapSupabaseBuTxToBusinessUnitTransaction);

    // Ambil mutasi kas SP lokal yang sudah ada
    const spCashMutations: SimpanPinjamCashMutation[] = loadSpCashMutations();

    // Khusus role anggota: RLS Supabase sudah membatasi records ke anggota tersebut,
    // namun kita pastikan juga di level aplikasi untuk mencegah kebocoran data anggota lain
    if (userRole === 'anggota' && memberId) {
      const cleanMemberId = memberId.toLowerCase().trim();
      mappedMembers = mappedMembers.filter((m) => m.id.toLowerCase().trim() === cleanMemberId);
      mappedSavings = mappedSavings.filter((s) => s.memberId?.toLowerCase().trim() === cleanMemberId);
      mappedLoans = mappedLoans.filter((l) => l.memberId?.toLowerCase().trim() === cleanMemberId);
      mappedRepayments = mappedRepayments.filter((r) => r.memberId?.toLowerCase().trim() === cleanMemberId);
    }

    // Hitung laporan unit usaha dan ringkasan eksekutif koperasi
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

    return {
      summary,
      members: mappedMembers,
      savings: mappedSavings,
      loans: mappedLoans,
      repayments: mappedRepayments,
      cashFlow: mappedCashFlow,
      businessTransactions: mappedBuTx,
      unitReports: buCalc.reports,
      activeUnitsCount,
      fromSupabase: true,
      error: null,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat agregasi dashboard:', err);
    return getFallbackDashboardData('Terjadi kendala jaringan saat memuat dashboard. Menampilkan data cadangan lokal.');
  }
}

/**
 * Cadangan data lokal (fallback) jika query Supabase tidak dapat diakses
 */
function getFallbackDashboardData(errorMessage: string): DashboardAggregateResult {
  const localMembers = loadMembers();
  const localSavings = loadSavings();
  const localLoans = loadLoans();
  const localRepayments = loadRepayments();
  const localCashFlow = loadCashFlow();
  const localBuTx = loadBusinessTransactions();
  const localSpMutations = loadSpCashMutations();

  const buCalc = calculateBusinessUnitReports(localBuTx);
  const summary = computeCooperativeSummary(
    localMembers,
    localSavings,
    localLoans,
    localRepayments,
    localCashFlow,
    localBuTx,
    localSpMutations
  );

  return {
    summary,
    members: localMembers,
    savings: localSavings,
    loans: localLoans,
    repayments: localRepayments,
    cashFlow: localCashFlow,
    businessTransactions: localBuTx,
    unitReports: buCalc.reports,
    activeUnitsCount: 4,
    fromSupabase: false,
    error: errorMessage,
  };
}
