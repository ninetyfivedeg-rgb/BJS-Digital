import { supabase } from '../lib/supabase';
import {
  BusinessUnitId,
  BusinessUnitKey,
  BusinessUnitTransaction,
  BusinessUnitTxType,
  AuthUser,
} from '../types';
import { loadBusinessTransactions as loadLocalFallbackBusinessTransactions } from '../utils/storage';
import { formatRupiah } from '../utils/formatters';

export interface BusinessUnitRecord {
  id: string;
  unitKey: string;
  name: string;
  description?: string;
  managerName?: string;
  managerTitle?: string;
  active: boolean;
  createdAt: string;
}

export interface CreateBusinessUnitTransactionInput {
  unitId: BusinessUnitId;
  unitKey?: BusinessUnitKey;
  date: string;
  type: BusinessUnitTxType;
  amount: number;
  description: string;
  title?: string;
  partyName?: string;
  notes?: string;
  recordedBy?: string;
}

export interface CreateBusinessUnitActionResult {
  success: boolean;
  message: string;
  data?: BusinessUnitTransaction;
  error?: string;
}

/**
 * Memetakan baris dari tabel `business_units` Supabase (snake_case)
 * ke tipe `BusinessUnitRecord`.
 */
export function mapSupabaseBusinessUnit(row: any): BusinessUnitRecord {
  return {
    id: row.id,
    unitKey: row.unit_key || row.id,
    name: row.name,
    description: row.description,
    managerName: row.manager_name,
    managerTitle: row.manager_title,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

/**
 * Memetakan baris dari tabel `business_unit_transactions` Supabase (snake_case)
 * ke interface `BusinessUnitTransaction` aplikasi (camelCase).
 *
 * Kolom tabel Supabase `business_unit_transactions`:
 * - id: string
 * - unit_id: string ('apar' | 'alat_kebakaran' | 'sembako' | 'atribut')
 * - unit_key: string ('apar_refill' | 'apar_sales' | 'sembako' | 'atribut')
 * - transaction_date: string (ISO timestamp)
 * - type: string ('penjualan' | 'hpp_beli_barang' | 'beban_operasional')
 * - title: string
 * - amount: number
 * - description: string
 * - party_name: string
 * - notes: string
 * - recorded_by: string
 * - created_by: string
 * - created_at: string
 */
export function mapSupabaseBuTxToBusinessUnitTransaction(row: any): BusinessUnitTransaction {
  return {
    id: row.id,
    unitId: (row.unit_id as BusinessUnitId) || undefined,
    unitKey: (row.unit_key as BusinessUnitKey) || undefined,
    date: row.transaction_date || row.created_at || new Date().toISOString(),
    type: (row.type as BusinessUnitTxType) || 'penjualan',
    title: row.title || undefined,
    amount: Number(row.amount) || 0,
    description: row.description || undefined,
    partyName: row.party_name || undefined,
    notes: row.notes || undefined,
    recordedBy: row.recorded_by || undefined,
    createdBy: row.created_by || undefined,
  };
}

export interface FetchBusinessUnitsResponse {
  businessUnits: BusinessUnitRecord[];
  transactions: BusinessUnitTransaction[];
  error: string | null;
  fromSupabase: boolean;
  totalTransactionsCount: number;
}

/**
 * Mengambil data unit usaha dan transaksi resmi dari tabel Supabase `business_units`
 * dan `business_unit_transactions`.
 *
 * Catatan Fallback:
 * Jika terjadi kegagalan jaringan atau query Supabase, data lokal/dummy
 * dari `loadBusinessTransactions()` digunakan sebagai cadangan sementara (fallback).
 */
export async function fetchBusinessUnitsAndTransactionsFromSupabase(): Promise<FetchBusinessUnitsResponse> {
  const fallbackTx = loadLocalFallbackBusinessTransactions();

  try {
    const [unitsRes, txRes] = await Promise.all([
      supabase.from('business_units').select('*').order('created_at', { ascending: true }),
      supabase.from('business_unit_transactions').select('*').order('transaction_date', { ascending: false }),
    ]);

    if (unitsRes.error || txRes.error) {
      const errMsg = unitsRes.error?.message || txRes.error?.message || 'Gagal memuat data dari server.';
      console.warn('Gagal memuat unit usaha dari Supabase:', errMsg);
      return {
        businessUnits: [],
        transactions: fallbackTx,
        error: 'Gagal memuat data unit usaha dari server. Menampilkan data cadangan lokal.',
        fromSupabase: false,
        totalTransactionsCount: fallbackTx.length,
      };
    }

    const mappedUnits = (unitsRes.data || []).map(mapSupabaseBusinessUnit);
    const mappedTx = (txRes.data || []).map(mapSupabaseBuTxToBusinessUnitTransaction);

    const existingIds = new Set(mappedTx.map((t) => t.id));
    const combinedTx = [
      ...mappedTx,
      ...fallbackTx.filter((t) => !existingIds.has(t.id)),
    ];

    return {
      businessUnits: mappedUnits,
      transactions: combinedTx,
      error: null,
      fromSupabase: true,
      totalTransactionsCount: combinedTx.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat data unit usaha dari Supabase:', err);
    return {
      businessUnits: [],
      transactions: fallbackTx,
      error: 'Terjadi kendala jaringan saat memuat data unit usaha. Menampilkan data cadangan lokal.',
      fromSupabase: false,
      totalTransactionsCount: fallbackTx.length,
    };
  }
}

/**
 * Mencatat transaksi unit usaha baru ke tabel Supabase `business_unit_transactions`.
 *
 * VALIDASI KETAT & ATURAN KEAMANAN:
 * - Hanya role 'pengurus' yang diizinkan melakukan write. Anggota read-only.
 * - Unit Usaha harus valid ('apar', 'alat_kebakaran', 'sembako', 'atribut').
 * - Tanggal transaksi harus valid.
 * - Tipe transaksi harus valid ('penjualan', 'hpp_beli_barang', 'beban_operasional', dll).
 * - Nominal harus angka valid > 0.
 * - Uraian / keterangan wajib diisi.
 * - Tidak menulis data baru ke localStorage.
 * - Mencatat jejak audit ke tabel `audit_logs`.
 */
export async function createBusinessUnitTransaction(
  input: CreateBusinessUnitTransactionInput,
  currentUser?: AuthUser | null
): Promise<CreateBusinessUnitActionResult> {
  // 1. Role Guard
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang memiliki wewenang untuk mencatat transaksi Unit Usaha.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  // 2. Validasi Unit Usaha
  const validUnitIds: BusinessUnitId[] = ['apar', 'alat_kebakaran', 'sembako', 'atribut'];
  if (!input.unitId || !validUnitIds.includes(input.unitId)) {
    return {
      success: false,
      message: `Unit usaha "${input.unitId}" tidak valid. Pilihan valid: apar, alat_kebakaran, sembako, atau atribut.`,
      error: 'INVALID_UNIT_ID',
    };
  }

  const unitKey: BusinessUnitKey =
    input.unitKey ||
    (input.unitId === 'alat_kebakaran'
      ? 'apar_sales'
      : input.unitId === 'apar'
      ? 'apar_refill'
      : input.unitId);

  // 3. Validasi Tanggal
  const cleanDate = (input.date || '').trim() || new Date().toISOString().split('T')[0];
  if (isNaN(new Date(cleanDate).getTime())) {
    return {
      success: false,
      message: 'Tanggal transaksi unit usaha tidak valid.',
      error: 'INVALID_DATE',
    };
  }

  // 4. Validasi Tipe Transaksi
  const validTypes: BusinessUnitTxType[] = [
    'penjualan',
    'hpp_beli_barang',
    'beban_operasional',
    'pendapatan',
    'hpp',
    'operasional',
  ];
  if (!input.type || !validTypes.includes(input.type)) {
    return {
      success: false,
      message: `Tipe transaksi "${input.type}" tidak valid.`,
      error: 'INVALID_TYPE',
    };
  }

  // 5. Validasi Nominal (harus > 0)
  const amount = Number(input.amount);
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Nominal transaksi unit usaha harus berupa angka valid dan lebih besar dari 0.',
      error: 'INVALID_AMOUNT',
    };
  }

  // 6. Validasi Deskripsi / Uraian
  const cleanDescription = (input.description || input.title || '').trim();
  if (!cleanDescription) {
    return {
      success: false,
      message: 'Keterangan atau deskripsi transaksi unit usaha wajib diisi.',
      error: 'MISSING_DESCRIPTION',
    };
  }

  // 7. Generate ID Transaksi Unik
  const now = new Date();
  const datePart = cleanDate.replace(/-/g, '').slice(2); // YYMMDD
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const generatedId = `TRX-${input.unitId.toUpperCase().slice(0, 4)}-${datePart}-${Date.now().toString().slice(-4)}-${randomSuffix}`;

  // 8. Bentuk Payload Sesuai Kolom Supabase `business_unit_transactions`
  const insertPayload = {
    id: generatedId,
    unit_id: input.unitId,
    unit_key: unitKey,
    transaction_date: cleanDate,
    type: input.type,
    title: input.title?.trim() || cleanDescription,
    amount: amount,
    description: cleanDescription,
    party_name: input.partyName?.trim() || null,
    notes: input.notes?.trim() || null,
    recorded_by:
      input.recordedBy?.trim() ||
      currentUser.name ||
      currentUser.username ||
      'Pengurus BJS',
    created_by: currentUser.username || currentUser.id || 'Pengurus BJS',
    created_at: new Date().toISOString(),
  };

  try {
    // 9. INSERT ke tabel `business_unit_transactions` Supabase
    const { data, error } = await supabase
      .from('business_unit_transactions')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Gagal mencatat transaksi unit usaha ke Supabase:', error);
      return {
        success: false,
        message: `Gagal mencatat transaksi unit usaha ke server database: ${error.message}`,
        error: error.message,
      };
    }

    // 10. Catat ke tabel `audit_logs`
    const typeLabel =
      input.type === 'penjualan' || input.type === 'pendapatan'
        ? 'Penjualan/Pendapatan Omset'
        : input.type === 'hpp_beli_barang' || input.type === 'hpp'
        ? 'Pembelian Stok/HPP'
        : 'Beban Operasional Unit';

    try {
      const auditPayload = {
        id: `LOG-BU-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'CREATE_BUSINESS_UNIT_TRANSACTION',
        entity_type: 'business_unit_transactions',
        entity_id: generatedId,
        description: `Mencatat ${typeLabel} pada Unit Usaha ${input.unitId.toUpperCase()} sebesar ${formatRupiah(amount)} - ${cleanDescription}`,
        new_data: insertPayload,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log transaksi unit usaha:', auditErr);
    }

    const insertedRecord = mapSupabaseBuTxToBusinessUnitTransaction(data || insertPayload);

    return {
      success: true,
      message: `Transaksi ${typeLabel} sebesar ${formatRupiah(amount)} pada Unit Usaha ${input.unitId.toUpperCase()} berhasil dicatat resmi di server database.`,
      data: insertedRecord,
    };
  } catch (err: any) {
    console.error('Pengecualian saat mencatat transaksi unit usaha:', err);
    return {
      success: false,
      message: `Terjadi kendala jaringan saat menyimpan transaksi unit usaha: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Menghapus transaksi unit usaha dari Supabase `business_unit_transactions`.
 */
export async function deleteBusinessUnitTransaction(
  id: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang memiliki wewenang untuk menghapus transaksi unit usaha.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('business_unit_transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return {
        success: false,
        message: 'Transaksi unit usaha tidak ditemukan dalam database.',
        error: 'NOT_FOUND',
      };
    }

    const { error: delErr } = await supabase
      .from('business_unit_transactions')
      .delete()
      .eq('id', id);

    if (delErr) {
      return {
        success: false,
        message: `Gagal menghapus transaksi unit usaha: ${delErr.message}`,
        error: delErr.message,
      };
    }

    try {
      const auditPayload = {
        id: `LOG-DEL-BU-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'DELETE_BUSINESS_UNIT_TRANSACTION',
        entity_type: 'business_unit_transactions',
        entity_id: id,
        description: `Menghapus transaksi unit usaha ${id} (${formatRupiah(existing.amount)}) - ${existing.description}`,
        new_data: { deletedRecord: existing },
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return {
      success: true,
      message: 'Transaksi unit usaha berhasil dihapus dari server.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Terjadi kendala jaringan: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

