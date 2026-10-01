import React, { useState } from 'react';
import {
  Calculator,
  Coins,
  HandCoins,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  BadgePercent,
  Info,
} from 'lucide-react';
import { Member, SavingsTransaction, Loan } from '../types';
import { formatRupiah, formatNumber } from '../utils/formatters';

interface SimulasiViewProps {
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  onApplyLoanToForm?: (amount: number, tenor: number) => void;
}

export const SimulasiView: React.FC<SimulasiViewProps> = ({
  members,
  savings,
  loans,
  onApplyLoanToForm,
}) => {
  const [activeTab, setActiveTab] = useState<'pinjaman' | 'simpanan'>('pinjaman');

  // --- 1. SIMULASI PINJAMAN STATE ---
  const [loanPlafon, setLoanPlafon] = useState<number>(5000000);
  const [loanTenor, setLoanTenor] = useState<number>(12); // custom month input
  const [loanInterestRate, setLoanInterestRate] = useState<number>(1.1); // 1.1% per bln flat per ketentuan ART
  const [adminFeeRate, setAdminFeeRate] = useState<number>(1.0); // 1% admin fee untuk Operasional USP

  // Loan calculations
  const safeTenor = Math.max(1, loanTenor || 1);
  const monthlyPrincipal = Math.round(loanPlafon / safeTenor);
  const monthlyInterest = Math.round(loanPlafon * (loanInterestRate / 100));
  const monthlyInstallment = monthlyPrincipal + monthlyInterest;
  const adminFee = Math.round(loanPlafon * (adminFeeRate / 100));
  const disbursedAmount = loanPlafon - adminFee;
  const totalRepayment = monthlyInstallment * safeTenor;
  const totalInterest = monthlyInterest * safeTenor;

  // Monthly Amortization Schedule Table
  const scheduleRows = [];
  let runningPrincipal = loanPlafon;
  for (let i = 1; i <= safeTenor; i++) {
    const sisa = Math.max(0, runningPrincipal - monthlyPrincipal);
    scheduleRows.push({
      month: i,
      principal: monthlyPrincipal,
      interest: monthlyInterest,
      total: monthlyInstallment,
      remaining: i === safeTenor ? 0 : sisa,
    });
    runningPrincipal = sisa;
  }

  // --- 2. SIMULASI SIMPANAN STATE ---
  const [savingsMode, setSavingsMode] = useState<'berjangka' | 'pokok_wajib'>('berjangka');

  // Simpanan Berjangka (6% p.a.)
  const [berjangkaAmount, setBerjangkaAmount] = useState<number>(10000000);
  const [berjangkaTenorMonths, setBerjangkaTenorMonths] = useState<number>(12); // Standard 12 bln
  const berjangkaAnnualRate = 6.0; // 6% flat p.a. per ART
  const berjangkaEstimatedInterest = Math.round(
    berjangkaAmount * (berjangkaAnnualRate / 100) * (berjangkaTenorMonths / 12)
  );
  const berjangkaMaturityTotal = berjangkaAmount + berjangkaEstimatedInterest;

  // Simpanan Pokok & Wajib
  const [pokokInitial, setPokokInitial] = useState<number>(200000); // 200rb
  const [wajibMonthly, setWajibMonthly] = useState<number>(50000); // 50rb/bln
  const [wajibMonths, setWajibMonths] = useState<number>(24); // e.g. 24 bln
  const totalWajibAccumulated = wajibMonthly * wajibMonths;
  const totalSavingsAccumulated = pokokInitial + totalWajibAccumulated;

  return (
    <div className="space-y-6">
      {/* Header Banner with Blue & Maroon Gradient */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 rounded-2xl p-6 text-white shadow-md border border-blue-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
              SIMULASI & KALKULATOR
            </span>
            <span className="text-xs text-blue-200 font-semibold">BJS Digital</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-red-400" />
            Kalkulator Simulasi Keuangan Koperasi
          </h2>
          <p className="text-blue-100 text-xs mt-0.5 max-w-xl">
            Hitung estimasi cicilan pinjaman atau proyeksi simpanan berjangka 6% p.a. sebelum pengajuan resmi.
          </p>
        </div>

        {/* Tab Switcher: Pinjaman vs Simpanan */}
        <div className="flex items-center bg-white/10 backdrop-blur-xs p-1 rounded-xl border border-white/20">
          <button
            onClick={() => setActiveTab('pinjaman')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pinjaman'
                ? 'bg-white text-blue-950 shadow-md'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            <span>Simulasi Pinjaman</span>
          </button>
          <button
            onClick={() => setActiveTab('simpanan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'simpanan'
                ? 'bg-white text-blue-950 shadow-md'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <PiggyBank className="w-4 h-4" />
            <span>Simulasi Simpanan</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SIMULASI PINJAMAN */}
      {activeTab === 'pinjaman' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Parameters (1 Col) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-blue-900" />
                Parameter Pengajuan Pinjaman
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Masukkan plafon dan jumlah bulan tenor secara custom
              </p>
            </div>

            {/* Plafon Pinjaman */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Plafon Pinjaman (Rp)
              </label>
              <input
                type="number"
                step={500000}
                min={500000}
                value={loanPlafon}
                onChange={(e) => setLoanPlafon(Math.max(500000, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[3000000, 5000000, 10000000, 15000000, 20000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setLoanPlafon(amt)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 cursor-pointer"
                  >
                    {amt / 1000000}jt
                  </button>
                ))}
              </div>
            </div>

            {/* Tenor Custom (Input Angka Manual) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tenor Angsuran (Custom Bulan)
                </label>
                <span className="text-[11px] font-bold text-blue-900 font-mono">
                  {safeTenor} Bulan ({Math.round((safeTenor / 12) * 10) / 10} Thn)
                </span>
              </div>
              <input
                type="number"
                min={1}
                max={120}
                value={loanTenor}
                onChange={(e) => setLoanTenor(Math.max(1, Number(e.target.value)))}
                placeholder="Ketik jumlah bulan, misal: 10"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[3, 6, 10, 12, 18, 24, 36].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLoanTenor(t)}
                    className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer ${
                      loanTenor === t
                        ? 'bg-blue-900 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {t} bln
                  </button>
                ))}
              </div>
            </div>

            {/* Bunga Flat per Bulan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bunga Pinjaman (% per bulan flat)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={10}
                  value={loanInterestRate}
                  onChange={(e) => setLoanInterestRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-900"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  % / bln
                </span>
              </div>
            </div>

            {/* Biaya Administrasi 1% */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-amber-950">
                <span>Biaya Administrasi (1% Plafon):</span>
                <span className="font-mono text-amber-800">{formatRupiah(adminFee)}</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Ketentuan Koperasi: Uang administrasi 1% tidak masuk kas koperasi, melainkan dialokasikan khusus untuk operasional Unit Simpan Pinjam.
              </p>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setLoanPlafon(5000000);
                setLoanTenor(12);
                setLoanInterestRate(1.1);
              }}
              className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Perhitungan</span>
            </button>
          </div>

          {/* Results & Monthly Amortization Table (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Angsuran / Bulan
                </span>
                <div className="text-lg font-black font-mono text-blue-950 mt-1">
                  {formatRupiah(monthlyInstallment)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Pokok: {formatRupiah(monthlyPrincipal)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Dana Diterima
                </span>
                <div className="text-lg font-black font-mono text-emerald-700 mt-1">
                  {formatRupiah(disbursedAmount)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Plafon - Admin 1%
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Bunga
                </span>
                <div className="text-lg font-black font-mono text-red-700 mt-1">
                  {formatRupiah(totalInterest)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {loanInterestRate}% &times; {safeTenor} Bln
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Pelunasan
                </span>
                <div className="text-lg font-black font-mono text-slate-900 mt-1">
                  {formatRupiah(totalRepayment)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Pokok + Bunga
                </div>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-900" />
                  Tabel Rincian Jadwal Angsuran Per Bulan ({safeTenor} Bulan)
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Sistem Bunga Flat
                </span>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Bulan</th>
                      <th className="py-2.5 px-3 text-right">Angsuran Pokok</th>
                      <th className="py-2.5 px-3 text-right">Bunga ({loanInterestRate}%)</th>
                      <th className="py-2.5 px-3 text-right">Total Cicilan</th>
                      <th className="py-2.5 px-3 text-right">Sisa Pokok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheduleRows.map((row) => (
                      <tr key={row.month} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-bold text-slate-800">Bulan #{row.month}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatRupiah(row.principal)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-800">
                          {formatRupiah(row.interest)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(row.total)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {formatRupiah(row.remaining)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIMULASI SIMPANAN */}
      {activeTab === 'simpanan' && (
        <div className="space-y-6">
          {/* Sub Switcher: Berjangka 6% vs Pokok & Wajib */}
          <div className="flex gap-2">
            <button
              onClick={() => setSavingsMode('berjangka')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                savingsMode === 'berjangka'
                  ? 'bg-red-700 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BadgePercent className="w-4 h-4" />
              <span>Simpanan Berjangka (Bunga 6% p.a.)</span>
            </button>
            <button
              onClick={() => setSavingsMode('pokok_wajib')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                savingsMode === 'pokok_wajib'
                  ? 'bg-blue-950 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
              <span>Simpanan Pokok & Wajib Rutin</span>
            </button>
          </div>

          {/* Sub Option A: SIMPANAN BERJANGKA */}
          {savingsMode === 'berjangka' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BadgePercent className="w-4 h-4 text-red-700" />
                    Simulasi Penempatan Bilyet Berjangka
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sesuai ART Pasal 6 ayat 6: Suku bunga 6,0% flat per tahun dibagikan saat RAT
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nominal Penempatan Dana (Rp)
                  </label>
                  <input
                    type="number"
                    step={1000000}
                    min={1000000}
                    value={berjangkaAmount}
                    onChange={(e) => setBerjangkaAmount(Math.max(1000000, Number(e.target.value)))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-red-700"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[5000000, 10000000, 20000000, 50000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBerjangkaAmount(amt)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 cursor-pointer"
                      >
                        {amt / 1000000}jt
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jangka Waktu / Tenor (Bulan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={berjangkaTenorMonths}
                    onChange={(e) => setBerjangkaTenorMonths(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Standar ART: 12 Bulan (1 Tahun)</p>
                </div>

                <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 text-xs space-y-1 text-red-950">
                  <div className="font-bold flex justify-between">
                    <span>Suku Bunga Imbal Jasa:</span>
                    <span>6,00% per Tahun Flat</span>
                  </div>
                  <p className="text-[11px] text-red-800">
                    Bunga simpanan berjangka dihitung flat dan diterbitkan sertifikat bilyet resmi bertandatangan Pengurus.
                  </p>
                </div>
              </div>

              {/* Berjangka Result Card (2 Cols) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-gradient-to-br from-red-950 via-red-900 to-rose-950 rounded-2xl p-6 text-white shadow-md border border-red-800/40 space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full text-red-100">
                      HASIL PROYEKSI SIMPANAN BERJANGKA
                    </span>
                    <h3 className="text-xl font-black mt-2">
                      Estimasi Hasil Penempatan Bilyet 6% P.A.
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                      <span className="text-[11px] text-red-200">Pokok Penempatan</span>
                      <div className="text-lg font-black font-mono mt-1">
                        {formatRupiah(berjangkaAmount)}
                      </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                      <span className="text-[11px] text-red-200">Estimasi Bunga (6% p.a.)</span>
                      <div className="text-lg font-black font-mono text-emerald-300 mt-1">
                        {formatRupiah(berjangkaEstimatedInterest)}
                      </div>
                    </div>
                    <div className="bg-white/20 p-4 rounded-xl border border-white/20">
                      <span className="text-[11px] text-white font-bold">Total Pencairan</span>
                      <div className="text-lg font-black font-mono text-white mt-1">
                        {formatRupiah(berjangkaMaturityTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-red-100 space-y-1 border-t border-white/10 pt-4">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Bilyet dapat dicetak langsung setelah transaksi penempatan disetorkan.</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Pencairan pokok dan bagi hasil dilakukan tepat saat jatuh tempo atau pelaksanaan RAT tahunan.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub Option B: SIMPANAN POKOK & WAJIB */}
          {savingsMode === 'pokok_wajib' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-blue-900" />
                    Simulasi Akumulasi Pokok & Wajib
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pokok Rp 200rb (1x awal) & Wajib Rp 50rb/bulan potong gaji
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Simpanan Pokok Awal (Rp)
                  </label>
                  <input
                    type="number"
                    value={pokokInitial}
                    onChange={(e) => setPokokInitial(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">ART 4:2a: Rp 200.000 saat awal bergabung</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Simpanan Wajib per Bulan (Rp)
                  </label>
                  <input
                    type="number"
                    value={wajibMonthly}
                    onChange={(e) => setWajibMonthly(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">ART 4:2b: Rp 50.000 per bulan sistem potong gaji</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Lama Menabung (Bulan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={wajibMonths}
                    onChange={(e) => setWajibMonths(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-900 focus:outline-none"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[12, 24, 36, 48].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWajibMonths(m)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                          wajibMonths === m ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m / 12} Thn
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pokok & Wajib Results */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-900 px-2.5 py-1 rounded-full">
                      PROYEKSI AKUMULASI SIMPANAN
                    </span>
                    <h3 className="text-xl font-black text-slate-900 mt-2">
                      Akumulasi Dana Anggota ({wajibMonths} Bulan / {Math.round((wajibMonths / 12) * 10) / 10} Tahun)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                      <span className="text-xs font-bold text-blue-950">Simpanan Pokok</span>
                      <div className="text-lg font-black font-mono text-blue-900 mt-1">
                        {formatRupiah(pokokInitial)}
                      </div>
                      <span className="text-[10px] text-slate-400">1x diawal</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs font-bold text-slate-800">Akumulasi Wajib</span>
                      <div className="text-lg font-black font-mono text-slate-900 mt-1">
                        {formatRupiah(totalWajibAccumulated)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {wajibMonths} bln &times; {formatRupiah(wajibMonthly)}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-950">Total Simpanan</span>
                      <div className="text-lg font-black font-mono text-emerald-800 mt-1">
                        {formatRupiah(totalSavingsAccumulated)}
                      </div>
                      <span className="text-[10px] text-emerald-700">Pokok + Wajib</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-blue-900" />
                      Ketentuan Simpanan Pokok & Wajib:
                    </h4>
                    <p>
                      1. Simpanan Pokok dan Simpanan Wajib tidak dapat ditarik kembali selama masih berstatus menjadi anggota aktif koperasi.
                    </p>
                    <p>
                      2. Akumulasi simpanan ini menjadi dasar perhitungan hak <strong>Jasa Simpanan (5%)</strong> dalam pembagian SHU tahunan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
