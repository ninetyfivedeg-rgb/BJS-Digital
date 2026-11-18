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

function getEmptyDashboardData(errorMessage: string): DashboardAggregateResult {
  const emptyReports = calculateBusinessUnitReports([]);
  const emptySummary = computeCooperativeSummary([], [], [], [], [], [], []);
  return {
    summary: emptySummary,
    members: [],
    savings: [],
    loans: [],
    repayments: [],
    cashFlow: [],
    businessTransactions: [],
    unitReports: emptyReports.reports,
    activeUnitsCount: 0,
    fromSupabase: false,
    error: errorMessage,
  };
}

/**
 * Mengambil dan mengagregasi data resmi Dashboard langsung dari tabel Supabase PostgreSQL
 * tanpa mencampur data dummy atau cadangan localStorage.
 */
export async function fetchDashboardDataFromSupabase(
  userRole: UserRole = 'super_admin',
  memberId?: string
): Promise<DashboardAggregateResult> {
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
      console.warn('Gagal memuat agregasi dashboard dari Supabase pada query:', failedQueries.join('; '));
      return getEmptyDashboardData('Gagal memuat data dashboard dari server.');
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

    const rawUnits = businessUnitsRes.data || [];
    const activeUnitsCount = rawUnits.filter((u: any) => u.active !== false).length;

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
    return getEmptyDashboardData('Terjadi kendala jaringan saat memuat dashboard.');
  }
}
