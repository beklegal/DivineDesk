import type { Church, ChurchBranch, ChurchEvent, Donation, Member } from "@shared/api";
import { formatChurchCurrency } from "@/lib/currency";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

export type ReportId =
  | "member-directory"
  | "donation-summary"
  | "attendance"
  | "event-participation"
  | "ministry-growth"
  | "financial-health";

export type ReportFormat = "pdf" | "excel";

export interface ReportDefinition {
  id: ReportId;
  name: string;
  description: string;
  type: "Members" | "Finance" | "Attendance" | "Events";
}

export interface ChurchReportSource {
  members: Member[];
  donations: Donation[];
  events: ChurchEvent[];
}

interface PreparedReport {
  title: string;
  subtitle: string;
  filenameBase: string;
  summary: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
}

interface ReportContext extends ChurchReportSource {
  church: Church | null;
  branch: ChurchBranch | null;
  branches: ChurchBranch[];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "member-directory",
    name: "Member Directory Report",
    description: "Complete list of all church members with contact information",
    type: "Members",
  },
  {
    id: "donation-summary",
    name: "Donation Summary Report",
    description: "Monthly and yearly donation statistics by member",
    type: "Finance",
  },
  {
    id: "attendance",
    name: "Attendance Report",
    description: "Attendance trends and participation rates",
    type: "Attendance",
  },
  {
    id: "event-participation",
    name: "Event Participation Report",
    description: "Event attendance and engagement metrics",
    type: "Events",
  },
  {
    id: "ministry-growth",
    name: "Ministry Growth Report",
    description: "Growth trends by ministry group",
    type: "Members",
  },
  {
    id: "financial-health",
    name: "Financial Health Report",
    description: "Year-to-date financial overview",
    type: "Finance",
  },
];

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonth(value: string) {
  const parsed = new Date(`${value}-01T00:00:00`);
  return monthFormatter.format(parsed);
}

