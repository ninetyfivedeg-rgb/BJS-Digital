import { supabase } from '../lib/supabase';
import { Member, MemberStatus, AuthUser } from '../types';
import { loadMembers as loadLocalFallbackMembers, saveMembers, sanitizeUuid } from '../utils/storage';

/**
 * Memetakan baris dari tabel `members` Supabase (snake_case)
 * secara presisi ke interface `Member` aplikasi (camelCase).
 *
 * Kolom tabel Supabase `members`:
 * - id: string ("BJS-001")
 * - nik: string
 * - name: string
 * - phone: string
 * - address: string
 * - join_date: string (YYYY-MM-DD)
 * - join_year: number | string
 * - calculated_months: number
 * - initial_total_savings: number
 * - job: string
 * - status: string ('aktif' | 'pasif' | 'keluar' | 'nonaktif')
 * - notes: string
 */
export function mapSupabaseMemberToMember(row: any): Member {
  return {
    id: row.id,
    nik: row.nik || '',
    name: row.name || '',
    phone: row.phone || '',
    address: row.address || '',
    joinDate: row.join_date || row.joinDate || '',
    joinYear: row.join_year ?? row.joinYear,
    calculatedMonths: row.calculated_months ?? row.calculatedMonths,
    initialTotalSavings: row.initial_total_savings ?? row.initialTotalSavings,
    job: row.job || 'Dinas',
    status: (row.status as MemberStatus) || 'aktif',
    notes: row.notes || undefined,
  };
}

export interface FetchMembersResponse {
  members: Member[];
  error: string | null;
  fromSupabase: boolean;
  totalCount: number;
}

/**
 * Mengambil data anggota langsung dari tabel Supabase `members`.
 *
 * Catatan Fallback:
 * Jika terjadi kegagalan jaringan atau query Supabase, data lokal/dummy
 * dari `loadMembers()` digunakan sebagai cadangan sementara (fallback)
 * agar aplikasi tetap dapat beroperasi tanpa kehilangan integritas.
 */
export async function fetchMembersFromSupabase(): Promise<FetchMembersResponse> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Gagal memuat data anggota dari Supabase:', error.message);
      // Fallback sementara ke data lokal
      const fallbackList = loadLocalFallbackMembers();
      return {
        members: fallbackList,
        error: 'Gagal mengambil data anggota dari server. Menampilkan data cadangan lokal.',
        fromSupabase: false,
        totalCount: fallbackList.length,
      };
    }

    if (data && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapSupabaseMemberToMember);
      saveMembers(mapped);
      return {
        members: mapped,
        error: null,
        fromSupabase: true,
        totalCount: mapped.length,
      };
    }

    // Jika data kosong (misal RLS mengembalikan 0 row untuk sesi saat ini), gunakan fallback
    const fallbackList = loadLocalFallbackMembers();
    return {
      members: fallbackList,
      error: null,
      fromSupabase: false,
      totalCount: fallbackList.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat mengambil data anggota dari Supabase:', err);
    // Fallback sementara jika terjadi kendala jaringan/runtime
    const fallbackList = loadLocalFallbackMembers();
    return {
      members: fallbackList,
      error: 'Terjadi kendala saat menghubungi server. Menampilkan data cadangan lokal.',
      fromSupabase: false,
      totalCount: fallbackList.length,
    };
  }
}

/**
 * Memperbarui data anggota di tabel Supabase `members`.
 * Menjamin perubahan nama, status, unit kerja, dll. tersimpan persistent antar-device.
 */
export async function updateMemberInSupabase(
  updatedMember: Member,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; data?: Member; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang dapat memperbarui data anggota.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const updatePayload: any = {
      name: updatedMember.name?.trim(),
      nik: updatedMember.nik?.trim() || '',
      phone: updatedMember.phone?.trim() || '',
      address: updatedMember.address?.trim() || '',
      job: updatedMember.job?.trim() || 'Dinas',
      status: updatedMember.status || 'aktif',
      notes: updatedMember.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('members')
      .update(updatePayload)
      .eq('id', updatedMember.id)
      .select('*')
      .single();

    if (error) {
      console.error('Gagal memperbarui data anggota di Supabase:', error);
      return {
        success: false,
        message: `Gagal memperbarui data anggota di server: ${error.message}`,
        error: error.message,
      };
    }

    // Catat ke audit_logs
    try {
      const validUserUuid = sanitizeUuid(currentUser.id);
      const auditPayload = {
        user_id: validUserUuid || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'UPDATE_MEMBER',
        entity_type: 'members',
        entity_id: updatedMember.id,
        description: `Memperbarui data anggota ${updatedMember.id} (${updatedMember.name}) - Status: ${updatedMember.status}`,
        new_data: updatePayload,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return {
      success: true,
      message: `Data anggota ${updatedMember.name} (${updatedMember.id}) berhasil diperbarui resmi di database.`,
      data: mapSupabaseMemberToMember(data || updatedMember),
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
 * Menambahkan data anggota baru ke tabel Supabase `members`.
 */
export async function createMemberInSupabase(
  newMember: Member,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; data?: Member; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang dapat mendaftarkan anggota baru.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const insertPayload: any = {
      id: newMember.id,
      name: newMember.name?.trim(),
      nik: newMember.nik?.trim() || '',
      phone: newMember.phone?.trim() || '',
      address: newMember.address?.trim() || '',
      job: newMember.job?.trim() || 'Dinas',
      status: newMember.status || 'aktif',
      join_date: newMember.joinDate || new Date().toISOString().split('T')[0],
      join_year: newMember.joinYear || new Date().getFullYear(),
      notes: newMember.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('members')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Gagal menambahkan anggota ke Supabase:', error);
      return {
        success: false,
        message: `Gagal mendaftarkan anggota baru ke server: ${error.message}`,
        error: error.message,
      };
    }

    try {
      const validUserUuid = sanitizeUuid(currentUser.id);
      const auditPayload = {
        user_id: validUserUuid || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'CREATE_MEMBER',
        entity_type: 'members',
        entity_id: newMember.id,
        description: `Mendaftarkan anggota baru ${newMember.id} (${newMember.name})`,
        new_data: insertPayload,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return {
      success: true,
      message: `Anggota baru ${newMember.name} (${newMember.id}) berhasil didaftarkan di database.`,
      data: mapSupabaseMemberToMember(data || insertPayload),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Terjadi kendala jaringan: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}
