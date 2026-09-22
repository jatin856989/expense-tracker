import path from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Standalone scripts run via `tsx` (unlike `next dev`/`next build`, which
// load .env automatically) don't get .env loaded for free — do it explicitly.
try {
  loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // .env is optional if DATABASE_URL is already set in the environment
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — see DEPLOYMENT.md.");
}
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type SeedCategory = {
  name: string;
  kind: "EXPENSE" | "INCOME" | "INVESTMENT" | "LOAN";
  icon: string;
  color: string;
};

// A sensible set of defaults covering common personal-finance categories.
// Every one of these can be renamed, recolored or deleted by the user later —
// this just avoids starting from a completely blank slate.
const categories: SeedCategory[] = [
  // Expenses
  { name: "Food & Dining", kind: "EXPENSE", icon: "UtensilsCrossed", color: "#f97316" },
  { name: "Groceries", kind: "EXPENSE", icon: "ShoppingBasket", color: "#84cc16" },
  { name: "Transport", kind: "EXPENSE", icon: "Car", color: "#3b82f6" },
  { name: "Fuel", kind: "EXPENSE", icon: "Fuel", color: "#f59e0b" },
  { name: "Rent", kind: "EXPENSE", icon: "Home", color: "#a855f7" },
  { name: "Utilities & Bills", kind: "EXPENSE", icon: "Receipt", color: "#06b6d4" },
  { name: "Mobile & Internet", kind: "EXPENSE", icon: "Smartphone", color: "#0ea5e9" },
  { name: "Shopping", kind: "EXPENSE", icon: "ShoppingBag", color: "#ec4899" },
  { name: "Entertainment", kind: "EXPENSE", icon: "Clapperboard", color: "#8b5cf6" },
  { name: "Subscriptions", kind: "EXPENSE", icon: "Repeat", color: "#6366f1" },
  { name: "Health & Medical", kind: "EXPENSE", icon: "HeartPulse", color: "#ef4444" },
  { name: "Education", kind: "EXPENSE", icon: "GraduationCap", color: "#14b8a6" },
  { name: "Travel", kind: "EXPENSE", icon: "Plane", color: "#0891b2" },
  { name: "Insurance", kind: "EXPENSE", icon: "ShieldCheck", color: "#64748b" },
  { name: "Personal Care", kind: "EXPENSE", icon: "Sparkles", color: "#f43f5e" },
  { name: "Gifts & Donations", kind: "EXPENSE", icon: "Gift", color: "#d946ef" },
  { name: "Fees & Charges", kind: "EXPENSE", icon: "Landmark", color: "#78716c" },
  { name: "Other Expense", kind: "EXPENSE", icon: "MoreHorizontal", color: "#71717a" },

  // Income
  { name: "Salary", kind: "INCOME", icon: "Wallet", color: "#22c55e" },
  { name: "Freelance", kind: "INCOME", icon: "Laptop", color: "#10b981" },
  { name: "Business", kind: "INCOME", icon: "Briefcase", color: "#059669" },
  { name: "Interest", kind: "INCOME", icon: "Percent", color: "#16a34a" },
  { name: "Rental Income", kind: "INCOME", icon: "Building2", color: "#15803d" },
  { name: "Refunds", kind: "INCOME", icon: "Undo2", color: "#4ade80" },
  { name: "Gifts Received", kind: "INCOME", icon: "Gift", color: "#86efac" },
  { name: "Other Income", kind: "INCOME", icon: "MoreHorizontal", color: "#22c55e" },

  // Investments
  { name: "Equity / Stocks", kind: "INVESTMENT", icon: "TrendingUp", color: "#3b82f6" },
  { name: "Mutual Funds", kind: "INVESTMENT", icon: "PieChart", color: "#6366f1" },
  { name: "Crypto", kind: "INVESTMENT", icon: "Bitcoin", color: "#f59e0b" },
  { name: "Fixed Deposit", kind: "INVESTMENT", icon: "Lock", color: "#0ea5e9" },
  { name: "Gold", kind: "INVESTMENT", icon: "Gem", color: "#eab308" },
  { name: "Real Estate", kind: "INVESTMENT", icon: "Building", color: "#a855f7" },
  { name: "Retirement (PPF/EPF)", kind: "INVESTMENT", icon: "PiggyBank", color: "#14b8a6" },
  { name: "Other Investment", kind: "INVESTMENT", icon: "MoreHorizontal", color: "#64748b" },

  // Loans
  { name: "Personal Loan", kind: "LOAN", icon: "HandCoins", color: "#f97316" },
  { name: "Friend/Family", kind: "LOAN", icon: "Users", color: "#ec4899" },
  { name: "Other Loan", kind: "LOAN", icon: "MoreHorizontal", color: "#71717a" },
];

async function main() {
  console.log(`Seeding ${categories.length} default categories...`);
  for (const c of categories) {
    await prisma.category.upsert({
      where: { name_kind: { name: c.name, kind: c.kind } },
      update: {},
      create: { ...c, isDefault: true },
    });
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
