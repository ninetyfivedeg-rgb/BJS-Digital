import { AuthUser, Member, UserRole } from '../types';

const PASSWORDS_KEY = 'bjs_user_passwords';
const SESSION_KEY = 'bjs_current_user';
const DEFAULT_PASSWORD = 'Damkar123';

/**
 * Load password dictionary from localStorage.
 * Key is lowercased username (e.g. 'pengurus', 'bjs-001').
 */
function getStoredPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PASSWORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load user passwords', e);
  }
  return {};
}

/**
 * Save password dictionary to localStorage.
 */
function saveStoredPasswords(passwords: Record<string, string>): void {
  try {
    localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
  } catch (e) {
    console.error('Failed to save user passwords', e);
  }
}

/**
 * Get active user session
 */
export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse current user', e);
  }
  return null;
}

/**
 * Set active user session
 */
export function setCurrentUser(user: AuthUser | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('bjs_user_role');
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem('bjs_user_role', user.role);
  }
}

/**
 * Get the effective password for a username
 */
export function getUserPassword(username: string): string {
  const norm = username.trim().toLowerCase();
  const passwords = getStoredPasswords();
  return passwords[norm] || DEFAULT_PASSWORD;
}

/**
 * Login function supporting Pengurus & Anggota
 * - Pengurus: username 'pengurus' or 'admin'
 * - Anggota: username is Member Registration ID (e.g. 'BJS-001')
 */
export function authenticateUser(
  usernameInput: string,
  passwordInput: string,
  members: Member[]
): { success: boolean; user?: AuthUser; error?: string } {
  const cleanUser = usernameInput.trim();
  const lowerUser = cleanUser.toLowerCase();

  if (!cleanUser) {
    return { success: false, error: 'Silakan masukkan Nama Pengguna / No. Registrasi Anggota.' };
  }
  if (!passwordInput) {
    return { success: false, error: 'Silakan masukkan kata sandi.' };
  }

  const expectedPassword = getUserPassword(cleanUser);
  if (passwordInput !== expectedPassword) {
    return { success: false, error: 'Kata sandi tidak sesuai. Silakan coba lagi.' };
  }

  // Check if Pengurus
  if (lowerUser === 'pengurus' || lowerUser === 'admin') {
    const pengurusUser: AuthUser = {
      username: 'pengurus',
      name: 'Pengurus Koperasi BJS',
      role: 'pengurus',
    };
    setCurrentUser(pengurusUser);
    return { success: true, user: pengurusUser };
  }

  // Check if Anggota by Member ID (e.g. BJS-001)
  const matchedMember = members.find(
    (m) => m.id.toLowerCase() === lowerUser || m.id.replace(/-/g, '').toLowerCase() === lowerUser.replace(/-/g, '')
  );

  if (matchedMember) {
    const anggotaUser: AuthUser = {
      username: matchedMember.id,
      name: matchedMember.name,
      role: 'anggota',
      memberId: matchedMember.id,
      unitKerja: matchedMember.job,
    };
    setCurrentUser(anggotaUser);
    return { success: true, user: anggotaUser };
  }

  return {
    success: false,
    error: `Nomor Registrasi Anggota "${cleanUser}" tidak ditemukan dalam buku data anggota. Gunakan format seperti BJS-001 atau login sebagai Pengurus.`,
  };
}

/**
 * Change password for a specific user
 */
export function changeUserPassword(
  username: string,
  oldPassword: string,
  newPassword: string
): { success: boolean; error?: string } {
  const cleanUser = username.trim();
  const lowerUser = cleanUser.toLowerCase();

  const currentPass = getUserPassword(cleanUser);
  if (oldPassword !== currentPass) {
    return { success: false, error: 'Kata sandi saat ini tidak cocok.' };
  }

  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'Kata sandi baru minimal 4 karakter.' };
  }

  const passwords = getStoredPasswords();
  passwords[lowerUser] = newPassword;
  saveStoredPasswords(passwords);

  return { success: true };
}

/**
 * Logout
 */
export function logoutUser(): void {
  setCurrentUser(null);
}
