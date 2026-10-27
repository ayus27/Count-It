import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Json } from "@/integrations/supabase/types";
import { COLORS, computeTotals, todayKey, normalizeCounts, createReport, reportText, type Counter, type Visitor, type DailyReport } from "@/lib/tally";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Call Tally — daily call counter" },
      { name: "description", content: "Count received, missed and interested calls with big tap buttons. Saved to your account." },
      { property: "og:title", content: "Call Tally — daily call counter" },
      { property: "og:description", content: "Count your daily calls with big tap buttons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const btn = "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none";
const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
const btnOutline = `${btn} border border-input bg-card hover:bg-accent`;
const input = "w-full rounded-md border border-input bg-card px-3 py-2 text-base";

function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="min-h-screen" />;
  if (!session) return <AuthCard />;
  return <Tally key={session.user.id} userId={session.user.id} email={session.user.email ?? ""} />;
}

function AuthCard() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account.");
    }
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Call Tally</h1>
      <ThemeToggle />
      <p className="text-sm text-muted-foreground">Sign in to save your counters in the cloud.</p>
      <Button variant="ghost"
        className={`${btnOutline} h-12`}
        onClick={async () => {
          const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
          if (r.error) setMsg(String(r.error.message ?? r.error));
        }}
      >
        Continue with Google
      </Button>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button variant="ghost" className={`${btnPrimary} h-12`} type="submit">{mode === "in" ? "Sign in" : "Create account"}</Button>
      </form>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <Button variant="ghost" className="text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
      </Button>
    </main>
  );
}

type SavedReport = { day: string; report: DailyReport; savedAt: string };

