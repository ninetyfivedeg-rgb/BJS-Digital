# Security Specification for Firestore Rules

## 1. Data Invariants
- Each document ID must be valid, alphanumeric with hyphens/underscores, and <= 128 characters.
- System write operations require an authenticated user (`request.auth != null`).
- Admin privileges are verified against trusted identity (`ninetyfive.deg@gmail.com` with `email_verified == true`) or database record in `/admins/{uid}`.
- All monetary amounts (`amount`, `totalPaid`, `principalAmount`, etc.) must be non-negative numbers.
- Transaction records must include immutable identifiers and required metadata (`id`, `date`, etc.).
- Members require valid status, name, and register ID.
- Cash mutations, savings, and loans require strict category and type integrity.

## 2. The Dirty Dozen Payloads (Should Be Rejected)
1. **Unauthenticated Write**: Creating a member document with `request.auth == null` -> DENIED.
2. **Invalid ID Injection**: Document ID with path traversal or > 128 characters -> DENIED.
3. **Ghost Field Poisoning**: Inserting `{ id: 'BJS-999', name: 'Test', status: 'aktif', role: 'superadmin' }` -> DENIED.
4. **Negative Plafond Loan**: Creating loan with `amount: -5000000` -> DENIED.
5. **Zero Tenor Loan**: Creating loan with `tenorMonths: 0` -> DENIED.
6. **Missing Member Required Fields**: Creating member without `name` or `status` -> DENIED.
7. **Negative Repayment Total**: Creating loan repayment with `totalPaid: -100000` -> DENIED.
8. **Oversized String Bomb**: Setting description with 1MB string on CashFlow -> DENIED.
9. **Invalid Mutation Type**: Creating `SimpanPinjamCashMutation` with `type: 'hacked'` -> DENIED.
10. **Spoofed Admin Write**: Unverified email attempting administrative bypass -> DENIED.
11. **Negative CashFlow Amount**: Writing cashflow with `amount: -100` -> DENIED.
12. **Malformed Business Unit Type**: Writing business transaction without required fields -> DENIED.

## 3. Test Runner Specification
The rules enforce ABAC and schema validation across all collections (`members`, `savings`, `loans`, `repayments`, `cashFlow`, `spCashMutations`, `businessTransactions`, `test`).
All Dirty Dozen payloads violate either `isSignedIn()`, `isValidId()`, or `isValid[Entity]()` criteria.
