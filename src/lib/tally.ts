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
  counters: { name: string; role: string | null; count: number }[];
  visitors: Visitor[];
  totals: ReturnType<typeof computeTotals>;
};

export function createReport(day: string, counters: Counter[], counts: Record<string, number>, visitors: Visitor[]): DailyReport {
  return { day, counters: counters.map((c) => ({ name: c.name, role: c.role, count: counts[c.id] ?? 0 })), visitors: visitors.map((v) => ({ ...v })), totals: computeTotals(counters, counts) };
}

export function reportText(report: DailyReport) {
  return [`Call report — ${report.day}`, ...report.counters.map((c) => `${c.name}: ${c.count}`), `Calls dialed: ${report.totals.dialed}`, `Pick-up rate: ${report.totals.pickup}%`, `Admitted: ${report.totals.admitted}%`, `Interested: ${report.totals.interested}%`, "", "Interested visitors:", ...(report.visitors.length ? report.visitors.map((v, i) => `${i + 1}. ${v.name} (${v.at})`) : ["None"])].join("\n");
}

export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
