import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CashFlowRecord,
  CooperativeSummary,
  BusinessUnitTransaction,
  BusinessUnitKey,
  BusinessUnitReport,
  SimpanPinjamCashMutation,
  AuditLog,
} from '../types';
import {
  INITIAL_MEMBERS,
  INITIAL_SAVINGS,
  INITIAL_LOANS,
  INITIAL_REPAYMENTS,
  INITIAL_CASH_FLOW,
  INITIAL_BUSINESS_TRANSACTIONS,
  BUSINESS_UNITS_CONFIG,
} from '../data/mockData';

export const INITIAL_SP_CASH_MUTATIONS: SimpanPinjamCashMutation[] = [];

const KEYS = {
  MEMBERS: 'bjs_members_data',
  SAVINGS: 'bjs_savings_data',
  LOANS: 'bjs_loans_data',
  REPAYMENTS: 'bjs_repayments_data',
  CASHFLOW: 'bjs_cashflow_data',
  BUSINESS_UNITS: 'bjs_business_units_data',
  SP_CASH_MUTATIONS: 'bjs_sp_cash_mutations_data',
  AUDIT_LOGS: 'bjs_audit_logs_data',
};

const CLEAN_FLAG = 'bjs_financial_clean_v8';

export function ensureFinancialDataCleaned(): void {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(CLEAN_FLAG) !== 'true') {
      localStorage.setItem(KEYS.LOANS, JSON.stringify([]));
      localStorage.setItem(KEYS.REPAYMENTS, JSON.stringify([]));
      localStorage.setItem(KEYS.BUSINESS_UNITS, JSON.stringify([]));
      // Only keep genuine simpanan cashflow (Pokok, Wajib, Berjangka)
      localStorage.setItem(KEYS.CASHFLOW, JSON.stringify(INITIAL_CASH_FLOW));
      localStorage.removeItem('bjs_loans_v2');
      localStorage.removeItem('bjs_repayments_v2');
      localStorage.removeItem('bjs_bu_transactions');
      localStorage.removeItem('bjs_cashflow_v2');
      localStorage.removeItem('bjs_financial_clean_v5');
      localStorage.removeItem('bjs_financial_clean_v6');
      localStorage.setItem(CLEAN_FLAG, 'true');
    }
  } catch (e) {
    console.error('Failed to run financial data clean migration', e);
  }
}

// Auto-run cleanup when storage module loads
if (typeof window !== 'undefined') {
  ensureFinancialDataCleaned();
}

// Migration / Fallback helper
function getStoredOrDefault<T>(key: string, fallbackKey: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem(fallbackKey);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return defaultValue;
  }
}

export function loadMembers(): Member[] {
  const list = getStoredOrDefault<Member[]>(KEYS.MEMBERS, 'bjs_members_v2', INITIAL_MEMBERS);
  return list.map((m) => {
    if (m.id === 'BJS-001' && (!m.notes || !m.notes.includes('Berjangka'))) {
      return {
        ...m,
        initialTotalSavings: 6950000,
        notes: 'Total Simpanan Pokok, Wajib & Berjangka: Rp 6.950.000 (Termasuk Berjangka Rp 5.000.000)',
        job: m.job || 'Dinas Pemadam Kebakaran & Penyelamatan Kab. Cirebon',
      };
    }
    return {
      ...m,
      job: m.job || 'Dinas',
    };
  });
}

export function saveMembers(members: Member[]): void {
  try {
    localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
  } catch (e) {
    console.error('Failed to save members', e);
  }
}

