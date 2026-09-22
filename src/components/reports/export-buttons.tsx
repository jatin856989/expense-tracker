"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getMonthlyReportData } from "@/lib/actions/reports";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import { CARD_TYPE_LABELS, ACCOUNT_TYPE_LABELS, INSTRUMENT_TYPE_LABELS, LOAN_STATUS_LABELS, PAYMENT_MODE_LABELS } from "@/lib/constants";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ month, year }: { month: number; year: number }) {
  const [exportingExcel, setExportingExcel] = React.useState(false);
  const [exportingPdf, setExportingPdf] = React.useState(false);

  async function handleExcelExport() {
    setExportingExcel(true);
    try {
      const data = await getMonthlyReportData(month, year);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Expense Tracker";
      workbook.created = new Date();

      const txSheet = workbook.addWorksheet("Transactions");
      txSheet.columns = [
        { header: "Date", key: "date", width: 12 },
        { header: "Type", key: "type", width: 10 },
        { header: "Description", key: "description", width: 30 },
        { header: "Category", key: "category", width: 18 },
        { header: "Payment Mode", key: "mode", width: 14 },
        { header: "Card", key: "card", width: 16 },
        { header: "Account", key: "account", width: 18 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Notes", key: "notes", width: 24 },
      ];
      for (const t of data.transactions) {
        txSheet.addRow({
          date: formatDate(t.date),
          type: t.type,
          description: t.description,
          category: t.category?.name ?? "",
          mode: PAYMENT_MODE_LABELS[t.paymentMode],
          card: t.card?.name ?? "",
          account: t.bankAccount?.name ?? "",
          amount: t.amount,
          notes: t.notes ?? "",
        });
      }
      txSheet.getRow(1).font = { bold: true };

      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.columns = [{ header: "Metric", key: "metric", width: 28 }, { header: "Value", key: "value", width: 20 }];
      summarySheet.addRows([
        { metric: "Period", value: monthLabel(month, year) },
        { metric: "Total Income", value: data.totalIncome },
        { metric: "Total Expense", value: data.totalExpense },
        { metric: "Net Savings", value: data.netSavings },
      ]);
      summarySheet.getRow(1).font = { bold: true };

      const categorySheet = workbook.addWorksheet("Category Breakdown");
      categorySheet.columns = [{ header: "Category", key: "name", width: 22 }, { header: "Amount", key: "amount", width: 16 }];
      for (const c of data.categoryBreakdown) categorySheet.addRow({ name: c.name, amount: c.amount });
      categorySheet.getRow(1).font = { bold: true };

      const cardsSheet = workbook.addWorksheet("Cards");
      cardsSheet.columns = [{ header: "Card", key: "name", width: 20 }, { header: "Type", key: "type", width: 14 }, { header: "This Month Spend", key: "spend", width: 18 }];
      for (const c of data.cardSummary) cardsSheet.addRow({ name: c.name, type: CARD_TYPE_LABELS[c.type], spend: c.monthSpend });
      cardsSheet.getRow(1).font = { bold: true };

      const accountsSheet = workbook.addWorksheet("Accounts");
      accountsSheet.columns = [{ header: "Account", key: "name", width: 22 }, { header: "Type", key: "type", width: 14 }, { header: "Balance", key: "balance", width: 16 }];
      for (const a of data.accountSummary) accountsSheet.addRow({ name: a.name, type: ACCOUNT_TYPE_LABELS[a.type], balance: a.balance });
      accountsSheet.getRow(1).font = { bold: true };

      const portfolioSheet = workbook.addWorksheet("Portfolio");
      portfolioSheet.columns = [
        { header: "Name", key: "name", width: 24 }, { header: "Platform", key: "platform", width: 16 },
        { header: "Type", key: "type", width: 14 }, { header: "Invested", key: "invested", width: 14 },
        { header: "Current Value", key: "current", width: 14 }, { header: "Gain/Loss", key: "gain", width: 14 },
        { header: "Gain %", key: "gainPercent", width: 12 },
      ];
      for (const i of data.investmentSummary) {
        portfolioSheet.addRow({
          name: i.name, platform: i.platform, type: INSTRUMENT_TYPE_LABELS[i.instrumentType],
          invested: i.invested, current: i.current, gain: i.gain, gainPercent: Number(i.gainPercent.toFixed(2)),
        });
      }
      portfolioSheet.getRow(1).font = { bold: true };

      const loansSheet = workbook.addWorksheet("Loans");
      loansSheet.columns = [
        { header: "Person", key: "person", width: 20 }, { header: "Type", key: "type", width: 12 },
        { header: "Amount", key: "amount", width: 14 }, { header: "Repaid", key: "repaid", width: 14 },
        { header: "Outstanding", key: "outstanding", width: 14 }, { header: "Status", key: "status", width: 18 },
      ];
      for (const l of data.loanSummary) {
        loansSheet.addRow({
          person: l.person, type: l.type === "LENT" ? "Lent" : "Borrowed", amount: l.amount,
          repaid: l.repaid, outstanding: l.outstanding, status: LOAN_STATUS_LABELS[l.status],
        });
      }
      loansSheet.getRow(1).font = { bold: true };

      if (data.budgetSummary.length > 0) {
        const budgetSheet = workbook.addWorksheet("Budgets");
        budgetSheet.columns = [
          { header: "Category", key: "category", width: 20 }, { header: "Limit", key: "limit", width: 14 },
          { header: "Spend", key: "spend", width: 14 }, { header: "% Used", key: "percent", width: 12 },
        ];
        for (const b of data.budgetSummary) budgetSheet.addRow({ category: b.category, limit: b.limit, spend: b.spend, percent: Number(b.percent.toFixed(1)) });
        budgetSheet.getRow(1).font = { bold: true };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `expense-report-${year}-${String(month).padStart(2, "0")}.xlsx`
      );
      toast.success("Excel report downloaded.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't generate the Excel report.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handlePdfExport() {
    setExportingPdf(true);
    try {
      const data = await getMonthlyReportData(month, year);
      const { jsPDF } = await import("jspdf");
      const { autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const title = `Monthly Financial Slip — ${monthLabel(month, year)}`;
      doc.setFontSize(16);
      doc.text(title, 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated ${formatDate(new Date())}`, 14, 24);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 30,
        head: [["Metric", "Amount"]],
        body: [
          ["Total Income", formatCurrency(data.totalIncome)],
          ["Total Expense", formatCurrency(data.totalExpense)],
          ["Net Savings", formatCurrency(data.netSavings)],
        ],
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
      });

      const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.text("Expense by Category", 14, afterSummary);
      autoTable(doc, {
        startY: afterSummary + 4,
        head: [["Category", "Amount"]],
        body: data.categoryBreakdown.map((c) => [c.name, formatCurrency(c.amount)]),
        theme: "striped",
        headStyles: { fillColor: [239, 68, 68] },
      });

      if (data.loanSummary.length > 0) {
        const afterCategory = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.text("Loans", 14, afterCategory);
        autoTable(doc, {
          startY: afterCategory + 4,
          head: [["Person", "Type", "Outstanding"]],
          body: data.loanSummary.map((l) => [l.person, l.type === "LENT" ? "Lent" : "Borrowed", formatCurrency(l.outstanding)]),
          theme: "striped",
          headStyles: { fillColor: [20, 184, 166] },
        });
      }

      doc.save(`monthly-slip-${year}-${String(month).padStart(2, "0")}.pdf`);
      toast.success("PDF slip downloaded.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't generate the PDF slip.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exportingExcel}>
        {exportingExcel ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export Excel
      </Button>
      <Button variant="outline" size="sm" onClick={handlePdfExport} disabled={exportingPdf}>
        {exportingPdf ? <Loader2 className="animate-spin" /> : <FileText />} Download PDF Slip
      </Button>
    </div>
  );
}
