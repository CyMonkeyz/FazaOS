import type { SoraDbClient } from "./types";

const db = (client: SoraDbClient | any) => client as any;
export async function rememberExplicit(
  userId: string,
  text: string,
  channel: "web" | "telegram",
  client: SoraDbClient | any,
) {
  const match = text
    .trim()
    .match(
      /^(?:tolong\s+)?(?:ingat(?:lah)?(?:\s+ini)?|selalu\s+(?:ingat|lakukan)|gunakan\s+gaya\s+ini)\s*[:,-]?\s*(.+)$/i,
    );
  if (!match?.[1] || match[1].length < 3) return null;
  const content = match[1].trim().slice(0, 1000);
  const key = `explicit:${content
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 64)}`;
  const { data: before } = await db(client)
    .from("sora_profile_memories")
    .select("id,content")
    .eq("user_id", userId)
    .eq("memory_key", key)
    .maybeSingle();
  const { data, error } = await db(client)
    .from("sora_profile_memories")
    .upsert(
      {
        user_id: userId,
        category: "other",
        memory_key: key,
        content,
        source_channel: channel,
        deleted_at: null,
      },
      { onConflict: "user_id,memory_key" },
    )
    .select("id,content")
    .maybeSingle();
  if (error) return null;
  await db(client)
    .from("sora_memory_audit")
    .insert({
      user_id: userId,
      memory_id: data.id,
      action: before ? "update" : "create",
      before_value: before ?? null,
      after_value: data,
      channel,
    });
  return data;
}
export async function saveConversationMessage(
  userId: string,
  channel: "web" | "telegram",
  conversationKey: string,
  role: "user" | "assistant",
  content: string,
  client: SoraDbClient | any,
) {
  if (!content.trim()) return;
  await db(client)
    .from("sora_conversation_messages")
    .insert({
      user_id: userId,
      channel,
      conversation_key: conversationKey.slice(0, 180),
      role,
      content: content.trim().slice(0, 4000),
    });
}
export async function getUnifiedMemory(
  userId: string,
  conversationKey: string,
  client: SoraDbClient | any,
) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [{ data: profile }, { data: conversation }] = await Promise.all([
    db(client)
      .from("sora_profile_memories")
      .select("category,content")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(24),
    db(client)
      .from("sora_conversation_messages")
      .select("role,content,channel,created_at")
      .eq("user_id", userId)
      .eq("conversation_key", conversationKey.slice(0, 180))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  return `PERMANENT PROFILE MEMORY:\n${(profile ?? []).map((m: any) => `- [${m.category}] ${m.content}`).join("\n") || "Belum ada."}\n\nCONVERSATION MEMORY TERBARU:\n${
    (conversation ?? [])
      .reverse()
      .map((m: any) => `${m.role === "user" ? "Tuan" : "Sora"}: ${String(m.content).slice(0, 300)}`)
      .join("\n") || "Belum ada."
  }`;
}
