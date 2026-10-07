import { supabase } from '../lib/supabase';
import { AuthUser, OpeningReconciliationData, CashFlowRecord } from '../types';
import { formatRupiah } from '../utils/formatters';

export interface ReconciliationActionResult {
  success: boolean;
  message: string;
  reconciliation?: OpeningReconciliationData;
  error?: string;
}

/**
 * Menemukan rekonsiliasi berstatus VERIFIED yang saat ini aktif (belum dibatalkan/reversed).
 * Memeriksa riwayat audit_logs dengan menelusuri status terbaru untuk setiap Berita Acara (BA).
 */
export function findActiveVerifiedReconciliation(logs: any[]): OpeningReconciliationData | null {
  if (!logs || logs.length === 0) return null;

  // Telusuri dari yang terbaru ke terlama
  // Kumpulkan status terbaru untuk setiap nomor BA/entity_id
  const baStatusMap = new Map<string, string>(); // baNumber -> 'verified' | 'reversed' | 'draft'
  const baDataMap = new Map<string, OpeningReconciliationData>();

  for (const log of logs) {
    const rawData = log.new_data || log.old_data;
    const ba = (rawData?.baNumber || log.entity_id || '').trim();
    if (!ba) continue;

    let logStatus: string = rawData?.status || '';
    if (log.action === 'REVERSE_OPENING_BALANCE') {
      logStatus = 'reversed';
    } else if (log.action === 'VERIFY_OPENING_BALANCE') {
      if (logStatus !== 'reversed' && logStatus !== 'draft') {
        logStatus = 'verified';
      }
    }

    // Catat hanya status paling mutakhir untuk setiap nomor BA
    if (!baStatusMap.has(ba)) {
      baStatusMap.set(ba, logStatus);
      if (rawData) {
        baDataMap.set(ba, {
          ...rawData,
          recordedAt: rawData.recordedAt || log.created_at,
        });
      }
    }
  }

  // Cari apakah ada nomor BA yang status terbarunya adalah 'verified'
  for (const [ba, status] of baStatusMap.entries()) {
    if (status === 'verified') {
      const rec = baDataMap.get(ba);
      if (rec) return rec;
    }
  }

  return null;
}

/**
 * Mengambil status dan metadata rekonsiliasi saldo awal terakhir dari Supabase `audit_logs`.
 * Membaca entitas dengan entity_type = 'opening_reconciliation'.
 * Mengutamakan status verified aktif jika ada; jika tidak ada, mengambil log draft/reversal terkini.
 */
export async function fetchLatestOpeningReconciliation(): Promise<{
  reconciliation: OpeningReconciliationData | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'opening_reconciliation')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Gagal memuat status rekonsiliasi dari audit_logs:', error.message);
      return { reconciliation: null, error: error.message };
    }

    if (!data || data.length === 0) {
      return { reconciliation: null, error: null };
    }

    // 1. Cek apakah ada rekonsiliasi verified yang masih aktif (belum di-reversal)
    const activeVerified = findActiveVerifiedReconciliation(data);
    if (activeVerified) {
      return {
        reconciliation: activeVerified,
        error: null,
      };
    }

    // 2. Jika tidak ada verified aktif, kembalikan log rekonsiliasi paling mutakhir (draft atau reversed)
    const latestLog = data[0];
    const recData = (latestLog.new_data || latestLog.old_data) as OpeningReconciliationData;

    if (!recData) {
      return { reconciliation: null, error: null };
    }

    return {
      reconciliation: {
        ...recData,
        recordedAt: recData.recordedAt || latestLog.created_at,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Pengecualian saat memuat rekonsiliasi:', err);
    return { reconciliation: null, error: err.message || 'Kendala jaringan' };
  }
}

/**
 * Menyimpan DRAFT Rekonsiliasi Saldo Awal.
 * ATURAN KERAS:
 * - JANGAN membuat cash_flow_records.
 * - Draft BUKAN aset dan tidak boleh masuk ke perhitungan neraca atau buku kas.
 * - Disimpan murni ke tabel `audit_logs` sebagai jejak rencana/pengajuan.
 */
