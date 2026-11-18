import { supabase } from '../lib/supabase';
import { Member, SavingsTransaction, SavingsType, SavingsTransactionType, AuthUser } from '../types';
import { sanitizeUuid } from '../utils/storage';
import { isSimpanPinjamOfficer } from '../utils/permissions';
import { formatRupiah } from '../utils/formatters';

/**
 * Interface input untuk pembuatan transaksi simpanan baru.
 */
export interface CreateSavingsTransactionInput {
  memberId: string;
  memberName?: string;
  type: SavingsType; // 'pokok' | 'wajib' | 'berjangka'
  txType?: SavingsTransactionType; // 'setor' | 'tarik'
  amount: number;
  date: string; // YYYY-MM-DD atau ISO string
  adminName?: string;
  termMonths?: number;
  annualInterestRate?: number;
  maturityDate?: string;
  accruedInterest?: number;
  interestPaymentSchedule?: string;
  statusBerjangka?: 'aktif' | 'selesai' | 'dibatalkan';
  completedDate?: string;
  notes?: string;
}

export interface CreateSavingsActionResult {
  success: boolean;
  message: string;
  data?: SavingsTransaction;
  error?: string;
}

export interface CreateBatchSavingsActionResult {
  success: boolean;
  message: string;
  data?: SavingsTransaction[];
  error?: string;
}

/**
 * Memetakan baris dari tabel `savings_transactions` Supabase (snake_case)
 * ke interface `SavingsTransaction` aplikasi (camelCase).
 *
 * Kolom tabel Supabase `savings_transactions`:
 * - id: string ("SMP-BJS-001-POKOK")
 * - member_id: string ("BJS-001")
 * - member_name: string ("MOH. FERY AFRUDIN, S.STP")
 * - type: string ("pokok" | "wajib" | "berjangka")
 * - tx_type: string ("setor" | "tarik")
 * - amount: number (200000)
 * - transaction_date: string (ISO date string)
 * - admin_name: string ("Admin Bendahara BJS")
 * - term_months: number | null
 * - annual_interest_rate: number | null
 * - maturity_date: string | null
 * - accrued_interest: number | null
 * - interest_payment_schedule: string | null
 * - status_berjangka: string | null ("aktif" | "selesai" | "dibatalkan")
 * - completed_date: string | null
 * - notes: string | null
 */
export function mapSupabaseSavingsToSavings(row: any, members?: Member[]): SavingsTransaction {
  // Hubungkan nama anggota jika row tidak memiliki nama, mengambil dari daftar members
  const memberName =
    row.member_name ||
    row.memberName ||
    members?.find((m) => m.id === (row.member_id || row.memberId))?.name ||
    'Anggota BJS';

  return {
    id: row.id,
    memberId: row.member_id || row.memberId || '',
    memberName,
    type: (row.type as SavingsType) || 'pokok',
    txType: (row.tx_type || row.txType || 'setor') as SavingsTransactionType,
    amount: Number(row.amount) || 0,
    date: row.transaction_date || row.date || row.created_at || '',
    adminName: row.admin_name || row.adminName || 'Admin Bendahara BJS',
    termMonths: row.term_months ?? row.termMonths ?? undefined,
    annualInterestRate: row.annual_interest_rate ?? row.annualInterestRate ?? undefined,
    maturityDate: row.maturity_date ?? row.maturityDate ?? undefined,
    accruedInterest: row.accrued_interest ?? row.accruedInterest ?? undefined,
    interestPaymentSchedule: row.interest_payment_schedule ?? row.interestPaymentSchedule ?? undefined,
    statusBerjangka: row.status_berjangka ?? row.statusBerjangka ?? undefined,
    completedDate: row.completed_date ?? row.completedDate ?? undefined,
    notes: row.notes || undefined,
  };
}

export interface FetchSavingsResponse {
  savings: SavingsTransaction[];
  error: string | null;
  fromSupabase: boolean;
  totalCount: number;
}

/**
 * Mengambil data transaksi simpanan dari tabel Supabase `savings_transactions`
 * tanpa mencampur data dummy atau cadangan localStorage.
 */
