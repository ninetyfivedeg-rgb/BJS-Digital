import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './components/DashboardView';
import { AnggotaView } from './components/AnggotaView';
import { SimpananView } from './components/SimpananView';
import { PinjamanView } from './components/PinjamanView';
import { SimulasiView } from './components/SimulasiView';
import { ShuView } from './components/ShuView';
import { LaporanUnitUsahaView } from './components/LaporanUnitUsahaView';
import { LaporanView } from './components/LaporanView';
import { ReceiptModal, ReceiptData } from './components/ReceiptModal';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CashFlowRecord,
  LoanScheduleItem,
  BusinessUnitTransaction,
  BusinessUnitId,
  UserRole,
  AuthUser,
  SimpanPinjamCashMutation,
  AuditLog,
} from './types';
import { BUSINESS_UNITS_CONFIG } from './data/mockData';
import {
  loadMembers,
  saveMembers,
  loadSavings,
  saveSavings,
  loadLoans,
  saveLoans,
  loadRepayments,
  saveRepayments,
  loadCashFlow,
  saveCashFlow,
  loadBusinessTransactions,
  saveBusinessTransactions,
  loadSpCashMutations,
  saveSpCashMutations,
  loadAuditLogs,
  saveAuditLogs,
  calculateBusinessUnitReports,
  computeCooperativeSummary,
  resetToDemoData,
  getNextMemberId,
} from './utils/storage';
import { supabase } from './lib/supabase';
import { logoutUser, fetchUserProfile } from './utils/auth';
import { fetchMembersFromSupabase } from './services/memberService';
import {
  fetchSavingsFromSupabase,
  createSavingsTransaction,
  createBatchSavingsTransactions,
} from './services/savingsService';
import {
  fetchLoansFromSupabase,
  createLoan,
  createLoanRepayment,
  updateLoanScheduleStatus,
  approveLoan,
  rejectLoan,
  deleteLoan,
} from './services/loanService';
import {
  fetchCashFlowFromSupabase,
  createCashFlowRecord,
  deleteCashFlowRecord,
} from './services/cashFlowService';
import {
  fetchBusinessUnitsAndTransactionsFromSupabase,
  createBusinessUnitTransaction,
  deleteBusinessUnitTransaction,
} from './services/businessUnitService';
import { fetchAuditLogsFromSupabase } from './services/auditLogService';
import { fetchDashboardDataFromSupabase } from './services/dashboardService';
import { fetchReportDataFromSupabase } from './services/reportService';
import { AuditLogView } from './components/AuditLogView';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Subscribe to Supabase Auth session & changes
  useEffect(() => {
    let isMounted = true;

    // 1. Dapatkan sesi aktif saat aplikasi pertama kali dimuat
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const userProfile = await fetchUserProfile(
          session.user.id,
          undefined,
          session.user.email
        );
        if (isMounted) {
          setCurrentUser(userProfile);
          if (userProfile?.mustChangePassword) {
            setIsChangePasswordOpen(true);
          }
        }
      }
      if (isMounted) {
        setIsAuthChecking(false);
      }
    });

    // 2. Dengarkan perubahan sesi autentikasi (Login, Logout, Refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        setIsChangePasswordOpen(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session.user) {
          const userProfile = await fetchUserProfile(
            session.user.id,
            undefined,
            session.user.email
          );
          if (isMounted) {
            setCurrentUser(userProfile);
            if (userProfile?.mustChangePassword) {
              setIsChangePasswordOpen(true);
            }
          }
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Navigation States
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeUnitId, setActiveUnitId] = useState<'semua' | BusinessUnitId>('semua');
  const [activeSavingsSubTab, setActiveSavingsSubTab] = useState<'pokok_wajib' | 'berjangka' | 'mutasi'>('pokok_wajib');
  const [activeLoanSubTab, setActiveLoanSubTab] = useState<'daftar_pinjaman' | 'kas_unit_sp'>('daftar_pinjaman');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data States
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isMembersFromSupabase, setIsMembersFromSupabase] = useState(false);

  const reloadMembers = async () => {
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetchMembersFromSupabase();
      setMembers(res.members);
      setIsMembersFromSupabase(res.fromSupabase);
      if (res.error) {
        setMembersError(res.error);
      }
    } catch {
      setMembersError('Terjadi kendala saat menyinkronkan data anggota.');
    } finally {
      setIsMembersLoading(false);
    }
  };

  // Muat data dashboard, laporan, anggota, simpanan, pinjaman, buku kas, unit usaha, dan audit log dari Supabase saat sesi pengguna aktif
  useEffect(() => {
    if (currentUser) {
      reloadDashboard();
      reloadReport();
      reloadMembers();
      reloadSavings();
      reloadLoans();
      reloadCashFlow();
      reloadBusinessUnits();
      reloadAuditLogs();
    }
  }, [currentUser]);
  const [savings, setSavings] = useState<SavingsTransaction[]>(() => loadSavings());
  const [isSavingsLoading, setIsSavingsLoading] = useState(false);
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [isSavingsFromSupabase, setIsSavingsFromSupabase] = useState(false);

  const reloadSavings = async (membersList?: Member[]) => {
    setIsSavingsLoading(true);
    setSavingsError(null);
    try {
      const res = await fetchSavingsFromSupabase(membersList || members);
      setSavings(res.savings);
      setIsSavingsFromSupabase(res.fromSupabase);
      if (res.error) {
        setSavingsError(res.error);
      }
    } catch {
      setSavingsError('Terjadi kendala saat menyinkronkan data simpanan.');
    } finally {
      setIsSavingsLoading(false);
    }
  };
  const [loans, setLoans] = useState<Loan[]>(() => loadLoans());
  const [repayments, setRepayments] = useState<LoanRepayment[]>(() => loadRepayments());
  const [isLoansLoading, setIsLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState<string | null>(null);
  const [isLoansFromSupabase, setIsLoansFromSupabase] = useState(false);

  const reloadLoans = async (membersList?: Member[]) => {
    setIsLoansLoading(true);
    setLoansError(null);
    try {
      const res = await fetchLoansFromSupabase(membersList || members);
      setLoans(res.loans);
      setRepayments(res.repayments);
      setIsLoansFromSupabase(res.fromSupabase);
      if (res.error) {
        setLoansError(res.error);
      }
    } catch {
      setLoansError('Terjadi kendala saat menyinkronkan data pinjaman.');
    } finally {
      setIsLoansLoading(false);
    }
  };
  const [cashFlow, setCashFlow] = useState<CashFlowRecord[]>(() => loadCashFlow());
  const [isCashFlowLoading, setIsCashFlowLoading] = useState(false);
  const [cashFlowError, setCashFlowError] = useState<string | null>(null);
  const [isCashFlowFromSupabase, setIsCashFlowFromSupabase] = useState(false);

  const reloadCashFlow = async () => {
    setIsCashFlowLoading(true);
    setCashFlowError(null);
    try {
      const res = await fetchCashFlowFromSupabase();
      setCashFlow(res.cashFlow);
      setIsCashFlowFromSupabase(res.fromSupabase);
      if (res.error) {
        setCashFlowError(res.error);
      }
    } catch {
      setCashFlowError('Terjadi kendala saat menyinkronkan buku kas.');
    } finally {
      setIsCashFlowLoading(false);
    }
  };
  const [businessTransactions, setBusinessTransactions] = useState<BusinessUnitTransaction[]>(() =>
    loadBusinessTransactions()
  );
  const [isBusinessLoading, setIsBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [isBusinessFromSupabase, setIsBusinessFromSupabase] = useState(false);

  const reloadBusinessUnits = async () => {
    setIsBusinessLoading(true);
    setBusinessError(null);
    try {
      const res = await fetchBusinessUnitsAndTransactionsFromSupabase();
      setBusinessTransactions(res.transactions);
      setIsBusinessFromSupabase(res.fromSupabase);
      if (res.error) {
        setBusinessError(res.error);
      }
    } catch {
      setBusinessError('Terjadi kendala saat menyinkronkan data unit usaha.');
    } finally {
      setIsBusinessLoading(false);
    }
  };

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadAuditLogs());
  const [isAuditLogsLoading, setIsAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [isAuditLogsFromSupabase, setIsAuditLogsFromSupabase] = useState(false);

  const reloadAuditLogs = async () => {
    setIsAuditLogsLoading(true);
    setAuditLogsError(null);
    try {
      const res = await fetchAuditLogsFromSupabase();
      setAuditLogs(res.auditLogs);
      setIsAuditLogsFromSupabase(res.fromSupabase);
      if (res.error) {
        setAuditLogsError(res.error);
      }
    } catch {
      setAuditLogsError('Terjadi kendala saat menyinkronkan rekam jejak audit.');
    } finally {
      setIsAuditLogsLoading(false);
    }
  };

  // Dashboard Aggregator State
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isDashboardFromSupabase, setIsDashboardFromSupabase] = useState(false);

  const reloadDashboard = async () => {
    setIsDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetchDashboardDataFromSupabase(
        currentUser?.role || 'pengurus',
        currentUser?.memberId || currentUser?.username
      );
      if (res.members && res.members.length > 0) {
        setMembers(res.members);
      }
      setSavings(res.savings);
      setLoans(res.loans);
      setRepayments(res.repayments);
      setCashFlow(res.cashFlow);
      setBusinessTransactions(res.businessTransactions);
      setIsDashboardFromSupabase(res.fromSupabase);
      if (res.error) {
        setDashboardError(res.error);
      }
    } catch {
      setDashboardError('Terjadi kendala saat menyinkronkan data dashboard.');
    } finally {
      setIsDashboardLoading(false);
    }
  };

  // Laporan Aggregator State
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isReportFromSupabase, setIsReportFromSupabase] = useState(false);

  const reloadReport = async () => {
    setIsReportLoading(true);
    setReportError(null);
    try {
      const res = await fetchReportDataFromSupabase(
        currentUser?.role || 'pengurus',
        currentUser?.memberId || currentUser?.username
      );
      if (res.members && res.members.length > 0) {
        setMembers(res.members);
      }
      setSavings(res.savings);
      setLoans(res.loans);
      setRepayments(res.repayments);
      setCashFlow(res.cashFlow);
      setBusinessTransactions(res.businessTransactions);
      setIsReportFromSupabase(res.fromSupabase);
      if (res.error) {
        setReportError(res.error);
      }
    } catch {
      setReportError('Terjadi kendala saat menyinkronkan data laporan.');
    } finally {
      setIsReportLoading(false);
    }
  };
  const [spCashMutations, setSpCashMutations] = useState<SimpanPinjamCashMutation[]>(() => loadSpCashMutations());

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Trigger states for quick shortcuts across views
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isBerjangkaModalOpen, setIsBerjangkaModalOpen] = useState(false);
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);
  const [preselectedLoanIdForRepayment, setPreselectedLoanIdForRepayment] = useState<string | null>(null);
  const [initialSelectedMemberId, setInitialSelectedMemberId] = useState<string | undefined>(undefined);

  // Role state: derived from active authenticated user (or fallback)
  const userRole: UserRole = currentUser?.role || 'pengurus';

  // Synchronize to localStorage
  useEffect(() => {
    saveMembers(members);
  }, [members]);

  // Transaksi baru disimpan murni ke Supabase PostgreSQL sebagai single source of truth (tidak ke localStorage)

  useEffect(() => {
    saveLoans(loans);
  }, [loans]);

  useEffect(() => {
    saveRepayments(repayments);
  }, [repayments]);

  useEffect(() => {
    saveCashFlow(cashFlow);
  }, [cashFlow]);

  useEffect(() => {
    saveBusinessTransactions(businessTransactions);
  }, [businessTransactions]);

  useEffect(() => {
    if (auditLogs && auditLogs.length > 0) {
      saveAuditLogs(auditLogs);
    }
  }, [auditLogs]);

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    if (user.mustChangePassword) {
      setIsChangePasswordOpen(true);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setIsChangePasswordOpen(false);
  };

  const handlePasswordChanged = () => {
    setCurrentUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    setIsChangePasswordOpen(false);
  };

  // Compute Unit Usaha & Summary
  const buCalc = calculateBusinessUnitReports(businessTransactions);
  const summary = computeCooperativeSummary(
    members,
    savings,
    loans,
    repayments,
    cashFlow,
    businessTransactions,
    spCashMutations
  );
  const pendingLoansCount = loans.filter((l) => l.status === 'menunggu').length;

  const handleAddBusinessTransaction = async (
    txData: Omit<BusinessUnitTransaction, 'id'>
  ): Promise<{ success: boolean; message: string; data?: BusinessUnitTransaction; error?: string }> => {
    const result = await createBusinessUnitTransaction(
      {
        unitId:
          (txData.unitId as BusinessUnitId) ||
          (txData.unitKey === 'apar_sales'
            ? 'alat_kebakaran'
            : txData.unitKey === 'apar_refill'
            ? 'apar'
            : (txData.unitKey as BusinessUnitId) || 'alat_kebakaran'),
        unitKey: txData.unitKey,
        date: txData.date,
        type: txData.type,
        amount: txData.amount,
        description: txData.description || txData.title || '',
        title: txData.title,
        partyName: txData.partyName,
        notes: txData.notes,
        recordedBy: txData.recordedBy,
      },
      currentUser
    );

    if (!result.success) {
      alert(`Gagal mencatat transaksi unit usaha: ${result.message}`);
      return result;
    }

    // Refresh data Unit Usaha, Dashboard, Laporan, dan Audit Log langsung dari Supabase sebagai Single Source of Truth
    await reloadBusinessUnits();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();

    return result;
  };

  const handleDeleteBusinessTransaction = async (txId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus transaksi unit usaha ini dari database?')) {
      return;
    }
    const result = await deleteBusinessUnitTransaction(txId, currentUser);
    if (!result.success) {
      alert(`Gagal menghapus transaksi unit usaha: ${result.message}`);
      return;
    }
    await reloadBusinessUnits();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();
  };

  // Member Handlers
  const handleAddMember = (newMemberData: Omit<Member, 'id'>, initialPokok: number) => {
    const newId = getNextMemberId(members);
    const newMember: Member = {
      id: newId,
      ...newMemberData,
    };

    const updatedMembers = [...members, newMember];
    setMembers(updatedMembers);

    // If initial simpanan pokok is provided, record it
    if (initialPokok > 0) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 16).replace('T', ' ');
      const txId = `SMP-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        savings.length + 1
      ).padStart(3, '0')}`;

      const newSavingsTx: SavingsTransaction = {
        id: txId,
        memberId: newId,
        memberName: newMember.name,
        type: 'pokok',
        txType: 'setor',
        amount: initialPokok,
        date: dateStr,
        adminName: 'Admin Koperasi',
        notes: 'Setoran Simpanan Pokok awal pendaftaran',
      };
      setSavings((prev) => [...prev, newSavingsTx]);

      // Record in cash flow
      const cfRecord: CashFlowRecord = {
        id: `CSH-${Date.now().toString().slice(-5)}`,
        date: dateStr.split(' ')[0],
        type: 'masuk',
        category: 'simpanan',
        amount: initialPokok,
        referenceId: txId,
        description: `Setoran Simpanan Pokok - ${newMember.name} (${newId})`,
      };
      setCashFlow((prev) => [...prev, cfRecord]);
    }
  };

  const handleEditMember = (updatedMember: Member) => {
    setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)));
  };

  const handleDeleteMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    // Also remove associated savings, loans, and repayments
    setSavings((prev) => prev.filter((s) => s.memberId !== memberId));
    setLoans((prev) => prev.filter((l) => l.memberId !== memberId));
    setRepayments((prev) => prev.filter((r) => r.memberId !== memberId));
  };

  // Savings Handlers: Terhubung langsung ke Supabase PostgreSQL
  const handleAddSavings = async (
    txData: Omit<SavingsTransaction, 'id'>
  ): Promise<{ success: boolean; message: string; data?: SavingsTransaction; error?: string }> => {
    const result = await createSavingsTransaction(txData, currentUser, members);

    if (!result.success) {
      return result;
    }

    // Refresh data simpanan langsung dari Supabase sebagai single source of truth
    await reloadSavings();

    return result;
  };

  const handleBatchAddWajib = async (
    transactions: Omit<SavingsTransaction, 'id'>[]
  ): Promise<{ success: boolean; message: string; data?: SavingsTransaction[]; error?: string }> => {
    const result = await createBatchSavingsTransactions(transactions, currentUser, members);

    if (!result.success) {
      return result;
    }

    // Refresh data simpanan langsung dari Supabase sebagai single source of truth
    await reloadSavings();

    return result;
  };

  const handleCompleteBerjangka = (savingsId: string) => {
    const target = savings.find((s) => s.id === savingsId);
    if (!target) return;

    setSavings((prev) =>
      prev.map((s) => (s.id === savingsId ? { ...s, statusBerjangka: 'selesai' as const } : s))
    );

    const todayDate = new Date().toISOString().split('T')[0];
    const interestAmount = target.accruedInterest || Math.round(target.amount * 0.06);

    const cfPrincipal: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}-1`,
      date: todayDate,
      type: 'keluar',
      category: 'tarik_simpanan',
      amount: target.amount,
      referenceId: target.id,
      description: `Pencairan Pokok Simpanan Berjangka ${target.id} - ${target.memberName}`,
    };

    const cfInterest: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}-2`,
      date: todayDate,
      type: 'keluar',
      category: 'operasional',
      amount: interestAmount,
      referenceId: target.id,
      description: `Pembayaran Bunga Simpanan Berjangka 6% ${target.id} - ${target.memberName}`,
    };

    setCashFlow((prev) => [...prev, cfPrincipal, cfInterest]);
  };

  const handleDeleteSavings = (savingsId: string) => {
    setSavings((prev) => prev.filter((s) => s.id !== savingsId));
  };

  // Loan Handlers: Terhubung langsung ke Supabase PostgreSQL sebagai Single Source of Truth
  const handleUpdateSchedulePayment = async (
    loanId: string,
    month: number,
    isPaid: boolean,
    paidDate?: string
  ) => {
    await updateLoanScheduleStatus(
      {
        loanId,
        installmentNo: month,
        isPaid,
        paidDate,
      },
      currentUser
    );

    // Refresh data pinjaman, dashboard, dan laporan langsung dari Supabase
    await reloadLoans();
    await reloadDashboard();
    await reloadReport();
  };

  const handleAddLoan = async (
    loanData: Omit<
      Loan,
      'id' | 'monthlyPrincipal' | 'monthlyInterest' | 'monthlyTotal' | 'totalLoanAmount' | 'schedules'
    >
  ) => {
    const result = await createLoan(
      {
        memberId: loanData.memberId,
        memberName: loanData.memberName,
        amount: loanData.amount,
        tenorMonths: loanData.tenorMonths,
        interestRatePerMonth: loanData.interestRatePerMonth,
        adminFee: loanData.adminFee,
        startDate: loanData.startDate,
        status: loanData.status,
        purpose: loanData.purpose,
        approvedDate: loanData.approvedDate,
        disbursedDate: loanData.disbursedDate,
        notes: loanData.notes,
      },
      currentUser,
      members
    );

    if (!result.success) {
      alert(`Gagal mencatat pinjaman: ${result.message}`);
      return result;
    }

    // Refresh data pinjaman, buku kas, dashboard, laporan, dan audit log langsung dari Supabase
    await reloadLoans();
    await reloadCashFlow();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();

    return result;
  };

  const handleApproveLoan = async (loanId: string) => {
    const result = await approveLoan(loanId, currentUser, loans);
    if (!result.success) {
      alert(`Gagal menyetujui pinjaman: ${result.message}`);
      return;
    }

    await reloadLoans();
    await reloadCashFlow();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();
  };

  const handleRejectLoan = async (loanId: string) => {
    const result = await rejectLoan(loanId, currentUser);
    if (!result.success) {
      alert(`Gagal menolak pinjaman: ${result.message}`);
      return;
    }

    await reloadLoans();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();
  };

  const handleDeleteLoan = async (loanId: string) => {
    const result = await deleteLoan(loanId, currentUser);
    if (!result.success) {
      alert(`Gagal menghapus pinjaman: ${result.message}`);
      return;
    }

    await reloadLoans();
    await reloadCashFlow();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();
  };

  const handlePayInstallment = async ({
    loanId,
    installmentNo,
    penalty,
    notes,
    adminName,
  }: {
    loanId: string;
    installmentNo: number;
    penalty: number;
    notes?: string;
    adminName: string;
  }) => {
    const result = await createLoanRepayment(
      {
        loanId,
        installmentNo,
        penalty,
        notes,
        adminName,
      },
      currentUser,
      loans,
      members
    );

    if (!result.success) {
      alert(`Gagal mencatat pembayaran angsuran: ${result.message}`);
      return result;
    }

    // Refresh data pinjaman, kas, dashboard, laporan, dan audit log langsung dari Supabase
    await reloadLoans();
    await reloadCashFlow();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();

    return result;
  };

  const handleAddCashFlow = async (
    record: Omit<CashFlowRecord, 'id'>
  ): Promise<{ success: boolean; message: string; data?: CashFlowRecord; error?: string }> => {
    const result = await createCashFlowRecord(
      {
        date: record.date,
        type: record.type,
        category: record.category,
        amount: record.amount,
        description: record.description,
        referenceId: record.referenceId,
        targetAccount: record.targetAccount as 'kas_koperasi' | 'kas_bank',
      },
      currentUser
    );

    if (!result.success) {
      alert(`Gagal mencatat transaksi kas: ${result.message}`);
      return result;
    }

    // Refresh data mutasi kas, dashboard, laporan, dan audit log langsung dari Supabase
    await reloadCashFlow();
    await reloadDashboard();
    await reloadReport();
    await reloadAuditLogs();

    return result;
  };

  const handleAddSpCashMutation = (mutationData: Omit<SimpanPinjamCashMutation, 'id' | 'createdAt'>) => {
    const id = `KAS-SP-${Date.now().toString().slice(-6)}`;
    const newMutation: SimpanPinjamCashMutation = {
      ...mutationData,
      id,
      createdAt: new Date().toISOString(),
    };

    const updated = [newMutation, ...spCashMutations];
    setSpCashMutations(updated);
    saveSpCashMutations(updated);

    // Sync into cashflow
    const newRecord: CashFlowRecord = {
      id: `CSH-SP-${Date.now().toString().slice(-6)}`,
      date: newMutation.date,
      type: newMutation.type === 'penambahan' ? 'masuk' : 'keluar',
      category: newMutation.type === 'penambahan' ? 'simpanan' : 'operasional_sp',
      amount: newMutation.amount,
      referenceId: id,
      description: `[KAS UNIT SP] ${newMutation.category}: ${newMutation.description}`,
      targetAccount: 'kas_operasional_sp',
    };
    const updatedCashFlow = [newRecord, ...cashFlow];
    setCashFlow(updatedCashFlow);
    saveCashFlow(updatedCashFlow);
  };

  const handleDeleteSpCashMutation = (id: string) => {
    const updated = spCashMutations.filter((m) => m.id !== id);
    setSpCashMutations(updated);
    saveSpCashMutations(updated);

    const updatedCashFlow = cashFlow.filter((cf) => cf.referenceId !== id);
    setCashFlow(updatedCashFlow);
    saveCashFlow(updatedCashFlow);
  };

  const handleResetData = () => {
    resetToDemoData();
    setMembers(loadMembers());
    setSavings(loadSavings());
    setLoans(loadLoans());
    setRepayments(loadRepayments());
    setCashFlow(loadCashFlow());
    setBusinessTransactions(loadBusinessTransactions());
    setSpCashMutations(loadSpCashMutations());
  };

  const handleImportData = (importedData: any) => {
    if (importedData.members) setMembers(importedData.members);
    if (importedData.savings) setSavings(importedData.savings);
    if (importedData.loans) setLoans(importedData.loans);
    if (importedData.repayments) setRepayments(importedData.repayments);
    if (importedData.cashFlow) setCashFlow(importedData.cashFlow);
    if (importedData.businessTransactions) setBusinessTransactions(importedData.businessTransactions);
    if (importedData.spCashMutations) setSpCashMutations(importedData.spCashMutations);
  };

  // Loading screen saat memeriksa sesi Supabase Auth awal
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <img
          src="/logo-bjs.png"
          alt="Logo BJS Digital"
          className="h-16 w-auto mb-4 animate-pulse"
        />
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Memverifikasi sesi pengguna...</span>
        </div>
      </div>
    );
  }

  // If user is not logged in, display the dedicated Login Page
  if (!currentUser) {
    return <LoginView members={members} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row antialiased">
      {/* Left Sidebar Navigation with Logo at Top-Left */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSavingsSubTab={activeSavingsSubTab}
        setActiveSavingsSubTab={setActiveSavingsSubTab}
        activeLoanSubTab={activeLoanSubTab}
        setActiveLoanSubTab={setActiveLoanSubTab}
        activeUnitId={activeUnitId}
        setActiveUnitId={setActiveUnitId}
        pendingLoansCount={pendingLoansCount}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          currentUser={currentUser}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              members={members}
              savings={savings}
              loans={loans}
              repayments={repayments}
              unitReports={buCalc.reports}
              businessTransactions={businessTransactions}
              spCashMutations={spCashMutations}
              onNavigate={(tab) => setActiveTab(tab)}
              onNavigateToKasSP={() => {
                setActiveTab('pinjaman');
                setActiveLoanSubTab('kas_unit_sp');
              }}
              onOpenNewMember={() => {
                setActiveTab('anggota');
              }}
              onOpenDeposit={() => {
                setActiveTab('simpanan');
                setActiveSavingsSubTab('pokok_wajib');
                setIsDepositModalOpen(true);
              }}
              onOpenBerjangka={() => {
                setActiveTab('simpanan');
                setActiveSavingsSubTab('berjangka');
                setIsBerjangkaModalOpen(true);
              }}
              onOpenNewLoan={() => {
                setActiveTab('pinjaman');
                setActiveLoanSubTab('daftar_pinjaman');
                setIsNewLoanModalOpen(true);
              }}
              onOpenRepayment={(loanId) => {
                setActiveTab('pinjaman');
                setActiveLoanSubTab('daftar_pinjaman');
                setPreselectedLoanIdForRepayment(loanId || null);
              }}
              userRole={userRole}
              currentUser={currentUser}
              isLoading={isDashboardLoading}
              error={dashboardError}
              isFromSupabase={isDashboardFromSupabase || isMembersFromSupabase || isSavingsFromSupabase}
              onRefresh={reloadDashboard}
            />
          )}

          {activeTab === 'anggota' && (
            <AnggotaView
              members={members}
              savings={savings}
              loans={loans}
              onAddMember={handleAddMember}
              onEditMember={handleEditMember}
              onDeleteMember={handleDeleteMember}
              onQuickDeposit={(memberId) => {
                setInitialSelectedMemberId(memberId);
                setActiveTab('simpanan');
                setActiveSavingsSubTab('pokok_wajib');
                setIsDepositModalOpen(true);
              }}
              onQuickLoan={(memberId) => {
                setInitialSelectedMemberId(memberId);
                setActiveTab('pinjaman');
                setIsNewLoanModalOpen(true);
              }}
              userRole={userRole}
              currentUser={currentUser}
              isLoading={isMembersLoading}
              error={membersError}
              isFromSupabase={isMembersFromSupabase}
              onRefresh={reloadMembers}
            />
          )}

          {activeTab === 'simpanan' && (
            <SimpananView
              members={members}
              savings={savings}
              onAddSavings={handleAddSavings}
              onBatchAddWajib={handleBatchAddWajib}
              onCompleteBerjangka={handleCompleteBerjangka}
              onDeleteSavings={handleDeleteSavings}
              onShowReceipt={(receipt) => setActiveReceipt(receipt)}
              initialSelectedMemberId={initialSelectedMemberId}
              activeSubTab={activeSavingsSubTab}
              setActiveSubTab={setActiveSavingsSubTab}
              isDepositModalOpen={isDepositModalOpen}
              setIsDepositModalOpen={setIsDepositModalOpen}
              isBerjangkaModalOpen={isBerjangkaModalOpen}
              setIsBerjangkaModalOpen={setIsBerjangkaModalOpen}
              userRole={userRole}
              currentUser={currentUser}
              isLoading={isSavingsLoading}
              error={savingsError}
              isFromSupabase={isSavingsFromSupabase}
              onRefresh={reloadSavings}
            />
          )}

          {activeTab === 'pinjaman' && (
            <PinjamanView
              members={members}
              loans={loans}
              repayments={repayments}
              onAddLoan={handleAddLoan}
              onApproveLoan={handleApproveLoan}
              onRejectLoan={handleRejectLoan}
              onPayInstallment={handlePayInstallment}
              onUpdateSchedulePayment={handleUpdateSchedulePayment}
              onDeleteLoan={handleDeleteLoan}
              onShowReceipt={(receipt) => setActiveReceipt(receipt)}
              isNewLoanModalOpen={isNewLoanModalOpen}
              setIsNewLoanModalOpen={setIsNewLoanModalOpen}
              preselectedLoanIdForRepayment={preselectedLoanIdForRepayment}
              onClearPreselectedLoan={() => setPreselectedLoanIdForRepayment(null)}
              userRole={userRole}
              currentUser={currentUser}
              spCashMutations={spCashMutations}
              onAddSpCashMutation={handleAddSpCashMutation}
              onDeleteSpCashMutation={handleDeleteSpCashMutation}
              activeSubTab={activeLoanSubTab}
              setActiveSubTab={setActiveLoanSubTab}
              isLoading={isLoansLoading}
              error={loansError}
              isFromSupabase={isLoansFromSupabase}
              onRefresh={reloadLoans}
            />
          )}

          {activeTab === 'unit_usaha' && (
            <LaporanUnitUsahaView
              businessTransactions={businessTransactions}
              unitReports={buCalc.reports}
              totalBusinessProfit={buCalc.totalProfit}
              onAddTransaction={handleAddBusinessTransaction}
              onDeleteTransaction={handleDeleteBusinessTransaction}
              userRole={userRole}
              currentUser={currentUser}
              activeUnitId={activeUnitId}
              setActiveUnitId={setActiveUnitId}
              isLoading={isBusinessLoading}
              error={businessError}
              isFromSupabase={isBusinessFromSupabase}
              onRefresh={reloadBusinessUnits}
            />
          )}

          {activeTab === 'shu' && (
            <ShuView
              members={members}
              savings={savings}
              loans={loans}
              repayments={repayments}
              businessReports={buCalc.reports}
              totalBusinessProfit={buCalc.totalProfit}
              userRole={userRole}
              currentUser={currentUser}
              summary={summary}
              isFromSupabase={isReportFromSupabase || isDashboardFromSupabase}
            />
          )}

          {activeTab === 'simulasi' && (
            <SimulasiView
              members={members}
              savings={savings}
              loans={loans}
              repayments={repayments}
              userRole={userRole}
              currentUser={currentUser}
              summary={summary}
              isFromSupabase={isReportFromSupabase || isDashboardFromSupabase}
            />
          )}

          {activeTab === 'laporan' && (
            <LaporanView
              summary={summary}
              members={members}
              savings={savings}
              loans={loans}
              repayments={repayments}
              cashFlow={cashFlow}
              onAddCashFlow={handleAddCashFlow}
              onResetData={handleResetData}
              onImportData={handleImportData}
              isLoading={isReportLoading || isCashFlowLoading}
              error={reportError || cashFlowError}
              isFromSupabase={isReportFromSupabase || isCashFlowFromSupabase}
              onRefresh={reloadReport}
              userRole={userRole}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'audit_log' && (
            <AuditLogView
              auditLogs={auditLogs}
              isLoading={isAuditLogsLoading}
              error={auditLogsError}
              isFromSupabase={isAuditLogsFromSupabase}
              onRefresh={reloadAuditLogs}
              userRole={userRole}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-3 mt-auto print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} Koperasi Brama Jaya Sejahtera &bull; BJS Digital
            </p>
          </div>
        </footer>
      </div>

      {/* Official Receipt Printable Modal */}
      <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />

      {/* Change Password Modal */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => {
            if (!currentUser.mustChangePassword) {
              setIsChangePasswordOpen(false);
            }
          }}
          currentUser={currentUser}
          isMandatory={Boolean(currentUser.mustChangePassword)}
          onSuccess={handlePasswordChanged}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
