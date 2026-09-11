import type { Conversation } from "./assistant";

export interface ChatThread extends Conversation {
  id: string;
  title: string;
  draft: string;
  createdAt: number;
  updatedAt: number;
}
export interface ChatLibrary {
  activeId: string;
  threads: ChatThread[];
}
export const CHAT_CHANGED = "whop:conversations-changed";
export const CHAT_OPEN = "whop:conversation-open";
export const chatKey = (account: string) =>
  `whopdesktop.conversations.${account}`;
export function newThread(): ChatThread {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    draft: "",
    sessionId: null,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function recoverThread(t: ChatThread): ChatThread {
  return {
    ...t,
    draft: t.draft ?? "",
    messages: t.messages.map((m) =>
      m.streaming
        ? {
            ...m,
            streaming: false,
            error:
              "This reply was interrupted when the app closed. You can continue the conversation.",
            blocks: m.blocks.map((b) =>
              b.type === "tool" && !b.call.done
                ? {
                    ...b,
                    call: {
                      ...b.call,
                      done: true,
                      isError: true,
                      output: b.call.output ?? "Interrupted",
                    },
                  }
                : b,
            ),
          }
        : m,
    ),
  };
}
export function loadLibrary(
  account: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): ChatLibrary {
  try {
    const saved = JSON.parse(storage.getItem(chatKey(account)) ?? "null");
    if (
      saved?.threads?.length &&
      saved.threads.every(
        (t: ChatThread) =>
          typeof t.id === "string" && Array.isArray(t.messages),
      )
    ) {
      const threads = saved.threads.map(recoverThread);
      return {
        activeId: threads.some((t: ChatThread) => t.id === saved.activeId)
          ? saved.activeId
          : threads[0].id,
        threads,
      };
    }
    const legacy = JSON.parse(
      storage.getItem(`whopdesktop.chat.${account}`) ?? "null",
    );
    if (Array.isArray(legacy?.messages) && legacy.messages.length) {
      const t = recoverThread({ ...newThread(), ...legacy });
      t.title = threadTitle(t);
      return { activeId: t.id, threads: [t] };
    }
  } catch {
    /* Preserve old storage; start a fresh usable workspace. */
  }
  const t = newThread();
  return { activeId: t.id, threads: [t] };
}
export function threadTitle(t: Conversation): string {
  const first = t.messages.find((m) => m.role === "user");
  return (
    first?.blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 72) || "New conversation"
  );
}
export function saveLibrary(account: string, library: ChatLibrary) {
  localStorage.setItem(chatKey(account), JSON.stringify(library));
  window.dispatchEvent(new CustomEvent(CHAT_CHANGED, { detail: { account, running:library.threads.some(t=>t.messages.some(m=>m.streaming)) } }));
}
