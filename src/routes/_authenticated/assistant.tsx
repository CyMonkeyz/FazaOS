import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { PageHeader } from "@/components/ui-lite";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Sparkles, RotateCcw, Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Sora Brain — Faza OS" }] }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Data apa saja yang kamu tahu di Faza OS?",
  "Hari ini hari apa dan jam berapa, Sora?",
  "Bagaimana kondisi keuangan bulan ini, Sora?",
  "Tugas apa yang paling dekat deadline-nya?",
  "Ringkas penjualan bisnis bulan ini.",
  "Bagaimana performa portofolio investasi saya?",
  "Ada agenda apa hari ini di Google Calendar?",
];

function AssistantPage() {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session?.access_token) {
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
          }
          headers.set("X-Sora-Session", sessionId);
          return fetch(url, { ...init, headers });
        },
      }),
    [sessionId],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: sessionId,
    transport,
    onError: (e) => toast.error(e.message || "Gagal memuat respon"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    await sendMessage({ text: t });
  };

  const newSession = () => {
    setMessages([] as UIMessage[]);
    setSessionId(crypto.randomUUID());
  };

  const markdownComponents = useMemo(
    () => ({
      table: ({ children }: { children?: ReactNode }) => (
        <div className="my-2 overflow-x-auto rounded-md border">
          <table className="min-w-full border-collapse text-xs">{children}</table>
        </div>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th className="border-b bg-muted px-2 py-1.5 text-left font-semibold">{children}</th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className="border-t px-2 py-1.5 align-top">{children}</td>
      ),
      code: ({ children, className }: { children?: ReactNode; className?: string }) => {
        const block = /language-/.test(className ?? "");
        return block ? (
          <code className={className}>{children}</code>
        ) : (
          <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>
        );
      },
      pre: ({ children }: { children?: ReactNode }) => (
        <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{children}</pre>
      ),
    }),
    [],
  );

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-4rem)]">
      <div className="flex items-start justify-between gap-2">
        <PageHeader
          title="Sora Brain"
          subtitle="Asisten pribadi Tuan — tahu uang, tugas, agenda, bisnis, investasi."
        />
        <Button variant="ghost" size="sm" onClick={newSession} title="Sesi baru">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-full bg-gradient-to-br from-primary/20 to-accent/20 p-3">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="text-sm font-semibold">Halo, Tuan. Saya Sora Brain.</div>
            <div className="text-xs text-muted-foreground max-w-xs">
              Saya tahu semua data & modul Faza OS Tuan — termasuk hari & jam sekarang. Coba
              tanyakan:
            </div>
            <div className="mt-2 grid w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border bg-card p-3 text-left text-sm hover:border-primary hover:bg-primary/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const tools = m.parts.filter((p) => p.type.startsWith("tool-"));
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-card border"}`}
              >
                {tools.length > 0 && !isUser && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {tools.map((t, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <Sparkles className="h-2.5 w-2.5" /> {t.type.replace("tool-", "")}
                      </span>
                    ))}
                  </div>
                )}
                {text ? (
                  <div
                    className={
                      isUser
                        ? ""
                        : "prose prose-sm prose-neutral max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
                    }
                  >
                    {isUser ? (
                      text
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {text}
                      </ReactMarkdown>
                    )}
                  </div>
                ) : busy && !isUser ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>
          );
        })}

        {busy && messages.at(-1)?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl border bg-card px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Sora sedang berpikir…
              </div>
            </div>
          </div>
        )}

        {error && (
          <Card className="border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error.message}
          </Card>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-0 flex gap-2 border-t bg-background pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya Sora Brain…"
          className="flex-1 rounded-full border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} className="rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
