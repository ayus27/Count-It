import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

import { ThemeToggle } from "@/components/theme-toggle";
import type { Json } from "@/integrations/supabase/types";
import {
  CARD_COLORS,
  DEFAULT_COUNTERS,
  computeTotals,
  todayKey,
  normalizeCounts,
  getSmartGreeting,
  generateGoogleFormReport,
  resolveCardColor,
  type Counter,
  type Visitor,
  type DailyReport,
  type AdditionalFormDetails,
  type CardColor,
} from "@/lib/tally";
import {
  Plus,
  Minus,
  Pencil,
  Check,
  LogOut,
  Phone,
  Folder,
  GripVertical,
  Trash2,
  UserPlus,
  X,
  PhoneOutgoing,
  PhoneCall,
  TrendingUp,
  PhoneForwarded,
  Copy,
  Save,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Count It" },
      { name: "description", content: "Tally Efficiently, Count Smarter and Forget your pen and paper" },
      { property: "og:title", content: "Count It" },
      { property: "og:description", content: "Count calls, prospect student visits, and generate 1-to-1 report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="min-h-screen bg-background" />;
  if (!session) return <AuthCard />;

  const userFullName =
    (session.user.user_metadata?.["full_name"] as string) ||
    (session.user.user_metadata?.["name"] as string) ||
    (session.user.email?.split("@")[0] as string) ||
    "Aayush";

  return <Tally key={session.user.id} userId={session.user.id} email={session.user.email ?? ""} fullName={userFullName} />;
}

function AuthCard() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) setMsg(error.message);
        else if (!data.session) setMsg("Check your email to confirm your account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary text-primary-foreground font-bold text-xl">
          C
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Count-It</h1>
        <p className="mt-1 text-xs text-muted-foreground">IIC Footset calling & daily report portal</p>
      </div>

      <div className="section-panel">
        <button
          type="button"
          className="btn btn--outline w-full justify-center gap-2.5 font-medium"
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin },
            });
            if (error) setMsg(error.message);
          }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="relative my-4 text-center text-xs text-muted-foreground after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-card px-2">or with email</span>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            className="tally-input"
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="tally-input"
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn--primary w-full" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        {msg && <p className="mt-3 text-center text-xs text-destructive">{msg}</p>}

        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:underline hover:text-foreground cursor-pointer"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </div>

      <div className="flex justify-center">
        <ThemeToggle />
      </div>
    </main>
  );
}

