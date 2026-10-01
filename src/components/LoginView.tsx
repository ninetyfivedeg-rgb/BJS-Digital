import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Eye, EyeOff, LogIn, AlertCircle, Building2 } from 'lucide-react';
import { Member, AuthUser } from '../types';
import { authenticateUser } from '../utils/auth';

interface LoginViewProps {
  members: Member[];
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ members, onLoginSuccess }) => {
  const [roleTab, setRoleTab] = useState<'pengurus' | 'anggota'>('pengurus');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (newTab: 'pengurus' | 'anggota') => {
    setRoleTab(newTab);
    setErrorMsg('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const result = authenticateUser(username, password, members);
      setIsLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMsg(result.error || 'Autentikasi gagal. Silakan periksa kembali username dan kata sandi Anda.');
      }
    }, 200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900/0 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100/20 overflow-hidden">
          {/* Logo Header */}
          <div className="pt-8 pb-5 px-8 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
            <div className="p-2 rounded-2xl bg-white shadow-sm border border-slate-200/80 mb-3 flex items-center justify-center">
              <img
                src="/logo-bjs.png"
                alt="Logo BJS Digital"
                className="h-16 w-auto max-w-[220px] object-contain"
              />
            </div>
            <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-200/60 uppercase tracking-widest">
              Sistem Informasi Koperasi
            </span>
          </div>

          <div className="p-6 sm:p-8">
            {/* Role Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => handleTabChange('pengurus')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  roleTab === 'pengurus'
                    ? 'bg-blue-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Pengurus</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('anggota')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  roleTab === 'anggota'
                    ? 'bg-blue-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Anggota</span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMsg}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {roleTab === 'pengurus' ? 'Nama Pengguna (Username)' : 'Nomor Registrasi Anggota (Username)'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    {roleTab === 'pengurus' ? <ShieldCheck className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={roleTab === 'pengurus' ? 'Masukkan username pengurus' : 'Contoh: BJS-001'}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
                {roleTab === 'anggota' && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Gunakan nomor registrasi keanggotaan Anda (format: <span className="font-mono font-bold text-blue-900">BJS-001</span>).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Kata Sandi (Password)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-950 hover:to-indigo-950 text-white text-xs font-extrabold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Akun {roleTab === 'pengurus' ? 'Pengurus' : 'Anggota'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Koperasi Brama Jaya Sejahtera &bull; BJS Digital
        </p>
      </div>
    </div>
  );
};
