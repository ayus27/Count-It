import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ArrowLeft, Hash, Lock, MessageCircle, MessagesSquare, Send, ShieldCheck, Smile, UsersRound, X } from "lucide-react";
import {
  createKeys,
  loadKeys,
  openMessage,
  sealDirect,
  sealGroup,
  type LocalKeys,
  type Member,
} from "@/lib/e2ee";
import { isMemberOnline } from "@/lib/team";

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
type ChatMember = Member & { last_seen_at: string | null };
const GROUP = "group";
const EMOJIS = ["👍", "🔥", "🎉", "📞", "☕", "❤️", "😂", "🙌", "👏", "✅", "💯", "😊", "🤝", "💪"];

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

export function TeamChat({
  userId,
  fullName,
  open,
  onOpenChange,
  onMembershipChange,
}: {
  userId: string;
  fullName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMembershipChange?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "join" | "ready">("loading");
  const [keys, setKeys] = useState<LocalKeys | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<Shown[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const openRef = useRef(open);
  const activeRef = useRef(active);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    if (open && active) setUnread((current) => ({ ...current, [active]: 0 }));
  }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onOpenChange]);

  const loadMembers = async () => {
    const { data } = await supabase
      .from("workspace_members")
      .select("user_id, full_name, public_key, last_seen_at")
      .order("full_name");
    const list = (data ?? []) as unknown as ChatMember[];
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
        k = await createKeys(userId);
        await supabase.from("workspace_members").update({ public_key: k.publicJwk as Json }).eq("user_id", userId);
        await loadMembers();
      }
      setKeys(k);
      setActive((current) => current ?? GROUP);
      setStatus("ready");
      onMembershipChange?.();
    })().catch((e) => setError(String(e?.message ?? e)));
  }, [userId, onMembershipChange]);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    const heartbeat = async () => {
      await supabase.from("workspace_members").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId);
      if (!cancelled) await loadMembers();
    };
    void heartbeat();
    const interval = window.setInterval(heartbeat, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [status, userId]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const onlineCount = members.filter((member) => member.user_id === userId || isMemberOnline(member.last_seen_at)).length;
  const unreadTotal = Object.values(unread).reduce((sum, count) => sum + count, 0);

  const decrypt = async (r: Row, k: LocalKeys, map: Map<string, ChatMember>): Promise<Shown> => {
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
        if (r.sender_id !== userId) {
          const conversationId = r.recipient_id === null ? GROUP : r.sender_id;
          if (!openRef.current || activeRef.current !== conversationId) {
            setUnread((current) => ({ ...current, [conversationId]: (current[conversationId] ?? 0) + 1 }));
          }
        }
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
    // The member count refreshes keys for newly joined coworkers without re-subscribing for every heartbeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, keys, members.length]);

  const selectConversation = (id: string) => {
    setActive(id);
    setUnread((current) => ({ ...current, [id]: 0 }));
  };

  return (
    <>
      <button
        type="button"
        className="chat-dock"
        onClick={() => onOpenChange(true)}
        aria-label={`Open team chat${unreadTotal ? `, ${unreadTotal} unread messages` : ""}`}
        aria-expanded={open}
      >
        <span className="chat-dock__icon">
          <MessagesSquare className="h-5 w-5" />
          {unreadTotal > 0 && <span className="chat-dock__badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
        </span>
        <span className="chat-dock__label">Team chat</span>
        <span className="chat-dock__online">{onlineCount} online</span>
      </button>

      {open && <button type="button" className="chat-backdrop" aria-label="Close team chat" onClick={() => onOpenChange(false)} />}
      <aside className={`chat-drawer ${open ? "chat-drawer--open" : ""}`} aria-label="Team chat" aria-hidden={!open} inert={!open}>
        <div className="chat-drawer__topbar">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessagesSquare className="h-4 w-4" /> Team chat</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{status === "ready" ? `${onlineCount} online · ${members.length} members` : "Private coworker conversations"}</p>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => onOpenChange(false)} aria-label="Close team chat">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <div className="m-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
        {status === "loading" && !error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {status === "join" && !error && (
          <JoinCard
            defaultName={fullName}
            onJoined={async (k) => {
              setKeys(k);
              await loadMembers();
              setActive(GROUP);
              setStatus("ready");
              onMembershipChange?.();
            }}
            userId={userId}
          />
        )}
        {status === "ready" && !error && (
          <div className="chat-shell">
            <div className={`chat-sidebar ${active ? "chat-hide-mobile" : ""}`}>
              <p className="chat-section-label">Group</p>
              <ConvoButton
                active={active === GROUP}
                onClick={() => selectConversation(GROUP)}
                avatar={<Hash className="h-4 w-4" />}
                title="Footset Team Lounge"
                last={preview(messages, GROUP, userId)}
                memberMap={memberMap}
                userId={userId}
                unread={unread[GROUP] ?? 0}
              />
              <details className="chat-roster">
                <summary><UsersRound className="h-3.5 w-3.5" /> {members.length} group members</summary>
                <div className="mt-2 space-y-2">
                  {members.map((member) => (
                    <div key={member.user_id} className="chat-roster__member">
                      <span className={`status-dot ${member.user_id === userId || isMemberOnline(member.last_seen_at) ? "status-dot--online" : ""}`} />
                      <span className="truncate">{member.full_name}{member.user_id === userId ? " (you)" : ""}</span>
                    </div>
                  ))}
                </div>
              </details>
              <p className="chat-section-label mt-4">Coworkers · {members.filter((m) => m.user_id !== userId).length}</p>
              {members.filter((m) => m.user_id !== userId).length === 0 && <p className="px-2 text-xs text-muted-foreground">No one else has joined yet.</p>}
              {members.filter((m) => m.user_id !== userId).map((m) => (
                <ConvoButton
                  key={m.user_id}
                  active={active === m.user_id}
                  onClick={() => selectConversation(m.user_id)}
                  avatar={initials(m.full_name)}
                  title={m.full_name}
                  last={preview(messages, m.user_id, userId)}
                  memberMap={memberMap}
                  userId={userId}
                  online={isMemberOnline(m.last_seen_at)}
                  unread={unread[m.user_id] ?? 0}
                />
              ))}
            </div>
            <section className={`chat-pane ${active ? "" : "chat-hide-mobile"}`}>
              {active && keys ? (
                <Conversation
                  key={active}
                  id={active}
                  title={active === GROUP ? "Footset Team Lounge" : memberMap.get(active)?.full_name ?? "Coworker"}
                  messages={conversationMessages(messages, active, userId)}
                  members={members}
                  memberMap={memberMap}
                  userId={userId}
                  keys={keys}
                  onlineCount={onlineCount}
                  onBack={() => setActive(null)}
                  onSent={(s) => setMessages((prev) => (prev.some((m) => m.id === s.id) ? prev : [...prev, s]))}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                  <ShieldCheck className="h-8 w-8" />
                  <p className="text-sm">Pick the team group or a coworker to start chatting.</p>
                  <p className="text-xs">Messages are encrypted on your device before they are saved.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </aside>
    </>
  );
}

function conversationMessages(messages: Shown[], id: string, userId: string) {
  return messages.filter((m) =>
    id === GROUP
      ? m.recipient_id === null
      : m.recipient_id !== null &&
        ((m.sender_id === userId && m.recipient_id === id) || (m.sender_id === id && m.recipient_id === userId)),
  );
}
function preview(messages: Shown[], id: string, userId: string) {
  const conversation = conversationMessages(messages, id, userId);
  return conversation[conversation.length - 1];
}

function ConvoButton(props: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  title: string;
  last: Shown | undefined;
  memberMap: Map<string, ChatMember>;
  userId: string;
  online?: boolean;
  unread: number;
}) {
  const { last } = props;
  const who = last ? (last.sender_id === props.userId ? "You" : props.memberMap.get(last.sender_id)?.full_name.split(" ")[0]) : "";
  return (
    <button type="button" className={`chat-convo ${props.active ? "chat-convo--active" : ""}`} onClick={props.onClick}>
      <span className="chat-avatar-wrap">
        <span className="chat-avatar">{props.avatar}</span>
        {typeof props.online === "boolean" && <span className={`chat-avatar__status ${props.online ? "chat-avatar__status--online" : ""}`} />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{props.title}</span>
          {last && <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(last.created_at)}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{last ? `${who}: ${last.text ?? "Encrypted message"}` : "No messages yet"}</span>
          {props.unread > 0 && <span className="chat-convo__unread">{props.unread}</span>}
        </span>
      </span>
    </button>
  );
}

function Conversation(props: {
  id: string;
  title: string;
  messages: Shown[];
  members: ChatMember[];
  memberMap: Map<string, ChatMember>;
  userId: string;
  keys: LocalKeys;
  onlineCount: number;
  onBack: () => void;
  onSent: (s: Shown) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
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
      setShowEmojis(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="chat-header">
        <button type="button" className="btn btn--ghost chat-back" onClick={props.onBack} aria-label="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="chat-avatar">{isGroup ? <Hash className="h-4 w-4" /> : initials(props.title)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{props.title}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> End-to-end encrypted{isGroup ? ` · ${props.onlineCount} online` : ""}
          </p>
        </div>
      </header>
      <div className="chat-messages">
        {props.messages.length === 0 && <p className="mt-8 text-center text-xs text-muted-foreground">Start the conversation.</p>}
        {props.messages.map((m, i) => {
          const mine = m.sender_id === props.userId;
          const prev = props.messages[i - 1];
          const showName = isGroup && !mine && prev?.sender_id !== m.sender_id;
          return (
            <div key={m.id} className={`chat-row ${mine ? "chat-row--mine" : ""}`}>
              {showName && <p className="chat-name">{props.memberMap.get(m.sender_id)?.full_name ?? "Coworker"}</p>}
              <div className={`chat-bubble ${mine ? "chat-bubble--mine" : ""}`}>
                {m.text ?? <span className="italic opacity-70">This message cannot be opened on this device</span>}
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
          void send();
        }}
      >
        <div className="chat-emoji">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Choose an emoji"
            aria-expanded={showEmojis}
            onClick={() => setShowEmojis((shown) => !shown)}
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmojis && (
            <div className="chat-emoji__tray" role="group" aria-label="Quick emojis">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => setText((current) => `${current}${emoji}`)} aria-label={`Add ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          className="chat-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isGroup ? "Message the team…" : `Message ${props.title.split(" ")[0]}…`}
          maxLength={4000}
          aria-label="Message"
        />
        <button type="submit" className="btn btn--primary btn--icon" disabled={!text.trim() || sending} aria-label="Send message">
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
    <div className="section-panel m-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="text-lg font-bold text-foreground">Join the team chat</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Enter the workspace code shared by your supervisor to chat with the Footset team.</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && code.trim()) void join();
        }}
      >
        <label className="text-xs font-medium text-muted-foreground">
          Your full name
          <input className="chat-field mt-1 w-full rounded-lg" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Workspace code
          <input className="chat-field mt-1 w-full rounded-lg uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Workspace code" />
        </label>
        {msg && <p className="text-xs text-destructive">{msg}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy || !name.trim() || !code.trim()}>
          {busy ? "Joining…" : "Join team"}
        </button>
      </form>
    </div>
  );
}