function formatCurrency(value: number) {
  return formatChurchCurrency(value || 0);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePdfText(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");

  return normalized
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}

function safeRows(columns: string[], rows: string[][]) {
  if (rows.length > 0) {
    return rows;
  }

  return [columns.map((_, index) => (index === 0 ? "No records available yet" : "-"))];
}

function getScopeLabel(branch?: ChurchBranch | null) {
  return branch ? `${branch.name} branch` : "All church records";
}

function getBranchName(branchId: string | undefined, branches: ChurchBranch[]) {
  return branches.find((branch) => branch.id === branchId)?.name ?? "Primary branch";
}

function buildFilenameBase(title: string, church: Church | null, branch?: ChurchBranch | null) {
  const scope = branch?.name ? `${church?.name ?? "church"}-${branch.name}` : church?.name ?? "church";
  const stamp = new Date().toISOString().slice(0, 10);
  return slugify(`${scope}-${title}-${stamp}`);
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function createMonthlySeries(donations: Donation[]) {
  const buckets = new Map<string, Donation[]>();

  donations.forEach((donation) => {
    const key = monthKey(donation.date);
    const bucket = buckets.get(key) ?? [];
    bucket.push(donation);
    buckets.set(key, bucket);
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, items]) => ({
      key,
      label: `${formatMonth(key)} ${key.slice(0, 4)}`,
      items,
    }));
}

function buildMemberDirectoryReport(context: ReportContext): PreparedReport {
  const rows = safeRows(
    ["Name", "Email", "Phone", "Branch", "Ministry", "Status", "Joined"],
    [...context.members]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((member) => [
        member.name,
        member.email,
        member.phone || "-",
        getBranchName(member.branchId, context.branches),
        member.ministryGroup || "General",
        member.status,
        formatDate(member.joinDate),
      ]),
  );

  const activeMembers = context.members.filter((member) => member.status === "active").length;
  const visitors = context.members.filter((member) => member.status === "visitor").length;

  return {
    title: "Member Directory Report",
    subtitle: `${getScopeLabel(context.branch)} with contact and ministry details.`,
    filenameBase: buildFilenameBase("member-directory-report", context.church, context.branch),
    summary: [
      { label: "Scope", value: getScopeLabel(context.branch) },
      { label: "Total members", value: context.members.length.toString() },
      { label: "Active members", value: activeMembers.toString() },
      { label: "Visitors", value: visitors.toString() },
    ],
    columns: ["Name", "Email", "Phone", "Branch", "Ministry", "Status", "Joined"],
    rows,
  };
}

function buildDonationSummaryReport(context: ReportContext): PreparedReport {
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const donationsByMember = new Map<string, Donation[]>();

  context.donations.forEach((donation) => {
    const bucket = donationsByMember.get(donation.memberId) ?? [];
    bucket.push(donation);
    donationsByMember.set(donation.memberId, bucket);
  });

  const rows = safeRows(
    ["Member", "Branch", "This month", "YTD total", "Gift count", "Last gift"],
    [...donationsByMember.entries()]
      .map(([memberId, donations]) => {
        const member = context.members.find((candidate) => candidate.id === memberId);
        const ytdDonations = donations.filter(
          (donation) => new Date(donation.date).getFullYear() === thisYear,
        );
        const monthTotal = ytdDonations
          .filter((donation) => monthKey(donation.date) === thisMonth)
          .reduce((total, donation) => total + donation.amount, 0);
        const ytdTotal = ytdDonations.reduce((total, donation) => total + donation.amount, 0);
        const latestDonation = [...donations].sort((left, right) => right.date.localeCompare(left.date))[0];

        return [
          member?.name ?? donations[0].memberName,
          getBranchName(member?.branchId ?? donations[0].branchId, context.branches),
          formatCurrency(monthTotal),
          formatCurrency(ytdTotal),
          donations.length.toString(),
          formatDate(latestDonation?.date),
        ];
      })
      .sort((left, right) => left[0].localeCompare(right[0])),
  );

  const totalGiving = context.donations.reduce((total, donation) => total + donation.amount, 0);
  const ytdGiving = context.donations
    .filter((donation) => new Date(donation.date).getFullYear() === thisYear)
    .reduce((total, donation) => total + donation.amount, 0);
  const largestGift = Math.max(...context.donations.map((donation) => donation.amount), 0);

  return {
    title: "Donation Summary Report",
    subtitle: `Monthly and year-to-date giving by member for ${getScopeLabel(context.branch).toLowerCase()}.`,
    filenameBase: buildFilenameBase("donation-summary-report", context.church, context.branch),
    summary: [
      { label: "Scope", value: getScopeLabel(context.branch) },
      { label: "All-time giving", value: formatCurrency(totalGiving) },
      { label: "Year-to-date giving", value: formatCurrency(ytdGiving) },
      { label: "Largest single gift", value: formatCurrency(largestGift) },
    ],
    columns: ["Member", "Branch", "This month", "YTD total", "Gift count", "Last gift"],
    rows,
  };
}

function buildAttendanceReport(context: ReportContext): PreparedReport {
  const attendanceCounts = context.events.map((event) => event.registeredAttendees || 0);
  const totalAttendance = attendanceCounts.reduce((total, value) => total + value, 0);
  const averageAttendance =
    attendanceCounts.length > 0
      ? Math.round(totalAttendance / attendanceCounts.length)
      : 0;
  const highestTurnout = Math.max(...attendanceCounts, 0);

  const rows = safeRows(
    ["Event", "Date", "Branch", "Type", "Attendance", "Participation"],
    [...context.events]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((event) => [
        event.name,
        formatDate(event.date),
        getBranchName(event.branchId, context.branches),
        event.type,
        event.registeredAttendees.toString(),
        event.maxAttendees
          ? `${Math.round((event.registeredAttendees / event.maxAttendees) * 100)}%`
          : "n/a",
      ]),
  );

  return {
    title: "Attendance Report",
    subtitle: `Attendance trends and participation rates for ${getScopeLabel(context.branch).toLowerCase()}.`,
    filenameBase: buildFilenameBase("attendance-report", context.church, context.branch),
    summary: [
      { label: "Scope", value: getScopeLabel(context.branch) },
      { label: "Tracked events", value: context.events.length.toString() },
      { label: "Average attendance", value: averageAttendance.toString() },
      { label: "Highest turnout", value: highestTurnout.toString() },
    ],
    columns: ["Event", "Date", "Branch", "Type", "Attendance", "Participation"],
    rows,
  };
}

function buildEventParticipationReport(context: ReportContext): PreparedReport {
  const scheduledEvents = context.events.filter((event) => event.status === "scheduled").length;
  const completedEvents = context.events.filter((event) => event.status === "completed").length;
  const totalRegistrations = context.events.reduce(
    (total, event) => total + event.registeredAttendees,
    0,
  );

  const rows = safeRows(
    ["Event", "Date", "Branch", "Location", "Status", "Registrations"],
    [...context.events]
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => [
        event.name,
        formatDate(event.date),
        getBranchName(event.branchId, context.branches),
        event.location,
        event.status,
        `${event.registeredAttendees}${event.maxAttendees ? ` / ${event.maxAttendees}` : ""}`,
      ]),
  );

  return {
    title: "Event Participation Report",
    subtitle: `Attendance and engagement metrics across events for ${getScopeLabel(context.branch).toLowerCase()}.`,
    filenameBase: buildFilenameBase("event-participation-report", context.church, context.branch),
    summary: [
      { label: "Scope", value: getScopeLabel(context.branch) },
      { label: "Scheduled events", value: scheduledEvents.toString() },
      { label: "Completed events", value: completedEvents.toString() },
      { label: "Total registrations", value: totalRegistrations.toString() },
    ],
    columns: ["Event", "Date", "Branch", "Location", "Status", "Registrations"],
    rows,
  };
}

