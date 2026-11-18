import { supabase } from '../lib/supabase';
import {
  AuthUser,
  CashFlowRecord,
  SimpanPinjamCashMutation,
  SimpanPinjamCashMutationType,
} from '../types';
import { isSimpanPinjamOfficer } from '../utils/permissions';
import { formatRupiah } from '../utils/formatters';
import { sanitizeUuid } from '../utils/storage';

const SP_CASH_PREFIX = '[KAS UNIT SP]';
const SP_LOCAL_STORAGE_KEY = 'bjs_sp_cash_mutations_data';

export interface FetchSpCashResponse {
  mutations: SimpanPinjamCashMutation[];
  error: string | null;
  fromSupabase: boolean;
}

export interface SpCashActionResult {
  success: boolean;
  message: string;
  data?: SimpanPinjamCashMutation;
  error?: string;
}

/**
 * Mengidentifikasi apakah sebuah baris `cash_flow_records` merupakan mutasi manual Kas Unit Simpan Pinjam,
 * dan BUKAN baris otomatis Biaya Admin 1% (`biaya_admin`).
 */
export function isManualSpCashRow(row: {
  id?: string;
  referenceId?: string;
  reference_id?: string;
  category?: string;
  targetAccount?: string;
  target_account?: string;
  description?: string;
}): boolean {
  const targetAccount = row.targetAccount || row.target_account;
  if (targetAccount !== 'kas_operasional_sp') return false;
  if (row.category === 'biaya_admin') return false;

  const id = String(row.id || '');
  const refId = String(row.referenceId || row.reference_id || '');
  const desc = String(row.description || '');

  return (
    id.startsWith('KAS-SP-') ||
    id.startsWith('CSH-SP-') ||
    refId.startsWith('KAS-SP-') ||
    refId.startsWith('CSH-SP-') ||
    desc.startsWith(SP_CASH_PREFIX)
  );
}

/**
 * Menyusun deskripsi terstruktur pada `cash_flow_records.description` agar seluruh metadata
 * Kas Unit SP (`category`, `sourceOrRecipient`, `recordedBy`, `description`, `notes`)
 * tersimpan utuh lintas perangkat tanpa memerlukan tabel baru.
 */
export function encodeSpCashDescription(input: {
  category: string;
  sourceOrRecipient?: string;
  recordedBy: string;
  description: string;
  notes?: string;
}): string {
  const cleanCategory = (input.category || 'Lainnya').replace(/\|\|/g, '/').trim();
  const cleanParty = (input.sourceOrRecipient || '-').replace(/\|\|/g, '/').trim() || '-';
  const cleanActor = (input.recordedBy || 'Admin SP BJS').replace(/\|\|/g, '/').trim();
  const cleanDesc = (input.description || '').replace(/\|\|/g, '/').trim();
  const cleanNotes = (input.notes || '').replace(/\|\|/g, '/').trim();

  return `${SP_CASH_PREFIX} ${cleanCategory} || Pihak: ${cleanParty} || Petugas: ${cleanActor} || ${cleanDesc}${
    cleanNotes ? ` || Catatan: ${cleanNotes}` : ''
  }`;
}

/**
 * Mem-parsing metadata mutasi Kas Unit SP dari kolom `description`.
 * Mendukung format terstruktur baru maupun format legacy `[KAS UNIT SP] Kategori: Uraian`.
 */
