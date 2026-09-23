"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLoanSettled } from "@/lib/actions/loans";
import { formatCurrency } from "@/lib/format";

export function MarkSettledButton({ loanId, outstanding }: { loanId: string; outstanding: number }) {
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markLoanSettled(loanId);
      if (!result.success) toast.error(result.error ?? "Couldn't mark as settled.");
      else toast.success(`Marked settled — ${formatCurrency(outstanding)} logged as repaid.`);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark Settled
    </Button>
  );
}
