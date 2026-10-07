import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Eye,
  Edit2,
  Calendar,
  X,
  Printer,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  Filter,
  Trash2,
  AlertTriangle,
  Building2,
  CreditCard,
} from 'lucide-react';
import { Member, SavingsTransaction, Loan, MemberStatus, UserRole, UNIT_KERJA_OPTIONS, AuthUser } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import {
  calculateMemberSavings,
  calculateLoanRemaining,
  getNextMemberId,
  calculateJoinDateFromSavings,
} from '../utils/storage';
import { printHtmlContent } from '../utils/printHelper';

interface AnggotaViewProps {
  members: Member[];
  savings: SavingsTransaction[];
  loans: Loan[];
  onAddMember: (newMember: Omit<Member, 'id'>, initialPokok: number) => void;
  onEditMember: (updatedMember: Member) => void;
  onDeleteMember?: (memberId: string) => void;
  onQuickDeposit: (memberId: string) => void;
  onQuickLoan: (memberId: string) => void;
  userRole?: UserRole;
  currentUser?: AuthUser | null;
  isLoading?: boolean;
  error?: string | null;
  isFromSupabase?: boolean;
  onRefresh?: () => void;
}

export const AnggotaView: React.FC<AnggotaViewProps> = ({
  members,
  savings,
  loans,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onQuickDeposit,
  onQuickLoan,
  userRole = 'pengurus',
  currentUser,
  isLoading = false,
  error = null,
  isFromSupabase = false,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | MemberStatus>('semua');
  const [unitKerjaFilter, setUnitKerjaFilter] = useState<string>('semua');
  const [yearFilter, setYearFilter] = useState<string>('semua');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [detailTab, setDetailTab] = useState<'ringkasan' | 'simpanan' | 'pinjaman' | 'kartu'>('ringkasan');

  // Auto-generate next registration ID
  const nextRegisterId = getNextMemberId(members);

  // Form State for Add Member (No Phone & No NIK)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    job: 'Dinas',
    notes: '',
    joinDate: new Date().toISOString().split('T')[0],
    initialPokok: 200000,
  });

  // Unique Join Years list for filter
  const availableYears = ['2023', '2024', '2025', '-'];

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.job.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'semua' || m.status === statusFilter;
    const matchesUnitKerja = unitKerjaFilter === 'semua' || m.job === unitKerjaFilter;

    // Join year matching
    const memberYearStr = String(m.joinYear ?? (m.status === 'pasif' ? '-' : '2023'));
    const matchesYear = yearFilter === 'semua' || memberYearStr === yearFilter;

    return matchesSearch && matchesStatus && matchesUnitKerja && matchesYear;
  });

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onAddMember(
      {
        name: formData.name.toUpperCase().trim(),
        nik: '',
        phone: '',
        address: formData.address || '-',
        job: formData.job || 'Dinas',
        joinDate: formData.joinDate,
        joinYear: new Date(formData.joinDate).getFullYear(),
        calculatedMonths: 0,
        initialTotalSavings: formData.initialPokok,
        status: 'aktif',
        notes: formData.notes,
      },
      formData.initialPokok
    );

    setIsAddModalOpen(false);
    setFormData({
      name: '',
      address: '',
      job: 'Dinas',
      notes: '',
      joinDate: new Date().toISOString().split('T')[0],
      initialPokok: 200000,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    onEditMember({
      ...editingMember,
      nik: '',
      phone: '',
    });
    setEditingMember(null);
  };

  const confirmDeleteMember = () => {
    if (memberToDelete && onDeleteMember) {
      onDeleteMember(memberToDelete.id);
      if (selectedMember?.id === memberToDelete.id) {
        setSelectedMember(null);
      }
      setMemberToDelete(null);
    }
  };

  // Helper for Year Badge styling
  const getYearBadgeClass = (year: number | string | undefined) => {
    const y = String(year);
    if (y === '2023') return 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
    if (y === '2024') return 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold';
    if (y === '2025') return 'bg-sky-100 text-sky-900 border-sky-300 font-bold';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // Helper for Status Badge styling
  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case 'aktif':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'pasif':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'keluar':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const handlePrintKta = (m: Member) => {
    const ktaHtml = `
      <div style="max-width: 520px; margin: 0 auto; border: 2px solid #1e3a8a; border-radius: 16px; padding: 24px; background: #0f172a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 18px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="/logo-bjs.png" style="height: 48px; width: auto; object-fit: contain; background: #ffffff; padding: 4px; border-radius: 8px;" />
            <div>
              <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff;">KOPERASI BRAMA JAYA SEJAHTERA</div>
              <div style="font-size: 10px; color: #93c5fd; font-weight: bold; margin-top: 2px;">BJS DIGITAL &bull; KARTU TANDA ANGGOTA (KTA)</div>
            </div>
          </div>
          <span style="background: #dc2626; color: #ffffff; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
            ${m.status}
          </span>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Nama Anggota:</div>
          <div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-top: 2px;">${m.name}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; font-size: 11px;">
          <div style="background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid #334155;">
            <div style="color: #94a3b8; font-size: 9px; text-transform: uppercase;">Nomor Registrasi:</div>
            <div style="font-family: monospace; font-size: 15px; font-weight: 900; color: #60a5fa; margin-top: 2px;">${m.id}</div>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid #334155;">
            <div style="color: #94a3b8; font-size: 9px; text-transform: uppercase;">Unit Kerja / Jabatan:</div>
            <div style="font-weight: 700; color: #f1f5f9; margin-top: 2px;">${m.job}</div>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid #334155;">
            <div style="color: #94a3b8; font-size: 9px; text-transform: uppercase;">Tahun Masuk:</div>
            <div style="font-weight: 700; color: #f1f5f9; margin-top: 2px;">${m.joinYear || '2023'}</div>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid #334155;">
            <div style="color: #94a3b8; font-size: 9px; text-transform: uppercase;">Masa Keanggotaan:</div>
            <div style="font-weight: 700; color: #34d399; margin-top: 2px;">${m.calculatedMonths || 35} Bulan</div>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #94a3b8;">
          <span>Badan Hukum: AHU-0018942.AH.01.26.TAHUN 2023</span>
          <span style="font-family: monospace; color: #93c5fd; font-weight: bold;">DOKUMEN RESMI BJS DIGITAL</span>
        </div>
      </div>
    `;
    printHtmlContent(ktaHtml, `KTA-${m.id}-${m.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
  };

  const isAnggota = userRole === 'anggota' || currentUser?.role === 'anggota';
  const myMemberId = (currentUser?.memberId || (isAnggota ? currentUser?.username : undefined) || 'BJS-001').trim();
  const myMember: Member = members.find((m) => m.id.toLowerCase() === myMemberId.toLowerCase()) || {
    id: myMemberId,
    name: currentUser?.name || 'Anggota Koperasi',
    nik: '-',
    phone: '-',
    job: currentUser?.unitKerja || 'Dinas',
    address: 'Kabupaten Cirebon',
    status: 'aktif',
    joinDate: '2023-01-01',
    joinYear: 2023,
    calculatedMonths: 35,
    initialTotalSavings: 0,
  };

  // IF USER IS ANGGOTA: RENDER ONLY PERSONAL MEMBER PROFILE & CARD (HIDE OTHER 216 MEMBERS)
  if (isAnggota) {
    const sav = calculateMemberSavings(myMember.id, savings);
    const memLoans = loans.filter((l) => l.memberId === myMember.id);
    const activeLoans = memLoans.filter((l) => l.status === 'aktif');
    const totalRemainingDebt = activeLoans.reduce(
      (acc, curr) => acc + calculateLoanRemaining(curr).remainingPrincipal,
      0
    );

    return (
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 p-6 text-white shadow-lg border border-blue-800/40 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-md shrink-0">
                <img src="/logo-bjs.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                  PROFIL ANGGOTA RESMI
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                  {myMember.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-blue-200 mt-1">
                  <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                    {myMember.id}
                  </span>
                  <span>&bull;</span>
                  <span>{myMember.job}</span>
                  <span>&bull;</span>
                  <span className="text-emerald-300 font-bold uppercase">Status: {myMember.status}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDetailTab('kartu')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-blue-50 transition cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-red-600" />
                <span>Kartu Anggota Digital</span>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-4 text-xs font-bold">
            <button
              onClick={() => setDetailTab('ringkasan')}
              className={`py-3.5 border-b-2 transition cursor-pointer ${
                detailTab === 'ringkasan'
                  ? 'border-blue-900 text-blue-900 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Ringkasan Rekening & Hak Anggota
            </button>
            <button
              onClick={() => setDetailTab('simpanan')}
              className={`py-3.5 border-b-2 transition cursor-pointer ${
                detailTab === 'simpanan'
                  ? 'border-blue-900 text-blue-900 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Riwayat Mutasi Simpanan Saya
            </button>
            <button
              onClick={() => setDetailTab('pinjaman')}
              className={`py-3.5 border-b-2 transition cursor-pointer ${
                detailTab === 'pinjaman'
                  ? 'border-blue-900 text-blue-900 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Pinjaman & Angsuran Saya
            </button>
            <button
              onClick={() => setDetailTab('kartu')}
              className={`py-3.5 border-b-2 transition cursor-pointer ${
                detailTab === 'kartu'
                  ? 'border-red-700 text-red-900 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Kartu Tanda Anggota (KTA)
            </button>
          </div>

          <div className="p-6 space-y-6">
            {detailTab === 'ringkasan' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-[11px] font-bold uppercase text-blue-800">Simpanan Pokok</span>
                    <p className="text-xl font-black font-mono text-blue-950 mt-1">{formatRupiah(sav.pokok)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Modal permanen anggota</p>
                  </div>
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                    <span className="text-[11px] font-bold uppercase text-indigo-800">Simpanan Wajib</span>
                    <p className="text-xl font-black font-mono text-indigo-950 mt-1">{formatRupiah(sav.wajib)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{myMember.calculatedMonths || 35} bulan @Rp 50.000</p>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[11px] font-bold uppercase text-rose-800">Simpanan Berjangka 6%</span>
                    <p className="text-xl font-black font-mono text-rose-950 mt-1">{formatRupiah(sav.berjangka)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Investasi modal 1 tahun</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Informasi Data Keanggotaan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Nomor Registrasi:</span>
                      <span className="font-mono font-bold text-slate-900">{myMember.id}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Nama Lengkap:</span>
                      <span className="font-bold text-slate-900">{myMember.name}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Unit Kerja / Instansi:</span>
                      <span className="font-semibold text-slate-900">{myMember.job}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Tanggal Bergabung:</span>
                      <span className="font-semibold text-slate-900">{myMember.joinDate || 'Februari 2023'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Total Simpanan Keseluruhan:</span>
                      <span className="font-mono font-black text-emerald-700">{formatRupiah(sav.total)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Tanggungan Pinjaman Aktif:</span>
                      <span className="font-mono font-bold text-red-700">{formatRupiah(totalRemainingDebt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'simpanan' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tanggal & Ref</th>
                        <th className="py-2.5 px-3">Jenis Simpanan</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savings
                        .filter((s) => s.memberId === myMember.id)
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-slate-900">{formatDateIndo(s.date)}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">{s.id}</span>
                            </td>
                            <td className="py-2.5 px-3 capitalize font-semibold text-slate-800">
                              Simpanan {s.type === 'berjangka' ? 'Berjangka 6%' : s.type}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              +{formatRupiah(s.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">{s.notes || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailTab === 'pinjaman' && (
              <div className="space-y-4">
                {memLoans.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Anda tidak memiliki riwayat pengajuan pinjaman aktif.
                  </div>
                ) : (
                  memLoans.map((l) => (
                    <div key={l.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-slate-900">{l.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          {l.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block">Plafon:</span>
                          <span className="font-mono font-bold">{formatRupiah(l.amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Sisa Pokok:</span>
                          <span className="font-mono font-bold text-red-700">
                            {formatRupiah(calculateLoanRemaining(l).remainingPrincipal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Angsuran / Bln:</span>
                          <span className="font-mono font-bold">{formatRupiah(l.monthlyTotal)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Tenor:</span>
                          <span className="font-bold">{l.tenorMonths} Bulan</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'kartu' && (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-blue-950 via-slate-900 to-red-950 p-6 text-white shadow-2xl border-2 border-red-500/30 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-white/20">
                    <div className="flex items-center gap-2">
                      <img src="/logo-bjs.png" alt="Logo" className="h-8 w-auto object-contain bg-white rounded p-0.5" />
                      <div>
                        <h4 className="text-xs font-black tracking-wider uppercase">KSP BRAMA JAYA SEJAHTERA</h4>
                        <p className="text-[9px] text-blue-200">KARTU TANDA ANGGOTA (KTA DIGITAL)</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                      {myMember.status}
                    </span>
                  </div>

                  <div className="my-5 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center font-black text-2xl text-white border border-white/30 shadow-md shrink-0">
                      {myMember.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-white leading-tight">{myMember.name}</h3>
                      <p className="font-mono font-bold text-xs text-amber-300 mt-0.5">{myMember.id}</p>
                      <p className="text-[11px] text-blue-200 mt-1 line-clamp-1">{myMember.job}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/20 flex justify-between items-center text-[10px] text-slate-300">
                    <div>
                      <span>Tahun Bergabung: </span>
                      <strong className="text-white">{myMember.joinYear || '2023'}</strong>
                    </div>
                    <span className="font-mono text-[9px] text-slate-400">SAK ETAP &bull; AHU-0018942</span>
                  </div>
                </div>

                <button
                  onClick={() => handlePrintKta(myMember)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Unduh Kartu Tanda Anggota (PDF)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Blue & Maroon Gradient */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 p-6 text-white shadow-lg border border-blue-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-red-600/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                Buku Induk
              </span>
              <span className="text-xs text-blue-200 font-semibold">
                KSP Brama Jaya Sejahtera (BJS Digital)
              </span>
              {isFromSupabase ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Supabase PostgreSQL ({members.length})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Cadangan Lokal ({members.length})
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Direktori 217 Anggota Koperasi
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl mt-1 leading-relaxed">
              Dihitung berdasarkan simpanan pokok Rp 200.000 & simpanan wajib Rp 50.000/bulan sampai dengan posisi Desember 2025. Dilengkapi sistem auto-generate nomor register pendaftaran anggota baru.
            </p>
          </div>

          {userRole === 'pengurus' ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-rose-900 hover:from-red-600 hover:to-rose-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer border border-red-500/40 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Anggota Baru</span>
            </button>
          ) : (
            <div className="px-3.5 py-2 bg-white/10 rounded-xl border border-white/20 text-xs text-blue-100 font-medium">
              Mode Anggota (Hanya Lihat)
            </div>
          )}
        </div>

        {/* Quick Stats Pills */}
        <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-blue-200 text-[10px] block">Total Terdaftar</span>
            <span className="text-base font-black text-white">{members.length} Anggota</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-emerald-200 text-[10px] block">Anggota Aktif</span>
            <span className="text-base font-black text-emerald-300">
              {members.filter((m) => m.status === 'aktif').length} Orang
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-amber-200 text-[10px] block">Anggota Pasif / Keluar</span>
            <span className="text-base font-black text-amber-300">
              {members.filter((m) => m.status === 'pasif' || m.status === 'keluar').length} Orang
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-rose-200 text-[10px] block">Auto-Gen ID Berikutnya</span>
            <span className="text-base font-mono font-black text-rose-300">{nextRegisterId}</span>
          </div>
        </div>
      </div>

      {/* Notifikasi Status Data & Loading */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-[11px] font-bold bg-amber-200 hover:bg-amber-300 rounded-lg text-amber-950 transition cursor-pointer"
            >
              Muat Ulang
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5 shadow-2xs animate-pulse">
          <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Mengambil data anggota dari tabel Supabase PostgreSQL...</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama anggota, No. Register (BJS-xxx), atau Unit Kerja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Unit Kerja */}
          <div className="flex items-center gap-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={unitKerjaFilter}
              onChange={(e) => setUnitKerjaFilter(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20 cursor-pointer font-medium"
            >
              <option value="semua">Semua Unit Kerja</option>
              {UNIT_KERJA_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20 cursor-pointer font-medium"
            >
              <option value="semua">Semua Status</option>
              <option value="aktif">Status: Aktif</option>
              <option value="pasif">Status: Pasif</option>
              <option value="keluar">Status: Keluar</option>
            </select>
          </div>

          {/* Filter Tahun Bergabung (Hasil Perhitungan) */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-lg border border-blue-200 bg-blue-50/50 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900/20 cursor-pointer font-semibold"
          >
            <option value="semua">Semua Tahun Bergabung</option>
            <option value="2023">Tahun 2023 (Anggota Pendiri)</option>
            <option value="2024">Tahun 2024</option>
            <option value="2025">Tahun 2025</option>
            <option value="-">Pasif / Belum Ada Simpanan (-)</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-50 via-blue-50/40 to-red-50/20 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3.5">No. Register</th>
                <th className="px-4 py-3.5">Nama Anggota</th>
                <th className="px-4 py-3.5">Unit Kerja</th>
                <th className="px-4 py-3.5 text-center">Tahun Bergabung</th>
                <th className="px-4 py-3.5 text-right">Total Simpanan (s/d Des 2025)</th>
                <th className="px-4 py-3.5 text-right">Sisa Pinjaman</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                    Tidak ditemukan data anggota yang cocok dengan kata kunci atau filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const sav = calculateMemberSavings(member.id, savings);
                  const activeLoanList = loans.filter((l) => l.memberId === member.id && l.status === 'aktif');
                  const remainingDebt = activeLoanList.reduce(
                    (acc, curr) => acc + calculateLoanRemaining(curr).remainingPrincipal,
                    0
                  );

                  const displayYear = member.joinYear ?? (member.status === 'pasif' ? '-' : '2023');
                  const monthsActive = member.calculatedMonths ?? (displayYear === '2023' ? 35 : 0);

                  return (
                    <tr key={member.id} className="hover:bg-blue-50/30 transition">
                      {/* Register */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-black text-xs text-blue-950 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md inline-block shadow-2xs">
                          {member.id}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 hover:text-blue-900 transition">
                          {member.name}
                        </div>
                      </td>

                      {/* Unit Kerja */}
                      <td className="px-4 py-3.5 text-xs">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                          {member.job}
                        </span>
                      </td>

                      {/* Calculated Join Year */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${getYearBadgeClass(
                            displayYear
                          )}`}
                          title={`Dihitung: Pokok Rp 200rb + ${monthsActive} bulan Wajib @Rp 50rb s/d Des 2025`}
                        >
                          {displayYear}
                        </span>
                        {displayYear !== '-' && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            {monthsActive} bln wajib
                          </div>
                        )}
                      </td>

                      {/* Total Savings */}
                      <td className="px-4 py-3.5 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                        <div>{formatRupiah(sav.total)}</div>
                        <div className="text-[10px] text-blue-700 font-sans font-medium">
                          {sav.berjangka > 0 ? (
                            <span className="text-red-700 font-bold">Termasuk Berjangka 6%</span>
                          ) : (
                            <span>Pokok + Wajib</span>
                          )}
                        </div>
                      </td>

                      {/* Loan Remaining */}
                      <td className="px-4 py-3.5 text-right font-mono whitespace-nowrap">
                        {remainingDebt > 0 ? (
                          <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs">
                            {formatRupiah(remainingDebt)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-sans">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${getStatusBadge(
                            member.status
                          )}`}
                        >
                          {member.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setDetailTab('ringkasan');
                            }}
                            title="Detail & Buku Anggota"
                            className="p-1.5 rounded-lg text-blue-900 hover:bg-blue-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {userRole === 'pengurus' && (
                            <>
                              <button
                                onClick={() => setEditingMember(member)}
                                title="Edit Biodata"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-blue-900 hover:bg-blue-50 transition cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {onDeleteMember && (
                                <button
                                  onClick={() => setMemberToDelete(member)}
                                  title="Hapus Anggota"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DETAIL & BUKU ANGGOTA */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            {/* Header with Blue & Maroon Gradient */}
            <div className="flex items-center justify-between border-b border-blue-800 bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-md">
                  <img
                    src="/logo-bjs.png"
                    alt="Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">{selectedMember.name}</h3>
                    <span className="font-mono text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded shadow-xs">
                      {selectedMember.id}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200">
                    Unit Kerja: {selectedMember.job}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-4 text-xs font-bold">
              <button
                onClick={() => setDetailTab('ringkasan')}
                className={`py-3 border-b-2 transition cursor-pointer ${
                  detailTab === 'ringkasan'
                    ? 'border-blue-900 text-blue-900 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Ringkasan Rekening
              </button>
              <button
                onClick={() => setDetailTab('simpanan')}
                className={`py-3 border-b-2 transition cursor-pointer ${
                  detailTab === 'simpanan'
                    ? 'border-blue-900 text-blue-900 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Mutasi Simpanan
              </button>
              <button
                onClick={() => setDetailTab('pinjaman')}
                className={`py-3 border-b-2 transition cursor-pointer ${
                  detailTab === 'pinjaman'
                    ? 'border-blue-900 text-blue-900 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Kredit & Pinjaman
              </button>
              <button
                onClick={() => setDetailTab('kartu')}
                className={`py-3 border-b-2 transition cursor-pointer ${
                  detailTab === 'kartu'
                    ? 'border-red-700 text-red-900 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Kartu Anggota Digital BJS
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
              {detailTab === 'ringkasan' && (
                <div className="space-y-6">
                  {/* Calculation Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-red-50/30 border border-blue-200 text-xs">
                    <h4 className="font-bold text-blue-950 flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-red-700" />
                      Status Kalkulasi Tahun Bergabung & Akumulasi Simpanan s/d Desember 2025
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-500 block">Tahun Bergabung</span>
                        <span className="font-extrabold text-blue-950 text-sm">
                          {selectedMember.joinYear ?? (selectedMember.status === 'pasif' ? '-' : '2023')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Akumulasi Simpanan Wajib</span>
                        <span className="font-bold text-slate-800">
                          {selectedMember.calculatedMonths ?? 0} Bulan (@Rp 50.000)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Status Keanggotaan</span>
                        <span className="font-bold uppercase text-red-900">{selectedMember.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Balance Summary */}
                  {(() => {
                    const sav = calculateMemberSavings(selectedMember.id, savings);
                    const memLoans = loans.filter((l) => l.memberId === selectedMember.id);
                    const activeLoans = memLoans.filter((l) => l.status === 'aktif');
                    const totalRemainingDebt = activeLoans.reduce(
                      (acc, curr) => acc + calculateLoanRemaining(curr).remainingPrincipal,
                      0
                    );

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                            Total Saldo Simpanan
                          </span>
                          <span className="text-2xl font-black font-mono text-blue-950 mt-1 block">
                            {formatRupiah(sav.total)}
                          </span>
                          <div className="mt-3 pt-3 border-t border-blue-200/80 space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between">
                              <span>Simpanan Pokok:</span>
                              <span className="font-semibold text-slate-900">{formatRupiah(sav.pokok)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Simpanan Wajib:</span>
                              <span className="font-semibold text-slate-900">{formatRupiah(sav.wajib)}</span>
                            </div>
                            {sav.berjangka > 0 && (
                              <div className="flex justify-between text-red-900 font-bold">
                                <span>Simpanan Berjangka 6%:</span>
                                <span>{formatRupiah(sav.berjangka)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
                          <span className="text-xs font-bold text-red-900 uppercase tracking-wider block">
                            Sisa Kewajiban Pinjaman
                          </span>
                          <span className="text-2xl font-black font-mono text-red-950 mt-1 block">
                            {formatRupiah(totalRemainingDebt)}
                          </span>
                          <div className="mt-3 pt-3 border-t border-red-200/80 space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between">
                              <span>Pinjaman Aktif:</span>
                              <span className="font-semibold text-slate-900">{activeLoans.length} fasilitas</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Pengajuan:</span>
                              <span className="font-semibold text-slate-900">{memLoans.length} kali</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {detailTab === 'simpanan' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm">Buku Mutasi Simpanan</h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="px-3 py-2.5">Tanggal</th>
                          <th className="px-3 py-2.5">Jenis Simpanan</th>
                          <th className="px-3 py-2.5">Mutasi</th>
                          <th className="px-3 py-2.5 text-right">Nominal</th>
                          <th className="px-3 py-2.5">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {savings
                          .filter((s) => s.memberId === selectedMember.id)
                          .map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-600">{formatDateIndo(tx.date)}</td>
                              <td className="px-3 py-2 font-bold uppercase text-slate-800">
                                {tx.type === 'berjangka' ? (
                                  <span className="text-red-700 font-black">Berjangka 6%</span>
                                ) : (
                                  tx.type
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    tx.txType === 'setor'
                                      ? 'bg-blue-100 text-blue-900'
                                      : 'bg-red-100 text-red-900'
                                  }`}
                                >
                                  {tx.txType.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-black text-slate-900">
                                {formatRupiah(tx.amount)}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{tx.notes || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab === 'pinjaman' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm">Fasilitas Pinjaman</h4>
                  {loans.filter((l) => l.memberId === selectedMember.id).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      Anggota belum memiliki riwayat pinjaman di koperasi.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {loans
                        .filter((l) => l.memberId === selectedMember.id)
                        .map((loan) => {
                          const { paidCount, remainingPrincipal } = calculateLoanRemaining(loan);
                          return (
                            <div
                              key={loan.id}
                              className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-mono font-black text-blue-950">{loan.id}</span>
                                  <h5 className="font-bold text-slate-900 text-sm mt-0.5">
                                    Plafon {formatRupiah(loan.amount)}
                                  </h5>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-blue-100 text-blue-900">
                                  {loan.status}
                                </span>
                              </div>
                              <p className="text-slate-600">{loan.purpose}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                                <div>
                                  <span className="text-slate-400 block">Bunga</span>
                                  <span className="font-bold text-slate-800">
                                    {loan.interestRatePerMonth}% / bln flat
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Cicilan</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {formatRupiah(loan.monthlyTotal)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Terbayar</span>
                                  <span className="font-bold text-blue-900">
                                    {paidCount}/{loan.tenorMonths} bulan
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Sisa Pokok</span>
                                  <span className="font-bold text-red-700 font-mono">
                                    {formatRupiah(remainingPrincipal)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'kartu' && (
                <div className="flex flex-col items-center justify-center p-2">
                  {/* Digital Koperasi Member Card with Blue & Maroon Gradient */}
                  <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-red-950 p-6 text-white shadow-2xl relative overflow-hidden border-2 border-blue-400/30">
                    <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-red-600/15 rounded-full blur-xl pointer-events-none"></div>

                    <div className="flex justify-between items-start border-b border-white/20 pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 p-1 bg-white rounded-xl shadow-md shrink-0 flex items-center justify-center border border-white/80">
                          <img
                            src="/logo-bjs.png"
                            alt="Logo BJS"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-300 block">
                            KARTU ANGGOTA DIGITAL
                          </span>
                          <h4 className="text-xs font-black text-white tracking-tight">
                            KOPERASI BRAMA JAYA SEJAHTERA
                          </h4>
                          <p className="text-[9px] text-blue-200">Badan Hukum AHU-0018942.AH.01.26</p>
                        </div>
                      </div>
                      <div className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-mono font-black tracking-wider shadow-xs">
                        {selectedMember.status.toUpperCase()}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-blue-200 uppercase tracking-wider">Nama Anggota</p>
                        <h3 className="text-base font-black text-white tracking-tight">
                          {selectedMember.name}
                        </h3>
                        <p className="text-xs text-blue-100 mt-0.5">{selectedMember.job}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center font-mono font-black text-xl border border-white/30 text-white">
                        {selectedMember.name.charAt(0)}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 text-xs pt-3 border-t border-white/20">
                      <div>
                        <span className="text-[10px] text-blue-200 block">Nomor Register BJS</span>
                        <span className="font-mono font-black text-sm tracking-wider text-red-300">
                          {selectedMember.id}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-200 block">Tahun Bergabung</span>
                        <span className="font-bold text-white">
                          {selectedMember.joinYear ?? '2023'} (Posisi Des 2025)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePrintKta(selectedMember)}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-900 to-red-900 hover:from-blue-950 hover:to-red-950 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak / Unduh Kartu Anggota (PDF)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH ANGGOTA BARU (AUTO-GENERATE REGISTER NUMBER) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-blue-900 bg-gradient-to-r from-blue-950 via-blue-900 to-red-950 px-6 py-4 text-white">
              <h3 className="text-base font-black flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-400" />
                Pendaftaran Anggota Baru BJS Digital
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              {/* Auto-Generated Register ID Announcement */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-950 to-red-950 text-white flex items-center justify-between shadow-md border border-blue-400/30">
                <div>
                  <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider block">
                    Nomor Register Anggota (Auto-Generate)
                  </span>
                  <div className="font-mono text-lg font-black text-white flex items-center gap-2 mt-0.5">
                    {nextRegisterId}
                    <span className="text-[10px] bg-red-600 text-white font-sans font-extrabold px-2 py-0.5 rounded-full uppercase">
                      Auto Sesuai Urutan
                    </span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-blue-200/90 font-medium">
                  KSP Brama Jaya Sejahtera
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nama Lengkap Sesuai KTP <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: AGUS SURYANA, SE"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-semibold uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Unit Kerja <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={formData.job}
                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  >
                    {UNIT_KERJA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Tanggal Pendaftaran</label>
                  <input
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Alamat Domisili</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap tempat tinggal"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                ></textarea>
              </div>

              {/* Setoran Pokok Awal (ART Pasal 4 Ayat 2a) */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-red-50/50 border border-blue-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-black text-blue-950">
                    Setoran Simpanan Pokok Awal (Rp)
                  </label>
                  <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                    ART Pasal 4 Ayat 2a
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-blue-900">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={formData.initialPokok}
                    onChange={(e) => setFormData({ ...formData, initialPokok: Number(e.target.value) })}
                    className="w-full pl-10 pr-3 py-2 text-xs font-mono font-black text-blue-950 rounded-lg border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/30"
                  />
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">
                  Ketentuan ART Koperasi: Simpanan Pokok sebesar <strong>Rp 200.000</strong> (dibayarkan saat menjadi anggota dan dapat diangsur maks 4 kali). Selanjutnya Simpanan Wajib sebesar <strong>Rp 50.000 / bulan</strong>.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-blue-900 to-red-900 hover:from-blue-950 hover:to-red-950 rounded-xl shadow-md transition cursor-pointer border border-blue-700"
                >
                  Simpan Anggota Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DATA ANGGOTA */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-900" />
                Edit Biodata Anggota ({editingMember.id})
              </h3>
              <button
                onClick={() => setEditingMember(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Kerja</label>
                  <select
                    value={editingMember.job}
                    onChange={(e) => setEditingMember({ ...editingMember, job: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 font-semibold"
                  >
                    {UNIT_KERJA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status Keanggotaan</label>
                  <select
                    value={editingMember.status}
                    onChange={(e) => setEditingMember({ ...editingMember, status: e.target.value as MemberStatus })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 font-bold capitalize"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                    <option value="keluar">Keluar</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={editingMember.address}
                  onChange={(e) => setEditingMember({ ...editingMember, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 rounded-lg shadow-xs transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WARNING DIALOG: KONFIRMASI HAPUS ANGGOTA */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-3 bg-rose-100 rounded-full shrink-0">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus Anggota</h3>
                  <p className="text-xs text-rose-600 font-semibold">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                Apakah Anda yakin ingin menghapus data anggota{' '}
                <strong className="text-slate-900">{memberToDelete.name}</strong> (
                <span className="font-mono font-bold text-blue-900">{memberToDelete.id}</span>)?
              </p>

              <div className="mt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>Unit Kerja: <span className="font-semibold text-slate-900">{memberToDelete.job}</span></div>
                <div>Status: <span className="font-semibold capitalize text-slate-900">{memberToDelete.status}</span></div>
              </div>

              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed font-medium">
                ⚠️ <strong>Peringatan Sistem:</strong> Menghapus anggota ini juga akan menghapus seluruh catatan simpanan (pokok & wajib) serta riwayat pinjaman anggota yang bersangkutan dari pembukuan koperasi.
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteMember}
                  className="px-4 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer"
                >
                  Ya, Hapus Data Anggota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
