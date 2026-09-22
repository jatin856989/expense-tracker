import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Landmark,
  TrendingUp,
  HandCoins,
  Target,
  Repeat,
  Tags,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/accounts", label: "Bank Accounts", icon: Landmark },
  { href: "/portfolio", label: "Portfolio", icon: TrendingUp },
  { href: "/loans", label: "Loans", icon: HandCoins },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];
