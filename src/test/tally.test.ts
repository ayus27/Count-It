import { describe, expect, it } from "vitest";
import { computeTotals, type Counter } from "@/lib/tally";

const mk = (id: string, role: string | null): Counter => ({ id, name: id, description: "", color: "c1", position: 0, role });
const counters = [mk("r", "received"), mk("n", "not_received"), mk("w", "wrong"), mk("a", "admitted"), mk("i", "interested")];

describe("totals", () => {
  it("calls dialed = received + not received + wrong", () => {
    expect(computeTotals(counters, { r: 3, n: 2, w: 1, a: 9 }).dialed).toBe(6);
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
