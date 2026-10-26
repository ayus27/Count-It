import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { COLORS, DEFAULT_COUNTERS, computeTotals, todayKey, type Counter } from "@/lib/tally";

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
  return <Tally userId={session.user.id} email={session.user.email ?? ""} />;
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
      <p className="text-sm text-muted-foreground">Sign in to save your counters in the cloud.</p>
      <button
        className={`${btnOutline} h-12`}
        onClick={async () => {
          const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
          if (r.error) setMsg(String(r.error.message ?? r.error));
        }}
      >
        Continue with Google
      </button>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={`${btnPrimary} h-12`} type="submit">{mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <button className="text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </main>
  );
}

type Visitor = { name: string; at: string };

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

  useEffect(() => {
    (async () => {
      let { data: cs } = await supabase.from("counters").select("*").order("position");
      if (!cs || cs.length === 0) {
        const { data } = await supabase
          .from("counters")
          .insert(DEFAULT_COUNTERS.map((c, i) => ({ ...c, position: i, user_id: userId })))
          .select("*")
          .order("position");
        cs = data ?? [];
      }
      setCounters(cs);
      const { data: d } = await supabase.from("tally_days").select("*").eq("day", day).maybeSingle();
      if (d) {
        setCounts((d.counts as Record<string, number>) ?? {});
        setVisitors((d.visitors as Visitor[]) ?? []);
      }
      setLoaded(true);
    })();
  }, [userId, day]);

  // auto-save today's counts
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    setSaveState("Saving…");
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("tally_days")
        .upsert({ user_id: userId, day, counts, visitors, updated_at: new Date().toISOString() });
      setSaveState(error ? "Not saved — check connection" : "Saved");
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

  const copyReport = async () => {
    const lines = [
      `Call report — ${day}`,
      ...counters.map((c) => `${c.name}: ${counts[c.id] ?? 0}`),
      `Calls dialed: ${totals.dialed}`,
      "",
      "Interested visitors:",
      ...(visitors.length ? visitors.map((v, i) => `${i + 1}. ${v.name} (${v.at})`) : ["None"]),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    flash("Report copied.");
  };

  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 4000); return; }
    setCounts({}); setVisitors([]); setConfirmReset(false);
  };

  const updateCounter = async (id: string, patch: Partial<Counter>) => {
    setCounters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("counters").update(patch).eq("id", id);
  };
  const addCounter = async () => {
    const { data } = await supabase
      .from("counters")
      .insert({ user_id: userId, name: "New counter", description: "", color: COLORS[counters.length % COLORS.length] ?? "c1", position: counters.length })
      .select("*").single();
    if (data) setCounters((cs) => [...cs, data]);
  };
  const deleteCounter = async (id: string) => {
    setCounters((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("counters").delete().eq("id", id);
  };

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Call Tally</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">{saveState} to your account · {email}</p>
        </div>
        <div className="flex gap-2">
          <button className={`${btnOutline} h-10 px-3 text-sm`} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Edit counters"}
          </button>
          <button className={`${btnOutline} h-10 px-3 text-sm`} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Calls dialed", String(totals.dialed)], ["Pick-up rate", `${totals.pickup}%`], ["Admitted %", `${totals.admitted}%`], ["Interested %", `${totals.interested}%`]].map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="tabular text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {counters.map((c) => {
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
                        <button key={k} aria-label={`Color ${k}`} onClick={() => updateCounter(c.id, { color: k })}
                          className={`h-7 w-7 rounded-full bg-${k} ${c.color === k ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} />
                      ))}
                    </div>
                    <button className="text-sm text-destructive underline" onClick={() => deleteCounter(c.id)}>Delete</button>
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
                    <button className={`${btnOutline} h-[60px] w-[60px] text-2xl`} disabled={n === 0} aria-label={`Decrease ${c.name}`} onClick={() => bump(c.id, -1)}>−</button>
                    <div className="tabular flex-1 text-center text-4xl font-semibold">{n}</div>
                    <button className={`${btnPrimary} h-[60px] w-[60px] text-2xl`} aria-label={`Increase ${c.name}`} onClick={() => bump(c.id, 1)}>+</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {editing && (
          <button className={`${btnOutline} min-h-24 border-dashed`} onClick={addCounter}>+ Add counter</button>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-medium">Interested visitors</h2>
        <div className="mt-2 flex gap-2">
          <input className={input} placeholder="Write visitor name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVisitor()} />
          <button className={`${btnPrimary} px-4`} onClick={addVisitor}>Add</button>
        </div>
        {visitors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No names yet. Add a visitor who showed interest.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {visitors.map((v, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{v.name} <span className="tabular text-xs text-muted-foreground">{v.at}</span></span>
                <button className="text-sm underline" onClick={() => setVisitors((vs) => vs.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        <button className={`${btnPrimary} h-12 px-5`} onClick={copyReport}>Copy report</button>
        <button className={`${btnOutline} h-12 px-5 ${confirmReset ? "border-destructive text-destructive" : ""}`} onClick={reset}>
          {confirmReset ? "Tap again to clear all" : "Reset today"}
        </button>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
      </section>
    </main>
  );
}