/** 2-second press and hold button for safely deleting counters */
function HoldToDeleteButton({
  counterName,
  count,
  onDelete,
}: {
  counterName: string;
  count: number;
  onDelete: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const startHold = () => {
    setHolding(true);
    startRef.current = Date.now();
    setProgress(0);

    const update = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(100, (elapsed / 2000) * 100);
      setProgress(pct);

      if (elapsed < 2000) {
        animFrameRef.current = requestAnimationFrame(update);
      } else {
        setHolding(false);
        setProgress(0);
        onDelete();
      }
    };

    animFrameRef.current = requestAnimationFrame(update);
  };

  const cancelHold = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setHolding(false);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden transition-all select-none cursor-pointer ${holding ? "scale-105" : "hover:bg-black/10 dark:hover:bg-white/10"
          }`}
        title={`Hold 2s to delete ${counterName}`}
        aria-label={`Hold 2 seconds to delete ${counterName} (count: ${count})`}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !holding) {
            e.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            cancelHold();
          }
        }}
      >
        {holding && (
          <span
            className="absolute inset-0 bg-[#FF4A4A]/25"
            style={{
              clipPath: `inset(${100 - progress}% 0 0 0)`,
            }}
          />
        )}

        {holding && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="#FF4A4A"
              strokeWidth="2.5"
              strokeDasharray={81.68}
              strokeDashoffset={81.68 - (81.68 * progress) / 100}
              strokeLinecap="round"
            />
          </svg>
        )}

        <Trash2 className="h-4 w-4 text-[#FF4A4A] relative z-10" strokeWidth={2} />
      </button>

      {holding && (
        <span className="absolute right-9 whitespace-nowrap bg-foreground text-background text-[11px] font-medium px-2 py-0.5 rounded shadow-sm z-20 pointer-events-none">
          Hold 2s to delete
        </span>
      )}
    </div>
  );
}

type SavedReport = { day: string; report: DailyReport; savedAt: string };

function Tally({ userId, email, fullName }: { userId: string; email: string; fullName: string }) {
  const day = useMemo(() => todayKey(), []);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  // Active theme tracking for default color resolution & swatches
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.dataset["theme"] === "dark";
      setCurrentTheme(isDark ? "dark" : "light");
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Visitor inputs
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorNotes, setVisitorNotes] = useState("");

  // Additional form details matching Google Form questions
  const [extraDetails, setExtraDetails] = useState<AdditionalFormDetails>({
    averageWorkingHours: "8 hrs",
    leadTypeFollowedUp: "Autumn 2026 Walk-ins, Inquiries & Web leads",
    systemCallbackRemarks: "Addressed all inbound callbacks",
    confirmedVisitsTomorrow: "",
    highIntentFollowupsTomorrow: "",
    totalRevisitCommitments: "0",
    scheduledVisits: "0",
    actualShowUps: "0",
    unscheduledVisits: "0",
    totalVisits: "0",
    toursConducted: "0",
    todayHighlight: "",
    remainingClusters: "None",
    challengesFaced: "No",
  });

  const [confirmReset, setConfirmReset] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState("Saved");
  const skipSave = useRef(true);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [view, setView] = useState<"today" | "reports">("today");
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportSaving, setReportSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [note, setNote] = useState("");

  // Animation bump tracking
  const [bumpActiveId, setBumpActiveId] = useState<string | null>(null);

  // Drag and drop & keyboard reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasReordered, setHasReordered] = useState(false);
  const [pickedUpIndex, setPickedUpIndex] = useState<number | null>(null);

  // Time-aware greeting
  const greetingData = useMemo(() => getSmartGreeting(fullName), [fullName]);

  // Load user's counters & data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        try {
          await supabase.rpc("initialize_counters");
        } catch {
          // fallback if function not defined
        }

        const [{ data: cs, error: countersError }, { data: d, error: dayError }, { data: reports, error: reportError }] =
          await Promise.all([
            supabase.from("counters").select("*").eq("user_id", userId).order("position").order("created_at"),
            supabase.from("tally_days").select("*").eq("user_id", userId).eq("day", day).maybeSingle(),
            supabase
              .from("tally_days")
              .select("day, report, report_saved_at")
              .eq("user_id", userId)
              .not("report", "is", null)
              .order("day", { ascending: false }),
          ]);

        if (countersError) throw countersError;
        if (dayError && dayError.code !== "PGRST116") throw dayError;
        if (reportError) throw reportError;
        if (cancelled) return;

        let activeCounters = (cs ?? []).filter((c) => !c.archived);

        if (activeCounters.length === 0) {
          const toInsert = DEFAULT_COUNTERS.map((dc, i) => ({
            user_id: userId,
            name: dc.name,
            description: dc.description,
            color: dc.color,
            role: dc.role,
            position: i,
          }));

          const { data: created, error: insertError } = await supabase.from("counters").insert(toInsert).select("*");
          if (!insertError && created) {
            activeCounters = created;
          }
        } else {
          // If missing default counters, insert them
          const existingRolesOrNames = new Set(activeCounters.map((c) => c.role || c.name.toLowerCase()));
          const missingDefaults = DEFAULT_COUNTERS.filter(
            (dc) => !existingRolesOrNames.has(dc.role) && !existingRolesOrNames.has(dc.name.toLowerCase())
          );

          if (missingDefaults.length > 0) {
            const nextPos = Math.max(...activeCounters.map((c) => c.position ?? 0), 0) + 1;
            const toAdd = missingDefaults.map((dc, i) => ({
              user_id: userId,
              name: dc.name,
              description: dc.description,
              color: dc.color,
              role: dc.role,
              position: nextPos + i,
            }));

            const { data: added, error: addErr } = await supabase.from("counters").insert(toAdd).select("*");
            if (!addErr && added) {
              activeCounters = [...activeCounters, ...added];
            }
          }
        }

        activeCounters.sort((a, b) => a.position - b.position);

        setCounters(activeCounters);
        setCounts(normalizeCounts(activeCounters, (d?.counts as Record<string, number>) ?? {}));
        setVisitors((d?.visitors as Visitor[]) ?? []);
        setHistory(
          (reports ?? []).map((r) => ({
            day: r.day,
            report: r.report as unknown as DailyReport,
            savedAt: r.report_saved_at ?? "",
          }))
        );

        const savedReportObj = d?.report as unknown as DailyReport;
        if (savedReportObj?.additional) {
          setExtraDetails((prev) => ({ ...prev, ...savedReportObj.additional }));
        }

        const initialTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        setSaveStatusText(`Saved ${initialTime}`);
        setLoaded(true);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load your counters. Please refresh.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, day]);

  // Auto-save today's counts & visitors
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaveStatusText("Saving…");
    const t = setTimeout(async () => {
      saveQueue.current = saveQueue.current.then(async () => {
        const { error } = await supabase.from("tally_days").upsert({
          user_id: userId,
          day,
          counts,
          visitors,
          updated_at: new Date().toISOString(),
        });
        const timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        setSaveStatusText(error ? "Not saved — check connection" : `Saved ${timeStr}`);
      });
    }, 600);
    return () => clearTimeout(t);
  }, [counts, visitors, loaded, userId, day]);

  // Day rollover reload
  useEffect(() => {
    const i = setInterval(() => {
      if (todayKey() !== day) window.location.reload();
    }, 60000);
    return () => clearInterval(i);
  }, [day]);

  const totals = computeTotals(counters, counts);

  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(""), 3000);
  };

  const bump = (id: string, delta: number) => {
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));
    setBumpActiveId(id);
    setTimeout(() => {
      setBumpActiveId((prev) => (prev === id ? null : prev));
    }, 120);
    setSaveStatusText("Unsaved changes");
  };

  const addVisitor = () => {
    const n = visitorName.trim();
    if (!n) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setVisitors((v) => [
      ...v,
      {
        name: n,
        at: timeStr,
        phone: visitorPhone.trim() || undefined,
        notes: visitorNotes.trim() || undefined,
      },
    ]);
    setVisitorName("");
    setVisitorPhone("");
    setVisitorNotes("");
    flash(`Added visitor: ${n}`);
  };

  const saveReport = async () => {
    const entries = counters.map((c) => ({
      name: c.name,
      description: c.description,
      role: c.role,
      count: counts[c.id] ?? 0,
    }));

    const report: DailyReport = {
      day,
      counters: entries,
      visitors: visitors.map((v) => ({ ...v })),
      totals,
      additional: extraDetails,
    };

    const savedAt = new Date().toISOString();
    setReportSaving(true);
    const job = saveQueue.current.then(async () => {
      const { error } = await supabase.from("tally_days").upsert({
        user_id: userId,
        day,
        counts,
        visitors,
        updated_at: savedAt,
        report: report as unknown as Json,
        report_saved_at: savedAt,
      });

      if (error) {
        flash("Report could not be saved. Please try again.");
        return;
      }

      setHistory((rows) => [{ day, report, savedAt }, ...rows.filter((r) => r.day !== day)].sort((a, b) => b.day.localeCompare(a.day)));
      const timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setSaveStatusText(`Saved ${timeStr}`);
      flash("Today's report saved successfully.");
    });

    saveQueue.current = job;
    try {
      await job;
    } finally {
      setReportSaving(false);
    }
  };

  const copyGoogleFormReport = async () => {
    const text = generateGoogleFormReport(day, email, fullName, counters, counts, visitors, extraDetails);
    try {
      await navigator.clipboard.writeText(text);
      flash("Report copied in exact Google Form sequence.");
    } catch {
      flash("Could not copy to clipboard. Please check permissions.");
    }
  };

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setCounts({});
    setVisitors([]);
    setConfirmReset(false);
    flash("Today's tallies reset to zero.");
  };

  const updateCounter = async (id: string, patch: Partial<Counter>) => {
    setCounters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("counters").update(patch).eq("id", id);
    if (error) flash("Could not save counter changes.");
  };

  const addCounter = async () => {
    const newPos = counters.length;
    // Set color to 'default' so it satisfies the database NOT NULL constraint
    const { data, error } = await supabase
      .from("counters")
      .insert({
        user_id: userId,
        name: "New subcategory",
        description: "Custom outcome",
        role: null,
        color: "default",
        position: newPos,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Add counter error:", error);
      flash(`Could not add counter: ${error.message || "database error"}`);
      return;
    }
    if (data) {
      setCounters((cs) => [...cs, data]);
      setEditing(true);
      flash("New counter added.");
    }
  };

  const deleteCounter = async (id: string) => {
    setCounters((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("counters").delete().eq("id", id);
    flash("Counter removed.");
  };

  // Primary counters are ALWAYS strictly fixed: Received on the left, Not received on the right
  const receivedCounter =
    counters.find((c) => c.role === "received") ??
    counters.find((c) => c.name.toLowerCase().includes("received") && !c.name.toLowerCase().includes("not"));
  const notReceivedCounter =
    counters.find((c) => c.role === "not_received") ??
    counters.find((c) => c.name.toLowerCase().includes("not received"));

  const primaryCounters = [receivedCounter, notReceivedCounter].filter(Boolean) as Counter[];
  const primaryIdSet = new Set(primaryCounters.map((c) => c.id));
  const subCounters = counters.filter((c) => !primaryIdSet.has(c.id));

  // Drag and drop reordering handlers — strictly reorders subcategories, primary cards NEVER move
  const handleDragStart = (e: React.DragEvent, subIdx: number) => {
    e.dataTransfer.setData("text/plain", String(subIdx));
    setDraggedIndex(subIdx);
  };

  const handleDragOver = (e: React.DragEvent, targetSubIdx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetSubIdx) return;

    setCounters((prev) => {
      const rec = prev.find((c) => c.role === "received") ?? prev.find((c) => c.name.toLowerCase().includes("received") && !c.name.toLowerCase().includes("not"));
      const notRec = prev.find((c) => c.role === "not_received") ?? prev.find((c) => c.name.toLowerCase().includes("not received"));
      const prim = [rec, notRec].filter(Boolean) as Counter[];
      const pSet = new Set(prim.map((c) => c.id));

      const subs = prev.filter((c) => !pSet.has(c.id));
      const item = subs.splice(draggedIndex, 1)[0];
      if (item) {
        subs.splice(targetSubIdx, 0, item);
      }
      return [...prim, ...subs];
    });

    setDraggedIndex(targetSubIdx);
    setHasReordered(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    if (hasReordered) {
      saveLayoutPreference();
    }
  };

  // Keyboard reordering handler (Space/Enter to pick up, Arrow keys to move)
  const handleKeyboardReorder = (e: React.KeyboardEvent, subIdx: number) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (pickedUpIndex === subIdx) {
        setPickedUpIndex(null);
        saveLayoutPreference();
        flash(`Placed counter at #${subIdx + 1}`);
      } else {
        setPickedUpIndex(subIdx);
        flash(`Picked up. Use arrow keys to reorder, Space to place.`);
      }
    } else if (pickedUpIndex === subIdx) {
      let targetSubIdx = -1;
      if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && subIdx > 0) {
        targetSubIdx = subIdx - 1;
      } else if ((e.key === "ArrowDown" || e.key === "ArrowRight") && subIdx < subCounters.length - 1) {
        targetSubIdx = subIdx + 1;
      } else if (e.key === "Escape") {
        setPickedUpIndex(null);
        return;
      }

      if (targetSubIdx !== -1) {
        e.preventDefault();
        setCounters((prev) => {
          const rec = prev.find((c) => c.role === "received") ?? prev.find((c) => c.name.toLowerCase().includes("received") && !c.name.toLowerCase().includes("not"));
          const notRec = prev.find((c) => c.role === "not_received") ?? prev.find((c) => c.name.toLowerCase().includes("not received"));
          const prim = [rec, notRec].filter(Boolean) as Counter[];
          const pSet = new Set(prim.map((c) => c.id));

          const subs = prev.filter((c) => !pSet.has(c.id));
          const item = subs.splice(subIdx, 1)[0];
          if (item) {
            subs.splice(targetSubIdx, 0, item);
          }
          return [...prim, ...subs];
        });
        setPickedUpIndex(targetSubIdx);
        setHasReordered(true);
      }
    }
  };

  const saveLayoutPreference = async () => {
    try {
      const rec = counters.find((c) => c.role === "received") ?? counters.find((c) => c.name.toLowerCase().includes("received") && !c.name.toLowerCase().includes("not"));
      const notRec = counters.find((c) => c.role === "not_received") ?? counters.find((c) => c.name.toLowerCase().includes("not received"));
      const prim = [rec, notRec].filter(Boolean) as Counter[];
      const pSet = new Set(prim.map((c) => c.id));
      const subs = counters.filter((c) => !pSet.has(c.id));

      if (rec) await supabase.from("counters").update({ position: 0 }).eq("id", rec.id);
      if (notRec) await supabase.from("counters").update({ position: 1 }).eq("id", notRec.id);

      for (let i = 0; i < subs.length; i++) {
        const c = subs[i];
        if (c) {
          await supabase.from("counters").update({ position: 2 + i }).eq("id", c.id);
        }
      }
      setHasReordered(false);
      flash("Layout preference saved.");
    } catch {
      flash("Could not save layout.");
    }
  };

  // Muted sentence case date format without all-caps or green dot
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const currentReport = history.find((r) => r.day === selectedReport) ?? history[0];

  return (
    <main className="tally-container py-6">
      {/* ── Header ── */}
      <header className="section-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">{greetingData.greeting}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{greetingData.subtext}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className={`btn ${editing ? "btn--primary" : "btn--outline"}`}
              onClick={() => {
                if (editing && hasReordered) {
                  saveLayoutPreference();
                }
                setEditing((e) => !e);
              }}
            >
              {editing ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2} />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                  <span>Edit counters</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn--ghost text-xs text-muted-foreground hover:text-foreground"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Underline Tabs ── */}
      <nav className="tally-tabs mt-6" aria-label="Tally views">
        <button
          type="button"
          className={`tally-tab ${view === "today" ? "tally-tab--active" : ""}`}
          onClick={() => setView("today")}
        >
          <Phone strokeWidth={2} />
          <span>Today's calling sheet</span>
        </button>
        <button
          type="button"
          className={`tally-tab ${view === "reports" ? "tally-tab--active" : ""}`}
          onClick={() => setView("reports")}
        >
          <Folder strokeWidth={2} />
          <span>Saved daily reports</span>
        </button>
      </nav>

      {loadError && (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {!loaded && !loadError && (
        <div className="mt-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm">Loading counters…</p>
        </div>
      )}

      {loaded && view === "today" && (
        <>
          {/* ── Stat Tiles (4-up desktop, 2-up mobile, normal text color numerals) ── */}
          <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="stat-tile">
              <div className="flex items-center justify-between">
                <span className="stat-tile__label">Calls attempted</span>
                <PhoneOutgoing className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
              <div className="stat-tile__value">{totals.dialed}</div>
              <div className="stat-tile__sub">Total numbers dialed</div>
            </div>

            <div className="stat-tile">
              <div className="flex items-center justify-between">
                <span className="stat-tile__label">Calls connected</span>
                <PhoneCall className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
              <div className="stat-tile__value">{totals.received}</div>
              <div className="stat-tile__sub">Total calls answered</div>
            </div>

            {/* Replaced High Intent Leads with Pick-up Rate as requested */}
            <div className="stat-tile">
              <div className="flex items-center justify-between">
                <span className="stat-tile__label">Pick-up rate</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
              <div className="stat-tile__value">{totals.pickup}%</div>
              <div className="stat-tile__sub">{totals.received} of {totals.dialed} answered</div>
            </div>

            <div className="stat-tile">
              <div className="flex items-center justify-between">
                <span className="stat-tile__label">System callbacks</span>
                <PhoneForwarded className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
              <div className="stat-tile__value">{totals.callbackCount}</div>
              <div className="stat-tile__sub">Inbound & requests</div>
            </div>
          </section>

          {/* ── 1. PRIMARY CALL OUTCOMES (Received on left, Not received on right) ── */}
          <section className="mt-8">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground">1. Primary call tally</h2>
              <p className="text-xs text-muted-foreground">Tap as you dial each contact to track total attempts and pickups.</p>
            </div>

            <div className="tally-grid">
              {primaryCounters.map((c, i) => {
                const count = counts[c.id] ?? 0;
                const resolvedColor = resolveCardColor(c.color);
                const schemeClass = resolvedColor ? `card-scheme-${resolvedColor}` : "card-scheme-default";
                const effectiveColor: CardColor = resolvedColor ?? (currentTheme === "light" ? "white" : "gray");

                return (
                  <div
                    key={c.id}
                    className={`counter-card tally-grid__item--span3 ${schemeClass} ${editing ? "counter-card--editing" : ""}`}
                  >
                    <div className="counter-card__inner">
                      {editing ? (
                        <>
                          <div className="counter-card__edit-top">
                            <span className="text-xs font-medium opacity-70">Primary card</span>
                            <span className="counter-card__rank">#{i + 1}</span>
                          </div>

                          <div className="counter-card__edit-inputs">
                            <input
                              className="counter-card__edit-input font-medium"
                              value={c.name}
                              maxLength={24}
                              aria-label="Counter name"
                              placeholder="Counter name"
                              disabled
                            />
                            <input
                              className="counter-card__edit-input text-xs"
                              value={c.description}
                              maxLength={48}
                              aria-label="Counter description"
                              placeholder="Description"
                              disabled
                            />
                          </div>

                          <div className="counter-card__edit-bottom">
                            <div className="counter-card__swatches" role="group" aria-label="Color scheme">
                              {CARD_COLORS.map((colorKey) => {
                                const isSelected = effectiveColor === colorKey;
                                return (
                                  <button
                                    type="button"
                                    key={colorKey}
                                    className={`counter-card__swatch swatch-${colorKey} ${isSelected ? "counter-card__swatch--active" : ""}`}
                                    aria-label={`Set color to ${colorKey}`}
                                    aria-pressed={isSelected}
                                    onClick={() => {
                                      const defaultForTheme = currentTheme === "light" ? "white" : "gray";
                                      const newColor = colorKey === defaultForTheme ? "default" : colorKey;
                                      updateCounter(c.id, { color: newColor });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="counter-card__header">
                            <div className="counter-card__titles">
                              <h3 className="counter-card__title" title={c.name}>{c.name}</h3>
                              <p className="counter-card__subtitle" title={c.description}>{c.description}</p>
                            </div>
                            <span className="counter-card__rank">#{i + 1}</span>
                          </div>

                          <div className="counter-card__divider" />

                          <div className="counter-card__controls">
                            <button
                              type="button"
                              className="counter-card__btn"
                              disabled={count === 0}
                              aria-label={`Subtract one from ${c.name}`}
                              onClick={() => bump(c.id, -1)}
                            >
                              <Minus strokeWidth={2} />
                            </button>

                            <div
                              className={`counter-card__count ${bumpActiveId === c.id ? "bump" : ""}`}
                              aria-live="polite"
                              aria-atomic="true"
                            >
                              {count}
                            </div>

                            <button
                              type="button"
                              className="counter-card__btn"
                              aria-label={`Add one to ${c.name}`}
                              onClick={() => bump(c.id, 1)}
                            >
                              <Plus strokeWidth={2} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 2. SUB-CATEGORIES SECTION (Spans 2 each in 6-col grid) ── */}
          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">2. Sub-categories and outcomes</h2>
                <p className="text-xs text-muted-foreground">
                  Ordered by frequent daily responses. Click or drag to customize position anytime.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--outline text-xs gap-1.5 border-dashed"
                onClick={addCounter}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                <span>Add custom category</span>
              </button>
            </div>

            <div className="tally-grid">
              {subCounters.map((c, subIdx) => {
                const count = counts[c.id] ?? 0;
                const resolvedColor = resolveCardColor(c.color);
                const schemeClass = resolvedColor ? `card-scheme-${resolvedColor}` : "card-scheme-default";
                const effectiveColor: CardColor = resolvedColor ?? (currentTheme === "light" ? "white" : "gray");
                const isDragging = draggedIndex === subIdx;
                const isPickedUp = pickedUpIndex === subIdx;

                return (
                  <div
                    key={c.id}
                    onDragOver={(e) => editing && handleDragOver(e, subIdx)}
                    className={`counter-card tally-grid__item--span2 ${schemeClass} ${editing ? "counter-card--editing" : ""} ${isDragging ? "opacity-40" : ""
                      } ${isPickedUp ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                  >
                    <div className="counter-card__inner">
                      {editing ? (
                        <>
                          <div className="counter-card__edit-top">
                            <div
                              className="drag-handle inline-flex items-center gap-1.5 text-xs select-none"
                              draggable
                              tabIndex={0}
                              role="button"
                              aria-label={`Reorder ${c.name}. Press Space to pick up, arrow keys to move.`}
                              onDragStart={(e) => handleDragStart(e, subIdx)}
                              onDragEnd={handleDragEnd}
                              onKeyDown={(e) => handleKeyboardReorder(e, subIdx)}
                            >
                              <GripVertical className="h-4 w-4 opacity-80" strokeWidth={2} />
                              <span className="font-medium text-[11px] opacity-80">
                                {isPickedUp ? "Arrow keys to move, Space to drop" : "Drag to reorder"}
                              </span>
                            </div>
                            <span className="counter-card__rank">#{subIdx + 1}</span>
                          </div>

                          <div className="counter-card__edit-inputs">
                            <input
                              className="counter-card__edit-input font-medium"
                              value={c.name}
                              maxLength={24}
                              aria-label="Counter name"
                              placeholder="Counter name"
                              onChange={(e) => updateCounter(c.id, { name: e.target.value })}
                            />
                            <input
                              className="counter-card__edit-input text-xs"
                              value={c.description}
                              maxLength={48}
                              aria-label="Counter description"
                              placeholder="Description"
                              onChange={(e) => updateCounter(c.id, { description: e.target.value })}
                            />
                          </div>

                          <div className="counter-card__edit-bottom">
                            <div className="counter-card__swatches" role="group" aria-label="Color scheme">
                              {CARD_COLORS.map((colorKey) => {
                                const isSelected = effectiveColor === colorKey;
                                return (
                                  <button
                                    type="button"
                                    key={colorKey}
                                    className={`counter-card__swatch swatch-${colorKey} ${isSelected ? "counter-card__swatch--active" : ""}`}
                                    aria-label={`Set color to ${colorKey}`}
                                    aria-pressed={isSelected}
                                    onClick={() => {
                                      const defaultForTheme = currentTheme === "light" ? "white" : "gray";
                                      const newColor = colorKey === defaultForTheme ? "default" : colorKey;
                                      updateCounter(c.id, { color: newColor });
                                    }}
                                  />
                                );
                              })}
                            </div>

                            <HoldToDeleteButton
                              counterName={c.name}
                              count={count}
                              onDelete={() => deleteCounter(c.id)}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="counter-card__header">
                            <div className="counter-card__titles">
                              <h3 className="counter-card__title" title={c.name}>{c.name}</h3>
                              <p className="counter-card__subtitle" title={c.description}>{c.description}</p>
                            </div>
                            <span className="counter-card__rank">#{subIdx + 1}</span>
                          </div>

                          <div className="counter-card__divider" />

                          <div className="counter-card__controls">
                            <button
                              type="button"
                              className="counter-card__btn"
                              disabled={count === 0}
                              aria-label={`Subtract one from ${c.name}`}
                              onClick={() => bump(c.id, -1)}
                            >
                              <Minus strokeWidth={2} />
                            </button>

                            <div
                              className={`counter-card__count ${bumpActiveId === c.id ? "bump" : ""}`}
                              aria-live="polite"
                              aria-atomic="true"
                            >
                              {count}
                            </div>

                            <button
                              type="button"
                              className="counter-card__btn"
                              aria-label={`Add one to ${c.name}`}
                              onClick={() => bump(c.id, 1)}
                            >
                              <Plus strokeWidth={2} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Ghost card at the end of the grid in edit mode */}
              {editing && (
                <button
                  type="button"
                  className="ghost-card tally-grid__item--span2"
                  onClick={addCounter}
                  aria-label="Add custom category"
                >
                  <Plus className="h-5 w-5" strokeWidth={2} />
                  <span>Add custom category</span>
                </button>
              )}
            </div>
          </section>

          {/* ── 3. INTERESTED VISITORS SECTION ── */}
          <section className="section-panel mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">Interested visitors</h2>
                <span className="count-pill">{visitors.length}</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Add prospective students interested in visiting campus or upcoming events.</p>

            <div className="mt-4 flex flex-wrap md:flex-nowrap gap-3">
              <input
                className="tally-input flex-1 min-w-[200px]"
                placeholder="Student full name *"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addVisitor()}
                aria-label="Student full name"
              />
              <input
                className="tally-input flex-1 min-w-[160px]"
                placeholder="Contact phone (optional)"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addVisitor()}
                aria-label="Contact phone number"
              />
              <input
                className="tally-input flex-1 min-w-[200px]"
                placeholder="Notes / interested course"
                value={visitorNotes}
                onChange={(e) => setVisitorNotes(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addVisitor()}
                aria-label="Visitor notes or course"
              />
              <button
                type="button"
                className="btn btn--primary shrink-0"
                onClick={addVisitor}
                aria-label="Add interested visitor"
              >
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                <span>Add</span>
              </button>
            </div>

            {visitors.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No visitors added yet. Names you add here go into today's report.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-border">
                {visitors.map((v, i) => (
                  <div key={i} className="visitor-row py-2.5">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-medium text-foreground">{v.name}</span>
                      {v.phone && <span className="text-xs text-muted-foreground">({v.phone})</span>}
                      {v.notes && <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">{v.notes}</span>}
                      <span className="text-xs font-mono text-muted-foreground">· {v.at}</span>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-accent cursor-pointer"
                      aria-label={`Remove visitor ${v.name}`}
                      onClick={() => setVisitors((vs) => vs.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 4. DAILY REPORT DETAILS (Google Form aligned 3-col grid) ── */}
          <section className="section-panel mt-8">
            <h2 className="text-base font-semibold text-foreground">Daily report details</h2>
            <p className="text-xs text-muted-foreground">
              Fill in the remaining details. Matches your Google Form sequence.
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="tally-label">Average working hours *</label>
                <input
                  className="tally-input"
                  value={extraDetails.averageWorkingHours ?? ""}
                  placeholder="e.g. 8 hrs"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, averageWorkingHours: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Type of lead followed-up *</label>
                <input
                  className="tally-input"
                  value={extraDetails.leadTypeFollowedUp ?? ""}
                  placeholder="e.g. Web leads, Autumn 2026 inquiry calls"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, leadTypeFollowedUp: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">System callbacks (inbound) remarks *</label>
                <input
                  className="tally-input"
                  value={extraDetails.systemCallbackRemarks ?? ""}
                  placeholder="e.g. Addressed all inbound callbacks"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, systemCallbackRemarks: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Remaining clusters (if any) *</label>
                <input
                  className="tally-input"
                  value={extraDetails.remainingClusters ?? ""}
                  placeholder="e.g. None or Cluster B pending"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, remainingClusters: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Scheduled visits</label>
                <input
                  className="tally-input"
                  placeholder="e.g. 2"
                  value={extraDetails.scheduledVisits ?? ""}
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, scheduledVisits: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Actual show-ups</label>
                <input
                  className="tally-input"
                  placeholder="e.g. 1"
                  value={extraDetails.actualShowUps ?? ""}
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, actualShowUps: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Unscheduled / same-day visits</label>
                <input
                  className="tally-input"
                  placeholder="e.g. 0"
                  value={extraDetails.unscheduledVisits ?? ""}
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, unscheduledVisits: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Total revisit commitments</label>
                <input
                  className="tally-input"
                  placeholder="e.g. 0"
                  value={extraDetails.totalRevisitCommitments ?? ""}
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, totalRevisitCommitments: e.target.value }))}
                />
              </div>

              <div>
                <label className="tally-label">Campus tours conducted</label>
                <input
                  className="tally-input"
                  value={extraDetails.toursConducted ?? ""}
                  placeholder="e.g. 0 or 1"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, toursConducted: e.target.value }))}
                />
              </div>

              <div className="md:col-span-3">
                <label className="tally-label">Today's highlight (Call Center) *</label>
                <textarea
                  rows={2}
                  className="tally-textarea"
                  value={extraDetails.todayHighlight ?? ""}
                  placeholder="Key achievement or highlight from today's calling session"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, todayHighlight: e.target.value }))}
                />
              </div>

              <div className="md:col-span-3">
                <label className="tally-label">
                  Any challenges or issues faced today? (If yes, please elaborate. If no, mention No) *
                </label>
                <textarea
                  rows={2}
                  className="tally-textarea"
                  value={extraDetails.challengesFaced ?? ""}
                  placeholder="e.g. No issues faced today"
                  onChange={(e) => setExtraDetails((prev) => ({ ...prev, challengesFaced: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* ── 8. STICKY SAVE BAR ── */}
          <div className="save-bar">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                className="btn btn--primary"
                disabled={reportSaving}
                onClick={saveReport}
              >
                <Save className="h-4 w-4" strokeWidth={2} />
                <span>{reportSaving ? "Saving report…" : "Save today's report"}</span>
              </button>
              <span className="text-xs text-muted-foreground">{saveStatusText}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <button
                type="button"
                className="btn btn--outline"
                onClick={copyGoogleFormReport}
              >
                <Copy className="h-4 w-4" strokeWidth={2} />
                <span>Copy Google Form report</span>
              </button>

              <button
                type="button"
                className={`btn btn--ghost text-xs ${confirmReset ? "text-destructive bg-destructive/10" : "text-muted-foreground"
                  }`}
                onClick={reset}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                <span>{confirmReset ? "Confirm reset all today?" : "Reset today's numbers"}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── View: Saved Daily Reports ── */}
      {loaded && view === "reports" && (
        <section className="section-panel mt-6">
          <h2 className="text-lg font-bold text-foreground">Saved daily reports history</h2>
          <p className="text-xs text-muted-foreground">View and copy previous daily submissions.</p>

          {history.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No reports saved yet. Click "Save today's report" on today's sheet to archive.</p>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <label className="tally-label" htmlFor="report-day">
                  Select report date:
                </label>
                <select
                  id="report-day"
                  className="tally-input"
                  value={currentReport?.day ?? ""}
                  onChange={(e) => setSelectedReport(e.target.value)}
                >
                  {history.map((r) => (
                    <option key={r.day} value={r.day}>
                      {r.day} — Saved {new Date(r.savedAt).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
              </div>

              {currentReport && (
                <div className="rounded-xl border border-border bg-accent/30 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Saved on {new Date(currentReport.savedAt).toLocaleString()}</span>
                    <button
                      type="button"
                      className="btn btn--primary text-xs"
                      onClick={() => {
                        const reportObj = currentReport.report;
                        const snapshotCounters: Counter[] = (reportObj.counters ?? []).map((e, idx) => ({
                          id: `snap_${idx}`,
                          name: e.name,
                          description: e.description ?? "",
                          color: "gray",
                          position: idx,
                          role: e.role,
                        }));
                        const snapshotCounts: Record<string, number> = {};
                        (reportObj.counters ?? []).forEach((e, idx) => {
                          snapshotCounts[`snap_${idx}`] = e.count;
                        });

                        const text = generateGoogleFormReport(
                          currentReport.day,
                          email,
                          fullName,
                          snapshotCounters,
                          snapshotCounts,
                          reportObj.visitors ?? [],
                          reportObj.additional
                        );
                        navigator.clipboard.writeText(text);
                        flash("Historical report copied.");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>Copy Google Form report</span>
                    </button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground bg-card p-4 rounded-lg border border-border overflow-x-auto">
                    {(() => {
                      const reportObj = currentReport.report;
                      const snapshotCounters: Counter[] = (reportObj.counters ?? []).map((e, idx) => ({
                        id: `snap_${idx}`,
                        name: e.name,
                        description: e.description ?? "",
                        color: "gray",
                        position: idx,
                        role: e.role,
                      }));
                      const snapshotCounts: Record<string, number> = {};
                      (reportObj.counters ?? []).forEach((e, idx) => {
                        snapshotCounts[`snap_${idx}`] = e.count;
                      });

                      return generateGoogleFormReport(
                        currentReport.day,
                        email,
                        fullName,
                        snapshotCounters,
                        snapshotCounts,
                        reportObj.visitors ?? [],
                        reportObj.additional
                      );
                    })()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Toast Notification ── */}
      {note && (
        <div role="status" className="toast-note">
          {note}
        </div>
      )}
    </main>
  );
}
