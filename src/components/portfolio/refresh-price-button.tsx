"use client";

import * as React from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshInvestmentPrice } from "@/lib/actions/price-refresh";

export function RefreshPriceButton({ investmentId }: { investmentId: string }) {
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshInvestmentPrice(investmentId);
      if (result.status === "updated") toast.success(`Updated from live price — ${result.detail}`);
      else toast.error("Couldn't auto-price this holding.", { description: result.detail });
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh Price
    </Button>
  );
}