export async function saveOpeningReconciliationDraft(
  data: Omit<OpeningReconciliationData, 'status' | 'recordedAt' | 'recordedBy'>,
  currentUser?: AuthUser | null
): Promise<ReconciliationActionResult> {
  try {
    const safeBank = Math.max(0, Number(data.verifiedBank) || 0);
    const safeCash = Math.max(0, Number(data.verifiedCash) || 0);
    const totalVerified = safeBank + safeCash;
    const diff = data.historicalSavings - totalVerified;

    const draftData: OpeningReconciliationData = {
      ...data,
      verifiedBank: safeBank,
      verifiedCash: safeCash,
      totalVerified,
      difference: diff,
      status: 'draft',
      recordedBy: currentUser?.name || currentUser?.username || 'Pengurus BJS',
      recordedAt: new Date().toISOString(),
    };

    const auditPayload = {
      id: `LOG-DRAFT-${Date.now()}`,
      user_id: currentUser?.id || undefined,
      actor_name: currentUser?.name || currentUser?.username || 'Pengurus/Bendahara BJS',
      actor_role: currentUser?.role || 'pengurus',
      action: 'VERIFY_OPENING_BALANCE',
      entity_type: 'opening_reconciliation',
      entity_id: data.baNumber?.trim() || `DRAFT-${Date.now()}`,
      description: `Menyimpan Draft Rekonsiliasi Saldo Awal (Bank: ${formatRupiah(safeBank)}, Kas: ${formatRupiah(safeCash)}, Selisih Historis: ${formatRupiah(diff)})`,
      new_data: draftData,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('audit_logs').insert([auditPayload]);

    if (error) {
      console.error('Gagal menyimpan draft ke audit_logs:', error);
      return {
        success: false,
        message: 'Gagal menyimpan draft rekonsiliasi ke server.',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Draft rekonsiliasi saldo awal berhasil disimpan (belum masuk ke aktiva kas).',
      reconciliation: draftData,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Terjadi kendala saat menyimpan draft.',
      error: err.message,
    };
  }
}

/**
 * Memverifikasi & Mengesahkan Rekonsiliasi Saldo Awal (VERIFIED).
 * ATURAN KERAS:
 * - Wajib ada nomor Berita Acara (BA) resmi.
 * - Memeriksa duplikasi: jika sudah ada rekonsiliasi VERIFIED aktif, tolak dengan meminta reversal terlebih dahulu.
 * - HANYA kas/bank terverifikasi yang dimasukkan ke `cash_flow_records` (type: 'masuk', category: 'saldo_awal').
 * - Selisih historis TIDAK dimasukkan ke kas atau aset apa pun.
 * - Dicatat secara permanen ke `audit_logs`.
 */
export async function verifyOpeningReconciliation(
  data: Omit<OpeningReconciliationData, 'status' | 'verifiedAt' | 'verifiedBy' | 'recordedAt' | 'recordedBy'>,
  currentUser?: AuthUser | null
): Promise<ReconciliationActionResult> {
  try {
    const cleanBa = data.baNumber?.trim();
    if (!cleanBa) {
      return {
        success: false,
        message: 'Nomor Berita Acara (BA) Rekonsiliasi wajib diisi untuk verifikasi resmi.',
      };
    }

    // 1. Cek validasi duplikasi: Cek apakah sudah ada rekonsiliasi berstatus VERIFIED yang belum dibatalkan (reversed)
    const { data: existingLogs, error: checkError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'opening_reconciliation')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!checkError && existingLogs && existingLogs.length > 0) {
      const activeVerified = findActiveVerifiedReconciliation(existingLogs);
      if (activeVerified) {
        return {
          success: false,
          message: `Sudah ada Saldo Awal Terverifikasi aktif dengan BA: "${activeVerified.baNumber}". Harap lakukan Reversal/Pembatalan terlebih dahulu sebelum mengesahkan saldo awal baru.`,
        };
      }
    }

    const safeBank = Math.max(0, Number(data.verifiedBank) || 0);
    const safeCash = Math.max(0, Number(data.verifiedCash) || 0);
    const totalVerified = safeBank + safeCash;
    const diff = data.historicalSavings - totalVerified;

    const verifiedRecord: OpeningReconciliationData = {
      ...data,
      baNumber: cleanBa,
      verifiedBank: safeBank,
      verifiedCash: safeCash,
      totalVerified,
      difference: diff,
      status: 'verified',
      recordedAt: new Date().toISOString(),
      recordedBy: currentUser?.name || currentUser?.username || 'Pengurus BJS',
      verifiedBy: currentUser?.name || currentUser?.username || 'Pengurus BJS',
      verifiedAt: new Date().toISOString(),
    };

    // 2. Masukkan ke cash_flow_records HANYA untuk nominal fisik terverifikasi > 0
    const cashFlowInserts: any[] = [];
    const nowTimestamp = Date.now();

    if (safeBank > 0) {
      cashFlowInserts.push({
        id: `CSH-REC-BNK-${nowTimestamp}`,
        transaction_date: data.cutoffDate || new Date().toISOString().split('T')[0],
        type: 'masuk',
        category: 'saldo_awal',
        target_account: 'kas_bank',
        amount: safeBank,
        reference_id: cleanBa,
        description: `Saldo Awal Bank Terverifikasi - ${data.bankName || 'Bank Koperasi'} (Rek: ${data.accountNumber || '-'}) - BA: ${cleanBa}`,
      });
    }

    if (safeCash > 0) {
      cashFlowInserts.push({
        id: `CSH-REC-CSH-${nowTimestamp + 1}`,
        transaction_date: data.cutoffDate || new Date().toISOString().split('T')[0],
        type: 'masuk',
        category: 'saldo_awal',
        target_account: 'kas_koperasi',
        amount: safeCash,
        reference_id: cleanBa,
        description: `Saldo Awal Kas Fisik Terverifikasi - ${data.cashLocation || 'Brankas Utama'} - BA: ${cleanBa}`,
      });
    }

    if (cashFlowInserts.length > 0) {
      const { error: cfError } = await supabase
        .from('cash_flow_records')
        .insert(cashFlowInserts);

      if (cfError) {
        console.error('Gagal memasukkan saldo awal ke cash_flow_records:', cfError);
        return {
          success: false,
          message: `Gagal mencatat mutasi kas saldo awal ke database: ${cfError.message}`,
        };
      }
    }

    // 3. Catat status VERIFIED ke audit_logs
    const auditPayload = {
      id: `LOG-VERIFY-${nowTimestamp}`,
      user_id: currentUser?.id || undefined,
      actor_name: currentUser?.name || currentUser?.username || 'Pengurus/Bendahara BJS',
      actor_role: currentUser?.role || 'pengurus',
      action: 'VERIFY_OPENING_BALANCE',
      entity_type: 'opening_reconciliation',
      entity_id: cleanBa,
      description: `Pengesahan Verifikasi Saldo Awal Kas & Bank (Total Terverifikasi: ${formatRupiah(totalVerified)}, Selisih Historis Terbuka: ${formatRupiah(diff)}) - BA: ${cleanBa}`,
      new_data: verifiedRecord,
      created_at: new Date().toISOString(),
    };

    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert([auditPayload]);

    if (auditError) {
      console.warn('Gagal mencatat verifikasi ke audit_logs:', auditError.message);
    }

    return {
      success: true,
      message: `Saldo awal berhasil diverifikasi resmi dengan BA: ${cleanBa}. Saldo kas/bank terverifikasi telah masuk ke pembukuan.`,
      reconciliation: verifiedRecord,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Terjadi pengecualian saat memverifikasi saldo awal.',
      error: err.message,
    };
  }
}

/**
 * Melakukan Reversal / Pembatalan Rekonsiliasi Saldo Awal.
 * ATURAN KERAS:
 * - TIDAK hard delete.
 * - Wajib mencantumkan alasan reversal.
 * - Membuat contra-entry di `cash_flow_records` (type: 'keluar', category: 'saldo_awal') untuk membalik saldo.
 * - Mencatat ke `audit_logs` dengan action: 'REVERSE_OPENING_BALANCE' dan status: 'reversed'.
 */
export async function reverseOpeningReconciliation(
  reversalReason: string,
  currentReconciliation: OpeningReconciliationData,
  currentUser?: AuthUser | null
): Promise<ReconciliationActionResult> {
  try {
    const cleanReason = reversalReason?.trim();
    if (!cleanReason) {
      return {
        success: false,
        message: 'Alasan pembatalan/reversal wajib diisi secara rinci untuk kepatuhan audit.',
      };
    }

    const nowTimestamp = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const contraEntries: any[] = [];

    // Buat contra entry untuk kas/bank yang sebelumnya dimasukkan
    if (currentReconciliation.verifiedBank > 0) {
      contraEntries.push({
        id: `CSH-REV-BNK-${nowTimestamp}`,
        transaction_date: todayStr,
        type: 'keluar',
        category: 'saldo_awal',
        target_account: 'kas_bank',
        amount: currentReconciliation.verifiedBank,
        reference_id: `REV-${currentReconciliation.baNumber}`,
        description: `Pembatalan / Reversal Saldo Awal Bank - Ref BA: ${currentReconciliation.baNumber} - Alasan: ${cleanReason}`,
      });
    }

    if (currentReconciliation.verifiedCash > 0) {
      contraEntries.push({
        id: `CSH-REV-CSH-${nowTimestamp + 1}`,
        transaction_date: todayStr,
        type: 'keluar',
        category: 'saldo_awal',
        target_account: 'kas_koperasi',
        amount: currentReconciliation.verifiedCash,
        reference_id: `REV-${currentReconciliation.baNumber}`,
        description: `Pembatalan / Reversal Saldo Awal Kas Fisik - Ref BA: ${currentReconciliation.baNumber} - Alasan: ${cleanReason}`,
      });
    }

    if (contraEntries.length > 0) {
      const { error: cfError } = await supabase
        .from('cash_flow_records')
        .insert(contraEntries);

      if (cfError) {
        console.error('Gagal memasukkan contra-entry ke cash_flow_records:', cfError);
        return {
          success: false,
          message: `Gagal membalik saldo kas/bank di buku kas: ${cfError.message}`,
        };
      }
    }

    const reversedData: OpeningReconciliationData = {
      ...currentReconciliation,
      status: 'reversed',
      reversalReason: cleanReason,
      reversedBy: currentUser?.name || currentUser?.username || 'Pengurus BJS',
      reversedAt: new Date().toISOString(),
    };

    // Catat log reversal ke audit_logs
    const auditPayload = {
      id: `LOG-REVERSAL-${nowTimestamp}`,
      user_id: currentUser?.id || undefined,
      actor_name: currentUser?.name || currentUser?.username || 'Pengurus/Bendahara BJS',
      actor_role: currentUser?.role || 'pengurus',
      action: 'REVERSE_OPENING_BALANCE',
      entity_type: 'opening_reconciliation',
      entity_id: currentReconciliation.baNumber,
      description: `Pembatalan / Reversal Saldo Awal Kas & Bank - BA: ${currentReconciliation.baNumber} - Alasan: ${cleanReason}`,
      old_data: currentReconciliation,
      new_data: reversedData,
      created_at: new Date().toISOString(),
    };

    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert([auditPayload]);

    if (auditError) {
      console.warn('Gagal mencatat reversal ke audit_logs:', auditError.message);
    }

    return {
      success: true,
      message: `Rekonsiliasi saldo awal BA: ${currentReconciliation.baNumber} berhasil dibatalkan (reversal). Saldo aktiva kas dikembalikan ke posisi semula.`,
      reconciliation: reversedData,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Terjadi kendala saat melakukan reversal saldo awal.',
      error: err.message,
    };
  }
}
