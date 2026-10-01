import React from 'react';
import { Menu, Calendar, ShieldCheck, User, KeyRound, LogOut } from 'lucide-react';
import { formatDateIndo } from '../utils/formatters';
import { NavTab } from './Sidebar';
import { AuthUser, UserRole } from '../types';

interface TopHeaderProps {
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  currentUser: AuthUser | null;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  currentUser,
  onOpenChangePassword,
  onLogout,
}) => {
  const today = new Date().toISOString();

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard Operasional',
      subtitle: 'Ringkasan Eksekutif & Statistik Finansial',
    },
    anggota: {
      title: 'Buku Data Anggota',
      subtitle: 'Daftar Anggota, Nomor Registrasi & Unit Kerja',
    },
    simpanan: {
      title: 'Simpanan Koperasi',
      subtitle: 'Simpanan Pokok, Wajib & Berjangka 6%',
    },
    pinjaman: {
      title: 'Pinjaman & Angsuran',
      subtitle: 'Plafon, Bunga Flat 1,1%/Bulan & Jadwal Amortisasi',
    },
    unit_usaha: {
      title: 'Laporan Unit Usaha',
      subtitle: 'Penjualan Alat Kebakaran, Isi Ulang APAR, Sembako & Atribut',
    },
    shu: {
      title: 'Sisa Hasil Usaha (SHU)',
      subtitle: 'Alokasi Dana Cadangan, Pengurus, Pegawai & Jasa Anggota',
    },
    simulasi: {
      title: 'Simulasi Finansial',
      subtitle: 'Kalkulator Angsuran Flat 1,1% & Bagi Hasil Berjangka 6%',
    },
    laporan: {
      title: 'Buku Kas & Laporan RAT',
      subtitle: 'Arus Kas Operasional & Neraca SAK ETAP Koperasi',
    },
  };

  const currentTabInfo = tabTitles[activeTab] || { title: 'BJS Digital', subtitle: 'Sistem Informasi Koperasi' };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      {/* Left: Mobile hamburger & Active Page Title */}
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-blue-900 border border-slate-200 transition cursor-pointer"
          aria-label="Buka Menu Navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2
            className="text-base sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate"
            style={{ fontSize: '24px' }}
          >
            {currentTabInfo.title}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium truncate hidden sm:block">
            {currentTabInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Date, User Identity, Change Password & Logout */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Date Display */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDateIndo(today)}</span>
        </div>

        {/* User Card */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[160px]">
                {currentUser.name}
              </p>
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                <span className="font-mono">{currentUser.username}</span>
                <span>&bull;</span>
                <span className="capitalize font-semibold text-blue-900">{currentUser.role}</span>
              </div>
            </div>

            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
                currentUser.role === 'pengurus'
                  ? 'bg-gradient-to-br from-blue-900 to-indigo-900'
                  : 'bg-gradient-to-br from-emerald-700 to-teal-800'
              }`}
              title={`${currentUser.name} (${currentUser.role})`}
            >
              {currentUser.role === 'pengurus' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>

            {/* Quick Action: Ganti Password */}
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="p-2 rounded-xl text-slate-600 hover:text-blue-900 hover:bg-blue-50 border border-slate-200 transition cursor-pointer"
              title="Ganti Kata Sandi"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Quick Action: Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
              title="Keluar (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
