import { describe, expect, it } from "vitest";
import { computeTotals, normalizeCounts, createReport, remarkStats, type Counter } from "@/lib/tally";

const mk = (id: string, role: string | null): Counter => ({ id, name: id, description: "", color: "c1", position: 0, role });
const counters = [mk("r", "received"), mk("n", "not_received"), mk("w", "wrong"), mk("a", "admitted"), mk("i", "interested")];

describe("totals", () => {
  it("remarks calculate 30% unanswered and 20% abroad from 100 calls, with 10 interested entries", () => {
    const stats = remarkStats([
      { name: "Received", role: "received", count: 70 },
      { name: "Not received", role: "not_received", count: 30 },
      { name: "Another college", role: null, count: 40 },
      { name: "Abroad or out of town", role: null, count: 20 },
      { name: "Interested", role: "interested", count: 10 },
    ]);
    expect(stats.dialed).toBe(100);
    expect(stats.notReceivedPercentage).toBe(30);
    expect(stats.subcategories.find((c) => c.name === "Abroad or out of town")?.percentage).toBe(20);
    expect(stats.subcategories.find((c) => c.role === "interested")?.count).toBe(10);
    expect(stats.subcategories[0]?.name).toBe("Another college");
  });
  it("remarks omit undefined percentages when only subcategories were recorded", () => {
    expect(remarkStats([{ name: "Interested", role: "interested", count: 10 }]).subcategories[0]?.percentage).toBeNull();
  });
  it("reports snapshot descriptions and remarks independently of later changes", () => {
    const cs = [{ ...mk("i", "interested"), description: "Will visit college in a few days" }];
    const report = createReport("2026-10-27", cs, { i: 10 }, []);
    const originalRemarks = report.remarks;
    cs[0]!.description = "Changed detail";
    expect(report.counters[0]?.description).toBe("Will visit college in a few days");
    expect(report.remarks).toBe(originalRemarks);
    expect(report.remarks).toBeDefined();
  });
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

import { buildGoogleFormUrl as _buildUrl } from "@/lib/tally";
describe("google form prefill", () => {
  it("maps dialed and connected totals to the form entries", () => {
    const cs = [
      { id: "a", name: "Received", description: "", color: "blue", position: 0, role: "received" },
      { id: "b", name: "Not received", description: "", color: "red", position: 1, role: "not_received" },
      { id: "c", name: "Not interested", description: "", color: "red", position: 2, role: "not_interested" },
    ];
    const url = new URL(_buildUrl("Aayush", cs, { a: 4, b: 6, c: 2 }, []));
    expect(url.searchParams.get("entry.832632953")).toBe("10");
    expect(url.searchParams.get("entry.200805351")).toBe("4");
    expect(url.searchParams.get("entry.2095609115")).toBe("2");
    expect(url.searchParams.get("entry.1730418201")).toBe("Aayush");
  });
});
