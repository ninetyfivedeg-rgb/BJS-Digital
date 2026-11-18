import React, { useState, useEffect, useCallback } from 'react';
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
import { LaporanUspView } from './components/LaporanUspView';
import { UserManagementView } from './components/UserManagementView';
import { ReceiptModal, ReceiptData } from './components/ReceiptModal';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AuditLogView } from './components/AuditLogView';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CashFlowRecord,
  BusinessUnitTransaction,
  BusinessUnitId,
  UserRole,
  AuthUser,
  SimpanPinjamCashMutation,
  AuditLog,
} from './types';
import {
  loadSpCashMutations,
  calculateBusinessUnitReports,
  computeCooperativeSummary,
  clearSensitiveLocalCaches,
  getNextMemberId,
} from './utils/storage';
import {
  canAccessTab,
  getDefaultTabForUser,
  getManagedBusinessUnit,
  isAdminSp,
  isBusinessUnitManager,
  isSuperAdmin,
} from './utils/permissions';
import { supabase } from './lib/supabase';
import { logoutUser, fetchUserProfile } from './utils/auth';
import {
  fetchMembersFromSupabase,
  updateMemberInSupabase,
  createMemberInSupabase,
} from './services/memberService';
import {
  fetchSavingsFromSupabase,
  createSavingsTransaction,
  createBatchSavingsTransactions,
  deleteSavingsTransaction,
  completeBerjangkaTransaction,
} from './services/savingsService';
import {
  fetchLoansFromSupabase,
  createLoan,
  createTopUpLoan,
  createLoanRepayment,
  updateLoanScheduleStatus,
  approveLoan,
  rejectLoan,
  deleteLoan,
  CreateTopUpLoanInput,
} from './services/loanService';
import {
  fetchCashFlowFromSupabase,
  createCashFlowRecord,
} from './services/cashFlowService';
import {
  extractSpCashMutationsFromCashFlow,
  fetchSpCashMutationsFromSupabase,
  createSpCashMutationInSupabase,
  deleteSpCashMutationFromSupabase,
  migrateLocalSpCashToSupabase,
} from './services/spCashService';
import {
  fetchBusinessUnitsAndTransactionsFromSupabase,
  createBusinessUnitTransaction,
  deleteBusinessUnitTransaction,
} from './services/businessUnitService';
import { fetchAuditLogsFromSupabase } from './services/auditLogService';
import { fetchDashboardDataFromSupabase } from './services/dashboardService';
import { fetchReportDataFromSupabase } from './services/reportService';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Navigation States
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeUnitId, setActiveUnitId] = useState<'semua' | BusinessUnitId>('semua');
  const [activeSavingsSubTab, setActiveSavingsSubTab] = useState<'pokok_wajib' | 'berjangka' | 'mutasi'>('pokok_wajib');
  const [activeLoanSubTab, setActiveLoanSubTab] = useState<'daftar_pinjaman' | 'kas_unit_sp'>('daftar_pinjaman');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data States (Single Source of Truth = Supabase PostgreSQL)
  const [members, setMembers] = useState<Member[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isMembersFromSupabase, setIsMembersFromSupabase] = useState(false);

  const [savings, setSavings] = useState<SavingsTransaction[]>([]);
  const [isSavingsLoading, setIsSavingsLoading] = useState(false);
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [isSavingsFromSupabase, setIsSavingsFromSupabase] = useState(false);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [isLoansLoading, setIsLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState<string | null>(null);
  const [isLoansFromSupabase, setIsLoansFromSupabase] = useState(false);

  const [cashFlow, setCashFlow] = useState<CashFlowRecord[]>([]);
  const [isCashFlowLoading, setIsCashFlowLoading] = useState(false);
  const [cashFlowError, setCashFlowError] = useState<string | null>(null);
  const [isCashFlowFromSupabase, setIsCashFlowFromSupabase] = useState(false);

  const [spCashMutations, setSpCashMutations] = useState<SimpanPinjamCashMutation[]>([]);
  const [localSpCashQueue, setLocalSpCashQueue] = useState<SimpanPinjamCashMutation[]>(() =>
    loadSpCashMutations()
  );

  const [businessTransactions, setBusinessTransactions] = useState<BusinessUnitTransaction[]>([]);
  const [isBusinessLoading, setIsBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [isBusinessFromSupabase, setIsBusinessFromSupabase] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLogsLoading, setIsAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [isAuditLogsFromSupabase, setIsAuditLogsFromSupabase] = useState(false);

  // Dashboard Aggregator State
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isDashboardFromSupabase, setIsDashboardFromSupabase] = useState(false);

  // Laporan Aggregator State
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isReportFromSupabase, setIsReportFromSupabase] = useState(false);

  // Receipt & Modal States
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isBerjangkaModalOpen, setIsBerjangkaModalOpen] = useState(false);
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);
  const [preselectedLoanIdForRepayment, setPreselectedLoanIdForRepayment] = useState<string | null>(null);
  const [initialSelectedMemberId, setInitialSelectedMemberId] = useState<string | undefined>(undefined);

  const resetAllState = useCallback(() => {
    setMembers([]);
    setMembersError(null);
    setIsMembersFromSupabase(false);
    setSavings([]);
    setSavingsError(null);
    setIsSavingsFromSupabase(false);
    setLoans([]);
    setRepayments([]);
    setLoansError(null);
    setIsLoansFromSupabase(false);
    setCashFlow([]);
    setCashFlowError(null);
    setIsCashFlowFromSupabase(false);
    setSpCashMutations([]);
    setBusinessTransactions([]);
    setBusinessError(null);
    setIsBusinessFromSupabase(false);
    setAuditLogs([]);
    setAuditLogsError(null);
    setIsAuditLogsFromSupabase(false);
    setDashboardError(null);
    setIsDashboardFromSupabase(false);
    setReportError(null);
    setIsReportFromSupabase(false);
    setActiveReceipt(null);
    setIsDepositModalOpen(false);
    setIsBerjangkaModalOpen(false);
    setIsNewLoanModalOpen(false);
    setPreselectedLoanIdForRepayment(null);
    setInitialSelectedMemberId(undefined);
    clearSensitiveLocalCaches();
  }, []);

  // Subscribe to Supabase Auth session & changes
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const userProfile = await fetchUserProfile(
          session.user.id,
          undefined,
          session.user.email
        );
        if (isMounted) {
          if (userProfile && userProfile.isActive === false) {
            await logoutUser();
            resetAllState();
            setCurrentUser(null);
          } else {
            setCurrentUser(userProfile);
            if (userProfile?.mustChangePassword) {
              setIsChangePasswordOpen(true);
            }
          }
        }
      }
      if (isMounted) {
        setIsAuthChecking(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        resetAllState();
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
            if (userProfile && userProfile.isActive === false) {
              await logoutUser();
              resetAllState();
              setCurrentUser(null);
            } else {
              setCurrentUser(userProfile);
              if (userProfile?.mustChangePassword) {
                setIsChangePasswordOpen(true);
              }
            }
          }
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [resetAllState]);

  const reloadMembers = useCallback(async () => {
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetchMembersFromSupabase();
      setMembers(res.members);
      setIsMembersFromSupabase(res.fromSupabase);
      if (res.error) setMembersError(res.error);
      return res.members;
    } catch {
      setMembersError('Terjadi kendala saat menyinkronkan data anggota.');
      return [];
    } finally {
      setIsMembersLoading(false);
    }
  }, []);

  const reloadSavings = useCallback(
    async (membersList?: Member[]) => {
      setIsSavingsLoading(true);
      setSavingsError(null);
      try {
        const res = await fetchSavingsFromSupabase(membersList || members);
        setSavings(res.savings);
        setIsSavingsFromSupabase(res.fromSupabase);
        if (res.error) setSavingsError(res.error);
      } catch {
        setSavingsError('Terjadi kendala saat menyinkronkan data simpanan.');
      } finally {
        setIsSavingsLoading(false);
      }
    },
    [members]
  );

  const reloadLoans = useCallback(
    async (membersList?: Member[]) => {
      setIsLoansLoading(true);
      setLoansError(null);
      try {
        const res = await fetchLoansFromSupabase(membersList || members);
        setLoans(res.loans);
        setRepayments(res.repayments);
        setIsLoansFromSupabase(res.fromSupabase);
        if (res.error) setLoansError(res.error);
      } catch {
        setLoansError('Terjadi kendala saat menyinkronkan data pinjaman.');
      } finally {
        setIsLoansLoading(false);
      }
    },
    [members]
  );

  const reloadCashFlow = useCallback(async () => {
    setIsCashFlowLoading(true);
    setCashFlowError(null);
    try {
      const res = await fetchCashFlowFromSupabase();
      setCashFlow(res.cashFlow);
      setSpCashMutations(extractSpCashMutationsFromCashFlow(res.cashFlow));
      setIsCashFlowFromSupabase(res.fromSupabase);
      if (res.error) setCashFlowError(res.error);
    } catch {
      setCashFlowError('Terjadi kendala saat menyinkronkan buku kas.');
    } finally {
      setIsCashFlowLoading(false);
    }
  }, []);

  const reloadBusinessUnits = useCallback(
    async (unitFilter?: BusinessUnitId | null) => {
      const targetUnit =
        unitFilter !== undefined ? unitFilter : getManagedBusinessUnit(currentUser);
      setIsBusinessLoading(true);
      setBusinessError(null);
      try {
        const res = await fetchBusinessUnitsAndTransactionsFromSupabase(
          isSuperAdmin(currentUser) ? null : targetUnit
        );
        setBusinessTransactions(res.transactions);
        setIsBusinessFromSupabase(res.fromSupabase);
        if (res.error) setBusinessError(res.error);
      } catch {
        setBusinessError('Terjadi kendala saat menyinkronkan data unit usaha.');
      } finally {
        setIsBusinessLoading(false);
      }
    },
    [currentUser]
  );

  const reloadAuditLogs = useCallback(async () => {
    if (!isSuperAdmin(currentUser)) return;
    setIsAuditLogsLoading(true);
    setAuditLogsError(null);
    try {
      const res = await fetchAuditLogsFromSupabase();
      setAuditLogs(res.auditLogs);
      setIsAuditLogsFromSupabase(res.fromSupabase);
      if (res.error) setAuditLogsError(res.error);
    } catch {
      setAuditLogsError('Terjadi kendala saat menyinkronkan rekam jejak audit.');
    } finally {
      setIsAuditLogsLoading(false);
    }
  }, [currentUser]);

  const reloadDashboard = useCallback(
    async (userOverride?: AuthUser | null) => {
      const actor = userOverride || currentUser;
      if (!actor) return;
      if (isAdminSp(actor) || isBusinessUnitManager(actor)) return;

      setIsDashboardLoading(true);
      setDashboardError(null);
      try {
        const res = await fetchDashboardDataFromSupabase(
          actor.role,
          actor.memberId || actor.username
        );
        if (res.members && res.members.length > 0) {
          setMembers(res.members);
        }
        setSavings(res.savings);
        setLoans(res.loans);
        setRepayments(res.repayments);
        setCashFlow(res.cashFlow);
        setSpCashMutations(extractSpCashMutationsFromCashFlow(res.cashFlow));
        setBusinessTransactions(res.businessTransactions);
        setIsDashboardFromSupabase(res.fromSupabase);
        if (res.error) setDashboardError(res.error);
      } catch {
        setDashboardError('Terjadi kendala saat menyinkronkan data dashboard.');
      } finally {
        setIsDashboardLoading(false);
      }
    },
    [currentUser]
  );

  const reloadReport = useCallback(
    async (userOverride?: AuthUser | null) => {
      const actor = userOverride || currentUser;
      if (!actor || !isSuperAdmin(actor)) return;

      setIsReportLoading(true);
      setReportError(null);
      try {
        const res = await fetchReportDataFromSupabase(
          actor.role,
          actor.memberId || actor.username
        );
        if (res.members && res.members.length > 0) {
          setMembers(res.members);
        }
        setSavings(res.savings);
        setLoans(res.loans);
        setRepayments(res.repayments);
        setCashFlow(res.cashFlow);
        setSpCashMutations(extractSpCashMutationsFromCashFlow(res.cashFlow));
        setBusinessTransactions(res.businessTransactions);
        setIsReportFromSupabase(res.fromSupabase);
        if (res.error) setReportError(res.error);
      } catch {
        setReportError('Terjadi kendala saat menyinkronkan data laporan.');
      } finally {
        setIsReportLoading(false);
      }
    },
    [currentUser]
  );

  const loadAuthorizedDataForUser = useCallback(
    async (user: AuthUser) => {
      if (isSuperAdmin(user)) {
        const loadedMembers = await reloadMembers();
        await Promise.all([
          reloadDashboard(user),
          reloadReport(user),
          reloadSavings(loadedMembers),
          reloadLoans(loadedMembers),
          reloadCashFlow(),
          reloadBusinessUnits(null),
          reloadAuditLogs(),
        ]);
        return;
      }

      if (isAdminSp(user)) {
        setBusinessTransactions([]);
        setAuditLogs([]);
        const loadedMembers = await reloadMembers();
        await Promise.all([
          reloadSavings(loadedMembers),
          reloadLoans(loadedMembers),
          reloadCashFlow(),
          fetchSpCashMutationsFromSupabase().then((spRes) => {
            if (spRes.fromSupabase && spRes.mutations.length > 0) {
              setSpCashMutations(spRes.mutations);
            }
          }),
        ]);
        return;
      }

      if (isBusinessUnitManager(user)) {
        const managedUnit = getManagedBusinessUnit(user);
        setMembers([]);
        setSavings([]);
        setLoans([]);
        setRepayments([]);
        setCashFlow([]);
        setSpCashMutations([]);
        setAuditLogs([]);
        await reloadBusinessUnits(managedUnit);
        return;
      }

      // Anggota
      setBusinessTransactions([]);
      setAuditLogs([]);
      const loadedMembers = await reloadMembers();
      await Promise.all([
        reloadSavings(loadedMembers),
        reloadLoans(loadedMembers),
        reloadDashboard(user),
      ]);
    },
    [
      reloadAuditLogs,
      reloadBusinessUnits,
      reloadCashFlow,
      reloadDashboard,
      reloadLoans,
      reloadMembers,
      reloadReport,
      reloadSavings,
    ]
  );

  // Guard activeTab & activeUnitId strictly against active role permissions
  useEffect(() => {
    if (!currentUser) return;
    if (!canAccessTab(currentUser, activeTab)) {
      setActiveTab(getDefaultTabForUser(currentUser));
    }
    if (isBusinessUnitManager(currentUser)) {
      const managed = getManagedBusinessUnit(currentUser);
      if (managed && activeUnitId !== managed) {
        setActiveUnitId(managed);
      }
    }
  }, [currentUser, activeTab, activeUnitId]);

  // Trigger role-aware Supabase load when authenticated user changes
  useEffect(() => {
    if (currentUser) {
      loadAuthorizedDataForUser(currentUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, currentUser?.managedUnit]);

  // Role state derived from active authenticated user
  const userRole: UserRole = currentUser?.role || 'anggota';

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveTab(getDefaultTabForUser(user));
    const managed = getManagedBusinessUnit(user);
    if (managed && !isSuperAdmin(user)) {
      setActiveUnitId(managed);
    } else {
      setActiveUnitId('semua');
    }
    if (user.mustChangePassword) {
      setIsChangePasswordOpen(true);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    resetAllState();
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
  const pendingLoansCount = loans.filter(
    (l) => l.status === 'menunggu' || l.status === 'diajukan' || l.status === 'review'
  ).length;

  const refreshFinancialAggregates = async () => {
    const tasks: Promise<any>[] = [reloadCashFlow()];
    if (isSuperAdmin(currentUser)) {
      tasks.push(reloadDashboard(), reloadReport(), reloadAuditLogs());
    }
    await Promise.all(tasks);
  };

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

    await reloadBusinessUnits();
    if (isSuperAdmin(currentUser)) {
      await Promise.all([reloadDashboard(), reloadReport(), reloadAuditLogs()]);
    }

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
    if (isSuperAdmin(currentUser)) {
      await Promise.all([reloadDashboard(), reloadReport(), reloadAuditLogs()]);
    }
  };

  // Member Handlers
  const handleAddMember = async (newMemberData: Omit<Member, 'id'>, initialPokok: number) => {
    const newId = getNextMemberId(members);
    const newMember: Member = {
      id: newId,
      ...newMemberData,
    };

    const res = await createMemberInSupabase(newMember, currentUser);
    if (!res.success) {
      alert(`Gagal mendaftarkan anggota: ${res.message}`);
      return;
    }

    if (initialPokok > 0) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      await createSavingsTransaction(
        {
          memberId: newId,
          memberName: newMember.name,
          type: 'pokok',
          txType: 'setor',
          amount: initialPokok,
          date: dateStr,
          notes: 'Setoran Simpanan Pokok awal pendaftaran anggota',
          adminName: currentUser?.name || 'Super Admin BJS',
        },
        currentUser,
        [...members, newMember]
      );
      await reloadSavings();
    }

    await reloadMembers();
    await refreshFinancialAggregates();
  };

  const handleEditMember = async (updatedMember: Member) => {
    const res = await updateMemberInSupabase(updatedMember, currentUser);
    if (!res.success) {
      alert(`Gagal memperbarui data anggota: ${res.message}`);
      return;
    }
    await reloadMembers();
    if (isSuperAdmin(currentUser)) {
      await Promise.all([reloadDashboard(), reloadReport(), reloadAuditLogs()]);
    }
  };

  const handleDeleteMember = () => {
    alert(
      'Penghapusan anggota dinonaktifkan demi integritas data historis. Silakan ubah status anggota menjadi "Keluar" jika anggota mengundurkan diri.'
    );
  };

  // Savings Handlers
  const handleAddSavings = async (
    txData: Omit<SavingsTransaction, 'id'>
  ): Promise<{ success: boolean; message: string; data?: SavingsTransaction; error?: string }> => {
    const result = await createSavingsTransaction(txData, currentUser, members);
    if (!result.success) return result;

    await reloadSavings();
    await refreshFinancialAggregates();
    return result;
  };

  const handleBatchAddWajib = async (
    transactions: Omit<SavingsTransaction, 'id'>[]
  ): Promise<{ success: boolean; message: string; data?: SavingsTransaction[]; error?: string }> => {
    const result = await createBatchSavingsTransactions(transactions, currentUser, members);
    if (!result.success) return result;

    await reloadSavings();
    await refreshFinancialAggregates();
    return result;
  };

  const handleCompleteBerjangka = async (savingsId: string) => {
    const res = await completeBerjangkaTransaction(savingsId, currentUser);
    if (!res.success) {
      alert(`Gagal mencairkan simpanan berjangka: ${res.message}`);
      return;
    }

    await reloadSavings();
    await refreshFinancialAggregates();
  };

  const handleDeleteSavings = async (savingsId: string) => {
    const res = await deleteSavingsTransaction(savingsId, currentUser);
    if (!res.success) {
      alert(`Gagal menghapus transaksi simpanan: ${res.message}`);
      return;
    }

    await reloadSavings();
    await refreshFinancialAggregates();
  };

  // Loan & Top Up Handlers
  const handleUpdateSchedulePayment = async (
    loanId: string,
    month: number,
    isPaid: boolean,
    paidDate?: string
  ) => {
    const res = await updateLoanScheduleStatus(
      {
        loanId,
        installmentNo: month,
        isPaid,
        paidDate,
      },
      currentUser
    );
    if (!res.success) {
      alert(res.message);
      return;
    }

    await reloadLoans();
    if (isSuperAdmin(currentUser)) {
      await Promise.all([reloadDashboard(), reloadReport()]);
    }
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
      return result;
    }

    await reloadLoans();
    await refreshFinancialAggregates();
    return result;
  };

  const handleCreateTopUpLoan = async (input: CreateTopUpLoanInput, parentLoan?: Loan) => {
    const result = await createTopUpLoan(input, currentUser, members, parentLoan);
    if (!result.success) {
      return result;
    }

    await reloadLoans();
    await refreshFinancialAggregates();
    return result;
  };

  const handleApproveLoan = async (loanId: string) => {
    const result = await approveLoan(loanId, currentUser, loans);
    if (!result.success) {
      alert(`Gagal menyetujui pinjaman: ${result.message}`);
      return;
    }

    await reloadLoans();
    await refreshFinancialAggregates();
  };

  const handleRejectLoan = async (loanId: string) => {
    const result = await rejectLoan(loanId, currentUser);
    if (!result.success) {
      alert(`Gagal menolak pinjaman: ${result.message}`);
      return;
    }

    await reloadLoans();
    if (isSuperAdmin(currentUser)) {
      await Promise.all([reloadDashboard(), reloadReport(), reloadAuditLogs()]);
    }
  };

  const handleDeleteLoan = async (loanId: string) => {
    const result = await deleteLoan(loanId, currentUser);
    if (!result.success) {
      alert(`Gagal menghapus pinjaman: ${result.message}`);
      return;
    }

    await reloadLoans();
    await refreshFinancialAggregates();
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

    await reloadLoans();
    await refreshFinancialAggregates();
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

    await refreshFinancialAggregates();
    return result;
  };

  // Kas Unit Simpan Pinjam Handlers (PostgreSQL Single Source of Truth)
  const handleAddSpCashMutation = async (
    mutationData: Omit<SimpanPinjamCashMutation, 'id' | 'createdAt'>
  ) => {
    const result = await createSpCashMutationInSupabase(mutationData, currentUser);
    if (!result.success) {
      alert(`Gagal mencatat mutasi Kas Unit SP: ${result.message}`);
      return;
    }
    await refreshFinancialAggregates();
  };

  const handleDeleteSpCashMutation = async (id: string) => {
    const result = await deleteSpCashMutationFromSupabase(id, currentUser);
    if (!result.success) {
      alert(`Gagal menghapus mutasi Kas Unit SP: ${result.message}`);
      return;
    }
    await refreshFinancialAggregates();
  };

  const handleMigrateLocalSpCash = async () => {
    const result = await migrateLocalSpCashToSupabase(localSpCashQueue, currentUser);
    alert(result.message);
    if (result.success) {
      setLocalSpCashQueue([]);
      await refreshFinancialAggregates();
    }
  };

  const handleResetData = () => {
    if (currentUser) {
      loadAuthorizedDataForUser(currentUser);
    }
  };

  const handleImportData = () => {
    alert('Impor lokal dinonaktifkan. Seluruh data tersinkronisasi langsung dari database PostgreSQL Supabase.');
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
          {activeTab === 'dashboard' && canAccessTab(currentUser, 'dashboard') && (
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
              onRefresh={() => reloadDashboard()}
            />
          )}

          {activeTab === 'anggota' && canAccessTab(currentUser, 'anggota') && (
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

          {activeTab === 'simpanan' && canAccessTab(currentUser, 'simpanan') && (
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
              onRefresh={() => reloadSavings()}
            />
          )}

          {activeTab === 'pinjaman' && canAccessTab(currentUser, 'pinjaman') && (
            <PinjamanView
              members={members}
              loans={loans}
              repayments={repayments}
              onAddLoan={handleAddLoan}
              onCreateTopUpLoan={handleCreateTopUpLoan}
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
              onMigrateLocalSpCash={handleMigrateLocalSpCash}
              hasLocalUnsyncedSpCash={localSpCashQueue.length > 0}
              activeSubTab={activeLoanSubTab}
              setActiveSubTab={setActiveLoanSubTab}
              isLoading={isLoansLoading}
              error={loansError}
              isFromSupabase={isLoansFromSupabase}
              onRefresh={() => reloadLoans()}
            />
          )}

          {activeTab === 'laporan_usp' && canAccessTab(currentUser, 'laporan_usp') && (
            <LaporanUspView
              members={members}
              savings={savings}
              loans={loans}
              repayments={repayments}
              cashFlow={cashFlow}
              spCashMutations={spCashMutations}
              currentUser={currentUser}
              isLoading={isLoansLoading || isSavingsLoading || isCashFlowLoading}
              error={loansError || savingsError || cashFlowError}
              isFromSupabase={isLoansFromSupabase || isSavingsFromSupabase || isCashFlowFromSupabase}
              onRefresh={() => loadAuthorizedDataForUser(currentUser)}
            />
          )}

          {activeTab === 'unit_usaha' && canAccessTab(currentUser, 'unit_usaha') && (
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
              onRefresh={() => reloadBusinessUnits()}
            />
          )}

          {activeTab === 'shu' && canAccessTab(currentUser, 'shu') && (
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

          {activeTab === 'simulasi' && canAccessTab(currentUser, 'simulasi') && (
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

          {activeTab === 'laporan' && canAccessTab(currentUser, 'laporan') && (
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
              onRefresh={() => reloadReport()}
              userRole={userRole}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'audit_log' && canAccessTab(currentUser, 'audit_log') && (
            <AuditLogView
              auditLogs={auditLogs}
              isLoading={isAuditLogsLoading}
              error={auditLogsError}
              isFromSupabase={isAuditLogsFromSupabase}
              onRefresh={reloadAuditLogs}
              userRole={userRole}
            />
          )}

          {activeTab === 'manajemen_user' && canAccessTab(currentUser, 'manajemen_user') && (
            <UserManagementView currentUser={currentUser} members={members} />
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
