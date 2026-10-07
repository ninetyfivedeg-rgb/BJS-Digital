import { supabase } from '../lib/supabase';
import { Loan, LoanRepayment, LoanStatus, LoanScheduleItem, Member, AuthUser } from '../types';
import { loadLoans as loadLocalFallbackLoans, loadRepayments as loadLocalFallbackRepayments } from '../utils/storage';
import { formatRupiah } from '../utils/formatters';

export interface CreateLoanInput {
  memberId: string;
  memberName?: string;
  amount: number;
  tenorMonths: number;
  interestRatePerMonth?: number; // 1.1% flat per bulan sesuai ART
  adminFee?: number; // 1.0% plafon
  startDate: string; // YYYY-MM-DD
  status?: LoanStatus;
  purpose?: string;
  approvedDate?: string;
  disbursedDate?: string;
  notes?: string;
}

export interface CreateLoanActionResult {
  success: boolean;
  message: string;
  data?: Loan;
  error?: string;
}

export interface CreateLoanRepaymentInput {
  loanId: string;
  installmentNo: number;
  penalty?: number;
  paidDate?: string;
  notes?: string;
  adminName?: string;
}

export interface CreateLoanRepaymentActionResult {
  success: boolean;
  message: string;
  data?: LoanRepayment;
  error?: string;
}

export interface UpdateLoanScheduleInput {
  loanId: string;
  installmentNo: number;
  isPaid: boolean;
  paidDate?: string;
  notes?: string;
}

/**
 * Memetakan baris dari tabel `loan_repayments` Supabase (snake_case)
 * ke interface `LoanRepayment` aplikasi (camelCase).
 *
 * Kolom tabel Supabase `loan_repayments`:
 * - id: string
 * - loan_id: string
 * - member_id: string
 * - member_name: string
 * - installment_no: number
 * - principal_amount: number
 * - interest_amount: number
 * - penalty_amount: number (atau penalty)
 * - total_paid: number
 * - transaction_date: string
 * - admin_name: string
 * - notes: string
 * - created_at: string
 */
export function mapSupabaseRepaymentToRepayment(
  row: any,
  index: number = 0,
  members?: Member[]
): LoanRepayment {
  const principalAmount = Number(row.principal_amount) || 0;
  const interestAmount = Number(row.interest_amount) || 0;
  const penaltyAmount = Number(row.penalty_amount ?? row.penalty) || 0;
  const totalPaid = Number(row.total_paid) || (principalAmount + interestAmount + penaltyAmount);
  const memberName =
    row.member_name ||
    members?.find((m) => m.id === row.member_id)?.name ||
    'Anggota BJS';

  return {
    id: row.id,
    loanId: row.loan_id || '',
    memberId: row.member_id || '',
    memberName,
    installmentNo: Number(row.installment_no ?? row.installment_number) || index + 1,
    principalAmount,
    interestAmount,
    penaltyAmount,
    totalPaid,
    date: row.transaction_date || row.created_at || new Date().toISOString(),
    adminName: row.admin_name || 'Admin Bendahara BJS',
    notes: row.notes || undefined,
  };
}

/**
 * Memetakan baris dari tabel `loans` Supabase (snake_case)
 * ke interface `Loan` aplikasi (camelCase) beserta jadwal angsurannya (schedules).
 *
 * Kolom tabel Supabase `loans`:
 * - id: string ("PJM-...")
 * - member_id: string ("BJS-...")
 * - member_name: string
 * - amount: number
 * - tenor_months: number
 * - start_date: string (YYYY-MM-DD)
 * - monthly_principal: number
 * - monthly_interest: number
 * - admin_fee: number
 * - status: string ("aktif", "diajukan", "review", "disetujui", "dicairkan", "lunas", "ditolak")
 * - purpose: string
 * - notes: string
 * - created_at: string
 * - updated_at: string
 */
