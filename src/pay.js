function pay(user, amount) {
    if (!user || !user.wallet) {
        throw new Error("Invalid user account");
    }
    if (typeof amount !== "number" || amount <= 0) {
        throw new Error("Invalid payment amount");
    }
    const currentBalance = user.wallet.balance ?? 0;
    if (currentBalance < amount) {
        throw new Error("Insufficient funds");
    }
    return currentBalance - amount;
}

function calculateBonus(salary) {
    if (typeof salary !== "number" || salary < 0) {
        throw new Error("Invalid salary");
    }
    return Math.round(salary * 0.1);
}

module.exports = { pay, calculateBonus };
