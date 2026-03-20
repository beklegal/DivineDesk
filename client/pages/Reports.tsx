import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchWorkspace } from "@/hooks/useChurchWorkspace";
import {
  exportChurchReport,
  fetchChurchReportSource,
  REPORT_DEFINITIONS,
  type ReportFormat,
  type ReportId,
} from "@/lib/reporting";

const reportIcons = {
  Members: Users,
  Finance: Wallet,
  Attendance: CalendarDays,
  Events: BarChart3,
} as const;

export default function Reports() {
  const { branch, church, token } = useAuth();
  const { branches } = useChurchWorkspace({ enabled: Boolean(token) });
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (reportId: ReportId, format: ReportFormat) => {
    if (!token) {
      setError("You need to be signed in before downloading reports.");
      return;
    }

    const downloadKey = `${reportId}:${format}`;
    setActiveDownload(downloadKey);
    setError(null);

    try {
      const data = await fetchChurchReportSource(token);

      exportChurchReport({
        reportId,
        format,
        church,
        branch,
        branches,
        data,
      });
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Failed to generate the selected report",
      );
    } finally {
      setActiveDownload(null);
    }
  };

  return (
    <AppShell
      title="Reports & analytics"
      description="Generate live exports from your church data, including members, giving, attendance, event participation, ministry growth, and financial health."
      icon={BarChart3}
      eyebrow="Export center"
      actions={
        <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-200">
          {branch
            ? `Downloads are scoped to ${branch.name}.`
            : "Downloads include all branches in this church workspace."}
        </div>
      }
    >
      {error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Available reports</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{REPORT_DEFINITIONS.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            Church admins can download each report as PDF or Excel.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current scope</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {branch?.name ?? church?.name ?? "Church workspace"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Branch-admin exports stay limited to the signed-in branch automatically.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Formats</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">PDF and Excel</p>
          <p className="mt-2 text-sm text-slate-500">
            Each export uses the latest live members, donations, and events already stored in the system.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_DEFINITIONS.map((report) => {
          const Icon = reportIcons[report.type];
          const pdfKey = `${report.id}:pdf`;
          const excelKey = `${report.id}:excel`;

          return (
            <div
              key={report.id}
              className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {report.type}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-semibold text-slate-950">{report.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">{report.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => handleExport(report.id, "pdf")}
                  disabled={activeDownload !== null}
                  className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                >
                  {activeDownload === pdfKey ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleExport(report.id, "excel")}
                  disabled={activeDownload !== null}
                  className="h-11 rounded-2xl border-slate-300"
                >
                  {activeDownload === excelKey ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Excel
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Automatic reports</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              On-demand downloads are live now. If you want, the next step can be scheduled weekly or monthly delivery by email for finance, attendance, and membership summaries.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Download className="mr-2 inline h-4 w-4" />
            Export whenever you need it
          </div>
        </div>
      </section>
    </AppShell>
  );
}