export function mapSupabaseLoanToLoan(
  row: any,
  repayments: LoanRepayment[] = [],
  members?: Member[],
  schedulesFromDb?: any[]
): Loan {
  const amount = Number(row.amount) || 0;
  const tenorMonths = Number(row.tenor_months) || 12;
  const fixedRate = 1.1; // Suku bunga flat 1.1% per bulan sesuai ART
  const monthlyPrincipal =
    Number(row.monthly_principal) || Math.round(amount / tenorMonths);
  const monthlyInterest =
    Number(row.monthly_interest) || Math.round(amount * (fixedRate / 100));
  const monthlyTotal = monthlyPrincipal + monthlyInterest;
  const totalLoanAmount = monthlyTotal * tenorMonths;
  const adminFee = Number(row.admin_fee) || Math.round(amount * 0.01);
  const startDate =
    row.start_date ||
    row.created_at?.split('T')[0] ||
    new Date().toISOString().split('T')[0];

  const loanRepayments = repayments.filter((r) => r.loanId === row.id);

  // Periksa apakah jadwal sudah ada di tabel `loan_schedules`
  const dbSchedulesForLoan = (schedulesFromDb || []).filter((s) => s.loan_id === row.id);

  let schedules: LoanScheduleItem[] = [];

  if (dbSchedulesForLoan.length > 0) {
    schedules = dbSchedulesForLoan
      .sort((a, b) => (Number(a.installment_no) || 0) - (Number(b.installment_no) || 0))
      .map((s) => {
        const month = Number(s.installment_no) || 1;
        const rep = loanRepayments.find((r) => r.installmentNo === month);
        const isPaid = Boolean(s.is_paid || rep);
        return {
          month,
          dueDate: s.due_date || startDate,
          principal: Number(s.principal) || monthlyPrincipal,
          interest: Number(s.interest) || monthlyInterest,
          totalInstallment: Number(s.total_installment) || monthlyTotal,
          isPaid,
          paidDate: s.paid_date || rep?.date,
          receiptId: s.receipt_id || rep?.id,
          notes: s.notes || rep?.notes,
        };
      });
  } else {
    // Generate monthly schedules secara dinamis jika belum ada di tabel loan_schedules
    const startDateObj = new Date(startDate);
    for (let m = 1; m <= tenorMonths; m++) {
      const due = new Date(startDateObj);
      due.setMonth(due.getMonth() + m);
      const dueStr = isNaN(due.getTime()) ? startDate : due.toISOString().split('T')[0];
      const rep = loanRepayments.find((r) => r.installmentNo === m);

      schedules.push({
        month: m,
        dueDate: dueStr,
        principal: monthlyPrincipal,
        interest: monthlyInterest,
        totalInstallment: monthlyTotal,
        isPaid: Boolean(rep),
        paidDate: rep?.date,
        receiptId: rep?.id,
        notes: rep?.notes,
      });
    }
  }

  const memberName =
    row.member_name ||
    members?.find((mem) => mem.id === row.member_id)?.name ||
    'Anggota BJS';

  // Periksa apakah seluruh jadwal sudah lunas
  const isAllPaid = schedules.length > 0 && schedules.every((s) => s.isPaid);
  const rawStatus = (row.status as LoanStatus) || 'aktif';
  const effectiveStatus = isAllPaid ? 'lunas' : rawStatus;

  return {
    id: row.id,
    memberId: row.member_id || '',
    memberName,
    amount,
    tenorMonths,
    interestRatePerMonth: fixedRate,
    adminFee,
    monthlyPrincipal,
    monthlyInterest,
    monthlyTotal,
    totalLoanAmount,
    startDate,
    status: effectiveStatus,
    purpose: row.purpose || 'Keperluan Anggota',
    schedules,
    approvedDate: row.approved_date || undefined,
    disbursedDate: row.disbursed_date || undefined,
    notes: row.notes || undefined,
  };
}

export interface FetchLoansResponse {
  loans: Loan[];
  repayments: LoanRepayment[];
  error: string | null;
  fromSupabase: boolean;
  totalLoansCount: number;
}