export function loadSavings(): SavingsTransaction[] {
  let list = getStoredOrDefault<SavingsTransaction[]>(KEYS.SAVINGS, 'bjs_savings_v2', INITIAL_SAVINGS);
  // Ensure no sukarela savings exist (Koperasi BJS only has Pokok, Wajib, and Berjangka per AD/ART)
  list = list.filter((s) => (s.type as string) !== 'sukarela' && !s.id?.toLowerCase().includes('sukarela'));

  // Ensure BJS-001 berjangka transaction exists with all valid fields for seamless relational data sync
  const bjs001Idx = list.findIndex(
    (s) => s.id === 'SMP-BJS-001-BJK' || (s.memberId === 'BJS-001' && s.type === 'berjangka')
  );
  const bjs001Bjk: SavingsTransaction = {
    id: 'SMP-BJS-001-BJK',
    memberId: 'BJS-001',
    memberName: 'MOH. FERY AFRUDIN, S.STP',
    type: 'berjangka',
    txType: 'setor',
    amount: 5000000,
    date: '2025-01-15 10:00',
    adminName: 'Admin Bendahara BJS',
    statusBerjangka: 'aktif',
    termMonths: 12,
    annualInterestRate: 6.0,
    maturityDate: '2026-01-15',
    accruedInterest: 300000,
    interestPaymentSchedule: 'Dibayarkan saat RAT tahunan (ART Pasal 6 Ayat 6)',
    notes: 'Simpanan Berjangka Penyertaan Modal Koperasi Tenor 1 Tahun (Bunga 6% p.a.)',
  };

  if (bjs001Idx === -1) {
    list = [bjs001Bjk, ...list];
  } else {
    // Ensure all critical relational fields are present and valid
    list[bjs001Idx] = {
      ...bjs001Bjk,
      ...list[bjs001Idx],
      id: 'SMP-BJS-001-BJK',
      memberId: 'BJS-001',
      memberName: 'MOH. FERY AFRUDIN, S.STP',
      type: 'berjangka',
      txType: 'setor',
      statusBerjangka: list[bjs001Idx].statusBerjangka === 'selesai' ? 'selesai' : 'aktif',
      amount: list[bjs001Idx].amount || 5000000,
    };
  }
  try {
    localStorage.setItem(KEYS.SAVINGS, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to sync savings for BJS-001', e);
  }
  return list;
}

export function saveSavings(savings: SavingsTransaction[]): void {
  try {
    localStorage.setItem(KEYS.SAVINGS, JSON.stringify(savings));
  } catch (e) {
    console.error('Failed to save savings', e);
  }
}

export function loadLoans(): Loan[] {
  return getStoredOrDefault<Loan[]>(KEYS.LOANS, 'bjs_loans_v2', INITIAL_LOANS);
}

export function saveLoans(loans: Loan[]): void {
  try {
    localStorage.setItem(KEYS.LOANS, JSON.stringify(loans));
  } catch (e) {
    console.error('Failed to save loans', e);
  }
}

export function loadRepayments(): LoanRepayment[] {
  return getStoredOrDefault<LoanRepayment[]>(KEYS.REPAYMENTS, 'bjs_repayments_v2', INITIAL_REPAYMENTS);
}

export function saveRepayments(repayments: LoanRepayment[]): void {
  try {
    localStorage.setItem(KEYS.REPAYMENTS, JSON.stringify(repayments));
  } catch (e) {
    console.error('Failed to save repayments', e);
  }
}

export function loadCashFlow(): CashFlowRecord[] {
  return getStoredOrDefault<CashFlowRecord[]>(KEYS.CASHFLOW, 'bjs_cashflow_v2', INITIAL_CASH_FLOW);
}

export function saveCashFlow(records: CashFlowRecord[]): void {
  try {
    localStorage.setItem(KEYS.CASHFLOW, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save cashflow', e);
  }
}

export function loadBusinessTransactions(): BusinessUnitTransaction[] {
  return getStoredOrDefault<BusinessUnitTransaction[]>(KEYS.BUSINESS_UNITS, 'bjs_bu_transactions', INITIAL_BUSINESS_TRANSACTIONS);
}

export function saveBusinessTransactions(records: BusinessUnitTransaction[]): void {
  try {
    localStorage.setItem(KEYS.BUSINESS_UNITS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save business unit transactions', e);
  }
}

export function loadSpCashMutations(): SimpanPinjamCashMutation[] {
  return getStoredOrDefault<SimpanPinjamCashMutation[]>(
    KEYS.SP_CASH_MUTATIONS,
    'bjs_sp_cash_mutations',
    INITIAL_SP_CASH_MUTATIONS
  );
}

export function saveSpCashMutations(records: SimpanPinjamCashMutation[]): void {
  try {
    localStorage.setItem(KEYS.SP_CASH_MUTATIONS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save SP cash mutations', e);
  }
}

export function loadAuditLogs(): AuditLog[] {
  return getStoredOrDefault<AuditLog[]>(KEYS.AUDIT_LOGS, 'bjs_audit_logs', []);
}

export function saveAuditLogs(logs: AuditLog[]): void {
  try {
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save audit logs', e);
  }
}

/**
 * Calculate financial totals per business unit (Revenue, HPP, Operasional, Net Profit)
 */
export function calculateBusinessUnitReports(transactions: BusinessUnitTransaction[]): {
  reports: BusinessUnitReport[];
  totalRevenue: number;
  totalHPP: number;
  totalOperasional: number;
  totalProfit: number;
  profitByKey: Record<string, number>;
} {
  const result: Record<string, BusinessUnitReport> = {
    apar_sales: {
      unitId: 'alat_kebakaran',
      key: 'apar_sales',
      unitName: 'Penjualan Alat Proteksi Kebakaran',
      name: 'Penjualan Alat Proteksi Kebakaran',
      totalRevenue: 0,
      totalHPP: 0,
      totalOperasional: 0,
      grossProfit: 0,
      netProfit: 0,
    },
    apar_refill: {
      unitId: 'apar',
      key: 'apar_refill',
      unitName: 'Isi Ulang APAR',
      name: 'Isi Ulang APAR',
      totalRevenue: 0,
      totalHPP: 0,
      totalOperasional: 0,
      grossProfit: 0,
      netProfit: 0,
    },
    sembako: {
      unitId: 'sembako',
      key: 'sembako',
      unitName: 'Sembako',
      name: 'Sembako',
      totalRevenue: 0,
      totalHPP: 0,
      totalOperasional: 0,
      grossProfit: 0,
      netProfit: 0,
    },
    atribut: {
      unitId: 'atribut',
      key: 'atribut',
      unitName: 'Atribut',
      name: 'Atribut',
      totalRevenue: 0,
      totalHPP: 0,
      totalOperasional: 0,
      grossProfit: 0,
      netProfit: 0,
    },
  };

  for (const t of transactions) {
    const rawKey = t.unitKey || t.unitId;
    const mappedKey =
      rawKey === 'alat_kebakaran'
        ? 'apar_sales'
        : rawKey === 'apar'
        ? 'apar_refill'
        : rawKey;
    if (!mappedKey) continue;
    const report = result[mappedKey];
    if (!report) continue;
    if (t.type === 'pendapatan' || t.type === 'penjualan') {
      report.totalRevenue += t.amount;
    } else if (t.type === 'hpp' || t.type === 'hpp_beli_barang') {
      report.totalHPP += t.amount;
    } else if (t.type === 'operasional' || t.type === 'beban_operasional') {
      report.totalOperasional += t.amount;
    }
  }

  let totalRevenue = 0;
  let totalHPP = 0;
  let totalOperasional = 0;
  let totalProfit = 0;
  const profitByKey: Record<string, number> = {
    apar_sales: 0,
    apar_refill: 0,
    sembako: 0,
    atribut: 0,
    alat_kebakaran: 0,
    apar: 0,
  };

  const reports = Object.values(result).map((r) => {
    r.grossProfit = r.totalRevenue - r.totalHPP;
    r.netProfit = r.grossProfit - r.totalOperasional;
    totalRevenue += r.totalRevenue;
    totalHPP += r.totalHPP;
    totalOperasional += r.totalOperasional;
    totalProfit += r.netProfit;
    profitByKey[r.key] = r.netProfit;
    if (r.unitId) {
      profitByKey[r.unitId] = r.netProfit;
    }
    return r;
  });

  return {
    reports,
    totalRevenue,
    totalHPP,
    totalOperasional,
    totalProfit,
    profitByKey,
  };
}

/**
 * Auto-generate next registration number BJS-XXX
 * Example: if highest is BJS-217, generates BJS-218
 */
export function getNextMemberId(members: Member[]): string {
  let maxNum = 0;
  for (const m of members) {
    const match = m.id.match(/^BJS-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `BJS-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Calculate join year from total savings (Pokok Rp 200rb + Wajib Rp 50rb/bulan s/d Des 2025)
 */
export function calculateJoinDateFromSavings(totalSavings: number): {
  joinYear: number | string;
  months: number;
  joinDate: string;
} {
  if (totalSavings <= 0) {
    return { joinYear: '-', months: 0, joinDate: '2025-12-01' };
  }
  const wajibPart = Math.max(0, totalSavings - 200000);
  const months = Math.round(wajibPart / 50000);

  let y = 2025;
  let m = 12 - months;
  while (m <= 0) {
    y -= 1;
    m += 12;
  }

  const joinDate = `${y}-${String(m).padStart(2, '0')}-01`;
  return {
    joinYear: y,
    months,
    joinDate,
  };
}

export function calculateMemberSavings(memberId: string, savingsList: SavingsTransaction[]) {
  const memberTx = savingsList.filter((s) => s.memberId === memberId && (s.type as string) !== 'sukarela');
  let pokok = 0;
  let wajib = 0;
  let berjangka = 0;

  for (const tx of memberTx) {
    // If berjangka is marked as cancelled or deleted, ignore
    if (tx.type === 'berjangka' && tx.statusBerjangka === 'dibatalkan') {
      continue;
    }

    const sign = tx.txType === 'tarik' || (tx.txType as string) === 'penarikan' ? -1 : 1;
    if (tx.type === 'pokok') pokok += sign * tx.amount;
    else if (tx.type === 'wajib') wajib += sign * tx.amount;
    else if (tx.type === 'berjangka') {
      // If completed (selesai/dicairkan), it doesn't count towards active principal balance
      if (tx.statusBerjangka === 'selesai') {
        // completed/withdrawn
      } else {
        berjangka += sign * tx.amount;
      }
    }
  }

  pokok = Math.max(0, pokok);
  wajib = Math.max(0, wajib);
  berjangka = Math.max(0, berjangka);

  return {
    pokok,
    wajib,
    berjangka,
    sukarela: 0,
    total: pokok + wajib + berjangka,
  };
}

export function calculateLoanRemaining(loan: Loan): {
  paidPrincipal: number;
  remainingPrincipal: number;
  remainingTotal: number;
  paidCount: number;
} {
  let paidPrincipal = 0;
  let remainingPrincipal = 0;
  let remainingTotal = 0;
  let paidCount = 0;

  for (const item of loan.schedules) {
    if (item.isPaid) {
      paidPrincipal += item.principal;
      paidCount++;
    } else {
      remainingPrincipal += item.principal;
      remainingTotal += item.totalInstallment;
    }
  }

  return {
    paidPrincipal,
    remainingPrincipal,
    remainingTotal,
    paidCount,
  };
}

export function computeCooperativeSummary(
  members: Member[],
  savings: SavingsTransaction[],
  loans: Loan[],
  repayments: LoanRepayment[],
  cashFlow: CashFlowRecord[],
  businessTransactions: BusinessUnitTransaction[] = [],
  spCashMutations: SimpanPinjamCashMutation[] = []
): CooperativeSummary {
  // Hitung total simpanan
  let pokok = 0;
  let wajib = 0;
  let berjangka = 0;

  for (const tx of savings) {
    if ((tx.type as string) === 'sukarela') continue;
    if (tx.type === 'berjangka' && tx.statusBerjangka === 'dibatalkan') continue;

    const sign = tx.txType === 'tarik' || (tx.txType as string) === 'penarikan' ? -1 : 1;
    if (tx.type === 'pokok') pokok += sign * tx.amount;
    else if (tx.type === 'wajib') wajib += sign * tx.amount;
    else if (tx.type === 'berjangka') {
      if (tx.statusBerjangka !== 'selesai') {
        berjangka += sign * tx.amount;
      }
    }
  }

  pokok = Math.max(0, pokok);
  wajib = Math.max(0, wajib);
  berjangka = Math.max(0, berjangka);
  const totalSavings = pokok + wajib + berjangka;

  // Hitung pinjaman & workflow
  let totalDisbursedLoans = 0;
  let totalOutstandingLoans = 0;
  let activeLoansCount = 0;

  const workflowCount = {
    diajukan: 0,
    review: 0,
    disetujui: 0,
    dicairkan: 0,
  };

  for (const l of loans) {
    // Normalisasi workflow status
    if (l.status === 'diajukan') workflowCount.diajukan++;
    else if (l.status === 'menunggu' || l.status === 'review') workflowCount.review++;
    else if (l.status === 'disetujui') workflowCount.disetujui++;
    else if (l.status === 'aktif' || l.status === 'dicairkan') workflowCount.dicairkan++;

    if (l.status === 'aktif' || l.status === 'dicairkan' || l.status === 'lunas') {
      totalDisbursedLoans += l.amount;
    }
    if (l.status === 'aktif' || l.status === 'dicairkan') {
      activeLoansCount++;
      const { remainingPrincipal } = calculateLoanRemaining(l);
      totalOutstandingLoans += remainingPrincipal;
    }
  }

  // Hitung pendapatan bunga angsuran
  let totalInterestEarned = 0;
  for (const r of repayments) {
    totalInterestEarned += r.interestAmount;
  }

  // Request #10: Uang administrasi 1% dialokasikan khusus untuk Kas Operasional Unit Simpan Pinjam (Bukan Kas Koperasi)
  let totalOperasionalSP = 0;
  for (const l of loans) {
    if (l.status === 'aktif' || l.status === 'dicairkan' || l.status === 'lunas') {
      totalOperasionalSP += l.adminFee;
    }
  }

  // Hitung Kas Koperasi untuk Simpan Pinjam
  // (Penerimaan simpanan, pencairan pinjaman, dan angsuran yang masuk)
  // Dipisahkan antara Kas Tunai Fisik (kas_koperasi) dan Kas di Bank (kas_bank)
  let totalCash = 0;
  let totalCashFisik = 0;
  let totalCashBank = 0;
  for (const cf of cashFlow) {
    // Abaikan kategori biaya admin dari kas utama koperasi karena dialihkan ke operasional SP
    if (cf.category === 'biaya_admin' || cf.targetAccount === 'kas_operasional_sp') {
      continue;
    }
    const delta = cf.type === 'masuk' ? cf.amount : -cf.amount;
    totalCash += delta;
    if (cf.targetAccount === 'kas_bank') {
      totalCashBank += delta;
    } else {
      totalCashFisik += delta;
    }
  }

  for (const r of repayments) {
    const alreadyLogged = cashFlow.some((cf) => cf.referenceId === r.id);
    if (!alreadyLogged) {
      totalCash += r.totalPaid;
      totalCashFisik += r.totalPaid;
    }
  }

  // Hitung anggota aktif, pasif, keluar
  const membersCount = {
    aktif: members.filter((m) => m.status === 'aktif').length,
    pasif: members.filter((m) => m.status === 'pasif').length,
    keluar: members.filter((m) => m.status === 'keluar' || m.status === 'nonaktif').length,
    total: members.length,
  };

  // Hitung keuntungan unit usaha
  const buCalc = calculateBusinessUnitReports(businessTransactions);

  // Hitung modal awal koperasi (jika ada input riil dari cashflow, jika tidak 0)
  const modalAwalRecord = cashFlow.find(
    (cf) => cf.referenceId === 'MODAL-PENDIRIAN-BJS' || cf.description?.toLowerCase().includes('modal awal')
  );
  const modalAwal = modalAwalRecord ? modalAwalRecord.amount : 0;

  // Beban operasional umum koperasi di luar beban unit usaha
  let totalExpenses = 0;
  for (const cf of cashFlow) {
    if (cf.type === 'keluar' && cf.category === 'operasional' && !cf.referenceId?.startsWith('TRX-') && cf.referenceId !== 'MODAL-PENDIRIAN-BJS') {
      totalExpenses += cf.amount;
    }
  }

  // Kas Unit Simpan Pinjam (sinkron dari mutasi kas unit simpan pinjam: saldo awal Rp 0 + penambahan - pengurangan)
  const totalPenambahanSP = spCashMutations
    .filter((m) => m.type === 'penambahan')
    .reduce((sum, m) => sum + m.amount, 0);
  const totalPenguranganSP = spCashMutations
    .filter((m) => m.type === 'pengurangan')
    .reduce((sum, m) => sum + m.amount, 0);
  const kasUnitSP = 0 + totalPenambahanSP - totalPenguranganSP;

  return {
    totalCash,
    totalCashFisik,
    totalCashBank,
    totalOperasionalSP,
    kasUnitSP,
    totalSavings: {
      pokok,
      wajib,
      berjangka,
      sukarela: 0,
      total: totalSavings,
    },
    totalDisbursedLoans,
    totalOutstandingLoans,
    totalInterestEarned,
    membersCount,
    loanWorkflowCount: workflowCount,
    businessUnitProfits: buCalc.profitByKey,
    totalBusinessProfit: buCalc.totalProfit,
    modalAwal,
    totalExpenses,
    activeMembersCount: membersCount.aktif,
    activeLoansCount,
  };
}

export function resetToDemoData(): void {
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify(INITIAL_MEMBERS));
  localStorage.setItem(KEYS.SAVINGS, JSON.stringify(INITIAL_SAVINGS));
  localStorage.setItem(KEYS.LOANS, JSON.stringify(INITIAL_LOANS));
  localStorage.setItem(KEYS.REPAYMENTS, JSON.stringify(INITIAL_REPAYMENTS));
  localStorage.setItem(KEYS.CASHFLOW, JSON.stringify(INITIAL_CASH_FLOW));
  localStorage.setItem(KEYS.BUSINESS_UNITS, JSON.stringify(INITIAL_BUSINESS_TRANSACTIONS));
  localStorage.setItem(KEYS.SP_CASH_MUTATIONS, JSON.stringify(INITIAL_SP_CASH_MUTATIONS));
}
