import {
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
  saveMutedConversations,
  saveSoundEnabled,
} from "@/lib/notifications";

const message = (id: string, sender: string, recipient: string | null, createdAt: string) => ({
  id,
  sender_id: sender,
  recipient_id: recipient,
  created_at: createdAt,
});

describe("chat history", () => {
  it("keeps direct messages in the correct conversation for both participants", () => {
    expect(conversationIdFor(message("1", "a", "b", ""), "a")).toBe("b");
    expect(conversationIdFor(message("1", "a", "b", ""), "b")).toBe("a");
    expect(conversationIdFor(message("2", "a", null, ""), "b")).toBe("group");
  });

  it("merges refreshed history and realtime inserts without duplicate or reordered messages", () => {
    const first = message("1", "a", null, "2026-11-16T10:00:00.000Z");
    const second = message("2", "b", null, "2026-11-16T10:01:00.000Z");
    const third = message("3", "a", null, "2026-11-16T10:02:00.000Z");
    expect(mergeMessages([first, third], [second, third])).toEqual([first, second, third]);
  });

  it("counts unread group and direct messages using each conversation's read time", () => {
    const messages = [
      message("1", "a", null, "2026-11-16T10:00:00.000Z"),
      message("2", "b", "me", "2026-11-16T10:02:00.000Z"),
      message("3", "me", null, "2026-11-16T10:03:00.000Z"),
    ];
    expect(unreadByConversation(messages, "me", { group: "2026-11-16T10:01:00.000Z" })).toEqual({ b: 1 });
    expect(conversationMessages(messages, "b", "me")).toEqual([messages[1]]);
  });
});

describe("chat preferences", () => {
  beforeEach(() => localStorage.clear());

  it("persists read times, per-chat mute, and global sound independently", () => {
    saveReadTimes("me", { group: "2026-11-16T10:01:00.000Z" });
    saveMutedConversations("me", { group: true });
    saveSoundEnabled("me", false);
    expect(loadReadTimes("me")).toEqual({ group: "2026-11-16T10:01:00.000Z" });
    expect(loadMutedConversations("me")).toEqual({ group: true });
    expect(loadSoundEnabled("me")).toBe(false);
    expect(loadMutedConversations("someone-else")).toEqual({});
    expect(loadSoundEnabled("someone-else")).toBe(true);
  });
});