function buildMinistryGrowthReport(context: ReportContext): PreparedReport {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const ministryGroups = new Map<string, Member[]>();

  context.members.forEach((member) => {
    const bucket = ministryGroups.get(member.ministryGroup || "General") ?? [];
    bucket.push(member);
    ministryGroups.set(member.ministryGroup || "General", bucket);
  });

  const rows = safeRows(
    ["Ministry", "Members", "Active", "Visitors", "Joined in 90 days"],
    [...ministryGroups.entries()]
      .map(([group, members]) => [
        group,
        members.length.toString(),
        members.filter((member) => member.status === "active").length.toString(),
        members.filter((member) => member.status === "visitor").length.toString(),
        members
          .filter((member) => new Date(member.joinDate).getTime() >= ninetyDaysAgo)
          .length.toString(),
      ])
      .sort((left, right) => right[1].localeCompare(left[1], undefined, { numeric: true })),
  );

  const largestGroup = rows[0]?.[0] ?? "-";

  return {
    title: "Ministry Growth Report",
    subtitle: `Growth trends by ministry group for ${getScopeLabel(context.branch).toLowerCase()}.`,
    filenameBase: buildFilenameBase("ministry-growth-report", context.church, context.branch),
    summary: [
      { label: "Scope", value: getScopeLabel(context.branch) },
      { label: "Tracked ministries", value: ministryGroups.size.toString() },
      { label: "Largest ministry", value: largestGroup },
      {
        label: "Recent joins",
        value: context.members
          .filter((member) => new Date(member.joinDate).getTime() >= ninetyDaysAgo)
          .length.toString(),
      },
    ],
    columns: ["Ministry", "Members", "Active", "Visitors", "Joined in 90 days"],
    rows,
  };
}

