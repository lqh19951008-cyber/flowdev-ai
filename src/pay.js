/**
 * Pay & Bonus utilities — refactored per Antigravity Skill (flowdev-quality).
 *
 * Defensive principles applied:
 *   - Optional chaining + nullish coalescing for deep property access.
 *   - Guard clauses at function entry to fail fast.
 *   - Number.isFinite() to reject NaN / +Infinity / -Infinity.
 *   - Explicit typeof === 'number' guard before arithmetic to prevent
 *     implicit type coercion (e.g. "100" - 50 === 50).
 */

function pay(user, amount) {
    // Guard 1: user/wallet existence (defensive — even if upstream says it exists)
    if (!user?.wallet) {
        throw new Error("Invalid user account");
    }

    // Guard 2: amount must be a finite, positive number.
    // typeof NaN === 'number' && NaN <= 0 === false  ⇒ NaN bypasses plain checks,
    // so we use Number.isFinite() which returns false for NaN / ±Infinity.
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid payment amount");
    }

    // Defensive read: prefer optional chaining + nullish coalescing.
    // Then enforce strict numeric type to avoid implicit coercion on arithmetic
    // (e.g. wallet.balance === "100" would otherwise become 100 via '-').
    const currentBalance = user?.wallet?.balance ?? 0;
    if (typeof currentBalance !== "number" || !Number.isFinite(currentBalance)) {
        throw new Error("Invalid wallet balance");
    }
    if (currentBalance < amount) {
        throw new Error("Insufficient funds");
    }
    return currentBalance - amount;
}

function calculateBonus(salary) {
    // typeof NaN === 'number' && NaN < 0 === false  ⇒ NaN must be rejected.
    if (!Number.isFinite(salary) || salary < 0) {
        throw new Error("Invalid salary");
    }
    return Math.round(salary * 0.1);
}

module.exports = { pay, calculateBonus };
      // optimize with optional chaining
      const safeBalance = user?.wallet?.balance ?? 0;
// second commit
// third commit
// third commit
// new code
