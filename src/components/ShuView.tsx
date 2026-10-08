import React, { useState, useEffect } from 'react';
import {
  Coins,
  Scale,
  Printer,
  Download,
  Calendar,
  Layers,
  ChevronDown,
  TrendingUp,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  Users,
  Search,
  RefreshCw,
  Receipt,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  BusinessUnitReport,
  UserRole,
  AuthUser,
  CooperativeSummary,
  KOPERASI_OFFICIALS,
} from '../types';
import { formatRupiah, formatNumber, formatDateIndo } from '../utils/formatters';
import { printHtmlContent } from '../utils/printHelper';
import { calculateMemberSavings } from '../utils/storage';
import { calculateCooperativeShu, calculateMembersShuDetails } from '../services/shuService';

interface ShuViewProps {
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  repayments: LoanRepayment[];
  businessReports?: BusinessUnitReport[];
  totalBusinessProfit?: number;
  userRole?: UserRole;
  currentUser?: AuthUser | null;
  summary?: CooperativeSummary;
  isFromSupabase?: boolean;
}

// 1. Rekapitulasi Laba Unit Usaha Item
interface UnitLabaItem {
  id: string;
  name: string;
  laba: number;
  perputaranModal: number;
  prosentaseRapb: number; // e.g. 20%
}

// 2. Pos Biaya RAT Item
interface RatExpenseItem {
  id: string;
  uraian: string;
  nominal: number;
  qty: number;
}

// 3. Pos Persentase Pembagian SHU Item
interface ShuDistributionRule {
  id: string;
  uraian: string;
  prosentase: number; // e.g. 40 for 40%
}

const STORAGE_KEY_SHU_LABA = 'bjs_shu_laba_items_v2';
const STORAGE_KEY_SHU_RAT = 'bjs_shu_rat_expenses_v2';
const STORAGE_KEY_SHU_DIST = 'bjs_shu_dist_rules_v2';

