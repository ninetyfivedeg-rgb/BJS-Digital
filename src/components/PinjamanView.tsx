import React, { useState, useEffect } from 'react';
import {
  HandCoins,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  Clock,
  Check,
  X,
  FileText,
  Printer,
  ChevronRight,
  AlertCircle,
  Calendar,
  ReceiptText,
  Edit3,
  Trash2,
  AlertTriangle,
  Lock,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Member,
  Loan,
  LoanRepayment,
  LoanScheduleItem,
  LoanStatus,
  UserRole,
  AuthUser,
  KOPERASI_OFFICIALS,
  SimpanPinjamCashMutation,
  SimpanPinjamCashMutationType,
} from '../types';
import { formatRupiah, formatDateIndo, formatDateTimeIndo } from '../utils/formatters';
import { calculateLoanRemaining } from '../utils/storage';
import { ReceiptData } from './ReceiptModal';
import { printHtmlContent } from '../utils/printHelper';

interface PinjamanViewProps {
  members: Member[];
  loans: Loan[];
  repayments: LoanRepayment[];
  onAddLoan: (loan: Omit<Loan, 'id' | 'monthlyPrincipal' | 'monthlyInterest' | 'monthlyTotal' | 'totalLoanAmount' | 'schedules'>) => void;
  onApproveLoan: (loanId: string) => void;
  onRejectLoan: (loanId: string) => void;
  onPayInstallment: (payment: {
    loanId: string;
    installmentNo: number;
    penalty: number;
    notes?: string;
    adminName: string;
  }) => void;
  onShowReceipt: (receipt: ReceiptData) => void;
  onUpdateSchedulePayment?: (loanId: string, month: number, isPaid: boolean, paidDate?: string) => void;
  onDeleteLoan?: (loanId: string) => void;
  isNewLoanModalOpen: boolean;
  setIsNewLoanModalOpen: (open: boolean) => void;
  preselectedLoanIdForRepayment?: string | null;
  onClearPreselectedLoan?: () => void;
  userRole?: UserRole;
  currentUser?: AuthUser | null;
  spCashMutations?: SimpanPinjamCashMutation[];
  onAddSpCashMutation?: (mutation: Omit<SimpanPinjamCashMutation, 'id' | 'createdAt'>) => void;
  onDeleteSpCashMutation?: (id: string) => void;
  activeSubTab?: 'daftar_pinjaman' | 'kas_unit_sp';
  setActiveSubTab?: (tab: 'daftar_pinjaman' | 'kas_unit_sp') => void;
}