/**
 * Mengambil data pinjaman, angsuran, dan jadwal dari tabel Supabase `loans`, `loan_repayments`, dan `loan_schedules`.
 *
 * Catatan Fallback:
 * Jika terjadi kegagalan jaringan atau query Supabase, data lokal/dummy
 * dari `loadLoans()` dan `loadRepayments()` digunakan sebagai cadangan sementara (fallback).
 */
export async function fetchLoansFromSupabase(members?: Member[]): Promise<FetchLoansResponse> {
  try {
    const [loansRes, repaymentsRes, schedulesRes] = await Promise.all([
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('loan_repayments').select('*').order('created_at', { ascending: false }),
      supabase.from('loan_schedules').select('*').order('installment_no', { ascending: true }),
    ]);

    if (loansRes.error) {
      console.warn('Gagal memuat pinjaman dari Supabase:', loansRes.error.message);
      const fallbackLoans = loadLocalFallbackLoans();
      const fallbackRepayments = loadLocalFallbackRepayments();
      return {
        loans: fallbackLoans,
        repayments: fallbackRepayments,
        error: 'Gagal mengambil data pinjaman dari server. Menampilkan data cadangan lokal.',
        fromSupabase: false,
        totalLoansCount: fallbackLoans.length,
      };
    }

    const mappedRepayments = (repaymentsRes.data || []).map((row, idx) =>
      mapSupabaseRepaymentToRepayment(row, idx, members)
    );

    const rawSchedules = schedulesRes.data || [];

    const mappedLoans = (loansRes.data || []).map((row) =>
      mapSupabaseLoanToLoan(row, mappedRepayments, members, rawSchedules)
    );

    return {
      loans: mappedLoans,
      repayments: mappedRepayments,
      error: null,
      fromSupabase: true,
      totalLoansCount: mappedLoans.length,
    };
  } catch (err: any) {
    console.error('Terjadi pengecualian saat memuat data pinjaman dari Supabase:', err);
    const fallbackLoans = loadLocalFallbackLoans();
    const fallbackRepayments = loadLocalFallbackRepayments();
    return {
      loans: fallbackLoans,
      repayments: fallbackRepayments,
      error: 'Terjadi kendala jaringan saat memuat data pinjaman. Menampilkan data cadangan lokal.',
      fromSupabase: false,
      totalLoansCount: fallbackLoans.length,
    };
  }
}

/**
 * Mencatat pinjaman baru ke tabel Supabase `loans`, membuat jadwal di `loan_schedules`,
 * serta mencatat mutasi kas pencairan pinjaman ke `cash_flow_records`.
 */
