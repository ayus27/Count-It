import { describe, expect, it } from "vitest";
import { computeTotals, normalizeCounts, createReport, type Counter } from "@/lib/tally";

const mk = (id: string, role: string | null): Counter => ({ id, name: id, description: "", color: "c1", position: 0, role });
const counters = [mk("r", "received"), mk("n", "not_received"), mk("w", "wrong"), mk("a", "admitted"), mk("i", "interested")];

describe("totals", () => {
  it("calls dialed = received + not received only", () => {
    expect(computeTotals(counters, { r: 3, n: 2, w: 1, a: 9, i: 4 }).dialed).toBe(5);
  });
  it("changing either main counter changes dialed totals", () => {
    expect(computeTotals(counters, { r: 4, n: 2 }).dialed).toBe(6);
    expect(computeTotals(counters, { r: 3, n: 1 }).dialed).toBe(4);
  });
  it("changing shared subcategories does not change dialed totals", () => {
    expect(computeTotals(counters, { r: 3, n: 2, w: 20, a: 10, i: 30 }).dialed).toBe(5);
    expect(computeTotals(counters, { r: 3, n: 2, w: 0, a: 0, i: 0 }).dialed).toBe(5);
  });
  it("combines duplicate counts once without losing them", () => {
    const cs = [mk("r", "received"), { ...mk("duplicate", "received"), archived: true }];
    const normalized = normalizeCounts(cs, { r: 3, duplicate: 2 });
    expect(normalized).toEqual({ r: 5 });
    expect(normalizeCounts(cs, normalized)).toEqual({ r: 5 });
  });
  it("saved reports preserve the day's counts and names after later edits", () => {
    const counts = { r: 3, n: 2, w: 8 };
    const report = createReport("2026-10-27", counters, counts, [{ name: "Aayush", at: "09:47" }]);
    counts.r = 10;
    expect(report.day).toBe("2026-10-27");
    expect(report.totals.dialed).toBe(5);
    expect(report.counters[0]?.count).toBe(3);
    expect(report.visitors[0]?.name).toBe("Aayush");
  });
  it("pick-up rate is received / dialed", () => {
    expect(computeTotals(counters, { r: 1, n: 3 }).pickup).toBe(25);
  });
  it("admitted and interested % are over received", () => {
    const t = computeTotals(counters, { r: 4, a: 1, i: 2 });
    expect(t.admitted).toBe(25);
    expect(t.interested).toBe(50);
  });
  it("shows 0% when divisor is 0", () => {
    const t = computeTotals(counters, { a: 2 });
    expect([t.pickup, t.admitted, t.interested]).toEqual([0, 0, 0]);
  });
});
