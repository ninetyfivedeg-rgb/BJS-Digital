import React from 'react';
import { Printer, X, CheckCircle2, Download } from 'lucide-react';
import { formatRupiah, formatDateIndo, terbilangRupiah } from '../utils/formatters';
import { printHtmlContent } from '../utils/printHelper';
import { KOPERASI_OFFICIALS } from '../types';

export interface ReceiptData {
  receiptNo: string;
  title: string;
  date: string;
  memberName: string;
  memberId: string;
  amount: number;
  typeText: string;
  savingsType?: string;
  adminName?: string;
  notes?: string;
  breakdown?: { label: string; value: string }[];
  officerName?: string;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const defaultOfficer = receipt.officerName || `${KOPERASI_OFFICIALS.bendahara} (Bendahara)`;

  const handlePrint = () => {
    const breakdownHtml = receipt.breakdown && receipt.breakdown.length > 0
      ? `
        <div style="margin: 12px 0; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div style="font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 6px;">RINCIAN TRANSAKSI:</div>
          ${receipt.breakdown.map((item) => `
            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e2e8f0; font-size: 11px;">
              <span style="color: #64748b;">${item.label}</span>
              <span style="font-weight: 600; font-family: monospace;">${item.value}</span>
            </div>
          `).join('')}
        </div>
      `
      : '';

    const receiptHtml = `
      <div class="header-kop">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;">
          <img src="/logo-bjs.png" style="height: 50px; width: auto; object-fit: contain;" />
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">KOPERASI BRAMA JAYA SEJAHTERA</h1>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK Koperasi</p>
          </div>
        </div>
      </div>

      <div class="document-title">${receipt.title.toUpperCase()}</div>
      <div class="doc-number">No. Kwitansi: <strong>${receipt.receiptNo}</strong> &bull; Tanggal: ${formatDateIndo(receipt.date)}</div>

      <div class="content-box">
        <table>
          <tr>
            <td class="label">Telah Diterima Dari</td>
            <td class="colon">:</td>
            <td class="value">${receipt.memberName} <span style="font-size: 11px; color: #64748b;">(${receipt.memberId})</span></td>
          </tr>
          <tr>
            <td class="label">Jenis Transaksi</td>
            <td class="colon">:</td>
            <td class="value">${receipt.typeText}</td>
          </tr>
          <tr>
            <td class="label">Jumlah Pembayaran</td>
            <td class="colon">:</td>
            <td class="value" style="font-size: 16px; color: #047857; font-family: monospace;">${formatRupiah(receipt.amount)}</td>
          </tr>
          <tr>
            <td class="label">Terbilang</td>
            <td class="colon">:</td>
            <td class="value" style="font-style: italic; background: #fffbeb; padding: 6px; border: 1px solid #fef3c7; border-radius: 4px;">
              "${terbilangRupiah(receipt.amount)}"
            </td>
          </tr>
          ${receipt.notes ? `
          <tr>
            <td class="label">Keterangan Tambahan</td>
            <td class="colon">:</td>
            <td class="value" style="font-weight: normal; color: #475569;">${receipt.notes}</td>
          </tr>` : ''}
        </table>

        ${breakdownHtml}
      </div>

      <div class="signatures" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 25px; text-align: center;">
        <div class="signature-col">
          <p class="signature-role" style="font-size: 11px;">Anggota / Penyetor,</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${receipt.memberName}</span>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">ID: ${receipt.memberId}</div>
        </div>

        <div class="signature-col">
          <p class="signature-role" style="font-size: 11px;">Pengelola Simpan Pinjam,</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${KOPERASI_OFFICIALS.pengelolaSimpanPinjam}</span>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Unit Simpan Pinjam BJS</div>
        </div>

        <div class="signature-col">
          <p class="signature-role" style="font-size: 11px;">Bendahara Koperasi,</p>
          <div class="signature-space" style="height: 48px;"></div>
          <span class="signature-name" style="font-weight: bold; font-size: 11px; text-decoration: underline;">${KOPERASI_OFFICIALS.bendahara}</span>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Bagian Keuangan KSP</div>
        </div>
      </div>

      <div class="footer-note">
        Dokumen ini merupakan bukti sah pencatatan akuntansi pada sistem Koperasi Brama Jaya Sejahtera.
      </div>
    `;

    printHtmlContent(receiptHtml, `Kwitansi-${receipt.receiptNo}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Kwitansi Transaksi Berhasil</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 hover:bg-blue-950 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / Unduh PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Official Receipt Paper */}
        <div id="printable-receipt" className="p-8 bg-amber-50/20 text-slate-800">
          {/* Header Kop Koperasi */}
          <div className="border-b-2 border-blue-900 pb-4 flex items-center justify-between gap-4">
            <div className="w-16 h-16 p-1 bg-white rounded-lg border border-slate-200 shrink-0 flex items-center justify-center">
              <img
                src="/logo-bjs.png"
                alt="Logo BJS"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-right flex-1">
              <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                KOPERASI BRAMA JAYA SEJAHTERA
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023 | SAK Koperasi
              </p>
              <p className="text-[11px] text-slate-500">
                Sistem Akuntansi Simpan Pinjam Digital
              </p>
            </div>
          </div>

          {/* Receipt Title & Number */}
          <div className="flex justify-between items-center mt-5 mb-6 text-xs">
            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider block">Jenis Bukti:</span>
              <span className="text-sm font-bold text-emerald-800">{receipt.title}</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-slate-500 uppercase tracking-wider block">No. Kwitansi:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{receipt.receiptNo}</span>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm space-y-2.5">
            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500">Nama Anggota</span>
              <span className="col-span-2 font-semibold text-slate-900">
                {receipt.memberName} <span className="text-xs text-slate-500 font-mono font-normal">({receipt.memberId})</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500">Tanggal Transaksi</span>
              <span className="col-span-2 font-medium text-slate-800">{formatDateIndo(receipt.date)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500">Transaksi</span>
              <span className="col-span-2 font-medium text-slate-800">{receipt.typeText}</span>
            </div>

            {receipt.breakdown && receipt.breakdown.length > 0 && (
              <div className="pt-1 pb-1 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 block mb-1">Rincian:</span>
                <div className="bg-slate-50 rounded-md p-2 space-y-1 text-xs">
                  {receipt.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-slate-600">{item.label}:</span>
                      <span className="font-mono font-medium text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-200 items-baseline">
              <span className="text-slate-500 font-semibold">Jumlah Nominal</span>
              <span className="col-span-2 font-bold text-emerald-800 text-lg font-mono">
                {formatRupiah(receipt.amount)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <span className="text-slate-500 text-xs italic">Terbilang</span>
              <span className="col-span-2 text-xs italic text-slate-700 bg-amber-50/50 p-2 rounded border border-amber-100">
                "{terbilangRupiah(receipt.amount)}"
              </span>
            </div>

            {receipt.notes && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <span className="text-slate-500 text-xs">Keterangan</span>
                <span className="col-span-2 text-xs text-slate-600">{receipt.notes}</span>
              </div>
            )}
          </div>

          {/* Signature Sections with Real Officials */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-slate-600">
            <div>
              <p className="mb-14 text-[11px] font-medium">Anggota / Penyetor,</p>
              <p className="font-semibold text-slate-900 underline text-xs">{receipt.memberName}</p>
              <p className="text-[10px] text-slate-400">ID: {receipt.memberId}</p>
            </div>
            <div>
              <p className="mb-14 text-[11px] font-medium">Bendahara,</p>
              <p className="font-semibold text-slate-900 underline text-xs">{KOPERASI_OFFICIALS.bendahara}</p>
              <p className="text-[10px] text-slate-400">Pengurus Keuangan</p>
            </div>
            <div>
              <p className="mb-14 text-[11px] font-medium">Ketua Koperasi,</p>
              <p className="font-semibold text-slate-900 underline text-xs">{KOPERASI_OFFICIALS.ketua}</p>
              <p className="text-[10px] text-slate-400">Ketua Pengurus</p>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-400">
            Simpan kwitansi ini sebagai bukti sah transaksi di Koperasi Brama Jaya Sejahtera.
          </div>
        </div>

        {/* Bottom Actions (Hidden in print) */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak / Unduh PDF
          </button>
        </div>
      </div>
    </div>
  );
};
