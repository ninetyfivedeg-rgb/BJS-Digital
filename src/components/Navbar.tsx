import React from 'react';
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  HandCoins,
  Calculator,
  FileSpreadsheet,
  Building2,
  Calendar,
} from 'lucide-react';
import { formatDateIndo } from '../utils/formatters';

export type NavTab = 'dashboard' | 'anggota' | 'simpanan' | 'pinjaman' | 'simulasi' | 'laporan';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  pendingLoansCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, pendingLoansCount }) => {
  const today = new Date().toISOString();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'anggota', label: 'Data Anggota', icon: Users },
    { id: 'simpanan', label: 'Simpanan', icon: PiggyBank },
    {
      id: 'pinjaman',
      label: 'Pinjaman & Angsuran',
      icon: HandCoins,
      badge: pendingLoansCount > 0 ? pendingLoansCount : undefined,
    },
    { id: 'simulasi', label: 'Simulasi & SHU', icon: Calculator },
    { id: 'laporan', label: 'Buku Kas & Laporan', icon: FileSpreadsheet },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                  Koperasi Simpan Pinjam Sejahtera Mandiri
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                  KSP Mandiri
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sistem Pengelolaan Simpan Pinjam, Angsuran & SHU Anggota Koperasi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>{formatDateIndo(today)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-slate-700 hidden sm:inline">Kasir Aktif</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Row */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
