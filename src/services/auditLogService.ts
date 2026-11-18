import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';

/**
 * Memetakan baris dari tabel `audit_logs` Supabase (snake_case)
 * ke interface `AuditLog` aplikasi (camelCase).
 */
export function mapSupabaseAuditLogToAuditLog(row: any): AuditLog {
  return {
    id: String(row.id ?? ''),
    userId: row.user_id || undefined,
    actorName: row.actor_name || undefined,
    actorRole: row.actor_role || undefined,
    action: row.action || 'ACTIVITY',
    entityType: row.entity_type || undefined,
    entityId: row.entity_id || undefined,
    description: row.description || '',
    oldData: row.old_data || undefined,
    newData: row.new_data || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export interface FetchAuditLogsResponse {
  auditLogs: AuditLog[];
  error: string | null;
  fromSupabase: boolean;
  totalCount: number;
}

/**
 * Mengambil data rekam jejak audit sistem dari tabel Supabase `audit_logs`.
 */
export async function fetchAuditLogsFromSupabase(): Promise<FetchAuditLogsResponse> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Gagal memuat rekam jejak audit dari Supabase:', error.message);
      return {
        auditLogs: [],
        error: `Gagal mengambil rekam jejak audit dari server: ${error.message}`,
        fromSupabase: false,
        totalCount: 0,
      };
    }

    const mapped = (data || []).map(mapSupabaseAuditLogToAuditLog);
    return {
      auditLogs: mapped,
      error: null,
      fromSupabase: true,
      totalCount: mapped.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat audit log dari Supabase:', err);
    return {
      auditLogs: [],
      error: 'Terjadi kendala jaringan saat memuat audit log.',
      fromSupabase: false,
      totalCount: 0,
    };
  }
}