export async function createLoan(
  input: CreateLoanInput,
  currentUser?: AuthUser | null,
  validMembers?: Member[]
): Promise<CreateLoanActionResult> {
  // 1. Role Guard
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus/Bendahara yang memiliki wewenang untuk mencatat pinjaman baru.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  // 2. Validasi ID Anggota
  const cleanMemberId = input.memberId?.trim();
  if (!cleanMemberId) {
    return {
      success: false,
      message: 'ID Anggota wajib dipilih dan tidak boleh kosong.',
      error: 'INVALID_MEMBER_ID',
    };
  }

  let cleanMemberName = input.memberName?.trim();
  if (validMembers && validMembers.length > 0) {
    const foundMember = validMembers.find(
      (m) => m.id.toLowerCase() === cleanMemberId.toLowerCase()
    );
    if (!foundMember) {
      return {
        success: false,
        message: `Anggota dengan ID "${cleanMemberId}" tidak terdaftar dalam database koperasi.`,
        error: 'MEMBER_NOT_FOUND',
      };
    }
    if (!cleanMemberName) cleanMemberName = foundMember.name;
  }
  if (!cleanMemberName) cleanMemberName = 'Anggota BJS';

  // 3. Validasi Nominal Pinjaman (Plafon > 0)
  const amount = Number(input.amount);
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Nominal pinjaman (plafon) harus berupa angka valid dan lebih besar dari 0.',
      error: 'INVALID_AMOUNT',
    };
  }

  // 4. Validasi Tenor
  const tenorMonths = Math.round(Number(input.tenorMonths));
  if (isNaN(tenorMonths) || tenorMonths <= 0 || tenorMonths > 60) {
    return {
      success: false,
      message: 'Tenor pinjaman harus berupa angka bulat antara 1 hingga 60 bulan.',
      error: 'INVALID_TENOR',
    };
  }

  // 5. Validasi Tanggal
  const cleanDate = (input.startDate || '').trim() || new Date().toISOString().split('T')[0];
  if (isNaN(new Date(cleanDate).getTime())) {
    return {
      success: false,
      message: 'Tanggal pencairan pinjaman tidak valid.',
      error: 'INVALID_DATE',
    };
  }

  // 6. Hitung Skema Keuangan Pinjaman Koperasi
  const fixedRate = 1.1; // Flat 1.1% per bulan sesuai ART BJS
  const monthlyPrincipal = Math.round(amount / tenorMonths);
  const monthlyInterest = Math.round(amount * (fixedRate / 100));
  const monthlyTotal = monthlyPrincipal + monthlyInterest;
  const adminFee = input.adminFee ?? Math.round(amount * 0.01);
  const status: LoanStatus = input.status || 'aktif';

  // 7. Generate ID Pinjaman Unik
  const now = new Date();
  const yearSuffix = now.getFullYear().toString().slice(-2);
  const monthSuffix = String(now.getMonth() + 1).padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const loanId = `PJM-${yearSuffix}${monthSuffix}-${Date.now().toString().slice(-4)}-${randomSuffix}`;

  // 8. Bentuk Payload `loans`
  const loanRow = {
    id: loanId,
    member_id: cleanMemberId,
    member_name: cleanMemberName,
    amount: amount,
    tenor_months: tenorMonths,
    admin_fee: adminFee,
    monthly_principal: monthlyPrincipal,
    monthly_interest: monthlyInterest,
    monthly_total: monthlyTotal,
    start_date: cleanDate,
    status: status,
    purpose: input.purpose?.trim() || 'Keperluan Anggota',
    approved_date: status === 'aktif' ? (input.approvedDate || cleanDate) : null,
    disbursed_date: status === 'aktif' ? (input.disbursedDate || cleanDate) : null,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    // 9. INSERT ke tabel `loans` Supabase
    const { data: insertedLoanRow, error: loanErr } = await supabase
      .from('loans')
      .insert([loanRow])
      .select('*')
      .single();

    if (loanErr) {
      console.error('Gagal mencatat pinjaman ke Supabase:', loanErr);
      return {
        success: false,
        message: `Gagal mencatat pinjaman ke server database: ${loanErr.message}`,
        error: loanErr.message,
      };
    }

    // 10. Generate dan INSERT ke tabel `loan_schedules`
    const scheduleRows = [];
    const mappedSchedules: LoanScheduleItem[] = [];
    const startDateObj = new Date(cleanDate);

    for (let m = 1; m <= tenorMonths; m++) {
      const due = new Date(startDateObj);
      due.setMonth(due.getMonth() + m);
      const dueStr = isNaN(due.getTime()) ? cleanDate : due.toISOString().split('T')[0];
      const scheduleId = `${loanId}-SCH-${String(m).padStart(2, '0')}`;

      scheduleRows.push({
        id: scheduleId,
        loan_id: loanId,
        installment_no: m,
        due_date: dueStr,
        principal: monthlyPrincipal,
        interest: monthlyInterest,
        total_installment: monthlyTotal,
        is_paid: false,
        paid_date: null,
        receipt_id: null,
        notes: null,
      });

      mappedSchedules.push({
        month: m,
        dueDate: dueStr,
        principal: monthlyPrincipal,
        interest: monthlyInterest,
        totalInstallment: monthlyTotal,
        isPaid: false,
      });
    }

    const { error: schErr } = await supabase.from('loan_schedules').insert(scheduleRows);
    if (schErr) {
      console.warn('Peringatan: Gagal menyimpan loan_schedules:', schErr.message);
    }

    // 11. Catat Arus Kas Masuk & Keluar di `cash_flow_records` jika pinjaman langsung aktif
    if (status === 'aktif') {
      const disbursementCF = {
        id: `CSH-DISB-${loanId.replace(/[^A-Za-z0-9]/g, '')}`,
        transaction_date: cleanDate,
        type: 'keluar',
        category: 'pencairan_pinjaman',
        amount: amount,
        reference_id: loanId,
        description: `Pencairan Pinjaman Plafon ${formatRupiah(amount)} - ${cleanMemberName}`,
        target_account: 'kas_koperasi',
        created_at: new Date().toISOString(),
      };

      const adminFeeCF = {
        id: `CSH-ADM-${loanId.replace(/[^A-Za-z0-9]/g, '')}`,
        transaction_date: cleanDate,
        type: 'masuk',
        category: 'biaya_admin',
        amount: adminFee,
        reference_id: loanId,
        description: `Biaya Administrasi Pinjaman ${loanId} - ${cleanMemberName}`,
        target_account: 'kas_koperasi',
        created_at: new Date().toISOString(),
      };

      const { error: cfErr } = await supabase.from('cash_flow_records').insert([disbursementCF, adminFeeCF]);
      if (cfErr) {
        console.warn('Peringatan: Gagal mencatat kas pencairan pinjaman:', cfErr.message);
      }
    }

    // 12. Catat ke `audit_logs`
    try {
      const auditPayload = {
        id: `LOG-LOAN-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'CREATE_LOAN',
        entity_type: 'loans',
        entity_id: loanId,
        description: `Mencatat Pinjaman Baru ${loanId} Plafon ${formatRupiah(amount)} (${tenorMonths} Bulan) untuk ${cleanMemberName}`,
        new_data: { loan: loanRow, schedulesCount: scheduleRows.length },
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log pinjaman:', auditErr);
    }

    const createdLoan = mapSupabaseLoanToLoan(insertedLoanRow || loanRow, [], validMembers, scheduleRows);

    return {
      success: true,
      message: `Pinjaman baru ${loanId} sebesar ${formatRupiah(amount)} untuk ${cleanMemberName} berhasil dicatat resmi di server.`,
      data: createdLoan,
    };
  } catch (err: any) {
    console.error('Pengecualian saat mencatat pinjaman:', err);
    return {
      success: false,
      message: `Terjadi kendala jaringan saat mencatat pinjaman: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Mencatat pembayaran angsuran ke tabel Supabase `loan_repayments`,
 * memperbarui status `loan_schedules` dan `loans`, serta mencatat arus kas ke `cash_flow_records`.
 */
export async function createLoanRepayment(
  input: CreateLoanRepaymentInput,
  currentUser?: AuthUser | null,
  cachedLoans?: Loan[],
  validMembers?: Member[]
): Promise<CreateLoanRepaymentActionResult> {
  // 1. Role Guard
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus/Bendahara yang memiliki wewenang untuk mencatat pembayaran angsuran.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  // 2. Validasi ID Pinjaman
  const loanId = input.loanId?.trim();
  if (!loanId) {
    return {
      success: false,
      message: 'ID Pinjaman wajib diisi.',
      error: 'INVALID_LOAN_ID',
    };
  }

  // 3. Validasi Nomor Angsuran
  const installmentNo = Math.round(Number(input.installmentNo));
  if (isNaN(installmentNo) || installmentNo <= 0) {
    return {
      success: false,
      message: 'Nomor angsuran tidak valid.',
      error: 'INVALID_INSTALLMENT_NO',
    };
  }

  const penalty = Math.max(0, Number(input.penalty) || 0);

  try {
    // 4. Ambil data pinjaman dan jadwal yang ada di Supabase
    const [loanRes, schRes, repCheck] = await Promise.all([
      supabase.from('loans').select('*').eq('id', loanId).maybeSingle(),
      supabase.from('loan_schedules').select('*').eq('loan_id', loanId).order('installment_no', { ascending: true }),
      supabase.from('loan_repayments').select('*').eq('loan_id', loanId).eq('installment_no', installmentNo).maybeSingle(),
    ]);

    // Hindari double payment
    if (repCheck.data) {
      return {
        success: false,
        message: `Angsuran bulan ke-${installmentNo} untuk pinjaman ${loanId} sudah tercatat lunas sebelumnya pada tanggal ${repCheck.data.transaction_date || ''}.`,
        error: 'ALREADY_PAID',
      };
    }

    const loanRow = loanRes.data || (cachedLoans ? cachedLoans.find((l) => l.id === loanId) : null);
    if (!loanRow) {
      return {
        success: false,
        message: `Pinjaman dengan ID "${loanId}" tidak ditemukan dalam database.`,
        error: 'LOAN_NOT_FOUND',
      };
    }

    const memberId = loanRow.member_id || loanRow.memberId || '';
    const memberName =
      loanRow.member_name ||
      loanRow.memberName ||
      validMembers?.find((m) => m.id === memberId)?.name ||
      'Anggota BJS';

    const schedules = schRes.data || [];
    const targetSchedule = schedules.find((s: any) => Number(s.installment_no) === installmentNo);

    const amount = Number(loanRow.amount) || 0;
    const tenorMonths = Number(loanRow.tenor_months || loanRow.tenorMonths) || 12;
    const principalAmount = targetSchedule
      ? Number(targetSchedule.principal)
      : Math.round(amount / tenorMonths);
    const interestAmount = targetSchedule
      ? Number(targetSchedule.interest)
      : Math.round(amount * 0.011);
    const totalPaid = principalAmount + interestAmount + penalty;

    // 5. Generate ID Pembayaran Angsuran
    const now = new Date();
    const repaymentId = `ANG-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-4)}-${String(installmentNo).padStart(2, '0')}`;
    const transactionDate = input.paidDate?.trim() || now.toISOString();
    const dateOnly = transactionDate.split('T')[0].split(' ')[0];
    const adminName = input.adminName?.trim() || currentUser.name || currentUser.username || 'Admin Bendahara BJS';

    // 6. INSERT ke tabel `loan_repayments`
    const repPayload = {
      id: repaymentId,
      loan_id: loanId,
      member_id: memberId,
      member_name: memberName,
      installment_no: installmentNo,
      principal_amount: principalAmount,
      interest_amount: interestAmount,
      penalty_amount: penalty,
      total_paid: totalPaid,
      transaction_date: transactionDate,
      admin_name: adminName,
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const { data: insertedRep, error: repErr } = await supabase
      .from('loan_repayments')
      .insert([repPayload])
      .select('*')
      .single();

    if (repErr) {
      console.error('Gagal mencatat angsuran ke Supabase:', repErr);
      return {
        success: false,
        message: `Gagal mencatat pembayaran angsuran ke database: ${repErr.message}`,
        error: repErr.message,
      };
    }

    // 7. Update status jadwal di `loan_schedules`
    const { error: schUpdErr } = await supabase
      .from('loan_schedules')
      .update({
        is_paid: true,
        paid_date: dateOnly,
        receipt_id: repaymentId,
        notes: input.notes?.trim() || null,
      })
      .eq('loan_id', loanId)
      .eq('installment_no', installmentNo);

    if (schUpdErr) {
      console.warn('Peringatan: Gagal memperbarui status loan_schedules:', schUpdErr.message);
    }

    // 8. Periksa apakah pinjaman sudah lunas seluruhnya
    const { count: totalRepCount } = await supabase
      .from('loan_repayments')
      .select('*', { count: 'exact', head: true })
      .eq('loan_id', loanId);

    const isAllPaid = (totalRepCount || 0) >= tenorMonths;
    if (isAllPaid) {
      await supabase
        .from('loans')
        .update({
          status: 'lunas',
          updated_at: new Date().toISOString(),
        })
        .eq('id', loanId);
    }

    // 9. Catat ke `cash_flow_records`: Kas Masuk Pokok & Kas Masuk Bunga (beserta Denda jika ada)
    const cfPrincipal = {
      id: `CSH-ANGP-${repaymentId.replace(/[^A-Za-z0-9]/g, '')}`,
      transaction_date: dateOnly,
      type: 'masuk',
      category: 'angsuran_pokok',
      amount: principalAmount,
      reference_id: repaymentId,
      description: `Angsuran Pokok #${installmentNo} (${loanId}) - ${memberName}`,
      target_account: 'kas_koperasi',
      created_at: new Date().toISOString(),
    };

    const cfInterest = {
      id: `CSH-ANGJ-${repaymentId.replace(/[^A-Za-z0-9]/g, '')}`,
      transaction_date: dateOnly,
      type: 'masuk',
      category: 'angsuran_bunga',
      amount: interestAmount + penalty,
      reference_id: repaymentId,
      description: `Jasa Bunga #${installmentNo} (${loanId}) - ${memberName}${penalty > 0 ? ` (Termasuk Denda Rp ${penalty.toLocaleString('id-ID')})` : ''}`,
      target_account: 'kas_koperasi',
      created_at: new Date().toISOString(),
    };

    const { error: cfErr } = await supabase.from('cash_flow_records').insert([cfPrincipal, cfInterest]);
    if (cfErr) {
      console.warn('Peringatan: Gagal mencatat kas masuk angsuran:', cfErr.message);
    }

    // 10. Catat ke `audit_logs`
    try {
      const auditPayload = {
        id: `LOG-REP-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'CREATE_LOAN_REPAYMENT',
        entity_type: 'loan_repayments',
        entity_id: repaymentId,
        description: `Mencatat Pembayaran Angsuran #${installmentNo} Pinjaman ${loanId} Total ${formatRupiah(totalPaid)} untuk ${memberName}`,
        new_data: repPayload,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log angsuran:', auditErr);
    }

    const mappedRep = mapSupabaseRepaymentToRepayment(insertedRep || repPayload, installmentNo - 1, validMembers);

    return {
      success: true,
      message: `Pembayaran angsuran #${installmentNo} sebesar ${formatRupiah(totalPaid)} untuk ${memberName} berhasil dicatat resmi di server.`,
      data: mappedRep,
    };
  } catch (err: any) {
    console.error('Pengecualian saat mencatat pembayaran angsuran:', err);
    return {
      success: false,
      message: `Terjadi kendala jaringan saat mencatat angsuran: ${err.message || 'Koneksi gagal'}`,
      error: err.message,
    };
  }
}

/**
 * Memperbarui status pembayaran satu baris jadwal angsuran di `loan_schedules`.
 */
export async function updateLoanScheduleStatus(
  input: UpdateLoanScheduleInput,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang dapat memperbarui status jadwal angsuran.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const paidDate = input.isPaid
      ? (input.paidDate || new Date().toISOString().split('T')[0])
      : null;

    const { error } = await supabase
      .from('loan_schedules')
      .update({
        is_paid: input.isPaid,
        paid_date: paidDate,
        notes: input.notes || null,
      })
      .eq('loan_id', input.loanId)
      .eq('installment_no', input.installmentNo);

    if (error) {
      return { success: false, message: error.message, error: error.message };
    }

    // Evaluasi apakah pinjaman lunas
    const { data: allSchedules } = await supabase
      .from('loan_schedules')
      .select('is_paid')
      .eq('loan_id', input.loanId);

    if (allSchedules && allSchedules.length > 0) {
      const allPaid = allSchedules.every((s: any) => s.is_paid);
      await supabase
        .from('loans')
        .update({
          status: allPaid ? 'lunas' : 'aktif',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.loanId);
    }

    return { success: true, message: 'Status jadwal angsuran berhasil diperbarui.' };
  } catch (err: any) {
    return { success: false, message: err.message, error: err.message };
  }
}

/**
 * Menyetujui pinjaman yang diajukan dan mengaktifkannya.
 */
export async function approveLoan(
  loanId: string,
  currentUser?: AuthUser | null,
  cachedLoans?: Loan[]
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang dapat menyetujui pinjaman.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: updatedLoan, error: loanErr } = await supabase
      .from('loans')
      .update({
        status: 'aktif',
        approved_date: todayStr,
        disbursed_date: todayStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId)
      .select('*')
      .single();

    if (loanErr) {
      return { success: false, message: loanErr.message, error: loanErr.message };
    }

    const loan = updatedLoan || (cachedLoans ? cachedLoans.find((l) => l.id === loanId) : null);
    if (loan) {
      const amount = Number(loan.amount) || 0;
      const adminFee = Number(loan.admin_fee) || Math.round(amount * 0.01);
      const memberName = loan.member_name || 'Anggota BJS';

      const disbursementCF = {
        id: `CSH-DISB-${loanId.replace(/[^A-Za-z0-9]/g, '')}`,
        transaction_date: todayStr,
        type: 'keluar',
        category: 'pencairan_pinjaman',
        amount: amount,
        reference_id: loanId,
        description: `Pencairan Pinjaman Disetujui - ${memberName}`,
        target_account: 'kas_koperasi',
        created_at: new Date().toISOString(),
      };

      const adminFeeCF = {
        id: `CSH-ADM-${loanId.replace(/[^A-Za-z0-9]/g, '')}`,
        transaction_date: todayStr,
        type: 'masuk',
        category: 'biaya_admin',
        amount: adminFee,
        reference_id: loanId,
        description: `Biaya Administrasi Pinjaman ${loanId} - ${memberName}`,
        target_account: 'kas_koperasi',
        created_at: new Date().toISOString(),
      };

      await supabase.from('cash_flow_records').insert([disbursementCF, adminFeeCF]);
    }

    try {
      const auditPayload = {
        id: `LOG-APPR-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'APPROVE_LOAN',
        entity_type: 'loans',
        entity_id: loanId,
        description: `Menyetujui & mencairkan pinjaman ${loanId}`,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return { success: true, message: `Pinjaman ${loanId} berhasil disetujui dan dicairkan.` };
  } catch (err: any) {
    return { success: false, message: err.message, error: err.message };
  }
}

/**
 * Menolak pinjaman yang diajukan.
 */
export async function rejectLoan(
  loanId: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang dapat menolak pinjaman.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'ditolak',
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId);

    if (error) {
      return { success: false, message: error.message, error: error.message };
    }

    try {
      const auditPayload = {
        id: `LOG-REJ-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'REJECT_LOAN',
        entity_type: 'loans',
        entity_id: loanId,
        description: `Menolak permohonan pinjaman ${loanId}`,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return { success: true, message: `Pinjaman ${loanId} telah ditolak.` };
  } catch (err: any) {
    return { success: false, message: err.message, error: err.message };
  }
}

/**
 * Menghapus pinjaman (beserta jadwal dan angsurannya) dari database.
 */
export async function deleteLoan(
  loanId: string,
  currentUser?: AuthUser | null
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!currentUser || currentUser.role !== 'pengurus') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Pengurus yang dapat menghapus pinjaman.',
      error: 'UNAUTHORIZED_ROLE',
    };
  }

  try {
    await supabase.from('loan_schedules').delete().eq('loan_id', loanId);
    await supabase.from('loan_repayments').delete().eq('loan_id', loanId);
    const { error } = await supabase.from('loans').delete().eq('id', loanId);

    if (error) {
      return { success: false, message: error.message, error: error.message };
    }

    try {
      const auditPayload = {
        id: `LOG-DEL-LOAN-${Date.now()}`,
        user_id: currentUser.id || undefined,
        actor_name: currentUser.name || currentUser.username || 'Pengurus BJS',
        actor_role: currentUser.role || 'pengurus',
        action: 'DELETE_LOAN',
        entity_type: 'loans',
        entity_id: loanId,
        description: `Menghapus data pinjaman ${loanId}`,
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditPayload]);
    } catch {}

    return { success: true, message: `Pinjaman ${loanId} berhasil dihapus.` };
  } catch (err: any) {
    return { success: false, message: err.message, error: err.message };
  }
}

