export const GROUP_CONVERSATION = "group";

export type ChatMessageLike = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  created_at: string;
};

export function conversationIdFor(message: Pick<ChatMessageLike, "sender_id" | "recipient_id">, viewerId: string) {
  if (message.recipient_id === null) return GROUP_CONVERSATION;
  return message.sender_id === viewerId ? message.recipient_id : message.sender_id;
}

export function conversationMessages<T extends ChatMessageLike>(messages: T[], id: string, userId: string) {
  return messages.filter((message) => conversationIdFor(message, userId) === id);
}

/** Merge realtime and refreshed history without duplicates or out-of-order bubbles. */
export function mergeMessages<T extends ChatMessageLike>(current: T[], incoming: T[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function unreadByConversation<T extends ChatMessageLike>(
  messages: T[],
  userId: string,
  readAt: Record<string, string>,
) {
  const unread: Record<string, number> = {};
  for (const message of messages) {
    if (message.sender_id === userId) continue;
    const conversationId = conversationIdFor(message, userId);
    const lastRead = readAt[conversationId];
    if (!lastRead || message.created_at > lastRead) unread[conversationId] = (unread[conversationId] ?? 0) + 1;
  }
  return unread;
}

const readTimesKey = (userId: string) => `team-chat-read-at:${userId}`;

export function loadReadTimes(userId: string): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(readTimesKey(userId)) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export function saveReadTimes(userId: string, readAt: Record<string, string>) {
  try {
    localStorage.setItem(readTimesKey(userId), JSON.stringify(readAt));
  } catch {
    // Chat still works when browser storage is unavailable.
  }
}
