import { useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthContext";
import {
  ensureNotifyPermission,
  hasAskedNotifyBefore,
  showAppNotification,
} from "../lib/notifications";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

/**
 * Listens for incoming chat / sällskap events and shows a device notification.
 */
export function ChatNotifyBridge() {
  const auth = useAuth();
  const readyRef = useRef(false);

  useEffect(() => {
    if (!auth.user || !isSupabaseConfigured() || !supabase) return;

    // Ask once after login (not every page load spam if denied).
    if (!hasAskedNotifyBefore()) {
      void ensureNotifyPermission();
    }

    const userId = auth.user.id;
    // Ignore events for a short moment after subscribe (avoid backlog noise).
    const arm = window.setTimeout(() => {
      readyRef.current = true;
    }, 1500);

    const channel = supabase
      .channel(`notify_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            sender_id?: string;
            body?: string;
            chat_id?: string;
          };
          if (!row?.sender_id || row.sender_id === userId) return;
          const body = String(row.body || "Nytt meddelande").slice(0, 120);
          void showAppNotification({
            title: "KanalHugget · chatt",
            body,
            url: "/karta",
            tag: `chat-${row.chat_id || "x"}`,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_requests" },
        (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            to_user_id?: string;
            from_user_id?: string;
            message?: string;
          };
          if (!row?.to_user_id || row.to_user_id !== userId) return;
          if (row.from_user_id === userId) return;
          void showAppNotification({
            title: "KanalHugget · sällskap",
            body: String(row.message || "Ny förfrågan om sällskap").slice(
              0,
              120,
            ),
            url: "/karta",
            tag: "company-request",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "challenges" },
        (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            to_user_id?: string;
            from_user_id?: string;
            species?: string;
          };
          if (!row?.to_user_id || row.to_user_id !== userId) return;
          if (row.from_user_id === userId) return;
          void showAppNotification({
            title: "KanalHugget · utmaning",
            body: `Du är utmanad${row.species ? ` · ${row.species}` : ""}`,
            url: "/",
            tag: "challenge",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fishing_sessions" },
        (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            id?: string;
            user_id?: string;
            visibility?: string;
            zone_name?: string | null;
            ended_at?: string | null;
          };
          if (!row?.user_id || row.user_id === userId) return;
          if (row.ended_at) return;
          if (row.visibility !== "zone" && row.visibility !== "precise") return;
          const where = row.zone_name?.trim() || "kanalen";
          void showAppNotification({
            title: "KanalHugget · ute nu",
            body: `Någon checkade in · ${where}`,
            url: "/karta",
            tag: `checkin-${row.id || row.user_id}`,
          });
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(arm);
      readyRef.current = false;
      void supabase!.removeChannel(channel);
    };
  }, [auth.user]);

  return null;
}
