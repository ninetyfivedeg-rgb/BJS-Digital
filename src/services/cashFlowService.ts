import { supabase } from '../lib/supabase';
import { CashFlowRecord, AuthUser } from '../types';
import { loadCashFlow as loadLocalFallbackCashFlow } from '../utils/storage';
import { formatRupiah } from '../utils/formatters';

export interface CreateCashFlowInput {
  date: string;
  type: 'masuk' | 'keluar';
  category?: CashFlowRecord['category'];
  amount: number;
  description: string;
  referenceId?: string;
  targetAccount?: 'kas_koperasi' | 'kas_bank';
}

export interface CreateCashFlowActionResult {
  success: boolean;
  message: string;
  data?: CashFlowRecord;
  error?: string;
}

/**
 * Memetakan baris dari tabel `cash_flow_records` Supabase (snake_case)
 * ke interface `CashFlowRecord` aplikasi (camelCase).
 *
 * Kolom tabel Supabase `cash_flow_records`:
 * - id: string
 * - transaction_date: string
 * - type: string ('masuk' | 'keluar')
 * - category: string
 * - amount: number
 * - description: string
 * - reference_id: string
 * - target_account: string ('kas_koperasi' | 'kas_bank')
 * - created_at: string
 */
export function mapSupabaseCashFlowToCashFlow(row: any): CashFlowRecord {
  return {
    id: row.id,
    date: row.transaction_date || row.created_at || new Date().toISOString(),
    type: (row.type as 'masuk' | 'keluar') || 'masuk',
    category: row.category || 'operasional',
    amount: Number(row.amount) || 0,
    referenceId: row.reference_id || row.referenceId || row.id || '',
    description: row.description || '',
    targetAccount: row.target_account || row.targetAccount || 'kas_koperasi',
  };
}

export interface FetchCashFlowResponse {
  cashFlow: CashFlowRecord[];
  error: string | null;
  fromSupabase: boolean;
  totalCount: number;
}

/**
 * Mengambil data buku mutasi kas dari tabel Supabase `cash_flow_records`.
 *
 * Catatan Fallback:
 * Jika terjadi kegagalan jaringan atau query Supabase, data lokal/dummy
 * dari `loadCashFlow()` digunakan sebagai cadangan sementara (fallback).
 */
export async function fetchCashFlowFromSupabase(): Promise<FetchCashFlowResponse> {
  try {
    const { data, error } = await supabase
      .from('cash_flow_records')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.warn('Gagal memuat arus kas dari Supabase:', error.message);
      const fallback = loadLocalFallbackCashFlow();
      return {
        cashFlow: fallback,
        error: 'Gagal mengambil data buku kas dari server. Menampilkan data cadangan lokal.',
        fromSupabase: false,
        totalCount: fallback.length,
      };
    }

    if (data && Array.isArray(data)) {
      const mapped = data.map(mapSupabaseCashFlowToCashFlow);
      return {
        cashFlow: mapped,
        error: null,
        fromSupabase: true,
        totalCount: mapped.length,
      };
    }

    const fallback = loadLocalFallbackCashFlow();
    return {
      cashFlow: fallback,
      error: null,
      fromSupabase: false,
      totalCount: fallback.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat buku kas dari Supabase:', err);
    const fallback = loadLocalFallbackCashFlow();
    return {
      cashFlow: fallback,
      error: 'Terjadi kendala jaringan saat memuat buku kas. Menampilkan data cadangan lokal.',
      fromSupabase: false,
      totalCount: fallback.length,
    };
  }
}

/**
 * Mencatat transaksi mutasi kas baru ke tabel Supabase `cash_flow_records`.
 *
 * VALIDASI KETAT & ATURAN KEAMANAN:
 * - Hanya role 'pengurus' yang diizinkan melakukan write. Anggota read-only.
 * - Tanggal transaksi harus valid.
 * - Tipe arus kas harus 'masuk' atau 'keluar'.
 * - Nominal harus angka valid > 0.
 * - Uraian / keterangan wajib diisi.
 * - Pemisahan kas fisik ('kas_koperasi') vs kas bank ('kas_bank') dijaga ketat.
 * - Kategori 'saldo_awal' dilarang dibuat melalui form ini (harus lewat Rekonsiliasi).
 * - Tidak menulis data baru ke localStorage.
 * - Mencatat jejak audit ke tabel `audit_logs`.
 */
