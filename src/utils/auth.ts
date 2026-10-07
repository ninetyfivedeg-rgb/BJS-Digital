import { AuthUser, Member, UserRole } from '../types';
import { supabase } from '../lib/supabase';

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
      const rawRole = (profile.role || '').toLowerCase();
      const role: UserRole = rawRole === 'pengurus' || rawRole === 'admin' ? 'pengurus' : 'anggota';
      const memberId = profile.member_id || profile.memberId || defaultUsername || '';
      const name = profile.name || profile.full_name || profile.nama || memberId || 'Pengguna BJS';
      const unitKerja = profile.unit_kerja || profile.unitKerja || profile.job || undefined;
      const mustChangePassword = Boolean(profile.must_change_password ?? profile.mustChangePassword);

      return {
        id: userId,
        username: memberId || defaultUsername || (fallbackEmail ? fallbackEmail.split('@')[0] : 'bjs-user'),
        name,
        role,
        memberId: role === 'anggota' ? memberId : undefined,
        unitKerja,
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
 * Mendukung login Anggota (nomor registrasi BJS-xxx) dan Pengurus.
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
      // Pesan human-friendly tanpa mengekspos detail teknis atau key
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

      // Log aman untuk debugging tanpa membocorkan kredensial, token, atau key
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
      return { success: true, user: userProfile };
    }

    // Fallback data user
    const fallbackUser: AuthUser = {
      id: data.user.id,
      username: cleanUser,
      name: cleanUser,
      role: cleanUser.toLowerCase().includes('pengurus') ? 'pengurus' : 'anggota',
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
    // 1. Verifikasi kecocokan kata sandi lama terlebih dahulu dengan login ulang internal
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

    // 2. Perbarui kata sandi baru menggunakan Supabase Auth
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      return {
        success: false,
        error: 'Gagal memperbarui kata sandi di server: ' + updateErr.message,
      };
    }

    // 3. Perbarui tabel profiles (set must_change_password = false)
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
