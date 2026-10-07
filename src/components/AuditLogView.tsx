import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  FileText,
  AlertCircle,
  Eye,
  X,
  RefreshCw,
  Layers,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { AuditLog, UserRole } from '../types';
import { formatDateTimeIndo } from '../utils/formatters';

interface AuditLogViewProps {
  auditLogs: AuditLog[];
  isLoading?: boolean;
  error?: string | null;
  isFromSupabase?: boolean;
  onRefresh?: () => void;
  userRole?: UserRole;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  auditLogs,
  isLoading = false,
  error = null,
  isFromSupabase = false,
  onRefresh,
  userRole = 'pengurus',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('semua');
  const [selectedAction, setSelectedAction] = useState<string>('semua');
  const [selectedLogDetail, setSelectedLogDetail] = useState<AuditLog | null>(null);

  // Filter modules options
  const moduleOptions = Array.from(
    new Set(auditLogs.map((l) => l.entityType).filter(Boolean))
  ) as string[];

  // Filter actions options
  const actionOptions = Array.from(
    new Set(auditLogs.map((l) => l.action).filter(Boolean))
  ) as string[];

  // Filtered logs
  const filteredLogs = auditLogs.filter((log) => {
    if (selectedModule !== 'semua' && log.entityType !== selectedModule) {
      return false;
    }
    if (selectedAction !== 'semua' && log.action !== selectedAction) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = log.description?.toLowerCase().includes(q);
      const matchActor = log.actorName?.toLowerCase().includes(q) || log.userId?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchModule = log.entityType?.toLowerCase().includes(q);
      const matchId = log.entityId?.toLowerCase().includes(q) || log.id?.toLowerCase().includes(q);
      return matchDesc || matchActor || matchAction || matchModule || matchId;
    }
    return true;
  });

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('HAPUS') || act.includes('TOLAK')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (act.includes('CREATE') || act.includes('TAMBAH') || act.includes('SETUJU') || act.includes('CAIR')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (act.includes('UPDATE') || act.includes('UBAH') || act.includes('EDIT')) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi Status Data & Loading */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-[11px] font-bold bg-amber-200 hover:bg-amber-300 rounded-lg text-amber-950 transition cursor-pointer"
            >
              Muat Ulang
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 text-xs flex items-center gap-2.5 shadow-2xs animate-pulse">
          <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Mengambil data rekam jejak audit dari tabel Supabase PostgreSQL...</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 rounded-2xl p-5 text-white shadow-md border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-700 text-white shadow-xs">
              SISTEM AUDIT TRAIL & LOG KEAMANAN
            </span>
            <span className="text-xs text-slate-300">Rekam Jejak Aktivitas Operasional</span>
            {isFromSupabase ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                Supabase PostgreSQL ({auditLogs.length} Log)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">
                Cadangan Lokal ({auditLogs.length} Log)
              </span>
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            Buku Rekam Jejak Audit & Log Aktivitas
          </h2>
          <p className="text-slate-300 text-xs mt-0.5">
            Pencatatan transparan seluruh mutasi data, wewenang administrasi, dan riwayat sistem Koperasi BJS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-950 font-bold text-xs shadow-md hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-800" />
              <span>Segarkan Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-100">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Catatan Audit</div>
            <div className="text-xl font-black font-mono text-slate-900">{auditLogs.length} Rekam Log</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Modul Terdata</div>
            <div className="text-xl font-black font-mono text-slate-900">
              {moduleOptions.length > 0 ? moduleOptions.length : '7'} Modul Sistem
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Status Integritas Database</div>
            <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Tersinkronisasi Resmi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari aktivitas, admin, atau detail..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-[11px]">Modul:</span>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-slate-800"
              >
                <option value="semua">Semua Modul</option>
                {moduleOptions.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-[11px]">Aksi:</span>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-slate-800"
              >
                <option value="semua">Semua Aksi</option>
                {actionOptions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedModule !== 'semua' || selectedAction !== 'semua') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedModule('semua');
                  setSelectedAction('semua');
                }}
                className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Riwayat Catatan Audit</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
              {filteredLogs.length} Data
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Waktu & Tanggal</th>
                <th className="px-4 py-3.5">Aktor / Pengguna</th>
                <th className="px-4 py-3.5">Aksi & Modul</th>
                <th className="px-4 py-3.5">Deskripsi Aktivitas</th>
                <th className="px-4 py-3.5 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-xs text-slate-600">Belum ada catatan aktivitas audit log.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Catatan rekam jejak akan otomatis terbaca dari tabel Supabase `audit_logs`.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      <div className="font-semibold text-slate-900">{formatDateTimeIndo(log.createdAt)}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">ID: {log.id.slice(0, 8)}...</div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.actorName || log.userId || 'Sistem / Pengurus'}</span>
                      </div>
                      {log.actorRole && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                          {log.actorRole}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                        {log.entityType && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {log.entityType}
                          </span>
                        )}
                      </div>
                      {log.entityId && (
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">Ref: {log.entityId}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700 max-w-md">
                      <p className="font-medium text-xs text-slate-800 line-clamp-2">{log.description}</p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => setSelectedLogDetail(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
                        title="Lihat Rincian Rekam Log"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Log */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-slate-800" />
                <h3 className="font-bold text-sm text-slate-900">Rincian Rekam Jejak Audit</h3>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">ID Rekam Log:</span>
                  <span className="font-mono text-slate-900 font-bold">{selectedLogDetail.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Waktu & Tanggal:</span>
                  <span className="font-medium text-slate-800">{formatDateTimeIndo(selectedLogDetail.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Aktor / Pengguna:</span>
                  <span className="font-bold text-slate-900">
                    {selectedLogDetail.actorName || selectedLogDetail.userId || 'Sistem / Pengurus'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Aksi & Modul:</span>
                  <span className="font-bold text-blue-900">
                    {selectedLogDetail.action} ({selectedLogDetail.entityType || '-'})
                  </span>
                </div>
                {selectedLogDetail.entityId && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Nomor Referensi Entitas:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedLogDetail.entityId}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Uraian / Deskripsi Aktivitas:</label>
                <p className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 leading-relaxed font-medium">
                  {selectedLogDetail.description}
                </p>
              </div>

              {(selectedLogDetail.oldData || selectedLogDetail.newData) && (
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Payload Data Teknis (JSON):</label>
                  {selectedLogDetail.oldData && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Data Sebelumnya:</div>
                      <pre className="p-2 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono overflow-x-auto max-h-32">
                        {JSON.stringify(selectedLogDetail.oldData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLogDetail.newData && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Data Baru:</div>
                      <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto max-h-32">
                        {JSON.stringify(selectedLogDetail.newData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
