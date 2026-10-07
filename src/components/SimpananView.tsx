import React, { useState, useEffect } from 'react';
import {
  PiggyBank,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  BadgePercent,
  Layers,
  Award,
  ShieldCheck,
  Building2,
  AlertCircle,
  Clock,
  Users,
  Check,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { Member, SavingsTransaction, SavingsType, UserRole, AuthUser, KOPERASI_OFFICIALS } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import { calculateMemberSavings } from '../utils/storage';
import { printHtmlContent } from '../utils/printHelper';
import { ReceiptData } from './ReceiptModal';

interface SimpananViewProps {
  members: Member[];
  savings: SavingsTransaction[];
  onAddSavings: (tx: Omit<SavingsTransaction, 'id'>) => Promise<{ success: boolean; message: string; data?: SavingsTransaction; error?: string }> | void;
  onShowReceipt: (receipt: ReceiptData) => void;
  initialSelectedMemberId?: string;
  activeSubTab?: 'pokok_wajib' | 'berjangka' | 'mutasi';
  setActiveSubTab?: (tab: 'pokok_wajib' | 'berjangka' | 'mutasi') => void;
  isDepositModalOpen: boolean;
  setIsDepositModalOpen: (open: boolean) => void;
  isBerjangkaModalOpen?: boolean;
  setIsBerjangkaModalOpen?: (open: boolean) => void;
  userRole?: UserRole;
  currentUser?: AuthUser | null;
  onCompleteBerjangka?: (txId: string) => void;
  onDeleteSavings?: (txId: string) => void;
  onBatchAddWajib?: (transactions: Omit<SavingsTransaction, 'id'>[]) => Promise<{ success: boolean; message: string; data?: SavingsTransaction[]; error?: string }> | void;
  isLoading?: boolean;
  error?: string | null;
  isFromSupabase?: boolean;
  onRefresh?: () => void;
}

export const SimpananView: React.FC<SimpananViewProps> = ({
  members,
  savings,
  onAddSavings,
  onShowReceipt,
  initialSelectedMemberId,
  activeSubTab,
  setActiveSubTab,
  isDepositModalOpen,
  setIsDepositModalOpen,
  isBerjangkaModalOpen = false,
  setIsBerjangkaModalOpen,
  userRole = 'pengurus',
  currentUser,
  onCompleteBerjangka,
  onDeleteSavings,
  onBatchAddWajib,
  isLoading = false,
  error = null,
  isFromSupabase = false,
  onRefresh,
}) => {
  // Navigation tabs:
  // 1) 'pokok_wajib' (Pilar 1: Ekuitas Pokok & Wajib)
  // 2) 'berjangka' (Pilar 2: Simpanan Berjangka 6% p.a.)
  // 3) 'mutasi' (Buku Mutasi Transaksi)
  const [internalActiveTab, setInternalActiveTab] = useState<'pokok_wajib' | 'berjangka' | 'mutasi'>(
    activeSubTab || 'pokok_wajib'
  );

  useEffect(() => {
    if (activeSubTab) {
      setInternalActiveTab(activeSubTab);
    }
  }, [activeSubTab]);

  const activeTab = activeSubTab || internalActiveTab;
  const setActiveTab = (tab: 'pokok_wajib' | 'berjangka' | 'mutasi') => {
    setInternalActiveTab(tab);
    if (setActiveSubTab) {
      setActiveSubTab(tab);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [berjangkaSearch, setBerjangkaSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'semua' | SavingsType>('semua');
  const [directionFilter, setDirectionFilter] = useState<'semua' | 'setor' | 'tarik'>('semua');

  // Filter for Berjangka status
  const [berjangkaStatusFilter, setBerjangkaStatusFilter] = useState<'semua' | 'aktif' | 'selesai'>('semua');

  // Collective Wajib Modal (Potong Gaji)
  const [isCollectiveWajibModalOpen, setIsCollectiveWajibModalOpen] = useState(false);
  const [selectedMemberIdsForWajib, setSelectedMemberIdsForWajib] = useState<string[]>([]);
  const [collectiveAmountPerPerson, setCollectiveAmountPerPerson] = useState(50000);
  const [collectiveMonth, setCollectiveMonth] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString('id-ID', { month: 'long' })} ${d.getFullYear()}`;
  });
  const [collectiveSearchQuery, setCollectiveSearchQuery] = useState('');

  // Dedicated Berjangka Modal local state fallback if not controlled by parent
  const [localBerjangkaModal, setLocalBerjangkaModal] = useState(false);
  const showBerjangkaModal = isBerjangkaModalOpen || localBerjangkaModal;
  const setBerjangkaModalState = (val: boolean) => {
    setLocalBerjangkaModal(val);
    if (setIsBerjangkaModalOpen) setIsBerjangkaModalOpen(val);
  };

  // Submit guard states for single source of truth Supabase write
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Withdraw Modal State (Pencairan Berjangka)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Certificate / Bilyet Detail Modal
  const [selectedBilyet, setSelectedBilyet] = useState<SavingsTransaction | null>(null);

  // Warning Confirmation Dialog for Delete Berjangka
  const [bilyetToDelete, setBilyetToDelete] = useState<SavingsTransaction | null>(null);
  const [bilyetToComplete, setBilyetToComplete] = useState<SavingsTransaction | null>(null);

  // Today ISO Date YYYY-MM-DD
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Form State: Setor Pokok / Wajib
  const [regularDepositForm, setRegularDepositForm] = useState({
    memberId: initialSelectedMemberId || members[0]?.id || '',
    type: 'wajib' as 'pokok' | 'wajib',
    amount: 50000,
    date: todayDateStr,
    notes: 'Setoran simpanan wajib bulanan',
    adminName: 'Bendahara KSP BJS',
  });

  // Form State: Simpanan Berjangka 6% p.a.
  const [berjangkaForm, setBerjangkaForm] = useState({
    memberId: initialSelectedMemberId || members[0]?.id || '',
    amount: 5000000,
    date: todayDateStr,
    notes: 'Penempatan simpanan berjangka bunga 6% per tahun',
    adminName: 'Bendahara KSP BJS',
  });

  // Form State: Tarik Simpanan Berjangka
  const [withdrawForm, setWithdrawForm] = useState({
    memberId: initialSelectedMemberId || members[0]?.id || '',
    amount: 5000000,
    date: todayDateStr,
    notes: 'Pencairan simpanan berjangka jatuh tempo',
    adminName: 'Bendahara KSP BJS',
  });

  // Role-based scoping for Anggota vs Pengurus
  const isAnggota = userRole === 'anggota' || currentUser?.role === 'anggota';
  const activeMemberId = (currentUser?.memberId || (isAnggota ? currentUser?.username : undefined))?.trim().toLowerCase();
  const effectiveSavings = isAnggota && activeMemberId
    ? savings.filter((s) => s.memberId?.trim().toLowerCase() === activeMemberId)
    : savings;

  const effectiveMembers = isAnggota && activeMemberId
    ? members.filter((m) => m.id?.trim().toLowerCase() === activeMemberId)
    : members;

  // Calculate totals
  let totalPokok = 0;
  let totalWajib = 0;
  let totalBerjangka = 0;

  effectiveSavings.forEach((s) => {
    const sign = s.txType === 'tarik' || (s.txType as string) === 'penarikan' ? -1 : 1;
    if (s.type === 'pokok') totalPokok += sign * s.amount;
    else if (s.type === 'wajib') totalWajib += sign * s.amount;
    else if (s.type === 'berjangka') {
      if (s.statusBerjangka !== 'selesai') {
        totalBerjangka += sign * s.amount;
      }
    }
  });

  totalPokok = Math.max(0, totalPokok);
  totalWajib = Math.max(0, totalWajib);
  totalBerjangka = Math.max(0, totalBerjangka);
  const totalAll = totalPokok + totalWajib + totalBerjangka;

  // Filtered savings mutasi
  const filteredSavings = effectiveSavings
    .filter((s) => {
      const matchSearch =
        s.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = typeFilter === 'semua' || s.type === typeFilter;
      const matchDir = directionFilter === 'semua' || s.txType === directionFilter;
      return matchSearch && matchType && matchDir;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Simpanan Berjangka list with relational status & member filtering
  const berjangkaList = effectiveSavings
    .filter((s) => (s.type === 'berjangka' || s.id?.includes('BJK') || s.statusBerjangka) && s.txType !== 'tarik')
    .filter((s) => {
      if (berjangkaStatusFilter === 'aktif') return s.statusBerjangka !== 'selesai';
      if (berjangkaStatusFilter === 'selesai') return s.statusBerjangka === 'selesai';
      return true;
    })
    .filter((s) => {
      if (!berjangkaSearch.trim()) return true;
      const q = berjangkaSearch.toLowerCase();
      return (
        s.memberName.toLowerCase().includes(q) ||
        s.memberId.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    });

  // Open Collective Wajib Modal with all Active members pre-selected
  const handleOpenCollectiveWajib = () => {
    const activeMemberIds = members.filter((m) => m.status === 'aktif').map((m) => m.id);
    setSelectedMemberIdsForWajib(activeMemberIds);
    setIsCollectiveWajibModalOpen(true);
  };

  const handleSelectActiveOnly = () => {
    const activeMemberIds = members.filter((m) => m.status === 'aktif').map((m) => m.id);
    setSelectedMemberIdsForWajib(activeMemberIds);
  };

  const handleSelectAll = () => {
    setSelectedMemberIdsForWajib(members.map((m) => m.id));
  };

  const handleDeselectAll = () => {
    setSelectedMemberIdsForWajib([]);
  };

  const handleToggleMemberCheck = (memberId: string) => {
    setSelectedMemberIdsForWajib((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleProcessCollectiveWajib = async () => {
    if (isSubmitting) return;
    if (selectedMemberIdsForWajib.length === 0) return;
    const now = new Date().toISOString().split('T')[0];
    const txs: Omit<SavingsTransaction, 'id'>[] = selectedMemberIdsForWajib.map((mid) => {
      const mem = members.find((m) => m.id === mid);
      return {
        memberId: mid,
        memberName: mem?.name || 'Anggota',
        type: 'wajib',
        txType: 'setor',
        amount: collectiveAmountPerPerson,
        date: now,
        notes: `Simpanan Wajib (Potong Gaji) Periode ${collectiveMonth}`,
        adminName: KOPERASI_OFFICIALS.bendahara,
      };
    });

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (onBatchAddWajib) {
        const res = await onBatchAddWajib(txs);
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          setSubmitError(res.message);
          alert(res.message);
          return;
        }
      } else {
        for (const tx of txs) {
          const res = await onAddSavings(tx);
          if (res && typeof res === 'object' && 'success' in res && !res.success) {
            setSubmitError(res.message);
            alert(res.message);
            return;
          }
        }
      }

      setIsCollectiveWajibModalOpen(false);
      onShowReceipt({
        receiptNo: `KW-WJB-BULK-${Date.now().toString().slice(-6)}`,
        title: `SETORAN KOLEKTIF SIMPANAN WAJIB (${collectiveMonth})`,
        date: now,
        memberId: 'KOLEKTIF',
        memberName: `${selectedMemberIdsForWajib.length} Anggota (Potong Gaji)`,
        amount: selectedMemberIdsForWajib.length * collectiveAmountPerPerson,
        typeText: 'Setoran Simpanan Wajib Kolektif',
        savingsType: 'wajib',
        adminName: KOPERASI_OFFICIALS.bendahara,
        notes: `Potong gaji kolektif simpanan wajib periode ${collectiveMonth} untuk ${selectedMemberIdsForWajib.length} anggota aktif.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat memproses setoran kolektif.';
      setSubmitError(msg);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formal Bilyet Print helper via iframe print helper
  const handlePrintBilyet = (bilyet: SavingsTransaction) => {
    const estBunga = bilyet.accruedInterest || Math.round(bilyet.amount * 0.06);
    const bilyetHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 55px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK ETAP Koperasi</p>
          </div>
        </div>
      </div>

      <div class="document-title" style="color: #7f1d1d;">BILYET SIMPANAN BERJANGKA (6% P.A.)</div>
      <div class="doc-number">No. Bilyet: <strong>${bilyet.id}</strong> &bull; Diterbitkan: ${formatDateIndo(bilyet.date)}</div>

      <div class="content-box" style="border: 2px solid #7f1d1d; background: #fffdf9;">
        <p style="font-size: 12px; font-style: italic; color: #475569; margin: 0 0 12px 0; text-align: center;">
          Sertifikat bilyet ini diterbitkan sebagai bukti otentik penempatan dana simpanan berjangka anggota Koperasi Brama Jaya Sejahtera dengan ketentuan sebagai berikut:
        </p>

        <table>
          <tr>
            <td class="label">Nama Pemilik Bilyet</td>
            <td class="colon">:</td>
            <td class="value">${bilyet.memberName}</td>
          </tr>
          <tr>
            <td class="label">Nomor Register Anggota</td>
            <td class="colon">:</td>
            <td class="value" style="font-family: monospace; font-weight: bold; color: #1e3a8a;">${bilyet.memberId}</td>
          </tr>
          <tr>
            <td class="label">Nominal Pokok Penempatan</td>
            <td class="colon">:</td>
            <td class="value" style="font-size: 16px; font-weight: 900; font-family: monospace; color: #047857;">${formatRupiah(bilyet.amount)}</td>
          </tr>
          <tr>
            <td class="label">Suku Bunga Imbal Jasa</td>
            <td class="colon">:</td>
            <td class="value" style="color: #991b1b; font-weight: bold;">6,00% per Tahun (Flat p.a.)</td>
          </tr>
          <tr>
            <td class="label">Jangka Waktu (Tenor)</td>
            <td class="colon">:</td>
            <td class="value">12 Bulan (1 Tahun Masa Penempatan)</td>
          </tr>
          <tr>
            <td class="label">Tanggal Penempatan</td>
            <td class="colon">:</td>
            <td class="value">${formatDateIndo(bilyet.date)}</td>
          </tr>
          <tr>
            <td class="label">Tanggal Jatuh Tempo</td>
            <td class="colon">:</td>
            <td class="value" style="color: #991b1b; font-weight: bold;">${formatDateIndo(bilyet.maturityDate || bilyet.date)}</td>
          </tr>
          <tr>
            <td class="label">Estimasi Imbal Hasil (Bunga RAT)</td>
            <td class="colon">:</td>
            <td class="value" style="font-family: monospace; font-weight: bold; color: #047857;">${formatRupiah(estBunga)}</td>
          </tr>
        </table>
      </div>

      <div class="signatures" style="margin-top: 25px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
        <div class="signature-col">
          <p class="signature-role" style="margin: 0; font-size: 11px;">Pemilik Bilyet (Anggota),</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${bilyet.memberName}</span>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">No: ${bilyet.memberId}</div>
        </div>

        <div class="signature-col">
          <p class="signature-role" style="margin: 0; font-size: 11px;">Manajer Simpan Pinjam,</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${KOPERASI_OFFICIALS.manajerSimpanPinjam}</span>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Unit Simpan Pinjam</div>
        </div>

        <div class="signature-col">
          <p class="signature-role" style="margin: 0; font-size: 11px;">Bendahara,</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${KOPERASI_OFFICIALS.bendahara}</span>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Pengurus Keuangan</div>
        </div>

        <div class="signature-col">
          <p class="signature-role" style="margin: 0; font-size: 11px;">Ketua Koperasi,</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${KOPERASI_OFFICIALS.ketua}</span>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Ketua Pengurus</div>
        </div>
      </div>

      <div class="footer-note" style="margin-top: 20px;">
        Bilyet ini sah sebagai bukti penyertaan modal simpanan berjangka pada KSP Brama Jaya Sejahtera. Bunga imbal jasa 6% per tahun dibayarkan saat Rapat Anggota Tahunan (RAT).
      </div>
    `;

    printHtmlContent(bilyetHtml, `Bilyet-Berjangka-${bilyet.id}`);
  };

  // Submit Handler: Regular Deposit (Pokok / Wajib)
  const handleRegularDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const targetMemberId = regularDepositForm.memberId || members[0]?.id;
    const mem = members.find((m) => m.id === targetMemberId);
    if (!mem) {
      alert('Pilih anggota koperasi yang valid.');
      return;
    }
    const numAmount = Number(regularDepositForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Masukkan nominal simpanan yang valid (> Rp 0).');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await onAddSavings({
        memberId: mem.id,
        memberName: mem.name,
        type: regularDepositForm.type,
        txType: 'setor',
        amount: numAmount,
        date: regularDepositForm.date,
        adminName: regularDepositForm.adminName,
        notes: regularDepositForm.notes || `Setoran Simpanan ${regularDepositForm.type.toUpperCase()}`,
      });

      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        setSubmitError(res.message);
        alert(res.message);
        return;
      }

      setIsDepositModalOpen(false);

      // Show Receipt
      onShowReceipt({
        receiptNo: `KW-${regularDepositForm.type.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`,
        title: `BUKTI SETORAN SIMPANAN ${regularDepositForm.type.toUpperCase()}`,
        date: regularDepositForm.date,
        memberId: mem.id,
        memberName: mem.name,
        amount: numAmount,
        typeText: `Simpanan ${regularDepositForm.type === 'pokok' ? 'Pokok' : 'Wajib'} Koperasi`,
        notes: regularDepositForm.notes,
        officerName: regularDepositForm.adminName,
        breakdown: [
          { label: 'Jenis Simpanan', value: `Simpanan ${regularDepositForm.type.toUpperCase()}` },
          { label: 'Nomor Register', value: mem.id },
          { label: 'Nama Anggota', value: mem.name },
          { label: 'Tanggal Transaksi', value: formatDateIndo(regularDepositForm.date) },
        ],
      });
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat memproses transaksi simpanan.';
      setSubmitError(msg);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler: Simpanan Berjangka 6%
  const handleBerjangkaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const targetMemberId = berjangkaForm.memberId || members[0]?.id;
    const mem = members.find((m) => m.id === targetMemberId);
    if (!mem) {
      alert('Pilih anggota yang valid.');
      return;
    }
    const numAmount = Number(berjangkaForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Nominal simpanan berjangka harus lebih besar dari Rp 0.');
      return;
    }

    // Hitung tanggal jatuh tempo: 1 tahun dari tanggal penempatan
    const parts = (berjangkaForm.date || todayDateStr).split('-');
    const year = Number(parts[0]) || new Date().getFullYear();
    const month = parts[1] || '01';
    const day = parts[2] || '01';
    const maturityDateStr = `${year + 1}-${month}-${day}`;

    const annualRate = 6.0;
    const accruedInterest = Math.round(numAmount * 0.06);

    const newTx: Omit<SavingsTransaction, 'id'> = {
      memberId: mem.id,
      memberName: mem.name,
      type: 'berjangka',
      txType: 'setor',
      amount: numAmount,
      date: berjangkaForm.date,
      adminName: berjangkaForm.adminName,
      termMonths: 12,
      annualInterestRate: annualRate,
      maturityDate: maturityDateStr,
      accruedInterest: accruedInterest,
      interestPaymentSchedule: 'Dibayarkan saat RAT tahunan',
      notes: berjangkaForm.notes || 'Simpanan Berjangka 12 Bulan (Bunga 6% per tahun dibayar saat RAT)',
    };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await onAddSavings(newTx);
      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        setSubmitError(res.message);
        alert(res.message);
        return;
      }

      setBerjangkaModalState(false);

      // Prompt Official Receipt
      onShowReceipt({
        receiptNo: `BILYET-BJS-${Date.now().toString().slice(-6)}`,
        title: 'BUKTI PENEMPATAN SIMPANAN BERJANGKA (BILYET)',
        date: berjangkaForm.date,
        memberId: mem.id,
        memberName: mem.name,
        amount: numAmount,
        typeText: 'Simpanan Berjangka (Bunga 6,0% per Tahun, Tenor 12 Bulan)',
        notes: `Jatuh tempo: ${formatDateIndo(maturityDateStr)}. Estimasi bunga ${formatRupiah(accruedInterest)} dibayarkan saat RAT.`,
        officerName: berjangkaForm.adminName,
        breakdown: [
          { label: 'Nomor Register', value: mem.id },
          { label: 'Nama Anggota', value: mem.name },
          { label: 'Nominal Pokok', value: formatRupiah(numAmount) },
          { label: 'Suku Bunga', value: '6,0% per Tahun' },
          { label: 'Jangka Waktu', value: '1 Tahun (12 Bulan)' },
          { label: 'Jatuh Tempo', value: formatDateIndo(maturityDateStr) },
          { label: 'Estimasi Bunga RAT', value: formatRupiah(accruedInterest) },
        ],
      });
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat menyimpan simpanan berjangka.';
      setSubmitError(msg);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler: Pencairan Simpanan Berjangka
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const targetMemberId = withdrawForm.memberId || members[0]?.id;
    const mem = members.find((m) => m.id === targetMemberId);
    if (!mem) return;

    const numAmount = Number(withdrawForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Nominal penarikan harus lebih besar dari Rp 0.');
      return;
    }

    const memSavings = calculateMemberSavings(mem.id, savings);
    if (numAmount > memSavings.berjangka) {
      alert(`Saldo Simpanan Berjangka anggota ini adalah ${formatRupiah(memSavings.berjangka)}. Penarikan tidak boleh melebihi saldo.`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await onAddSavings({
        memberId: mem.id,
        memberName: mem.name,
        type: 'berjangka',
        txType: 'tarik',
        amount: numAmount,
        date: withdrawForm.date,
        adminName: withdrawForm.adminName,
        notes: withdrawForm.notes || 'Pencairan Simpanan Berjangka',
      });

      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        setSubmitError(res.message);
        alert(res.message);
        return;
      }

      setIsWithdrawModalOpen(false);

      onShowReceipt({
        receiptNo: `KW-CAIR-${Date.now().toString().slice(-6)}`,
        title: 'BUKTI PENCAIRAN SIMPANAN BERJANGKA',
        date: withdrawForm.date,
        memberId: mem.id,
        memberName: mem.name,
        amount: numAmount,
        typeText: 'Pencairan Simpanan Berjangka',
        notes: withdrawForm.notes || 'Pencairan simpanan berjangka anggota',
        officerName: withdrawForm.adminName,
        breakdown: [
          { label: 'Nomor Register', value: mem.id },
          { label: 'Nama Anggota', value: mem.name },
          { label: 'Nominal Dicairkan', value: formatRupiah(numAmount) },
          { label: 'Tanggal Pencairan', value: formatDateIndo(withdrawForm.date) },
        ],
      });
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat memproses pencairan simpanan berjangka.';
      setSubmitError(msg);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi Status Data & Loading */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-[11px] font-bold bg-amber-200 hover:bg-amber-300 rounded-lg text-amber-950 transition cursor-pointer"
            >
              Muat Ulang
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5 shadow-2xs animate-pulse">
          <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Mengambil data transaksi simpanan dari database Supabase PostgreSQL...</span>
        </div>
      )}

      {/* Top Card: 2 Pilar Simpanan Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Terhimpun */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Simpanan Koperasi
              </span>
              {isFromSupabase ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  Supabase ({savings.length} Tx)
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                  Cadangan Lokal ({savings.length} Tx)
                </span>
              )}
            </div>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono text-blue-950">
              {formatRupiah(totalAll)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Akumulasi dari 2 pilar simpanan anggota
          </p>
        </div>

        {/* Pilar 1: Simpanan Pokok & Wajib */}
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-xs bg-gradient-to-br from-white via-blue-50/20 to-blue-50/40">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 uppercase">
                Pilar 1: Ekuitas
              </span>
              <h3 className="text-xs font-bold text-slate-700 mt-1">
                Simpanan Pokok & Wajib
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-900">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-blue-900">
              {formatRupiah(totalPokok + totalWajib)}
            </span>
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
            <span>Pokok: {formatRupiah(totalPokok)}</span>
            <span>•</span>
            <span>Wajib: {formatRupiah(totalWajib)}</span>
          </div>
        </div>

        {/* Pilar 2: Simpanan Berjangka 6% */}
        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-xs bg-gradient-to-br from-white via-red-50/20 to-rose-50/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 uppercase">
                Pilar 2: Investasi
              </span>
              <h3 className="text-xs font-bold text-slate-700 mt-1">
                Simpanan Berjangka (6% p.a.)
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-red-100 text-red-900">
              <BadgePercent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-red-950">
              {formatRupiah(totalBerjangka)}
            </span>
          </div>
          <p className="text-[11px] text-red-800 mt-1">
            Tenor 1 tahun • Bunga dibayar saat RAT
          </p>
        </div>
      </div>

      {/* Role Notice for Anggota */}
      {userRole === 'anggota' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Mode Anggota (Hanya Lihat)</strong> — Anda dapat meninjau saldo simpanan dan bilyet berjangka. Untuk transaksi setoran atau pencairan baru, silakan hubungi Pengurus Koperasi.
            </span>
          </div>
        </div>
      )}

      {/* Tab Navigation & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('pokok_wajib')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'pokok_wajib'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Simpanan Pokok & Wajib
          </button>
          <button
            onClick={() => setActiveTab('berjangka')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'berjangka'
                ? 'bg-red-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BadgePercent className="w-3.5 h-3.5" />
            <span>2. Simpanan Berjangka 6%</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 font-bold">
              {berjangkaList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('mutasi')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'mutasi'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buku Mutasi Transaksi
          </button>
        </div>

        {/* Action Buttons (Only visible for Pengurus) */}
        {userRole === 'pengurus' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRegularDepositForm((prev) => ({
                  ...prev,
                  memberId: initialSelectedMemberId || members[0]?.id || '',
                  date: todayDateStr,
                }));
                setIsDepositModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Setor Pokok / Wajib</span>
            </button>

            <button
              onClick={() => {
                setBerjangkaForm((prev) => ({
                  ...prev,
                  memberId: initialSelectedMemberId || members[0]?.id || '',
                  date: todayDateStr,
                }));
                setBerjangkaModalState(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-700 to-rose-900 hover:from-red-600 hover:to-rose-800 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <BadgePercent className="w-4 h-4 text-red-200" />
              <span>+ Buka Simpanan Berjangka</span>
            </button>

            {totalBerjangka > 0 && (
              <button
                onClick={() => {
                  setWithdrawForm((prev) => ({
                    ...prev,
                    memberId: initialSelectedMemberId || members[0]?.id || '',
                    date: todayDateStr,
                  }));
                  setIsWithdrawModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
                <span>Pencairan Berjangka</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: PILAR 1 - SIMPANAN POKOK & WAJIB */}
      {activeTab === 'pokok_wajib' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Rekapitulasi Simpanan Pokok & Wajib Anggota
              </h3>
              <p className="text-xs text-slate-500">
                Simpanan Pokok Rp 200.000 (awal) & Simpanan Wajib Rp 50.000 per bulan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari anggota / register..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              {userRole === 'pengurus' && (
                <button
                  onClick={handleOpenCollectiveWajib}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs transition cursor-pointer shrink-0"
                  title="Potong Gaji Kolektif untuk semua anggota aktif"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>+ Potong Gaji Kolektif</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Register</th>
                  <th className="py-2.5 px-4">Nama Anggota</th>
                  <th className="py-2.5 px-4">Tahun Masuk</th>
                  <th className="py-2.5 px-4 text-right">Simpanan Pokok</th>
                  <th className="py-2.5 px-4 text-right">Simpanan Wajib</th>
                  <th className="py-2.5 px-4 text-right">Total Ekuitas</th>
                  {userRole === 'pengurus' && (
                    <th className="py-2.5 px-4 text-center">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {effectiveMembers
                  .filter((m) => {
                    const q = searchQuery.toLowerCase();
                    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
                  })
                  .map((m) => {
                    const memSavings = calculateMemberSavings(m.id, savings);
                    const totalEkuitas = memSavings.pokok + memSavings.wajib;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                          {m.id}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {m.name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {m.joinYear ?? '2023'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                          {formatRupiah(memSavings.pokok)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                          {formatRupiah(memSavings.wajib)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-black text-blue-950">
                          {formatRupiah(totalEkuitas)}
                        </td>
                        {userRole === 'pengurus' && (
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setRegularDepositForm((prev) => ({
                                  ...prev,
                                  memberId: m.id,
                                  type: 'wajib',
                                  amount: 50000,
                                  date: todayDateStr,
                                }));
                                setIsDepositModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-900 hover:bg-blue-100 transition cursor-pointer"
                            >
                              + Setor Wajib
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PILAR 2 - SIMPANAN BERJANGKA (6% p.a.) */}
      {activeTab === 'berjangka' && (
        <div className="space-y-4">
          {/* Information Card */}
          <div className="bg-gradient-to-r from-red-950 via-red-900 to-rose-950 text-white rounded-2xl p-5 shadow-sm border border-red-800/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white text-red-950">
                    Bunga 6% per Tahun (Flat)
                  </span>
                  <span className="text-xs text-rose-200">Tenor 1 Tahun (12 Bulan)</span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  Portofolio Simpanan Berjangka BJS Digital
                </h3>
                <p className="text-xs text-rose-100 mt-0.5">
                  Bunga 6% per tahun dibayarkan saat Rapat Anggota Tahunan (RAT). Dana dapat dicairkan setelah genap 1 tahun masa penempatan.
                </p>
              </div>

              {userRole === 'pengurus' && (
                <button
                  onClick={() => {
                    setBerjangkaForm((prev) => ({
                      ...prev,
                      memberId: initialSelectedMemberId || members[0]?.id || '',
                      date: todayDateStr,
                    }));
                    setBerjangkaModalState(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white text-red-950 hover:bg-rose-50 font-black text-xs shadow-md transition cursor-pointer shrink-0 border border-white/80 flex items-center gap-2"
                >
                  <BadgePercent className="w-4 h-4 text-red-700" />
                  <span>+ Buka Bilyet Berjangka Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Table of Active Berjangka Bilyets */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">
                  Daftar Bilyet Simpanan Berjangka ({berjangkaList.length} Bilyet)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Penyertaan modal anggota bunga 6% per tahun (tenor 12 bulan)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={berjangkaSearch}
                    onChange={(e) => setBerjangkaSearch(e.target.value)}
                    placeholder="Cari bilyet / nama / BJS-XXX..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-900/20 focus:border-red-900"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-[11px]">Status:</span>
                  <button
                    onClick={() => setBerjangkaStatusFilter('semua')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      berjangkaStatusFilter === 'semua' ? 'bg-red-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setBerjangkaStatusFilter('aktif')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      berjangkaStatusFilter === 'aktif' ? 'bg-red-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Aktif
                  </button>
                  <button
                    onClick={() => setBerjangkaStatusFilter('selesai')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      berjangkaStatusFilter === 'selesai' ? 'bg-red-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>

            {berjangkaList.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <PiggyBank className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-600 text-sm">Belum ada penempatan simpanan berjangka</p>
                <p className="text-xs text-slate-400 mt-1">
                  {userRole === 'pengurus'
                    ? 'Klik tombol "+ Buka Bilyet Berjangka Baru" di atas untuk menambahkan penempatan dana baru.'
                    : 'Belum ada data penempatan simpanan berjangka.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">No. Bilyet</th>
                      <th className="py-2.5 px-4">Nama Anggota</th>
                      <th className="py-2.5 px-4">Tgl Penempatan</th>
                      <th className="py-2.5 px-4">Jatuh Tempo</th>
                      <th className="py-2.5 px-4 text-right">Nominal Pokok</th>
                      <th className="py-2.5 px-4 text-center">Bunga / Thn</th>
                      <th className="py-2.5 px-4 text-right">Estimasi Bunga RAT</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {berjangkaList.map((tx) => {
                      const estBunga = tx.accruedInterest || Math.round(tx.amount * 0.06);
                      const isFinished = tx.statusBerjangka === 'selesai';
                      return (
                        <tr key={tx.id} className={`hover:bg-slate-50 transition ${isFinished ? 'opacity-70 bg-slate-50/50' : ''}`}>
                          <td className="py-3 px-4 font-mono font-bold text-red-900">
                            {tx.id}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{tx.memberName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{tx.memberId}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {formatDateIndo(tx.date)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                              <Clock className="w-3 h-3 text-red-600" />
                              {formatDateIndo(tx.maturityDate || tx.date)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                            {formatRupiah(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded text-[10px]">
                              6.0% p.a.
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {formatRupiah(estBunga)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isFinished ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                <Check className="w-3 h-3 text-slate-600" />
                                SELESAI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                AKTIF
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handlePrintBilyet(tx)}
                                className="px-2 py-1 text-[11px] font-bold rounded-lg bg-red-50 text-red-800 hover:bg-red-100 transition cursor-pointer flex items-center gap-1"
                                title="Cetak Bilyet Resmi (PDF/Print)"
                              >
                                <Printer className="w-3 h-3 text-red-700" />
                                <span>Cetak</span>
                              </button>

                              {userRole === 'pengurus' && !isFinished && (
                                <button
                                  type="button"
                                  onClick={() => setBilyetToComplete(tx)}
                                  className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                                  title="Selesaikan & Cairkan Bilyet"
                                >
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Selesaikan</span>
                                </button>
                              )}

                              {userRole === 'pengurus' && (
                                <button
                                  type="button"
                                  onClick={() => setBilyetToDelete(tx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                  title="Hapus Transaksi Bilyet"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BUKU MUTASI TRANSAKSI */}
      {activeTab === 'mutasi' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Buku Mutasi Transaksi Simpanan
              </h3>
              <p className="text-xs text-slate-500">
                Catatan riwayat transaksi setoran dan penarikan simpanan
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari transaksi..."
                  className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="py-1 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="semua">Semua Jenis Simpanan</option>
                <option value="pokok">Simpanan Pokok</option>
                <option value="wajib">Simpanan Wajib</option>
                <option value="berjangka">Simpanan Berjangka (6%)</option>
              </select>

              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as any)}
                className="py-1 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="semua">Semua Transaksi</option>
                <option value="setor">Setoran (Masuk)</option>
                <option value="tarik">Penarikan (Keluar)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">No. Transaksi</th>
                  <th className="py-2.5 px-4">Tanggal</th>
                  <th className="py-2.5 px-4">Anggota</th>
                  <th className="py-2.5 px-4">Jenis</th>
                  <th className="py-2.5 px-4">Arah</th>
                  <th className="py-2.5 px-4 text-right">Nominal</th>
                  <th className="py-2.5 px-4">Keterangan</th>
                  <th className="py-2.5 px-4 text-center">Kwitansi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSavings.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                      {s.id}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {formatDateIndo(s.date)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{s.memberName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.memberId}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.type === 'berjangka'
                            ? 'bg-red-100 text-red-900 border border-red-200'
                            : s.type === 'pokok'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}
                      >
                        {s.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          s.txType === 'setor' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {s.txType === 'setor' ? (
                          <>
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Setor</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Tarik</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                      {s.txType === 'setor' ? '+' : '-'} {formatRupiah(s.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">
                      {s.notes || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => {
                          onShowReceipt({
                            receiptNo: `KW-${s.id}`,
                            title: `BUKTI TRANSAKSI SIMPANAN ${s.type.toUpperCase()}`,
                            date: s.date,
                            memberId: s.memberId,
                            memberName: s.memberName,
                            amount: s.amount,
                            typeText: `Simpanan ${s.type.toUpperCase()} (${s.txType.toUpperCase()})`,
                            notes: s.notes,
                            officerName: s.adminName,
                            breakdown: [
                              { label: 'ID Transaksi', value: s.id },
                              { label: 'Jenis Simpanan', value: s.type.toUpperCase() },
                              { label: 'Tipe Transaksi', value: s.txType.toUpperCase() },
                              { label: 'Nominal', value: formatRupiah(s.amount) },
                            ],
                          });
                        }}
                        className="p-1 text-slate-500 hover:text-blue-900 transition"
                        title="Cetak Kwitansi"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: SETOR SIMPANAN POKOK / WAJIB                        */}
      {/* ============================================================ */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-950 to-indigo-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-sm">Setor Simpanan Pokok / Wajib</h3>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegularDepositSubmit} className="p-6 space-y-4">
              {/* Pilih Anggota */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Anggota Koperasi
                </label>
                <select
                  required
                  value={regularDepositForm.memberId}
                  onChange={(e) =>
                    setRegularDepositForm({ ...regularDepositForm, memberId: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.name} ({m.status === 'aktif' ? 'Aktif' : 'Pasif'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Simpanan: Pokok vs Wajib */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilihan Simpanan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRegularDepositForm({
                        ...regularDepositForm,
                        type: 'wajib',
                        amount: 50000,
                        notes: 'Setoran simpanan wajib bulanan',
                      })
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      regularDepositForm.type === 'wajib'
                        ? 'border-blue-900 bg-blue-50/50 ring-2 ring-blue-900/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold text-xs text-blue-950">Simpanan Wajib</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">Rp 50.000 / bulan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRegularDepositForm({
                        ...regularDepositForm,
                        type: 'pokok',
                        amount: 200000,
                        notes: 'Setoran simpanan pokok awal anggota',
                      })
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      regularDepositForm.type === 'pokok'
                        ? 'border-blue-900 bg-blue-50/50 ring-2 ring-blue-900/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold text-xs text-blue-950">Simpanan Pokok</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">Rp 200.000 (awal)</span>
                  </button>
                </div>
              </div>

              {/* Nominal Setoran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Setoran (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={10000}
                  step={10000}
                  value={regularDepositForm.amount}
                  onChange={(e) =>
                    setRegularDepositForm({
                      ...regularDepositForm,
                      amount: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
                {regularDepositForm.type === 'wajib' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[50000, 100000, 150000, 300000, 600000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() =>
                          setRegularDepositForm({
                            ...regularDepositForm,
                            amount: amt,
                            notes: `Setoran simpanan wajib ${amt / 50000} bulan`,
                          })
                        }
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-900 text-slate-700 font-semibold transition"
                      >
                        {amt / 50000} Bln ({formatRupiah(amt)})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tanggal & Keterangan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={regularDepositForm.date}
                    onChange={(e) =>
                      setRegularDepositForm({ ...regularDepositForm, date: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Petugas Kasir
                  </label>
                  <input
                    type="text"
                    value={regularDepositForm.adminName}
                    onChange={(e) =>
                      setRegularDepositForm({ ...regularDepositForm, adminName: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={regularDepositForm.notes}
                  onChange={(e) =>
                    setRegularDepositForm({ ...regularDepositForm, notes: e.target.value })
                  }
                  placeholder="Keterangan setoran..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan ke Server...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Proses Setoran & Cetak Kwitansi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: DEDICATED PEMBUKAAN SIMPANAN BERJANGKA (6% p.a.)   */}
      {/* ============================================================ */}
      {showBerjangkaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-red-900 bg-gradient-to-r from-red-950 via-red-900 to-rose-950 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-rose-300" />
                <div>
                  <h3 className="font-bold text-sm">Buka Simpanan Berjangka Baru</h3>
                  <span className="text-[11px] text-rose-200">Suku Bunga 6,0% per Tahun (Tenor 1 Tahun)</span>
                </div>
              </div>
              <button
                onClick={() => setBerjangkaModalState(false)}
                className="rounded-lg p-1.5 text-rose-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBerjangkaSubmit} className="p-6 space-y-4">
              {/* Pilih Anggota */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Anggota Pemilik Bilyet
                </label>
                <select
                  required
                  value={berjangkaForm.memberId}
                  onChange={(e) =>
                    setBerjangkaForm({ ...berjangkaForm, memberId: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-900/20 focus:border-red-900"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nominal Penempatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Penempatan Dana (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1000000}
                  step={500000}
                  value={berjangkaForm.amount}
                  onChange={(e) =>
                    setBerjangkaForm({
                      ...berjangkaForm,
                      amount: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-900/20 focus:border-red-900"
                />

                {/* Quick chip buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[2500000, 5000000, 10000000, 25000000, 50000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBerjangkaForm({ ...berjangkaForm, amount: amt })}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-red-50 hover:bg-red-100 text-red-900 font-bold transition"
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ketentuan Berjangka Live Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Suku Bunga Tetap:</span>
                  <span className="font-bold text-red-950 font-mono">6,0% per Tahun</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Jangka Waktu (Tenor):</span>
                  <span className="font-bold text-slate-900">12 Bulan (1 Tahun)</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Pembayaran Bunga:</span>
                  <span className="font-bold text-slate-900">Saat RAT Tahunan Koperasi</span>
                </div>
                <div className="pt-2 border-t border-red-200/60 flex justify-between items-center text-slate-900 font-bold">
                  <span>Estimasi Bunga saat RAT:</span>
                  <span className="text-base font-black font-mono text-emerald-700">
                    {formatRupiah(Math.round(berjangkaForm.amount * 0.06))}
                  </span>
                </div>
              </div>

              {/* Tanggal Penempatan & Tanggal Jatuh Tempo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Penempatan
                  </label>
                  <input
                    type="date"
                    required
                    value={berjangkaForm.date}
                    onChange={(e) =>
                      setBerjangkaForm({ ...berjangkaForm, date: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-900/20 focus:border-red-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Jatuh Tempo (1 Thn)
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                    {(() => {
                      const p = (berjangkaForm.date || todayDateStr).split('-');
                      const y = Number(p[0]) || 2026;
                      return formatDateIndo(`${y + 1}-${p[1] || '01'}-${p[2] || '01'}`);
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Petugas Penerima
                </label>
                <input
                  type="text"
                  value={berjangkaForm.adminName}
                  onChange={(e) =>
                    setBerjangkaForm({ ...berjangkaForm, adminName: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-900/20 focus:border-red-900"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBerjangkaModalState(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-rose-900 hover:from-red-600 hover:to-rose-800 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan ke Server...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Simpan & Terbitkan Bilyet Berjangka</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: PENCAIRAN SIMPANAN BERJANGKA                       */}
      {/* ============================================================ */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-800 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Pencairan Simpanan Berjangka</h3>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Anggota Pemilik Simpanan
                </label>
                <select
                  required
                  value={withdrawForm.memberId}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, memberId: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                >
                  {members.map((m) => {
                    const s = calculateMemberSavings(m.id, savings);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.id} - {m.name} (Saldo Berjangka: {formatRupiah(s.berjangka)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal yang Dicairkan (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={100000}
                  step={100000}
                  value={withdrawForm.amount}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, amount: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Pencairan
                </label>
                <input
                  type="date"
                  required
                  value={withdrawForm.date}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, date: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={withdrawForm.notes}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, notes: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Proses Pencairan & Cetak Bukti</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: SERTIFIKAT BILYET SIMPANAN BERJANGKA (PRINTABLE)    */}
      {/* ============================================================ */}
      {selectedBilyet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Award className="w-5 h-5 text-red-700" />
                <span>Bilyet Simpanan Berjangka 6% (Pratinjau)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintBilyet(selectedBilyet)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Dokumen Resmi (PDF)</span>
                </button>
                <button
                  onClick={() => setSelectedBilyet(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Certificate Paper */}
            <div className="p-8 bg-amber-50/10 text-slate-900 border-8 border-double border-red-950/20 m-3 rounded-xl">
              <div className="text-center border-b-2 border-red-950/30 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-800">
                  KOPERASI BRAMA JAYA SEJAHTERA
                </span>
                <h2 className="text-xl font-black tracking-tight text-slate-900 mt-1 uppercase">
                  BILYET SIMPANAN BERJANGKA
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Nomor Bilyet: {selectedBilyet.id}
                </p>
              </div>

              <div className="py-6 space-y-4 text-xs">
                <p className="leading-relaxed text-slate-700 text-center italic">
                  Diterbitkan sebagai bukti penempatan dana simpanan berjangka anggota Koperasi Brama Jaya Sejahtera dengan ketentuan sebagai berikut:
                </p>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Nama Anggota:</span>
                    <span className="font-bold text-slate-900">{selectedBilyet.memberName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Nomor Register:</span>
                    <span className="font-mono font-bold text-blue-900">{selectedBilyet.memberId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Nominal Penempatan:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {formatRupiah(selectedBilyet.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Suku Bunga:</span>
                    <span className="font-bold text-red-800">6,0% per Tahun (Flat)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Jangka Waktu:</span>
                    <span className="font-bold text-slate-900">12 Bulan (1 Tahun)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Tanggal Penempatan:</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateIndo(selectedBilyet.date)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Tanggal Jatuh Tempo:</span>
                    <span className="font-semibold text-red-900">
                      {formatDateIndo(selectedBilyet.maturityDate || selectedBilyet.date)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-900 font-bold">
                    <span>Estimasi Bunga Diterima saat RAT:</span>
                    <span className="font-mono text-emerald-700 text-sm">
                      {formatRupiah(selectedBilyet.accruedInterest || Math.round(selectedBilyet.amount * 0.06))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 pt-6 text-center text-xs text-slate-600 gap-3 border-t border-slate-200 mt-4">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600">Pemilik Bilyet,</p>
                    <div className="h-10"></div>
                    <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-xs">
                      {selectedBilyet.memberName}
                    </p>
                    <p className="text-[10px] text-slate-400">Anggota</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600">Manajer Unit SP,</p>
                    <div className="h-10"></div>
                    <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-xs">
                      {KOPERASI_OFFICIALS.manajerSimpanPinjam}
                    </p>
                    <p className="text-[10px] text-slate-400">Manajer Unit</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600">Bendahara,</p>
                    <div className="h-10"></div>
                    <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-xs">
                      {KOPERASI_OFFICIALS.bendahara}
                    </p>
                    <p className="text-[10px] text-slate-400">Pengurus</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600">Ketua Koperasi,</p>
                    <div className="h-10"></div>
                    <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 text-xs">
                      {KOPERASI_OFFICIALS.ketua}
                    </p>
                    <p className="text-[10px] text-slate-400">Ketua Pengurus</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: POTONG GAJI KOLEKTIF (SIMPANAN WAJIB BULANAN)       */}
      {/* ============================================================ */}
      {isCollectiveWajibModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-blue-950 px-6 py-4 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-300" />
                  <h3 className="font-bold text-sm">Setoran Kolektif Simpanan Wajib (Potong Gaji)</h3>
                </div>
                <p className="text-xs text-blue-200 mt-0.5">
                  Sistem otomatis memilih seluruh anggota berstatus "Aktif". Anda dapat mencentang atau menghapus centang sesuai kebutuhan.
                </p>
              </div>
              <button
                onClick={() => setIsCollectiveWajibModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Periode Potong Gaji</label>
                  <input
                    type="text"
                    value={collectiveMonth}
                    onChange={(e) => setCollectiveMonth(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Besaran per Anggota (Rp)</label>
                  <input
                    type="number"
                    value={collectiveAmountPerPerson}
                    onChange={(e) => setCollectiveAmountPerPerson(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleSelectActiveOnly}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold transition cursor-pointer text-[11px]"
                  >
                    Hanya Anggota Aktif ({members.filter((m) => m.status === 'aktif').length})
                  </button>
                  <button
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition cursor-pointer text-[11px]"
                  >
                    Pilih Semua ({members.length})
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition cursor-pointer text-[11px]"
                  >
                    Kosongkan
                  </button>
                </div>

                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari anggota..."
                    value={collectiveSearchQuery}
                    onChange={(e) => setCollectiveSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto divide-y divide-slate-100">
                {members
                  .filter((m) => {
                    const q = collectiveSearchQuery.toLowerCase();
                    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
                  })
                  .map((m) => {
                    const isChecked = selectedMemberIdsForWajib.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleToggleMemberCheck(m.id)}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                          isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                          />
                          <div>
                            <span className="font-bold text-slate-900">{m.name}</span>
                            <span className="font-mono text-[11px] text-slate-500 ml-2">({m.id})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.status === 'aktif'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.status === 'pasif'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {m.status?.toUpperCase() || 'AKTIF'}
                          </span>
                          <span className="font-mono text-slate-700 font-semibold">
                            {formatRupiah(collectiveAmountPerPerson)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-emerald-900 font-bold block">
                    Total Anggota Terpilih: {selectedMemberIdsForWajib.length} Orang
                  </span>
                  <span className="text-emerald-700 text-[11px]">
                    Potong gaji {formatRupiah(collectiveAmountPerPerson)} / orang
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-emerald-800 block">Total Dana Terhimpun:</span>
                  <span className="font-mono font-black text-emerald-950 text-base">
                    {formatRupiah(selectedMemberIdsForWajib.length * collectiveAmountPerPerson)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setIsCollectiveWajibModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleProcessCollectiveWajib}
                  disabled={isSubmitting || selectedMemberIdsForWajib.length === 0}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan ke Server...</span>
                    </>
                  ) : (
                    <span>Proses Potong Gaji ({selectedMemberIdsForWajib.length} Anggota)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG WARNING: HAPUS BILYET SIMPANAN BERJANGKA */}
      {bilyetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-100">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus Bilyet</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {bilyetToDelete.id}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus data bilyet simpanan berjangka atas nama{' '}
              <strong className="text-slate-900">{bilyetToDelete.memberName}</strong> dengan nominal{' '}
              <strong className="text-rose-700 font-mono">{formatRupiah(bilyetToDelete.amount)}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBilyetToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSavings) onDeleteSavings(bilyetToDelete.id);
                  setBilyetToDelete(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG KONFIRMASI: SELESAIKAN & CAIRKAN BILYET */}
      {bilyetToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-emerald-600 mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-100">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Selesaikan & Cairkan Bilyet</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {bilyetToComplete.id}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Selesaikan penempatan bilyet milik <strong className="text-slate-900">{bilyetToComplete.memberName}</strong>? Pokok sebesar <strong className="text-emerald-700 font-mono">{formatRupiah(bilyetToComplete.amount)}</strong> dan bunga imbal jasa 6% p.a. akan dicatat dalam pembukuan arus kas keluar koperasi.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBilyetToComplete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onCompleteBerjangka) onCompleteBerjangka(bilyetToComplete.id);
                  setBilyetToComplete(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Ya, Selesaikan & Cairkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
