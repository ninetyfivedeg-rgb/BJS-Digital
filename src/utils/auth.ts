import { AuthUser, BusinessUnitId, Member, UserProfileRecord, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { isSuperAdmin, normalizeRole, ROLE_TO_MANAGED_UNIT } from './permissions';
import { sanitizeUuid } from './storage';

/**
 * Konversi nomor anggota atau username menjadi email internal Supabase Auth.
 * Format: nomor anggota -> lowercase -> @bjsdigital.local
 * Contoh: BJS-001 -> bjs-001@bjsdigital.local, pengurus -> pengurus@bjsdigital.local
 */
export function mapUsernameToEmail(usernameInput: string): string {
  const clean = usernameInput.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }
  return `${clean}@bjsdigital.local`;
}

/**
 * Mengambil data profil dari tabel `profiles` berdasarkan Supabase Auth User ID
 */
export async function fetchUserProfile(
  userId: string,
  defaultUsername?: string,
  fallbackEmail?: string
): Promise<AuthUser | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Gagal memuat profil pengguna dari tabel profiles:', error.message);
    }

    if (profile) {
      const role: UserRole = normalizeRole(profile.role);
      const isActive = profile.is_active !== false;
      const rawProfileMemberId = profile.member_id || profile.memberId || undefined;
      const resolvedMemberId = rawProfileMemberId
        ? String(rawProfileMemberId)
        : role === 'anggota' && defaultUsername
        ? defaultUsername
        : undefined;
      const memberIdForDisplay = resolvedMemberId || defaultUsername || '';
      const name = profile.name || profile.full_name || profile.nama || memberIdForDisplay || 'Pengguna BJS';
      const unitKerja = profile.unit_kerja || profile.unitKerja || profile.job || undefined;
      const managedUnit = (profile.managed_unit || ROLE_TO_MANAGED_UNIT[role] || null) as BusinessUnitId | null;
      const mustChangePassword = Boolean(profile.must_change_password ?? profile.mustChangePassword);

      const emailUsername = fallbackEmail ? fallbackEmail.split('@')[0] : undefined;

      return {
        id: userId,
        username: resolvedMemberId || defaultUsername || emailUsername || 'bjs-user',
        name,
        role,
        memberId: resolvedMemberId,
        unitKerja,
        managedUnit,
        isActive,
        mustChangePassword,
        email: fallbackEmail,
      };
    }

    // Jika baris profil belum ditemukan di tabel profiles, buat fallback AuthUser dari informasi sesi
    const derivedUsername =
      defaultUsername || (fallbackEmail ? fallbackEmail.split('@')[0] : 'bjs-user');
    const isPengurus =
      derivedUsername.toLowerCase() === 'pengurus' || derivedUsername.toLowerCase() === 'admin';

    return {
      id: userId,
      username: derivedUsername,
      name: isPengurus ? 'Pengurus Koperasi BJS' : derivedUsername.toUpperCase(),
      role: isPengurus ? 'pengurus' : 'anggota',
      memberId: isPengurus ? undefined : derivedUsername.toUpperCase(),
      managedUnit: null,
      isActive: true,
      mustChangePassword: true,
      email: fallbackEmail,
    };
  } catch (e) {
    console.error('Terjadi kesalahan saat memuat profil:', e);
    return null;
  }
}

/**
 * Fungsi login utama menggunakan Supabase Auth (signInWithPassword).
 * Mendukung login Anggota (nomor registrasi BJS-xxx), Super Admin, Admin SP, dan Manajer Unit.
 */