export const ShuView: React.FC<ShuViewProps> = ({
  members,
  savings,
  loans,
  repayments,
  businessReports = [],
  totalBusinessProfit = 0,
  userRole = 'pengurus',
  currentUser,
  summary,
  isFromSupabase = false,
}) => {
  const isAnggota = userRole === 'anggota' || currentUser?.role === 'anggota';
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchMember, setSearchMember] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'pasif'>('semua');
  const [activeSubTab, setActiveSubTab] = useState<'rekap' | 'rat' | 'anggota'>('rekap');

  // Single Source of Truth perhitungan SHU dari aktivitas ekonomi riil
  const liveCoopSummary: CooperativeSummary = summary || {
    totalCash: 0,
    totalOperasionalSP: 0,
    totalSavings: { pokok: 0, wajib: 0, berjangka: 0, sukarela: 0, total: 0 },
    totalDisbursedLoans: 0,
    totalOutstandingLoans: 0,
    totalInterestEarned: repayments.reduce((acc, r) => acc + (Number(r.interestAmount) || 0), 0),
    membersCount: { aktif: members.length, pasif: 0, keluar: 0, total: members.length },
    loanWorkflowCount: { diajukan: 0, review: 0, disetujui: 0, dicairkan: 0 },
    businessUnitProfits: {
      alat_kebakaran: 0,
      apar: 0,
      apar_refill: 0,
      apar_sales: 0,
      sembako: 0,
      atribut: 0,
    },
    totalBusinessProfit: totalBusinessProfit || 0,
    modalAwal: 0,
    totalExpenses: 0,
    activeMembersCount: members.length,
    activeLoansCount: 0,
  };

  const shuCalc = calculateCooperativeShu(liveCoopSummary, repayments);

  // Ambil laba riil per unit usaha dari businessReports (tanpa angka fiktif)
  const getInitialProfit = (unitName: string): number => {
    if (unitName.includes('Refill')) {
      const u = businessReports.find((r) => r.key === 'apar_refill' || r.unitId === 'apar');
      return u ? Number(u.netProfit) || 0 : 0;
    }
    if (unitName.includes('Penjualan APAR') || unitName.includes('Alat Kebakaran')) {
      const u = businessReports.find((r) => r.key === 'apar_sales' || r.unitId === 'alat_kebakaran');
      return u ? Number(u.netProfit) || 0 : 0;
    }
    if (unitName.includes('Sembako')) {
      const u = businessReports.find((r) => r.key === 'sembako' || r.unitId === 'sembako');
      return u ? Number(u.netProfit) || 0 : 0;
    }
    if (unitName.includes('Simpan Pinjam')) {
      return repayments.reduce((acc, r) => acc + (Number(r.interestAmount) || 0), 0);
    }
    if (unitName.includes('Atribut')) {
      const u = businessReports.find((r) => r.key === 'atribut' || r.unitId === 'atribut');
      return u ? Number(u.netProfit) || 0 : 0;
    }
    return 0;
  };

  // 1. REKAPITULASI LABA UNIT USAHA & PERPUTARAN MODAL
  const defaultUnitLaba: UnitLabaItem[] = [
    { id: '1', name: 'Refill APAR', laba: getInitialProfit('Refill'), perputaranModal: 0, prosentaseRapb: 20 },
    { id: '2', name: 'Penjualan APAR', laba: getInitialProfit('Penjualan APAR'), perputaranModal: 0, prosentaseRapb: 25 },
    { id: '3', name: 'Penjualan Sembako', laba: getInitialProfit('Sembako'), perputaranModal: 0, prosentaseRapb: 15 },
    { id: '4', name: 'Simpan Pinjam', laba: getInitialProfit('Simpan Pinjam'), perputaranModal: 0, prosentaseRapb: 30 },
    { id: '5', name: 'Penjualan Atribut', laba: getInitialProfit('Atribut'), perputaranModal: 0, prosentaseRapb: 10 },
  ];

  const [unitLabaList, setUnitLabaList] = useState<UnitLabaItem[]>(() => {
    // Jika data berasal dari Supabase dan belum ada aktivitas transaksi, prioritaskan nilai 0 riil
    if (isFromSupabase && !shuCalc.hasOperationalActivity) {
      return defaultUnitLaba;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHU_LABA);
      return saved ? JSON.parse(saved) : defaultUnitLaba;
    } catch {
      return defaultUnitLaba;
    }
  });

  // 2. BIAYA RAT
  const defaultRatExpenses: RatExpenseItem[] = [
    { id: '1', uraian: 'Narasumber', nominal: 1500000, qty: 1 },
    { id: '2', uraian: 'Uang Kebersihan', nominal: 350000, qty: 1 },
    { id: '3', uraian: 'Uang Duduk Peserta RAT', nominal: 100000, qty: members.length || 217 },
    { id: '4', uraian: 'Konsumsi (Nasi Box + Snack)', nominal: 45000, qty: members.length || 217 },
    { id: '5', uraian: 'Banner & Publikasi', nominal: 450000, qty: 1 },
    { id: '6', uraian: 'Cetak Buku Laporan Pertanggungjawaban', nominal: 35000, qty: members.length || 217 },
    { id: '7', uraian: 'Amplop & ATK RAT', nominal: 300000, qty: 1 },
    { id: '8', uraian: 'Uang Pembinaan Organisasi', nominal: 1000000, qty: 1 },
    { id: '9', uraian: 'Tas Parcel / Souvenir Anggota', nominal: 50000, qty: members.length || 217 },
    { id: '10', uraian: 'Pembawa Acara (MC)', nominal: 500000, qty: 1 },
    { id: '11', uraian: 'Pra-RAT / Rapat Pleno Pengurus', nominal: 1200000, qty: 1 },
    { id: '12', uraian: 'Doorprize RAT', nominal: 4500000, qty: 1 },
    { id: '13', uraian: 'THR & Insentif Panitia', nominal: 3000000, qty: 1 },
    { id: '14', uraian: 'Pajak (0,5%)', nominal: 450000, qty: 1 },
  ];

  const [ratExpenses, setRatExpenses] = useState<RatExpenseItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHU_RAT);
      return saved ? JSON.parse(saved) : defaultRatExpenses;
    } catch {
      return defaultRatExpenses;
    }
  });

  // 3. PERSENTASE PEMBAGIAN SHU (Sesuai ART Koperasi)
  const defaultDistRules: ShuDistributionRule[] = [
    { id: '1', uraian: 'Cadangan Modal', prosentase: 30 },
    { id: '2', uraian: 'Pengurus', prosentase: 10 },
    { id: '3', uraian: 'Pengawas', prosentase: 5 },
    { id: '4', uraian: 'Sosial', prosentase: 5 },
    { id: '5', uraian: 'Pendidikan', prosentase: 5 },
    { id: '6', uraian: 'Pembangunan Daerah Kerja', prosentase: 5 },
    { id: '7', uraian: 'Untuk Anggota', prosentase: 40 },
  ];

  const [distRules, setDistRules] = useState<ShuDistributionRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHU_DIST);
      return saved ? JSON.parse(saved) : defaultDistRules;
    } catch {
      return defaultDistRules;
    }
  });

  // Persist edits
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHU_LABA, JSON.stringify(unitLabaList));
  }, [unitLabaList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHU_RAT, JSON.stringify(ratExpenses));
  }, [ratExpenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHU_DIST, JSON.stringify(distRules));
  }, [distRules]);

  // Perhitungan Rekapitulasi Laba Unit Usaha
  const rekapCalculated = unitLabaList.map((item) => {
    const sisaLaba = item.laba - item.perputaranModal;
    const biayaOps = Math.round(sisaLaba * 0.025);
    const untukShu = sisaLaba - biayaOps;
    const rapbNominal = Math.round((untukShu * item.prosentaseRapb) / 100);
    return {
      ...item,
      sisaLaba,
      biayaOps,
      untukShu,
      rapbNominal,
    };
  });

  const totalLabaB = rekapCalculated.reduce((acc, curr) => acc + curr.laba, 0);
  const totalModalC = rekapCalculated.reduce((acc, curr) => acc + curr.perputaranModal, 0);
  const totalSisaLabaD = rekapCalculated.reduce((acc, curr) => acc + curr.sisaLaba, 0);
  const totalBiayaOpsE = rekapCalculated.reduce((acc, curr) => acc + curr.biayaOps, 0);
  const totalUntukShuF = rekapCalculated.reduce((acc, curr) => acc + curr.untukShu, 0);
  const totalRapbH = rekapCalculated.reduce((acc, curr) => acc + curr.rapbNominal, 0);

  // Perhitungan Biaya RAT
  const calculatedRatExpenses = ratExpenses.map((r) => ({
    ...r,
    jumlah: r.nominal * r.qty,
  }));
  const totalBiayaRat = calculatedRatExpenses.reduce((acc, curr) => acc + curr.jumlah, 0);

  // Single Source of Truth dari shuService:
  // Alokasi pembagian hanya dari surplus usaha riil netShu > 0 (AD/ART Koperasi)
  const distributableBasis = shuCalc.netShu > 0 ? shuCalc.netShu : 0;

  // Alokasi Pembagian SHU sesuai AD/ART Koperasi
  const calculatedDistributions = distRules.map((rule) => {
    const nominal = Math.round((rule.prosentase / 100) * distributableBasis);
    return {
      ...rule,
      nominal,
    };
  });

  // Alokasi Hak Anggota konsisten dari Single Source of Truth shuService
  const alokasiShuAnggotaTotal = shuCalc.alokasiShuAnggotaTotal;

  const poolJasaUsaha90 = Math.round(alokasiShuAnggotaTotal * 0.90);
  const poolJasaSimpanan5 = Math.round(alokasiShuAnggotaTotal * 0.05);
  const poolJasaPinjaman5 = Math.round(alokasiShuAnggotaTotal * 0.05);
  const eligibleMembersCount = Math.max(
    1,
    members.filter((m) => m.status === 'aktif' || m.status === 'pasif').length
  );
  const jasaUsahaPerAnggota = Math.round(poolJasaUsaha90 / eligibleMembersCount);

  // Rincian SHU per Anggota menggunakan shuService
  const memberShuDetails = calculateMembersShuDetails(
    members,
    savings,
    repayments,
    shuCalc.alokasiShuAnggotaTotal
  );

  // Filter list anggota penerima SHU (eksklusif anggota aktif/pasif, status 'keluar' tidak boleh muncul)
  const filteredMemberShu = memberShuDetails.filter((m) => {
    if (m.status === 'keluar') return false;
    const matchSearch =
      m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
      m.memberId.toLowerCase().includes(searchMember.toLowerCase()) ||
      m.job.toLowerCase().includes(searchMember.toLowerCase());
    const matchStatus = filterStatus === 'semua' ? true : m.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sumTotalJasaUsaha = memberShuDetails.reduce((a, b) => a + b.jasaUsaha, 0);
  const sumTotalJasaSimpanan = memberShuDetails.reduce((a, b) => a + b.jasaSimpanan, 0);
  const sumTotalJasaPinjaman = memberShuDetails.reduce((a, b) => a + b.jasaPinjaman, 0);
  const grandTotalShuAnggota = memberShuDetails.reduce((a, b) => a + b.totalShu, 0);

  // TAMPILAN KHUSUS ROLE ANGGOTA (DATA PRIBADI SAJA)
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
    const myShuDetail = memberShuDetails.find((m) => m.memberId.toLowerCase() === myMemberId.toLowerCase()) || {
      memberId: myMemberId,
      name: myMember.name,
      job: myMember.job,
      status: myMember.status,
      simpananPokokWajib: 0,
      bungaPinjaman: 0,
      jasaUsaha: 0,
      jasaSimpanan: 0,
      jasaPinjaman: 0,
      totalShu: 0,
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 rounded-2xl p-6 text-white shadow-md border border-blue-800/40">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
              SISA HASIL USAHA PRIBADI ANGGOTA
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
          <h2 className="text-xl font-black text-white">Hak SHU Anggota: {myMember.name}</h2>
          <p className="text-xs text-blue-200 mt-1 font-mono">
            No. Registrasi: {myMember.id} &bull; Status: {String(myMember.status).toUpperCase()} &bull; Tahun Buku {selectedYear}
          </p>
        </div>

        {/* 4 KPI Cards Anggota */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Total Hak SHU Saya</span>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-2">
              {formatRupiah(myShuDetail.totalShu)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Tahun Buku {selectedYear}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Hak Jasa Usaha</span>
            <div className="text-2xl font-black font-mono text-blue-950 mt-2">
              {formatRupiah(myShuDetail.jasaUsaha)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Porsi 90% hak anggota</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Hak Jasa Simpanan</span>
            <div className="text-2xl font-black font-mono text-indigo-950 mt-2">
              {formatRupiah(myShuDetail.jasaSimpanan)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Basis: {formatRupiah(myShuDetail.simpananPokokWajib)}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-500">Hak Jasa Pinjaman</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {formatRupiah(myShuDetail.jasaPinjaman)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Basis bunga: {formatRupiah(myShuDetail.bungaPinjaman)}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
          <p className="font-semibold">Informasi Transparansi SHU:</p>
          <p className="mt-1 text-slate-600 leading-relaxed">
            {shuCalc.netShu <= 0
              ? 'Belum ada realisasi pembagian SHU untuk Tahun Buku berjalan karena belum ada aktivitas pendapatan operasional unit usaha atau jasa pinjaman yang dibukukan pada database koperasi.'
              : 'Pembagian SHU dihitung secara proporsional sesuai Anggaran Rumah Tangga (ART) Koperasi Brama Jaya Sejahtera dan disahkan pada Rapat Anggota Tahunan (RAT).'}
          </p>
        </div>
      </div>
    );
  }

  // Edit Handlers for Pengurus
  const handleUpdateUnitLaba = (id: string, field: 'laba' | 'perputaranModal' | 'prosentaseRapb', value: number) => {
    setUnitLabaList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: Math.max(0, value) } : item))
    );
  };

  const handleUpdateRatExpense = (id: string, field: 'nominal' | 'qty', value: number) => {
    setRatExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: Math.max(0, value) } : item))
    );
  };

  const handleUpdateDistRule = (id: string, prosentase: number) => {
    setDistRules((prev) =>
      prev.map((item) => (item.id === id ? { ...item, prosentase: Math.max(0, prosentase) } : item))
    );
  };

  const handleResetToDefault = () => {
    setUnitLabaList(defaultUnitLaba);
    setRatExpenses(defaultRatExpenses);
    setDistRules(defaultDistRules);
    localStorage.removeItem(STORAGE_KEY_SHU_LABA);
    localStorage.removeItem(STORAGE_KEY_SHU_RAT);
    localStorage.removeItem(STORAGE_KEY_SHU_DIST);
  };

  // EXPORT TO CSV / EXCEL
  const handleExportCsv = () => {
    const headers = [
      'No Register',
      'Nama Anggota',
      'Unit Kerja / Jabatan',
      'Status Anggota',
      'Simpanan Pokok & Wajib (Rp)',
      'Bunga Pinjaman (Rp)',
      'Jasa Usaha 90% (Rp)',
      'Jasa Simpanan 5% (Rp)',
      'Jasa Pinjaman 5% (Rp)',
      'Total SHU Anggota (Rp)',
    ];

    const rows = memberShuDetails.map((m) => [
      `"${m.memberId}"`,
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.job.replace(/"/g, '""')}"`,
      `"${m.status.toUpperCase()}"`,
      m.simpananPokokWajib,
      m.bungaPinjaman,
      m.jasaUsaha,
      m.jasaSimpanan,
      m.jasaPinjaman,
      m.totalShu,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daftar_Pembagian_SHU_Anggota_BJS_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PRINT SHU FULL REPORT (PDF)
  const handlePrintShu = () => {
    const html = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 55px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">
              Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK ETAP Koperasi
            </p>
          </div>
        </div>
      </div>

      <div class="document-title" style="color: #7f1d1d; font-size: 15px; font-weight: 900; text-align: center; text-decoration: underline;">
        LAPORAN REKAPITULASI & PEMBAGIAN SISA HASIL USAHA (SHU) TAHUN BUKU ${selectedYear}
      </div>
      <div class="doc-number" style="text-align: center; font-family: monospace; font-size: 11px; margin-bottom: 16px; color: #475569;">
        Dasar Perhitungan Sesuai Skema RAT & Anggaran Rumah Tangga (ART) KSP Brama Jaya Sejahtera
      </div>

      <h3 style="font-size: 12px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-top: 14px;">
        I. REKAPITULASI LABA UNIT USAHA & PERPUTARAN MODAL
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 6px; border: 1px solid #cbd5e1;">Unit Usaha</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Laba (b)</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Perputaran Modal (c)</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Sisa Laba (d=b-c)</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Biaya Ops 2.5% (e)</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Untuk SHU (f=d-e)</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">% RAPB (g)</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">RAPB 2026 (h)</th>
          </tr>
        </thead>
        <tbody>
          ${rekapCalculated
            .map(
              (r) => `
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; font-weight: bold;">${r.name}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.laba)}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.perputaranModal)}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.sisaLaba)}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.biayaOps)}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${formatRupiah(r.untukShu)}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: center;">${r.prosentaseRapb}%</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.rapbNominal)}</td>
            </tr>
          `
            )
            .join('')}
          <tr style="background: #f8fafc; font-weight: bold;">
            <td style="padding: 6px; border: 1px solid #cbd5e1;">JUMLAH (TOTAL)</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalLabaB)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalModalC)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalSisaLabaD)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalBiayaOpsE)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #047857;">${formatRupiah(totalUntukShuF)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">-</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(totalRapbH)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; font-size: 10px;">
        <div>
          <h3 style="font-size: 11px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin: 0 0 6px 0;">
            II. 1. BIAYA RAT (RAPAT ANGGOTA TAHUNAN)
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: left;">Uraian</th>
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">Nominal</th>
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">Qty</th>
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${calculatedRatExpenses
                .map(
                  (r) => `
                <tr>
                  <td style="padding: 3px 4px; border: 1px solid #e2e8f0;">${r.uraian}</td>
                  <td style="padding: 3px 4px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.nominal)}</td>
                  <td style="padding: 3px 4px; border: 1px solid #e2e8f0; text-align: center;">${r.qty}</td>
                  <td style="padding: 3px 4px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatRupiah(r.jumlah)}</td>
                </tr>
              `
                )
                .join('')}
              <tr style="background: #f8fafc; font-weight: bold;">
                <td colspan="3" style="padding: 5px 4px; border: 1px solid #cbd5e1;">TOTAL ESTIMASI ANGGARAN RAT (RAB)</td>
                <td style="padding: 5px 4px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #b91c1c;">${formatRupiah(totalBiayaRat)}</td>
              </tr>
              <tr style="background: #f1f5f9; font-size: 8.5px; color: #64748b;">
                <td colspan="4" style="padding: 3px 4px; border: 1px solid #e2e8f0; font-style: italic;">
                  *RAB Simulasi Pelaksanaan RAT tidak mengurangi SHU riil sampai dibukukan sah di kas (beban kas: ${formatRupiah(shuCalc.totalExpenses)}).
                </td>
              </tr>
              <tr style="background: #ecfdf5; font-weight: bold;">
                <td colspan="3" style="padding: 5px 4px; border: 1px solid #cbd5e1; color: #065f46;">DASAR ALOKASI SHU OPERASIONAL</td>
                <td style="padding: 5px 4px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #047857; font-size: 11px;">${formatRupiah(distributableBasis)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 style="font-size: 11px; font-weight: bold; border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin: 0 0 6px 0;">
            II. 2. PERSENTASE PEMBAGIAN SHU
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: left;">Uraian Pos Alokasi</th>
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">Prosentase</th>
                <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${calculatedDistributions
                .map(
                  (d) => `
                <tr ${d.uraian.toLowerCase().includes('anggota') ? 'style="background: #f0fdf4; font-weight: bold;"' : ''}>
                  <td style="padding: 4px; border: 1px solid #e2e8f0;">${d.uraian}</td>
                  <td style="padding: 4px; border: 1px solid #e2e8f0; text-align: center;">${d.prosentase}%</td>
                  <td style="padding: 4px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: ${d.uraian.toLowerCase().includes('anggota') ? '#047857' : '#0f172a'};">${formatRupiah(d.nominal)}</td>
                </tr>
              `
                )
                .join('')}
              <tr style="background: #f8fafc; font-weight: bold;">
                <td style="padding: 5px 4px; border: 1px solid #cbd5e1;">TOTAL</td>
                <td style="padding: 5px 4px; border: 1px solid #cbd5e1; text-align: center;">100%</td>
                <td style="padding: 5px 4px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatRupiah(distributableBasis)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="signatures" style="margin-top: 35px; display: flex; justify-content: space-between; text-align: center;">
        <div style="width: 30%;">
          <p style="font-size: 11px; color: #475569; margin: 0 0 50px 0;">Ketua Koperasi,</p>
          <p style="font-weight: bold; border-top: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-top: 4px; margin: 0;">${KOPERASI_OFFICIALS.ketua}</p>
        </div>
        <div style="width: 30%;">
          <p style="font-size: 11px; color: #475569; margin: 0 0 50px 0;">Sekretaris,</p>
          <p style="font-weight: bold; border-top: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-top: 4px; margin: 0;">${KOPERASI_OFFICIALS.sekretaris}</p>
        </div>
        <div style="width: 30%;">
          <p style="font-size: 11px; color: #475569; margin: 0 0 50px 0;">Bendahara,</p>
          <p style="font-weight: bold; border-top: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-top: 4px; margin: 0;">${KOPERASI_OFFICIALS.bendahara}</p>
        </div>
      </div>

      <div class="footer-note" style="margin-top: 25px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #64748b; text-align: center;">
        Dicetak secara otomatis melalui Sistem BJS Digital pada ${formatDateIndo(new Date().toISOString())}. Dokumen sah RAT Koperasi Brama Jaya Sejahtera.
      </div>
    `;

    printHtmlContent(html, `Laporan-SHU-BJS-${selectedYear}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card with Blue & Maroon Gradient */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 rounded-2xl p-6 text-white shadow-md border border-blue-800/40 relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
              SISA HASIL USAHA (SHU)
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
            <span className="text-xs text-blue-200 font-semibold">&bull; BJS Digital</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-red-400" />
            Skema & Pembagian Sisa Hasil Usaha
          </h2>
          <p className="text-blue-100 text-xs mt-0.5 max-w-2xl">
            Perhitungan SHU komprehensif 5 unit usaha, alokasi biaya RAT, dan pembagian ke {members.filter((m) => m.status !== 'keluar').length} anggota koperasi.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-200 mr-1.5" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-slate-900 text-white">
                  Tahun Buku {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePrintShu}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-blue-50 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-900" />
            <span>Cetak Rekap SHU</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow-md transition cursor-pointer border border-red-600/40"
          >
            <Download className="w-4 h-4 text-red-200" />
            <span>Ekspor Excel</span>
          </button>

          {userRole === 'pengurus' && (
            <button
              onClick={handleResetToDefault}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition cursor-pointer"
              title="Reset ke Formula Default ART"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Banner Status Aktivitas Ekonomi SHU */}
      {!shuCalc.hasOperationalActivity ? (
        <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-3 shadow-2xs">
          <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-blue-950">Status Aktivitas Ekonomi & Realisasi SHU:</p>
            <p className="text-slate-700 leading-relaxed">
              Belum ada realisasi pendapatan operasional unit usaha atau pendapatan jasa pinjaman yang dibukukan pada database Supabase (Total Pendapatan Riil: Rp 0, Total Beban: Rp 0). Sesuai kaidah akuntansi yang objektif dan transparan, SHU Bersih Tahun Berjalan tercatat <strong>Rp 0</strong> dan tidak ada pembagian SHU fiktif.
            </p>
          </div>
        </div>
      ) : shuCalc.netShu < 0 ? (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-950">Kondisi Defisit Operasional Tahun Berjalan:</p>
            <p className="text-slate-700 leading-relaxed">
              Total beban operasional melebihi pendapatan riil koperasi (SHU Bersih: {formatRupiah(shuCalc.netShu)}). Sesuai aturan akuntansi, nilai defisit ini tercermin secara jujur dan tidak ada alokasi SHU yang dapat dibagikan.
            </p>
          </div>
        </div>
      ) : null}

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pendapatan Riil */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Total Pendapatan Riil</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-900">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-slate-900">
            {formatRupiah(shuCalc.totalRevenue)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Unit Usaha & Jasa Pinjaman</p>
        </div>

        {/* Realisasi SHU Bersih */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>SHU Bersih Riil</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-900">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className={`mt-3 text-2xl font-black font-mono ${shuCalc.netShu < 0 ? 'text-red-700' : 'text-indigo-950'}`}>
            {formatRupiah(shuCalc.netShu)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Pendapatan dikurangi beban</p>
        </div>

        {/* Total Beban Riil */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Total Beban Riil</span>
            <span className="p-1.5 rounded-lg bg-red-50 text-red-800">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-red-950">
            {formatRupiah(shuCalc.totalExpenses)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Operasional tercatat di kas</p>
        </div>

        {/* Sisa SHU Dibagikan */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-5 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span>Alokasi Hak Anggota</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-emerald-700">
            {formatRupiah(shuCalc.alokasiShuAnggotaTotal)}
          </div>
          <p className="mt-1 text-xs text-emerald-800 font-semibold">
            Porsi 40% untuk {members.length} anggota
          </p>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-6 pt-3 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('rekap')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'rekap'
              ? 'border-blue-900 text-blue-950 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>I. Rekap Laba & Perputaran Modal</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rat')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'rat'
              ? 'border-blue-900 text-blue-950 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>II. Biaya RAT & Persentase Pembagian</span>
        </button>

        <button
          onClick={() => setActiveSubTab('anggota')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'anggota'
              ? 'border-blue-900 text-blue-950 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>III. Rincian SHU Per Anggota ({members.length})</span>
        </button>
      </div>

      {/* TAB 1: REKAP LABA & PERPUTARAN MODAL (Page 1 & 2 PDF) */}
      {activeSubTab === 'rekap' && (
        <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tabel Rekapitulasi Laba Unit Usaha & Perputaran Modal
              </h3>
              <p className="text-xs text-slate-500">
                Formula: Sisa Laba (d = b - c) &bull; Biaya Operasional (e = d &times; 2.5%) &bull; Untuk SHU (f = d - e)
              </p>
            </div>
            {userRole === 'pengurus' && (
              <span className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold">
                Mode Edit Pengurus Aktif: Klik angka untuk menyesuaikan
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Unit Usaha (a)</th>
                  <th className="py-3 px-4 text-right">Laba (b)</th>
                  <th className="py-3 px-4 text-right">Perputaran Modal (c)</th>
                  <th className="py-3 px-4 text-right">Sisa Laba (d = b - c)</th>
                  <th className="py-3 px-4 text-right">Biaya Ops 2.5% (e)</th>
                  <th className="py-3 px-4 text-right text-emerald-800">Untuk SHU (f = d - e)</th>
                  <th className="py-3 px-4 text-center">% RAPB (g)</th>
                  <th className="py-3 px-4 text-right">RAPB 2026 (h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rekapCalculated.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {userRole === 'pengurus' ? (
                        <input
                          type="number"
                          step={500000}
                          value={item.laba}
                          onChange={(e) => handleUpdateUnitLaba(item.id, 'laba', Number(e.target.value))}
                          className="w-32 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-slate-200 focus:outline-none focus:border-blue-900"
                        />
                      ) : (
                        <span className="font-bold text-slate-900">{formatRupiah(item.laba)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {userRole === 'pengurus' ? (
                        <input
                          type="number"
                          step={500000}
                          value={item.perputaranModal}
                          onChange={(e) => handleUpdateUnitLaba(item.id, 'perputaranModal', Number(e.target.value))}
                          className="w-32 px-2 py-1 text-right font-mono text-xs rounded border border-slate-200 focus:outline-none focus:border-blue-900"
                        />
                      ) : (
                        <span className="text-slate-600">{formatRupiah(item.perputaranModal)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {formatRupiah(item.sisaLaba)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                      {formatRupiah(item.biayaOps)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700">
                      {formatRupiah(item.untukShu)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold">
                      {userRole === 'pengurus' ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.prosentaseRapb}
                          onChange={(e) => handleUpdateUnitLaba(item.id, 'prosentaseRapb', Number(e.target.value))}
                          className="w-14 px-1.5 py-1 text-center font-bold text-xs rounded border border-slate-200 focus:outline-none focus:border-blue-900"
                        />
                      ) : (
                        `${item.prosentaseRapb}%`
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-800">
                      {formatRupiah(item.rapbNominal)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-300">
                  <td className="py-3 px-4 text-slate-900 uppercase">JUMLAH TOTAL</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900">{formatRupiah(totalLabaB)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">{formatRupiah(totalModalC)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900">{formatRupiah(totalSisaLabaD)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">{formatRupiah(totalBiayaOpsE)}</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-800 text-sm">
                    {formatRupiah(totalUntukShuF)}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-400">-</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900">{formatRupiah(totalRapbH)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BIAYA RAT & PERSENTASE PEMBAGIAN SHU (Page 3 PDF) */}
      {activeSubTab === 'rat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Biaya RAT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-red-700" />
                  1. Rencana Anggaran Biaya (RAB) Pelaksanaan RAT
                </h3>
                <p className="text-xs text-slate-500">14 pos simulasi estimasi anggaran operasional RAT</p>
              </div>
              <span className="text-xs font-mono font-bold text-red-800 bg-red-50 px-2.5 py-1 rounded-lg">
                Estimasi RAB: {formatRupiah(totalBiayaRat)}
              </span>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-950">Status Anggaran Simulasi / Perencanaan Internal:</p>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  Tabel ini memuat Rencana Anggaran Biaya (RAB) pelaksanaan RAT. Sesuai kaidah akuntansi, anggaran ini <strong>BUKAN</strong> beban operasional riil buku kas dan <strong>TIDAK</strong> mengurangi SHU riil sampai dibukukan secara sah di <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300 text-slate-900">cash_flow_records</code>.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Uraian</th>
                    <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedRatExpenses.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-800">{r.uraian}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {userRole === 'pengurus' ? (
                          <input
                            type="number"
                            step={10000}
                            value={r.nominal}
                            onChange={(e) => handleUpdateRatExpense(r.id, 'nominal', Number(e.target.value))}
                            className="w-24 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-slate-200 focus:outline-none"
                          />
                        ) : (
                          formatRupiah(r.nominal)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {userRole === 'pengurus' ? (
                          <input
                            type="number"
                            min={1}
                            value={r.qty}
                            onChange={(e) => handleUpdateRatExpense(r.id, 'qty', Number(e.target.value))}
                            className="w-14 px-1 py-0.5 text-center text-xs rounded border border-slate-200 focus:outline-none"
                          />
                        ) : (
                          r.qty
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(r.jumlah)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={3} className="py-2.5 px-3 uppercase text-slate-900">
                      Total Estimasi Anggaran RAT (RAB)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-800 text-xs">
                      {formatRupiah(totalBiayaRat)}
                    </td>
                  </tr>
                  <tr className="bg-slate-100 font-semibold border-t border-slate-200 text-slate-700">
                    <td colSpan={3} className="py-2 px-3 text-[11px]">
                      Beban Operasional Riil Kas (cash_flow_records)
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-800 text-xs">
                      {formatRupiah(shuCalc.totalExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 font-black border-t border-emerald-200">
                    <td colSpan={3} className="py-2.5 px-3 text-emerald-950 uppercase">
                      Dasar Alokasi SHU Riil (shuService)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                      {formatRupiah(distributableBasis)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Prosentase Pembagian SHU */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-900" />
                  2. Persentase Pembagian SHU
                </h3>
                <p className="text-xs text-slate-500">Alokasi cadangan, pengurus, dan anggota</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Basis SHU Riil: {formatRupiah(distributableBasis)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Pos Alokasi</th>
                    <th className="py-3 px-4 text-center">Persentase</th>
                    <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedDistributions.map((rule) => {
                    const isAnggota = rule.uraian.toLowerCase().includes('anggota');
                    return (
                      <tr
                        key={rule.id}
                        className={`transition ${isAnggota ? 'bg-emerald-50/50 font-bold text-emerald-950' : 'hover:bg-slate-50/70'}`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-semibold">{rule.uraian}</span>
                          {isAnggota && (
                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              Hak Anggota Koperasi
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {userRole === 'pengurus' ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={rule.prosentase}
                                onChange={(e) => handleUpdateDistRule(rule.id, Number(e.target.value))}
                                className="w-14 px-1.5 py-0.5 text-center font-bold text-xs rounded border border-slate-200 focus:outline-none"
                              />
                              <span>%</span>
                            </div>
                          ) : (
                            `${rule.prosentase}%`
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(rule.nominal)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="py-3 px-4 uppercase text-slate-900">TOTAL PERSENTASE</td>
                    <td className="py-3 px-4 text-center text-slate-900">
                      {calculatedDistributions.reduce((a, b) => a + b.prosentase, 0)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900">
                      {formatRupiah(
                        calculatedDistributions.reduce((a, b) => a + b.nominal, 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Explanatory Callout Box from PDF Scheme */}
            {distributableBasis <= 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Belum Ada Surplus Usaha untuk Dialokasikan:</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    SHU Bersih riil tercatat {formatRupiah(shuCalc.netShu)} (karena belum ada transaksi unit usaha atau pendapatan jasa pinjaman di database). Seluruh alokasi pos pembagian dan hak anggota bernilai <strong>Rp 0</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs space-y-2 text-slate-700">
                <h4 className="font-bold text-blue-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                  Skema Distribusi Porsi Hak Anggota ({formatRupiah(alokasiShuAnggotaTotal)}):
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                  <li>
                    <strong>Jasa Usaha 90% ({formatRupiah(poolJasaUsaha90)}):</strong> Dibagikan sama rata ke seluruh anggota aktif & pasif ({formatRupiah(jasaUsahaPerAnggota)} / anggota).
                  </li>
                  <li>
                    <strong>Jasa Simpanan 5% ({formatRupiah(poolJasaSimpanan5)}):</strong> Dibagikan proporsional simpanan pokok & wajib anggota.
                  </li>
                  <li>
                    <strong>Jasa Pinjaman 5% ({formatRupiah(poolJasaPinjaman5)}):</strong> Dibagikan proporsional bunga pinjaman tahun berjalan.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RINCIAN SHU PER ANGGOTA (Page 4, 5, 6 PDF) */}
      {activeSubTab === 'anggota' && (
        <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 p-6 shadow-xs space-y-4">
          {/* Controls: Search, Filter, Export */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari anggota (nama, register, unit kerja)..."
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setFilterStatus('semua')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterStatus === 'semua' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semua ({members.filter((m) => m.status !== 'keluar').length})
                </button>
                <button
                  onClick={() => setFilterStatus('aktif')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterStatus === 'aktif' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Aktif ({members.filter((m) => m.status === 'aktif').length})
                </button>
                <button
                  onClick={() => setFilterStatus('pasif')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterStatus === 'pasif' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Pasif ({members.filter((m) => m.status === 'pasif').length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Unduh Excel</span>
              </button>
              <button
                onClick={handlePrintShu}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak SHU</span>
              </button>
            </div>
          </div>

          {/* Members SHU Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">No. Register</th>
                  <th className="py-3 px-3">Nama Anggota</th>
                  <th className="py-3 px-3">Unit Kerja</th>
                  <th className="py-3 px-3 text-right">Jasa Usaha (90%)</th>
                  <th className="py-3 px-3 text-right">Jasa Simpanan (5%)</th>
                  <th className="py-3 px-3 text-right">Jasa Pinjaman (5%)</th>
                  <th className="py-3 px-3 text-right text-emerald-800 font-black">Total SHU Anggota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMemberShu.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Tidak ada anggota yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredMemberShu.map((m) => (
                    <tr key={m.memberId} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{m.memberId}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900">{m.name}</span>
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            m.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{m.job}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatRupiah(m.jasaUsaha)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatRupiah(m.jasaSimpanan)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatRupiah(m.jasaPinjaman)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 text-xs">
                        {formatRupiah(m.totalShu)}
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-50/90 font-black border-t-2 border-slate-300">
                  <td colSpan={3} className="py-3 px-3 uppercase text-slate-900">
                    TOTAL KONSOLIDASI SELURUH ANGGOTA ({members.filter((m) => m.status !== 'keluar').length})
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-900">
                    {formatRupiah(sumTotalJasaUsaha)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-900">
                    {formatRupiah(sumTotalJasaSimpanan)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-900">
                    {formatRupiah(sumTotalJasaPinjaman)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-800 text-sm">
                    {formatRupiah(grandTotalShuAnggota)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
