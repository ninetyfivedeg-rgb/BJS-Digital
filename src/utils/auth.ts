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
      const memberId = profile.member_id || profile.memberId || defaultUsername || '';
      const name = profile.name || profile.full_name || profile.nama || memberId || 'Pengguna BJS';
      const unitKerja = profile.unit_kerja || profile.unitKerja || profile.job || undefined;
      const managedUnit = (profile.managed_unit || ROLE_TO_MANAGED_UNIT[role] || null) as BusinessUnitId | null;
      const mustChangePassword = Boolean(profile.must_change_password ?? profile.mustChangePassword);

      const emailUsername = fallbackEmail ? fallbackEmail.split('@')[0] : undefined;

      return {
        id: userId,
        username: memberId || defaultUsername || emailUsername || 'bjs-user',
        name,
        role,
        memberId: role === 'anggota' ? memberId : undefined,
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
