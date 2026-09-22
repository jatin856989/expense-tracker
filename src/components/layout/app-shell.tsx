import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { VoiceFab } from "@/components/voice/voice-fab";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <VoiceFab />
    </div>
  );
}
