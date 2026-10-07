import React from 'react';
import {
  Wallet,
  PiggyBank,
  HandCoins,
  TrendingUp,
  UserPlus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Clock,
  ChevronRight,
  ReceiptText,
  BadgePercent,
  ShieldCheck,
  Store,
  Flame,
  ShoppingBag,
  ShieldAlert,
  Shirt,
  Layers,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Scale,
} from 'lucide-react';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CooperativeSummary,
  UserRole,
  BusinessUnitReport,
  BusinessUnitTransaction,
  SimpanPinjamCashMutation,
} from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import { calculateBusinessUnitReports, calculateMemberSavings, calculateLoanRemaining } from '../utils/storage';
import { NavTab } from './Sidebar';
import { AuthUser } from '../types';

interface DashboardViewProps {
  summary: CooperativeSummary;
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  unitReports?: BusinessUnitReport[];
  businessTransactions?: BusinessUnitTransaction[];
  spCashMutations?: SimpanPinjamCashMutation[];
  onNavigate: (tab: NavTab) => void;
  onNavigateToKasSP?: () => void;
  onOpenNewMember: () => void;
  onOpenDeposit: () => void;
  onOpenBerjangka?: () => void;
  onOpenNewLoan: () => void;
  onOpenRepayment: (loanId?: string) => void;
  userRole?: UserRole;
  currentUser?: AuthUser | null;
  isLoading?: boolean;
  error?: string | null;
  isFromSupabase?: boolean;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  members,
  savings,
  loans,
  repayments,
  unitReports,
  businessTransactions,
  spCashMutations = [],
  onNavigate,
  onNavigateToKasSP,
  onOpenNewMember,
  onOpenDeposit,
  onOpenBerjangka,
  onOpenNewLoan,
  onOpenRepayment,
  userRole = 'pengurus',
  currentUser,
  isLoading = false,
  error = null,
  isFromSupabase = false,
  onRefresh,
}) => {
  const isAnggota = userRole === 'anggota' || currentUser?.role === 'anggota';
  const myMemberId = (currentUser?.memberId || (isAnggota ? currentUser?.username : undefined) || 'BJS-001').trim();
  const myMember: Member = members.find((m) => m.id.toLowerCase() === myMemberId.toLowerCase()) || {
    id: myMemberId,
    name: currentUser?.name || 'Anggota Koperasi',
    nik: '-',
    phone: '-',
    job: currentUser?.unitKerja || 'Dinas',
    address: 'Kabupaten Cirebon',
    status: 'aktif',
    joinDate: '2023-01-01',
    joinYear: 2023,
    calculatedMonths: 35,
    initialTotalSavings: 0,
  };
  const actualMemberId = myMember.id;

  const mySavings = calculateMemberSavings(actualMemberId, savings);
  const myLoans = loans.filter((l) => l.memberId.toLowerCase() === actualMemberId.toLowerCase());
  const myActiveLoan = myLoans.find((l) => l.status === 'aktif' || l.status === 'dicairkan');
  const myBerjangkaList = savings.filter(
    (s) => s.memberId.toLowerCase() === actualMemberId.toLowerCase() && s.type === 'berjangka' && s.statusBerjangka !== 'dibatalkan'
  );
  const myRecentSavings = savings
    .filter((s) => s.memberId.toLowerCase() === actualMemberId.toLowerCase())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const myRecentRepayments = repayments
    .filter((r) => r.memberId.toLowerCase() === actualMemberId.toLowerCase())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Find upcoming loan schedules
  const activeLoans = loans.filter((l) => l.status === 'aktif' || l.status === 'dicairkan');
  const pendingDues: {
    loanId: string;
    memberId: string;
    memberName: string;
    month: number;
    dueDate: string;
    amount: number;
  }[] = [];

  activeLoans.forEach((loan) => {
    const nextUnpaid = loan.schedules.find((s) => !s.isPaid);
    if (nextUnpaid) {
      pendingDues.push({
        loanId: loan.id,
        memberId: loan.memberId,
        memberName: loan.memberName,
        month: nextUnpaid.month,
        dueDate: nextUnpaid.dueDate,
        amount: nextUnpaid.totalInstallment,
      });
    }
  });

  // Recent transactions combined
  const recentActivities = [
    ...savings.slice(-4).map((s) => ({
      id: s.id,
      title: s.txType === 'setor' ? `Setor Simpanan ${s.type}` : `Tarik Simpanan ${s.type}`,
      name: s.memberName,
      date: s.date,
      amount: s.amount,
      isPositive: s.txType === 'setor',
      type: 'simpanan',
    })),
    ...repayments.slice(-4).map((r) => ({
      id: r.id,
      title: `Angsuran #${r.installmentNo}`,
      name: r.memberName,
      date: r.date,
      amount: r.totalPaid,
      isPositive: true,
      type: 'angsuran',
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Business Unit Reports calculation matching Laporan Unit Usaha exactly
  const rpts: BusinessUnitReport[] =
    businessTransactions && businessTransactions.length > 0
      ? calculateBusinessUnitReports(businessTransactions).reports
      : unitReports || [];

  const getUnitReport = (unitId: string, fallbackKey: string) => {
    return (
      rpts.find((r) => r.unitId === unitId || r.key === fallbackKey || r.key === unitId) || {
        unitId: unitId as any,
        key: fallbackKey as any,
        unitName: unitId,
        name: unitId,
        totalRevenue: 0,
        totalHPP: 0,
        totalOperasional: 0,
        grossProfit: 0,
        netProfit: 0,
      }
    );
  };

  const aparSalesRpt = getUnitReport('alat_kebakaran', 'apar_sales');
  const aparRefillRpt = getUnitReport('apar', 'apar_refill');
  const sembakoRpt = getUnitReport('sembako', 'sembako');
  const atributRpt = getUnitReport('atribut', 'atribut');

  // Kas Unit Simpan Pinjam (sinkron mutasi kas unit simpan pinjam: awal Rp 0 + penambahan - pengurangan)
  const totalPenambahanSP = spCashMutations
    .filter((m) => m.type === 'penambahan')
    .reduce((sum, m) => sum + m.amount, 0);
  const totalPenguranganSP = spCashMutations
    .filter((m) => m.type === 'pengurangan')
    .reduce((sum, m) => sum + m.amount, 0);
  const saldoKasUnitSP = summary.kasUnitSP !== undefined ? summary.kasUnitSP : (0 + totalPenambahanSP - totalPenguranganSP);

  // IF USER IS ANGGOTA: RENDER DEDICATED PERSONAL DASHBOARD (HIDING ALL INTERNAL FINANCES)
  if (isAnggota) {
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
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-center gap-2.5 shadow-2xs animate-pulse">
            <div className="w-4 h-4 border-2 border-blue-800 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-semibold">Menyinkronkan data dashboard dari Supabase PostgreSQL...</span>
          </div>
        )}

        {/* Member Personalized Banner */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 rounded-2xl p-6 text-white shadow-md border border-blue-800/40 relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                PORTAL ANGGOTA KOPERASI
              </span>
              <span className="text-xs text-blue-200 font-semibold">BJS Digital</span>
              {isFromSupabase ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                  Supabase PostgreSQL
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">
                  Cadangan Lokal
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Selamat Datang, {myMember.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-blue-100/90 mt-1.5 font-medium">
              <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/15 font-mono font-bold text-white">
                No. Registrasi: {myMember.id}
              </span>
              <span>&bull;</span>
              <span>Unit Kerja: {myMember.job}</span>
              <span>&bull;</span>
              <span className="text-emerald-300 font-bold uppercase">Status: {myMember.status}</span>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => onNavigate('simpanan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-blue-50 transition cursor-pointer"
            >
              <PiggyBank className="w-4 h-4 text-blue-900" />
              <span>Lihat Simpanan Saya</span>
            </button>
            <button
              onClick={() => onNavigate('pinjaman')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer border border-blue-600/40"
            >
              <HandCoins className="w-4 h-4 text-blue-200" />
              <span>Lihat Pinjaman Saya</span>
            </button>
          </div>
        </div>

        {/* Member 4 Personal KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Simpanan Saya */}
          <div
            onClick={() => onNavigate('simpanan')}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Simpanan Saya
              </span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
                <PiggyBank className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-slate-900">
                {formatRupiah(mySavings.total)}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Pokok + Wajib + Berjangka</span>
              <span className="text-blue-700 font-bold">Rincian &rarr;</span>
            </div>
          </div>

          {/* 2. Simpanan Wajib Saya */}
          <div
            onClick={() => onNavigate('simpanan')}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Simpanan Wajib Saya
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-100">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-indigo-950">
                {formatRupiah(mySavings.wajib)}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-indigo-800 font-semibold flex justify-between">
              <span>{myMember.calculatedMonths || 35} bulan @Rp 50.000</span>
              <span>Lancar</span>
            </div>
          </div>

          {/* 3. Simpanan Berjangka 6% */}
          <div
            onClick={() => onNavigate('simpanan')}
            className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs hover:border-red-300 transition cursor-pointer bg-gradient-to-br from-white to-rose-50/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                Simpanan Berjangka 6%
              </span>
              <div className="p-2.5 rounded-xl bg-red-100 text-red-900 border border-red-200">
                <BadgePercent className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-red-950">
                {formatRupiah(mySavings.berjangka)}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-rose-100 text-[11px] text-red-800 font-semibold flex justify-between">
              <span>{myBerjangkaList.length} Bilyet Aktif</span>
              <span>Bunga 6.0% p.a.</span>
            </div>
          </div>

          {/* 4. Status Pinjaman Saya */}
          <div
            onClick={() => onNavigate('pinjaman')}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sisa Pinjaman Saya
              </span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-100">
                <HandCoins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-slate-900">
                {myActiveLoan ? formatRupiah(calculateLoanRemaining(myActiveLoan).remainingPrincipal) : 'Rp 0'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] flex justify-between font-semibold">
              {myActiveLoan ? (
                <>
                  <span className="text-amber-800">Pinjaman Aktif</span>
                  <span className="text-blue-700">Jadwal &rarr;</span>
                </>
              ) : (
                <span className="text-emerald-700">Bebas Pinjaman</span>
              )}
            </div>
          </div>
        </div>

        {/* Member Detailed Berjangka Certificate Card (If member has berjangka, e.g. BJS-001) */}
        {myBerjangkaList.length > 0 && (
          <div className="bg-gradient-to-br from-red-950 via-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-md border border-red-800/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/15 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-600 rounded-xl text-white shadow-md">
                  <BadgePercent className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 bg-red-900/60 px-2 py-0.5 rounded-full border border-red-500/30">
                    Bilyet Simpanan Berjangka 6% p.a.
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    Penyertaan Modal Anggota Berjangka
                  </h3>
                </div>
              </div>
              <button
                onClick={() => onNavigate('simpanan')}
                className="px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition cursor-pointer self-start sm:self-auto"
              >
                Buka Bilyet & Cetak PDF &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <span className="text-slate-300 text-[11px]">Nomor Bilyet</span>
                <p className="font-mono font-bold text-white text-sm mt-0.5">{myBerjangkaList[0].id}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <span className="text-slate-300 text-[11px]">Nominal Pokok</span>
                <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{formatRupiah(myBerjangkaList[0].amount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <span className="text-slate-300 text-[11px]">Jatuh Tempo</span>
                <p className="font-mono font-bold text-white text-sm mt-0.5">{formatDateIndo(myBerjangkaList[0].maturityDate || myBerjangkaList[0].date)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <span className="text-slate-300 text-[11px]">Estimasi Bunga RAT</span>
                <p className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                  {formatRupiah(myBerjangkaList[0].accruedInterest || Math.round(myBerjangkaList[0].amount * 0.06))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Member Active Loan Status (if any) */}
        {myActiveLoan && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-blue-900" />
                <span>Rincian Pinjaman Aktif Saya ({myActiveLoan.id})</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Status Lancar
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500">Plafon Disetujui</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatRupiah(myActiveLoan.amount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500">Sisa Pokok Hutang</span>
                <p className="font-mono font-bold text-red-700 text-sm mt-0.5">{formatRupiah(calculateLoanRemaining(myActiveLoan).remainingPrincipal)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500">Angsuran / Bulan</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatRupiah(myActiveLoan.monthlyTotal)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500">Progres Angsuran</span>
                <p className="font-bold text-blue-900 text-sm mt-0.5">
                  {myActiveLoan.schedules.filter((s) => s.isPaid).length} / {myActiveLoan.tenorMonths} Bulan
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Member Recent Personal Transactions History */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Riwayat Transaksi Pribadi Saya</h3>
              <p className="text-xs text-slate-500 mt-0.5">Catatan simpanan dan pembayaran angsuran anggota</p>
            </div>
            <button
              onClick={() => onNavigate('simpanan')}
              className="text-xs font-bold text-blue-900 hover:text-red-800 flex items-center gap-1 cursor-pointer"
            >
              Lihat Selengkapnya &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {myRecentSavings.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 capitalize">
                      Setoran Simpanan {s.type === 'berjangka' ? 'Berjangka 6%' : s.type}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">{formatDateIndo(s.date)} &bull; {s.id}</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  +{formatRupiah(s.amount)}
                </span>
              </div>
            ))}
            {myRecentSavings.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada transaksi simpanan yang tercatat.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-center gap-2.5 shadow-2xs animate-pulse">
          <div className="w-4 h-4 border-2 border-blue-800 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Menyinkronkan data dashboard dari Supabase PostgreSQL...</span>
        </div>
      )}

      {/* Top Banner with Blue & Maroon Gradient */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 rounded-2xl p-5 text-white shadow-md border border-blue-800/40 relative overflow-hidden flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
              KOPERASI BRAMA JAYA SEJAHTERA
            </span>
            {isFromSupabase ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                Supabase PostgreSQL
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">
                Cadangan Lokal
              </span>
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            Dashboard Simpan Pinjam & Unit Usaha
          </h2>
        </div>

        {/* Action Shortcuts (Only for Pengurus) */}
        {userRole === 'pengurus' ? (
          <div className="relative z-10 flex flex-wrap gap-2 shrink-0">
            <button
              onClick={onOpenNewMember}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-blue-50 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-blue-900" />
              <span>+ Anggota Baru</span>
            </button>
            <button
              onClick={onOpenDeposit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer border border-blue-600/40"
            >
              <ArrowDownLeft className="w-4 h-4 text-blue-200" />
              <span>+ Setor Simpanan</span>
            </button>
            {onOpenBerjangka && (
              <button
                onClick={onOpenBerjangka}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-700 to-rose-900 hover:from-red-600 hover:to-rose-800 text-white font-bold text-xs shadow-md transition cursor-pointer border border-red-500/40"
              >
                <BadgePercent className="w-4 h-4 text-red-200" />
                <span>+ Simpanan Berjangka</span>
              </button>
            )}
            <button
              onClick={onOpenNewLoan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition cursor-pointer border border-slate-600/40"
            >
              <HandCoins className="w-4 h-4 text-slate-200" />
              <span>+ Pengajuan Pinjaman</span>
            </button>
          </div>
        ) : (
          <div className="relative z-10 px-3.5 py-2 bg-white/10 rounded-xl border border-white/20 text-xs text-blue-100 flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-200" />
            <span>Mode Anggota: Akses Baca (Read-Only)</span>
          </div>
        )}
      </div>

      {/* Rekonsiliasi Saldo Awal & Kas Koperasi Status Indicator */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 shrink-0 mt-0.5 sm:mt-0">
            <Scale className="w-4 h-4 text-blue-800" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">Rekonsiliasi Saldo Awal & Kas Koperasi:</span>
              {summary.totalCash === summary.totalSavings.total && summary.totalCash > 0 ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Rekonsiliasi Lengkap (100% Seimbang)
                </span>
              ) : summary.totalCash > 0 ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                  <Scale className="w-3 h-3 text-blue-600" />
                  Rekonsiliasi Parsial
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Belum Direkonsiliasi
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kas & Bank Terverifikasi: <strong className="font-mono text-slate-800">{formatRupiah(summary.totalCash)}</strong>
              {summary.totalCash > 0 && (
                <span className="text-slate-600 font-medium ml-1">
                  (Fisik: <strong className="font-mono text-slate-700">{formatRupiah(summary.totalCashFisik ?? 0)}</strong>, Bank: <strong className="font-mono text-slate-700">{formatRupiah(summary.totalCashBank ?? 0)}</strong>)
                </span>
              )}
              {' '}&bull; Simpanan Historis: <strong className="font-mono text-slate-800">{formatRupiah(summary.totalSavings.total)}</strong>
              {summary.totalSavings.total !== summary.totalCash && (
                <span className="text-amber-800 font-semibold ml-1">
                  (Selisih Terbuka: {formatRupiah(Math.abs(summary.totalSavings.total - summary.totalCash))})
                </span>
              )}
            </p>
          </div>
        </div>
        {userRole === 'pengurus' && (
          <button
            onClick={() => onNavigate('laporan')}
            className="px-3.5 py-1.5 rounded-xl bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
          >
            <span>Kelola di Laporan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* KPI Cards Grid: Updated Labels & Calculations per User Request */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Status Anggota (Aktif / Pasif / Keluar) */}
        <div
          onClick={() => onNavigate('anggota')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Status Anggota
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-slate-900">
              {members.length} Anggota
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-emerald-700 font-bold">
              Aktif: {summary.membersCount.aktif}
            </span>
            <span className="text-amber-700 font-medium">
              Pasif: {summary.membersCount.pasif}
            </span>
            <span className="text-slate-400">
              Keluar: {summary.membersCount.keluar}
            </span>
          </div>
        </div>

        {/* 2. Kas Unit Simpan Pinjam */}
        <div
          onClick={() => (onNavigateToKasSP ? onNavigateToKasSP() : onNavigate('pinjaman'))}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Kas Unit Simpan Pinjam
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black font-mono ${saldoKasUnitSP >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
              {formatRupiah(saldoKasUnitSP)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
            <span>Saldo Awal: Rp 0</span>
            <span className="font-semibold text-emerald-700">Masuk: +{formatRupiah(totalPenambahanSP)}</span>
          </div>
        </div>

        {/* 3. Simpanan Anggota */}
        <div
          onClick={() => onNavigate('simpanan')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Simpanan Anggota
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-100">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-slate-900">
              {formatRupiah(summary.totalSavings.total)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
            <span>Pokok+Wajib: {formatRupiah(summary.totalSavings.pokok + summary.totalSavings.wajib)}</span>
            <span className="font-bold text-red-700">6% Berjangka</span>
          </div>
        </div>

        {/* 4. Outstanding Pinjaman (Ganti nama per request #2) */}
        <div
          onClick={() => onNavigate('pinjaman')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-red-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding Pinjaman
            </span>
            <div className="p-2.5 rounded-xl bg-red-50 text-red-800 border border-red-100">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-red-950">
              {formatRupiah(summary.totalOutstandingLoans)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
            <span>{summary.activeLoansCount} Pinjaman Berjalan</span>
          </div>
        </div>
      </div>

      {/* LOAN WORKFLOW PROGRESSION (Diajukan -> Review -> Disetujui -> Dicairkan) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Workflow Pengajuan Pinjaman Anggota
            </h3>
          </div>
          <button
            onClick={() => onNavigate('pinjaman')}
            className="text-xs font-bold text-blue-900 hover:text-red-800 flex items-center gap-1 cursor-pointer"
          >
            Kelola Pengajuan <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Diajukan</span>
              <div className="text-lg font-black font-mono text-slate-800">
                {summary.loanWorkflowCount?.diajukan || 0}
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-800">Review / Menunggu</span>
              <div className="text-lg font-black font-mono text-amber-900">
                {summary.loanWorkflowCount?.review || 0}
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-blue-800">Disetujui</span>
              <div className="text-lg font-black font-mono text-blue-900">
                {summary.loanWorkflowCount?.disetujui || 0}
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-800">Dicairkan (Aktif)</span>
              <div className="text-lg font-black font-mono text-emerald-900">
                {summary.loanWorkflowCount?.dicairkan || summary.activeLoansCount || 0}
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
          </div>
        </div>
      </div>

      {/* KEUNTUNGAN 4 UNIT USAHA KOPERASI */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-900" />
              Keuntungan Masing-Masing Unit Usaha Koperasi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Konsolidasi laba bersih unit usaha untuk pembentukan SHU akhir tahun
            </p>
          </div>
          <button
            onClick={() => onNavigate('unit_usaha')}
            className="text-xs font-bold text-blue-900 hover:text-red-800 flex items-center gap-1 cursor-pointer"
          >
            Laporan Detail Unit Usaha <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Unit 1: Penjualan Alat Proteksi Kebakaran */}
          <div
            onClick={() => onNavigate('unit_usaha')}
            className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 text-rose-800 mb-1">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold truncate">Penjualan Alat Kebakaran</span>
            </div>
            <div className="text-lg font-black font-mono text-rose-950">
              {formatRupiah(aparSalesRpt.netProfit)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Omset {formatRupiah(aparSalesRpt.totalRevenue)}</span>
              <span>•</span>
              <span>HPP {formatRupiah(aparSalesRpt.totalHPP)}</span>
            </div>
          </div>

          {/* Unit 2: Isi Ulang APAR */}
          <div
            onClick={() => onNavigate('unit_usaha')}
            className="p-4 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 text-amber-800 mb-1">
              <Flame className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold truncate">Isi Ulang APAR (Refill)</span>
            </div>
            <div className="text-lg font-black font-mono text-amber-950">
              {formatRupiah(aparRefillRpt.netProfit)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Omset {formatRupiah(aparRefillRpt.totalRevenue)}</span>
              <span>•</span>
              <span>HPP {formatRupiah(aparRefillRpt.totalHPP)}</span>
            </div>
          </div>

          {/* Unit 3: Sembako */}
          <div
            onClick={() => onNavigate('unit_usaha')}
            className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 text-emerald-800 mb-1">
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold truncate">Penjualan Sembako</span>
            </div>
            <div className="text-lg font-black font-mono text-emerald-950">
              {formatRupiah(sembakoRpt.netProfit)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Omset {formatRupiah(sembakoRpt.totalRevenue)}</span>
              <span>•</span>
              <span>HPP {formatRupiah(sembakoRpt.totalHPP)}</span>
            </div>
          </div>

          {/* Unit 4: Atribut */}
          <div
            onClick={() => onNavigate('unit_usaha')}
            className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 text-blue-800 mb-1">
              <Shirt className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold truncate">Penjualan Atribut</span>
            </div>
            <div className="text-lg font-black font-mono text-blue-950">
              {formatRupiah(atributRpt.netProfit)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Omset {formatRupiah(atributRpt.totalRevenue)}</span>
              <span>•</span>
              <span>HPP {formatRupiah(atributRpt.totalHPP)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Jadwal Angsuran & Simpanan Anggota (No extra long text, pure numbers per request) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Dues (2 Cols on LG) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-700" />
                Jadwal Angsuran Pinjaman Jatuh Tempo
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Anggota yang memiliki tagihan angsuran berjalan
              </p>
            </div>
            <button
              onClick={() => onNavigate('pinjaman')}
              className="text-xs font-bold text-blue-900 hover:text-red-800 flex items-center gap-1 cursor-pointer"
            >
              Lihat Semua Pinjaman <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingDues.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
              <CheckCircle className="w-8 h-8 text-blue-900 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak ada angsuran tertunda</p>
              <p className="text-xs text-slate-400 mt-1">
                Semua pinjaman anggota dalam status lancar dan terjadwal rapi.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-3">Anggota</th>
                    <th className="pb-3">Cicilan Ke</th>
                    <th className="pb-3">Jatuh Tempo</th>
                    <th className="pb-3 text-right">Tagihan</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingDues.slice(0, 5).map((item) => (
                    <tr key={`${item.loanId}-${item.month}`} className="hover:bg-slate-50 transition">
                      <td className="py-3">
                        <div className="font-bold text-slate-900">{item.memberName}</div>
                        <div className="text-[11px] text-blue-900 font-mono font-bold">{item.memberId}</div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                          Bulan ke-{item.month}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-slate-600 font-medium">
                        {formatDateIndo(item.dueDate)}
                      </td>
                      <td className="py-3 text-right font-mono font-black text-slate-900">
                        {formatRupiah(item.amount)}
                      </td>
                      <td className="py-3 text-right">
                        {userRole === 'pengurus' ? (
                          <button
                            onClick={() => onOpenRepayment(item.loanId)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            <ReceiptText className="w-3.5 h-3.5" />
                            Bayar
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Jatuh Tempo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SIMPANAN ANGGOTA CARD (PURE NUMBERS PER USER REQUEST) */}
        {/* Request: "Dua Pilar Simpanan Koperasi diganti jadi Simpanan Anggota yang berisi total simpanan pokok, simpanan wajib, dan simpanan berajangka. tidak perlu ada keterangan informasi tambahan, cukup munculkan angka saja." */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <PiggyBank className="w-5 h-5 text-blue-900" />
              Simpanan Anggota
            </h3>

            <div className="space-y-3">
              {/* Simpanan Pokok */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Simpanan Pokok</span>
                <span className="text-base font-black font-mono text-slate-900">
                  {formatRupiah(summary.totalSavings.pokok)}
                </span>
              </div>

              {/* Simpanan Wajib */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Simpanan Wajib</span>
                <span className="text-base font-black font-mono text-slate-900">
                  {formatRupiah(summary.totalSavings.wajib)}
                </span>
              </div>

              {/* Simpanan Berjangka */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Simpanan Berjangka</span>
                <span className="text-base font-black font-mono text-slate-900">
                  {formatRupiah(summary.totalSavings.berjangka)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Simpanan
            </span>
            <span className="text-lg font-black font-mono text-blue-950">
              {formatRupiah(summary.totalSavings.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activities Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Aktivitas Transaksi Terkini</h3>
          <button
            onClick={() => onNavigate('laporan')}
            className="text-xs font-bold text-blue-900 hover:text-red-800 flex items-center gap-1 cursor-pointer"
          >
            Lihat Buku Kas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentActivities.map((act) => (
            <div
              key={act.id}
              className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition flex items-start gap-3"
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  act.isPositive ? 'bg-blue-100 text-blue-900' : 'bg-red-100 text-red-900'
                }`}
              >
                {act.isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{act.title}</p>
                <p className="text-xs text-slate-600 truncate">{act.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-slate-400">{act.date.split(' ')[0]}</span>
                  <span
                    className={`text-xs font-mono font-black ${
                      act.isPositive ? 'text-blue-900' : 'text-red-900'
                    }`}
                  >
                    {act.isPositive ? '+' : '-'} {formatRupiah(act.amount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