export async function authenticateUser(
  usernameInput: string,
  passwordInput: string,
  _members?: Member[]
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanUser = usernameInput.trim();
  if (!cleanUser) {
    return {
      success: false,
      error: 'Silakan masukkan Nama Pengguna atau Nomor Registrasi Anggota.',
    };
  }
  if (!passwordInput) {
    return {
      success: false,
      error: 'Silakan masukkan kata sandi.',
    };
  }

  const email = mapUsernameToEmail(cleanUser);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: passwordInput,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('invalid login credentials') ||
        msg.includes('invalid_grant') ||
        msg.includes('user not found')
      ) {
        return {
          success: false,
          error: 'Nomor anggota / username atau kata sandi tidak sesuai. Silakan periksa kembali.',
        };
      }
      if (msg.includes('email not confirmed')) {
        return {
          success: false,
          error: 'Akun belum dikonfirmasi. Silakan hubungi pengurus koperasi.',
        };
      }
      if (
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('timeout')
      ) {
        return {
          success: false,
          error: 'Gagal terhubung ke server autentikasi. Pastikan koneksi internet stabil.',
        };
      }

      console.warn('Supabase Auth response details:', {
        status: error.status,
        name: error.name,
        message: error.message,
      });

      return {
        success: false,
        error: 'Autentikasi gagal. Silakan periksa kembali data login Anda.',
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Data pengguna tidak ditemukan setelah proses autentikasi berhasil.',
      };
    }

    // Ambil profile dari database Supabase
    const userProfile = await fetchUserProfile(data.user.id, cleanUser, data.user.email);
    if (userProfile) {
      if (userProfile.isActive === false) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Akun Anda sedang dinonaktifkan oleh Super Admin. Silakan hubungi pengurus koperasi.',
        };
      }
      return { success: true, user: userProfile };
    }

    // Fallback data user
    const fallbackUser: AuthUser = {
      id: data.user.id,
      username: cleanUser,
      name: cleanUser,
      role: cleanUser.toLowerCase().includes('pengurus') ? 'pengurus' : 'anggota',
      managedUnit: null,
      isActive: true,
      mustChangePassword: true,
      email: data.user.email,
    };

    return { success: true, user: fallbackUser };
  } catch (err: any) {
    console.error('Login error:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat mencoba masuk. Silakan coba kembali sesaat lagi.',
    };
  }
}

/**
 * Mengubah kata sandi pengguna di Supabase Auth dan memperbarui flag `must_change_password` di tabel `profiles`.
 */
export async function changeUserPassword(
  currentUser: AuthUser,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return {
      success: false,
      error: 'Kata sandi baru minimal harus 6 karakter.',
    };
  }

  try {
    const email = currentUser.email || mapUsernameToEmail(currentUser.username);
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    });

    if (verifyErr) {
      return {
        success: false,
        error: 'Kata sandi saat ini tidak cocok. Silakan periksa kembali.',
      };
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      return {
        success: false,
        error: 'Gagal memperbarui kata sandi di server: ' + updateErr.message,
      };
    }

    if (currentUser.id) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', currentUser.id);

      if (profileErr) {
        console.warn('Gagal memperbarui status must_change_password pada profil:', profileErr.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error changing user password:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan saat memperbarui kata sandi. Silakan coba lagi.',
    };
  }
}

/**
 * Mengambil seluruh profil pengguna untuk dikelola Super Admin.
 */
export async function fetchAllUserProfiles(
  currentUser?: AuthUser | null
): Promise<{ profiles: UserProfileRecord[]; error: string | null }> {
  if (!isSuperAdmin(currentUser)) {
    return {
      profiles: [],
      error: 'Akses ditolak: Hanya Super Admin yang dapat melihat daftar hak akses pengguna.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, member_id, name, unit_kerja, managed_unit, is_active, must_change_password, created_at, updated_at')
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return { profiles: [], error: error.message };
    }

    const profiles: UserProfileRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      role: normalizeRole(row.role),
      memberId: row.member_id || null,
      name: row.name || row.member_id || 'Pengguna BJS',
      unitKerja: row.unit_kerja || null,
      managedUnit: row.managed_unit || null,
      isActive: row.is_active !== false,
      mustChangePassword: Boolean(row.must_change_password),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { profiles, error: null };
  } catch (err: any) {
    return { profiles: [], error: err.message || 'Gagal memuat profil pengguna.' };
  }
}

/**
 * Memperbarui role, unit kelola, nama, atau status aktif akun pada tabel `profiles` (khusus Super Admin).
 */