export function parseSpCashDescription(
  rawDescription: string,
  mutationType: SimpanPinjamCashMutationType
): {
  category: string;
  sourceOrRecipient?: string;
  recordedBy: string;
  description: string;
  notes?: string;
} {
  const raw = (rawDescription || '').trim();
  const defaultCategory =
    mutationType === 'penambahan' ? 'Modal Awal / Tambahan' : 'Operasional Unit SP';

  if (raw.startsWith(SP_CASH_PREFIX)) {
    const body = raw.slice(SP_CASH_PREFIX.length).trim();

    if (body.includes('||')) {
      const parts = body.split('||').map((p) => p.trim());
      const category = parts[0] || defaultCategory;
      let sourceOrRecipient: string | undefined;
      let recordedBy = 'Admin Simpan Pinjam';
      let description = '';
      let notes: string | undefined;

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('Pihak:')) {
          const val = part.slice('Pihak:'.length).trim();
          if (val && val !== '-') sourceOrRecipient = val;
        } else if (part.startsWith('Petugas:')) {
          const val = part.slice('Petugas:'.length).trim();
          if (val) recordedBy = val;
        } else if (part.startsWith('Catatan:')) {
          const val = part.slice('Catatan:'.length).trim();
          if (val) notes = val;
        } else if (!description) {
          description = part;
        } else {
          description = `${description} — ${part}`;
        }
      }

      return {
        category,
        sourceOrRecipient,
        recordedBy,
        description: description || category,
        notes,
      };
    }

    const colonIdx = body.indexOf(':');
    if (colonIdx > -1) {
      const category = body.slice(0, colonIdx).trim() || defaultCategory;
      const description = body.slice(colonIdx + 1).trim() || body;
      return {
        category,
        recordedBy: 'Admin Simpan Pinjam',
        description,
      };
    }

    return {
      category: defaultCategory,
      recordedBy: 'Admin Simpan Pinjam',
      description: body || raw,
    };
  }

  return {
    category: defaultCategory,
    recordedBy: 'Admin Simpan Pinjam',
    description: raw || defaultCategory,
  };
}

/**
 * Memetakan baris `cash_flow_records` (raw Supabase atau CashFlowRecord) ke `SimpanPinjamCashMutation`.
 */
export function mapCashFlowToSpMutation(row: any): SimpanPinjamCashMutation {
  const cfType = row.type === 'masuk' ? 'masuk' : 'keluar';
  const mutationType: SimpanPinjamCashMutationType =
    cfType === 'masuk' ? 'penambahan' : 'pengurangan';
  const parsed = parseSpCashDescription(row.description || '', mutationType);

  return {
    id: row.id,
    date: row.transaction_date || row.date || row.created_at || new Date().toISOString().split('T')[0],
    type: mutationType,
    category: parsed.category,
    amount: Number(row.amount) || 0,
    description: parsed.description,
    sourceOrRecipient: parsed.sourceOrRecipient,
    recordedBy: parsed.recordedBy,
    notes: parsed.notes,
    createdAt: row.created_at || row.date || undefined,
  };
}

/**
 * Mengekstrak daftar mutasi Kas Unit SP dari array `CashFlowRecord[]` yang sudah dimuat.
 */
export function extractSpCashMutationsFromCashFlow(
  cashFlow: CashFlowRecord[]
): SimpanPinjamCashMutation[] {
  return (cashFlow || [])
    .filter((cf) => isManualSpCashRow(cf))
    .map(mapCashFlowToSpMutation)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Mengambil seluruh mutasi Kas Unit Simpan Pinjam langsung dari tabel `cash_flow_records`.
 */
export async function fetchSpCashMutationsFromSupabase(
  currentUser?: AuthUser | null
): Promise<FetchSpCashResponse> {
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      mutations: [],
      error: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang dapat mengakses Kas Unit SP.',
      fromSupabase: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('cash_flow_records')
      .select('*')
      .eq('target_account', 'kas_operasional_sp')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return {
        mutations: [],
        error: `Gagal memuat Kas Unit Simpan Pinjam dari server: ${error.message}`,
        fromSupabase: false,
      };
    }

    const mutations = (data || [])
      .filter((row) => isManualSpCashRow(row))
      .map(mapCashFlowToSpMutation);

    return {
      mutations,
      error: null,
      fromSupabase: true,
    };
  } catch (err: any) {
    return {
      mutations: [],
      error: `Kendala jaringan saat memuat Kas Unit SP: ${err.message || 'Koneksi gagal'}`,
      fromSupabase: false,
    };
  }
}

/**
 * Mencatat mutasi Kas Unit Simpan Pinjam baru ke `cash_flow_records` (Single Source of Truth).
 */