function buildFinancialHealthReport(context: ReportContext): PreparedReport {
  const monthlySeries = createMonthlySeries(context.donations);
  const rows = safeRows(
    ["Month", "Gift count", "Total giving", "Average gift", "Tithes", "Offerings"],
    monthlySeries.map((bucket) => {
      const total = bucket.items.reduce((sum, donation) => sum + donation.amount, 0);
      const tithes = bucket.items
        .filter((donation) => donation.type === "tithe")
        .reduce((sum, donation) => sum + donation.amount, 0);
      const offerings = bucket.items
        .filter((donation) => donation.type === "offering")
        .reduce((sum, donation) => sum + donation.amount, 0);

      return [
        bucket.label,
        bucket.items.length.toString(),
        formatCurrency(total),
        formatCurrency(bucket.items.length ? total / bucket.items.length : 0),
        formatCurrency(tithes),
        formatCurrency(offerings),
      ];
    }),
  );

  const ytdGiving = context.donations.reduce((sum, donation) => sum + donation.amount, 0);
  const bestMonth = monthlySeries
    .map((bucket) => ({
      label: bucket.label,
      total: bucket.items.reduce((sum, donation) => sum + donation.amount, 0),
    }))
    .sort((left, right) => right.total - left.total)[0];

  return {
    title: "Financial Health Report",
    subtitle: `Year-to-date financial overview for ${getScopeLabel(context.branch).toLowerCase()}.`,
    filenameBase: buildFilenameBase("financial-health-report", context.church, context.branch),
    summary: [
      { label: "Scope", value: getScopeLabel(context.branch) },
      { label: "Total giving", value: formatCurrency(ytdGiving) },
      {
        label: "Average monthly giving",
        value: formatCurrency(monthlySeries.length ? ytdGiving / monthlySeries.length : 0),
      },
      { label: "Strongest month", value: bestMonth ? `${bestMonth.label} (${formatCurrency(bestMonth.total)})` : "-" },
    ],
    columns: ["Month", "Gift count", "Total giving", "Average gift", "Tithes", "Offerings"],
    rows,
  };
}

