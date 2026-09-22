import { Loader2 } from "lucide-react";

// Shown instantly on navigation while a page's data is still loading — Next
// wraps every route under this segment (and its children) in the Suspense
// boundary this file creates, so the sidebar/topbar stay interactive and
// only this fallback appears in the content area.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
