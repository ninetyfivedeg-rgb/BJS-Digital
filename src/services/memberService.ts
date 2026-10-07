import { supabase } from '../lib/supabase';
import { Member, MemberStatus } from '../types';
import { loadMembers as loadLocalFallbackMembers } from '../utils/storage';

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
