import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Hash,
  LoaderCircle,
  MessageCircle,
  MessagesSquare,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Smile,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { createKeys, loadKeys, openMessage, type LocalKeys, type Member } from "@/lib/e2ee";
import { isMemberOnline } from "@/lib/team";
import {
  GROUP_CONVERSATION,
  conversationIdFor,
  conversationMessages,
  loadReadTimes,
  mergeMessages,
  saveReadTimes,
  unreadByConversation,
} from "@/lib/chat";
import {
  loadMutedConversations,
  loadSoundEnabled,
  playMessageSound,
  previewMessageSound,
  saveMutedConversations,
  saveSoundEnabled,
} from "@/lib/notifications";

type Row = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string | null;
  ciphertext: string;
  iv: string;
  wrapped_keys: Json | null;
  created_at: string;
};
type Shown = Row & { text: string | null };
type ChatMember = Member & { last_seen_at: string | null };
const GROUP = GROUP_CONVERSATION;
const EMOJIS = ["👍", "🔥", "🎉", "📞", "☕", "❤️", "😂", "🙌", "👏", "✅", "💯", "😊", "🤝", "💪"];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
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
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<Shown[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nickname, setNickname] = useState(fullName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const membersRef = useRef<ChatMember[]>([]);
  const keysRef = useRef<LocalKeys | null>(null);

  const loadMembers = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("workspace_members")
      .select("user_id, full_name, public_key, last_seen_at")
      .order("full_name");
    if (loadError) throw loadError;
    const list = (data ?? []) as unknown as ChatMember[];
    membersRef.current = list;
    setMembers(list);
    return list;
  }, []);

  const decryptRow = useCallback(async (row: Row): Promise<Shown> => {
    if (row.body !== null) return { ...row, text: row.body };
    const localKeys = keysRef.current;
    if (!localKeys) return { ...row, text: null };
    const otherId = row.recipient_id === null ? row.sender_id : row.sender_id === userId ? row.recipient_id : row.sender_id;
    const other = otherId === userId
      ? { public_key: localKeys.publicJwk }
      : membersRef.current.find((member) => member.user_id === otherId);
    try {
      if (!other) throw new Error("Missing legacy message key");
      return { ...row, text: await openMessage(localKeys.privateKey, userId, row, other.public_key) };
    } catch {
      return { ...row, text: null };
    }
  }, [userId]);

  const loadMessages = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (loadError) {
      setMessageError("Messages could not be refreshed. Check your connection and try again.");
      return;
    }
    const rows = ((data ?? []) as Row[]).reverse();
    const shown = await Promise.all(rows.map(decryptRow));
    setMessages((current) => mergeMessages(current, shown));
    setMessageError("");
  }, [decryptRow]);

  useEffect(() => {
    setReadAt(loadReadTimes(userId));
    setMuted(loadMutedConversations(userId));
    setSoundEnabled(loadSoundEnabled(userId));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    (async () => {
      const list = await loadMembers();
      const me = list.find((member) => member.user_id === userId);
      if (cancelled) return;
      if (!me) {
        setStatus("join");
        return;
      }
      setNickname(me.full_name);
      // Never replace a member's public key merely because another device lacks
      // the original browser key. New messages do not depend on that legacy key.
      const localKeys = await loadKeys(userId).catch(() => undefined);
      if (cancelled) return;
      keysRef.current = localKeys ?? null;
      setActive((current) => current ?? GROUP);
      setStatus("ready");
      onMembershipChange?.();
    })().catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Team chat could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loadMembers, onMembershipChange]);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    const heartbeat = async () => {
      await supabase.from("workspace_members").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId);
      if (!cancelled) await loadMembers().catch(() => undefined);
    };
    void heartbeat();
    const interval = window.setInterval(heartbeat, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [status, userId, loadMembers]);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    void loadMessages();
    const poll = window.setInterval(() => void loadMessages(), 30000);
    const onFocus = () => void loadMessages();
    window.addEventListener("focus", onFocus);
    const channel = supabase
      .channel(`chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const row = payload.new as Row;
        const shown = await decryptRow(row);
        if (cancelled) return;
        setMessages((current) => mergeMessages(current, [shown]));
        if (row.sender_id !== userId) playMessageSound(userId, conversationIdFor(row, userId));
      })
      .subscribe();
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [status, userId, loadMessages, decryptRow]);

  useEffect(() => {
    if (!open || !active) return;
    const timestamp = new Date().toISOString();
    setReadAt((current) => {
      const next = { ...current, [active]: timestamp };
      saveReadTimes(userId, next);
      return next;
    });
  }, [open, active, messages, userId]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onOpenChange]);

  const memberMap = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);
  const onlineCount = members.filter((member) => member.user_id === userId || isMemberOnline(member.last_seen_at)).length;
  const unread = useMemo(() => unreadByConversation(messages, userId, readAt), [messages, userId, readAt]);
  const unreadTotal = Object.values(unread).reduce((sum, count) => sum + count, 0);

  const selectConversation = (id: string) => {
    setActive(id);
    setProfileOpen(false);
  };

  const refreshChat = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([loadMembers().catch(() => undefined), loadMessages()]);
    setRefreshing(false);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveSoundEnabled(userId, next);
    if (next) previewMessageSound();
  };

  const toggleMute = (id: string) => {
    setMuted((current) => {
      const next = { ...current, [id]: !current[id] };
      saveMutedConversations(userId, next);
      return next;
    });
  };

  const saveNickname = async () => {
    const clean = nickname.trim();
    if (!clean || nameBusy) return;
    setNameBusy(true);
    setNameMessage("");
    const { error: saveError } = await supabase
      .from("workspace_members")
      .update({ full_name: clean })
      .eq("user_id", userId);
    if (saveError) {
      setNameMessage("Could not save your nickname. Please try again.");
    } else {
      setNickname(clean);
      setNameMessage("Nickname saved.");
      await loadMembers().catch(() => undefined);
      onMembershipChange?.();
    }
    setNameBusy(false);
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
      <aside
        className={`chat-drawer ${open ? "chat-drawer--open" : ""}`}
        aria-label="Team chat"
        aria-hidden={!open}
        aria-modal={open}
        role="dialog"
        inert={!open}
      >
        <div className="chat-drawer__topbar">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessagesSquare className="h-4 w-4 shrink-0" /> Team chat</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {status === "ready" ? `${onlineCount} online · ${members.length} members` : "Private coworker conversations"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {status === "ready" && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => void refreshChat()}
                  aria-label="Refresh chat"
                  title="Refresh chat"
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={toggleSound}
                  aria-label={soundEnabled ? "Turn off all chat and achievement sounds" : "Turn on chat and achievement sounds"}
                  title={soundEnabled ? "Sounds on" : "Sounds off"}
                  aria-pressed={soundEnabled}
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className={`btn btn--ghost btn--icon ${profileOpen ? "bg-secondary" : ""}`}
                  onClick={() => {
                    setProfileOpen((shown) => !shown);
                    setNameMessage("");
                    setNickname(memberMap.get(userId)?.full_name ?? fullName);
                  }}
                  aria-label="Edit chat nickname"
                  aria-expanded={profileOpen}
                  title="Chat nickname"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </>
            )}
            <button type="button" className="btn btn--ghost btn--icon" onClick={() => onOpenChange(false)} aria-label="Close team chat" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {profileOpen && status === "ready" && (
          <form
            className="chat-profile"
            onSubmit={(event) => {
              event.preventDefault();
              void saveNickname();
            }}
          >
            <label htmlFor="chat-nickname" className="text-xs font-semibold text-foreground">Chat nickname</label>
            <div className="mt-2 flex gap-2">
              <input
                id="chat-nickname"
                className="chat-field"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={40}
                autoComplete="nickname"
                placeholder="How coworkers see you"
              />
              <button type="submit" className="btn btn--primary shrink-0" disabled={nameBusy || !nickname.trim()}>
                {nameBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {nameBusy ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Used in chats, the member list, and caller progress.</p>
            {nameMessage && <p className={`mt-1 text-xs ${nameMessage.includes("saved") ? "text-foreground" : "text-destructive"}`} role="status">{nameMessage}</p>}
          </form>
        )}

        {error && (
          <div className="m-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--outline mt-3" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
        {status === "loading" && !error && (
          <div className="flex flex-1 items-center justify-center" aria-label="Loading team chat">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {status === "join" && !error && (
          <JoinCard
            defaultName={fullName}
            onJoined={async (localKeys) => {
              keysRef.current = localKeys;
              setKeys(localKeys);
              await loadMembers();
              setActive(GROUP);
              setStatus("ready");
              onMembershipChange?.();
            }}
            userId={userId}
          />
        )}
        {status === "ready" && !error && (
          <>
            {messageError && (
              <div className="chat-sync-error" role="alert">
                <span>{messageError}</span>
                <button type="button" onClick={() => void loadMessages()}>Retry</button>
              </div>
            )}
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
                  muted={Boolean(muted[GROUP])}
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
                <p className="chat-section-label mt-4">Coworkers · {members.filter((member) => member.user_id !== userId).length}</p>
                {members.filter((member) => member.user_id !== userId).length === 0 && <p className="px-2 text-xs text-muted-foreground">No one else has joined yet.</p>}
                {members.filter((member) => member.user_id !== userId).map((member) => (
                  <ConvoButton
                    key={member.user_id}
                    active={active === member.user_id}
                    onClick={() => selectConversation(member.user_id)}
                    avatar={initials(member.full_name)}
                    title={member.full_name}
                    last={preview(messages, member.user_id, userId)}
                    memberMap={memberMap}
                    userId={userId}
                    online={isMemberOnline(member.last_seen_at)}
                    unread={unread[member.user_id] ?? 0}
                    muted={Boolean(muted[member.user_id])}
                  />
                ))}
              </div>
              <section className={`chat-pane ${active ? "" : "chat-hide-mobile"}`}>
                {active ? (
                  <Conversation
                    key={active}
                    id={active}
                    title={active === GROUP ? "Footset Team Lounge" : memberMap.get(active)?.full_name ?? "Coworker"}
                    messages={conversationMessages(messages, active, userId)}
                    memberMap={memberMap}
                    userId={userId}
                    onlineCount={onlineCount}
                    muted={Boolean(muted[active])}
                    onToggleMute={() => toggleMute(active)}
                    onBack={() => setActive(null)}
                    onSent={(shown) => setMessages((current) => mergeMessages(current, [shown]))}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-8 w-8" />
                    <p className="text-sm">Pick the team group or a coworker to start chatting.</p>
                    <p className="text-xs">Your conversations stay synced across your signed-in devices.</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </>
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
  muted: boolean;
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
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-semibold text-foreground">{props.title}</span>
            {props.muted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Muted" />}
          </span>
          {last && <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(last.created_at)}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{last ? `${who}: ${last.text ?? "Older encrypted message"}` : "No messages yet"}</span>
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
  memberMap: Map<string, ChatMember>;
  userId: string;
  onlineCount: number;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onSent: (shown: Shown) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGroup = props.id === GROUP;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [props.id, props.messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError("");
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          sender_id: props.userId,
          recipient_id: isGroup ? null : props.id,
          body,
          // Empty legacy fields keep old deployments' non-null constraints satisfied.
          ciphertext: "",
          iv: "",
          wrapped_keys: null,
        })
        .select()
        .single();
      if (error) throw error;
      props.onSent({ ...(data as Row), text: body });
      setText("");
      setShowEmojis(false);
    } catch (reason) {
      setSendError(reason instanceof Error ? reason.message : "Message not sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-conversation">
      <header className="chat-header">
        <button type="button" className="btn btn--ghost chat-back" onClick={props.onBack} aria-label="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="chat-avatar">{isGroup ? <Hash className="h-4 w-4" /> : initials(props.title)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{props.title}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0" /> Workspace protected{isGroup ? ` · ${props.onlineCount} online` : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--icon shrink-0"
          onClick={props.onToggleMute}
          aria-label={props.muted ? `Unmute ${props.title}` : `Mute ${props.title}`}
          aria-pressed={props.muted}
          title={props.muted ? "Unmute this chat" : "Mute this chat"}
        >
          {props.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
      </header>
      <div className="chat-messages" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions">
        {props.messages.length === 0 && <p className="m-auto text-center text-xs text-muted-foreground">No messages here yet. Say hello 👋</p>}
        {props.messages.map((message, index) => {
          const mine = message.sender_id === props.userId;
          const previous = props.messages[index - 1];
          const showName = isGroup && !mine && previous?.sender_id !== message.sender_id;
          return (
            <div key={message.id} className={`chat-row ${mine ? "chat-row--mine" : ""}`}>
              {showName && <p className="chat-name">{props.memberMap.get(message.sender_id)?.full_name ?? "Coworker"}</p>}
              <div className={`chat-bubble ${mine ? "chat-bubble--mine" : ""}`}>
                {message.text ?? <span className="italic opacity-70">Older encrypted message available only on its original device</span>}
              </div>
              <p className="chat-time">{timeLabel(message.created_at)}</p>
            </div>
          );
        })}
      </div>
      {sendError && <p className="chat-send-error" role="alert">{sendError}</p>}
      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
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
          onChange={(event) => setText(event.target.value)}
          placeholder={isGroup ? "Message the team…" : `Message ${props.title.split(" ")[0]}…`}
          maxLength={4000}
          aria-label="Message"
          disabled={sending}
        />
        <button type="submit" className="btn btn--primary btn--icon" disabled={!text.trim() || sending} aria-label="Send message">
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function JoinCard({ defaultName, userId, onJoined }: { defaultName: string; userId: string; onJoined: (keys: LocalKeys) => void }) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const join = async () => {
    setBusy(true);
    setMessage("");
    try {
      const localKeys = (await loadKeys(userId)) ?? (await createKeys(userId));
      const { data, error } = await supabase.rpc("join_workspace", {
        _code: code,
        _full_name: name,
        _public_key: localKeys.publicJwk as Json,
      });
      if (error) throw error;
      if (!data) {
        setMessage("That workspace code isn't right. Ask your team lead for it.");
        return;
      }
      onJoined(localKeys);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not join the team chat.");
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
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && code.trim()) void join();
        }}
      >
        <label className="text-xs font-medium text-muted-foreground">
          Your chat nickname
          <input className="chat-field mt-1 w-full rounded-lg" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Workspace code
          <input className="chat-field mt-1 w-full rounded-lg uppercase" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Workspace code" autoComplete="off" />
        </label>
        {message && <p className="text-xs text-destructive" role="alert">{message}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy || !name.trim() || !code.trim()}>
          {busy ? "Joining…" : "Join team"}
        </button>
      </form>
    </div>
  );
}
