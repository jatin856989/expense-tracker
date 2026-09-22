import { Wallet } from "lucide-react";
import { navItems } from "./nav-items";
import { NavLink } from "./nav-link";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/40 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Wallet className="size-4" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Expense Tracker</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={<item.icon className="size-4 shrink-0" />}
          />
        ))}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground">
        Your data, your database.
      </div>
    </aside>
  );
}
