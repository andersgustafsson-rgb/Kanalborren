/** Force phones to drop stale PWA/service-worker icon caches once. */
const ICON_CACHE_VER = "kh-icons-v5";

export async function bumpPwaIconCache(): Promise<void> {
  try {
    if (localStorage.getItem("pwaIconVer") === ICON_CACHE_VER) return;
    localStorage.setItem("pwaIconVer", ICON_CACHE_VER);

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // One hard reload so the next "Add to Home Screen" sees new icons.
    const url = new URL(window.location.href);
    if (url.searchParams.get("iconbump") === "1") return;
    url.searchParams.set("iconbump", "1");
    window.location.replace(url.toString());
  } catch {
    /* ignore */
  }
}
