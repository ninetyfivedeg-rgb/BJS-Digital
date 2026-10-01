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
  calculateBusinessUnitReports,
  computeCooperativeSummary,
  resetToDemoData,
  getNextMemberId,
} from './utils/storage';
import { getCurrentUser, logoutUser } from './utils/auth';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Navigation States
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeUnitId, setActiveUnitId] = useState<'semua' | BusinessUnitId>('semua');
  const [activeSavingsSubTab, setActiveSavingsSubTab] = useState<'pokok_wajib' | 'berjangka' | 'mutasi'>('pokok_wajib');
  const [activeLoanSubTab, setActiveLoanSubTab] = useState<'daftar_pinjaman' | 'kas_unit_sp'>('daftar_pinjaman');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data States
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [savings, setSavings] = useState<SavingsTransaction[]>(() => loadSavings());
  const [loans, setLoans] = useState<Loan[]>(() => loadLoans());
  const [repayments, setRepayments] = useState<LoanRepayment[]>(() => loadRepayments());
  const [cashFlow, setCashFlow] = useState<CashFlowRecord[]>(() => loadCashFlow());
  const [businessTransactions, setBusinessTransactions] = useState<BusinessUnitTransaction[]>(() =>
    loadBusinessTransactions()
  );
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

  useEffect(() => {
    saveSavings(savings);
  }, [savings]);

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

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
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

  const handleAddBusinessTransaction = (txData: Omit<BusinessUnitTransaction, 'id'>) => {
    const txId = `TRX-${Date.now().toString().slice(-6)}`;
    const newTx: BusinessUnitTransaction = {
      id: txId,
      ...txData,
    };
    setBusinessTransactions((prev) => [newTx, ...prev]);

    // Sinkronisasi transaksi Unit Usaha ke Laporan Buku Kas secara otomatis
    const isIncome = txData.type === 'penjualan' || txData.type === 'pendapatan';
    const unitName =
      txData.unitId === 'alat_kebakaran' || txData.unitKey === 'apar_sales'
        ? 'Penjualan Alat Kebakaran'
        : txData.unitId === 'apar' || txData.unitKey === 'apar_refill'
        ? 'Isi Ulang APAR'
        : txData.unitId === 'sembako'
        ? 'Penjualan Sembako'
        : txData.unitId === 'atribut'
        ? 'Penjualan Atribut'
        : 'Unit Usaha';

    const descPrefix = isIncome
      ? `[Unit Usaha - ${unitName}]`
      : txData.type === 'hpp_beli_barang' || txData.type === 'hpp'
      ? `[HPP Unit Usaha - ${unitName}]`
      : `[Biaya Ops Unit Usaha - ${unitName}]`;

    const newCashFlow: CashFlowRecord = {
      id: `CSH-BU-${Date.now().toString().slice(-6)}`,
      date: txData.date || new Date().toISOString().split('T')[0],
      type: isIncome ? 'masuk' : 'keluar',
      category: 'operasional',
      amount: Number(txData.amount),
      referenceId: txId,
      description: `${descPrefix} ${txData.description || txData.title || ''}`.trim(),
    };
    setCashFlow((prev) => [newCashFlow, ...prev]);
  };

  const handleDeleteBusinessTransaction = (txId: string) => {
    setBusinessTransactions((prev) => prev.filter((t) => t.id !== txId));
    setCashFlow((prev) => prev.filter((cf) => cf.referenceId !== txId));
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

  // Savings Handlers
  const handleAddSavings = (txData: Omit<SavingsTransaction, 'id'>) => {
    const now = new Date();
    const txId = `SMP-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      savings.length + 1
    ).padStart(3, '0')}`;

    const newTx: SavingsTransaction = {
      id: txId,
      ...txData,
    };

    setSavings((prev) => [...prev, newTx]);

    // Record cashflow
    const cfRecord: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}`,
      date: txData.date.split(' ')[0],
      type: txData.txType === 'setor' ? 'masuk' : 'keluar',
      category: txData.txType === 'setor' ? 'simpanan' : 'tarik_simpanan',
      amount: txData.amount,
      referenceId: txId,
      description: `${txData.txType === 'setor' ? 'Setor' : 'Tarik'} Simpanan ${txData.type.toUpperCase()} - ${
        txData.memberName
      }`,
    };
    setCashFlow((prev) => [...prev, cfRecord]);
  };

  const handleBatchAddWajib = (transactions: Omit<SavingsTransaction, 'id'>[]) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace('T', ' ');
    const todayDate = now.toISOString().split('T')[0];

    const newSavingsList: SavingsTransaction[] = transactions.map((t, idx) => ({
      ...t,
      id: `SWJ-${Date.now().toString().slice(-4)}-${String(idx + 1).padStart(3, '0')}`,
      date: t.date || dateStr,
    }));

    setSavings((prev) => [...prev, ...newSavingsList]);

    const totalAmount = newSavingsList.reduce((acc, curr) => acc + curr.amount, 0);
    const cfRecord: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}`,
      date: todayDate,
      type: 'masuk',
      category: 'simpanan',
      amount: totalAmount,
      referenceId: `BATCH-SWJ-${newSavingsList.length}`,
      description: `Setoran Kolektif Potong Gaji Simpanan Wajib (${newSavingsList.length} Anggota)`,
    };

    setCashFlow((prev) => [...prev, cfRecord]);
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

  // Loan Handlers
  const handleUpdateSchedulePayment = (loanId: string, month: number, isPaid: boolean, paidDate?: string) => {
    setLoans((prevLoans) =>
      prevLoans.map((l) => {
        if (l.id !== loanId) return l;
        const updatedSchedules = l.schedules.map((s) => {
          if (s.month !== month) return s;
          return {
            ...s,
            isPaid,
            paidDate: isPaid ? (paidDate || new Date().toISOString().split('T')[0]) : undefined,
          };
        });
        const allPaid = updatedSchedules.every((s) => s.isPaid);
        const newStatus = allPaid ? 'lunas' : (l.status === 'lunas' ? 'aktif' : l.status);
        return {
          ...l,
          status: newStatus,
          schedules: updatedSchedules,
        };
      })
    );
  };

  const handleAddLoan = (
    loanData: Omit<
      Loan,
      'id' | 'monthlyPrincipal' | 'monthlyInterest' | 'monthlyTotal' | 'totalLoanAmount' | 'schedules'
    >
  ) => {
    const now = new Date();
    const loanId = `PJM-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      loans.length + 1
    ).padStart(3, '0')}`;

    // Suku bunga dikunci 1.1% flat per bulan sesuai ART
    const fixedRate = 1.1;
    const monthlyPrincipal = Math.round(loanData.amount / loanData.tenorMonths);
    const monthlyInterest = Math.round(loanData.amount * (fixedRate / 100));
    const monthlyTotal = monthlyPrincipal + monthlyInterest;
    const totalLoanAmount = monthlyTotal * loanData.tenorMonths;

    // Generate monthly schedules
    const schedules: LoanScheduleItem[] = [];
    const startDateObj = new Date(loanData.startDate);

    for (let m = 1; m <= loanData.tenorMonths; m++) {
      const due = new Date(startDateObj);
      due.setMonth(due.getMonth() + m);
      const dueStr = due.toISOString().split('T')[0];

      schedules.push({
        month: m,
        dueDate: dueStr,
        principal: monthlyPrincipal,
        interest: monthlyInterest,
        totalInstallment: monthlyTotal,
        isPaid: false,
      });
    }

    const newLoan: Loan = {
      id: loanId,
      monthlyPrincipal,
      monthlyInterest,
      monthlyTotal,
      totalLoanAmount,
      schedules,
      ...loanData,
      interestRatePerMonth: fixedRate,
    };

    setLoans((prev) => [...prev, newLoan]);

    // Record cashflow
    if (newLoan.status === 'aktif') {
      const disbursementCF: CashFlowRecord = {
        id: `CSH-${Date.now().toString().slice(-5)}-1`,
        date: newLoan.startDate,
        type: 'keluar',
        category: 'pencairan_pinjaman',
        amount: newLoan.amount,
        referenceId: loanId,
        description: `Pencairan Pinjaman Plafon ${newLoan.amount} - ${newLoan.memberName}`,
      };
      const adminFeeCF: CashFlowRecord = {
        id: `CSH-${Date.now().toString().slice(-5)}-2`,
        date: newLoan.startDate,
        type: 'masuk',
        category: 'biaya_admin',
        amount: newLoan.adminFee,
        referenceId: loanId,
        description: `Biaya Administrasi Pinjaman ${loanId} - ${newLoan.memberName}`,
      };

      setCashFlow((prev) => [...prev, disbursementCF, adminFeeCF]);
    }
  };

  const handleApproveLoan = (loanId: string) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const updated = loans.map((l) =>
      l.id === loanId ? { ...l, status: 'aktif' as const, approvedDate: todayStr } : l
    );
    setLoans(updated);

    const disbursementCF: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}-1`,
      date: todayStr,
      type: 'keluar',
      category: 'pencairan_pinjaman',
      amount: loan.amount,
      referenceId: loan.id,
      description: `Pencairan Pinjaman Disetujui - ${loan.memberName}`,
    };
    const adminFeeCF: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}-2`,
      date: todayStr,
      type: 'masuk',
      category: 'biaya_admin',
      amount: loan.adminFee,
      referenceId: loan.id,
      description: `Biaya Administrasi Pinjaman ${loan.id} - ${loan.memberName}`,
    };

    setCashFlow((prev) => [...prev, disbursementCF, adminFeeCF]);
  };

  const handleRejectLoan = (loanId: string) => {
    setLoans((prev) => prev.map((l) => (l.id === loanId ? { ...l, status: 'ditolak' as const } : l)));
  };

  const handleDeleteLoan = (loanId: string) => {
    setLoans((prev) => prev.filter((l) => l.id !== loanId));
    setRepayments((prev) => prev.filter((r) => r.loanId !== loanId));
  };

  const handlePayInstallment = ({
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
    const targetLoan = loans.find((l) => l.id === loanId);
    if (!targetLoan) return;

    const targetSchedule = targetLoan.schedules.find((s) => s.month === installmentNo);
    if (!targetSchedule) return;

    const todayStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const repaymentId = `ANG-${Date.now().toString().slice(-6)}`;
    const totalPaid = targetSchedule.totalInstallment + penalty;

    const newRepayment: LoanRepayment = {
      id: repaymentId,
      loanId,
      memberId: targetLoan.memberId,
      memberName: targetLoan.memberName,
      installmentNo,
      principalAmount: targetSchedule.principal,
      interestAmount: targetSchedule.interest,
      penaltyAmount: penalty,
      totalPaid,
      date: todayStr,
      adminName,
      notes,
    };

    setRepayments((prev) => [...prev, newRepayment]);

    const updatedSchedules = targetLoan.schedules.map((s) =>
      s.month === installmentNo
        ? { ...s, isPaid: true, paidDate: todayStr.split(' ')[0], receiptId: repaymentId }
        : s
    );

    const isAllPaid = updatedSchedules.every((s) => s.isPaid);

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              schedules: updatedSchedules,
              status: isAllPaid ? ('lunas' as const) : l.status,
            }
          : l
      )
    );

    const cfPrincipal: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}-1`,
      date: todayStr.split(' ')[0],
      type: 'masuk',
      category: 'angsuran_pokok',
      amount: targetSchedule.principal,
      referenceId: repaymentId,
      description: `Angsuran Pokok #${installmentNo} (${loanId}) - ${targetLoan.memberName}`,
    };
    const cfInterest: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-5)}-2`,
      date: todayStr.split(' ')[0],
      type: 'masuk',
      category: 'angsuran_bunga',
      amount: targetSchedule.interest + penalty,
      referenceId: repaymentId,
      description: `Jasa Bunga #${installmentNo} (${loanId}) - ${targetLoan.memberName}`,
    };

    setCashFlow((prev) => [...prev, cfPrincipal, cfInterest]);
  };

  const handleAddCashFlow = (record: Omit<CashFlowRecord, 'id'>) => {
    const newRecord: CashFlowRecord = {
      id: `CSH-${Date.now().toString().slice(-6)}`,
      ...record,
    };
    setCashFlow((prev) => [...prev, newRecord]);
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
              activeUnitId={activeUnitId}
              setActiveUnitId={setActiveUnitId}
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
            />
          )}

          {activeTab === 'simulasi' && (
            <SimulasiView members={members} savings={savings} loans={loans} />
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
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
