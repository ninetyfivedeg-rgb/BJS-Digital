import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';
import { loadAuditLogs as loadLocalFallbackAuditLogs } from '../utils/storage';

/**
 * Memetakan baris dari tabel `audit_logs` Supabase (snake_case)
 * ke interface `AuditLog` aplikasi (camelCase).
 *
 * Kolom tabel Supabase `audit_logs`:
 * - id: string
 * - user_id: string
 * - actor_name: string
 * - actor_role: string
 * - action: string
 * - entity_type: string
 * - entity_id: string
 * - description: string
 * - old_data: any (JSON)
 * - new_data: any (JSON)
 * - created_at: string (timestamp)
 */
export function mapSupabaseAuditLogToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
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
 *
 * PENTING:
 * - Operasi ini HANYA pembacaan data (READ ONLY).
 * - Tidak ada penambahan/pencatatan audit log baru pada tahap ini.
 *
 * Catatan Fallback:
 * Jika terjadi kegagalan jaringan atau query Supabase, data lokal/dummy
 * dari `loadAuditLogs()` digunakan sebagai cadangan sementara (fallback).
 */
export async function fetchAuditLogsFromSupabase(): Promise<FetchAuditLogsResponse> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Gagal memuat rekam jejak audit dari Supabase:', error.message);
      const fallback = loadLocalFallbackAuditLogs();
      return {
        auditLogs: fallback,
        error: 'Gagal mengambil rekam jejak audit dari server. Menampilkan data cadangan lokal.',
        fromSupabase: false,
        totalCount: fallback.length,
      };
    }

    if (data && Array.isArray(data)) {
      const mapped = data.map(mapSupabaseAuditLogToAuditLog);
      return {
        auditLogs: mapped,
        error: null,
        fromSupabase: true,
        totalCount: mapped.length,
      };
    }

    const fallback = loadLocalFallbackAuditLogs();
    return {
      auditLogs: fallback,
      error: null,
      fromSupabase: false,
      totalCount: fallback.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat audit log dari Supabase:', err);
    const fallback = loadLocalFallbackAuditLogs();
    return {
      auditLogs: fallback,
      error: 'Terjadi kendala jaringan saat memuat audit log. Menampilkan data cadangan lokal.',
      fromSupabase: false,
      totalCount: fallback.length,
    };
  }
}