export async function createCashFlowRecord(
  input: CreateCashFlowInput,
  currentUser?: AuthUser | null
): Promise<CreateCashFlowActionResult> {
  // 1. Role Guard: Hanya pengurus yang berhak mencatat mutasi kas
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus/Bendahara yang memiliki wewenang untuk mencatat mutasi kas.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  // 2. Validasi Tanggal
  const cleanDate = (input.date || '').trim() || new Date().toISOString().split('T')[0];
  if (isNaN(new Date(cleanDate).getTime())) {
    return {
      success: false,
      message: 'Format tanggal transaksi kas tidak valid.',
      error: 'INVALID_DATE',
    };
  }

  // 3. Validasi Tipe Arus Kas
  if (input.type !== 'masuk' && input.type !== 'keluar') {
    return {
      success: false,
      message: 'Arah arus kas tidak valid. Harus pemasukan (masuk) atau pengeluaran (keluar).',
      error: 'INVALID_TYPE',
    };
  }

  // 4. Validasi Kategori: Blokir 'saldo_awal' agar tidak merusak rekonsiliasi
  if (input.category === 'saldo_awal') {
    return {
      success: false,
      message: 'Kategori "saldo_awal" tidak dapat dibuat lewat transaksi kas biasa. Gunakan menu resmi Rekonsiliasi Saldo Awal.',
      error: 'SALDO_AWAL_RESTRICTED',
    };
  }

  const allowedCategories: CashFlowRecord['category'][] = [
    'operasional',
    'operasional_sp',
    'biaya_admin',
    'unit_usaha',
    'simpanan',
    'tarik_simpanan',
    'pencairan_pinjaman',
    'angsuran_pokok',
    'angsuran_bunga',
  ];

  const category = input.category && allowedCategories.includes(input.category)
    ? input.category
    : 'operasional';

  // 5. Validasi Nominal (harus > 0)
  const amount = Number(input.amount);
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Nominal transaksi kas harus berupa angka valid dan lebih besar dari 0.',
      error: 'INVALID_AMOUNT',
    };
  }

  // 6. Validasi Deskripsi / Uraian
  const cleanDescription = (input.description || '').trim();
  if (!cleanDescription) {
    return {
      success: false,
      message: 'Uraian atau keterangan transaksi kas wajib diisi.',
      error: 'MISSING_DESCRIPTION',
    };
  }

  // 7. Pemisahan Kas Fisik vs Kas Bank
  const targetAccount: 'kas_koperasi' | 'kas_bank' =
    input.targetAccount === 'kas_bank' ? 'kas_bank' : 'kas_koperasi';

  // 8. Generate ID Unik dan Nomor Referensi
  const now = new Date();
  const datePart = cleanDate.replace(/-/g, '').slice(2); // YYMMDD
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = input.type === 'masuk' ? 'CSH-IN' : 'CSH-OUT';
  const generatedId = `${prefix}-${datePart}-${Date.now().toString().slice(-4)}-${randomSuffix}`;
  const refId =
    input.referenceId?.trim() ||
    `${input.type === 'masuk' ? 'BM' : 'BK'}-${datePart}-${Date.now().toString().slice(-4)}`;

  // 9. Bentuk Payload Sesuai Kolom Supabase `cash_flow_records`
  const insertPayload = {
    id: generatedId,
    transaction_date: cleanDate,
    type: input.type,
    category: category,
    amount: amount,
    reference_id: refId,
    description: cleanDescription,
    target_account: targetAccount,
    created_at: new Date().toISOString(),
  };

  try {
    // 10. INSERT ke tabel `cash_flow_records` Supabase
    const { data, error } = await supabase
      .from('cash_flow_records')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Gagal mencatat transaksi kas ke Supabase:', error);
      return {
        success: false,
        message: `Gagal mencatat transaksi kas ke server database: ${error.message}`,
        error: error.message,
      };
    }

    // 11. Catat ke tabel `audit_logs`
    const accountLabel = targetAccount === 'kas_bank' ? 'Kas di Bank' : 'Kas Tunai Fisik';
    const typeLabel = input.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
    try {
      const auditPayload = {
        id: `LOG-CSH-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'CREATE_CASH_FLOW',
        entity_type: 'cash_flow_records',
        entity_id: generatedId,
        description: `Mencatat ${typeLabel} (${accountLabel}) sebesar ${formatRupiah(amount)} - ${cleanDescription}`,
        new_data: insertPayload,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log mutasi kas:', auditErr);
    }

    const insertedRecord = mapSupabaseCashFlowToCashFlow(data || insertPayload);

    return {
      success: true,
      message: `${typeLabel} sebesar ${formatRupiah(amount)} (${accountLabel}) berhasil dicatat resmi di server database.`,
      data: insertedRecord,
    };
  } catch (err: any) {
    console.error('Pengecualian saat mencatat mutasi kas:', err);
    return {
      success: false,
      message: `Terjadi kendala jaringan saat menyimpan transaksi kas: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Menghapus transaksi kas operasional dari Supabase `cash_flow_records`.
 * Melarang penghapusan mutasi saldo awal.
 */
export async function deleteCashFlowRecord(
  id: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang memiliki wewenang untuk menghapus mutasi kas.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('cash_flow_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return {
        success: false,
        message: 'Transaksi kas tidak ditemukan dalam database.',
        error: 'NOT_FOUND',
      };
    }

    if (existing.category === 'saldo_awal') {
      return {
        success: false,
        message: 'Mutasi saldo awal tidak dapat dihapus sembarangan. Gunakan fitur Reversal Rekonsiliasi Saldo Awal.',
        error: 'CANNOT_DELETE_SALDO_AWAL',
      };
    }

    const { error: delErr } = await supabase
      .from('cash_flow_records')
      .delete()
      .eq('id', id);

    if (delErr) {
      return {
        success: false,
        message: `Gagal menghapus transaksi kas: ${delErr.message}`,
        error: delErr.message,
      };
    }

    try {
      const auditPayload = {
        id: `LOG-DEL-CSH-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'DELETE_CASH_FLOW',
        entity_type: 'cash_flow_records',
        entity_id: id,
        description: `Menghapus mutasi kas ${id} (${formatRupiah(existing.amount)}) - ${existing.description}`,
        new_data: { deletedRecord: existing },
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return {
      success: true,
      message: 'Transaksi kas berhasil dihapus dari server.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Terjadi kendala jaringan: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

