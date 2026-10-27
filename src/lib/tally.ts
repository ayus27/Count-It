export type Role = "received" | "not_received" | "wrong" | "admitted" | "interested" | "callback";

export type Counter = {
  id: string;
  name: string;
  description: string;
  color: string;
  position: number;
  role: string | null;
  archived?: boolean;
};

export const DEFAULT_COUNTERS: { name: string; description: string; color: string; role: Role }[] = [
  { name: "Received", description: "Customer picked up", color: "c1", role: "received" },
  { name: "Not received", description: "No answer, busy, switched off", color: "c2", role: "not_received" },
  { name: "Wrong number", description: "Wrong person or number not in use", color: "c3", role: "wrong" },
  { name: "Admitted", description: "Confirmed admission", color: "c4", role: "admitted" },
  { name: "Interested", description: "Wants more details", color: "c5", role: "interested" },
  { name: "Call back", description: "Asked to be called later", color: "c6", role: "callback" },
];

export const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];

export function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computeTotals(counters: Counter[], counts: Record<string, number>) {
  const byRole = (r: Role) =>
    counters.filter((c) => c.role === r).reduce((s, c) => s + (counts[c.id] ?? 0), 0);
  const received = byRole("received");
  const dialed = received + byRole("not_received");
  return {
    dialed,
    pickup: pct(received, dialed),
    admitted: pct(byRole("admitted"), received),
    interested: pct(byRole("interested"), received),
  };
}

export function normalizeCounts(counters: Counter[], counts: Record<string, number>) {
  const normalized = { ...counts };
  for (const counter of counters.filter((c) => c.archived && c.role)) {
    const active = counters.find((c) => !c.archived && c.role === counter.role);
    if (!active) continue;
    normalized[active.id] = (normalized[active.id] ?? 0) + (normalized[counter.id] ?? 0);
    delete normalized[counter.id];
  }
  return normalized;
}

export type Visitor = { name: string; at: string };
export type DailyReport = {
  day: string;
  counters: { name: string; description?: string; role: string | null; count: number }[];
  visitors: Visitor[];
  totals: ReturnType<typeof computeTotals>;
  remarks?: string;
};

export function remarkStats(counters: DailyReport["counters"]) {
  const totalFor = (role: string) => counters.filter((c) => c.role === role).reduce((sum, c) => sum + c.count, 0);
  const received = totalFor("received");
  const notReceived = totalFor("not_received");
  const dialed = received + notReceived;
  const subcategories = counters.filter((c) => c.role !== "received" && c.role !== "not_received" && c.count > 0)
    .map((c) => ({ ...c, percentage: dialed > 0 ? pct(c.count, dialed) : null }))
    .sort((a, b) => b.count - a.count);
  return { received, notReceived, dialed, notReceivedPercentage: dialed > 0 ? pct(notReceived, dialed) : null, subcategories };
}

export function generateRemarks(counters: DailyReport["counters"]) {
  const stats = remarkStats(counters);
  if (stats.dialed === 0 && stats.subcategories.length === 0) return "No calls or subcategory outcomes recorded today.";
  const lines: string[] = [];
  if (stats.dialed > 0) {
    lines.push(`Of ${stats.dialed} calls dialed, ${stats.received} were received and ${stats.notReceived} were not received (${stats.notReceivedPercentage}% of calls dialed).`);
  } else {
    lines.push("No received or not-received calls were recorded; subcategory percentages are unavailable.");
  }
  const top = stats.subcategories[0];
  if (top) {
    const leaders = stats.subcategories.filter((c) => c.count === top.count);
    lines.push(`The most frequently recorded ${leaders.length > 1 ? "subcategories were" : "subcategory was"} ${leaders.map((c) => `“${c.name}”`).join(" and ")}.`);
  }
  for (const c of stats.subcategories) {
    const share = c.percentage === null ? "" : ` (${c.percentage}% of calls dialed)`;
    lines.push(`${c.count} ${c.count === 1 ? "entry was" : "entries were"} recorded as “${c.name}”${share}.${c.description?.trim() ? ` Recorded detail: ${c.description.trim().replace(/[.!?]+$/, "")}.` : ""}`);
  }
  if (stats.subcategories.length > 0) lines.push("Subcategory entries may overlap and do not represent unique students.");
  return lines.join(" ");
}

export function createReport(day: string, counters: Counter[], counts: Record<string, number>, visitors: Visitor[]): DailyReport {
  const entries = counters.map((c) => ({ name: c.name, description: c.description, role: c.role, count: counts[c.id] ?? 0 }));
  return { day, counters: entries, visitors: visitors.map((v) => ({ ...v })), totals: computeTotals(counters, counts), remarks: generateRemarks(entries) };
}

export function reportText(report: DailyReport) {
  return [`Call report — ${report.day}`, ...report.counters.map((c) => `${c.name}: ${c.count}`), `Calls dialed: ${report.totals.dialed}`, `Pick-up rate: ${report.totals.pickup}%`, `Admitted: ${report.totals.admitted}%`, `Interested: ${report.totals.interested}%`, "", "Daily remarks:", report.remarks ?? generateRemarks(report.counters), "", "Interested visitors:", ...(report.visitors.length ? report.visitors.map((v, i) => `${i + 1}. ${v.name} (${v.at})`) : ["None"])].join("\n");
}

export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