export async function updateUserProfileAssignment(
  targetProfile: UserProfileRecord,
  updates: {
    name: string;
    role: UserRole;
    managedUnit: BusinessUnitId | null;
    isActive: boolean;
    mustChangePassword: boolean;
    unitKerja?: string | null;
  },
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSuperAdmin(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin yang berwenang mengubah role atau status akun.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  // Cegah Super Admin menonaktifkan atau menurunkan role akunnya sendiri secara tidak sengaja
  if (currentUser?.id === targetProfile.id) {
    if (!updates.isActive) {
      return {
        success: false,
        message: 'Tidak diperbolehkan menonaktifkan akun Super Admin yang sedang Anda gunakan.',
        error: 'CANNOT_DEACTIVATE_SELF',
      };
    }
    if (updates.role !== 'super_admin' && updates.role !== 'pengurus') {
      return {
        success: false,
        message: 'Tidak diperbolehkan menurunkan role akun Super Admin yang sedang aktif.',
        error: 'CANNOT_DEMOTE_SELF',
      };
    }
  }

  // Validasi keselarasan role <-> managedUnit untuk pengelola unit usaha
  const expectedUnit = ROLE_TO_MANAGED_UNIT[updates.role] || null;
  const finalManagedUnit = expectedUnit ?? (updates.role === 'super_admin' || updates.role === 'pengurus' || updates.role === 'admin_sp' || updates.role === 'anggota' ? null : updates.managedUnit);

  try {
    const payload = {
      name: updates.name.trim() || targetProfile.name,
      role: updates.role,
      managed_unit: finalManagedUnit,
      is_active: updates.isActive,
      must_change_password: updates.mustChangePassword,
      unit_kerja: updates.unitKerja !== undefined ? updates.unitKerja : targetProfile.unitKerja || null,
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', targetProfile.id);

    if (error) {
      return {
        success: false,
        message: `Gagal memperbarui hak akses pengguna: ${error.message}`,
        error: error.message,
      };
    }

    try {
      const validUserUuid = sanitizeUuid(currentUser?.id);
      if (validUserUuid) {
        await supabase.from('audit_logs').insert([
          {
            user_id: validUserUuid,
            actor_name: currentUser?.name || currentUser?.username || 'Super Admin',
            actor_role: currentUser?.role || 'super_admin',
            action: 'UPDATE_USER_ROLE',
            entity_type: 'profiles',
            entity_id: targetProfile.id,
            description: `Mengubah hak akses ${targetProfile.name} (${targetProfile.role} -> ${updates.role}, unit: ${finalManagedUnit || '-'}, aktif: ${updates.isActive})`,
            old_data: {
              name: targetProfile.name,
              role: targetProfile.role,
              managed_unit: targetProfile.managedUnit || null,
              is_active: targetProfile.isActive,
              must_change_password: targetProfile.mustChangePassword,
            },
            new_data: payload,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log perubahan role:', auditErr);
    }

    return {
      success: true,
      message: `Hak akses dan profil "${payload.name}" berhasil diperbarui.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Kendala jaringan saat memperbarui profil.',
      error: err.message,
    };
  }
}

/**
 * Mereset kata sandi sementara pengguna lain melalui Supabase Edge Function `reset-member-password`
 * (khusus Super Admin). Otomatis mengaktifkan `must_change_password` agar anggota langsung
 * membuat kata sandi baru saat login berikutnya.
 */
export async function adminResetUserPassword(
  targetProfile: UserProfileRecord,
  temporaryPassword: string,
  mustChangePassword: boolean,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSuperAdmin(currentUser)) {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Super Admin yang berwenang mereset kata sandi pengguna.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  if (currentUser?.id === targetProfile.id) {
    return {
      success: false,
      message: 'Gunakan tombol "Ganti Sandi" di header atau sidebar untuk mengubah sandi Anda sendiri.',
      error: 'CANNOT_RESET_SELF',
    };
  }

  const cleanPass = temporaryPassword.trim();
  if (cleanPass.length < 6) {
    return {
      success: false,
      message: 'Kata sandi sementara minimal harus 6 karakter.',
      error: 'INVALID_PASSWORD_LENGTH',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('reset-member-password', {
      body: {
        targetUserId: targetProfile.id,
        temporaryPassword: cleanPass,
        mustChangePassword,
      },
    });

    if (error) {
      const rawMsg = error.message || '';
      const isNotDeployed =
        rawMsg.toLowerCase().includes('failed to send') ||
        rawMsg.toLowerCase().includes('404') ||
        rawMsg.toLowerCase().includes('not found');
      return {
        success: false,
        message: isNotDeployed
          ? 'Edge Function "reset-member-password" belum terpasang di project Supabase Anda. Silakan deploy fungsi tersebut terlebih dahulu melalui Supabase Dashboard.'
          : `Gagal mereset kata sandi: ${rawMsg}`,
        error: rawMsg,
      };
    }

    if (data && data.success === false) {
      return {
        success: false,
        message: data.message || 'Gagal mereset kata sandi pengguna.',
        error: data.message,
      };
    }

    return {
      success: true,
      message:
        data?.message ||
        `Kata sandi sementara untuk "${targetProfile.name}" berhasil diatur.${mustChangePassword ? ' Anggota akan diminta mengganti sandi saat login berikutnya.' : ''}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Terjadi kesalahan saat menghubungi layanan reset kata sandi.',
      error: err?.message,
    };
  }
}

/**
 * Logout dari Supabase Auth
 */
export async function logoutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('Gagal melakukan sign out dari Supabase:', e);
  }
}

/**
 * Stub kompatibilitas (tidak lagi menyimpan kata sandi atau sesi di localStorage)
 */
export function getCurrentUser(): AuthUser | null {
  return null;
}

export function setCurrentUser(_user: AuthUser | null): void {
  // Disengaja kosong: Sesi dikelola sepenuhnya oleh Supabase Auth
}

export interface OfficialAssignments {
  unitManagers: Partial<Record<BusinessUnitId, string>>;
  adminSpName?: string;
}

/**
 * Mengambil nama pengelola resmi unit usaha & Admin Simpan Pinjam terbaru dari tabel `profiles`
 * (dengan pengayaan nama asli dari tabel `members` berdasarkan `member_id`), agar perubahan role
 * oleh Super Admin langsung terefleksi di seluruh laporan, header unit, dan tanda tangan cetak.
 */
export async function fetchOfficialRoleHolders(
  members?: Member[],
  currentUser?: AuthUser | null
): Promise<OfficialAssignments> {
  const unitManagers: Partial<Record<BusinessUnitId, string>> = {};
  let adminSpName: string | undefined;

  const memberNameMap = new Map<string, string>();
  for (const m of members || []) {
    if (m.id && m.name) {
      memberNameMap.set(m.id.toUpperCase(), m.name);
    }
  }

  const assignRoleHolder = (
    rawRole: string,
    rawManagedUnit: string | null | undefined,
    rawName: string | null | undefined,
    rawMemberId: string | null | undefined
  ) => {
    const role = normalizeRole(rawRole);
    const cleanMemberId = rawMemberId?.trim();
    const memberRealName = cleanMemberId ? memberNameMap.get(cleanMemberId.toUpperCase()) : undefined;
    const trimmedName = rawName?.trim();
    const resolvedName =
      trimmedName && trimmedName !== 'Pengguna BJS' && trimmedName !== cleanMemberId
        ? trimmedName
        : memberRealName || trimmedName || cleanMemberId;

    if (!resolvedName) return;

    if (role === 'admin_sp') {
      if (!adminSpName) adminSpName = resolvedName;
      return;
    }

    const unit = (rawManagedUnit || ROLE_TO_MANAGED_UNIT[role]) as BusinessUnitId | undefined;
    if (unit && !unitManagers[unit]) {
      unitManagers[unit] = resolvedName;
    }
  };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, member_id, name, managed_unit, is_active, updated_at')
      .in('role', [
        'admin_sp',
        'pengurus_apar',
        'pengurus_isi_ulang_apar',
        'pengurus_sembako',
        'pengurus_atribut',
      ])
      .neq('is_active', false)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      for (const row of data as any[]) {
        assignRoleHolder(row.role, row.managed_unit, row.name, row.member_id);
      }
    }
  } catch (err) {
    console.warn('Gagal memuat nama pengelola resmi dari profiles:', err);
  }

  // Fallback langsung dari sesi user aktif jika ia sendiri adalah pejabat unit / Admin SP
  if (currentUser && currentUser.isActive !== false) {
    assignRoleHolder(
      currentUser.role,
      currentUser.managedUnit,
      currentUser.name,
      currentUser.memberId || currentUser.username
    );
  }

  return { unitManagers, adminSpName };
}
