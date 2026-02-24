import { useEffect, useRef } from "react";
import type { PermissionRequest } from "@/types";
import type { NotificationSettings, NotificationTrigger } from "@/types/ui";

// ── Defaults (used when AppSettings hasn't loaded yet) ──

const FALLBACK: NotificationSettings = {
  exitPlanMode: { osNotification: "unfocused", sound: "always" },
  permissions: { osNotification: "unfocused", sound: "unfocused" },
  askUserQuestion: { osNotification: "unfocused", sound: "always" },
  sessionComplete: { osNotification: "unfocused", sound: "always" },
};

// ── Lazy-created and cached Audio element ──

let cachedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!cachedAudio) {
    cachedAudio = new Audio("/sounds/notification.wav");
    cachedAudio.volume = 0.6;
  }
  return cachedAudio;
}

// ── Helpers ──

/** Check if a trigger condition is met given current window focus state. */
function shouldFire(trigger: NotificationTrigger): boolean {
  if (trigger === "never") return false;
  if (trigger === "always") return true;
  // "unfocused" — only fire when the document is hidden (window not focused)
  return document.hidden;
}

/** Fire OS notification + sound based on event settings. */
function fireNotification(
  eventSettings: { osNotification: NotificationTrigger; sound: NotificationTrigger },
  title: string,
  body: string,
): void {
  if (shouldFire(eventSettings.osNotification)) {
    // Web Notification API — Electron auto-grants permission.
    // silent: true prevents OS from playing its own sound (we manage sound separately).
    const notification = new Notification(title, { body, silent: true });
    notification.onclick = () => window.focus();
  }

  if (shouldFire(eventSettings.sound)) {
    const audio = getAudio();
    audio.currentTime = 0; // reset in case a previous play is still going
    audio.play().catch(() => {
      // Autoplay may be blocked in some edge cases — ignore silently
    });
  }
}

/** Map a permission request's toolName to one of the three event types. */
function classifyEvent(
  toolName: string,
): "exitPlanMode" | "askUserQuestion" | "permissions" {
  if (toolName === "ExitPlanMode") return "exitPlanMode";
  if (toolName === "AskUserQuestion") return "askUserQuestion";
  return "permissions";
}

/** Human-readable notification content for each event type. */
function getNotificationContent(
  eventType: "exitPlanMode" | "askUserQuestion" | "permissions",
  request: PermissionRequest,
): { title: string; body: string } {
  switch (eventType) {
    case "exitPlanMode":
      return {
        title: "Ready to implement",
        body: "Claude has a plan and is waiting for your approval.",
      };
    case "askUserQuestion": {
      const questions = request.toolInput?.questions as
        | Array<{ question: string }>
        | undefined;
      return {
        title: "Question from Claude",
        body: questions?.[0]?.question ?? "Claude is asking you a question.",
      };
    }
    case "permissions": {
      const filePath = request.toolInput?.file_path as string | undefined;
      const command = request.toolInput?.command as string | undefined;
      const detail = filePath ?? (command ? String(command).slice(0, 80) : "");
      return {
        title: "Permission required",
        body: detail
          ? `Allow ${request.toolName}: ${detail}?`
          : `Allow ${request.toolName}?`,
      };
    }
  }
}

// ── Hook ──

interface UseNotificationsOptions {
  pendingPermission: PermissionRequest | null;
  notificationSettings: NotificationSettings | null;
  /** Whether the agent is currently processing (used to detect session completion) */
  isProcessing: boolean;
}

export function useNotifications({
  pendingPermission,
  notificationSettings,
  isProcessing,
}: UseNotificationsOptions): void {
  const settings = notificationSettings ?? FALLBACK;

  // ── Permission-based notifications ──

  // Track the last permission requestId we fired for — prevents re-firing on re-renders
  const lastFiredId = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingPermission) {
      lastFiredId.current = null;
      return;
    }

    // Don't fire again for the same permission request
    if (lastFiredId.current === pendingPermission.requestId) return;
    lastFiredId.current = pendingPermission.requestId;

    const eventType = classifyEvent(pendingPermission.toolName);
    const eventSettings = settings[eventType];
    const { title, body } = getNotificationContent(eventType, pendingPermission);
    fireNotification(eventSettings, title, body);
  }, [pendingPermission, settings]);

  // ── Session completion notification ──

  // Track previous isProcessing to detect true → false transitions
  const prevProcessing = useRef(isProcessing);

  useEffect(() => {
    const wasBusy = prevProcessing.current;
    prevProcessing.current = isProcessing;

    // Only fire when transitioning from processing → done
    if (wasBusy && !isProcessing) {
      fireNotification(
        settings.sessionComplete,
        "Task complete",
        "Claude has finished processing.",
      );
    }
  }, [isProcessing, settings]);
}
