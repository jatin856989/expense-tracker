export const CATEGORY_ICONS = [
  "UtensilsCrossed", "ShoppingBasket", "Car", "Fuel", "Home", "Receipt",
  "Smartphone", "ShoppingBag", "Clapperboard", "Repeat", "HeartPulse",
  "GraduationCap", "Plane", "ShieldCheck", "Sparkles", "Gift", "Landmark",
  "Wallet", "Laptop", "Briefcase", "Percent", "Building2", "Undo2",
  "TrendingUp", "PieChart", "Bitcoin", "Lock", "Gem", "Building",
  "PiggyBank", "HandCoins", "Users", "Dumbbell", "Baby", "PawPrint",
  "Wrench", "Coffee", "Music", "Book", "Palette", "MoreHorizontal",
] as const;

export const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#64748b",
] as const;

export const ACCENT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4",
  "#eab308", "#ef4444", "#14b8a6", "#a855f7",
] as const;

export const CARD_TYPE_LABELS: Record<string, string> = {
  CREDIT: "Credit Card",
  DEBIT: "Debit Card",
  PREPAID: "Prepaid Card",
  OTHER: "Other",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SAVINGS: "Savings",
  SALARY: "Salary",
  CURRENT: "Current",
  DEMAT: "Demat",
  OTHER: "Other",
};

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  ONLINE: "Online",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};

export const INSTRUMENT_TYPE_LABELS: Record<string, string> = {
  STOCKS: "Stocks",
  MUTUAL_FUND: "Mutual Fund",
  CRYPTO: "Crypto",
  FIXED_DEPOSIT: "Fixed Deposit",
  GOLD: "Gold",
  REAL_ESTATE: "Real Estate",
  BONDS: "Bonds",
  PPF_EPF: "PPF / EPF",
  OTHER: "Other",
};

export const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export const LOAN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PARTIALLY_SETTLED: "Partially Settled",
  SETTLED: "Settled",
};
