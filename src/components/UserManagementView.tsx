import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Edit3,
  CheckCircle2,
  XCircle,
  Info,
  X,
  UserCog,
  Users,
  Lock,
} from 'lucide-react';
import { AuthUser, BusinessUnitId, Member, UserProfileRecord, UserRole } from '../types';
import { fetchAllUserProfiles, updateUserProfileAssignment } from '../utils/auth';
import { getRoleDisplayLabel, ROLE_TO_MANAGED_UNIT } from '../utils/permissions';

interface UserManagementViewProps {
  currentUser: AuthUser | null;
  members?: Member[];
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin (Akses Penuh)' },
  { value: 'pengurus', label: 'Pengurus Legacy (Setara Super Admin)' },
  { value: 'admin_sp', label: 'Admin Simpan Pinjam' },
  { value: 'pengurus_apar', label: 'Pengelola Alat Kebakaran' },
  { value: 'pengurus_isi_ulang_apar', label: 'Pengelola Isi Ulang APAR' },
  { value: 'pengurus_sembako', label: 'Pengelola Penjualan Sembako' },
  { value: 'pengurus_atribut', label: 'Pengelola Penjualan Atribut' },
  { value: 'anggota', label: 'Anggota Biasa' },
];

const UNIT_OPTIONS: { value: '' | BusinessUnitId; label: string }[] = [
  { value: '', label: '— Tidak Terikat Unit Usaha —' },
  { value: 'alat_kebakaran', label: 'Unit Penjualan Alat Kebakaran' },
  { value: 'apar', label: 'Unit Isi Ulang APAR' },
  { value: 'sembako', label: 'Unit Penjualan Sembako' },
  { value: 'atribut', label: 'Unit Penjualan Atribut' },
];

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, members = [] }) => {
  const [profiles, setProfiles] = useState<UserProfileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('semua');
  const [editingProfile, setEditingProfile] = useState<UserProfileRecord | null>(null);
  const [formState, setFormState] = useState<{
    name: string;
    role: UserRole;
    managedUnit: BusinessUnitId | null;
    isActive: boolean;
    mustChangePassword: boolean;
    unitKerja: string;
  }>({
    name: '',
    role: 'anggota',
    managedUnit: null,
    isActive: true,
    mustChangePassword: false,
    unitKerja: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchAllUserProfiles(currentUser);
    setProfiles(res.profiles);
    if (res.error) setError(res.error);
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const enrichedProfiles = useMemo(() => {
    const memberMap = new Map<string, Member>();
    for (const m of members) {
      if (m.id) memberMap.set(m.id.toUpperCase(), m);
    }
    return profiles.map((p) => {
      const m = p.memberId ? memberMap.get(p.memberId.toUpperCase()) : undefined;
      if (!m) return p;
      const needsNameFallback = !p.name || p.name === 'Pengguna BJS' || p.name === p.memberId;
      return {
        ...p,
        name: needsNameFallback ? m.name : p.name,
        unitKerja: p.unitKerja || m.job || null,
      };
    });
  }, [profiles, members]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedProfiles.filter((p) => {
      if (roleFilter !== 'semua' && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.memberId || '').toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        (p.unitKerja || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedProfiles, searchQuery, roleFilter]);

  const counts = useMemo(() => {
    const activeCount = profiles.filter((p) => p.isActive).length;
    const officerCount = profiles.filter((p) => p.role !== 'anggota').length;
    const inactiveCount = profiles.filter((p) => !p.isActive).length;
    return {
      total: profiles.length,
      activeCount,
      officerCount,
      inactiveCount,
    };
  }, [profiles]);

  const openEditModal = (p: UserProfileRecord) => {
    setEditingProfile(p);
    setFormState({
      name: p.name,
      role: p.role,
      managedUnit: p.managedUnit || ROLE_TO_MANAGED_UNIT[p.role] || null,
      isActive: p.isActive,
      mustChangePassword: p.mustChangePassword,
      unitKerja: p.unitKerja || '',
    });
  };

  const handleRoleChange = (newRole: UserRole) => {
    const mappedUnit = ROLE_TO_MANAGED_UNIT[newRole] || null;
    setFormState((prev) => ({
      ...prev,
      role: newRole,
      managedUnit: mappedUnit,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    const res = await updateUserProfileAssignment(
      editingProfile,
      {
        name: formState.name,
        role: formState.role,
        managedUnit: formState.managedUnit,
        isActive: formState.isActive,
        mustChangePassword: formState.mustChangePassword,
        unitKerja: formState.unitKerja || null,
      },
      currentUser
    );

    setIsSaving(false);
    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
      setEditingProfile(null);
      await loadProfiles();
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
            <UserCog className="w-3.5 h-3.5" />
            Kontrol Akses Super Admin (RBAC)
          </span>
          <h3 className="text-lg font-black text-slate-900 mt-1.5">
            Manajemen User & Role Pengelola
          </h3>
          <p className="text-xs text-slate-500">
            Atur jabatan role, unit usaha kelolaan, status aktif akun, dan kewajiban ganti sandi di tabel profiles.
          </p>
        </div>

        <button
          type="button"
          onClick={loadProfiles}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Muat Ulang Data
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-800 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950 space-y-1">
          <p className="font-bold">Penunjukan Pengurus dari Daftar Anggota yang Sudah Ada</p>
          <p className="text-blue-900 leading-relaxed">
            Super Admin dapat langsung mencari nomor atau nama anggota yang sudah memiliki akun (misalnya{' '}
            <code>BJS-053</code>) pada tabel di bawah ini, lalu klik <strong>Ubah Hak Akses</strong> untuk
            menetapkan role (<code>admin_sp</code>, <code>pengurus_apar</code>,{' '}
            <code>pengurus_isi_ulang_apar</code>, <code>pengurus_sembako</code>,{' '}
            <code>pengurus_atribut</code>, atau <code>super_admin</code>). Anggota tersebut tetap login
            menggunakan nomor anggota &amp; kata sandinya yang sudah terdaftar di Supabase Auth.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">Total Profil Terdaftar</span>
            <Users className="w-4 h-4 text-blue-800" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900">{counts.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">Pengurus & Pengelola Unit</span>
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-800">{counts.officerCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">Akun Nonaktif</span>
            <Lock className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black font-mono text-rose-700">{counts.inactiveCount}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, nomor anggota (BJS-...), atau role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
          >
            <option value="semua">Semua Role ({profiles.length})</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-bold">Nama & ID Anggota</th>
                <th className="py-3 px-4 font-bold">Role Sistem</th>
                <th className="py-3 px-4 font-bold">Unit Kelolaan</th>
                <th className="py-3 px-4 font-bold">Status Akun</th>
                <th className="py-3 px-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    {isLoading ? 'Memuat daftar profil pengguna...' : 'Tidak ada profil yang cocok.'}
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const isSelf = currentUser?.id === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-extrabold">
                              ANDA
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                          {p.memberId || p.id.slice(0, 8)} {p.unitKerja ? `• ${p.unitKerja}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            p.role === 'super_admin' || p.role === 'pengurus'
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : p.role === 'admin_sp'
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                              : p.role === 'anggota'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}
                        >
                          {getRoleDisplayLabel({
                            username: p.memberId || '',
                            name: p.name,
                            role: p.role,
                            managedUnit: p.managedUnit,
                          })}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {p.managedUnit || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {p.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Ubah Hak Akses
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Role */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <UserCog className="w-4 h-4 text-blue-900" />
                Ubah Hak Akses Pengguna
              </h4>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Tampilan</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Hak Akses</label>
                <select
                  value={formState.role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  disabled={currentUser?.id === editingProfile.id}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {currentUser?.id === editingProfile.id && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Role akun Super Admin yang sedang aktif tidak dapat diturunkan sendiri.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Unit Usaha Kelolaan</label>
                <select
                  value={formState.managedUnit || ''}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      managedUnit: (e.target.value || null) as BusinessUnitId | null,
                    })
                  }
                  disabled={
                    formState.role === 'super_admin' ||
                    formState.role === 'pengurus' ||
                    formState.role === 'admin_sp' ||
                    formState.role === 'anggota'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 disabled:bg-slate-100"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    disabled={currentUser?.id === editingProfile.id}
                    onChange={(e) => setFormState({ ...formState, isActive: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="font-bold text-slate-800">Akun Aktif</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.mustChangePassword}
                    onChange={(e) =>
                      setFormState({ ...formState, mustChangePassword: e.target.checked })
                    }
                    className="rounded border-slate-300"
                  />
                  <span className="font-bold text-slate-800">Wajib Ganti Sandi</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 font-bold text-white bg-blue-900 hover:bg-blue-950 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
