export type Role = "received" | "not_received" | "wrong" | "admitted" | "interested" | "callback";

export type Counter = {
  id: string;
  name: string;
  description: string;
  color: string;
  position: number;
  role: string | null;
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
  const dialed = received + byRole("not_received") + byRole("wrong");
  return {
    dialed,
    pickup: pct(received, dialed),
    admitted: pct(byRole("admitted"), received),
    interested: pct(byRole("interested"), received),
  };
}

export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
