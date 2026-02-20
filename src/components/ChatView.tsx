import { useEffect, useRef, useMemo, useCallback, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UIMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { SummaryBlock } from "./SummaryBlock";
import { ToolCall } from "./ToolCall";

interface ChatViewProps {
  messages: UIMessage[];
  extraBottomPadding?: boolean;
  scrollToMessageId?: string;
  onScrolledToMessage?: () => void;
}

export const ChatView = memo(function ChatView({ messages, extraBottomPadding, scrollToMessageId, onScrolledToMessage }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef(0);

  // Throttled auto-scroll: instant during streaming, only if near bottom
  const scrollToBottom = useCallback(() => {
    const now = Date.now();
    if (now - scrollTimerRef.current < 250) return; // throttle ~4/sec
    scrollTimerRef.current = now;

    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (!isNearBottom) return;

    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Scroll to specific message (from search navigation)
  useEffect(() => {
    if (!scrollToMessageId) return;
    const el = scrollAreaRef.current?.querySelector(`[data-message-id="${scrollToMessageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash highlight
      el.classList.add("search-highlight");
      const timer = setTimeout(() => {
        el.classList.remove("search-highlight");
        onScrolledToMessage?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
    // If element not found yet (messages still loading), try again
    const retry = setTimeout(() => {
      const retryEl = scrollAreaRef.current?.querySelector(`[data-message-id="${scrollToMessageId}"]`);
      if (retryEl) {
        retryEl.scrollIntoView({ behavior: "smooth", block: "center" });
        retryEl.classList.add("search-highlight");
        setTimeout(() => {
          retryEl.classList.remove("search-highlight");
          onScrolledToMessage?.();
        }, 1500);
      } else {
        onScrolledToMessage?.();
      }
    }, 500);
    return () => clearTimeout(retry);
  }, [scrollToMessageId, onScrolledToMessage]);

  // Pre-compute continuation IDs in O(n) forward pass
  const continuationIds = useMemo(() => {
    const ids = new Set<string>();
    let lastRole: string | null = null;
    for (const msg of messages) {
      if (msg.role === "assistant") {
        if (lastRole === "assistant" || lastRole === "tool_call" || lastRole === "tool_result" || lastRole === "system" || lastRole === "summary") {
          ids.add(msg.id);
        }
        lastRole = "assistant";
      } else if (msg.role === "user") {
        lastRole = "user";
      } else {
        // tool_call, tool_result, system, summary: don't reset assistant chain
        if (lastRole !== null) {
          lastRole = lastRole === "user" ? "user" : lastRole;
        }
      }
    }
    return ids;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">Send a message to start</p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Your conversation will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
      <div className={`pt-14 ${extraBottomPadding ? "pb-56" : "pb-36"}`}>
        {messages.map((msg) => {
          if (msg.role === "tool_call") {
            return <div key={msg.id} data-message-id={msg.id} className="message-item"><ToolCall message={msg} /></div>;
          }
          if (msg.role === "tool_result") return null;
          if (msg.role === "summary") {
            return <div key={msg.id} data-message-id={msg.id} className="message-item"><SummaryBlock message={msg} /></div>;
          }

          return (
            <div key={msg.id} data-message-id={msg.id} className="message-item">
              <MessageBubble
                message={msg}
                isContinuation={continuationIds.has(msg.id)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
});