export async function createSpCashMutationInSupabase(
  input: Omit<SimpanPinjamCashMutation, 'id' | 'createdAt'>,
  currentUser?: AuthUser | null
): Promise<SpCashActionResult> {
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang berwenang mencatat Kas Unit SP.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  const amount = Number(input.amount);
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Nominal mutasi Kas Unit SP harus lebih besar dari Rp 0.',
      error: 'INVALID_AMOUNT',
    };
  }

  const cleanDate = (input.date || '').trim() || new Date().toISOString().split('T')[0];
  if (isNaN(new Date(cleanDate).getTime())) {
    return {
      success: false,
      message: 'Tanggal mutasi Kas Unit SP tidak valid.',
      error: 'INVALID_DATE',
    };
  }

  const cleanDescription = (input.description || '').trim();
  if (!cleanDescription) {
    return {
      success: false,
      message: 'Uraian atau keterangan mutasi Kas Unit SP wajib diisi.',
      error: 'MISSING_DESCRIPTION',
    };
  }

  const mutationType: SimpanPinjamCashMutationType =
    input.type === 'pengurangan' ? 'pengurangan' : 'penambahan';
  const recordedBy =
    input.recordedBy?.trim() || currentUser?.name || currentUser?.username || 'Admin Simpan Pinjam';

  const datePart = cleanDate.replace(/-/g, '').slice(2);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const generatedId = `KAS-SP-${datePart}-${Date.now().toString().slice(-4)}-${randomSuffix}`;

  const encodedDescription = encodeSpCashDescription({
    category: input.category,
    sourceOrRecipient: input.sourceOrRecipient,
    recordedBy,
    description: cleanDescription,
    notes: input.notes,
  });

  const insertPayload = {
    id: generatedId,
    transaction_date: cleanDate,
    type: mutationType === 'penambahan' ? 'masuk' : 'keluar',
    category: mutationType === 'penambahan' ? 'simpanan' : 'operasional_sp',
    amount,
    reference_id: generatedId,
    description: encodedDescription,
    target_account: 'kas_operasional_sp',
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('cash_flow_records')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      return {
        success: false,
        message: `Gagal menyimpan mutasi Kas Unit SP ke database: ${error.message}`,
        error: error.message,
      };
    }

    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        await supabase.from('audit_logs').insert([
          {
            user_id: validUserUuid,
            actor_name: currentUser?.name || currentUser?.username || 'Admin SP',
            actor_role: currentUser?.role || 'admin_sp',
            action: 'CREATE_SP_CASH_MUTATION',
            entity_type: 'cash_flow_records',
            entity_id: generatedId,
            description: `Mencatat ${mutationType === 'penambahan' ? 'Penambahan' : 'Pengurangan'} Kas Unit SP (${input.category}) sebesar ${formatRupiah(amount)} - ${cleanDescription}`,
            new_data: insertPayload,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log Kas Unit SP:', auditErr);
    }

    return {
      success: true,
      message: `Mutasi Kas Unit SP sebesar ${formatRupiah(amount)} berhasil tersimpan resmi di database.`,
      data: mapCashFlowToSpMutation(data || insertPayload),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Kendala jaringan saat menyimpan Kas Unit SP: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Menghapus mutasi manual Kas Unit Simpan Pinjam dari `cash_flow_records`.
 */
export async function deleteSpCashMutationFromSupabase(
  id: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang berwenang menghapus mutasi Kas Unit SP.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('cash_flow_records')
      .select('*')
      .eq('id', id)
      .eq('target_account', 'kas_operasional_sp')
      .maybeSingle();

    if (fetchErr || !existing || !isManualSpCashRow(existing)) {
      return {
        success: false,
        message: 'Mutasi Kas Unit SP tidak ditemukan atau bukan mutasi manual Kas SP.',
        error: 'NOT_FOUND',
      };
    }

    const { error: delErr } = await supabase
      .from('cash_flow_records')
      .delete()
      .eq('id', id)
      .eq('target_account', 'kas_operasional_sp');

    if (delErr) {
      return {
        success: false,
        message: `Gagal menghapus mutasi Kas Unit SP: ${delErr.message}`,
        error: delErr.message,
      };
    }

    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        await supabase.from('audit_logs').insert([
          {
            user_id: validUserUuid,
            actor_name: currentUser?.name || currentUser?.username || 'Admin SP',
            actor_role: currentUser?.role || 'admin_sp',
            action: 'DELETE_SP_CASH_MUTATION',
            entity_type: 'cash_flow_records',
            entity_id: id,
            description: `Menghapus mutasi Kas Unit SP ${id} sebesar ${formatRupiah(Number(existing.amount) || 0)}`,
            old_data: existing,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {}

    return {
      success: true,
      message: `Mutasi Kas Unit SP ${id} berhasil dihapus dari database.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Kendala jaringan saat menghapus Kas Unit SP: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Memigrasikan mutasi Kas Unit SP yang masih tersimpan di localStorage ke tabel PostgreSQL `cash_flow_records`.
 */
export async function migrateLocalSpCashToSupabase(
  localRows: SimpanPinjamCashMutation[],
  currentUser?: AuthUser | null
): Promise<{ success: boolean; migratedCount: number; message: string }> {
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      migratedCount: 0,
      message: 'Akses ditolak untuk memigrasikan Kas Unit SP.',
    };
  }

  if (!localRows || localRows.length === 0) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SP_LOCAL_STORAGE_KEY);
    }
    return {
      success: true,
      migratedCount: 0,
      message: 'Tidak ada data lokal Kas Unit SP yang perlu disinkronkan.',
    };
  }

  try {
    const { data: existingRows } = await supabase
      .from('cash_flow_records')
      .select('id, reference_id')
      .eq('target_account', 'kas_operasional_sp');

    const existingIds = new Set<string>();
    (existingRows || []).forEach((r: any) => {
      if (r.id) existingIds.add(String(r.id));
      if (r.reference_id) existingIds.add(String(r.reference_id));
    });

    const rowsToInsert = localRows
      .filter((row) => !existingIds.has(row.id))
      .map((row) => {
        const cleanDate = (row.date || '').split('T')[0] || new Date().toISOString().split('T')[0];
        const safeId = row.id.startsWith('KAS-SP-') ? row.id : `KAS-SP-${row.id}`;
        const mutType: SimpanPinjamCashMutationType =
          row.type === 'pengurangan' ? 'pengurangan' : 'penambahan';

        return {
          id: safeId,
          transaction_date: cleanDate,
          type: mutType === 'penambahan' ? 'masuk' : 'keluar',
          category: mutType === 'penambahan' ? 'simpanan' : 'operasional_sp',
          amount: Number(row.amount) || 0,
          reference_id: safeId,
          description: encodeSpCashDescription({
            category: row.category,
            sourceOrRecipient: row.sourceOrRecipient,
            recordedBy: row.recordedBy || currentUser?.name || 'Admin SP',
            description: row.description,
            notes: row.notes,
          }),
          target_account: 'kas_operasional_sp',
          created_at: row.createdAt || new Date().toISOString(),
        };
      })
      .filter((p) => p.amount > 0);

    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('cash_flow_records').insert(rowsToInsert);
      if (error) {
        return {
          success: false,
          migratedCount: 0,
          message: `Gagal memigrasikan Kas Unit SP lokal ke server: ${error.message}`,
        };
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(SP_LOCAL_STORAGE_KEY);
    }

    return {
      success: true,
      migratedCount: rowsToInsert.length,
      message:
        rowsToInsert.length > 0
          ? `${rowsToInsert.length} mutasi Kas Unit SP lokal berhasil disinkronkan ke server PostgreSQL.`
          : 'Seluruh mutasi Kas Unit SP sudah tersinkron dengan server. Cache lokal dibersihkan.',
    };
  } catch (err: any) {
    return {
      success: false,
      migratedCount: 0,
      message: `Kendala jaringan saat sinkronisasi Kas SP: ${err.message || 'Koneksi gagal'}`,
    };
  }
}