export async function fetchSavingsFromSupabase(members?: Member[]): Promise<FetchSavingsResponse> {
  try {
    const { data, error } = await supabase
      .from('savings_transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.warn('Gagal memuat data transaksi simpanan dari Supabase:', error.message);
      return {
        savings: [],
        error: `Gagal mengambil data transaksi simpanan dari server: ${error.message}`,
        fromSupabase: false,
        totalCount: 0,
      };
    }

    const mapped = (data || []).map((row) => mapSupabaseSavingsToSavings(row, members));
    return {
      savings: mapped,
      error: null,
      fromSupabase: true,
      totalCount: mapped.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat data simpanan dari Supabase:', err);
    return {
      savings: [],
      error: 'Terjadi kendala jaringan saat memuat transaksi simpanan.',
      fromSupabase: false,
      totalCount: 0,
    };
  }
}

/**
 * Mencatat transaksi simpanan baru ke tabel Supabase `savings_transactions`.
 */
export async function createSavingsTransaction(
  input: CreateSavingsTransactionInput,
  currentUser?: AuthUser | null,
  validMembers?: Member[]
): Promise<CreateSavingsActionResult> {
  // 1. Role Guard
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang memiliki wewenang mencatat simpanan.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  // 2. Validasi Member ID
  const cleanMemberId = input.memberId?.trim();
  if (!cleanMemberId) {
    return {
      success: false,
      message: 'ID Anggota wajib dipilih dan tidak boleh kosong.',
      error: 'INVALID_MEMBER_ID',
    };
  }

  // Validasi keberadaan anggota jika daftar validMembers disediakan
  let cleanMemberName = input.memberName?.trim();
  if (validMembers && validMembers.length > 0) {
    const foundMember = validMembers.find(
      (m) => m.id.toLowerCase() === cleanMemberId.toLowerCase()
    );
    if (!foundMember) {
      return {
        success: false,
        message: `Anggota dengan ID "${cleanMemberId}" tidak terdaftar dalam database koperasi.`,
        error: 'MEMBER_NOT_FOUND',
      };
    }
    if (!cleanMemberName) {
      cleanMemberName = foundMember.name;
    }
  }

  if (!cleanMemberName) {
    cleanMemberName = 'Anggota BJS';
  }

  // 3. Validasi Jenis Simpanan
  const validTypes: SavingsType[] = ['pokok', 'wajib', 'berjangka'];
  if (!validTypes.includes(input.type)) {
    return {
      success: false,
      message: `Jenis simpanan "${input.type}" tidak valid. Harus salah satu dari: pokok, wajib, atau berjangka.`,
      error: 'INVALID_SAVINGS_TYPE',
    };
  }

  // 4. Validasi Jenis Mutasi (setor / tarik)
  const validTxTypes: SavingsTransactionType[] = ['setor', 'tarik'];
  const txType: SavingsTransactionType = input.txType || 'setor';
  if (!validTxTypes.includes(txType)) {
    return {
      success: false,
      message: `Jenis mutasi "${input.txType}" tidak valid. Harus "setor" atau "tarik".`,
      error: 'INVALID_TX_TYPE',
    };
  }

  // 5. Validasi Nominal (harus > 0, angka valid, bukan NaN/Infinity)
  const amount = Number(input.amount);
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Nominal simpanan harus berupa angka valid dan lebih besar dari 0 (nol).',
      error: 'INVALID_AMOUNT',
    };
  }

  // 6. Validasi Tanggal Transaksi
  const cleanDate = input.date?.trim();
  if (!cleanDate) {
    return {
      success: false,
      message: 'Tanggal transaksi wajib diisi.',
      error: 'MISSING_DATE',
    };
  }
  const dateTimestamp = new Date(cleanDate).getTime();
  if (isNaN(dateTimestamp)) {
    return {
      success: false,
      message: 'Format tanggal transaksi tidak valid.',
      error: 'INVALID_DATE_FORMAT',
    };
  }

  // 7. Field Khusus Simpanan Berjangka (6% p.a.)
  const isBerjangka = input.type === 'berjangka';
  const termMonths = isBerjangka ? (input.termMonths ?? 12) : null;
  const annualInterestRate = isBerjangka ? (input.annualInterestRate ?? 6.0) : null;
  let maturityDate = isBerjangka ? (input.maturityDate ?? null) : null;
  if (isBerjangka && !maturityDate) {
    const parts = cleanDate.split('T')[0].split('-');
    const y = Number(parts[0]) || new Date().getFullYear();
    const m = parts[1] || '01';
    const d = parts[2] || '01';
    maturityDate = `${y + 1}-${m}-${d}`;
  }
  const accruedInterest = isBerjangka ? (input.accruedInterest ?? Math.round(amount * 0.06)) : null;
  const interestPaymentSchedule = isBerjangka
    ? (input.interestPaymentSchedule ?? 'Dibayarkan saat RAT tahunan')
    : null;
  const statusBerjangka = isBerjangka ? (input.statusBerjangka ?? 'aktif') : null;

  // 8. Generate ID Transaksi yang Unik
  const datePart = cleanDate.split('T')[0].replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = isBerjangka ? 'SMP-BJK' : input.type === 'pokok' ? 'SMP-PKK' : 'SMP-WJB';
  const generatedId = `${prefix}-${datePart}-${Date.now().toString().slice(-4)}-${randomSuffix}`;

  // 9. Bentuk payload snake_case sesuai skema Supabase
  const insertPayload = {
    id: generatedId,
    member_id: cleanMemberId,
    member_name: cleanMemberName,
    type: input.type,
    tx_type: txType,
    amount: amount,
    transaction_date: cleanDate,
    admin_name: input.adminName?.trim() || currentUser?.name || currentUser?.username || 'Admin Bendahara BJS',
    term_months: termMonths,
    annual_interest_rate: annualInterestRate,
    maturity_date: maturityDate,
    accrued_interest: accruedInterest,
    interest_payment_schedule: interestPaymentSchedule,
    status_berjangka: statusBerjangka,
    completed_date: input.completedDate || null,
    notes: input.notes?.trim() || null,
  };

  try {
    // 10. INSERT ke tabel `savings_transactions` Supabase
    const { data, error } = await supabase
      .from('savings_transactions')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Gagal menyimpan transaksi simpanan ke Supabase:', error);
      return {
        success: false,
        message: `Gagal mencatat transaksi simpanan ke server database: ${error.message}`,
        error: error.message,
      };
    }

    const insertedTx = mapSupabaseSavingsToSavings(data, validMembers);

    // 11. Catat ke audit_logs
    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser?.name || currentUser?.username || 'Admin SP',
          actor_role: currentUser?.role || 'admin_sp',
          action: 'CREATE_SAVINGS_TRANSACTION',
          entity_type: 'savings_transactions',
          entity_id: insertedTx.id,
          description: `Mencatat ${txType === 'setor' ? 'Setoran' : 'Penarikan'} Simpanan ${input.type.toUpperCase()} sebesar ${formatRupiah(amount)} untuk ${cleanMemberName} (${cleanMemberId})`,
          new_data: insertPayload,
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log transaksi simpanan:', auditErr);
    }

    return {
      success: true,
      message: `Transaksi simpanan ${input.type.toUpperCase()} sebesar ${formatRupiah(amount)} untuk ${cleanMemberName} berhasil dicatat resmi di server.`,
      data: insertedTx,
    };
  } catch (err: any) {
    console.error('Pengecualian saat menyimpan transaksi simpanan:', err);
    return {
      success: false,
      message: `Terjadi kendala jaringan saat menyimpan transaksi: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Mencatat transaksi simpanan kolektif (batch) ke tabel Supabase `savings_transactions`.
 * Digunakan untuk setoran potong gaji Simpanan Wajib kolektif.
 */
export async function createBatchSavingsTransactions(
  inputs: CreateSavingsTransactionInput[],
  currentUser?: AuthUser | null,
  validMembers?: Member[]
): Promise<CreateBatchSavingsActionResult> {
  // 1. Role Guard
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang memiliki wewenang untuk mencatat transaksi simpanan.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  if (!inputs || inputs.length === 0) {
    return {
      success: false,
      message: 'Daftar transaksi kolektif kosong.',
      error: 'EMPTY_BATCH',
    };
  }

  // 2b. Database-level Duplicate Prevention:
  // Cek apakah ada anggota dalam batch yang sudah memiliki simpanan wajib untuk periode ini
  const memberIdsInBatch = inputs.map((i) => i.memberId?.trim()).filter(Boolean);
  const periodKeywords = inputs
    .map((i) => {
      const match = (i.notes || '').match(/Periode\s+([A-Za-z]+\s+\d{4})/i);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);

  if (periodKeywords.length > 0 && memberIdsInBatch.length > 0) {
    const periodStr = periodKeywords[0];
    try {
      const { data: existingSamePeriod } = await supabase
        .from('savings_transactions')
        .select('member_id, member_name, notes')
        .eq('type', 'wajib')
        .in('member_id', memberIdsInBatch)
        .ilike('notes', `%${periodStr}%`);

      if (existingSamePeriod && existingSamePeriod.length > 0) {
        const alreadyList = existingSamePeriod
          .map((e) => `${e.member_name || e.member_id} (${e.member_id})`)
          .join(', ');
        return {
          success: false,
          message: `Ditolak oleh sistem database: Simpanan Wajib periode "${periodStr}" sudah pernah dicatat sebelumnya untuk: ${alreadyList}. Pencegahan duplikasi aktif.`,
          error: 'DUPLICATE_PERIOD_TRANSACTION',
        };
      }
    } catch (checkErr) {
      console.warn('Gagal memverifikasi duplikasi periode pada database:', checkErr);
    }
  }

  // 2. Validasi seluruh item sebelum melakukan insert
  const now = new Date();
  const payloads: any[] = [];
  let totalBatchAmount = 0;

  for (let idx = 0; idx < inputs.length; idx++) {
    const input = inputs[idx];
    const cleanMemberId = input.memberId?.trim();
    if (!cleanMemberId) {
      return {
        success: false,
        message: `Transaksi baris #${idx + 1}: ID Anggota wajib diisi.`,
        error: 'INVALID_MEMBER_ID',
      };
    }

    let cleanMemberName = input.memberName?.trim();
    if (validMembers && validMembers.length > 0) {
      const found = validMembers.find(
        (m) => m.id.toLowerCase() === cleanMemberId.toLowerCase()
      );
      if (!found) {
        return {
          success: false,
          message: `Transaksi baris #${idx + 1}: Anggota "${cleanMemberId}" tidak ditemukan dalam database.`,
          error: 'MEMBER_NOT_FOUND',
        };
      }
      if (!cleanMemberName) cleanMemberName = found.name;
    }
    if (!cleanMemberName) cleanMemberName = 'Anggota BJS';

    const amount = Number(input.amount);
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      return {
        success: false,
        message: `Transaksi baris #${idx + 1} (${cleanMemberName}): Nominal simpanan tidak valid.`,
        error: 'INVALID_AMOUNT',
      };
    }

    const cleanDate = input.date?.trim() || now.toISOString().split('T')[0];
    const datePart = cleanDate.replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedId = `SWJ-COL-${datePart}-${Date.now().toString().slice(-4)}-${idx + 1}-${randomSuffix}`;

    payloads.push({
      id: generatedId,
      member_id: cleanMemberId,
      member_name: cleanMemberName,
      type: input.type || 'wajib',
      tx_type: input.txType || 'setor',
      amount: amount,
      transaction_date: cleanDate,
      admin_name: input.adminName?.trim() || currentUser?.name || currentUser?.username || 'Admin Bendahara BJS',
      term_months: null,
      annual_interest_rate: null,
      maturity_date: null,
      accrued_interest: null,
      interest_payment_schedule: null,
      status_berjangka: null,
      completed_date: null,
      notes: input.notes?.trim() || 'Setoran Simpanan Wajib Kolektif (Potong Gaji)',
    });

    totalBatchAmount += amount;
  }

  try {
    // 3. INSERT batch ke tabel `savings_transactions` Supabase
    const { data, error } = await supabase
      .from('savings_transactions')
      .insert(payloads)
      .select('*');

    if (error) {
      console.error('Gagal menyimpan transaksi kolektif ke Supabase:', error);
      return {
        success: false,
        message: `Gagal mencatat transaksi kolektif ke server database: ${error.message}`,
        error: error.message,
      };
    }

    const insertedList = (data || []).map((row) => mapSupabaseSavingsToSavings(row, validMembers));

    // 4. Catat audit log batch
    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser?.name || currentUser?.username || 'Admin SP',
          actor_role: currentUser?.role || 'admin_sp',
          action: 'CREATE_SAVINGS_TRANSACTION',
          entity_type: 'savings_transactions',
          entity_id: `BATCH-${payloads.length}-MEMBERS`,
          description: `Mencatat setoran kolektif Simpanan Wajib untuk ${payloads.length} anggota dengan total nominal ${formatRupiah(totalBatchAmount)}`,
          new_data: { count: payloads.length, totalAmount: totalBatchAmount },
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log batch simpanan:', auditErr);
    }

    return {
      success: true,
      message: `Setoran kolektif untuk ${payloads.length} anggota (${formatRupiah(totalBatchAmount)}) berhasil dicatat resmi di server database.`,
      data: insertedList,
    };
  } catch (err: any) {
    console.error('Pengecualian saat menyimpan transaksi kolektif ke Supabase:', err);
    return {
      success: false,
      message: `Terjadi kendala jaringan saat menyimpan transaksi kolektif: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Menghapus transaksi simpanan dari database Supabase secara persistent.
 */
export async function deleteSavingsTransaction(
  id: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang dapat menghapus transaksi simpanan.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('savings_transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Gagal membaca data simpanan sebelum hapus:', fetchErr.message);
    }

    const { error: delErr } = await supabase
      .from('savings_transactions')
      .delete()
      .eq('id', id);

    if (delErr) {
      return {
        success: false,
        message: `Gagal menghapus transaksi simpanan dari server database: ${delErr.message}`,
        error: delErr.message,
      };
    }

    // Catat ke audit_logs
    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser?.name || currentUser?.username || 'Admin SP',
          actor_role: currentUser?.role || 'admin_sp',
          action: 'DELETE_SAVINGS_TRANSACTION',
          entity_type: 'savings_transactions',
          entity_id: id,
          description: `Menghapus transaksi simpanan ID: ${id} (${existing ? `${existing.type} - ${formatRupiah(existing.amount)}` : ''})`,
          old_data: existing || null,
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
    } catch {}

    return {
      success: true,
      message: `Transaksi simpanan ${id} berhasil dihapus dari server database.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Terjadi kendala jaringan: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Menyelesaikan dan mencairkan bilyet Simpanan Berjangka langsung ke Supabase PostgreSQL.
 * Mengubah status_berjangka menjadi 'selesai' dan mencatat mutasi kas keluar resmi.
 */
export async function completeBerjangkaTransaction(
  id: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSimpanPinjamOfficer(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin atau Admin Simpan Pinjam yang dapat mencairkan simpanan berjangka.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: updatedTx, error: updErr } = await supabase
      .from('savings_transactions')
      .update({
        status_berjangka: 'selesai',
        completed_date: todayStr,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) {
      return {
        success: false,
        message: `Gagal mencairkan simpanan berjangka: ${updErr.message}`,
        error: updErr.message,
      };
    }

    // Catat mutasi kas keluar pokok dan bunga di cash_flow_records
    const amount = Number(updatedTx.amount) || 0;
    const interest = Number(updatedTx.accrued_interest) || Math.round(amount * 0.06);
    const memberName = updatedTx.member_name || 'Anggota BJS';

    const cfPrincipal = {
      id: `CSH-CAIR-PKK-${id.replace(/[^A-Za-z0-9]/g, '')}`,
      transaction_date: todayStr,
      type: 'keluar',
      category: 'tarik_simpanan',
      amount: amount,
      reference_id: id,
      description: `Pencairan Pokok Simpanan Berjangka ${id} - ${memberName}`,
      target_account: 'kas_koperasi',
      created_at: new Date().toISOString(),
    };

    const cfInterest = {
      id: `CSH-CAIR-BNG-${id.replace(/[^A-Za-z0-9]/g, '')}`,
      transaction_date: todayStr,
      type: 'keluar',
      category: 'operasional',
      amount: interest,
      reference_id: id,
      description: `Pembayaran Bunga Simpanan Berjangka 6% ${id} - ${memberName}`,
      target_account: 'kas_koperasi',
      created_at: new Date().toISOString(),
    };

    const { error: cfErr } = await supabase
      .from('cash_flow_records')
      .insert([cfPrincipal, cfInterest]);

    if (cfErr) {
      console.warn('Peringatan: Gagal mencatat kas pencairan simpanan berjangka:', cfErr.message);
    }

    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser?.name || currentUser?.username || 'Admin SP',
          actor_role: currentUser?.role || 'admin_sp',
          action: 'COMPLETE_BERJANGKA',
          entity_type: 'savings_transactions',
          entity_id: id,
          description: `Pencairan dan penyelesaian Simpanan Berjangka ${id} sebesar ${formatRupiah(amount)} bunga ${formatRupiah(interest)} untuk ${memberName}`,
          new_data: updatedTx,
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
    } catch {}

    return {
      success: true,
      message: `Simpanan Berjangka ${id} berhasil diselesaikan dan dicairkan resmi di database.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Terjadi kendala jaringan: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

