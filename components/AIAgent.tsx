"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { Sparkles, X, Send, Trash2, AlertCircle, ArrowDownToLine, BookOpen, Bookmark, MessageSquare } from "lucide-react";

const SUGGESTIONS_BY_PATH: Record<string, string[]> = {
  "/forecast/lrp": [
    "What's driving 2027 net sales?",
    "Update product share for 2028 to 0.22",
    "Compare current to last saved version",
  ],
  "/forecast/review/lrp": [
    "Why did 2030 drop $200M between v3 and v4?",
    "Which driver moves the forecast the most?",
    "Show peak-year drift across versions",
  ],
  "/forecast/stf": [
    "Why are we behind plan this month?",
    "Override week of 2026-04-20 to 4,000 units",
    "Surface underperforming territories",
  ],
  "/forecast/connect": [
    "Run Seek-to-Forecast for $5.8B in 2027",
    "Where is STF diverging from LRP?",
    "Why is Q2 in drift status?",
  ],
  "/forecast/plan": [
    "Run $25M Balanced optimization",
    "What's the marginal ROI at $40M?",
    "Why is DTC excluded at $10M?",
  ],
};

function suggestionsFor(path: string): string[] {
  for (const key of Object.keys(SUGGESTIONS_BY_PATH).sort((a, b) => b.length - a.length)) {
    if (path.startsWith(key)) return SUGGESTIONS_BY_PATH[key];
  }
  return SUGGESTIONS_BY_PATH["/forecast/lrp"];
}

export function AIAgentToggle() {
  const open = useStore((s) => s.agentOpen);
  const setAgentOpen = useStore((s) => s.setAgentOpen);
  if (open) return null;
  return (
    <button
      onClick={() => setAgentOpen(true)}
      title="Open ForecastIQ Copilot"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-secondary text-white hover:bg-secondary-light shadow-lg shadow-black/20 transition-all hover:scale-[1.03]"
    >
      <Sparkles size={18} className="text-primary" />
      <span className="text-sm font-semibold">Ask Copilot</span>
    </button>
  );
}

export function AIAgent() {
  const open = useStore((s) => s.agentOpen);
  const setAgentOpen = useStore((s) => s.setAgentOpen);
  const messages = useStore((s) => s.agentMessages);
  const sendAgentMessage = useStore((s) => s.sendAgentMessage);
  const typing = useStore((s) => s.agentTyping);
  const clearAgentMessages = useStore((s) => s.clearAgentMessages);
  const pathname = usePathname() ?? "/forecast/lrp";
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, open]);

  if (!open) return null;

  const suggestions = suggestionsFor(pathname);

  function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput("");
    void sendAgentMessage(t, pathname);
  }

  return (
    <aside className="w-[420px] flex-shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] bg-surface border-l border-border flex flex-col z-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <div>
            <div className="font-heading font-bold text-sm">ForecastIQ Copilot</div>
            <div className="text-[10px] text-white/70">Demo placeholder · responses are illustrative</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => clearAgentMessages()}
            title="Clear conversation"
            className="text-white/70 hover:text-white p-1"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setAgentOpen(false)}
            title="Close"
            className="text-white/70 hover:text-white p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Capability strip */}
      <div className="px-4 py-2 bg-primary-light/30 border-b border-border text-[11px] text-secondary">
        <div className="flex items-center gap-2">
          <BookOpen size={12} />
          <span>I can investigate forecasts, compare versions, run scenarios, and update assumptions in plain English.</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="bg-background rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="text-primary mt-0.5 flex-shrink-0" size={14} />
                <div className="text-xs text-foreground leading-relaxed">
                  Hi — I'm ForecastIQ Copilot. I can investigate the forecast, compare versions, run scenarios, and apply
                  assumption changes for you. Try one of these to start, or ask anything in plain English.
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="caption text-muted">Suggestions for this page</div>
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full text-left px-3 py-2 rounded-md border border-border bg-surface hover:bg-primary-light/30 text-xs"
                >
                  <MessageSquare size={11} className="inline mr-1 text-primary" /> {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-lg px-3 py-2 " + (m.role === "user" ? "bg-secondary text-white" : "bg-background text-foreground")}>
              {m.role === "agent" && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-muted">
                  <Sparkles size={10} className="text-primary" /> Copilot
                </div>
              )}
              <div className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</div>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={() =>
                        alert(
                          `Demo placeholder — in production this would: ${a.label}.\n\nThe agent has tool-calling against the engine, store, and routes.`
                        )
                      }
                      className={
                        "text-[10px] px-2 py-1 rounded-full border " +
                        (a.tone === "primary"
                          ? "bg-primary text-white border-primary hover:bg-primary-dark"
                          : "border-border text-secondary hover:bg-surface")
                      }
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-background rounded-lg px-3 py-2 text-xs text-muted flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
              <span>Copilot is thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer / input */}
      <div className="border-t border-border px-3 py-3 bg-surface">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything — e.g. update product share for 2027 to 0.22"
            rows={2}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || typing}
            className="btn-secondary !p-2 disabled:opacity-50"
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="flex items-start gap-1 text-[10px] text-muted mt-2">
          <AlertCircle size={10} className="flex-shrink-0 mt-0.5" />
          <span>
            This Copilot is a placeholder. Responses are illustrative. Action chips trigger toast confirmations only — they don&apos;t
            mutate state or call tools yet.
          </span>
        </div>
      </div>
    </aside>
  );
}
