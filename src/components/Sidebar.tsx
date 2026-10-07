import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  HandCoins,
  Calculator,
  FileSpreadsheet,
  X,
  ChevronRight,
  ChevronDown,
  Store,
  Scale,
  KeyRound,
  LogOut,
  ShieldCheck,
  User,
  ShieldAlert,
  Flame,
  ShoppingBag,
  Shirt,
  Layers,
  BadgePercent,
  Wallet,
} from 'lucide-react';
import { AuthUser, BusinessUnitId } from '../types';

export type NavTab =
  | 'dashboard'
  | 'anggota'
  | 'simpanan'
  | 'pinjaman'
  | 'unit_usaha'
  | 'shu'
  | 'simulasi'
  | 'laporan'
  | 'audit_log';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeSavingsSubTab?: 'pokok_wajib' | 'berjangka' | 'mutasi';
  setActiveSavingsSubTab?: (tab: 'pokok_wajib' | 'berjangka' | 'mutasi') => void;
  activeLoanSubTab?: 'daftar_pinjaman' | 'kas_unit_sp';
  setActiveLoanSubTab?: (tab: 'daftar_pinjaman' | 'kas_unit_sp') => void;
  activeUnitId?: 'semua' | BusinessUnitId;
  setActiveUnitId?: (unitId: 'semua' | BusinessUnitId) => void;
  pendingLoansCount: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
  currentUser?: AuthUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeSavingsSubTab = 'pokok_wajib',
  setActiveSavingsSubTab,
  activeLoanSubTab = 'daftar_pinjaman',
  setActiveLoanSubTab,
  activeUnitId = 'semua',
  setActiveUnitId,
  pendingLoansCount,
  mobileOpen,
  setMobileOpen,
  onOpenChangePassword,
  onLogout,
  currentUser,
}) => {
  const [unitUsahaOpen, setUnitUsahaOpen] = useState(true);
  const [simpananOpen, setSimpananOpen] = useState(true);
  const [pinjamanOpen, setPinjamanOpen] = useState(true);

  const savingsSubTabs: { id: 'pokok_wajib' | 'berjangka' | 'mutasi'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'pokok_wajib', label: 'Pokok & Wajib', icon: Layers },
    { id: 'berjangka', label: 'Simpanan Berjangka (6%)', icon: BadgePercent },
    { id: 'mutasi', label: 'Mutasi Simpanan', icon: FileSpreadsheet },
  ];

  const loanSubTabs: { id: 'daftar_pinjaman' | 'kas_unit_sp'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'daftar_pinjaman', label: 'Pinjaman & Angsuran', icon: HandCoins },
    { id: 'kas_unit_sp', label: 'Kas Unit Simpan Pinjam', icon: Wallet },
  ];

  const businessSubUnits: { id: 'semua' | BusinessUnitId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'semua', label: 'Konsolidasi Semua Unit', icon: Layers },
    { id: 'alat_kebakaran', label: 'Penjualan Alat Kebakaran', icon: ShieldAlert },
    { id: 'apar', label: 'Isi Ulang APAR', icon: Flame },
    { id: 'sembako', label: 'Penjualan Sembako', icon: ShoppingBag },
    { id: 'atribut', label: 'Penjualan Atribut', icon: Shirt },
  ];

  const isAnggota = currentUser?.role === 'anggota';

  const rawNavItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'anggota' as NavTab,
      label: isAnggota ? 'Profil Anggota Saya' : 'Buku Data Anggota',
      icon: Users,
    },
    {
      id: 'simpanan' as NavTab,
      label: isAnggota ? 'Simpanan Saya' : 'Simpanan Anggota',
      icon: PiggyBank,
      hasSubMenu: true,
    },
    {
      id: 'pinjaman' as NavTab,
      label: isAnggota ? 'Pinjaman Saya' : 'Pinjaman & Kas SP',
      icon: HandCoins,
      badge: !isAnggota && pendingLoansCount > 0 ? pendingLoansCount : undefined,
      hasSubMenu: !isAnggota,
    },
    {
      id: 'unit_usaha' as NavTab,
      label: 'Laporan Unit Usaha',
      icon: Store,
      hasSubMenu: true,
      hideForAnggota: true,
    },
    {
      id: 'shu' as NavTab,
      label: 'Sisa Hasil Usaha (SHU)',
      icon: Scale,
      hideForAnggota: true,
    },
    {
      id: 'simulasi' as NavTab,
      label: 'Simulasi',
      icon: Calculator,
    },
    {
      id: 'laporan' as NavTab,
      label: 'Buku Kas & Laporan',
      icon: FileSpreadsheet,
      hideForAnggota: true,
    },
    {
      id: 'audit_log' as NavTab,
      label: 'Audit Log & Rekam Jejak',
      icon: ShieldAlert,
      hideForAnggota: true,
    },
  ];

  const navItems = rawNavItems.filter((item) => !(isAnggota && item.hideForAnggota));

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'unit_usaha') {
      setUnitUsahaOpen(true);
    }
    if (tab === 'simpanan') {
      setSimpananOpen(true);
    }
    if (tab === 'pinjaman') {
      setPinjamanOpen(true);
    }
    setMobileOpen(false);
  };

  const handleSelectSavingsSub = (subId: 'pokok_wajib' | 'berjangka' | 'mutasi') => {
    setActiveTab('simpanan');
    if (setActiveSavingsSubTab) {
      setActiveSavingsSubTab(subId);
    }
    setMobileOpen(false);
  };

  const handleSelectLoanSub = (subId: 'daftar_pinjaman' | 'kas_unit_sp') => {
    setActiveTab('pinjaman');
    if (setActiveLoanSubTab) {
      setActiveLoanSubTab(subId);
    }
    setMobileOpen(false);
  };

  const handleSelectSubUnit = (unitId: 'semua' | BusinessUnitId) => {
    setActiveTab('unit_usaha');
    if (setActiveUnitId) {
      setActiveUnitId(unitId);
    }
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white select-none overflow-y-auto">
      {/* Top Section */}
      <div>
        {/* LOGO SAJA di pojok kiri atas antarmuka, tepat di atas menu navigasi */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 bg-white">
          <div className="flex items-center justify-start py-0.5">
            <img
              src="/logo-bjs.png"
              alt="Logo BJS Digital - Koperasi Brama Jaya Sejahtera"
              style={{
                height: '99.9861px',
                marginLeft: '-2px',
                paddingTop: '-4px',
                paddingLeft: '-2px',
                paddingRight: '-2px',
                paddingBottom: '-3px',
                marginBottom: '-15px',
              }}
              className="w-auto object-contain object-left block"
            />
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu List */}
        <div className="p-3" style={{ backgroundColor: '#ffffff' }}>
          <div className="px-2 pb-2 hidden lg:flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Menu Navigasi
            </p>
          </div>
          <nav className="space-y-1" aria-label="Sidebar Menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isUnitUsaha = item.id === 'unit_usaha';
              const isSimpanan = item.id === 'simpanan';
              const isPinjaman = item.id === 'pinjaman';

              return (
                <div key={item.id} className="space-y-0.5">
                  <button
                    onClick={() => {
                      if (isUnitUsaha && activeTab === 'unit_usaha') {
                        setUnitUsahaOpen(!unitUsahaOpen);
                      } else if (isSimpanan && activeTab === 'simpanan') {
                        setSimpananOpen(!simpananOpen);
                      } else if (isPinjaman && activeTab === 'pinjaman') {
                        setPinjamanOpen(!pinjamanOpen);
                      } else {
                        handleSelectTab(item.id);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white shadow-md border-l-4 border-red-600'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-blue-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 transition ${
                          isActive
                            ? 'bg-gradient-to-br from-red-600 to-rose-800 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-900'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-xs truncate ${
                          isActive ? 'text-white font-bold' : 'text-slate-800 font-semibold'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.badge !== undefined && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isActive
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {isUnitUsaha || isSimpanan || (isPinjaman && !isAnggota) ? (
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform shrink-0 ${
                            isActive ? 'text-red-200' : 'text-slate-400'
                          } ${(isUnitUsaha && unitUsahaOpen) || (isSimpanan && simpananOpen) || (isPinjaman && pinjamanOpen) ? 'rotate-180' : ''}`}
                        />
                      ) : (
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform shrink-0 ${
                            isActive
                              ? 'text-red-300 translate-x-0.5'
                              : 'text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-blue-600'
                          }`}
                        />
                      )}
                    </div>
                  </button>

                  {/* Sub-menu untuk Simpanan Anggota */}
                  {isSimpanan && (simpananOpen || isActive) && (
                    <div className="pl-6 pr-1 py-1 space-y-1 bg-slate-50/80 rounded-xl border border-slate-100 my-1">
                      {savingsSubTabs.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isActive && activeSavingsSubTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelectSavingsSub(sub.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
                              isSubActive
                                ? 'bg-blue-900 text-white font-bold shadow-xs'
                                : 'text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 font-medium'
                            }`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-red-300' : 'text-slate-400'}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Sub-menu untuk Pinjaman & Kas Unit Simpan Pinjam */}
                  {isPinjaman && !isAnggota && (pinjamanOpen || isActive) && (
                    <div className="pl-6 pr-1 py-1 space-y-1 bg-slate-50/80 rounded-xl border border-slate-100 my-1">
                      {loanSubTabs.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isActive && activeLoanSubTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelectLoanSub(sub.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
                              isSubActive
                                ? 'bg-blue-900 text-white font-bold shadow-xs'
                                : 'text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 font-medium'
                            }`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-red-300' : 'text-slate-400'}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Sub-menu untuk Laporan Unit Usaha */}
                  {isUnitUsaha && (unitUsahaOpen || isActive) && (
                    <div className="pl-6 pr-1 py-1 space-y-1 bg-slate-50/80 rounded-xl border border-slate-100 my-1">
                      {businessSubUnits.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isActive && activeUnitId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelectSubUnit(sub.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
                              isSubActive
                                ? 'bg-blue-900 text-white font-bold shadow-xs'
                                : 'text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 font-medium'
                            }`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-red-300' : 'text-slate-400'}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Section: User Info, Ganti Password, & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        {currentUser && (
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center shrink-0">
                {currentUser.role === 'pengurus' ? (
                  <ShieldCheck className="w-4 h-4 text-blue-800" />
                ) : (
                  <User className="w-4 h-4 text-emerald-700" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  {currentUser.role === 'pengurus' ? 'Role: Pengurus' : `Reg: ${currentUser.username}`}
                </p>
              </div>
            </div>
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                currentUser.role === 'pengurus'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {currentUser.role === 'pengurus' ? 'Pengurus' : 'Anggota'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {onOpenChangePassword && (
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-200 transition cursor-pointer"
              title="Ganti Kata Sandi"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-700" />
              <span>Ganti Sandi</span>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[11px] font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition cursor-pointer"
              title="Keluar dari Sistem"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left Sidebar (Permanent) */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-slate-200 min-h-screen sticky top-0 h-screen z-30 bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
