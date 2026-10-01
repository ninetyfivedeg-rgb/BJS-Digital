import { Member, SavingsTransaction, Loan, LoanRepayment, CashFlowRecord, BusinessUnitTransaction } from '../types';
import { BJS_MEMBERS, BJS_SAVINGS } from './bjsMembersData';

export const INITIAL_MEMBERS: Member[] = BJS_MEMBERS;

export const INITIAL_SAVINGS: SavingsTransaction[] = BJS_SAVINGS;

// Data pinjaman dikosongkan untuk input data riil secara manual per permintaan pengguna
export const INITIAL_LOANS: Loan[] = [];

// Riwayat angsuran dikosongkan untuk input data riil secara manual
export const INITIAL_REPAYMENTS: LoanRepayment[] = [];

// Saldo awal Kas Unit Simpan Pinjam diset Rp 0 (nol) agar mutasi kas dapat diinput ulang dari awal
export const INITIAL_CASH_FLOW: CashFlowRecord[] = [];

// Transaksi unit usaha dikosongkan untuk input manual data transaksi riil
export const INITIAL_BUSINESS_TRANSACTIONS: BusinessUnitTransaction[] = [];

export const BUSINESS_UNITS_CONFIG = {
  apar: {
    id: 'apar',
    key: 'apar_refill',
    name: 'Isi Ulang APAR',
    fullName: 'Unit Usaha Pengisian Ulang Alat Pemadam Api Ringan (APAR)',
    pengelolaName: 'Irfan Susetya, S.Sos.',
    pengelolaRole: 'Pengelola Unit Usaha Pengisian Ulang Alat Pemadam Api Ringan / APAR',
    description: 'Jasa pengisian ulang tabung APAR (Powder, CO2, Foam), uji hydro-test, dan pemeliharaan berkala.',
  },
  alat_kebakaran: {
    id: 'alat_kebakaran',
    key: 'apar_sales',
    name: 'Penjualan Alat Kebakaran',
    fullName: 'Unit Usaha Penjualan Alat Proteksi Kebakaran',
    pengelolaName: 'Nur Arby Maulana, ST.',
    pengelolaRole: 'Pengelola Unit Usaha Penjualan Alat Proteksi Kebakaran',
    description: 'Pengadaan tabung APAR baru, fire blanket, sprinkler, box hydrant, nozzle, dan peralatan proteksi kebakaran.',
  },
  sembako: {
    id: 'sembako',
    key: 'sembako',
    name: 'Penjualan Sembako',
    fullName: 'Unit Usaha Penjualan Sembako',
    pengelolaName: 'Ahmad Qori',
    pengelolaRole: 'Pengelola Unit Usaha Penjualan Sembako',
    description: 'Penyediaan kebutuhan bahan pangan pokok (beras, minyak goreng, gula, tepung) harga bersubsidi koperasi.',
  },
  atribut: {
    id: 'atribut',
    key: 'atribut',
    name: 'Penjualan Atribut',
    fullName: 'Unit Usaha Penjualan Atribut',
    pengelolaName: 'Anan Wahid Hidayanto, ST.',
    pengelolaRole: 'Pengelola Unit Usaha Penjualan Atribut',
    description: 'Pengadaan seragam dinas harian, rompi safety lapangan, ID card, sepatu safety, topi dinas, dan badge bordir.',
  },
};
