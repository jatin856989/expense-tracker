"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { parseStatementPdf, importStatementTransactions } from "@/lib/actions/statement-import";
import type { ReviewStatementTxn } from "@/lib/validations-statement";
import { PAYMENT_MODE_LABELS } from "@/lib/constants";

type Stage = "pick" | "analyzing" | "review" | "importing";
type EditableRow = ReviewStatementTxn & { include: boolean; paymentMode: string; categoryId: string };

const typeItems = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
];
const paymentModeItems = Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }));

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ImportStatementDialog({ accountId, categories }: { accountId: string; categories: Category[] }) {
  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<Stage>("pick");
  const [file, setFile] = React.useState<File | null>(null);
  const [periodStart, setPeriodStart] = React.useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [periodEnd, setPeriodEnd] = React.useState(() => toDateInputValue(new Date()));
  const [rows, setRows] = React.useState<EditableRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function resetAll() {
    setStage("pick");
    setFile(null);
    setRows([]);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetAll();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    setFile(f);
  }

  async function handleAnalyze() {
    if (!file) return;
    setStage("analyzing");
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await parseStatementPdf(accountId, dataUrl, periodStart, periodEnd);
      if (!result.success) {
        setError(result.error);
        setStage("pick");
        return;
      }
      setRows(
        result.transactions.map((t) => ({
          ...t,
          include: !t.possibleDuplicate,
          paymentMode: "BANK_TRANSFER",
          categoryId: "",
        }))
      );
      setStage("review");
    } catch {
      setError("Couldn't read that file — try a different PDF.");
      setStage("pick");
    }
  }

  function updateRow(i: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) {
      toast.error("Select at least one transaction to import.");
      return;
    }
    setStage("importing");
    const result = await importStatementTransactions({
      accountId,
      rows: selected.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        paymentMode: r.paymentMode,
        categoryId: r.categoryId || undefined,
      })),
    });
    if (result.success) {
      toast.success(`Imported ${result.count} transaction${result.count === 1 ? "" : "s"}. Check the balance card — use Adjust Balance for any last gap.`);
      handleOpenChange(false);
    } else {
      toast.error(result.error);
      setStage("review");
    }
  }

  const includedCount = rows.filter((r) => r.include).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm"><FileUp /> Import Statement</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload your statement PDF for a date range — it reads every transaction and flags anything that looks
            already logged. Nothing is saved until you accept, reject or edit each row and confirm.
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="periodStart" className="mb-1.5">Statement from</Label>
                <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="periodEnd" className="mb-1.5">to</Label>
                <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
            {file ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="truncate text-sm">{file.name}</span>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Change</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-muted-foreground transition-colors hover:bg-accent"
              >
                <FileUp className="size-8" />
                <span className="text-sm font-medium">Tap to choose a statement PDF</span>
              </button>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button disabled={!file} onClick={handleAnalyze}>
                <Sparkles /> Analyze
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Reading your statement…</p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Found {rows.length} transaction{rows.length === 1 ? "" : "s"} — {includedCount} selected. Rows flagged
              as possible duplicates start unchecked; edit anything before importing.
            </p>

            <div className="max-h-[28rem] space-y-3 overflow-y-auto">
              {rows.map((r, i) => {
                const relevantCategories = categories.filter((c) => c.kind === r.type);
                const categoryItems = relevantCategories.map((c) => ({
                  value: c.id,
                  label: (
                    <span className="flex items-center gap-1.5">
                      <DynamicIcon iconName={c.icon} className="size-3.5" style={{ color: c.color ?? undefined }} /> {c.name}
                    </span>
                  ),
                }));
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${r.possibleDuplicate ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={r.include}
                        onCheckedChange={(checked) => updateRow(i, { include: !!checked })}
                        className="mt-2"
                        aria-label={`Include ${r.description}`}
                      />
                      <div className="flex-1 space-y-2">
                        {r.possibleDuplicate && r.duplicateNote && (
                          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3.5" /> Possible duplicate — {r.duplicateNote}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Input type="date" value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} />
                          <Input
                            type="number"
                            step="0.01"
                            value={r.amount}
                            onChange={(e) => updateRow(i, { amount: e.target.value === "" ? 0 : Number(e.target.value) })}
                          />
                          <Select
                            value={r.type}
                            onValueChange={(v) => updateRow(i, { type: (v as "EXPENSE" | "INCOME") ?? "EXPENSE", categoryId: "" })}
                            items={typeItems}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXPENSE">Expense</SelectItem>
                              <SelectItem value="INCOME">Income</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={r.paymentMode}
                            onValueChange={(v) => updateRow(i, { paymentMode: v ?? "BANK_TRANSFER" })}
                            items={paymentModeItems}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input value={r.description} onChange={(e) => updateRow(i, { description: e.target.value })} placeholder="Description" />
                        <Select
                          value={r.categoryId}
                          onValueChange={(v) => updateRow(i, { categoryId: v ?? "" })}
                          items={categoryItems}
                        >
                          <SelectTrigger className="w-full"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                          <SelectContent>
                            {relevantCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <DynamicIcon iconName={c.icon} className="size-3.5" style={{ color: c.color ?? undefined }} /> {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetAll}>Start Over</Button>
              <Button onClick={handleImport} disabled={includedCount === 0}>
                Import {includedCount} Transaction{includedCount === 1 ? "" : "s"}
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
