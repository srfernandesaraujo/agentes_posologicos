import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ChevronDown, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quais são os planos disponíveis?",
  "Sou professor, o que vocês oferecem?",
  "Quero entender como funciona a plataforma",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-agent`;

export function SalesAgentWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) throw new Error("Erro ao consultar");

      const body = resp.body;
      if (!body) throw new Error("No body");

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages([...allMessages, { role: "assistant", content: assistantText }]);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (!assistantText) {
        setMessages([...allMessages, { role: "assistant", content: "Desculpe, não consegui processar. Tente novamente!" }]);
      }
    } catch (e) {
      console.error("Sales agent error:", e);
      setMessages([
        ...allMessages,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[hsl(14,90%,58%)] px-5 py-3 text-white font-semibold shadow-lg shadow-[hsl(14,90%,58%)]/30 transition-all hover:bg-[hsl(14,90%,52%)] hover:scale-105 hover:shadow-xl md:bottom-8 md:right-8 animate-fade-in"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Fale com nosso consultor</span>
          <span className="sm:hidden">Consultor</span>
        </button>
      )}

      {/* Chat popup */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[540px] w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-white/10 bg-[hsl(220,25%,8%)] shadow-2xl md:bottom-8 md:right-8 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-gradient-to-r from-[hsl(14,90%,58%)]/10 to-transparent rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(14,90%,58%)]/20">
                <MessageCircle className="h-4 w-4 text-[hsl(14,90%,58%)]" />
              </div>
              <div>
                <span className="font-display text-sm font-bold text-white">Consultor IA</span>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-white/40">Online agora</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(14,90%,58%)]/20 mb-4">
                  <MessageCircle className="h-7 w-7 text-[hsl(14,90%,58%)]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Olá! 👋</h3>
                <p className="text-sm text-white/50 mb-6">
                  Sou o consultor da plataforma. Posso te ajudar a encontrar o plano ideal!
                </p>

                <div className="w-full space-y-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <Send className="h-3 w-3 shrink-0 rotate-[-45deg] text-white/30" />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => navigate("/signup")}
                  className="mt-4 flex items-center gap-1 text-xs text-[hsl(14,90%,58%)] hover:underline"
                >
                  Criar conta gratuita (15 créditos grátis)
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-[hsl(14,90%,58%)] text-white rounded-br-md"
                      : "bg-white/[0.06] text-white/90 rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tire suas dúvidas sobre a plataforma..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[hsl(14,90%,58%)]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(14,90%,58%)]/30"
                style={{ maxHeight: "80px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(14,90%,58%)] text-white transition-all hover:bg-[hsl(14,90%,52%)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-white/25">
              Consultor IA • Agentes Posológicos
            </p>
          </div>
        </div>
      )}
    </>
  );
}
