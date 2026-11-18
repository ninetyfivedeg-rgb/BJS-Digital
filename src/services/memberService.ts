import { supabase } from '../lib/supabase';
import { Member, MemberStatus, AuthUser } from '../types';
import { sanitizeUuid } from '../utils/storage';
import { isSuperAdmin } from '../utils/permissions';

/**
 * Memetakan baris dari tabel `members` Supabase (snake_case)
 * secara presisi ke interface `Member` aplikasi (camelCase).
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
 * Mengambil data anggota langsung dari tabel Supabase `members` tanpa fallback lokal.
 */
export async function fetchMembersFromSupabase(): Promise<FetchMembersResponse> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Gagal memuat data anggota dari Supabase:', error.message);
      return {
        members: [],
        error: `Gagal mengambil data anggota dari server: ${error.message}`,
        fromSupabase: false,
        totalCount: 0,
      };
    }

    const mapped = (data || []).map(mapSupabaseMemberToMember);
    return {
      members: mapped,
      error: null,
      fromSupabase: true,
      totalCount: mapped.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat mengambil data anggota dari Supabase:', err);
    return {
      members: [],
      error: 'Terjadi kendala jaringan saat mengambil data anggota dari server.',
      fromSupabase: false,
      totalCount: 0,
    };
  }
}

/**
 * Memperbarui data anggota di tabel Supabase `members` (hanya Super Admin).
 */
export async function updateMemberInSupabase(
  updatedMember: Member,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; data?: Member; error?: string }> {
  if (!isSuperAdmin(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin yang berwenang memperbarui data anggota.',
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

    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser?.name || currentUser?.username || 'Super Admin',
          actor_role: currentUser?.role || 'super_admin',
          action: 'UPDATE_MEMBER',
          entity_type: 'members',
          entity_id: updatedMember.id,
          description: `Memperbarui data anggota ${updatedMember.id} (${updatedMember.name}) - Status: ${updatedMember.status}`,
          new_data: updatePayload,
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
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
 * Menambahkan data anggota baru ke tabel Supabase `members` (hanya Super Admin).
 */
export async function createMemberInSupabase(
  newMember: Member,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; data?: Member; error?: string }> {
  if (!isSuperAdmin(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin yang berwenang mendaftarkan anggota baru.',
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
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        const auditPayload = {
          user_id: validUserUuid,
          actor_name: currentUser?.name || currentUser?.username || 'Super Admin',
          actor_role: currentUser?.role || 'super_admin',
          action: 'CREATE_MEMBER',
          entity_type: 'members',
          entity_id: newMember.id,
          description: `Mendaftarkan anggota baru ${newMember.id} (${newMember.name})`,
          new_data: insertPayload,
          created_at: new Date().toISOString(),
        };
        await supabase.from('audit_logs').insert([auditPayload]);
      }
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
