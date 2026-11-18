import React, { useMemo } from 'react';
import {
  PiggyBank,
  HandCoins,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Printer,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  ShieldCheck,
} from 'lucide-react';
import {
  AuthUser,
  CashFlowRecord,
  KOPERASI_OFFICIALS,
  Loan,
  LoanRepayment,
  Member,
  SavingsTransaction,
  SimpanPinjamCashMutation,
} from '../types';
import { formatDateIndo, formatRupiah } from '../utils/formatters';
import { calculateLoanRemaining, computeCooperativeSummary } from '../utils/storage';
import { printHtmlContent } from '../utils/printHelper';

interface LaporanUspViewProps {
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  cashFlow: CashFlowRecord[];
  spCashMutations: SimpanPinjamCashMutation[];
  currentUser?: AuthUser | null;
  spManagerName?: string;
  isLoading?: boolean;
  error?: string | null;
  isFromSupabase?: boolean;
  onRefresh?: () => void;
}

export const LaporanUspView: React.FC<LaporanUspViewProps> = ({
  members,
  savings,
  loans,
  repayments,
  cashFlow,
  spCashMutations,
  spManagerName,
  isLoading = false,
  error = null,
  isFromSupabase = true,
  onRefresh,
}) => {
  const effectiveSpManagerName = spManagerName || KOPERASI_OFFICIALS.manajerUSP;
  const summary = useMemo(
    () =>
      computeCooperativeSummary(
        members,
        savings,
        loans,
        repayments,
        cashFlow,
        [],
        spCashMutations
      ),
    [members, savings, loans, repayments, cashFlow, spCashMutations]
  );

  const activeLoans = useMemo(
    () => loans.filter((l) => l.status === 'aktif' || l.status === 'dicairkan'),
    [loans]
  );

  const topUpLoans = useMemo(
    () => loans.filter((l) => l.isTopUp || Boolean(l.parentLoanId)),
    [loans]
  );

  const totalAdminFeeCollected = useMemo(
    () =>
      loans
        .filter((l) => l.status === 'aktif' || l.status === 'dicairkan' || l.status === 'lunas')
        .reduce((sum, l) => sum + (Number(l.adminFee) || 0), 0),
    [loans]
  );

  const totalSpInflow = useMemo(
    () =>
      spCashMutations
        .filter((m) => m.type === 'penambahan')
        .reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
    [spCashMutations]
  );

  const totalSpOutflow = useMemo(
    () =>
      spCashMutations
        .filter((m) => m.type === 'pengurangan')
        .reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
    [spCashMutations]
  );

  const handlePrintUspReport = () => {
    const todayStr = formatDateIndo(new Date().toISOString());
    const topUpRows = topUpLoans
      .map(
        (l) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;font-family:monospace;">${l.id}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;">${l.memberName} (${l.memberId})</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;font-family:monospace;">${l.parentLoanId || '-'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">${formatRupiah(l.amount)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">${formatRupiah(l.topUpSettledPrincipal || 0)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">${formatRupiah(l.adminFee)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;font-weight:bold;">${formatRupiah(l.netDisbursedAmount ?? l.amount)}</td>
      </tr>`
      )
      .join('');

    const html = `
      <div class="header-kop">
        <h1>KOPERASI BRAMA JAYA SEJAHTERA</h1>
        <h2>UNIT USAHA SIMPAN PINJAM (USP)</h2>
        <p>Laporan Operasional & Keuangan Unit Simpan Pinjam — Dicetak: ${todayStr}</p>
      </div>
      <div class="document-title">LAPORAN UNIT SIMPAN PINJAM (USP)</div>
      <div class="content-box">
        <table>
          <tr><td class="label">Total Simpanan Pokok</td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalSavings.pokok)}</td></tr>
          <tr><td class="label">Total Simpanan Wajib</td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalSavings.wajib)}</td></tr>
          <tr><td class="label">Total Simpanan Berjangka (6%)</td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalSavings.berjangka)}</td></tr>
          <tr><td class="label"><strong>Total Simpanan Anggota</strong></td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalSavings.total)}</td></tr>
          <tr><td class="label">Total Plafon Disalurkan</td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalDisbursedLoans)}</td></tr>
          <tr><td class="label">Sisa Pokok Piutang Berjalan</td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalOutstandingLoans)}</td></tr>
          <tr><td class="label">Pendapatan Jasa Bunga Pinjaman (Keuntungan Koperasi)</td><td class="colon">:</td><td class="value">${formatRupiah(summary.totalInterestEarned)}</td></tr>
          <tr><td class="label">Dana Biaya Administrasi 1% (Kas Terpisah / Non-Laba Koperasi)</td><td class="colon">:</td><td class="value">${formatRupiah(totalAdminFeeCollected)}</td></tr>
          <tr><td class="label">Saldo Kas Operasional Unit SP</td><td class="colon">:</td><td class="value">${formatRupiah(summary.kasUnitSP || 0)}</td></tr>
        </table>
      </div>
      ${
        topUpLoans.length > 0
          ? `<h3 style="font-size:12px;font-weight:800;margin:14px 0 6px;">Riwayat Transaksi Top Up Pinjaman</h3>
             <table style="font-size:11px;border-collapse:collapse;width:100%;">
               <thead>
                 <tr style="background:#f1f5f9;">
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;">ID Baru</th>
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;">Anggota</th>
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;">Pinjaman Lama</th>
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">Plafon Baru</th>
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">Pelunasan Pokok</th>
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">Admin 1%</th>
                   <th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;">Bersih Diterima</th>
                 </tr>
               </thead>
               <tbody>${topUpRows}</tbody>
             </table>`
          : ''
      }
      <div class="signatures">
        <div style="width:45%;">
          <p style="font-size:11px;margin-bottom:55px;">Pengelola Unit Simpan Pinjam,</p>
          <p style="font-size:11px;font-weight:800;text-decoration:underline;">${effectiveSpManagerName}</p>
        </div>
        <div style="width:45%;">
          <p style="font-size:11px;margin-bottom:55px;">Mengetahui, Ketua Koperasi,</p>
          <p style="font-size:11px;font-weight:800;text-decoration:underline;">${KOPERASI_OFFICIALS.ketua}</p>
        </div>
      </div>
    `;
    printHtmlContent(html, 'Laporan-Unit-Simpan-Pinjam-BJS');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Unit Usaha Simpan Pinjam (USP)
            </span>
            {isFromSupabase && !error && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Tersinkron Database
              </span>
            )}
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-1.5">
            Laporan Operasional Unit Simpan Pinjam
          </h3>
          <p className="text-xs text-slate-500">
            Rekapitulasi Simpanan Anggota, Portofolio Pinjaman, Top Up, Jasa Bunga Koperasi & Kas Terpisah Biaya Admin 1%
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintUspReport}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Laporan USP
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total Simpanan USP</span>
            <PiggyBank className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-xl font-black font-mono text-slate-900">
            {formatRupiah(summary.totalSavings.total)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.membersCount.aktif} Anggota Aktif ({summary.membersCount.total} total)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Sisa Pokok Piutang</span>
            <HandCoins className="w-4 h-4 text-blue-800" />
          </div>
          <p className="text-xl font-black font-mono text-blue-900">
            {formatRupiah(summary.totalOutstandingLoans)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {activeLoans.length} pinjaman aktif berjalan
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Pendapatan Jasa Bunga</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-xl font-black font-mono text-emerald-800">
            {formatRupiah(summary.totalInterestEarned)}
          </p>
          <p className="text-[11px] text-emerald-700 mt-1">
            Masuk sebagai keuntungan / SHU koperasi
          </p>
        </div>

        <div className="bg-amber-50/40 rounded-2xl border border-amber-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-900 mb-2">
            <span className="text-xs font-bold">Biaya Admin 1% (Terpisah)</span>
            <Wallet className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-xl font-black font-mono text-amber-900">
            {formatRupiah(totalAdminFeeCollected)}
          </p>
          <p className="text-[11px] text-amber-800 mt-1">
            Kas operasional SP, tidak dicatat sebagai laba koperasi
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Saldo Kas Unit SP</span>
            <Wallet className="w-4 h-4 text-indigo-700" />
          </div>
          <p className="text-xl font-black font-mono text-indigo-900">
            {formatRupiah(summary.kasUnitSP || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Masuk {formatRupiah(totalSpInflow)} • Keluar {formatRupiah(totalSpOutflow)}
          </p>
        </div>
      </div>

      {/* Simpanan & Pinjaman Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Rincian Komposisi Simpanan Anggota
          </h4>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">Simpanan Pokok</span>
              <span className="font-mono font-bold text-slate-900">
                {formatRupiah(summary.totalSavings.pokok)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">Simpanan Wajib</span>
              <span className="font-mono font-bold text-slate-900">
                {formatRupiah(summary.totalSavings.wajib)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">Simpanan Berjangka (6% p.a.)</span>
              <span className="font-mono font-bold text-slate-900">
                {formatRupiah(summary.totalSavings.berjangka)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="font-black text-emerald-950">Total Akumulasi Simpanan</span>
              <span className="font-mono font-black text-emerald-800 text-sm">
                {formatRupiah(summary.totalSavings.total)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-800" />
            Daftar Pinjaman Aktif Berjalan ({activeLoans.length})
          </h4>
          {activeLoans.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Belum ada pinjaman aktif berjalan saat ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2 font-bold">ID Pinjaman</th>
                    <th className="py-2 pr-2 font-bold">Anggota</th>
                    <th className="py-2 text-right font-bold">Plafon</th>
                    <th className="py-2 text-right font-bold">Sisa Pokok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLoans.slice(0, 8).map((loan) => {
                    const { remainingPrincipal } = calculateLoanRemaining(loan);
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-2 font-mono font-semibold text-blue-900">
                          {loan.id}
                          {loan.isTopUp && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                              TOP UP
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 font-medium text-slate-800">
                          {loan.memberName}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-700">
                          {formatRupiah(loan.amount)}
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(remainingPrincipal)}
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

      {/* Riwayat Top Up Pinjaman */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-indigo-700" />
            Riwayat Transaksi Top Up Pinjaman ({topUpLoans.length})
          </h4>
        </div>
        {topUpLoans.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Belum ada transaksi Top Up Pinjaman yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-bold">ID Pinjaman Baru</th>
                  <th className="py-2.5 px-3 font-bold">Anggota</th>
                  <th className="py-2.5 px-3 font-bold">Pinjaman Dilunasi</th>
                  <th className="py-2.5 px-3 text-right font-bold">Plafon Baru</th>
                  <th className="py-2.5 px-3 text-right font-bold">Pokok Lama</th>
                  <th className="py-2.5 px-3 text-right font-bold">Tunggakan Bunga</th>
                  <th className="py-2.5 px-3 text-right font-bold">Admin 1%</th>
                  <th className="py-2.5 px-3 text-right font-bold">Bersih ke Anggota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topUpLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">{loan.id}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{loan.memberName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{loan.memberId}</p>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {loan.parentLoanId || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {formatRupiah(loan.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                      {formatRupiah(loan.topUpSettledPrincipal || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                      {formatRupiah(loan.topUpSettledInterest || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatRupiah(loan.adminFee)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">
                      {formatRupiah(loan.netDisbursedAmount ?? loan.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
