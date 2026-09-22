"use client";

import * as React from "react";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { BankAccount } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToCompressedDataUrl } from "@/lib/image-compress";
import { analyzePortfolioImage, importHoldingsFromImage } from "@/lib/actions/portfolio-image";
import type { ExtractedHolding } from "@/lib/validations-portfolio-image";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/constants";

type Stage = "pick" | "analyzing" | "review" | "importing";
type EditableHolding = ExtractedHolding & { include: boolean };

export function ImportFromImageDialog({ accounts }: { accounts: BankAccount[] }) {
  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<Stage>("pick");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [platform, setPlatform] = React.useState("");
  const [holdings, setHoldings] = React.useState<EditableHolding[]>([]);
  const [bankAccountId, setBankAccountId] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function resetAll() {
    setStage("pick");
    setPreviewUrl(null);
    setHoldings([]);
    setPlatform("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetAll();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPreviewUrl(dataUrl);
    } catch {
      setError("Couldn't read that image — try a different one.");
    }
  }

  async function handleAnalyze() {
    if (!previewUrl) return;
    setStage("analyzing");
    setError(null);
    const result = await analyzePortfolioImage(previewUrl);
    if (!result.success) {
      setError(result.error);
      setStage("pick");
      return;
    }
    setPlatform(result.data.platform ?? "");
    setHoldings(result.data.holdings.map((h) => ({ ...h, include: true })));
    setStage("review");
  }

  function updateHolding(index: number, patch: Partial<EditableHolding>) {
    setHoldings((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  async function handleImport() {
    const selected = holdings.filter((h) => h.include && h.name.trim() && h.investedAmount);
    if (selected.length === 0) {
      toast.error("Select at least one holding with a name and invested amount.");
      return;
    }
    setStage("importing");
    const result = await importHoldingsFromImage(
      selected.map((h) => ({
        name: h.name,
        symbol: h.symbol,
        instrumentType: h.instrumentType,
        platform: platform.trim() || "Unknown",
        investedAmount: h.investedAmount!,
        currentValue: h.currentValue,
        units: h.units,
        purchasePrice: h.purchasePrice,
        bankAccountId: bankAccountId || null,
      }))
    );
    if (result.success) {
      toast.success(`Imported ${result.count} investment${result.count === 1 ? "" : "s"}.`);
      handleOpenChange(false);
    } else {
      toast.error(result.error);
      setStage("review");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Camera /> Import from Screenshot</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Import from Screenshot</DialogTitle>
          <DialogDescription>
            Upload a screenshot of your holdings (Coin, Groww, a broker statement, anything similar) — it
            reads the fund/stock names and amounts, and you confirm before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            {previewUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Selected portfolio screenshot" className="max-h-64 w-full rounded-lg border object-contain" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose a different image
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-muted-foreground transition-colors hover:bg-accent"
              >
                <Camera className="size-8" />
                <span className="text-sm font-medium">Tap to choose a screenshot</span>
              </button>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button disabled={!previewUrl} onClick={handleAnalyze}>
                <Sparkles /> Analyze
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Reading your holdings…</p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="platform" className="mb-1.5">Platform</Label>
                <Input id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Zerodha Coin" />
              </div>
              <div>
                <Label htmlFor="paidFrom" className="mb-1.5">Paid From (optional)</Label>
                <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
                  <SelectTrigger id="paidFrom" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Found {holdings.length} holding{holdings.length === 1 ? "" : "s"} — check the amounts, uncheck
              anything wrong, then import.
            </p>

            <div className="max-h-96 space-y-3 overflow-y-auto">
              {holdings.map((h, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={h.include}
                      onCheckedChange={(checked) => updateHolding(i, { include: !!checked })}
                      className="mt-2"
                      aria-label={`Include ${h.name}`}
                    />
                    <div className="flex-1 space-y-2">
                      <Input
                        value={h.name}
                        onChange={(e) => updateHolding(i, { name: e.target.value })}
                        placeholder="Holding name"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={h.instrumentType} onValueChange={(v) => updateHolding(i, { instrumentType: v as ExtractedHolding["instrumentType"] })}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(INSTRUMENT_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={h.investedAmount ?? ""}
                          onChange={(e) => updateHolding(i, { investedAmount: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="Invested"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={h.currentValue ?? ""}
                          onChange={(e) => updateHolding(i, { currentValue: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="Current value"
                        />
                      </div>
                      {!h.investedAmount && (
                        <p className="text-xs text-destructive">Needs an invested amount to be imported.</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove"
                      onClick={() => setHoldings((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetAll}>Start Over</Button>
              <Button onClick={handleImport}>
                Import {holdings.filter((h) => h.include && h.investedAmount).length} Holding
                {holdings.filter((h) => h.include && h.investedAmount).length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "importing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Saving…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
