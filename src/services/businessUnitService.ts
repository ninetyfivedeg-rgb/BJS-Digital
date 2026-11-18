import { supabase } from '../lib/supabase';
import {
  BusinessUnitId,
  BusinessUnitKey,
  BusinessUnitTransaction,
  BusinessUnitTxType,
  AuthUser,
} from '../types';
import { sanitizeUuid } from '../utils/storage';
import { canManageBusinessUnit } from '../utils/permissions';
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
 */
export function mapSupabaseBuTxToBusinessUnitTransaction(row: any): BusinessUnitTransaction {
  let resolvedUnitId = (row.unit_id as BusinessUnitId) || undefined;
  let resolvedUnitKey = (row.unit_key as BusinessUnitKey) || undefined;

  if (!resolvedUnitId && row.business_unit_id) {
    if (typeof row.business_unit_id === 'string' && !sanitizeUuid(row.business_unit_id)) {
      resolvedUnitId = row.business_unit_id as BusinessUnitId;
    }
  }

  return {
    id: row.id,
    unitId: resolvedUnitId,
    unitKey: resolvedUnitKey,
    date: row.transaction_date || row.created_at || new Date().toISOString(),
    type: (row.type as BusinessUnitTxType) || 'penjualan',
    title: row.title || undefined,
    amount: Number(row.amount) || 0,
    description: row.description || undefined,
    partyName: row.party_name || undefined,
    notes: row.notes || undefined,
    recordedBy: row.recorded_by || undefined,
    createdBy: row.created_by || row.user_id || undefined,
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
 * dan `business_unit_transactions` tanpa fallback dummy lokal.
 */
export async function fetchBusinessUnitsAndTransactionsFromSupabase(
  managedUnitFilter?: BusinessUnitId | null
): Promise<FetchBusinessUnitsResponse> {
  try {
    const unitsQuery = supabase.from('business_units').select('*').order('created_at', { ascending: true });
    let txQuery = supabase
      .from('business_unit_transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (managedUnitFilter) {
      txQuery = txQuery.eq('unit_id', managedUnitFilter);
    }

    const [unitsRes, txRes] = await Promise.all([unitsQuery, txQuery]);

    if (unitsRes.error || txRes.error) {
      const errMsg = unitsRes.error?.message || txRes.error?.message || 'Gagal memuat data dari server.';
      console.warn('Gagal memuat unit usaha dari Supabase:', errMsg);
      return {
        businessUnits: [],
        transactions: [],
        error: `Gagal memuat data unit usaha dari server: ${errMsg}`,
        fromSupabase: false,
        totalTransactionsCount: 0,
      };
    }

    const mappedUnits = (unitsRes.data || []).map(mapSupabaseBusinessUnit);
    const mappedTx = (txRes.data || []).map(mapSupabaseBuTxToBusinessUnitTransaction);

    return {
      businessUnits: mappedUnits,
      transactions: mappedTx,
      error: null,
      fromSupabase: true,
      totalTransactionsCount: mappedTx.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat data unit usaha dari Supabase:', err);
    return {
      businessUnits: [],
      transactions: [],
      error: 'Terjadi kendala jaringan saat memuat data unit usaha.',
      fromSupabase: false,
      totalTransactionsCount: 0,
    };
  }
}

/**
 * Mencatat transaksi unit usaha baru ke tabel Supabase `business_unit_transactions`.
 */
export async function createBusinessUnitTransaction(
  input: CreateBusinessUnitTransactionInput,
  currentUser?: AuthUser | null
): Promise<CreateBusinessUnitActionResult> {
  // 1. Role & Unit Guard
  if (!currentUser || !canManageBusinessUnit(currentUser, input.unitId)) {
    return {
      success: false,
      message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mencatat transaksi pada unit usaha ini.',
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

  // 8. Ambil UUID pengguna sah untuk created_by (bukan string role "pengurus")
  const validUserUuid = sanitizeUuid(currentUser.id);

  // 9. Bentuk Payload Sesuai Kolom Eksak Supabase `business_unit_transactions`
  const insertPayload: any = {
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
    ...(validUserUuid ? { created_by: validUserUuid } : {}),
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
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
          actor_role: currentUser.role || 'super_admin',
          action: 'CREATE_BUSINESS_UNIT_TRANSACTION',
          entity_type: 'business_unit_transactions',
          entity_id: generatedId,
          description: `Mencatat ${typeLabel} pada Unit Usaha ${input.unitId.toUpperCase()} sebesar ${formatRupiah(amount)} - ${cleanDescription}`,
          new_data: insertPayload,
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
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
  if (!currentUser) {
    return {
      success: false,
      message: 'Akses ditolak: Silakan login terlebih dahulu.',
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

    const targetUnit = (existing.unit_id || '') as BusinessUnitId;
    if (!canManageBusinessUnit(currentUser, targetUnit)) {
      return {
        success: false,
        message: 'Akses ditolak: Anda tidak berwenang menghapus transaksi unit usaha ini.',
        error: 'UNAUTHORIZED_ROLE',
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
      const validUserUuid = sanitizeUuid(currentUser.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
          actor_role: currentUser.role || 'super_admin',
          action: 'DELETE_BUSINESS_UNIT_TRANSACTION',
          entity_type: 'business_unit_transactions',
          entity_id: id,
          description: `Menghapus transaksi unit usaha ${id} (${formatRupiah(existing.amount)}) - ${existing.description}`,
          new_data: { deletedRecord: existing },
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
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

