import { AuthUser, BusinessUnitId, UserRole } from '../types';

export type AppNavTab =
  | 'dashboard'
  | 'anggota'
  | 'simpanan'
  | 'pinjaman'
  | 'laporan_usp'
  | 'unit_usaha'
  | 'shu'
  | 'simulasi'
  | 'laporan'
  | 'audit_log'
  | 'manajemen_user';

export const ROLE_TO_MANAGED_UNIT: Record<string, BusinessUnitId> = {
  pengurus_apar: 'alat_kebakaran',
  pengurus_isi_ulang_apar: 'apar',
  pengurus_sembako: 'sembako',
  pengurus_atribut: 'atribut',
};

export const MANAGED_UNIT_TO_ROLE: Record<BusinessUnitId, UserRole> = {
  alat_kebakaran: 'pengurus_apar',
  apar: 'pengurus_isi_ulang_apar',
  sembako: 'pengurus_sembako',
  atribut: 'pengurus_atribut',
};

export function normalizeRole(rawRole?: string | null): UserRole {
  const clean = (rawRole || '').trim().toLowerCase();
  if (clean === 'super_admin') return 'super_admin';
  if (clean === 'pengurus' || clean === 'admin') return 'pengurus';
  if (clean === 'admin_sp' || clean === 'admin_simpan_pinjam') return 'admin_sp';
  if (clean === 'pengurus_apar') return 'pengurus_apar';
  if (clean === 'pengurus_isi_ulang_apar') return 'pengurus_isi_ulang_apar';
  if (clean === 'pengurus_sembako') return 'pengurus_sembako';
  if (clean === 'pengurus_atribut') return 'pengurus_atribut';
  return 'anggota';
}

export function isSuperAdmin(user?: AuthUser | null): boolean {
  if (!user || user.isActive === false) return false;
  return user.role === 'super_admin' || user.role === 'pengurus';
}

export function isAdminSp(user?: AuthUser | null): boolean {
  if (!user || user.isActive === false) return false;
  return user.role === 'admin_sp';
}

export function isSimpanPinjamOfficer(user?: AuthUser | null): boolean {
  return isSuperAdmin(user) || isAdminSp(user);
}

export function getManagedBusinessUnit(user?: AuthUser | null): BusinessUnitId | null {
  if (!user || user.isActive === false) return null;
  if (user.managedUnit) return user.managedUnit;
  return ROLE_TO_MANAGED_UNIT[user.role] || null;
}

export function isBusinessUnitManager(user?: AuthUser | null): boolean {
  if (!user || user.isActive === false) return false;
  return !isSuperAdmin(user) && getManagedBusinessUnit(user) !== null;
}

export function isAnggotaUser(user?: AuthUser | null): boolean {
  if (!user || user.isActive === false) return true;
  return !isSuperAdmin(user) && !isAdminSp(user) && !isBusinessUnitManager(user);
}

export function canManageBusinessUnit(user: AuthUser | null | undefined, unitId: BusinessUnitId): boolean {
  if (isSuperAdmin(user)) return true;
  const managed = getManagedBusinessUnit(user);
  return managed !== null && managed === unitId;
}

export function getRoleDisplayLabel(user?: AuthUser | null): string {
  if (!user) return 'Pengguna';
  switch (user.role) {
    case 'super_admin':
    case 'pengurus':
      return 'Super Admin';
    case 'admin_sp':
      return 'Admin Simpan Pinjam';
    case 'pengurus_apar':
      return 'Pengelola Alat Kebakaran';
    case 'pengurus_isi_ulang_apar':
      return 'Pengelola Isi Ulang APAR';
    case 'pengurus_sembako':
      return 'Pengelola Sembako';
    case 'pengurus_atribut':
      return 'Pengelola Atribut';
    default:
      return 'Anggota';
  }
}

export function getDefaultTabForUser(user?: AuthUser | null): AppNavTab {
  if (isSuperAdmin(user)) return 'dashboard';
  if (isAdminSp(user)) return 'pinjaman';
  if (isBusinessUnitManager(user)) return 'unit_usaha';
  return 'dashboard';
}

export function canAccessTab(user: AuthUser | null | undefined, tab: AppNavTab): boolean {
  if (!user || user.isActive === false) return false;
  if (isSuperAdmin(user)) return true;

  if (isAdminSp(user)) {
    return (
      tab === 'anggota' ||
      tab === 'simpanan' ||
      tab === 'pinjaman' ||
      tab === 'laporan_usp' ||
      tab === 'simulasi'
    );
  }

  if (isBusinessUnitManager(user)) {
    return tab === 'unit_usaha';
  }

  // Anggota
  return (
    tab === 'dashboard' ||
    tab === 'anggota' ||
    tab === 'simpanan' ||
    tab === 'pinjaman' ||
    tab === 'simulasi'
  );
}
