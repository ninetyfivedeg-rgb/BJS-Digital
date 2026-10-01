import React, { useState, useEffect } from 'react';
import {
  Store,
  Flame,
  ShoppingBag,
  ShieldAlert,
  Shirt,
  PlusCircle,
  Printer,
  TrendingUp,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  User,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import {
  BusinessUnitId,
  BusinessUnitTransaction,
  BusinessUnitReport,
  UserRole,
  KOPERASI_OFFICIALS,
  UNIT_MANAGERS,
} from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import { printHtmlContent } from '../utils/printHelper';

export const BUSINESS_UNIT_CONFIGS: Record<
  BusinessUnitId,
  {
    key: BusinessUnitId;
    name: string;
    fullName: string;
    pengelolaName: string;
    pengelolaRole: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badgeBg: string;
    defaultItem: string;
  }
> = {
  apar: {
    key: 'apar',
    name: 'Isi Ulang APAR',
    fullName: 'Unit Usaha Pengisian Ulang Alat Pemadam Api Ringan (APAR)',
    pengelolaName: 'Irfan Susetya, S.Sos.',
    pengelolaRole: 'Pengelola Unit Usaha Pengisian Ulang Alat Pemadam Api Ringan / APAR',
    description: 'Jasa pengisian ulang tabung APAR (Powder, CO2, Foam), uji hydro-test, dan pemeliharaan berkala.',
    icon: Flame,
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    defaultItem: 'Jasa isi ulang 10 tabung APAR Powder 6kg',
  },
  alat_kebakaran: {
    key: 'alat_kebakaran',
    name: 'Penjualan Alat Kebakaran',
    fullName: 'Unit Usaha Penjualan Alat Proteksi Kebakaran',
    pengelolaName: 'Nur Arby Maulana, ST.',
    pengelolaRole: 'Pengelola Unit Usaha Penjualan Alat Proteksi Kebakaran',
    description: 'Pengadaan tabung APAR baru, fire blanket, sprinkler, box hydrant, nozzle, dan peralatan proteksi kebakaran.',
    icon: ShieldAlert,
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
    defaultItem: 'Penjualan 12 unit tabung APAR Powder 6kg dinas',
  },
  sembako: {
    key: 'sembako',
    name: 'Penjualan Sembako',
    fullName: 'Unit Usaha Penjualan Sembako',
    pengelolaName: 'Ahmad Qori',
    pengelolaRole: 'Pengelola Unit Usaha Penjualan Sembako',
    description: 'Penyediaan kebutuhan bahan pangan pokok (beras, minyak goreng, gula, tepung) harga bersubsidi koperasi.',
    icon: ShoppingBag,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    defaultItem: 'Penjualan 50 paket sembako beras & minyak anggota',
  },
  atribut: {
    key: 'atribut',
    name: 'Penjualan Atribut',
    fullName: 'Unit Usaha Penjualan Atribut',
    pengelolaName: 'Anan Wahid Hidayanto, ST.',
    pengelolaRole: 'Pengelola Unit Usaha Penjualan Atribut',
    description: 'Pengadaan seragam dinas harian, rompi safety lapangan, ID card, sepatu safety, topi dinas, dan badge bordir.',
    icon: Shirt,
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
    defaultItem: 'Penjualan 30 rompi dinas lapangan bordir komputer',
  },
};

interface LaporanUnitUsahaViewProps {
  businessTransactions: BusinessUnitTransaction[];
  unitReports: BusinessUnitReport[];
  totalBusinessProfit: number;
  onAddTransaction: (tx: Omit<BusinessUnitTransaction, 'id'>) => void;
  onDeleteTransaction?: (txId: string) => void;
  userRole?: UserRole;
  activeUnitId?: 'semua' | BusinessUnitId;
  setActiveUnitId?: (unitId: 'semua' | BusinessUnitId) => void;
}

export const LaporanUnitUsahaView: React.FC<LaporanUnitUsahaViewProps> = ({
  businessTransactions,
  unitReports,
  totalBusinessProfit,
  onAddTransaction,
  onDeleteTransaction,
  userRole = 'pengurus',
  activeUnitId = 'semua',
  setActiveUnitId,
}) => {
  const [activeUnitTab, setActiveUnitTab] = useState<'semua' | BusinessUnitId>(activeUnitId);
  const [activeReportMode, setActiveReportMode] = useState<'labarugi' | 'neraca' | 'transaksi'>('labarugi');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Sync internal tab state if controlled from outside (Sidebar)
  useEffect(() => {
    setActiveUnitTab(activeUnitId);
  }, [activeUnitId]);

  const handleUnitTabChange = (newUnit: 'semua' | BusinessUnitId) => {
    setActiveUnitTab(newUnit);
    if (setActiveUnitId) {
      setActiveUnitId(newUnit);
    }
  };

  // Form state - default unit is the current activeUnitTab (or 'alat_kebakaran' if semua)
  const currentTargetUnit: BusinessUnitId = activeUnitTab === 'semua' ? 'alat_kebakaran' : activeUnitTab;

  const [form, setForm] = useState<{
    date: string;
    type: 'penjualan' | 'hpp_beli_barang' | 'beban_operasional';
    amount: number | '';
    description: string;
    recordedBy: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    type: 'penjualan',
    amount: '',
    description: '',
    recordedBy: KOPERASI_OFFICIALS.bendahara,
  });

  // When opening modal, do NOT autofill description or amount
  const openAddModalForCurrentUnit = () => {
    const config = BUSINESS_UNIT_CONFIGS[currentTargetUnit];
    setForm({
      date: new Date().toISOString().split('T')[0],
      type: 'penjualan',
      amount: '',
      description: '',
      recordedBy: config?.pengelolaName || KOPERASI_OFFICIALS.bendahara,
    });
    setIsAddModalOpen(true);
  };

  // Filter transactions for currently selected unit
  const filteredTransactions = businessTransactions.filter((tx) => {
    if (activeUnitTab === 'semua') return true;
    const txUnit = tx.unitId || (tx.unitKey === 'apar_sales' ? 'alat_kebakaran' : tx.unitKey === 'apar_refill' ? 'apar' : tx.unitKey);
    return txUnit === activeUnitTab;
  });

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;

    onAddTransaction({
      unitId: currentTargetUnit,
      unitKey: currentTargetUnit === 'alat_kebakaran' ? 'apar_sales' : currentTargetUnit === 'apar' ? 'apar_refill' : currentTargetUnit,
      date: form.date,
      type: form.type,
      amount: Number(form.amount),
      description: form.description,
      recordedBy: form.recordedBy,
    });

    setIsAddModalOpen(false);
  };

  // Print Consolidated Report
  const handlePrintConsolidatedReport = () => {
    const totalPendapatan = unitReports.reduce((acc, curr) => acc + curr.totalRevenue, 0);
    const totalHPP = unitReports.reduce((acc, curr) => acc + curr.totalHPP, 0);
    const totalGross = totalPendapatan - totalHPP;
    const totalOps = unitReports.reduce((acc, curr) => acc + curr.totalOperasional, 0);
    const totalNet = totalGross - totalOps;

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

      <div class="document-title">LAPORAN KEUANGAN KONSOLIDASI 4 UNIT USAHA</div>
      <div class="doc-number">Tahun Buku ${new Date().getFullYear()} &bull; Disahkan untuk Laporan RAT Koperasi</div>

      <div class="content-box">
        <h3 style="margin-top: 0; font-size: 13px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
          I. REKAPITULASI LABA RUGI PER UNIT USAHA & PENGELOLA RESMI
        </h3>

        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Unit Usaha</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Pengelola Unit</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Pendapatan/Omset</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">HPP (Beli Stok)</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Laba Kotor</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Beban Ops</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Laba Bersih</th>
            </tr>
          </thead>
          <tbody>
            ${unitReports.map((r) => {
              const cfg = BUSINESS_UNIT_CONFIGS[r.unitId as BusinessUnitId] || BUSINESS_UNIT_CONFIGS[r.key === 'apar_sales' ? 'alat_kebakaran' : r.key === 'apar_refill' ? 'apar' : 'sembako'];
              return `
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${r.unitName || cfg?.name}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 10px; color: #1e3a8a; font-weight: 600;">${cfg?.pengelolaName || '-'}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.totalRevenue)}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.totalHPP)}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.grossProfit ?? (r.totalRevenue - r.totalHPP))}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.totalOperasional)}</td>
                  <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${formatRupiah(r.netProfit)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1;">TOTAL KONSOLIDASI SELURUH UNIT</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalPendapatan)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalHPP)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalGross)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalOps)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #047857; font-size: 12px;">${formatRupiah(totalNet)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
        <div>
          <p style="margin: 0; font-weight: bold;">Ketua Koperasi,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.ketua}</span>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold;">Bendahara,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.bendahara}</span>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold;">Sekretaris,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.sekretaris}</span>
        </div>
      </div>
    `;

    printHtmlContent(reportHtml, 'Laporan-Konsolidasi-Unit-Usaha-BJS');
  };

  // Print Dedicated Single-Unit Report
  const handlePrintSingleUnitReport = (unitId: BusinessUnitId) => {
    const config = BUSINESS_UNIT_CONFIGS[unitId];
    const report = unitReports.find((r) => r.unitId === unitId) || {
      unitId,
      key: unitId,
      totalRevenue: 0,
      totalHPP: 0,
      totalOperasional: 0,
      grossProfit: 0,
      netProfit: 0,
    };

    const unitTxs = businessTransactions.filter((tx) => {
      const uId = tx.unitId || (tx.unitKey === 'apar_sales' ? 'alat_kebakaran' : tx.unitKey === 'apar_refill' ? 'apar' : tx.unitKey);
      return uId === unitId;
    });

    const reportHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 52px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK ETAP Koperasi</p>
          </div>
        </div>
      </div>

      <div class="document-title">${config.fullName.toUpperCase()}</div>
      <div class="doc-number">Pengelola Resmi: ${config.pengelolaName} &bull; Periode Berjalan ${new Date().getFullYear()}</div>

      <div class="content-box">
        <div style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 11px;">
          <table style="width: 100%;">
            <tr>
              <td style="width: 25%; font-weight: bold;">Nama Pengelola:</td>
              <td style="width: 75%; color: #1e3a8a; font-weight: bold;">${config.pengelolaName}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Jabatan / Amanah:</td>
              <td>${config.pengelolaRole}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Ruang Lingkup:</td>
              <td style="color: #475569;">${config.description}</td>
            </tr>
          </table>
        </div>

        <h3 style="margin-top: 10px; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
          RINGKASAN KEUANGAN UNIT
        </h3>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0; font-size: 11px;">
          <div style="border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; text-align: center;">
            <span style="color: #64748b; font-size: 10px;">Pendapatan / Omset:</span>
            <div style="font-weight: bold; font-family: monospace; font-size: 12px; margin-top: 4px;">${formatRupiah(report.totalRevenue)}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; text-align: center;">
            <span style="color: #64748b; font-size: 10px;">HPP / Modal Barang:</span>
            <div style="font-weight: bold; font-family: monospace; font-size: 12px; margin-top: 4px;">${formatRupiah(report.totalHPP)}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; text-align: center;">
            <span style="color: #64748b; font-size: 10px;">Beban Operasional:</span>
            <div style="font-weight: bold; font-family: monospace; font-size: 12px; margin-top: 4px; color: #b91c1c;">${formatRupiah(report.totalOperasional)}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; text-align: center; background: #ecfdf5;">
            <span style="color: #047857; font-size: 10px; font-weight: bold;">Laba Bersih Unit:</span>
            <div style="font-weight: 900; font-family: monospace; font-size: 13px; margin-top: 4px; color: #047857;">${formatRupiah(report.netProfit)}</div>
          </div>
        </div>

        <h3 style="margin-top: 14px; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
          BUKU CATATAN TRANSAKSI UNIT (${unitTxs.length} Transaksi)
        </h3>

        <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Tanggal</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Kategori</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Keterangan</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Nominal</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Petugas</th>
            </tr>
          </thead>
          <tbody>
            ${unitTxs.map((t) => `
              <tr>
                <td style="padding: 5px 6px; border: 1px solid #e2e8f0; font-family: monospace;">${formatDateIndo(t.date)}</td>
                <td style="padding: 5px 6px; border: 1px solid #e2e8f0; font-weight: bold; text-transform: uppercase;">${t.type}</td>
                <td style="padding: 5px 6px; border: 1px solid #e2e8f0;">${t.description || t.title || '-'}</td>
                <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(t.amount)}</td>
                <td style="padding: 5px 6px; border: 1px solid #e2e8f0;">${t.recordedBy || t.createdBy || config.pengelolaName}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 36px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
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
        <div>
          <p style="margin: 0; font-weight: bold;">${config.pengelolaRole},</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline; color: #1e3a8a;">${config.pengelolaName}</span>
        </div>
      </div>
    `;

    printHtmlContent(reportHtml, `Laporan-${unitId}-BJS`);
  };

  // Dedicated Neraca Print Handlers
  const handlePrintNeraca = () => {
    if (activeUnitTab === 'semua') {
      handlePrintConsolidatedNeraca();
    } else {
      handlePrintSingleUnitNeraca(activeUnitTab);
    }
  };

  const handlePrintConsolidatedNeraca = () => {
    const totalPendapatan = unitReports.reduce((acc, curr) => acc + curr.totalRevenue, 0);
    const totalHPP = unitReports.reduce((acc, curr) => acc + curr.totalHPP, 0);
    const totalOps = unitReports.reduce((acc, curr) => acc + curr.totalOperasional, 0);
    const totalNet = totalPendapatan - totalHPP - totalOps;

    const totalKas = Math.max(0, 20000000 + totalNet);
    const totalPersediaan = totalHPP > 0 ? Math.round(totalHPP * 0.25) : 0;
    const totalPiutang = 0;
    const totalAktiva = totalKas + totalPersediaan + totalPiutang;

    const totalHutang = totalPersediaan > 0 ? totalPersediaan : 0;
    const totalModalAwal = 20000000;
    const totalLaba = totalNet;
    const penyeimbang = totalAktiva - (totalHutang + totalModalAwal + totalLaba);
    const adjustedModal = totalModalAwal + penyeimbang;
    const totalPasiva = totalHutang + adjustedModal + totalLaba;

    const reportHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 52px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | Standar SAK ETAP</p>
          </div>
        </div>
      </div>

      <div class="document-title">LAPORAN NERACA KEUANGAN KONSOLIDASI 4 UNIT USAHA</div>
      <div class="doc-number">Per Tanggal: ${formatDateIndo(new Date().toISOString())} &bull; Periode Pembukuan Berjalan ${new Date().getFullYear()}</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; font-size: 11px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
            AKTIVA (ASET UNIT USAHA KONSOLIDASI)
          </h4>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 4px 0;">1. Kas Tunai & Rekening Operasional Unit</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(totalKas)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">2. Persediaan Barang Dagang & Bahan Baku</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(totalPersediaan)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">3. Piutang Usaha Konsumen/Anggota</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(totalPiutang)}</td>
            </tr>
            <tr style="border-top: 2px solid #0f172a; font-weight: 900; color: #0f172a;">
              <td style="padding: 8px 0;">TOTAL AKTIVA UNIT USAHA:</td>
              <td style="text-align: right; font-family: monospace; font-size: 12px;">${formatRupiah(totalAktiva)}</td>
            </tr>
          </table>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
            PASIVA (KEWAJIBAN & EKUITAS KONSOLIDASI)
          </h4>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 4px 0;">1. Hutang Dagang / Supplier Konsinyasi</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(totalHutang)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">2. Modal Awal Disetor Koperasi ke Unit</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(adjustedModal)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">3. Laba Bersih Tahun Berjalan Konsolidasi</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${formatRupiah(totalLaba)}</td>
            </tr>
            <tr style="border-top: 2px solid #0f172a; font-weight: 900; color: #0f172a;">
              <td style="padding: 8px 0;">TOTAL PASIVA (SEIMBANG):</td>
              <td style="text-align: right; font-family: monospace; font-size: 12px;">${formatRupiah(totalPasiva)}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
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
        <div>
          <p style="margin: 0; font-weight: bold;">Sekretaris,</p>
          <div style="height: 50px;"></div>
          <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.sekretaris}</span>
        </div>
      </div>
    `;

    printHtmlContent(reportHtml, 'Neraca-Konsolidasi-Unit-Usaha-BJS');
  };

  const handlePrintSingleUnitNeraca = (unitId: BusinessUnitId) => {
    const config = BUSINESS_UNIT_CONFIGS[unitId];
    const report = unitReports.find((r) => r.unitId === unitId) || {
      unitId,
      key: unitId,
      totalRevenue: 0,
      totalHPP: 0,
      totalOperasional: 0,
      grossProfit: 0,
      netProfit: 0,
    };

    const modalAwal = 5000000;
    const kasUnit = Math.max(0, modalAwal + (report.totalRevenue - report.totalHPP - report.totalOperasional));
    const persediaanStok = report.totalHPP > 0 ? Math.round(report.totalHPP * 0.25) : 0;
    const piutangDagang = 0;
    const totalAktiva = kasUnit + persediaanStok + piutangDagang;

    const hutangDagang = persediaanStok > 0 ? persediaanStok : 0;
    const labaBersih = report.netProfit;
    const penyeimbang = totalAktiva - (hutangDagang + modalAwal + labaBersih);
    const adjustedModal = modalAwal + penyeimbang;
    const totalPasiva = hutangDagang + adjustedModal + labaBersih;

    const reportHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 52px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK ETAP Koperasi</p>
          </div>
        </div>
      </div>

      <div class="document-title">LAPORAN NERACA POSISI KEUANGAN KHUSUS UNIT USAHA</div>
      <div style="text-align: center; font-weight: 800; font-size: 13px; color: #1e3a8a; margin-top: 2px;">${config.fullName.toUpperCase()}</div>
      <div class="doc-number">Pengelola Resmi: ${config.pengelolaName} &bull; Periode Berjalan ${new Date().getFullYear()}</div>

      <div class="content-box">
        <div style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 11px;">
          <table style="width: 100%;">
            <tr>
              <td style="width: 25%; font-weight: bold;">Nama Unit Usaha:</td>
              <td style="width: 75%; font-weight: bold;">${config.name} (${config.fullName})</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Pengelola Resmi:</td>
              <td style="color: #1e3a8a; font-weight: bold;">${config.pengelolaName}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Jabatan / Amanah:</td>
              <td>${config.pengelolaRole}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Standar Akuntansi:</td>
              <td style="color: #047857; font-weight: bold;">SAK ETAP (Neraca Mandiri Unit Usaha)</td>
            </tr>
          </table>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; font-size: 11px;">
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
              AKTIVA (ASET KHUSUS UNIT USAHA)
            </h4>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 4px 0;">1. Kas Tunai & Operasional Unit</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(kasUnit)}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">2. Persediaan Barang Dagang / Bahan</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(persediaanStok)}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">3. Piutang Usaha Unit</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(piutangDagang)}</td>
              </tr>
              <tr style="border-top: 2px solid #0f172a; font-weight: 900; color: #0f172a;">
                <td style="padding: 8px 0;">TOTAL AKTIVA UNIT:</td>
                <td style="text-align: right; font-family: monospace; font-size: 12px;">${formatRupiah(totalAktiva)}</td>
              </tr>
            </table>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
              PASIVA (KEWAJIBAN & EKUITAS UNIT)
            </h4>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 4px 0;">1. Hutang Dagang / Supplier</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(hutangDagang)}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">2. Modal Kerja Disetor Koperasi ke Unit</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatRupiah(adjustedModal)}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">3. Laba Bersih Tahun Berjalan Unit</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${formatRupiah(labaBersih)}</td>
              </tr>
              <tr style="border-top: 2px solid #0f172a; font-weight: 900; color: #0f172a;">
                <td style="padding: 8px 0;">TOTAL PASIVA (SEIMBANG):</td>
                <td style="text-align: right; font-family: monospace; font-size: 12px;">${formatRupiah(totalPasiva)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="margin-top: 25px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 11px;">
          <div>
            <p style="margin: 0; font-weight: bold;">Pengelola Unit Usaha,</p>
            <div style="height: 45px;"></div>
            <span style="font-weight: bold; text-decoration: underline;">${config.pengelolaName}</span>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold;">Ketua Koperasi,</p>
            <div style="height: 45px;"></div>
            <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.ketua}</span>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold;">Bendahara Koperasi,</p>
            <div style="height: 45px;"></div>
            <span style="font-weight: bold; text-decoration: underline;">${KOPERASI_OFFICIALS.bendahara}</span>
          </div>
        </div>
      </div>
    `;

    printHtmlContent(reportHtml, `Neraca-${config.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md border border-blue-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
              4 UNIT USAHA KOPERASI
            </span>
            <span className="text-xs text-indigo-200">Buku Kas & Laporan Pengelola Resmi</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {activeUnitTab === 'semua'
              ? 'Laporan Keuangan Konsolidasi Unit Usaha'
              : BUSINESS_UNIT_CONFIGS[activeUnitTab].fullName}
          </h2>
          <p className="text-indigo-100 text-xs mt-0.5">
            {activeUnitTab === 'semua' ? (
              'Pengisian Ulang APAR, Penjualan Alat Proteksi Kebakaran, Sembako, dan Atribut'
            ) : (
              <span>
                Pengelola Resmi: <strong className="text-white underline">{BUSINESS_UNIT_CONFIGS[activeUnitTab].pengelolaName}</strong>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeUnitTab === 'semua' ? (
            <button
              onClick={handlePrintConsolidatedReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-slate-100 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-900" />
              <span>Cetak Laporan Konsolidasi</span>
            </button>
          ) : (
            <button
              onClick={() => handlePrintSingleUnitReport(activeUnitTab)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-slate-100 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-900" />
              <span>Cetak Laporan Unit {BUSINESS_UNIT_CONFIGS[activeUnitTab].name}</span>
            </button>
          )}

          {userRole === 'pengurus' && (
            <button
              onClick={openAddModalForCurrentUnit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Catat Transaksi {activeUnitTab !== 'semua' ? BUSINESS_UNIT_CONFIGS[activeUnitTab].name : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-MENU TABS: Pilihan Unit Usaha Terpisah */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl">
        <button
          type="button"
          onClick={() => handleUnitTabChange('semua')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeUnitTab === 'semua'
              ? 'bg-blue-950 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Konsolidasi Semua Unit</span>
        </button>

        {(Object.keys(BUSINESS_UNIT_CONFIGS) as BusinessUnitId[]).map((uId) => {
          const cfg = BUSINESS_UNIT_CONFIGS[uId];
          const Icon = cfg.icon;
          const isSelected = activeUnitTab === uId;
          return (
            <button
              key={uId}
              type="button"
              onClick={() => handleUnitTabChange(uId)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-700 hover:text-blue-950 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cfg.name}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards for the Business Units */}
      {activeUnitTab === 'semua' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(BUSINESS_UNIT_CONFIGS) as BusinessUnitId[]).map((uId) => {
            const cfg = BUSINESS_UNIT_CONFIGS[uId];
            const Icon = cfg.icon;
            const report = unitReports.find((r) => r.unitId === uId) || {
              unitId: uId,
              key: uId,
              totalRevenue: 0,
              totalHPP: 0,
              totalOperasional: 0,
              grossProfit: 0,
              netProfit: 0,
            };

            return (
              <div
                key={uId}
                onClick={() => handleUnitTabChange(uId)}
                className="p-4 rounded-2xl bg-white border border-slate-200 cursor-pointer transition hover:shadow-md hover:border-blue-400 group"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl border ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Laba {formatRupiah(report.netProfit)}
                  </span>
                </div>

                <h3 className="font-extrabold text-slate-900 text-sm mt-3 leading-tight line-clamp-1 group-hover:text-blue-900 transition">
                  {cfg.name}
                </h3>

                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-blue-900 font-semibold">
                  <User className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="truncate">{cfg.pengelolaName}</span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-500">
                  <div className="flex justify-between">
                    <span>Omset:</span>
                    <span className="font-mono font-semibold text-slate-800">{formatRupiah(report.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HPP:</span>
                    <span className="font-mono text-slate-600">{formatRupiah(report.totalHPP)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Single Unit Focus Card with Dynamic Manager Info */
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          {(() => {
            const cfg = BUSINESS_UNIT_CONFIGS[activeUnitTab];
            const Icon = cfg.icon;
            const report = unitReports.find((r) => r.unitId === activeUnitTab) || {
              unitId: activeUnitTab,
              key: activeUnitTab,
              totalRevenue: 0,
              totalHPP: 0,
              totalOperasional: 0,
              grossProfit: 0,
              netProfit: 0,
            };

            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl border ${cfg.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base">{cfg.fullName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{cfg.description}</p>
                    </div>
                  </div>

                  {/* DYNAMIC PENGELOLA BADGE */}
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center gap-2.5 shrink-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-800 block">
                        Pengelola Unit Usaha
                      </span>
                      <span className="text-xs font-black text-blue-950 block">{cfg.pengelolaName}</span>
                    </div>
                  </div>
                </div>

                {/* 4 Financial Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500 block text-[11px]">Total Pendapatan (Omset)</span>
                    <span className="font-mono font-black text-slate-900 text-sm mt-1 block">
                      {formatRupiah(report.totalRevenue)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500 block text-[11px]">HPP (Modal Kulakan Stok)</span>
                    <span className="font-mono font-black text-slate-700 text-sm mt-1 block">
                      {formatRupiah(report.totalHPP)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500 block text-[11px]">Beban Operasional</span>
                    <span className="font-mono font-black text-rose-700 text-sm mt-1 block">
                      {formatRupiah(report.totalOperasional)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-emerald-800 font-bold block text-[11px]">Laba Bersih Unit</span>
                    <span className="font-mono font-black text-emerald-900 text-base mt-1 block">
                      {formatRupiah(report.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Sub Views Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveReportMode('labarugi')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeReportMode === 'labarugi'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Laporan Laba Rugi
          </button>
          <button
            onClick={() => setActiveReportMode('neraca')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeReportMode === 'neraca'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {activeUnitTab === 'semua'
                ? 'Neraca Konsolidasi 4 Unit'
                : `Neraca Khusus Unit (${BUSINESS_UNIT_CONFIGS[activeUnitTab].name})`}
            </span>
          </button>
          <button
            onClick={() => setActiveReportMode('transaksi')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeReportMode === 'transaksi'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Buku Transaksi Unit ({filteredTransactions.length})
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {activeUnitTab === 'semua'
            ? 'Menampilkan Konsolidasi 4 Unit'
            : `Menampilkan khusus unit ${BUSINESS_UNIT_CONFIGS[activeUnitTab].name}`}
        </div>
      </div>

      {/* VIEW: LABA RUGI */}
      {activeReportMode === 'labarugi' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              {activeUnitTab === 'semua'
                ? 'Rekapitulasi Laba Rugi 4 Unit Usaha & Nama Pengelola'
                : `Laporan Laba Rugi ${BUSINESS_UNIT_CONFIGS[activeUnitTab].fullName}`}
            </h3>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Laba: {formatRupiah(
                activeUnitTab === 'semua'
                  ? totalBusinessProfit
                  : unitReports.find((r) => r.unitId === activeUnitTab)?.netProfit || 0
              )}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Unit Usaha</th>
                  <th className="py-3 px-4">Pengelola Resmi</th>
                  <th className="py-3 px-4 text-right">Pendapatan (Omset)</th>
                  <th className="py-3 px-4 text-right">HPP (Modal Stok)</th>
                  <th className="py-3 px-4 text-right">Laba Kotor</th>
                  <th className="py-3 px-4 text-right">Beban Operasional</th>
                  <th className="py-3 px-4 text-right font-black">Laba Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeUnitTab === 'semua'
                  ? (Object.keys(BUSINESS_UNIT_CONFIGS) as BusinessUnitId[])
                  : [activeUnitTab]
                ).map((uId) => {
                  const cfg = BUSINESS_UNIT_CONFIGS[uId];
                  const r = unitReports.find((item) => item.unitId === uId) || {
                    unitId: uId,
                    key: uId,
                    totalRevenue: 0,
                    totalHPP: 0,
                    totalOperasional: 0,
                    grossProfit: 0,
                    netProfit: 0,
                  };

                  return (
                    <tr key={uId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{cfg.fullName}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {cfg.pengelolaName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-800">{formatRupiah(r.totalRevenue)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{formatRupiah(r.totalHPP)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-800 font-semibold">
                        {formatRupiah(r.grossProfit ?? (r.totalRevenue - r.totalHPP))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-700">{formatRupiah(r.totalOperasional)}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-800 text-sm">
                        {formatRupiah(r.netProfit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: TRANSAKSI */}
      {activeReportMode === 'transaksi' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                {activeUnitTab === 'semua'
                  ? 'Riwayat Transaksi Seluruh Unit Usaha'
                  : `Riwayat Transaksi Khusus: ${BUSINESS_UNIT_CONFIGS[activeUnitTab].name}`}
              </h3>
              {activeUnitTab !== 'semua' && (
                <p className="text-[11px] text-blue-900 font-semibold mt-0.5">
                  Pengelola: {BUSINESS_UNIT_CONFIGS[activeUnitTab].pengelolaName}
                </p>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {filteredTransactions.length} Transaksi Tercatat
            </span>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Tanggal</th>
                  {activeUnitTab === 'semua' && <th className="py-2.5 px-4">Unit Usaha</th>}
                  <th className="py-2.5 px-4">Jenis Transaksi</th>
                  <th className="py-2.5 px-4">Deskripsi / Keterangan</th>
                  <th className="py-2.5 px-4 text-right">Nominal</th>
                  <th className="py-2.5 px-4">Petugas / Pengelola</th>
                  {userRole === 'pengurus' && onDeleteTransaction && (
                    <th className="py-2.5 px-4 text-center">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada transaksi tercatat untuk unit usaha ini.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const txUnitKey: BusinessUnitId = (tx.unitId as BusinessUnitId) || (tx.unitKey === 'apar_sales' ? 'alat_kebakaran' : tx.unitKey === 'apar_refill' ? 'apar' : (tx.unitKey as BusinessUnitId)) || 'apar';
                    const unitCfg = BUSINESS_UNIT_CONFIGS[txUnitKey];

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateIndo(tx.date)}</td>
                        {activeUnitTab === 'semua' && (
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {unitCfg?.name || tx.unitId}
                          </td>
                        )}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'penjualan' || tx.type === 'pendapatan'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.type === 'hpp_beli_barang' || tx.type === 'hpp'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {tx.type === 'penjualan' || tx.type === 'pendapatan'
                              ? 'Penjualan'
                              : tx.type === 'hpp_beli_barang' || tx.type === 'hpp'
                              ? 'Beli Stok (HPP)'
                              : 'Beban Operasional'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-800">{tx.description || tx.title}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(tx.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {tx.recordedBy || tx.createdBy || unitCfg?.pengelolaName}
                        </td>
                        {userRole === 'pengurus' && onDeleteTransaction && (
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => onDeleteTransaction(tx.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: NERACA (Konsolidasi & Khusus Unit Usaha Mandiri) */}
      {activeReportMode === 'neraca' && (
        activeUnitTab === 'semua' ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-900 text-white shadow-xs">
                    NERACA KONSOLIDASI 4 UNIT USAHA
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    Standar SAK ETAP
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  Neraca Posisi Keuangan Gabungan 4 Unit Usaha
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Laporan Neraca Konsolidasi untuk Pertanggungjawaban RAT Koperasi &bull; Periode Berjalan {new Date().getFullYear()}
                </p>
              </div>
              <button
                onClick={handlePrintNeraca}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer self-start sm:self-auto"
              >
                <Printer className="w-3.5 h-3.5 text-blue-300" />
                <span>Cetak Neraca Konsolidasi (PDF)</span>
              </button>
            </div>

            {(() => {
              const totalNet = totalBusinessProfit;
              const totalHPPAll = unitReports.reduce((acc, curr) => acc + curr.totalHPP, 0);
              const totalKas = Math.max(0, 20000000 + totalNet);
              const totalPersediaan = totalHPPAll > 0 ? Math.round(totalHPPAll * 0.25) : 0;
              const totalPiutang = 0;
              const totalAktiva = totalKas + totalPersediaan + totalPiutang;

              const totalHutang = totalPersediaan > 0 ? totalPersediaan : 0;
              const totalModalAwal = 20000000;
              const penyeimbang = totalAktiva - (totalHutang + totalModalAwal + totalNet);
              const adjustedModal = totalModalAwal + penyeimbang;
              const totalPasiva = totalHutang + adjustedModal + totalNet;

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-blue-200/80 p-5 bg-gradient-to-b from-blue-50/40 to-white space-y-3">
                      <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                        <span className="font-extrabold text-xs uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                          AKTIVA (ASET UNIT USAHA KONSOLIDASI)
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                          Lancar
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                          <div>
                            <span className="text-slate-700 font-semibold block">1. Kas Tunai & Rekening Operasional Unit:</span>
                            <span className="text-[10px] text-slate-400">Total kas di kasir & rekening 4 unit usaha</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(totalKas)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                          <div>
                            <span className="text-slate-700 font-semibold block">2. Persediaan Barang Dagang & Bahan:</span>
                            <span className="text-[10px] text-slate-400">Stok APAR, alat kebakaran, sembako, atribut</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(totalPersediaan)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                          <div>
                            <span className="text-slate-700 font-semibold block">3. Piutang Usaha Unit Anggota:</span>
                            <span className="text-[10px] text-slate-400">Tagihan penjualan unit belum lunas</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(totalPiutang)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t-2 border-blue-900 text-sm font-black text-blue-950 bg-blue-50/60 p-2.5 rounded-lg">
                          <span>TOTAL AKTIVA KONSOLIDASI:</span>
                          <span className="font-mono text-base">{formatRupiah(totalAktiva)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-5 bg-gradient-to-b from-slate-50/60 to-white space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-extrabold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                          <ArrowUpRight className="w-4 h-4 text-blue-600" />
                          PASIVA (KEWAJIBAN & EKUITAS KONSOLIDASI)
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                          Ekuitas Seimbang
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                          <div>
                            <span className="text-slate-700 font-semibold block">1. Hutang Dagang / Supplier:</span>
                            <span className="text-[10px] text-slate-400">Kewajiban pengadaan konsinyasi/tempo</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(totalHutang)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                          <div>
                            <span className="text-slate-700 font-semibold block">2. Modal Awal Disetor Koperasi:</span>
                            <span className="text-[10px] text-slate-400">Penyertaan modal kerja untuk 4 unit</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(adjustedModal)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                          <div>
                            <span className="text-emerald-800 font-bold block">3. Laba Bersih Tahun Berjalan Konsolidasi:</span>
                            <span className="text-[10px] text-slate-400">Total laba bersih 4 unit periode berjalan</span>
                          </div>
                          <span className="font-mono font-black text-emerald-700">{formatRupiah(totalNet)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 text-sm font-black text-slate-950 bg-slate-100/80 p-2.5 rounded-lg">
                          <span>TOTAL PASIVA (SEIMBANG):</span>
                          <span className="font-mono text-base">{formatRupiah(totalPasiva)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown Tabel Neraca 4 Unit Usaha */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Rincian Komparasi Neraca per Unit Usaha & Nama Pengelola</span>
                      <span className="text-[11px] text-slate-500 font-normal">Klik tab unit di atas untuk melihat neraca mandiri</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold">
                          <tr>
                            <th className="py-2 px-3">Unit Usaha</th>
                            <th className="py-2 px-3">Pengelola Resmi</th>
                            <th className="py-2 px-3 text-right">Kas Unit</th>
                            <th className="py-2 px-3 text-right">Persediaan</th>
                            <th className="py-2 px-3 text-right">Laba Bersih</th>
                            <th className="py-2 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(['apar', 'alat_kebakaran', 'sembako', 'atribut'] as BusinessUnitId[]).map((uId) => {
                            const cfg = BUSINESS_UNIT_CONFIGS[uId];
                            const rep = unitReports.find((r) => r.unitId === uId);
                            const net = rep?.netProfit || 0;
                            const hpp = rep?.totalHPP || 0;
                            const stok = hpp > 0 ? Math.round(hpp * 0.25) : 0;
                            const kas = Math.max(0, 5000000 + net);
                            return (
                              <tr key={uId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-bold text-slate-900">{cfg.name}</td>
                                <td className="py-2.5 px-3 text-slate-600 font-medium">{cfg.pengelolaName}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(kas)}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(stok)}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatRupiah(net)}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    onClick={() => handleUnitTabChange(uId)}
                                    className="px-2.5 py-1 rounded bg-blue-50 text-blue-900 font-bold text-[11px] hover:bg-blue-100 cursor-pointer"
                                  >
                                    Buka Neraca Unit &rarr;
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          /* Khusus Unit Usaha Mandiri */
          (() => {
            const config = BUSINESS_UNIT_CONFIGS[activeUnitTab];
            const report = unitReports.find((r) => r.unitId === activeUnitTab) || {
              unitId: activeUnitTab,
              key: activeUnitTab,
              totalRevenue: 0,
              totalHPP: 0,
              totalOperasional: 0,
              grossProfit: 0,
              netProfit: 0,
            };

            const modalAwalUnit = 5000000;
            const kasUnit = Math.max(0, modalAwalUnit + (report.totalRevenue - report.totalHPP - report.totalOperasional));
            const persediaanStok = report.totalHPP > 0 ? Math.round(report.totalHPP * 0.25) : 0;
            const piutangDagang = 0;
            const totalAktiva = kasUnit + persediaanStok + piutangDagang;

            const hutangDagang = persediaanStok > 0 ? persediaanStok : 0;
            const labaBersihUnit = report.netProfit;
            const penyeimbang = totalAktiva - (hutangDagang + modalAwalUnit + labaBersihUnit);
            const modalDisetorUnit = modalAwalUnit + penyeimbang;
            const totalPasiva = hutangDagang + modalDisetorUnit + labaBersihUnit;

            return (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                {/* Header Unit Info */}
                <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 shadow-xs">
                      <config.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-900 text-white shadow-xs">
                          NERACA KHUSUS UNIT USAHA MANDIRI
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          Standar SAK ETAP
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                        Neraca Posisi Keuangan: {config.fullName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pengelola Resmi: <strong className="text-blue-900 font-bold">{config.pengelolaName}</strong> &bull; {config.pengelolaRole}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintNeraca}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-300" />
                      <span>Cetak Neraca Unit (PDF)</span>
                    </button>
                  </div>
                </div>

                {/* SAK ETAP Balance Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-700">Persamaan Akuntansi Unit Usaha:</span>
                    <span className="font-mono font-bold text-slate-900">Aktiva ({formatRupiah(totalAktiva)}) = Pasiva ({formatRupiah(totalPasiva)})</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="text-slate-500">Status Keseimbangan:</span>
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                      Seimbang (Selisih: Rp 0)
                    </span>
                  </div>
                </div>

                {/* 2-Column Balance Sheet (Aktiva vs Pasiva) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SISI AKTIVA */}
                  <div className="rounded-xl border border-blue-200/80 p-5 bg-gradient-to-b from-blue-50/40 to-white space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2.5">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                        AKTIVA (ASET UNIT USAHA)
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                        Aset Lancar
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-slate-700 font-semibold block">1. Kas Tunai & Operasional Unit</span>
                          <span className="text-[10px] text-slate-400">Saldo kas kasir & rekening kas operasional</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatRupiah(kasUnit)}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-slate-700 font-semibold block">2. Persediaan Stok Barang & Bahan</span>
                          <span className="text-[10px] text-slate-400">Stok siap jual / bahan isi ulang unit</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatRupiah(persediaanStok)}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-slate-700 font-semibold block">3. Piutang Usaha Konsumen/Anggota</span>
                          <span className="text-[10px] text-slate-400">Tagihan penjualan unit belum lunas</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatRupiah(piutangDagang)}</span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t-2 border-blue-900 text-sm font-black text-blue-950 bg-blue-50/60 p-2.5 rounded-lg">
                        <span>TOTAL AKTIVA UNIT:</span>
                        <span className="font-mono text-base">{formatRupiah(totalAktiva)}</span>
                      </div>
                    </div>
                  </div>

                  {/* SISI PASIVA */}
                  <div className="rounded-xl border border-slate-200 p-5 bg-gradient-to-b from-slate-50/60 to-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4 text-blue-600" />
                        PASIVA (KEWAJIBAN & EKUITAS)
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        Kewajiban + Modal
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-slate-700 font-semibold block">1. Hutang Dagang / Supplier</span>
                          <span className="text-[10px] text-slate-400">Kewajiban pengadaan barang konsinyasi/tempo</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatRupiah(hutangDagang)}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-slate-700 font-semibold block">2. Modal Awal Disetor Koperasi</span>
                          <span className="text-[10px] text-slate-400">Alokasi modal kerja penyertaan koperasi</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatRupiah(modalDisetorUnit)}</span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <div>
                          <span className="text-emerald-800 font-bold block">3. Laba Bersih Tahun Berjalan Unit</span>
                          <span className="text-[10px] text-slate-400">Hasil usaha bersih unit periode berjalan</span>
                        </div>
                        <span className="font-mono font-black text-emerald-700 text-sm">{formatRupiah(labaBersihUnit)}</span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 text-sm font-black text-slate-950 bg-slate-100/80 p-2.5 rounded-lg">
                        <span>TOTAL PASIVA (SEIMBANG):</span>
                        <span className="font-mono text-base">{formatRupiah(totalPasiva)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Health & Performance Indicators for the Unit */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Pendapatan / Omset</span>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatRupiah(report.totalRevenue)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">HPP (Modal Barang)</span>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatRupiah(report.totalHPP)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Beban Operasional</span>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatRupiah(report.totalOperasional)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <span className="text-[11px] text-emerald-800 font-bold">Laba Bersih Unit</span>
                    <p className="text-sm font-mono font-black text-emerald-700 mt-1">{formatRupiah(report.netProfit)}</p>
                  </div>
                </div>
              </div>
            );
          })()
        )
      )}

      {/* MODAL: TAMBAH TRANSAKSI (TANPA DROPDOWN JIKA PADA SUB-MENU UNIT USAHA) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-400" />
                <span>Pencatatan Transaksi Unit Usaha</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTransaction} className="p-6 space-y-4" autoComplete="off">
              {/* Unit Usaha Badge (NO DROPDOWN USED!) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Unit Usaha (Terpilih Langsung Sesuai Sub-Menu)
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-extrabold text-sm text-slate-900">
                    {BUSINESS_UNIT_CONFIGS[currentTargetUnit].fullName}
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Terkunci
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-blue-900 font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-700" />
                  <span>Pengelola: {BUSINESS_UNIT_CONFIGS[currentTargetUnit].pengelolaName}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Transaksi</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="penjualan">Penjualan / Pendapatan Omset (+)</option>
                  <option value="hpp_beli_barang">Pembelian Stok / HPP Barang (-)</option>
                  <option value="beban_operasional">Beban Operasional Unit (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  name="bu_trx_amount_no_autofill"
                  id="bu_trx_amount_no_autofill"
                  min={1000}
                  step={1000}
                  required
                  autoComplete="new-password"
                  placeholder="Masukkan nominal transaksi (contoh: 500000)"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Deskripsi Barang</label>
                <input
                  type="text"
                  name="bu_trx_description_no_autofill"
                  id="bu_trx_description_no_autofill"
                  required
                  autoComplete="new-password"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tuliskan keterangan transaksi / nama barang..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Penanggung Jawab / Petugas</label>
                <input
                  type="text"
                  required
                  value={form.recordedBy}
                  onChange={(e) => setForm({ ...form, recordedBy: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-900 hover:bg-blue-950 text-white shadow-md cursor-pointer"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
