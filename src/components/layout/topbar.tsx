import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { Wallet } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <MobileNav />
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="size-3.5" />
          </div>
          <span className="font-semibold">Expense Tracker</span>
        </div>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
