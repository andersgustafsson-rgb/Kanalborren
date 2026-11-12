import { isSupabaseConfigured, supabase } from "./supabase";

export type CompanyRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  sessionId: string | null;
  message: string;
  proposedTime: string | null;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  expiresAt: string;
  chatId: string | null;
  createdAt: string;
  fromName?: string;
  toName?: string;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

function mapRequest(
  row: Record<string, unknown>,
  fromName?: string,
  toName?: string,
): CompanyRequest {
  return {
    id: String(row.id),
    fromUserId: String(row.from_user_id),
    toUserId: String(row.to_user_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    message: String(row.message || ""),
    proposedTime: row.proposed_time ? String(row.proposed_time) : null,
    status: row.status as CompanyRequest["status"],
    expiresAt: String(row.expires_at),
    chatId: row.chat_id ? String(row.chat_id) : null,
    createdAt: String(row.created_at),
    fromName,
    toName,
  };
}

export async function sendCompanyRequest(input: {
  toUserId: string;
  sessionId?: string | null;
  message: string;
  proposedTime?: string | null;
}): Promise<{ error: string | null; id?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Molnet är inte inkopplat" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in först" };
  if (user.id === input.toUserId) {
    return { error: "Du kan inte fråga dig själv" };
  }
  const msg = input.message.trim();
  if (!msg || msg.length > 200) {
    return { error: "Meddelande 1–200 tecken" };
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("company_requests")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) {
    return { error: "Max 5 förfrågningar per timme" };
  }

  const { data, error } = await supabase
    .from("company_requests")
    .insert({
      from_user_id: user.id,
      to_user_id: input.toUserId,
      session_id: input.sessionId || null,
      message: msg,
      proposed_time: input.proposedTime || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}

export async function listMyCompanyRequests(): Promise<CompanyRequest[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("company_requests")
    .select(
      "id,from_user_id,to_user_id,session_id,message,proposed_time,status,expires_at,chat_id,created_at",
    )
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data) {
    console.warn("listMyCompanyRequests", error);
    return [];
  }

  const ids = [
    ...new Set(data.flatMap((r) => [r.from_user_id, r.to_user_id])),
  ] as string[];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", ids);
  const nameById = new Map(
    (profiles || []).map((p) => [p.id as string, p.display_name as string]),
  );

  return data.map((r) =>
    mapRequest(
      r as unknown as Record<string, unknown>,
      nameById.get(r.from_user_id as string),
      nameById.get(r.to_user_id as string),
    ),
  );
}

export async function respondCompanyRequest(
  requestId: string,
  accept: boolean,
): Promise<{ error: string | null; chatId?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Molnet är inte inkopplat" };
  }
  if (accept) {
    const { data, error } = await supabase.rpc("accept_company_request", {
      request_id: requestId,
    });
    if (error) return { error: error.message };
    return { error: null, chatId: data as string };
  }
  const { error } = await supabase.rpc("decline_company_request", {
    request_id: requestId,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function listChatMessages(
  chatId: string,
): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,chat_id,sender_id,body,created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !data) {
    console.warn("listChatMessages", error);
    return [];
  }
  return data.map((m) => ({
    id: String(m.id),
    chatId: String(m.chat_id),
    senderId: String(m.sender_id),
    body: String(m.body),
    createdAt: String(m.created_at),
  }));
}

export async function sendChatMessage(
  chatId: string,
  body: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Molnet är inte inkopplat" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in först" };
  const text = body.trim();
  if (!text || text.length > 1000) {
    return { error: "Meddelande 1–1000 tecken" };
  }
  const { error } = await supabase.from("chat_messages").insert({
    chat_id: chatId,
    sender_id: user.id,
    body: text,
  });
  return { error: error?.message ?? null };
}

/** Deletes chat + messages for either participant; marks the request cancelled. */
export async function deleteMyChat(
  chatId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Molnet är inte inkopplat" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in först" };
  const { error } = await supabase.rpc("delete_my_chat", {
    p_chat_id: chatId,
  });
  return { error: error?.message ?? null };
}

export function subscribeCompanyInbox(
  userId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured() || !supabase) return () => {};
  const channel = supabase
    .channel(`company_inbox_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "company_requests" },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_messages" },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase!.removeChannel(channel);
  };
}