function Tally({ userId, email }: { userId: string; email: string }) {
  const day = useMemo(() => todayKey(), []);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveState, setSaveState] = useState("Saved");
  const skipSave = useRef(true);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [view, setView] = useState<"today" | "reports">("today");
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportSaving, setReportSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { error: initError } = await supabase.rpc("initialize_counters");
        if (initError) throw initError;
        const [{ data: cs, error: countersError }, { data: d, error: dayError }, { data: reports, error: reportError }] = await Promise.all([
          supabase.from("counters").select("*").eq("user_id", userId).order("position").order("created_at"),
          supabase.from("tally_days").select("*").eq("user_id", userId).eq("day", day).maybeSingle(),
          supabase.from("tally_days").select("day, report, report_saved_at").eq("user_id", userId).not("report", "is", null).order("day", { ascending: false }),
        ]);
        if (countersError || dayError || reportError) throw countersError ?? dayError ?? reportError;
        if (cancelled) return;
        setCounters((cs ?? []).filter((c) => !c.archived));
        setCounts(normalizeCounts(cs ?? [], (d?.counts as Record<string, number>) ?? {}));
        setVisitors((d?.visitors as Visitor[]) ?? []);
        setHistory((reports ?? []).map((r) => ({ day: r.day, report: r.report as unknown as DailyReport, savedAt: r.report_saved_at ?? "" })));
        setLoaded(true);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load your counters. Please refresh.");
      }
    })();
    return () => { cancelled = true; };
  }, [userId, day]);

  // auto-save today's counts
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    setSaveState("Saving…");
    const t = setTimeout(async () => {
      saveQueue.current = saveQueue.current.then(async () => {
        const { error } = await supabase.from("tally_days")
          .upsert({ user_id: userId, day, counts, visitors, updated_at: new Date().toISOString() });
        setSaveState(error ? "Not saved — check connection" : "Saved");
      });
    }, 500);
    return () => clearTimeout(t);
  }, [counts, visitors, loaded, userId, day]);

  // new day → reload
  useEffect(() => {
    const i = setInterval(() => { if (todayKey() !== day) window.location.reload(); }, 60000);
    return () => clearInterval(i);
  }, [day]);

  const totals = computeTotals(counters, counts);
  const bump = (id: string, d: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2500); };

  const addVisitor = () => {
    const n = name.trim();
    if (!n) return;
    const now = new Date();
    setVisitors((v) => [...v, { name: n, at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` }]);
    setName("");
  };

  const saveReport = async () => {
    const report = createReport(day, counters, counts, visitors);
    const savedAt = new Date().toISOString();
    setReportSaving(true);
    const job = saveQueue.current.then(async () => {
      const { error } = await supabase.from("tally_days").upsert({ user_id: userId, day, counts, visitors, updated_at: savedAt, report: report as unknown as Json, report_saved_at: savedAt });
      if (error) { flash("Report could not be saved. Please try again."); return; }
      setHistory((rows) => [{ day, report, savedAt }, ...rows.filter((r) => r.day !== day)].sort((a, b) => b.day.localeCompare(a.day)));
      setSaveState("Saved");
      flash("Daily report saved.");
    });
    saveQueue.current = job;
    try { await job; } finally { setReportSaving(false); }
  };

  const copyReport = async (report = createReport(day, counters, counts, visitors)) => {
    try { await navigator.clipboard.writeText(reportText(report)); flash("Report copied."); }
    catch { flash("Could not copy report. Please try again."); }
  };

  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 4000); return; }
    setCounts({}); setVisitors([]); setConfirmReset(false);
  };

  const updateCounter = async (id: string, patch: Partial<Counter>) => {
    setCounters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("counters").update(patch).eq("id", id);
    if (error) flash("Counter changes could not be saved.");
  };
  const addCounter = async () => {
    const { data, error } = await supabase
      .from("counters")
      .insert({ user_id: userId, name: "New subcategory", description: "", role: null, color: COLORS[counters.length % COLORS.length] ?? "c1", position: counters.length })
      .select("*").single();
    if (error) { flash("Subcategory could not be saved. Please try again."); return; }
    if (data) {
      setCounters((cs) => [...cs, data]);
      setEditing(true);
    }
  };
  const deleteCounter = async (id: string) => {
    setCounters((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("counters").delete().eq("id", id);
  };

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const currentReport = history.find((r) => r.day === selectedReport) ?? history[0];
  const groups = [
    { label: "Call outcomes", items: counters.filter((c) => c.role === "received" || c.role === "not_received") },
    { label: "Common subcategories", items: counters.filter((c) => c.role !== "received" && c.role !== "not_received") },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Call Tally</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">{saveState} to your account · {email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" className={`${btnOutline} h-10 px-3 text-sm`} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Edit counters"}
          </Button>
          <Button variant="ghost" className={`${btnOutline} h-10 px-3 text-sm`} onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </header>

      <nav className="mt-5 flex gap-2 border-b pb-3" aria-label="Tally views">
        <Button variant={view === "today" ? "secondary" : "ghost"} onClick={() => setView("today")}>Today</Button>
        <Button variant={view === "reports" ? "secondary" : "ghost"} onClick={() => setView("reports")}>Daily reports</Button>
      </nav>
      {loadError && <p role="alert" className="mt-4 text-destructive">{loadError}</p>}
      {!loaded && !loadError && <p role="status" className="mt-4 text-muted-foreground">Loading…</p>}
      {loaded && view === "today" && <>
      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Calls dialed", String(totals.dialed)], ["Pick-up rate", `${totals.pickup}%`], ["Admitted %", `${totals.admitted}%`], ["Interested %", `${totals.interested}%`]].map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="tabular text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </section>

      {groups.map((group) => <section key={group.label} className="mt-5">
        <h2 className="mb-3 font-semibold">{group.label}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
        {group.items.map((c) => {
          const n = counts[c.id] ?? 0;
          return (
            <div key={c.id} className="rounded-lg border bg-card p-4">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <input className={input} value={c.name} aria-label="Counter name" onChange={(e) => updateCounter(c.id, { name: e.target.value })} />
                  <input className={input} value={c.description} placeholder="Description" aria-label="Counter description" onChange={(e) => updateCounter(c.id, { description: e.target.value })} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5">
                      {COLORS.map((k) => (
                        <Button variant="ghost" size="icon" key={k} aria-label={`Color ${k}`} onClick={() => updateCounter(c.id, { color: k })}
                          className={`h-7 w-7 rounded-full p-0 bg-${k} hover:bg-${k} ${c.color === k ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} />
                      ))}
                    </div>
                    <Button variant="ghost" className="text-sm text-destructive underline" onClick={() => deleteCounter(c.id)}>Delete</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full bg-${c.color}`} />
                    <h2 className="font-medium">{c.name}</h2>
                  </div>
                  {c.description && <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>}
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="ghost" className={`${btnOutline} h-[60px] w-[60px] text-2xl`} disabled={n === 0} aria-label={`Decrease ${c.name}`} onClick={() => bump(c.id, -1)}>−</Button>
                    <div className="tabular flex-1 text-center text-4xl font-semibold">{n}</div>
                    <Button variant="ghost" className={`${btnPrimary} h-[60px] w-[60px] text-2xl`} aria-label={`Increase ${c.name}`} onClick={() => bump(c.id, 1)}>+</Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {group.label === "Common subcategories" && (
          <Button variant="outline" className="min-h-24 border-dashed" onClick={addCounter}>+ Add subcategory</Button>
        )}
        </div>
      </section>)}

      <section className="mt-6 border-t pt-4">
        <h2 className="font-medium">Interested visitors</h2>
        <div className="mt-2 flex gap-2">
          <input className={input} placeholder="Write visitor name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVisitor()} />
          <Button variant="ghost" className={`${btnPrimary} px-4`} onClick={addVisitor}>Add</Button>
        </div>
        {visitors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No names yet. Add a visitor who showed interest.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {visitors.map((v, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{v.name} <span className="tabular text-xs text-muted-foreground">{v.at}</span></span>
                <Button variant="ghost" className="text-sm underline" onClick={() => setVisitors((vs) => vs.filter((_, j) => j !== i))}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        <Button className="h-12 px-5" disabled={reportSaving} onClick={saveReport}>{reportSaving ? "Saving report…" : "Save daily report"}</Button>
        <Button variant="ghost" className={`${btnOutline} h-12 px-5`} onClick={() => copyReport()}>Copy report</Button>
        <Button variant="ghost" className={`${btnOutline} h-12 px-5 ${confirmReset ? "border-destructive text-destructive" : ""}`} onClick={reset}>
          {confirmReset ? "Tap again to clear all" : "Reset today"}
        </Button>
      </section>
      </>}
      {loaded && view === "reports" && <section className="mt-5">
        <h2 className="text-lg font-semibold">Daily reports</h2>
        {history.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No saved reports yet.</p> : <>
          <label className="mt-4 block text-sm font-medium" htmlFor="report-day">Report date</label>
          <select id="report-day" className={`${input} mt-2`} value={currentReport?.day ?? ""} onChange={(e) => setSelectedReport(e.target.value)}>
            {history.map((r) => <option key={r.day} value={r.day}>{r.day}</option>)}
          </select>
          {currentReport && <>
            <p className="mt-3 text-xs text-muted-foreground">Saved {new Date(currentReport.savedAt).toLocaleString()}</p>
            <pre className="mt-4 whitespace-pre-wrap break-words font-mono text-sm leading-7">{reportText(currentReport.report)}</pre>
            <Button variant="outline" className="mt-4" onClick={() => copyReport(currentReport.report)}>Copy report</Button>
          </>}
        </>}
      </section>}
      {note && <p role="status" className="mt-3 text-sm text-muted-foreground">{note}</p>}
    </main>
  );
}
