"use client";

import * as React from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshInvestmentPrices } from "@/lib/actions/price-refresh";

export function RefreshPricesButton() {
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshInvestmentPrices();
      if (result.updated.length > 0) {
        toast.success(
          `Updated ${result.updated.length} holding${result.updated.length === 1 ? "" : "s"} from live prices.`,
          {
            description:
              result.skipped.length > 0
                ? `${result.skipped.length} holding${result.skipped.length === 1 ? "" : "s"} couldn't be auto-priced — ${result.skipped[0].detail}.`
                : undefined,
          }
        );
      } else if (result.skipped.length > 0) {
        toast.error("Couldn't refresh any holdings automatically.", {
          description: result.skipped[0].detail,
        });
      } else {
        toast("No investments to refresh yet.");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh Prices
    </Button>
  );
}
