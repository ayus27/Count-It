export type Role =
  | "received"
  | "not_received"
  | "interested_followup"
  | "discuss_parents"
  | "interested_visit"
  | "callback"
  | "wrong"
  | "not_interested"
  | "turning_later"
  | "already_visited"
  | "already_joined"
  | "course_unavailable"
  | "scholarship_hesitation"
  | "fees_hesitation"
  | "registered_event";

export type Counter = {
  id: string;
  name: string;
  description: string;
  color: string;
  position: number;
  role: string | null;
  archived?: boolean;
};

// Initial default counters ordered strictly by everyday caller workflow & frequency
export const DEFAULT_COUNTERS: { name: string; description: string; color: string; role: Role }[] = [
  // 1. Primary actions
  { name: "Received (Connected)", description: "Customer picked up & connected", color: "blue", role: "received" },
  { name: "Not received", description: "No answer, busy, switched off", color: "red", role: "not_received" },

  // 2. High-frequency daily subcategories
  { name: "Interested but needs follow-up", description: "Positive response, follow-up required", color: "teal", role: "interested_followup" },
  { name: "Will discuss with parents", description: "Needs parental discussion before deciding", color: "purple", role: "discuss_parents" },
  { name: "Interested for visit tomorrow", description: "Agreed to visit college tomorrow", color: "olive", role: "interested_visit" },
  { name: "System Callbacks (Inbound)", description: "Student called back or requested call", color: "orange", role: "callback" },
  { name: "Wrong Number/invalid", description: "Wrong person, non-working or invalid number", color: "pink", role: "wrong" },
  { name: "Not interested", description: "Direct refusal or unwilling to study here", color: "red", role: "not_interested" },
  { name: "Turning up later (after results)", description: "Waiting for exams/results", color: "blue", role: "turning_later" },
  { name: "Already visited the college", description: "Student has already visited campus", color: "purple", role: "already_visited" },
  { name: "Already joined another college", description: "Enrolled in another institution", color: "orange", role: "already_joined" },
  { name: "Course not available", description: "Desired course not offered at IIC", color: "pink", role: "course_unavailable" },

  // 3. Low-frequency / hesitation & event items (bottom of clicking list)
  { name: "Scholarship related hesitation", description: "Concerns regarding scholarship criteria", color: "teal", role: "scholarship_hesitation" },
  { name: "Fees related hesitation", description: "Concerns or queries about fee structure", color: "olive", role: "fees_hesitation" },
  { name: "Registered for event", description: "Signed up for webinar, orientation, or event", color: "purple", role: "registered_event" },
];

// Card color scheme keys matching CSS classes
export const CARD_COLORS = ["red", "blue", "orange", "olive", "purple", "teal", "pink", "white", "gray"] as const;
export type CardColor = typeof CARD_COLORS[number];

// Legacy color keys to new card color scheme mapping
const LEGACY_COLOR_MAP: Record<string, CardColor> = {
  c1: "teal",
  c2: "blue",
  c3: "red",
  c4: "purple",
  c5: "orange",
  c6: "pink",
};

/** Resolves any stored color key to a valid CardColor scheme key */
export function resolveCardColor(color: string | null | undefined): CardColor | null {
  if (!color) return null;
  if (CARD_COLORS.includes(color as CardColor)) return color as CardColor;
  return LEGACY_COLOR_MAP[color] ?? null;
}

// Keep COLORS export for backward compatibility
export const COLORS = [...CARD_COLORS];

export function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computeTotals(counters: Counter[], counts: Record<string, number>) {
  const byRole = (r: string) =>
    counters.filter((c) => c.role === r).reduce((s, c) => s + (counts[c.id] ?? 0), 0);

  const received = byRole("received");
  const notReceived = byRole("not_received");
  const dialed = received + notReceived;
  const interested = byRole("interested_followup") + byRole("interested_visit") + byRole("interested");
  const callback = byRole("callback");
  const admitted = byRole("admitted");

  return {
    dialed,
    received,
    notReceived,
    pickup: pct(received, dialed),
    interestedRate: pct(interested, received),
    interestedCount: interested,
    callbackCount: callback,
    admitted: pct(admitted, received),
    interested: pct(interested, received),
  };
}

