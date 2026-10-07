import { useState, useEffect } from 'react';
import {
  X,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
  Building2,
  Vault,
  Calendar,
  Lock,
  Save,
  Check,
  Info,
} from 'lucide-react';
import { AuthUser, OpeningReconciliationData } from '../types';
import { formatRupiah } from '../utils/formatters';
import {
  saveOpeningReconciliationDraft,
  verifyOpeningReconciliation,
  reverseOpeningReconciliation,
} from '../services/reconciliationService';

interface RekonsiliasiModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalSavings: number;
  currentReconciliation: OpeningReconciliationData | null;
  onSuccess: (rec: OpeningReconciliationData) => void;
  currentUser?: AuthUser | null;
}

export const RekonsiliasiModal: React.FC<RekonsiliasiModalProps> = ({
  isOpen,
  onClose,
  historicalSavings,
  currentReconciliation,
  onSuccess,
  currentUser,
}) => {
  // Form State
  const [cutoffDate, setCutoffDate] = useState('2026-01-01');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [verifiedBank, setVerifiedBank] = useState<number>(0);
  const [cashLocation, setCashLocation] = useState('Brankas Kantor Utama BJS');
  const [cashBaNumber, setCashBaNumber] = useState('');
  const [verifiedCash, setVerifiedCash] = useState<number>(0);
  const [baNumber, setBaNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Reversal Form State
  const [showReversalForm, setShowReversalForm] = useState(false);
  const [reversalReason, setReversalReason] = useState('');

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state saat modal dibuka atau data berubah
  useEffect(() => {
    if (currentReconciliation) {
      setCutoffDate(currentReconciliation.cutoffDate || '2026-01-01');
      setBankName(currentReconciliation.bankName || '');
      setAccountNumber(currentReconciliation.accountNumber || '');
      setBankReference(currentReconciliation.bankReference || '');
      setVerifiedBank(currentReconciliation.verifiedBank || 0);
      setCashLocation(currentReconciliation.cashLocation || 'Brankas Kantor Utama BJS');
      setCashBaNumber(currentReconciliation.cashBaNumber || '');
      setVerifiedCash(currentReconciliation.verifiedCash || 0);
      setBaNumber(currentReconciliation.baNumber || '');
      setNotes(currentReconciliation.notes || '');
    } else {
      setCutoffDate('2026-01-01');
      setBankName('');
      setAccountNumber('');
      setBankReference('');
      setVerifiedBank(0);
      setCashLocation('Brankas Kantor Utama BJS');
      setCashBaNumber('');
      setVerifiedCash(0);
      setBaNumber('');
      setNotes('');
    }
    setShowReversalForm(false);
    setReversalReason('');
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [currentReconciliation, isOpen]);

  if (!isOpen) return null;

  // Kalkulasi Otomatis
  const safeBank = Math.max(0, verifiedBank || 0);
  const safeCash = Math.max(0, verifiedCash || 0);
  const totalVerified = safeBank + safeCash;
  const difference = historicalSavings - totalVerified;

  // Status klasifikasi
  const isCurrentlyVerified = currentReconciliation?.status === 'verified';
  const isCurrentlyDraft = currentReconciliation?.status === 'draft';
  const isCurrentlyReversed = currentReconciliation?.status === 'reversed';

  // Handler Simpan Draft
  const handleSaveDraft = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await saveOpeningReconciliationDraft(
        {
          cutoffDate,
          bankName,
          accountNumber,
          bankReference,
          verifiedBank: safeBank,
          cashLocation,
          cashBaNumber,
          verifiedCash: safeCash,
          baNumber: baNumber.trim() || `DRAFT-${Date.now()}`,
          notes,
          historicalSavings,
          totalVerified,
          difference,
        },
        currentUser
      );

      if (!res.success) {
        setErrorMsg(res.message);
      } else if (res.reconciliation) {
        setSuccessMsg(res.message);
        onSuccess(res.reconciliation);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan draft.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Verifikasi Resmi
  const handleVerify = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!baNumber.trim()) {
      setErrorMsg('Nomor Berita Acara (BA) Rekonsiliasi wajib diisi untuk verifikasi resmi.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOpeningReconciliation(
        {
          cutoffDate,
          bankName,
          accountNumber,
          bankReference,
          verifiedBank: safeBank,
          cashLocation,
          cashBaNumber,
          verifiedCash: safeCash,
          baNumber: baNumber.trim(),
          notes,
          historicalSavings,
          totalVerified,
          difference,
        },
        currentUser
      );

      if (!res.success) {
        setErrorMsg(res.message);
      } else if (res.reconciliation) {
        setSuccessMsg(res.message);
        onSuccess(res.reconciliation);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memverifikasi saldo awal.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Reversal / Pembatalan
  const handleReversal = async () => {
    if (!currentReconciliation) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!reversalReason.trim()) {
      setErrorMsg('Alasan pembatalan/reversal wajib diisi secara rinci untuk kepatuhan audit.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await reverseOpeningReconciliation(
        reversalReason,
        currentReconciliation,
        currentUser
      );

      if (!res.success) {
        setErrorMsg(res.message);
      } else if (res.reconciliation) {
        setSuccessMsg(res.message);
        setShowReversalForm(false);
        onSuccess(res.reconciliation);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal melakukan pembatalan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-800/60 rounded-xl border border-blue-700/50">
              <Scale className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Rekonsiliasi Saldo Awal & Simpanan Historis
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full">
                  Pengurus & Bendahara
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Pengakuan resmi kas & bank fisik berdasarkan bukti rekening koran & berita acara kas opname
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Status Alert Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Current Status Badge Indicator */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Status Rekonsiliasi Saat Ini di Database:
              </span>
              <div className="flex items-center gap-2 mt-1">
                {isCurrentlyVerified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    VERIFIED (Aktif Masuk Buku Kas) &bull; BA: {currentReconciliation?.baNumber}
                  </span>
                )}
                {isCurrentlyDraft && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    DRAFT (Tersimpan di Audit Log, Belum Masuk Kas)
                  </span>
                )}
                {isCurrentlyReversed && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-900 border border-rose-300">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
                    REVERSED (Dibatalkan via Contra-Entry)
                  </span>
                )}
                {!currentReconciliation && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-800 border border-slate-300">
                    BELUM DIREKONSILIASI (Kas = Rp 0)
                  </span>
                )}
              </div>
            </div>

            {isCurrentlyVerified && !showReversalForm && (
              <button
                type="button"
                onClick={() => setShowReversalForm(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Batalkan / Reversal Rekonsiliasi
              </button>
            )}
          </div>

          {/* Reversal Confirmation Form (If Active) */}
          {showReversalForm && (
            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-rose-950 flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  Konfirmasi Reversal / Pembatalan Saldo Awal Terverifikasi
                </h4>
                <button
                  type="button"
                  onClick={() => setShowReversalForm(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed">
                Reversal akan membuat <strong>contra-entry (kas keluar saldo_awal)</strong> pada buku kas untuk mengembalikan saldo aktiva kas ke posisi sebelum verifikasi. Tindakan ini dicatat permanen pada <code>audit_logs</code> dan tidak menghapus riwayat sebelumnya.
              </p>
              <div>
                <label className="block text-xs font-bold text-rose-950 mb-1">
                  Alasan Reversal Resmi (Wajib diisi):
                </label>
                <textarea
                  rows={2}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Contoh: Kesalahan input nomor rekening bank koran atau koreksi fisik brankas..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReversalForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleReversal}
                  className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Memproses...' : 'Eksekusi Reversal Resmi'}
                </button>
              </div>
            </div>
          )}

          {/* Metric Comparison Cards: Historical Savings vs Verified vs Selisih */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Historical Savings (Fixed from Supabase) */}
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                1. Total Simpanan Historis
              </span>
              <div className="text-lg font-black font-mono text-slate-900">
                {formatRupiah(historicalSavings)}
              </div>
              <p className="text-[10px] text-slate-500">
                Terkunci dari 428 mutasi simpanan Supabase
              </p>
            </div>

            {/* Card 2: Total Kas + Bank Terverifikasi */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                2. Kas & Bank Terverifikasi
              </span>
              <div className="text-lg font-black font-mono text-blue-950">
                {formatRupiah(totalVerified)}
              </div>
              <p className="text-[10px] text-blue-700 font-medium">
                Bank: {formatRupiah(safeBank)} + Fisik: {formatRupiah(safeCash)}
              </p>
            </div>

            {/* Card 3: Selisih Historis Terbuka */}
            <div
              className={`p-4 rounded-xl border space-y-1 ${
                difference === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : difference > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-purple-50 border-purple-300 text-purple-950'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                3. Selisih Historis Terbuka
              </span>
              <div className="text-lg font-black font-mono">
                {formatRupiah(difference)}
              </div>
              <p className="text-[10px] font-medium leading-tight">
                {difference === 0
                  ? 'Rekonsiliasi Lengkap (100% Sempurna)'
                  : difference > 0
                  ? 'Menunggu Berita Acara Aset/Pengeluaran Masa Lalu'
                  : 'Kas/Bank melebihi simpanan (Perlu verifikasi)'}
              </p>
            </div>
          </div>

          {/* Form Fields: Parameter Rekonsiliasi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Bagian Kiri: Saldo Bank Rekening Koran */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Building2 className="w-4 h-4 text-blue-900" />
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  A. Rekening Bank Koperasi
                </h4>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nama Bank Resmi Koperasi:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bank Mandiri / BRI / BNI"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nomor Rekening Bank:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 130-00-1234567-8"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold focus:outline-none focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nomor / Referensi Rekening Koran:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: RK-MANDIRI-20251231"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-blue-950 font-bold mb-1">
                  Saldo Bank Terverifikasi Sah (Rp):
                </label>
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={verifiedBank}
                  onChange={(e) => setVerifiedBank(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white text-sm font-black font-mono text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900/10"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                  Terbilang: {formatRupiah(safeBank)}
                </span>
              </div>
            </div>

            {/* Bagian Kanan: Saldo Fisik Brankas & Berita Acara */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Vault className="w-4 h-4 text-emerald-800" />
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  B. Kas Fisik / Brankas Tunai
                </h4>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Lokasi Brankas / Kas Fisik:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Brankas Kantor Utama BJS"
                  value={cashLocation}
                  onChange={(e) => setCashLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nomor BA Kas Opname Fisik:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BA-OPNAME-01/2026"
                  value={cashBaNumber}
                  onChange={(e) => setCashBaNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block text-emerald-950 font-bold mb-1">
                  Saldo Kas Fisik Terverifikasi (Rp):
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={verifiedCash}
                  onChange={(e) => setVerifiedCash(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-white text-sm font-black font-mono text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-800/10"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                  Terbilang: {formatRupiah(safeCash)}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Tanggal Pisah Batas (Cut-Off Date):
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Berita Acara Final & Catatan */}
          <div className="p-4 rounded-xl border-2 border-blue-900/20 bg-blue-50/20 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
              <FileText className="w-4 h-4 text-blue-900" />
              <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wider">
                C. Pengesahan Berita Acara Rekonsiliasi Resmi
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-900 font-black mb-1">
                  Nomor Berita Acara Rekonsiliasi (Wajib untuk Verifikasi)*:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BA/BJS-REKON/01/2026"
                  value={baNumber}
                  onChange={(e) => setBaNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Nomor arsip SK / Berita Acara resmi yang disetujui Pengurus & Pengawas.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Catatan / Keterangan Penjelas Rekonsiliasi:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rekening koran periode penutupan buku 2025 telah diverifikasi..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:outline-none"
                />
              </div>
            </div>

            {/* Anti-Fictitious Asset Guarantee Box */}
            <div className="p-3 rounded-lg bg-white border border-blue-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
              <div>
                <strong>Prinsip Anti-Aset Fiktif BJS Digital:</strong>
                <p className="mt-0.5">
                  Menekan tombol "Verifikasi & Sahkan Saldo Awal" hanya akan memasukkan nominal Kas & Bank yang benar-benar diverifikasi (<strong>{formatRupiah(totalVerified)}</strong>) ke dalam <code>cash_flow_records</code>. Selisih historis terbuka (<strong>{formatRupiah(difference)}</strong>) <strong>TIDAK PERNAH</strong> dimasukkan ke aset, melainkan tetap ditampilkan sebagai selisih jujur yang menunggu klasifikasi pengurus.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Dicatat oleh: <strong>{currentUser?.name || 'Pengurus/Bendahara BJS'}</strong> ({currentUser?.role || 'pengurus'})
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Tutup
            </button>

            {/* Tombol Simpan Draft */}
            <button
              type="button"
              disabled={isLoading || isCurrentlyVerified}
              onClick={handleSaveDraft}
              className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-bold text-xs hover:bg-amber-100 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title={isCurrentlyVerified ? 'Tidak dapat menyimpan draft saat status sudah VERIFIED' : 'Simpan draft tanpa memasukkan kas'}
            >
              <Save className="w-3.5 h-3.5" />
              {isLoading ? 'Menyimpan...' : 'Simpan Sebagai Draft'}
            </button>

            {/* Tombol Verifikasi Resmi */}
            <button
              type="button"
              disabled={isLoading || isCurrentlyVerified}
              onClick={handleVerify}
              className="px-5 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              {isLoading ? 'Memverifikasi...' : 'Verifikasi & Sahkan Saldo Awal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
