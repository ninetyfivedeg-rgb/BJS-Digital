import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Upload,
  RefreshCw,
  Printer,
  PlusCircle,
  X,
  CheckCircle,
  Building,
  CheckCircle2,
  FileDown,
  AlertCircle,
  Scale,
} from 'lucide-react';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CashFlowRecord,
  CooperativeSummary,
  UserRole,
  AuthUser,
  OpeningReconciliationData,
} from '../types';
import { formatRupiah, formatDateIndo, formatDateTimeIndo } from '../utils/formatters';
import { printHtmlContent } from '../utils/printHelper';
import { RekonsiliasiModal } from './RekonsiliasiModal';
import { fetchLatestOpeningReconciliation } from '../services/reconciliationService';

interface LaporanViewProps {
  summary: CooperativeSummary;
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  cashFlow: CashFlowRecord[];
  onAddCashFlow: (record: Omit<CashFlowRecord, 'id'>) => Promise<any> | void;
  onResetData: () => void;
  onImportData: (importedData: any) => void;
  isLoading?: boolean;
  error?: string | null;
  isFromSupabase?: boolean;
  onRefresh?: () => void;
  userRole?: UserRole;
  currentUser?: AuthUser | null;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  summary,
  members,
  savings,
  loans,
  repayments,
  cashFlow,
  onAddCashFlow,
  onResetData,
  onImportData,
  isLoading = false,
  error = null,
  isFromSupabase = false,
  onRefresh,
  userRole = 'pengurus',
  currentUser,
}) => {
  const isAnggota = userRole === 'anggota' || currentUser?.role === 'anggota';
  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<OpeningReconciliationData | null>(null);

  useEffect(() => {
    if (!isAnggota) {
      fetchLatestOpeningReconciliation().then((res) => {
        if (res.reconciliation) {
          setReconciliationData(res.reconciliation);
        }
      });
    }
  }, [isAnggota]);

  const handleReconSuccess = (rec: OpeningReconciliationData) => {
    setReconciliationData(rec);
    if (onRefresh) {
      onRefresh();
    }
  };

  const [expenseForm, setExpenseForm] = useState({
    type: 'keluar' as 'masuk' | 'keluar',
    category: 'operasional' as CashFlowRecord['category'],
    targetAccount: 'kas_koperasi' as 'kas_koperasi' | 'kas_bank',
    amount: 150000,
    date: new Date().toISOString().split('T')[0],
    description: 'Biaya perlengkapan operasional & ATK Koperasi',
  });
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // TAMPILAN KHUSUS ANGGOTA (DATA PRIBADI SAJA, TANPA MEMBOCORKAN KEUANGAN INTERNAL ORGANISASI)
  if (isAnggota) {
    const myMemberId = (currentUser?.memberId || currentUser?.username || 'BJS-001').trim();
    const myMember = members.find((m) => m.id.toLowerCase() === myMemberId.toLowerCase()) || {
      id: myMemberId,
      name: currentUser?.name || 'Anggota Koperasi',
      nik: '-',
      phone: '-',
      job: currentUser?.unitKerja || 'Dinas',
      address: 'Kabupaten Cirebon',
      status: 'aktif',
      joinDate: '2023-01-01',
    };
    const mySavings = savings.filter((s) => s.memberId?.toLowerCase() === myMemberId.toLowerCase());
    let myPokok = 0;
    let myWajib = 0;
    let myBerjangka = 0;
    mySavings.forEach((s) => {
      const amt = Number(s.amount) || 0;
      const sign = s.txType === 'tarik' ? -1 : 1;
      if (s.type === 'pokok') myPokok += sign * amt;
      else if (s.type === 'wajib') myWajib += sign * amt;
      else if (s.type === 'berjangka' && s.statusBerjangka !== 'dibatalkan' && s.statusBerjangka !== 'selesai') {
        myBerjangka += sign * amt;
      }
    });
    const myTotalSavings = myPokok + myWajib + myBerjangka;

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
            <span className="font-semibold">Mengambil data laporan dari tabel Supabase PostgreSQL...</span>
          </div>
        )}

        {/* Member Personalized Banner */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 rounded-2xl p-6 text-white shadow-md border border-blue-800/40">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
              LAPORAN KEUANGAN PRIBADI ANGGOTA
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
          <h2 className="text-xl font-black text-white">Ringkasan Finansial: {myMember.name}</h2>
          <p className="text-xs text-blue-200 mt-1 font-mono">
            No. Registrasi: {myMember.id} &bull; Status: {String(myMember.status).toUpperCase()}
          </p>
        </div>

        {/* Personal 3 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Total Simpanan Saya</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">{formatRupiah(myTotalSavings)}</div>
            <div className="text-[11px] text-slate-500 mt-1">{mySavings.length} transaksi tercatat</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Simpanan Pokok & Wajib</span>
            <div className="text-2xl font-black font-mono text-blue-950 mt-2">{formatRupiah(myPokok + myWajib)}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Pokok: {formatRupiah(myPokok)} | Wajib: {formatRupiah(myWajib)}
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Simpanan Berjangka 6%</span>
            <div className="text-2xl font-black font-mono text-red-950 mt-2">{formatRupiah(myBerjangka)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Bilyet resmi berjangka</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
          <p className="font-semibold">Catatan Transparansi Koperasi:</p>
          <p className="mt-1 text-slate-600">
            Sesuai ketentuan AD/ART Koperasi Brama Jaya Sejahtera, Laporan Neraca SAK ETAP dan Pembukuan Kas Mutasi Keuangan Organisasi secara menyeluruh dikelola oleh Pengurus dan Pengawas Koperasi.
          </p>
        </div>
      </div>
    );
  }

  const filteredCashFlow = cashFlow.filter((cf) => {
    if (filterType === 'semua') return true;
    return cf.type === filterType;
  });

  const totalMasuk = cashFlow.filter((cf) => cf.type === 'masuk').reduce((acc, curr) => acc + curr.amount, 0);
  const totalKeluar = cashFlow.filter((cf) => cf.type === 'keluar').reduce((acc, curr) => acc + curr.amount, 0);

  // 1. AKTIVA (Aset Koperasi - Standar SAK ETAP)
  const kasKoperasi = summary.totalCash;
  const kasTunaiFisik = summary.totalCashFisik ?? 0;
  const kasDiBank = summary.totalCashBank ?? 0;
  const piutangPinjaman = summary.totalOutstandingLoans;
  const totalAktiva = kasKoperasi + piutangPinjaman;

  // 2. PASIVA (Kewajiban & Ekuitas Modal SAK ETAP)
  // Kewajiban titipan dana anggota hanya Simpanan Berjangka (Bilyet 6% p.a.) - Tidak ada simpanan sukarela
  const simpananBerjangka = summary.totalSavings.berjangka || 0;
  const totalKewajiban = simpananBerjangka;

  const simpananPokok = summary.totalSavings.pokok || 0;
  const simpananWajib = summary.totalSavings.wajib || 0;
  const modalAwal = summary.modalAwal || 0;
  const labaUnitUsaha = summary.totalBusinessProfit || 0;
  const pendapatanJasa = summary.totalInterestEarned || 0;

  // Realisasi SHU Tahun Berjalan murni dari hasil usaha riil (pendapatan jasa + laba unit usaha - beban operasional)
  // TIDAK menggunakan angka penyeimbang artifisial, dan tidak menggunakan Math.max(0, ...) agar jika rugi tetap tercermin secara transparan.
  const shuTahunBerjalan =
    (summary.totalBusinessProfit || 0) +
    (summary.totalInterestEarned || 0) -
    (summary.totalExpenses || 0);

  // Total Ekuitas = Modal Sendiri (Pokok + Wajib + Modal Awal) + SHU Realisasi Tahun Berjalan
  // Catatan Akuntansi SAK ETAP: Laba Unit Usaha dan Pendapatan Jasa Pinjaman adalah komponen pembentuk
  // SHU Tahun Berjalan (Laba/Rugi), sehingga TIDAK boleh ditambahkan ulang agar tidak terjadi double-counting.
  const totalEkuitas =
    simpananPokok +
    simpananWajib +
    modalAwal +
    shuTahunBerjalan;
  const totalPasiva = totalKewajiban + totalEkuitas;
  const selisihNeraca = totalAktiva - totalPasiva;
  const isBalanced = selisihNeraca === 0;

  const handlePrintNeracaPdf = () => {
    const html = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 52px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">
              Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | Standar SAK ETAP
            </p>
          </div>
        </div>
      </div>

      <div class="document-title" style="color: #0f172a; font-size: 15px; font-weight: 900; text-align: center; text-decoration: underline;">
        LAPORAN NERACA POSISI KEUANGAN KOPERASI (SAK ETAP)
      </div>
      <div class="doc-number" style="text-align: center; font-family: monospace; font-size: 11px; margin-bottom: 16px; color: #475569;">
        Per Tanggal: ${formatDateIndo(new Date().toISOString())} &bull; Periode Pembukuan Berjalan
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
            AKTIVA (ASET & HARTA)
          </h4>
          <table style="width: 100%; font-size: 11px;">
            <tr>
              <td style="padding: 4px 0 2px 0; font-weight: bold; color: #1e293b;" colspan="2">1. Kas dan Bank</td>
            </tr>
            <tr>
              <td style="padding: 2px 0 2px 12px; color: #475569;">1a. Kas Tunai Fisik</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(kasTunaiFisik)}</td>
            </tr>
            <tr>
              <td style="padding: 2px 0 2px 12px; color: #475569;">1b. Kas di Bank</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(kasDiBank)}</td>
            </tr>
            <tr style="border-top: 1px dashed #cbd5e1; font-weight: bold;">
              <td style="padding: 4px 0 4px 12px; color: #0f172a;">Total Kas & Bank</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(kasKoperasi)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0 4px 0; font-weight: bold; color: #1e293b;">2. Piutang Pinjaman Anggota (Sisa Pokok)</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold; padding-top: 6px;">${formatRupiah(piutangPinjaman)}</td>
            </tr>
            <tr style="border-top: 2px solid #0f172a; font-weight: bold;">
              <td style="padding: 6px 0;">TOTAL AKTIVA</td>
              <td style="text-align: right; font-family: monospace; font-size: 12px; color: #047857;">${formatRupiah(totalAktiva)}</td>
            </tr>
          </table>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
            PASIVA (KEWAJIBAN & EKUITAS)
          </h4>
          <table style="width: 100%; font-size: 11px;">
            <tr style="font-weight: bold; color: #475569;"><td colspan="2" style="padding-top: 2px;">I. KEWAJIBAN (LIABILITAS)</td></tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">1. Simpanan Berjangka (Bilyet 6% p.a.)</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(simpananBerjangka)}</td>
            </tr>
            <tr style="font-weight: bold; color: #475569;"><td colspan="2" style="padding-top: 6px;">II. EKUITAS (MODAL SENDIRI & SHU)</td></tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">2. Modal Anggota (Simpanan Pokok)</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(simpananPokok)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">3. Modal Anggota (Simpanan Wajib)</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(simpananWajib)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">4. Modal Awal Pendirian Koperasi</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(modalAwal)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">5. Cadangan Modal Koperasi</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(0)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">6. Realisasi SHU Tahun Berjalan Riil</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(shuTahunBerjalan)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 1px 0 3px 18px; font-size: 9px; color: #64748b; font-style: italic;">
                *Rincian Hasil Usaha: Laba Unit Usaha (${formatRupiah(labaUnitUsaha)}) + Jasa Pinjaman (${formatRupiah(pendapatanJasa)}) - Beban (${formatRupiah(summary.totalExpenses || 0)})
              </td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1; font-weight: bold;">
              <td style="padding: 6px 0;">TOTAL PASIVA & MODAL</td>
              <td style="text-align: right; font-family: monospace; font-size: 12px; color: #047857;">${formatRupiah(totalPasiva)}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="padding: 8px 12px; background: ${isBalanced && totalAktiva > 0 ? '#ecfdf5' : '#fffbeb'}; border: 1px solid ${isBalanced && totalAktiva > 0 ? '#a7f3d0' : '#fde68a'}; border-radius: 6px; text-align: center; font-size: 11px; font-weight: bold; color: ${isBalanced && totalAktiva > 0 ? '#065f46' : '#92400e'}; margin-bottom: 20px;">
        ${isBalanced && totalAktiva > 0
          ? `STATUS PERSAMAAN AKUNTANSI SAK ETAP: REKONSILIASI LENGKAP & SEIMBANG (Total Aktiva = Total Pasiva = ${formatRupiah(totalAktiva)})`
          : totalAktiva > 0
          ? `STATUS PERSAMAAN AKUNTANSI: REKONSILIASI PARSIAL (Kas/Bank Terverifikasi = ${formatRupiah(totalAktiva)}, Total Simpanan = ${formatRupiah(totalPasiva)}, Selisih Historis Terbuka = ${formatRupiah(selisihNeraca)})`
          : `STATUS PERSAMAAN AKUNTANSI: MENUNGGU PENYELESAIAN REKONSILIASI HISTORIS (Total Aktiva = ${formatRupiah(totalAktiva)}, Total Pasiva = ${formatRupiah(totalPasiva)}, Selisih = ${formatRupiah(selisihNeraca)})`
        }
      </div>

      <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
        <div>
          <p style="margin: 0; font-weight: bold;">Ketua Koperasi,</p>
          <div style="height: 45px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">MOH. FERY AFRUDIN, S.STP</span>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold;">Sekretaris,</p>
          <div style="height: 45px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">DURITA, SH., MM.</span>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold;">Bendahara,</p>
          <div style="height: 45px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">DEDI SUDARMAN, SH., MM.</span>
        </div>
      </div>
    `;
    printHtmlContent(html, `Laporan-Neraca-Keuangan-KSP-BJS`);
  };

  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      members,
      savings,
      loans,
      repayments,
      cashFlow,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `KSP_BramaJayaSejahtera_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.members && parsed.savings && parsed.loans) {
          onImportData(parsed);
          alert('Data pembukuan koperasi berhasil dipulihkan!');
        } else {
          alert('Format berkas cadangan tidak sesuai!');
        }
      } catch (err) {
        alert('Gagal membaca berkas JSON cadangan.');
      }
    };
    reader.readAsText(file);
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingExpense) return;

    if (expenseForm.amount <= 0 || !expenseForm.description.trim()) {
      alert('Silakan masukkan nominal yang valid (> 0) dan isi uraian transaksi.');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const res = await onAddCashFlow({
        date: expenseForm.date,
        type: expenseForm.type,
        category: expenseForm.category,
        targetAccount: expenseForm.targetAccount,
        amount: expenseForm.amount,
        referenceId: `${expenseForm.type === 'masuk' ? 'BM' : 'BK'}-${Date.now().toString().slice(-4)}`,
        description: expenseForm.description.trim(),
      });

      if (res && typeof res === 'object' && res.success === false) {
        return;
      }

      setIsAddExpenseModalOpen(false);
      setExpenseForm({
        type: 'keluar',
        category: 'operasional',
        targetAccount: 'kas_koperasi',
        amount: 100000,
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Print Header for Physical Printouts */}
      <div className="hidden print:flex items-center justify-between pb-4 mb-4 border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src="/logo-bjs.png"
            alt="Logo BJS"
            className="w-14 h-14 object-contain"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              KOPERASI BRAMA JAYA SEJAHTERA
            </h1>
            <p className="text-[11px] text-blue-900 font-bold tracking-wide">
              BJS DIGITAL • BERSAMA MAJU SEJAHTERA
            </p>
            <p className="text-[10px] text-slate-500">
              Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK ETAP
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          <p className="font-bold text-xs text-slate-900">LAPORAN KEUANGAN & PEMBUKUAN</p>
          <p>Tanggal Cetak: {formatDateIndo(new Date().toISOString())}</p>
          <p className="text-[10px] text-slate-400">Dokumen Sah & Resmi Koperasi</p>
        </div>
      </div>

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
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2.5 shadow-2xs animate-pulse">
          <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Mengambil data buku kas dari tabel Supabase PostgreSQL...</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              Laporan Keuangan & Pembukuan Kas Koperasi
            </h2>
            {isFromSupabase ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                Supabase PostgreSQL ({cashFlow.length} Mutasi)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                Cadangan Lokal ({cashFlow.length} Mutasi)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Neraca ringkas, arus kas mutasi keuangan, dan pencadangan data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintNeracaPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
            title="Unduh Laporan Neraca & Keuangan Resmi dalam format PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Unduh PDF Neraca</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Cadangkan (Backup JSON)
          </button>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Pulihkan Data</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
          <button
            onClick={() => {
              if (confirm('Kembalikan semua data ke setelan demo awal? Semua perubahan baru akan diganti.')) {
                onResetData();
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Reset ke Data Awal Demo"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* NERACA RINGKAS KOPERASI SESUAI STANDAR SAK ETAP */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-700" />
              Neraca Posisi Keuangan Koperasi (Standar SAK ETAP Koperasi)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Struktur permodalan, kewajiban titipan anggota, piutang, dan kas sesuai kaidah akuntansi koperasi
            </p>
          </div>
          {/* Status Balance Pill & Rekonsiliasi Action */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isAnggota && (
              <button
                type="button"
                onClick={() => setIsReconModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-blue-300" />
                <span>Rekonsiliasi Saldo Awal</span>
              </button>
            )}
            {isBalanced && totalAktiva > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Status: Rekonsiliasi Lengkap & Seimbang (Selisih: Rp 0)</span>
              </div>
            ) : totalAktiva > 0 ? (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold border border-blue-300"
                title="Kas/Bank terverifikasi sebagian, selisih historis terbuka menunggu kelengkapan bukti pengurus"
              >
                <Scale className="w-4 h-4 text-blue-600" />
                <span>Status: Rekonsiliasi Parsial (Kas/Bank: {formatRupiah(totalAktiva)}, Selisih: {formatRupiah(selisihNeraca)})</span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300"
                title="Buku kas fisik (cash_flow_records) belum mencatat saldo penerimaan simpanan"
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Status: Menunggu Penyelesaian Rekonsiliasi Historis (Selisih: {formatRupiah(selisihNeraca)})</span>
              </div>
            )}
          </div>
        </div>

        {!isBalanced && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Kondisi Rekonsiliasi Pembukuan Neraca:</p>
              <p className="text-slate-700 leading-relaxed">
                Data simpanan anggota di tabel <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200 text-slate-800">savings_transactions</code> tercatat sebesar <strong>{formatRupiah(summary.totalSavings.total)}</strong>.
                {totalAktiva > 0 ? (
                  <span> Kas & Bank yang telah diverifikasi resmi sebesar <strong>{formatRupiah(totalAktiva)}</strong>. Selisih historis sebesar <strong>{formatRupiah(Math.abs(selisihNeraca))}</strong> tidak diakui sebagai aset fiktif, melainkan menunggu kelengkapan bukti inventaris fisik atau keputusan RAT.</span>
                ) : (
                  <span> Pada tabel buku kas <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200 text-slate-800">cash_flow_records</code>, mutasi saldo kas penerimaan simpanan belum dimasukkan (0 transaksi). Sesuai kaidah akuntansi yang jujur, sistem tidak memaksakan penyeimbang artifisial ke pos SHU atau aset fiktif.</span>
                )}
              </p>
              {reconciliationData && (
                <div className="mt-1.5 pt-1.5 border-t border-amber-200 text-[11px] text-amber-950 font-medium">
                  Status Rekonsiliasi: <strong>{reconciliationData.status.toUpperCase()}</strong> | No. BA: <strong>{reconciliationData.baNumber || '-'}</strong> | Total Terverifikasi: <strong>{formatRupiah(reconciliationData.totalVerified)}</strong> (Bank: {formatRupiah(reconciliationData.verifiedBank)}, Kas: {formatRupiah(reconciliationData.verifiedCash)})
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Sisi Aktiva (Aset & Harta) */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  AKTIVA (HARTA & ASET)
                </h4>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {formatRupiah(totalAktiva)}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-white border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">1. Kas dan Bank:</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(kasKoperasi)}</span>
                  </div>
                  <div className="pl-3 space-y-1.5 border-l-2 border-emerald-500 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">1a. Kas Tunai Fisik:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatRupiah(kasTunaiFisik)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">1b. Kas di Bank:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatRupiah(kasDiBank)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>Total Kas & Bank:</span>
                    <span className="font-mono font-bold text-emerald-800">{formatRupiah(kasKoperasi)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-slate-100">
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">2. Piutang Pinjaman Anggota (Sisa Pokok):</div>
                    <div className="text-[10px] text-slate-400">Plafon aktif {formatRupiah(summary.totalDisbursedLoans)}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-xs">{formatRupiah(piutangPinjaman)}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900 text-sm bg-white p-2.5 rounded-lg">
              <span>TOTAL AKTIVA:</span>
              <span className="font-mono text-emerald-800 font-black">{formatRupiah(totalAktiva)}</span>
            </div>
          </div>

          {/* Sisi Pasiva (Kewajiban & Ekuitas Modal) */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  PASIVA (KEWAJIBAN & EKUITAS)
                </h4>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {formatRupiah(totalPasiva)}
                </span>
              </div>

              <div className="space-y-2">
                {/* Bagian I: Kewajiban (Liabilitas) */}
                <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center justify-between border-b border-blue-100 pb-1 pt-1">
                  <span>I. Kewajiban (Liabilitas / Titipan Anggota):</span>
                  <span className="font-mono font-semibold">{formatRupiah(totalKewajiban)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">1. Simpanan Berjangka (Bilyet 6% p.a.):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatRupiah(simpananBerjangka)}</span>
                </div>

                {/* Bagian II: Ekuitas / Modal Sendiri */}
                <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center justify-between border-b border-blue-100 pb-1 pt-2">
                  <span>II. Ekuitas (Modal Sendiri & SHU):</span>
                  <span className="font-mono font-semibold">{formatRupiah(totalEkuitas)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">2. Modal Sendiri (Simpanan Pokok):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatRupiah(simpananPokok)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">3. Modal Sendiri (Simpanan Wajib):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatRupiah(simpananWajib)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">4. Modal Awal Pendirian Koperasi:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatRupiah(modalAwal)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">5. Cadangan Modal Koperasi:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatRupiah(0)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">6. Realisasi SHU Tahun Berjalan (Riil):</span>
                  <span className="font-mono font-semibold text-emerald-800">{formatRupiah(shuTahunBerjalan)}</span>
                </div>
                <div className="text-[10px] text-slate-400 pl-4 italic">
                  *Rincian: Laba Unit Usaha ({formatRupiah(labaUnitUsaha)}) + Pendapatan Jasa ({formatRupiah(pendapatanJasa)}) - Beban ({formatRupiah(summary.totalExpenses || 0)})
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900 text-sm bg-white p-2.5 rounded-lg">
              <span>TOTAL PASIVA & MODAL:</span>
              <span className="font-mono text-emerald-800 font-black">{formatRupiah(totalPasiva)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BUKU ARUS KAS MUTASI */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Buku Mutasi Kas (Cash Flow)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencatatan uang masuk dan keluar operasional koperasi
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setFilterType('semua')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterType === 'semua' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType('masuk')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterType === 'masuk' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Kas Masuk
              </button>
              <button
                onClick={() => setFilterType('keluar')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterType === 'keluar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Kas Keluar
              </button>
            </div>

            <button
              onClick={() => setIsAddExpenseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              + Catat Beban / Operasional
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Tanggal & Ref</th>
                <th className="px-5 py-3.5">Uraian / Deskripsi</th>
                <th className="px-5 py-3.5">Kategori</th>
                <th className="px-5 py-3.5 text-right">Kas Masuk (+)</th>
                <th className="px-5 py-3.5 text-right">Kas Keluar (-)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCashFlow.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    Tidak ada data mutasi kas.
                  </td>
                </tr>
              ) : (
                filteredCashFlow.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{formatDateIndo(item.date)}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{item.referenceId}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium max-w-sm">
                      <div>{item.description}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.targetAccount === 'kas_bank'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {item.targetAccount === 'kas_bank' ? '🏦 Kas Bank' : '💵 Kas Fisik'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.category === 'saldo_awal' ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.type === 'keluar'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-900 border border-blue-200'
                        }`}>
                          {item.type === 'keluar' ? 'Reversal Saldo Awal' : 'Saldo Awal Terverifikasi'}
                        </span>
                      ) : (
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {item.category.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-700">
                      {item.type === 'masuk' ? formatRupiah(item.amount) : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-700">
                      {item.type === 'keluar' ? formatRupiah(item.amount) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-mono text-xs font-bold">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right font-sans">
                  Total Mutasi:
                </td>
                <td className="px-5 py-3 text-right text-emerald-700">
                  +{formatRupiah(totalMasuk)}
                </td>
                <td className="px-5 py-3 text-right text-rose-700">
                  -{formatRupiah(totalKeluar)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MODAL: CATAT BIAYA OPERASIONAL / TRANSAKSI KAS */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Catat Mutasi Kas Operasional</h3>
              <button
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Arah Arus Kas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, type: 'keluar' })}
                    className={`py-2 rounded-lg font-semibold border transition cursor-pointer text-center ${
                      expenseForm.type === 'keluar'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Pengeluaran / Beban (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, type: 'masuk' })}
                    className={`py-2 rounded-lg font-semibold border transition cursor-pointer text-center ${
                      expenseForm.type === 'masuk'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Pemasukan Kas (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Akun Kas (Pemisahan Kas Fisik vs Bank)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, targetAccount: 'kas_koperasi' })}
                    className={`py-2 px-3 rounded-lg font-semibold border transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                      expenseForm.targetAccount === 'kas_koperasi'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>💵</span>
                    <span>Kas Tunai Fisik</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, targetAccount: 'kas_bank' })}
                    className={`py-2 px-3 rounded-lg font-semibold border transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                      expenseForm.targetAccount === 'kas_bank'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>🏦</span>
                    <span>Kas di Bank</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {expenseForm.targetAccount === 'kas_bank'
                    ? 'Mutasi akan mempengaruhi saldo Kas di Bank (Rekening BJS)'
                    : 'Mutasi akan mempengaruhi saldo Kas Tunai Fisik (Brankas Koperasi)'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Transaksi</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white font-medium"
                >
                  {expenseForm.type === 'keluar' ? (
                    <>
                      <option value="operasional">Beban Operasional & ATK Koperasi</option>
                      <option value="operasional_sp">Beban Operasional Unit Simpan Pinjam</option>
                    </>
                  ) : (
                    <>
                      <option value="operasional">Pendapatan Operasional Lainnya</option>
                      <option value="biaya_admin">Pendapatan Biaya Administrasi</option>
                      <option value="unit_usaha">Setoran Pendapatan Unit Usaha</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  min={1}
                  step={1000}
                  required
                  value={expenseForm.amount || ''}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-3 py-2 font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian / Keterangan</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Pembelian buku kwitansi, tinta stempel, konsumsi rapat..."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmittingExpense}
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense || expenseForm.amount <= 0 || !expenseForm.description.trim()}
                  className="px-5 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmittingExpense ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Mutasi Kas</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL REKONSILIASI SALDO AWAL */}
      {!isAnggota && (
        <RekonsiliasiModal
          isOpen={isReconModalOpen}
          onClose={() => setIsReconModalOpen(false)}
          historicalSavings={summary.totalSavings.total}
          currentReconciliation={reconciliationData}
          onSuccess={handleReconSuccess}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
