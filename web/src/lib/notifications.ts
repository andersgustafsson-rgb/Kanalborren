const PERM_ASKED_KEY = "kanalhugget.notifyAsked.v1";

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function ensureNotifyPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  try {
    localStorage.setItem(PERM_ASKED_KEY, "1");
  } catch {
    /* ignore */
  }
  return result === "granted";
}

export function hasAskedNotifyBefore(): boolean {
  try {
    return localStorage.getItem(PERM_ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function showAppNotification(input: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const opts: NotificationOptions = {
    body: input.body,
    tag: input.tag || "kanalhugget",
    icon: "/brand/kanalhugget-logo.png",
    badge: "/brand/kanalhugget-logo.png",
    data: { url: input.url || "/karta" },
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(input.title, opts);
        return;
      }
    }
  } catch {
    /* fall through */
  }

  const n = new Notification(input.title, opts);
  n.onclick = () => {
    window.focus();
    if (input.url) window.location.assign(input.url);
    n.close();
  };
}
