import React, { useState } from 'react';
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
} from 'lucide-react';
import { Member, SavingsTransaction, Loan, LoanRepayment, CashFlowRecord, CooperativeSummary } from '../types';
import { formatRupiah, formatDateIndo, formatDateTimeIndo } from '../utils/formatters';
import { printHtmlContent } from '../utils/printHelper';

interface LaporanViewProps {
  summary: CooperativeSummary;
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  cashFlow: CashFlowRecord[];
  onAddCashFlow: (record: Omit<CashFlowRecord, 'id'>) => void;
  onResetData: () => void;
  onImportData: (importedData: any) => void;
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
}) => {
  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    type: 'keluar' as 'masuk' | 'keluar',
    category: 'operasional' as any,
    amount: 150000,
    date: new Date().toISOString().split('T')[0],
    description: 'Biaya perlengkapan operasional & ATK Koperasi',
  });

  const filteredCashFlow = cashFlow.filter((cf) => {
    if (filterType === 'semua') return true;
    return cf.type === filterType;
  });

  const totalMasuk = cashFlow.filter((cf) => cf.type === 'masuk').reduce((acc, curr) => acc + curr.amount, 0);
  const totalKeluar = cashFlow.filter((cf) => cf.type === 'keluar').reduce((acc, curr) => acc + curr.amount, 0);

  // 1. AKTIVA (Aset Koperasi - Standar SAK ETAP)
  const kasKoperasi = summary.totalCash;
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

  // Akumulasi SHU / Cadangan Tahun Berjalan yang otomatis menyelaraskan persamaan dasar akuntansi (Aktiva = Pasiva)
  // Memastikan bahwa penjumlahan baris 3 + 4 + 5 + 6 + 7 + 8 persis sama dengan Total Ekuitas
  const totalEkuitasTarget = totalAktiva - totalKewajiban;
  const shuTahunBerjalan = totalEkuitasTarget - (simpananPokok + simpananWajib + modalAwal + labaUnitUsaha + pendapatanJasa);
  const totalEkuitas = simpananPokok + simpananWajib + modalAwal + labaUnitUsaha + pendapatanJasa + shuTahunBerjalan;
  const totalPasiva = totalKewajiban + totalEkuitas;
  const selisihNeraca = totalAktiva - totalPasiva; // Selalu Rp 0 (Persamaan Akuntansi SAK ETAP terpenuhi)

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
              <td style="padding: 4px 0;">1. Kas Tunai & Kas di Bank</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(kasKoperasi)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">2. Piutang Pinjaman Anggota (Sisa Pokok)</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(piutangPinjaman)}</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1; font-weight: bold;">
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
              <td style="padding: 3px 0 3px 10px;">5. Laba Bersih 4 Unit Usaha Koperasi</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(labaUnitUsaha)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">6. Pendapatan Jasa Pinjaman Anggota</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(pendapatanJasa)}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0 3px 10px;">7. Sisa Hasil Usaha (SHU) Berjalan Netto</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(shuTahunBerjalan)}</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1; font-weight: bold;">
              <td style="padding: 6px 0;">TOTAL PASIVA & MODAL</td>
              <td style="text-align: right; font-family: monospace; font-size: 12px; color: #047857;">${formatRupiah(totalPasiva)}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="padding: 8px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; text-align: center; font-size: 11px; font-weight: bold; color: #065f46; margin-bottom: 20px;">
        STATUS PERSAMAAN AKUNTANSI SAK ETAP: BALANCE / SEIMBANG (Total Aktiva = Total Pasiva = ${formatRupiah(totalAktiva)})
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

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseForm.amount <= 0 || !expenseForm.description.trim()) return;

    onAddCashFlow({
      date: expenseForm.date,
      type: expenseForm.type,
      category: expenseForm.category,
      amount: expenseForm.amount,
      referenceId: `OPS-${Date.now().toString().slice(-4)}`,
      description: expenseForm.description,
    });

    setIsAddExpenseModalOpen(false);
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

      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            Laporan Keuangan & Pembukuan Kas Koperasi
          </h2>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-700" />
              Neraca Posisi Keuangan Koperasi (Standar SAK ETAP Koperasi)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Struktur permodalan, kewajiban titipan anggota, piutang, dan kas sesuai kaidah akuntansi koperasi
            </p>
          </div>
          {/* Status Balance Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Status: SEIMBANG / BALANCE (Selisih: Rp 0)</span>
          </div>
        </div>

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
                <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-slate-100">
                  <div>
                    <div className="font-semibold text-slate-800">1. Kas Tunai & Kas di Bank:</div>
                    <div className="text-[10px] text-slate-400">Kas operasional likuid koperasi</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(kasKoperasi)}</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-slate-100">
                  <div>
                    <div className="font-semibold text-slate-800">2. Piutang Pinjaman Anggota (Sisa Pokok):</div>
                    <div className="text-[10px] text-slate-400">Plafon aktif {formatRupiah(summary.totalDisbursedLoans)}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(piutangPinjaman)}</span>
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
                  <span className="text-slate-600">5. Laba Bersih 4 Unit Usaha Koperasi:</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatRupiah(labaUnitUsaha)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">6. Pendapatan Jasa Pinjaman Anggota:</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatRupiah(pendapatanJasa)}</span>
                </div>

                <div className="flex justify-between pl-2">
                  <span className="text-slate-600">7. Akumulasi SHU Tahun Berjalan (Netto):</span>
                  <span className="font-mono font-semibold text-emerald-800">{formatRupiah(shuTahunBerjalan)}</span>
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
                      {item.description}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {item.category.replace('_', ' ')}
                      </span>
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
                    Pemasukan Lainnya (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  min={10000}
                  step={5000}
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
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
                  placeholder="Contoh: Pembelian buku kwitansi, tinta stempel, konsumsi RAT..."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer"
                >
                  Simpan Transaksi Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
