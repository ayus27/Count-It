import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ArrowLeft, Hash, Lock, Send, ShieldCheck } from "lucide-react";
import {
  createKeys,
  loadKeys,
  openMessage,
  sealDirect,
  sealGroup,
  type LocalKeys,
  type Member,
} from "@/lib/e2ee";

type Row = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  ciphertext: string;
  iv: string;
  wrapped_keys: Json | null;
  created_at: string;
};
type Shown = Row & { text: string | null };
const GROUP = "group";

function initials(n: string) {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}
function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TeamChat({ userId, fullName }: { userId: string; fullName: string }) {
  const [status, setStatus] = useState<"loading" | "join" | "ready">("loading");
  const [keys, setKeys] = useState<LocalKeys | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Shown[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadMembers = async () => {
    const { data } = await supabase.from("workspace_members").select("user_id, full_name, public_key").order("full_name");
    const list = (data ?? []) as unknown as Member[];
    setMembers(list);
    return list;
  };

  useEffect(() => {
    (async () => {
      const list = await loadMembers();
      const me = list.find((m) => m.user_id === userId);
      if (!me) return setStatus("join");
      let k = await loadKeys(userId);
      if (!k || k.publicJwk.x !== me.public_key.x) {
        // New device or cleared browser: make a fresh key (older messages stay unreadable here).
        k = await createKeys(userId);
        await supabase.from("workspace_members").update({ public_key: k.publicJwk as Json }).eq("user_id", userId);
        await loadMembers();
      }
      setKeys(k);
      setStatus("ready");
    })().catch((e) => setError(String(e?.message ?? e)));
  }, [userId]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const decrypt = async (r: Row, k: LocalKeys, map: Map<string, Member>): Promise<Shown> => {
    const otherId = r.recipient_id === null ? r.sender_id : r.sender_id === userId ? r.recipient_id : r.sender_id;
    const other = otherId === userId ? { public_key: k.publicJwk } : map.get(otherId);
    try {
      if (!other) throw new Error();
      return { ...r, text: await openMessage(k.privateKey, userId, r, other.public_key) };
    } catch {
      return { ...r, text: null };
    }
  };

  useEffect(() => {
    if (status !== "ready" || !keys) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at").limit(500);
      const shown = await Promise.all(((data ?? []) as Row[]).map((r) => decrypt(r, keys, memberMap)));
      if (!cancelled) setMessages(shown);
    })();
    const ch = supabase
      .channel(`chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (p) => {
        const r = p.new as Row;
        let map = memberMap;
        if (!map.has(r.sender_id)) map = new Map((await loadMembers()).map((m) => [m.user_id, m]));
        const s = await decrypt(r, keys, map);
        setMessages((prev) => (prev.some((m) => m.id === s.id) ? prev : [...prev, s]));
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, keys, members.length]);

  if (error) return <div className="section-panel mt-6 text-sm text-destructive">{error}</div>;
  if (status === "loading")
    return (
      <div className="mt-12 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  if (status === "join")
    return (
      <JoinCard
        defaultName={fullName}
        onJoined={async (k) => {
          setKeys(k);
          await loadMembers();
          setStatus("ready");
        }}
        userId={userId}
      />
    );

  const convo = (id: string) =>
    messages.filter((m) =>
      id === GROUP
        ? m.recipient_id === null
        : m.recipient_id !== null &&
          ((m.sender_id === userId && m.recipient_id === id) || (m.sender_id === id && m.recipient_id === userId)),
    );
  const others = members.filter((m) => m.user_id !== userId);
  const preview = (id: string) => {
    const c = convo(id);
    return c[c.length - 1];
  };

  return (
    <div className="chat-shell mt-6">
      <aside className={`chat-sidebar ${active ? "chat-hide-mobile" : ""}`}>
        <p className="chat-section-label">Groups</p>
        <ConvoButton
          active={active === GROUP}
          onClick={() => setActive(GROUP)}
          avatar={<Hash className="h-4 w-4" />}
          title="Footset Team Lounge"
          last={preview(GROUP)}
          memberMap={memberMap}
          userId={userId}
        />
        <p className="chat-section-label mt-4">Coworkers · {others.length}</p>
        {others.length === 0 && <p className="px-2 text-xs text-muted-foreground">No one else has joined yet.</p>}
        {others.map((m) => (
          <ConvoButton
            key={m.user_id}
            active={active === m.user_id}
            onClick={() => setActive(m.user_id)}
            avatar={initials(m.full_name)}
            title={m.full_name}
            last={preview(m.user_id)}
            memberMap={memberMap}
            userId={userId}
          />
        ))}
      </aside>
      <section className={`chat-pane ${active ? "" : "chat-hide-mobile"}`}>
        {active && keys ? (
          <Conversation
            key={active}
            id={active}
            title={active === GROUP ? "Footset Team Lounge" : memberMap.get(active)?.full_name ?? "Coworker"}
            messages={convo(active)}
            members={members}
            memberMap={memberMap}
            userId={userId}
            keys={keys}
            onBack={() => setActive(null)}
            onSent={(s) => setMessages((prev) => (prev.some((m) => m.id === s.id) ? prev : [...prev, s]))}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8" />
            <p className="text-sm">Pick the team group or a coworker to start chatting.</p>
            <p className="text-xs">Messages are scrambled on your device — no one else, not even the app owner, can read them.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ConvoButton(props: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  title: string;
  last: Shown | undefined;
  memberMap: Map<string, Member>;
  userId: string;
}) {
  const { last } = props;
  const who = last ? (last.sender_id === props.userId ? "You" : props.memberMap.get(last.sender_id)?.full_name.split(" ")[0]) : "";
  return (
    <button type="button" className={`chat-convo ${props.active ? "chat-convo--active" : ""}`} onClick={props.onClick}>
      <span className="chat-avatar">{props.avatar}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{props.title}</span>
          {last && <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(last.created_at)}</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {last ? `${who}: ${last.text ?? "🔒 Encrypted message"}` : "No messages yet"}
        </span>
      </span>
    </button>
  );
}

function Conversation(props: {
  id: string;
  title: string;
  messages: Shown[];
  members: Member[];
  memberMap: Map<string, Member>;
  userId: string;
  keys: LocalKeys;
  onBack: () => void;
  onSent: (s: Shown) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const isGroup = props.id === GROUP;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [props.messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr("");
    try {
      let sealed;
      if (isGroup) {
        sealed = await sealGroup(props.keys.privateKey, props.members, body);
      } else {
        const them = props.memberMap.get(props.id);
        if (!them) throw new Error("Coworker not found");
        sealed = await sealDirect(props.keys.privateKey, them, body);
      }
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          sender_id: props.userId,
          recipient_id: isGroup ? null : props.id,
          ciphertext: sealed.ciphertext,
          iv: sealed.iv,
          wrapped_keys: sealed.wrapped_keys as Json,
        })
        .select()
        .single();
      if (error) throw error;
      props.onSent({ ...(data as Row), text: body });
      setText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="chat-header">
        <button type="button" className="btn btn--ghost chat-back" onClick={props.onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="chat-avatar">{isGroup ? <Hash className="h-4 w-4" /> : initials(props.title)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{props.title}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> End-to-end encrypted{isGroup ? ` · ${props.members.length} members` : ""}
          </p>
        </div>
      </header>
      <div className="chat-messages">
        {props.messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground">Say hi 👋</p>
        )}
        {props.messages.map((m, i) => {
          const mine = m.sender_id === props.userId;
          const prev = props.messages[i - 1];
          const showName = isGroup && !mine && prev?.sender_id !== m.sender_id;
          return (
            <div key={m.id} className={`chat-row ${mine ? "chat-row--mine" : ""}`}>
              {showName && <p className="chat-name">{props.memberMap.get(m.sender_id)?.full_name ?? "Coworker"}</p>}
              <div className={`chat-bubble ${mine ? "chat-bubble--mine" : ""}`}>
                {m.text ?? <span className="italic opacity-70">🔒 Can't be opened on this device</span>}
              </div>
              <p className="chat-time">{timeLabel(m.created_at)}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {err && <p className="px-4 text-xs text-destructive">{err}</p>}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="chat-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isGroup ? "Message the team…" : `Message ${props.title.split(" ")[0]}…`}
          maxLength={4000}
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim() || sending} aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function JoinCard({ defaultName, userId, onJoined }: { defaultName: string; userId: string; onJoined: (k: LocalKeys) => void }) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const join = async () => {
    setBusy(true);
    setMsg("");
    try {
      const k = (await loadKeys(userId)) ?? (await createKeys(userId));
      const { data, error } = await supabase.rpc("join_workspace", {
        _code: code,
        _full_name: name,
        _public_key: k.publicJwk as Json,
      });
      if (error) throw error;
      if (!data) return setMsg("That workspace code isn't right. Ask your team lead for it.");
      onJoined(k);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section-panel mx-auto mt-6 max-w-md">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="text-lg font-bold text-foreground">Join the team chat</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Enter the workspace code shared by your supervisor to chat with the Footset team.</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && code.trim()) join();
        }}
      >
        <label className="text-xs font-medium text-muted-foreground">
          Your full name
          <input className="chat-field mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Workspace code
          <input className="chat-field mt-1 w-full uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. TEAMCODE" />
        </label>
        {msg && <p className="text-xs text-destructive">{msg}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy || !name.trim() || !code.trim()}>
          {busy ? "Joining…" : "Join team"}
        </button>
      </form>
    </div>
  );
}