function prepareReport(reportId: ReportId, context: ReportContext) {
  switch (reportId) {
    case "member-directory":
      return buildMemberDirectoryReport(context);
    case "donation-summary":
      return buildDonationSummaryReport(context);
    case "attendance":
      return buildAttendanceReport(context);
    case "event-participation":
      return buildEventParticipationReport(context);
    case "ministry-growth":
      return buildMinistryGrowthReport(context);
    case "financial-health":
      return buildFinancialHealthReport(context);
    default:
      throw new Error("Unsupported report");
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildExcelDocument(report: PreparedReport) {
  const summaryRows = report.summary
    .map(
      (item) =>
        `<tr><th style="text-align:left;padding:8px 12px;background:#f8fafc;border:1px solid #dbeafe;">${escapeHtml(item.label)}</th><td style="padding:8px 12px;border:1px solid #dbeafe;">${escapeHtml(item.value)}</td></tr>`,
    )
    .join("");
  const headerRow = report.columns
    .map(
      (column) =>
        `<th style="padding:8px 12px;background:#0f172a;color:#ffffff;border:1px solid #cbd5e1;text-align:left;">${escapeHtml(column)}</th>`,
    )
    .join("");
  const bodyRows = safeRows(report.columns, report.rows)
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    <p>${escapeHtml(report.subtitle)}</p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0 24px 0;">
      ${summaryRows}
    </table>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  </body>
</html>`;
}

function padCell(value: string, width: number) {
  const trimmed = value.length > width ? `${value.slice(0, Math.max(width - 3, 1))}...` : value;
  return trimmed.padEnd(width, " ");
}

function buildTableLines(report: PreparedReport) {
  const rows = safeRows(report.columns, report.rows);
  const widths = report.columns.map((column, index) =>
    Math.min(
      16,
      Math.max(
        column.length,
        ...rows.map((row) => (row[index] ?? "").toString().length),
      ),
    ),
  );

  const header = report.columns
    .map((column, index) => padCell(column, widths[index]))
    .join(" | ");
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");
  const body = rows.map((row) =>
    row.map((cell, index) => padCell(cell, widths[index])).join(" | "),
  );

  return [header, separator, ...body];
}

function buildPdfPages(report: PreparedReport) {
  const generatedLine = `Generated: ${new Date().toLocaleString()}`;
  const summaryLines = report.summary.map((item) => `${item.label}: ${item.value}`);
  const tableLines = buildTableLines(report);
  const pages: string[][] = [];
  let cursor = 0;
  const firstPageCapacity = 34;
  const continuedPageCapacity = 48;

  while (cursor < tableLines.length || pages.length === 0) {
    const isFirstPage = pages.length === 0;
    const capacity = isFirstPage ? firstPageCapacity : continuedPageCapacity;
    const prefix = isFirstPage
      ? [report.title, report.subtitle, generatedLine, "", ...summaryLines, "", ...tableLines.slice(0, 2)]
      : [`${report.title} (continued)`, generatedLine, "", ...tableLines.slice(0, 2)];
    const chunkStart = isFirstPage ? 2 : 2;
    const chunk = tableLines.slice(cursor + chunkStart, cursor + chunkStart + capacity);

    if (isFirstPage) {
      cursor += capacity;
    } else {
      cursor += capacity;
    }

    pages.push([...prefix, ...chunk]);
    if (isFirstPage && tableLines.length <= capacity + 2) {
      break;
    }

    if (!isFirstPage && chunk.length === 0) {
      break;
    }
  }

  return pages;
}

function buildPdfBlob(report: PreparedReport) {
  const pages = buildPdfPages(report);
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const pagesObjectId = addObject("");
  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pageObjectIds: number[] = [];

  pages.forEach((lines) => {
    const content = [
      "BT",
      "/F1 8 Tf",
      "50 790 Td",
      "11 TL",
      ...lines.flatMap((line, index) =>
        index === 0
          ? [`(${escapePdfText(line)}) Tj`]
          : ["T*", `(${escapePdfText(line)}) Tj`],
      ),
      "ET",
    ].join("\n");
    const contentObjectId = addObject(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    pageObjectIds.push(pageObjectId);
  });

  objects[pagesObjectId - 1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export async function fetchChurchReportSource(token: string): Promise<ChurchReportSource> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const [membersResponse, donationsResponse, eventsResponse] = await Promise.all([
    fetch("/api/members", { headers }),
    fetch("/api/donations", { headers }),
    fetch("/api/events", { headers }),
  ]);

  const responses = [membersResponse, donationsResponse, eventsResponse];
  const failedResponse = responses.find((response) => !response.ok);

  if (failedResponse) {
    throw new Error("Failed to load report data");
  }

  const [membersPayload, donationsPayload, eventsPayload] = await Promise.all(
    responses.map((response) => response.json()),
  );

  return {
    members: membersPayload.data || [],
    donations: donationsPayload.data || [],
    events: eventsPayload.data || [],
  };
}

export function exportChurchReport(options: {
  reportId: ReportId;
  format: ReportFormat;
  church: Church | null;
  branch: ChurchBranch | null;
  branches: ChurchBranch[];
  data: ChurchReportSource;
}) {
  const report = prepareReport(options.reportId, {
    church: options.church,
    branch: options.branch,
    branches: options.branches,
    members: options.data.members,
    donations: options.data.donations,
    events: options.data.events,
  });

  if (options.format === "excel") {
    const document = buildExcelDocument(report);
    downloadBlob(
      new Blob(["\ufeff", document], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      }),
      `${report.filenameBase}.xls`,
    );
    return;
  }

  downloadBlob(buildPdfBlob(report), `${report.filenameBase}.pdf`);
}