export function remarkStats(entries: { name: string; role?: string | null; count: number }[]) {
  const byRole = (r: string) => entries.filter((c) => c.role === r).reduce((s, c) => s + c.count, 0);
  const dialed = byRole("received") + byRole("not_received");
  const notReceived = byRole("not_received");
  const notReceivedPercentage = dialed === 0 ? 0 : Math.round((notReceived / dialed) * 100);

  const subcategories = entries
    .filter((c) => c.role !== "received" && c.role !== "not_received")
    .map((c) => ({
      ...c,
      percentage: dialed === 0 ? null : Math.round((c.count / dialed) * 100),
    }));

  return { dialed, notReceivedPercentage, subcategories };
}

export function generateRemarks(entries: { name: string; description?: string; role?: string | null; count: number }[]) {
  const stats = remarkStats(entries);
  if (stats.dialed === 0 && stats.subcategories.every((c) => c.count === 0)) {
    return "No calls logged yet today.";
  }
  const parts: string[] = [];
  if (stats.dialed > 0) {
    parts.push(`Today, out of ${stats.dialed} dialed calls, ${stats.notReceivedPercentage}% were unanswered.`);
  }
  return parts.join(" ") || "Daily tallies recorded.";
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

export type Visitor = { name: string; at: string; phone?: string | undefined; notes?: string | undefined };

export type AdditionalFormDetails = {
  averageWorkingHours?: string;
  leadTypeFollowedUp?: string;
  systemCallbackRemarks?: string;
  confirmedVisitsTomorrow?: string;
  highIntentFollowupsTomorrow?: string;
  totalRevisitCommitments?: string;
  scheduledVisits?: string;
  actualShowUps?: string;
  unscheduledVisits?: string;
  totalVisits?: string;
  toursConducted?: string;
  todayHighlight?: string;
  remainingClusters?: string;
  challengesFaced?: string;
};

export type DailyReport = {
  day: string;
  counters: { name: string; description?: string; role: string | null; count: number }[];
  visitors: Visitor[];
  totals: ReturnType<typeof computeTotals>;
  additional?: AdditionalFormDetails;
  remarks?: string;
};

export function createReport(
  day: string,
  counters: Counter[],
  counts: Record<string, number>,
  visitors: Visitor[]
): DailyReport {
  const entries = counters.map((c) => ({
    name: c.name,
    description: c.description,
    role: c.role,
    count: counts[c.id] ?? 0,
  }));
  return {
    day,
    counters: entries,
    visitors: visitors.map((v) => ({ ...v })),
    totals: computeTotals(counters, counts),
    remarks: generateRemarks(entries),
  };
}

export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Generate smart greeting based on user's local hour and day — no emojis
export function getSmartGreeting(fullName?: string | null): { greeting: string; subtext: string } {
  const now = new Date();
  const hour = now.getHours();
  const dayIndex = now.getDay(); // 0 is Sunday, 6 is Saturday

  let rawName = fullName?.trim() || "";
  if (!rawName) rawName = "there";
  else {
    rawName = rawName.split(" ")[0] ?? "there";
  }

  if (hour >= 5 && hour < 12) {
    const morningQuotes = [
      { greeting: `Namaste, ${rawName}`, subtext: "Let's kick off today's calls with positive energy." },
      { greeting: `Good morning, ${rawName}`, subtext: "Ready to connect with today's aspiring students?" },
      { greeting: `Subha Bihani, ${rawName}`, subtext: "Fresh start for the day. Let's make every call count." },
    ];
    return morningQuotes[dayIndex % morningQuotes.length] ?? morningQuotes[0]!;
  } else if (hour >= 12 && hour < 17) {
    const afternoonQuotes = [
      { greeting: `Good afternoon, ${rawName}`, subtext: "Great momentum. Keep the conversations going strong." },
      { greeting: `Namaste, ${rawName}`, subtext: "Midday check-in: turn those leads into confirmed visits." },
    ];
    return afternoonQuotes[dayIndex % afternoonQuotes.length] ?? afternoonQuotes[0]!;
  } else if (hour >= 17 && hour < 21) {
    const eveningQuotes = [
      { greeting: `Good evening, ${rawName}`, subtext: "Wrapping up your day? Let's review and log your progress." },
      { greeting: `Namaste, ${rawName}`, subtext: "Almost time to generate your daily report for the team." },
    ];
    return eveningQuotes[dayIndex % eveningQuotes.length] ?? eveningQuotes[0]!;
  } else {
    return {
      greeting: `Welcome, ${rawName}`,
      subtext: "Working late? Don't forget to save today's tallies.",
    };
  }
}

// Match the EXACT 1-32 sequence of questions in the Google Form
export function generateGoogleFormReport(
  day: string,
  email: string,
  userName: string,
  counters: Counter[],
  counts: Record<string, number>,
  visitors: Visitor[],
  extra?: AdditionalFormDetails
): string {
  const byRole = (r: Role) =>
    counters.filter((c) => c.role === r).reduce((s, c) => s + (counts[c.id] ?? 0), 0);
  const byName = (query: string) => {
    const q = query.toLowerCase();
    return counters
      .filter((c) => c.name.toLowerCase().includes(q))
      .reduce((s, c) => s + (counts[c.id] ?? 0), 0);
  };

  const totals = computeTotals(counters, counts);

  const callsAttempted = totals.dialed;
  const callsConnected = totals.received;
  const sysCallbacks = byRole("callback") || byName("system callbacks");
  const interestedTomorrow = byRole("interested_visit") || byName("interested for visit tomorrow");
  const registeredEvent = byRole("registered_event") || byName("registered for event");
  const interestedFollowup = byRole("interested_followup") || byName("interested but needs follow-up");
  const discussParents = byRole("discuss_parents") || byName("will discuss with parents");
  const alreadyJoined = byRole("already_joined") || byName("already joined another college");
  const turningLater = byRole("turning_later") || byName("turning up later");
  const scholarshipHesitation = byRole("scholarship_hesitation") || byName("scholarship related hesitation");
  const feesHesitation = byRole("fees_hesitation") || byName("fees related hesitation");
  const courseUnavailable = byRole("course_unavailable") || byName("course not available");
  const notInterested = byRole("not_interested") || byName("not interested");
  const wrongNumber = byRole("wrong") || byName("wrong number");
  const alreadyVisited = byRole("already_visited") || byName("already visited the college");

  // Custom added categories (not in standard predefined roles)
  const customCounters = counters
    .filter((c) => !c.role)
    .map((c) => `${c.name}: ${counts[c.id] ?? 0}`)
    .join(", ");

  const lines = [
    `========================================`,
    `IIC - FOOTSET TEAM DAILY REPORT`,
    `Date: ${day}`,
    `Generated in exact Google Form sequence:`,
    `========================================`,
    `1. Email: ${email || "N/A"}`,
    `2. Full Name: ${userName || "N/A"}`,
    `3. Calls Attempted: ${callsAttempted}`,
    `4. Calls Connected: ${callsConnected}`,
    `5. System Callbacks (Inbound): ${sysCallbacks}`,
    `6. Average Working Hours: ${extra?.averageWorkingHours || "8 hrs"}`,
    `7. System Callbacks (Inbound) Remarks: ${extra?.systemCallbackRemarks || "Addressed all inbound callbacks"}`,
    `8. Type of lead followed-up: ${extra?.leadTypeFollowedUp || "Autumn 2026 Walk-ins, Inquiries & Web leads"}`,
    `9. Interested for visit tomorrow: ${interestedTomorrow}`,
    `10. Registered for event: ${registeredEvent}`,
    `11. Interested but needs follow-up: ${interestedFollowup}`,
    `12. Will discuss with parents: ${discussParents}`,
    `13. Already joined another college: ${alreadyJoined}`,
    `14. Turning up later (after results): ${turningLater}`,
    `15. Scholarship related hesitation: ${scholarshipHesitation > 0 ? `${scholarshipHesitation} student(s) requested higher scholarship slabs` : "None"}`,
    `16. Fees related hesitation: ${feesHesitation > 0 ? `${feesHesitation}` : "0"}`,
    `17. Course not available: ${courseUnavailable}`,
    `18. Not interested: ${notInterested}`,
    `19. Wrong Number/invalid: ${wrongNumber}`,
    `20. Already visited the college: ${alreadyVisited}`,
    `21. Total confirmed visits for tomorrow: ${extra?.confirmedVisitsTomorrow ?? interestedTomorrow}`,
    `22. Total high intent follow-ups for tomorrow: ${extra?.highIntentFollowupsTomorrow ?? interestedFollowup}`,
    `23. Total revisit commitments: ${extra?.totalRevisitCommitments || "0"}`,
    `24. Total event registrations: ${registeredEvent}`,
    `25. Scheduled Visits: ${extra?.scheduledVisits || "0"}`,
    `26. Actual show-ups: ${extra?.actualShowUps || (visitors.length > 0 ? String(visitors.length) : "0")}`,
    `27. Unscheduled/Same-Day Visits: ${extra?.unscheduledVisits || "0"}`,
    `28. Total Visits: ${extra?.totalVisits || (visitors.length > 0 ? String(visitors.length) : "0")}`,
    `29. Total number of Tours Conducted: ${extra?.toursConducted || "0"}`,
    `30. Today's highlight (Call Center): ${extra?.todayHighlight || `Connected with ${callsConnected} students. ${interestedTomorrow} scheduled to visit tomorrow.`}`,
    `31. Remaining Clusters (If any): ${extra?.remainingClusters || "None"}`,
    `32. Any Challenges or issued faced today?: ${extra?.challengesFaced || "No"}`,
  ];

  if (customCounters) {
    lines.push(`\n[Custom Categories Recorded]: ${customCounters}`);
  }

  if (visitors.length > 0) {
    lines.push(`\n[Interested Visitors List]:`);
    visitors.forEach((v, idx) => {
      lines.push(`  ${idx + 1}. ${v.name} (${v.at})${v.phone ? ` - ${v.phone}` : ""}${v.notes ? ` [${v.notes}]` : ""}`);
    });
  }

  return lines.join("\n");
}

export const GOOGLE_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLSfwI6OwoYmS-Hr2aiEKqVX4jmHclYD-w9ACCMec0eO1G0-ZYQ/viewform";

// Build a pre-filled Google Form link. Every question maps to its form entry id.
export function buildGoogleFormUrl(
  userName: string,
  counters: Counter[],
  counts: Record<string, number>,
  visitors: Visitor[],
  extra?: AdditionalFormDetails
): string {
  const byRole = (r: Role) =>
    counters.filter((c) => c.role === r).reduce((s, c) => s + (counts[c.id] ?? 0), 0);
  const totals = computeTotals(counters, counts);
  const entries = counters.map((c) => ({ name: c.name, description: c.description, role: c.role, count: counts[c.id] ?? 0 }));
  const n = (v: number) => String(v);
  const interestedTomorrow = byRole("interested_visit");
  const interestedFollowup = byRole("interested_followup");
  const registeredEvent = byRole("registered_event");
  const visits = visitors.length ? String(visitors.length) : "0";

  const fields: Record<string, string> = {
    "1730418201": userName,
    "832632953": n(totals.dialed),
    "200805351": n(totals.received),
    "1128954890": n(byRole("callback")),
    "1831190935": extra?.averageWorkingHours || "",
    "90844432": extra?.systemCallbackRemarks || "",
    "1472111117": extra?.leadTypeFollowedUp || "",
    "414298434": n(interestedTomorrow),
    "1494255321": n(registeredEvent),
    "300589199": n(interestedFollowup),
    "1009387427": n(byRole("discuss_parents")),
    "237277338": n(byRole("already_joined")),
    "827842377": n(byRole("turning_later")),
    "626698672": n(byRole("scholarship_hesitation")),
    "350764422": n(byRole("fees_hesitation")),
    "1441020440": n(byRole("course_unavailable")),
    "2095609115": n(byRole("not_interested")),
    "782223962": n(byRole("wrong")),
    "276740164": n(byRole("already_visited")),
    "496643595": extra?.confirmedVisitsTomorrow || n(interestedTomorrow),
    "1954288534": extra?.highIntentFollowupsTomorrow || n(interestedFollowup),
    "698735490": extra?.totalRevisitCommitments || "0",
    "1428293084": n(registeredEvent),
    "1115169643": extra?.scheduledVisits || "0",
    "1185209817": extra?.actualShowUps || visits,
    "158577648": extra?.unscheduledVisits || "0",
    "377102298": extra?.totalVisits || visits,
    "1733014439": extra?.toursConducted || "0",
    "1558839317": extra?.todayHighlight || generateRemarks(entries),
    "629150067": extra?.remainingClusters || "None",
    "1869393770": extra?.challengesFaced || "No",
  };

  const params = new URLSearchParams({ usp: "pp_url" });
  for (const [id, value] of Object.entries(fields)) {
    if (value) params.append(`entry.${id}`, value);
  }
  return `${GOOGLE_FORM_BASE}?${params.toString()}`;
}