export const PinjamanView: React.FC<PinjamanViewProps> = ({
  members,
  loans,
  repayments,
  onAddLoan,
  onApproveLoan,
  onRejectLoan,
  onPayInstallment,
  onShowReceipt,
  onUpdateSchedulePayment,
  onDeleteLoan,
  isNewLoanModalOpen,
  setIsNewLoanModalOpen,
  preselectedLoanIdForRepayment,
  onClearPreselectedLoan,
  userRole = 'pengurus',
  currentUser,
  spCashMutations = [],
  onAddSpCashMutation,
  onDeleteSpCashMutation,
  activeSubTab: controlledSubTab,
  setActiveSubTab: setControlledSubTab,
}) => {
  const isAnggota = userRole === 'anggota' || currentUser?.role === 'anggota';
  const activeMemberId = (currentUser?.memberId || (isAnggota ? currentUser?.username : undefined))?.trim().toLowerCase();
  const effectiveLoans = isAnggota && activeMemberId
    ? loans.filter((l) => l.memberId?.trim().toLowerCase() === activeMemberId)
    : loans;

  const effectiveRepayments = isAnggota && activeMemberId
    ? repayments.filter((r) => r.memberId?.trim().toLowerCase() === activeMemberId)
    : repayments;

  // Sub-menu state for Pinjaman module (controlled with internal fallback)
  const [internalSubTab, setInternalSubTab] = useState<'daftar_pinjaman' | 'kas_unit_sp'>('daftar_pinjaman');
  const activeSubTab = controlledSubTab ?? internalSubTab;
  const setActiveSubTab = (tab: 'daftar_pinjaman' | 'kas_unit_sp') => {
    setInternalSubTab(tab);
    if (setControlledSubTab) {
      setControlledSubTab(tab);
    }
  };

  // Kas Unit Simpan Pinjam States
  const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
  const [mutationToDelete, setMutationToDelete] = useState<SimpanPinjamCashMutation | null>(null);
  const [kasTypeFilter, setKasTypeFilter] = useState<'semua' | 'penambahan' | 'pengurangan'>('semua');
  const [kasCategoryFilter, setKasCategoryFilter] = useState<string>('semua');
  const [kasSearchTerm, setKasSearchTerm] = useState('');

  const [mutationForm, setMutationForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'penambahan' as SimpanPinjamCashMutationType,
    category: 'Alokasi Dana Simpanan Pokok & Wajib',
    amount: 10000000,
    description: 'Alokasi dana segar dari Simpanan Pokok & Wajib Anggota ke unit simpan pinjam',
    sourceOrRecipient: 'Kas Simpanan Pokok & Wajib Anggota',
    recordedBy: currentUser?.name || 'Bendahara Koperasi',
    notes: '',
  });

  const [statusFilter, setStatusFilter] = useState<'semua' | LoanStatus>('semua');
  const [selectedLoanDetail, setSelectedLoanDetail] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  // Edit Schedule Item state (for correcting accidental payments)
  const [editingScheduleItem, setEditingScheduleItem] = useState<{
    loanId: string;
    month: number;
    isPaid: boolean;
    paidDate: string;
    notes: string;
  } | null>(null);

  // Repayment Modal: Never auto-open when user merely clicks/switches to Pinjaman menu
  const [repaymentModalLoan, setRepaymentModalLoan] = useState<Loan | null>(null);

  // If explicitly requested via preselectedLoanIdForRepayment (e.g. from a direct quick-action), handle it safely
  useEffect(() => {
    if (preselectedLoanIdForRepayment) {
      const target = loans.find((l) => l.id === preselectedLoanIdForRepayment);
      if (target) {
        setRepaymentModalLoan(target);
      }
      if (onClearPreselectedLoan) {
        onClearPreselectedLoan();
      }
    }
  }, [preselectedLoanIdForRepayment, loans, onClearPreselectedLoan]);

  const [repaymentForm, setRepaymentForm] = useState({
    penalty: 0,
    notes: 'Pembayaran angsuran bulanan koperasi',
    adminName: 'Petugas Koperasi',
  });

  // Active/Eligible members for new loan application (exclude 'keluar')
  const eligibleMembers = members.filter((m) => m.status !== 'keluar');

  // New Loan Form
  const [newLoanForm, setNewLoanForm] = useState({
    memberId: eligibleMembers[0]?.id || members[0]?.id || '',
    amount: 5000000,
    tenorMonths: 10,
    interestRatePerMonth: 1.1, // Suku bunga locked 1.1% flat per bulan sesuai ART
    adminFeeRate: 1.0, // 1% admin fee locked per ketentuan
    startDate: new Date().toISOString().split('T')[0],
    purpose: 'Penambahan modal usaha anggota',
    notes: 'Jaminan usaha berjalan',
  });

  // Ensure selected member in form is valid and eligible when modal opens
  useEffect(() => {
    if (isNewLoanModalOpen && eligibleMembers.length > 0) {
      if (!newLoanForm.memberId || !eligibleMembers.some((m) => m.id === newLoanForm.memberId)) {
        setNewLoanForm((prev) => ({
          ...prev,
          memberId: eligibleMembers[0].id,
        }));
      }
    }
  }, [isNewLoanModalOpen, eligibleMembers, newLoanForm.memberId]);

  // Amortization Schedule Print
  const handlePrintAmortizationSchedule = (loan: Loan) => {
    const rows = loan.schedules
      .map(
        (s) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px;">Bulan #${s.month}</td>
        <td style="padding: 6px 8px;">${formatDateIndo(s.dueDate)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${formatRupiah(s.principal)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${formatRupiah(s.interest)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(s.totalInstallment)}</td>
        <td style="padding: 6px 8px; text-align: center;">${
          s.isPaid
            ? '<span style="color: #047857; font-weight: bold;">LUNAS</span>'
            : '<span style="color: #b45309; font-weight: bold;">BELUM DIBAYAR</span>'
        }</td>
        <td style="padding: 6px 8px; text-align: right;">${s.paidDate ? formatDateIndo(s.paidDate) : '-'}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
          <img src="/logo-bjs.png" style="height: 55px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h3 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h3>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK Koperasi</p>
            <h2 style="margin: 4px 0 0 0; font-size: 14px; font-weight: bold; color: #1e3a8a;">JADWAL AMORTISASI & KARTU ANGSURAN PINJAMAN</h2>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-family: monospace;">Nomor Kontrak: ${loan.id}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 12px; background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <p style="margin: 2px 0;"><strong>Nama Anggota:</strong> ${loan.memberName}</p>
            <p style="margin: 2px 0;"><strong>No. Register:</strong> ${loan.memberId}</p>
            <p style="margin: 2px 0;"><strong>Tanggal Akad:</strong> ${formatDateIndo(loan.startDate)}</p>
          </div>
          <div>
            <p style="margin: 2px 0;"><strong>Plafon Pinjaman:</strong> ${formatRupiah(loan.amount)}</p>
            <p style="margin: 2px 0;"><strong>Tenor:</strong> ${loan.tenorMonths} Bulan (${loan.interestRatePerMonth}% flat/bln)</p>
            <p style="margin: 2px 0;"><strong>Angsuran per Bulan:</strong> ${formatRupiah(loan.monthlyTotal)}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569;">
              <th style="padding: 8px; text-align: left;">Bulan</th>
              <th style="padding: 8px; text-align: left;">Jatuh Tempo</th>
              <th style="padding: 8px; text-align: right;">Pokok</th>
              <th style="padding: 8px; text-align: right;">Jasa (1%)</th>
              <th style="padding: 8px; text-align: right;">Total Cicilan</th>
              <th style="padding: 8px; text-align: center;">Status</th>
              <th style="padding: 8px; text-align: right;">Tgl Bayar</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; text-align: center; font-size: 11px; margin-top: 30px;">
          <div style="width: 30%;">
            <p>Peminjam / Anggota,</p>
            <div style="height: 50px;"></div>
            <p style="font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 4px;">${loan.memberName}</p>
          </div>
          <div style="width: 30%;">
            <p>Manajer Unit Simpan Pinjam,</p>
            <div style="height: 50px;"></div>
            <p style="font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 4px;">${KOPERASI_OFFICIALS.manajerUSP}</p>
          </div>
          <div style="width: 30%;">
            <p>Bendahara Koperasi,</p>
            <div style="height: 50px;"></div>
            <p style="font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 4px;">${KOPERASI_OFFICIALS.bendahara}</p>
          </div>
        </div>
      </div>
    `;

    printHtmlContent(html, `Jadwal-Angsuran-${loan.id}`);
  };

  const handleSaveScheduleEdit = () => {
    if (!editingScheduleItem) return;

    if (onUpdateSchedulePayment) {
      onUpdateSchedulePayment(
        editingScheduleItem.loanId,
        editingScheduleItem.month,
        editingScheduleItem.isPaid,
        editingScheduleItem.isPaid ? editingScheduleItem.paidDate : undefined
      );
    }

    // Also update local selectedLoanDetail state immediately
    if (selectedLoanDetail && selectedLoanDetail.id === editingScheduleItem.loanId) {
      const updatedSchedules = selectedLoanDetail.schedules.map((s) => {
        if (s.month === editingScheduleItem.month) {
          return {
            ...s,
            isPaid: editingScheduleItem.isPaid,
            paidDate: editingScheduleItem.isPaid ? editingScheduleItem.paidDate : undefined,
          };
        }
        return s;
      });

      setSelectedLoanDetail({
        ...selectedLoanDetail,
        schedules: updatedSchedules,
      });
    }

    setEditingScheduleItem(null);
  };

  // Calculate stats
  const activeLoans = effectiveLoans.filter((l) => l.status === 'aktif');
  const pendingLoans = effectiveLoans.filter((l) => l.status === 'menunggu');
  const completedLoans = effectiveLoans.filter((l) => l.status === 'lunas');

  const totalDisbursed = effectiveLoans
    .filter((l) => l.status === 'aktif' || l.status === 'lunas')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalOutstanding = activeLoans.reduce((acc, curr) => {
    return acc + calculateLoanRemaining(curr).remainingPrincipal;
  }, 0);

  // Filtered Loans
  const filteredLoans = effectiveLoans.filter((l) => {
    if (statusFilter === 'semua') return true;
    return l.status === statusFilter;
  });

  // Live Loan Calculation Preview for form
  const calcMonthlyPrincipal = Math.round(newLoanForm.amount / newLoanForm.tenorMonths);
  const calcMonthlyInterest = Math.round(newLoanForm.amount * (newLoanForm.interestRatePerMonth / 100));
  const calcMonthlyTotal = calcMonthlyPrincipal + calcMonthlyInterest;
  const calcAdminFee = Math.round(newLoanForm.amount * (newLoanForm.adminFeeRate / 100));
  const calcTotalRepayment = calcMonthlyTotal * newLoanForm.tenorMonths;

  const handleLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMemberId = newLoanForm.memberId || eligibleMembers[0]?.id;
    const mem = eligibleMembers.find((m) => m.id === targetMemberId) || members.find((m) => m.id === targetMemberId);
    if (!mem || newLoanForm.amount <= 0) {
      alert('Silakan pilih anggota dan masukkan nominal pinjaman yang valid.');
      return;
    }

    onAddLoan({
      memberId: mem.id,
      memberName: mem.name,
      amount: newLoanForm.amount,
      tenorMonths: Number(newLoanForm.tenorMonths),
      interestRatePerMonth: 1.1, // Suku bunga koperasi terkunci 1.1% flat per bulan
      adminFee: calcAdminFee, // Biaya administrasi terkunci 1.0% potong di awal
      startDate: newLoanForm.startDate,
      status: 'aktif', // Automatically active or approved by admin
      approvedDate: newLoanForm.startDate,
      purpose: newLoanForm.purpose,
      notes: newLoanForm.notes,
    });

    setIsNewLoanModalOpen(false);

    // Show Disbursement Receipt
    onShowReceipt({
      receiptNo: `KW-DISB-${Date.now().toString().slice(-6)}`,
      title: 'BUKTI REALISASI PENCAIRAN PINJAMAN',
      date: newLoanForm.startDate,
      memberId: mem.id,
      memberName: mem.name,
      amount: newLoanForm.amount,
      typeText: `Pencairan Pinjaman KSP (${newLoanForm.tenorMonths} Bulan)`,
      notes: `Tujuan: ${newLoanForm.purpose} • Biaya Admin: ${formatRupiah(calcAdminFee)}`,
      officerName: 'Komite Pinjaman KSP',
      breakdown: [
        { label: 'Plafon Pinjaman', value: formatRupiah(newLoanForm.amount) },
        { label: 'Tenor Cicilan', value: `${newLoanForm.tenorMonths} Bulan` },
        { label: 'Bunga Flat / Bln', value: `${newLoanForm.interestRatePerMonth}%` },
        { label: 'Angsuran / Bln', value: formatRupiah(calcMonthlyTotal) },
        { label: 'Biaya Administrasi', value: formatRupiah(calcAdminFee) },
      ],
    });
  };

  const handleProcessRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaymentModalLoan) return;

    // find first unpaid schedule
    const scheduleItem = repaymentModalLoan.schedules.find((s) => !s.isPaid);
    if (!scheduleItem) {
      alert('Semua cicilan pinjaman ini telah lunas!');
      setRepaymentModalLoan(null);
      return;
    }

    onPayInstallment({
      loanId: repaymentModalLoan.id,
      installmentNo: scheduleItem.month,
      penalty: Number(repaymentForm.penalty) || 0,
      notes: repaymentForm.notes,
      adminName: repaymentForm.adminName,
    });

    const totalPaid = scheduleItem.totalInstallment + (Number(repaymentForm.penalty) || 0);

    setRepaymentModalLoan(null);

    // Show receipt
    onShowReceipt({
      receiptNo: `KW-ANG-${Date.now().toString().slice(-6)}`,
      title: `BUKTI PEMBAYARAN ANGSURAN PINJAMAN #${scheduleItem.month}`,
      date: new Date().toISOString().split('T')[0],
      memberId: repaymentModalLoan.memberId,
      memberName: repaymentModalLoan.memberName,
      amount: totalPaid,
      typeText: `Angsuran Bulan ke-${scheduleItem.month} dari ${repaymentModalLoan.tenorMonths}`,
      notes: repaymentForm.notes,
      officerName: repaymentForm.adminName,
      breakdown: [
        { label: 'Pokok Pinjaman', value: formatRupiah(scheduleItem.principal) },
        { label: 'Jasa Bunga Koperasi', value: formatRupiah(scheduleItem.interest) },
        ...(Number(repaymentForm.penalty) > 0
          ? [{ label: 'Denda Keterlambatan', value: formatRupiah(repaymentForm.penalty) }]
          : []),
        { label: 'Total Dibayar', value: formatRupiah(totalPaid) },
      ],
    });
  };

  // Kas Unit Simpan Pinjam Calculations
  const mutationsList = spCashMutations || [];
  const totalPenambahan = mutationsList
    .filter((m) => m.type === 'penambahan')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalPengurangan = mutationsList
    .filter((m) => m.type === 'pengurangan')
    .reduce((sum, m) => sum + m.amount, 0);

  const saldoAwalKas = 0; // Rp 0 initial balance per user requirement
  const saldoKasUnitSP = saldoAwalKas + totalPenambahan - totalPengurangan;

  // Chronological running balance
  const sortedChronological = [...mutationsList].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let running = saldoAwalKas;
  const mutationsWithRunningBalance = sortedChronological.map((m) => {
    if (m.type === 'penambahan') {
      running += m.amount;
    } else {
      running -= m.amount;
    }
    return { ...m, runningBalance: running };
  });

  // Display sorted by newest first
  const sortedForDisplay = [...mutationsWithRunningBalance].reverse();
  const filteredMutations = sortedForDisplay.filter((m) => {
    if (kasTypeFilter !== 'semua' && m.type !== kasTypeFilter) return false;
    if (kasCategoryFilter !== 'semua' && m.category !== kasCategoryFilter) return false;
    if (kasSearchTerm.trim()) {
      const q = kasSearchTerm.toLowerCase();
      const matchDesc = m.description.toLowerCase().includes(q);
      const matchId = m.id.toLowerCase().includes(q);
      const matchCat = m.category.toLowerCase().includes(q);
      const matchSrc = m.sourceOrRecipient?.toLowerCase().includes(q);
      const matchOfficer = m.recordedBy.toLowerCase().includes(q);
      if (!matchDesc && !matchId && !matchCat && !matchSrc && !matchOfficer) return false;
    }
    return true;
  });

  // Distinct categories for filter
  const distinctCategories = Array.from(new Set(mutationsList.map((m) => m.category)));

  const handleOpenMutationModal = (type: SimpanPinjamCashMutationType) => {
    setMutationForm({
      date: new Date().toISOString().split('T')[0],
      type,
      category:
        type === 'penambahan'
          ? 'Alokasi Dana Simpanan Pokok & Wajib'
          : 'Biaya Operasional Simpan Pinjam',
      amount: type === 'penambahan' ? 10000000 : 500000,
      description:
        type === 'penambahan'
          ? 'Alokasi dana segar dari Simpanan Pokok & Wajib Anggota ke unit simpan pinjam'
          : 'Kebutuhan operasional dan administrasi unit simpan pinjam',
      sourceOrRecipient:
        type === 'penambahan'
          ? 'Kas Simpanan Pokok & Wajib Anggota'
          : 'Operasional Unit Simpan Pinjam',
      recordedBy: currentUser?.name || 'Bendahara Koperasi',
      notes: '',
    });
    setIsMutationModalOpen(true);
  };

  const handleMutationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mutationForm.amount <= 0) {
      alert('Nominal transaksi kas harus lebih dari Rp 0.');
      return;
    }
    if (onAddSpCashMutation) {
      onAddSpCashMutation({
        date: mutationForm.date,
        type: mutationForm.type,
        category: mutationForm.category,
        amount: Number(mutationForm.amount),
        description: mutationForm.description.trim(),
        sourceOrRecipient: mutationForm.sourceOrRecipient.trim(),
        recordedBy: mutationForm.recordedBy.trim(),
        notes: mutationForm.notes.trim() || undefined,
      });
    }
    setIsMutationModalOpen(false);
  };

  const handlePrintBuktiKasPdf = (m: SimpanPinjamCashMutation) => {
    const isMasuk = m.type === 'penambahan';
    const title = isMasuk ? 'BUKTI KAS MASUK UNIT SIMPAN PINJAM' : 'BUKTI KAS KELUAR UNIT SIMPAN PINJAM';
    const badgeColor = isMasuk ? '#047857' : '#b91c1c';
    const badgeText = isMasuk ? 'PENAMBAHAN KAS (MASUK)' : 'PENGURANGAN KAS (KELUAR)';

    const reportHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 52px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | Standar SAK Koperasi</p>
          </div>
        </div>
      </div>

      <div class="document-title">${title}</div>
      <div class="doc-number">No. Bukti Transaksi: ${m.id} &bull; Tanggal: ${formatDateIndo(m.date)}</div>

      <div class="content-box">
        <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px;">
          <table style="width: 100%;">
            <tr>
              <td style="width: 28%; font-weight: bold; padding: 4px 0;">Jenis Mutasi:</td>
              <td style="width: 72%; padding: 4px 0;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #ffffff; background: ${badgeColor};">
                  ${badgeText}
                </span>
              </td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Kategori Transaksi:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #1e3a8a;">${m.category}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">${isMasuk ? 'Sumber Dana / Penyetor' : 'Penerima / Tujuan Penggunaan'}:</td>
              <td style="padding: 4px 0;">${m.sourceOrRecipient || '-'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Keterangan / Deskripsi:</td>
              <td style="padding: 4px 0; color: #334155;">${m.description}</td>
            </tr>
            ${m.notes ? `<tr><td style="font-weight: bold; padding: 4px 0;">Catatan Tambahan:</td><td style="padding: 4px 0; color: #64748b;">${m.notes}</td></tr>` : ''}
          </table>
        </div>

        <div style="margin: 20px 0; padding: 16px; background: #f1f5f9; border-radius: 8px; border-left: 6px solid ${badgeColor}; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">JUMLAH NOMINAL:</span>
            <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: ${badgeColor}; margin-top: 4px;">
              ${formatRupiah(m.amount)}
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            Unit Kerja: <strong>Unit Simpan Pinjam (USP)</strong><br />
            Dicatat oleh: <strong>${m.recordedBy}</strong>
          </div>
        </div>

        <div style="margin-top: 36px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
          <div>
            <p style="margin: 0; font-weight: bold;">${isMasuk ? 'Penyetor / Sumber Dana' : 'Penerima Dana'},</p>
            <div style="height: 50px;"></div>
            <span style="font-weight: bold; text-decoration: underline;">${m.sourceOrRecipient || 'Pihak Terkait'}</span>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold;">Manajer Unit Simpan Pinjam,</p>
            <div style="height: 50px;"></div>
            <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.manajerUSP}</span>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold;">Bendahara Koperasi,</p>
            <div style="height: 50px;"></div>
            <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.bendahara}</span>
          </div>
        </div>
      </div>
    `;

    printHtmlContent(reportHtml, `Bukti-Kas-${m.id}`);
  };

  const handlePrintKasUnitSpPdf = () => {
    const rows = mutationsWithRunningBalance.map((m, idx) => {
      const isMasuk = m.type === 'penambahan';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10.5px;">
          <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 8px; white-space: nowrap;">${formatDateIndo(m.date)}</td>
          <td style="padding: 6px 8px; font-family: monospace; font-size: 10px;">${m.id}</td>
          <td style="padding: 6px 8px;">
            <strong>${m.category}</strong><br />
            <span style="color: #64748b; font-size: 10px;">${m.description}</span>
          </td>
          <td style="padding: 6px 8px; color: #475569; font-size: 10px;">${m.sourceOrRecipient || '-'}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #047857; font-weight: 600;">
            ${isMasuk ? formatRupiah(m.amount) : '-'}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #b91c1c; font-weight: 600;">
            ${!isMasuk ? formatRupiah(m.amount) : '-'}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">
            ${formatRupiah(m.runningBalance || 0)}
          </td>
        </tr>
      `;
    }).join('');

    const reportHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 52px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK ETAP Koperasi</p>
          </div>
        </div>
      </div>

      <div class="document-title">BUKU KAS & LAPORAN MUTASI KAS UNIT SIMPAN PINJAM</div>
      <div class="doc-number">Periode Pembukuan Berjalan ${new Date().getFullYear()} &bull; Tanggal Cetak: ${formatDateIndo(new Date().toISOString())}</div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; font-size: 11px;">
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background: #f8fafc; text-align: center;">
          <span style="color: #64748b; font-size: 10px; font-weight: bold;">SALDO AWAL KAS:</span>
          <div style="font-weight: 900; font-family: monospace; font-size: 13px; margin-top: 4px;">${formatRupiah(saldoAwalKas)}</div>
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background: #ecfdf5; text-align: center;">
          <span style="color: #047857; font-size: 10px; font-weight: bold;">TOTAL PENAMBAHAN KAS:</span>
          <div style="font-weight: 900; font-family: monospace; font-size: 13px; margin-top: 4px; color: #047857;">+ ${formatRupiah(totalPenambahan)}</div>
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background: #fff1f2; text-align: center;">
          <span style="color: #be123c; font-size: 10px; font-weight: bold;">TOTAL PENGURANGAN KAS:</span>
          <div style="font-weight: 900; font-family: monospace; font-size: 13px; margin-top: 4px; color: #be123c;">- ${formatRupiah(totalPengurangan)}</div>
        </div>
        <div style="border: 1px solid #1e3a8a; padding: 10px; border-radius: 8px; background: #eff6ff; text-align: center;">
          <span style="color: #1e3a8a; font-size: 10px; font-weight: bold;">SALDO KAS SAAT INI:</span>
          <div style="font-weight: 900; font-family: monospace; font-size: 14px; margin-top: 4px; color: #1e3a8a;">${formatRupiah(saldoKasUnitSP)}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10.5px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px 8px; width: 30px; text-align: center;">No</th>
            <th style="padding: 6px 8px;">Tanggal</th>
            <th style="padding: 6px 8px;">No. Bukti</th>
            <th style="padding: 6px 8px;">Kategori & Keterangan</th>
            <th style="padding: 6px 8px;">Sumber / Penerima</th>
            <th style="padding: 6px 8px; text-align: right;">Masuk (Debit)</th>
            <th style="padding: 6px 8px; text-align: right;">Keluar (Kredit)</th>
            <th style="padding: 6px 8px; text-align: right;">Saldo (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8" style="padding: 16px; text-align: center; color: #94a3b8;">Belum ada catatan mutasi kas unit simpan pinjam</td></tr>`}
        </tbody>
      </table>

      <div style="margin-top: 36px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
        <div>
          <p style="margin: 0; font-weight: bold;">Manajer Unit Simpan Pinjam,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.manajerUSP}</span>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold;">Ketua Koperasi,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.ketua}</span>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold;">Bendahara Koperasi,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.bendahara}</span>
        </div>
      </div>
    `;

    printHtmlContent(reportHtml, 'Buku-Kas-Unit-Simpan-Pinjam-BJS');
  };

  return (
    <div className="space-y-6">
      {/* Sub-Menu Navigasi Modul Pinjaman / Simpan Pinjam */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveSubTab('daftar_pinjaman')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'daftar_pinjaman'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            <span>Daftar Pinjaman Anggota</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubTab === 'daftar_pinjaman'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {effectiveLoans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('kas_unit_sp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'kas_unit_sp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Kas Unit Simpan Pinjam</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                saldoKasUnitSP > 0
                  ? activeSubTab === 'kas_unit_sp'
                    ? 'bg-emerald-900 text-emerald-200'
                    : 'bg-emerald-100 text-emerald-800'
                  : activeSubTab === 'kas_unit_sp'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {formatRupiah(saldoKasUnitSP)}
            </span>
          </button>
        </div>

        {activeSubTab === 'kas_unit_sp' && userRole === 'pengurus' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenMutationModal('penambahan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Tambah Kas (Masuk)</span>
            </button>
            <button
              onClick={() => handleOpenMutationModal('pengurangan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <MinusCircle className="w-4 h-4" />
              <span>- Kurang Kas (Keluar)</span>
            </button>
            <button
              onClick={handlePrintKasUnitSpPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer shadow-xs"
              title="Cetak Laporan Buku Kas Unit Simpan Pinjam"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Buku Kas</span>
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'daftar_pinjaman' && (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Pinjaman Disalurkan
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xl font-bold font-mono text-slate-900">
            {formatRupiah(totalDisbursed)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Total akumulasi pencairan modal</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sisa Pinjaman Beredar
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xl font-bold font-mono text-slate-900">
            {formatRupiah(totalOutstanding)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Sisa pokok yang sedang dicicil</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pinjaman Aktif
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <span className="text-xs font-bold font-mono">{activeLoans.length}</span>
            </div>
          </div>
          <div className="mt-3 text-xl font-bold font-mono text-slate-900">
            {activeLoans.length} Berjalan
          </div>
          <div className="mt-2 text-xs text-slate-500">{completedLoans.length} pinjaman lunas</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pengajuan Menunggu
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <span className="text-xs font-bold font-mono">{pendingLoans.length}</span>
            </div>
          </div>
          <div className="mt-3 text-xl font-bold font-mono text-slate-900">
            {pendingLoans.length} Pengajuan
          </div>
          <div className="mt-2 text-xs text-slate-500">Perlu persetujuan komite</div>
        </div>
      </div>

      {/* Control & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-700" />
            Pengelolaan Pinjaman & Angsuran Anggota
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar kredit produktif/konsumtif anggota dengan bunga transparan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            <option value="semua">Semua Status</option>
            <option value="aktif">Aktif (Sedang Dicicil)</option>
            <option value="menunggu">Menunggu Persetujuan</option>
            <option value="lunas">Lunas</option>
            <option value="ditolak">Ditolak</option>
          </select>

          {userRole === 'pengurus' && (
            <button
              onClick={() => setIsNewLoanModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              + Pengajuan Pinjaman Baru
            </button>
          )}
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">ID Pinjaman & Anggota</th>
                <th className="px-5 py-3.5">Keperluan Pinjaman</th>
                <th className="px-5 py-3.5 text-right">Plafon (Rp)</th>
                <th className="px-5 py-3.5">Tenor & Bunga</th>
                <th className="px-5 py-3.5 text-right">Cicilan / Bln</th>
                <th className="px-5 py-3.5 text-center">Progress Cicilan</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                    Tidak ada data pinjaman pada kategori ini.
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                  const { paidCount, remainingPrincipal } = calculateLoanRemaining(loan);
                  const progressPct = Math.round((paidCount / loan.tenorMonths) * 100);

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                          {loan.id}
                        </span>
                        <div className="font-semibold text-slate-900 mt-1">{loan.memberName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{loan.memberId}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs">
                        <div className="font-medium text-slate-800 line-clamp-1">{loan.purpose}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Cair: {formatDateIndo(loan.startDate)}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(loan.amount)}
                        <div className="text-[10px] font-sans text-slate-400 font-normal">
                          Admin: {formatRupiah(loan.adminFee)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-700">
                        <span className="font-semibold">{loan.tenorMonths} Bulan</span>
                        <div className="text-[11px] text-slate-400">{loan.interestRatePerMonth}% / bln flat</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900 text-xs">
                        {formatRupiah(loan.monthlyTotal)}
                        <div className="text-[10px] text-slate-400 font-normal">
                          Pokok: {formatRupiah(loan.monthlyPrincipal)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="text-xs font-semibold text-slate-800">
                          {paidCount} / {loan.tenorMonths} Bulan
                        </div>
                        <div className="w-24 mx-auto bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              progressPct === 100 ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{progressPct}% terbayar</div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            loan.status === 'aktif'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : loan.status === 'lunas'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : loan.status === 'menunggu'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {loan.status === 'aktif'
                            ? 'Aktif'
                            : loan.status === 'lunas'
                            ? 'Lunas'
                            : loan.status === 'menunggu'
                            ? 'Menunggu'
                            : 'Ditolak'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {userRole === 'pengurus' && loan.status === 'menunggu' && (
                            <>
                              <button
                                onClick={() => onApproveLoan(loan.id)}
                                title="Setujui Pinjaman"
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Setujui
                              </button>
                              <button
                                onClick={() => onRejectLoan(loan.id)}
                                title="Tolak Pinjaman"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {userRole === 'pengurus' && loan.status === 'aktif' && (
                            <button
                              onClick={() => {
                                setRepaymentModalLoan(loan);
                                setRepaymentForm({
                                  penalty: 0,
                                  notes: `Angsuran pinjaman ${loan.id}`,
                                  adminName: 'Petugas Koperasi',
                                });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-semibold transition cursor-pointer border border-emerald-200"
                            >
                              <ReceiptText className="w-3.5 h-3.5" />
                              Bayar
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedLoanDetail(loan)}
                            title="Jadwal Angsuran"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {userRole === 'pengurus' && onDeleteLoan && (
                            <button
                              onClick={() => setLoanToDelete(loan)}
                              title="Hapus Pinjaman"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* SUB-TAB 2: KAS UNIT SIMPAN PINJAM (MUTASI & ADJUSTMENT KAS) */}
  {activeSubTab === 'kas_unit_sp' && (
    <div className="space-y-6">
      {/* Top Banner Kas Unit SP */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-5 text-white shadow-md border border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
              UNIT SIMPAN PINJAM (USP)
            </span>
            <span className="text-xs text-emerald-200">Pengelolaan Buku Kas & Mutasi Saldo Fleksibel</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Kas Unit Simpan Pinjam
          </h2>
          <p className="text-emerald-100/80 text-xs mt-0.5">
            Pengurus dan bendahara dapat melakukan penyesuaian (adjustment) saldo kas secara fleksibel melalui transaksi Penambahan maupun Pengurangan Kas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-emerald-300">
            Saldo Awal: {formatRupiah(saldoAwalKas)}
          </span>
        </div>
      </div>

      {/* 4 KPI Summary Cards for Kas Unit SP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Kas Saat Ini */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Saldo Kas Unit SP Saat Ini
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className={`mt-3 text-2xl font-black font-mono ${saldoKasUnitSP >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatRupiah(saldoKasUnitSP)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Saldo Awal: Rp 0</span>
            <span className="font-semibold text-emerald-800">Tersedia</span>
          </div>
        </div>

        {/* Card 2: Total Penambahan Kas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Penambahan Kas (Masuk)
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-emerald-700">
            + {formatRupiah(totalPenambahan)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Alokasi Simpanan Pokok & Wajib / Injeksi</div>
        </div>

        {/* Card 3: Total Pengurangan Kas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Pengurangan Kas (Keluar)
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <ArrowUpRight className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-rose-700">
            - {formatRupiah(totalPengurangan)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Kebutuhan operasional & pengadaan unit SP</div>
        </div>

        {/* Card 4: Total Mutasi Tercatat */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Mutasi Tercatat
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-slate-900">
            {mutationsList.length} Transaksi
          </div>
          <div className="mt-2 text-xs text-slate-500">Tercatat dalam Buku Kas Unit SP</div>
        </div>
      </div>

      {/* Filter & Action Bar for Kas Unit SP */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari transaksi kas, no bukti, keterangan..."
              value={kasSearchTerm}
              onChange={(e) => setKasSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={kasTypeFilter}
            onChange={(e) => setKasTypeFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            <option value="semua">Semua Jenis Mutasi</option>
            <option value="penambahan">Penambahan Kas (+ Masuk)</option>
            <option value="pengurangan">Pengurangan Kas (- Keluar)</option>
          </select>

          {/* Category Filter */}
          {distinctCategories.length > 0 && (
            <select
              value={kasCategoryFilter}
              onChange={(e) => setKasCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer max-w-[220px] truncate"
            >
              <option value="semua">Semua Kategori</option>
              {distinctCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {(kasSearchTerm || kasTypeFilter !== 'semua' || kasCategoryFilter !== 'semua') && (
            <button
              onClick={() => {
                setKasSearchTerm('');
                setKasTypeFilter('semua');
                setKasCategoryFilter('semua');
              }}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>

        {userRole === 'pengurus' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenMutationModal('penambahan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Tambah Kas (Masuk)</span>
            </button>
            <button
              onClick={() => handleOpenMutationModal('pengurangan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <MinusCircle className="w-4 h-4" />
              <span>- Kurang Kas (Keluar)</span>
            </button>
          </div>
        )}
      </div>

      {/* Buku Kas Unit Simpan Pinjam Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-emerald-700" />
              Buku Kas Unit Simpan Pinjam & Mutasi Saldo
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan riwayat penyesuaian kas, debit, kredit, dan saldo berjalan (running balance)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              {filteredMutations.length} Transaksi Ditampilkan
            </span>
            <button
              onClick={handlePrintKasUnitSpPdf}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Buku Kas</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Tanggal & No. Bukti</th>
                <th className="px-4 py-3.5">Jenis Mutasi</th>
                <th className="px-4 py-3.5">Kategori & Keterangan</th>
                <th className="px-4 py-3.5">Sumber / Penerima</th>
                <th className="px-4 py-3.5 text-right text-emerald-800">Kas Masuk (Debit)</th>
                <th className="px-4 py-3.5 text-right text-rose-800">Kas Keluar (Kredit)</th>
                <th className="px-4 py-3.5 text-right font-black text-slate-900">Saldo Berjalan</th>
                <th className="px-4 py-3.5">Petugas</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMutations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                      <Wallet className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {mutationsList.length === 0
                        ? 'Belum Ada Transaksi Kas Unit Simpan Pinjam'
                        : 'Tidak Ada Transaksi yang Cocok dengan Filter'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                      {mutationsList.length === 0
                        ? 'Saldo awal Kas Unit Simpan Pinjam disetel Rp0 (nol). Pengurus/bendahara dapat mencatat penyesuaian saldo melalui tombol "+ Tambah Kas" (misal alokasi dana segar Rp10.000.000 dari Simpanan Pokok & Wajib) atau "- Kurang Kas" untuk kebutuhan operasional.'
                        : 'Silakan ubah filter jenis, kategori, atau kata kunci pencarian Anda untuk melihat transaksi lainnya.'}
                    </p>
                    {userRole === 'pengurus' && mutationsList.length === 0 && (
                      <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <button
                          onClick={() => handleOpenMutationModal('penambahan')}
                          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>+ Alokasi Dana Segar Rp10.000.000</span>
                        </button>
                        <button
                          onClick={() => handleOpenMutationModal('pengurangan')}
                          className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <MinusCircle className="w-4 h-4" />
                          <span>- Catat Pengurangan Kas</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMutations.map((m) => {
                  const isMasuk = m.type === 'penambahan';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{formatDateIndo(m.date)}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{m.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            isMasuk
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {isMasuk ? (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                              <span>+ Tambah Kas</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                              <span>- Kurang Kas</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-bold text-slate-900 truncate">{m.category}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
                          {m.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-medium truncate max-w-[150px]">
                          {m.sourceOrRecipient || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 text-xs">
                        {isMasuk ? `+ ${formatRupiah(m.amount)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-700 text-xs">
                        {!isMasuk ? `- ${formatRupiah(m.amount)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900 text-xs">
                        {formatRupiah(m.runningBalance || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {m.recordedBy}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handlePrintBuktiKasPdf(m)}
                            title="Cetak Bukti Kuitansi Kas (PDF)"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                          >
                            <ReceiptText className="w-4 h-4" />
                          </button>
                          {userRole === 'pengurus' && onDeleteSpCashMutation && (
                            <button
                              onClick={() => setMutationToDelete(m)}
                              title="Hapus Transaksi Kas"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* MODAL: TAMBAH & KURANG KAS UNIT SIMPAN PINJAM (PENYESUAIAN SALDO) */}
  {isMutationModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
        <div className={`flex items-center justify-between border-b px-6 py-4 text-white ${
          mutationForm.type === 'penambahan' ? 'bg-gradient-to-r from-emerald-900 to-teal-900 border-emerald-800' : 'bg-gradient-to-r from-rose-900 to-red-900 border-rose-800'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                mutationForm.type === 'penambahan' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}>
                {mutationForm.type === 'penambahan' ? 'KAS MASUK' : 'KAS KELUAR'}
              </span>
              <span className="text-xs text-white/80 font-medium">Unit Simpan Pinjam</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {mutationForm.type === 'penambahan' ? 'Penambahan Saldo Kas Unit SP' : 'Pengurangan Saldo Kas Unit SP'}
            </h3>
          </div>
          <button
            onClick={() => setIsMutationModalOpen(false)}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleMutationSubmit} className="p-6 space-y-4">
          {/* Toggle Jenis Mutasi */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMutationForm((prev) => ({
                  ...prev,
                  type: 'penambahan',
                  category: 'Alokasi Dana Simpanan Pokok & Wajib',
                  description: 'Alokasi dana segar dari Simpanan Pokok & Wajib Anggota ke unit simpan pinjam',
                  sourceOrRecipient: 'Kas Simpanan Pokok & Wajib Anggota',
                }));
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mutationForm.type === 'penambahan'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Penambahan Kas (Masuk)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMutationForm((prev) => ({
                  ...prev,
                  type: 'pengurangan',
                  category: 'Biaya Operasional Simpan Pinjam',
                  description: 'Kebutuhan operasional dan pengadaan unit simpan pinjam',
                  sourceOrRecipient: 'Operasional Unit Simpan Pinjam',
                }));
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mutationForm.type === 'pengurangan'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>- Pengurangan Kas (Keluar)</span>
            </button>
          </div>

          {/* Quick Scenario Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Pilihan Skenario Cepat:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {mutationForm.type === 'penambahan' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMutationForm((prev) => ({
                        ...prev,
                        category: 'Alokasi Dana Simpanan Pokok & Wajib',
                        amount: 10000000,
                        description: 'Alokasi dana segar dari Simpanan Pokok & Wajib Anggota ke unit simpan pinjam',
                        sourceOrRecipient: 'Kas Simpanan Pokok & Wajib Anggota',
                      }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                  >
                    💡 Alokasi Rp10 Jt dari Simpanan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMutationForm((prev) => ({
                        ...prev,
                        category: 'Injeksi Modal Kas Koperasi',
                        amount: 5000000,
                        description: 'Injeksi likuiditas modal kas koperasi ke kas simpan pinjam',
                        sourceOrRecipient: 'Kas Umum Koperasi',
                      }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Injeksi Modal Rp5 Jt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMutationForm((prev) => ({
                        ...prev,
                        category: 'Pengembalian Dana Kasbon / Panjar',
                        amount: 1000000,
                        description: 'Pengembalian sisa dana panjar/kasbon operasional simpan pinjam',
                        sourceOrRecipient: 'Petugas / Bendahara',
                      }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Pengembalian Dana Rp1 Jt
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMutationForm((prev) => ({
                        ...prev,
                        category: 'Biaya Operasional Simpan Pinjam',
                        amount: 500000,
                        description: 'Biaya operasional simpan pinjam, ATK, materai, dan administrasi',
                        sourceOrRecipient: 'Pengadaan Operasional USP',
                      }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                  >
                    Operasional & ATK Rp500 Rb
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMutationForm((prev) => ({
                        ...prev,
                        category: 'Pengadaan Perlengkapan SP',
                        amount: 1500000,
                        description: 'Pengadaan perlengkapan dan sarana pelayanan simpan pinjam',
                        sourceOrRecipient: 'Toko Perlengkapan Kantor',
                      }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Pengadaan Sarana Rp1,5 Jt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMutationForm((prev) => ({
                        ...prev,
                        category: 'Alokasi ke Kas Umum Koperasi',
                        amount: 2000000,
                        description: 'Transfer / pemindahan saldo dari kas SP ke kas umum koperasi',
                        sourceOrRecipient: 'Kas Umum Koperasi',
                      }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Transfer ke Kas Umum
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Transaksi <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={mutationForm.date}
                onChange={(e) => setMutationForm({ ...mutationForm, date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Mutasi <span className="text-rose-500">*</span>
              </label>
              <select
                value={mutationForm.category}
                onChange={(e) => setMutationForm({ ...mutationForm, category: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white cursor-pointer"
              >
                {mutationForm.type === 'penambahan' ? (
                  <>
                    <option value="Alokasi Dana Simpanan Pokok & Wajib">Alokasi Dana Simpanan Pokok & Wajib</option>
                    <option value="Injeksi Modal Kas Koperasi">Injeksi Modal Kas Koperasi</option>
                    <option value="Pengembalian Dana Kasbon / Panjar">Pengembalian Dana Kasbon / Panjar</option>
                    <option value="Pendapatan Operasional Unit SP">Pendapatan Operasional Unit SP</option>
                    <option value="Penyesuaian Saldo Kas (Adjustment In)">Penyesuaian Saldo Kas (Adjustment In)</option>
                    <option value="Lainnya">Lainnya</option>
                  </>
                ) : (
                  <>
                    <option value="Biaya Operasional Simpan Pinjam">Biaya Operasional Simpan Pinjam</option>
                    <option value="Pengadaan Perlengkapan SP">Pengadaan Perlengkapan SP</option>
                    <option value="Pengadaan Perangkat / Inventaris SP">Pengadaan Perangkat / Inventaris SP</option>
                    <option value="Biaya Administrasi & Operasional Bank">Biaya Administrasi & Operasional Bank</option>
                    <option value="Alokasi ke Kas Umum Koperasi">Alokasi ke Kas Umum Koperasi</option>
                    <option value="Penyesuaian Saldo Kas (Adjustment Out)">Penyesuaian Saldo Kas (Adjustment Out)</option>
                    <option value="Lainnya">Lainnya</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nominal Transaksi (Rp) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={mutationForm.amount || ''}
                onChange={(e) => setMutationForm({ ...mutationForm, amount: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                placeholder="0"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Terbaca:</span>
              <span className="font-mono font-bold text-emerald-700">{formatRupiah(mutationForm.amount || 0)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {mutationForm.type === 'penambahan' ? 'Sumber Dana / Penyetor' : 'Pihak Penerima / Tujuan Penggunaan'}
            </label>
            <input
              type="text"
              value={mutationForm.sourceOrRecipient}
              onChange={(e) => setMutationForm({ ...mutationForm, sourceOrRecipient: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              placeholder={mutationForm.type === 'penambahan' ? 'Contoh: Kas Simpanan Pokok & Wajib' : 'Contoh: Toko ATK / Pengadaan Perlengkapan'}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Keterangan / Deskripsi Transaksi <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={mutationForm.description}
              onChange={(e) => setMutationForm({ ...mutationForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white leading-relaxed"
              placeholder="Jelaskan tujuan mutasi kas secara ringkas dan jelas..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dicatat Oleh / Petugas
              </label>
              <input
                type="text"
                value={mutationForm.recordedBy}
                onChange={(e) => setMutationForm({ ...mutationForm, recordedBy: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                value={mutationForm.notes}
                onChange={(e) => setMutationForm({ ...mutationForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                placeholder="No. nota, kwitansi, atau memo"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsMutationModalOpen(false)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-black rounded-xl text-white shadow-md transition cursor-pointer flex items-center gap-1.5 ${
                mutationForm.type === 'penambahan' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Simpan Mutasi Kas</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* MODAL: KONFIRMASI HAPUS MUTASI KAS */}
  {mutationToDelete && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
        <div className="p-6">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Hapus Transaksi Kas?</h3>
              <p className="text-xs text-slate-500">Konfirmasi pembatalan pencatatan mutasi kas</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mt-3">
            Apakah Anda yakin ingin menghapus mutasi kas <strong className="text-slate-900">{mutationToDelete.id}</strong> (
            <strong className="text-slate-900">{mutationToDelete.category}</strong> - {formatRupiah(mutationToDelete.amount)})?
          </p>

          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span>Nominal:</span>
              <span className="font-mono font-bold text-slate-900">{formatRupiah(mutationToDelete.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Jenis:</span>
              <span className="font-semibold uppercase">{mutationToDelete.type}</span>
            </div>
            <div className="flex justify-between">
              <span>Keterangan:</span>
              <span className="truncate max-w-[200px]">{mutationToDelete.description}</span>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setMutationToDelete(null)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (onDeleteSpCashMutation) {
                  onDeleteSpCashMutation(mutationToDelete.id);
                }
                setMutationToDelete(null);
              }}
              className="px-4 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer"
            >
              Ya, Hapus Transaksi
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* MODAL: DETAIL JADWAL ANGSURAN PINJAMAN (AMORTISASI) */}
      {selectedLoanDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Buku & Jadwal Cicilan Pinjaman
                  </h3>
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {selectedLoanDetail.id}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Peminjam: <span className="font-semibold text-slate-800">{selectedLoanDetail.memberName}</span> ({selectedLoanDetail.memberId})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintAmortizationSchedule(selectedLoanDetail)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  title="Cetak Jadwal Amortisasi Resmi (PDF)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Jadwal (PDF)</span>
                </button>
                {userRole === 'pengurus' && onDeleteLoan && (
                  <button
                    onClick={() => {
                      setLoanToDelete(selectedLoanDetail);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition cursor-pointer"
                    title="Hapus Data Pinjaman"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Pinjaman</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedLoanDetail(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
              {/* Summary of this loan */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Plafon Pinjaman</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {formatRupiah(selectedLoanDetail.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tenor & Bunga</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLoanDetail.tenorMonths} Bln ({selectedLoanDetail.interestRatePerMonth}% / bln)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Angsuran per Bulan</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {formatRupiah(selectedLoanDetail.monthlyTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sisa Pokok</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">
                    {formatRupiah(calculateLoanRemaining(selectedLoanDetail).remainingPrincipal)}
                  </span>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Bulan Ke</th>
                      <th className="px-3 py-2.5">Jatuh Tempo</th>
                      <th className="px-3 py-2.5 text-right">Pokok</th>
                      <th className="px-3 py-2.5 text-right">Bunga</th>
                      <th className="px-3 py-2.5 text-right font-bold">Total Cicilan</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-right">Tanggal Bayar</th>
                      <th className="px-3 py-2.5 text-center">Aksi / Koreksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {selectedLoanDetail.schedules.map((item) => (
                      <tr key={item.month} className={item.isPaid ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-2.5 font-sans font-semibold text-slate-800">
                          Bulan #{item.month}
                        </td>
                        <td className="px-3 py-2.5 font-sans text-slate-600">
                          {formatDateIndo(item.dueDate)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatRupiah(item.principal)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatRupiah(item.interest)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {formatRupiah(item.totalInstallment)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-sans">
                          {item.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              LUNAS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              BELUM DIBAYAR
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-sans text-slate-500">
                          {item.paidDate ? formatDateIndo(item.paidDate) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-center font-sans">
                          {userRole === 'pengurus' && (
                            <button
                              onClick={() => {
                                setEditingScheduleItem({
                                  loanId: selectedLoanDetail.id,
                                  month: item.month,
                                  isPaid: item.isPaid,
                                  paidDate: item.paidDate || new Date().toISOString().split('T')[0],
                                  notes: '',
                                });
                              }}
                              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer inline-flex items-center gap-1"
                              title="Koreksi / Edit Status Pembayaran"
                            >
                              <Edit3 className="w-3 h-3 text-slate-600" />
                              <span>Edit</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-between items-center">
              <p className="text-xs text-slate-500 italic">
                * Gunakan tombol "Edit" di atas jika ada salah klik pembayaran angsuran.
              </p>
              <button
                onClick={() => setSelectedLoanDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / KOREKSI PEMBAYARAN ANGSURAN (MENGATASI SALAH KLIK BAYAR) */}
      {editingScheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-800 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Koreksi Angsuran Bulan #{editingScheduleItem.month}</h3>
                  <p className="text-[11px] text-slate-300 font-mono">Pinjaman: {editingScheduleItem.loanId}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingScheduleItem(null)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  Koreksi Status Pembayaran:
                </p>
                Fitur ini disediakan jika terjadi kesalahan klik bayar padahal anggota belum menyetorkan angsuran, atau ingin mengubah tanggal pembayaran.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Pilih Status Pembayaran:
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                      !editingScheduleItem.isPaid
                        ? 'border-rose-300 bg-rose-50/50 text-rose-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={!editingScheduleItem.isPaid}
                      onChange={() =>
                        setEditingScheduleItem({
                          ...editingScheduleItem,
                          isPaid: false,
                        })
                      }
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span>BELUM DIBAYAR (Batalkan pelunasan / salah klik)</span>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Status angsuran akan dikembalikan menjadi tertunggak/belum bayar.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                      editingScheduleItem.isPaid
                        ? 'border-emerald-300 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={editingScheduleItem.isPaid}
                      onChange={() =>
                        setEditingScheduleItem({
                          ...editingScheduleItem,
                          isPaid: true,
                        })
                      }
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span>SUDAH LUNAS / SUDAH DIBAYAR</span>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Tandai angsuran ini telah diterima pembayarannya.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {editingScheduleItem.isPaid && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    value={editingScheduleItem.paidDate}
                    onChange={(e) =>
                      setEditingScheduleItem({
                        ...editingScheduleItem,
                        paidDate: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingScheduleItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveScheduleEdit}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Simpan Perubahan Koreksi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BAYAR ANGSURAN */}
      {repaymentModalLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-emerald-700" />
                Penerimaan Pembayaran Angsuran
              </h3>
              <button
                onClick={() => setRepaymentModalLoan(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const nextSchedule = repaymentModalLoan.schedules.find((s) => !s.isPaid);
              if (!nextSchedule) return null;

              const subtotal = nextSchedule.totalInstallment + (Number(repaymentForm.penalty) || 0);

              return (
                <form onSubmit={handleProcessRepayment} className="p-6 space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Peminjam:</span>
                      <span className="font-bold text-slate-900">{repaymentModalLoan.memberName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Angsuran Ke:</span>
                      <span className="font-bold text-emerald-800">
                        Bulan #{nextSchedule.month} dari {repaymentModalLoan.tenorMonths}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jatuh Tempo:</span>
                      <span className="font-medium text-slate-800">{formatDateIndo(nextSchedule.dueDate)}</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-200/60 pt-1.5">
                      <span className="text-slate-600 font-semibold">Pokok: {formatRupiah(nextSchedule.principal)}</span>
                      <span className="text-slate-600 font-semibold">Bunga: {formatRupiah(nextSchedule.interest)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Denda Keterlambatan (Jika Ada) (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={repaymentForm.penalty}
                      onChange={(e) => setRepaymentForm({ ...repaymentForm, penalty: Number(e.target.value) })}
                      className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 text-white flex justify-between items-center">
                    <span className="font-semibold text-xs text-slate-300">Total Yang Diterima Kasir:</span>
                    <span className="font-mono font-bold text-lg text-emerald-400">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Petugas Kasir</label>
                    <input
                      type="text"
                      value={repaymentForm.adminName}
                      onChange={(e) => setRepaymentForm({ ...repaymentForm, adminName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                    <input
                      type="text"
                      value={repaymentForm.notes}
                      onChange={(e) => setRepaymentForm({ ...repaymentForm, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRepaymentModalLoan(null)}
                      className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Konfirmasi Bayar & Cetak Kwitansi
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: PENGAJUAN PINJAMAN BARU */}
      {isNewLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-700" />
                Formulir Pengajuan Pinjaman Anggota
              </h3>
              <button
                onClick={() => setIsNewLoanModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLoanSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Anggota Peminjam <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newLoanForm.memberId}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, memberId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                >
                  {eligibleMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Hanya menampilkan nomor registrasi dan nama anggota aktif (anggota keluar tidak ditampilkan).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Pengajuan (Plafon Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={500000}
                    step={500000}
                    required
                    value={newLoanForm.amount}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono font-bold text-sm text-slate-900 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {/* Preset chip amounts */}
                  <div className="flex gap-1.5 mt-2">
                    {[3000000, 5000000, 10000000, 15000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setNewLoanForm({ ...newLoanForm, amount: amt })}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-mono text-slate-700 cursor-pointer"
                      >
                        {amt / 1000000}jt
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Tenor Pinjaman (Bulan) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-blue-900 font-mono">
                      {newLoanForm.tenorMonths} Bulan ({Math.round(newLoanForm.tenorMonths / 12 * 10) / 10} Thn)
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={newLoanForm.tenorMonths}
                    onChange={(e) =>
                      setNewLoanForm({
                        ...newLoanForm,
                        tenorMonths: Math.max(1, Number(e.target.value)),
                      })
                    }
                    placeholder="Ketik jumlah bulan, cth: 10"
                    className="w-full px-3 py-2 font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[3, 6, 10, 12, 18, 24, 36].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewLoanForm({ ...newLoanForm, tenorMonths: t })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${
                          newLoanForm.tenorMonths === t
                            ? 'bg-blue-900 text-white font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t} bln
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Suku Bunga Koperasi (% Flat / Bulan)
                    </label>
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Terkunci
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="1,1%"
                      className="w-full px-3 py-2 font-mono font-bold text-xs rounded-lg border border-slate-300 bg-slate-100 text-slate-800 cursor-not-allowed select-none"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-900 font-bold mt-1 block">
                    1,1% Flat per Bulan (Sesuai Ketentuan ART - Terkunci)
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Biaya Administrasi (% Potong di Awal)
                    </label>
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Terkunci
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="1,0%"
                      className="w-full px-3 py-2 font-mono font-bold text-xs rounded-lg border border-slate-300 bg-slate-100 text-slate-800 cursor-not-allowed select-none"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium mt-1 block">
                    Nominal: <strong className="text-slate-900 font-mono">{formatRupiah(calcAdminFee)}</strong> (1,0% Potong di Awal - Terkunci)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keperluan / Peruntukan Pinjaman <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pembelian mesin jahit dan bahan kain konveksi"
                  value={newLoanForm.purpose}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* LIVE SIMULATION BOX */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Rincian Simulasi Cicilan:</span>
                  <span className="text-[11px] text-emerald-700 font-semibold">Otomatis Terhitung (1,1% Flat)</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500">Angsuran Pokok / Bln:</span>
                    <span className="font-mono font-medium">{formatRupiah(calcMonthlyPrincipal)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500">Jasa Bunga / Bln:</span>
                    <span className="font-mono font-medium">{formatRupiah(calcMonthlyInterest)}</span>
                  </div>
                  <div className="flex justify-between col-span-2 pt-1 font-semibold text-xs">
                    <span className="text-slate-800">Total Angsuran Wajib Tiap Bulan:</span>
                    <span className="font-mono text-emerald-800 text-sm font-bold">
                      {formatRupiah(calcMonthlyTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewLoanModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer"
                >
                  Setujui & Cairkan Pinjaman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WARNING DIALOG: KONFIRMASI HAPUS PINJAMAN */}
      {loanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-3 bg-rose-100 rounded-full shrink-0">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus Pinjaman</h3>
                  <p className="text-xs text-rose-600 font-semibold">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                Apakah Anda yakin ingin menghapus data pinjaman{' '}
                <strong className="text-slate-900">{loanToDelete.id}</strong> atas nama{' '}
                <strong className="text-slate-900">{loanToDelete.memberName}</strong>?
              </p>

              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span>Plafon Pinjaman:</span>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(loanToDelete.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tenor & Suku Bunga:</span>
                  <span className="font-semibold text-slate-800">{loanToDelete.tenorMonths} Bulan (1,1% flat/bln)</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-semibold uppercase text-slate-800">{loanToDelete.status}</span>
                </div>
              </div>

              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed font-medium">
                ⚠️ <strong>Peringatan:</strong> Menghapus pinjaman ini akan menghapus kartu jadwal amortisasi angsuran dan riwayat cicilan terkait dari sistem.
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setLoanToDelete(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteLoan) {
                      onDeleteLoan(loanToDelete.id);
                    }
                    if (selectedLoanDetail?.id === loanToDelete.id) {
                      setSelectedLoanDetail(null);
                    }
                    setLoanToDelete(null);
                  }}
                  className="px-4 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer"
                >
                  Ya, Hapus Pinjaman
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
