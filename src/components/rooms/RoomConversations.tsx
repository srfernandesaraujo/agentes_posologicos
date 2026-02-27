import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Mail, MessageSquare, ChevronRight, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface RoomMessage {
  id: string;
  room_id: string;
  sender_name: string;
  sender_email: string;
  role: string;
  content: string;
  created_at: string;
}

interface Conversation {
  email: string;
  name: string;
  messages: RoomMessage[];
  lastMessageAt: string;
}

interface Props {
  roomId: string;
  roomName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomConversations({ roomId, roomName, open, onOpenChange }: Props) {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["room-conversations", roomId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const messages = data as RoomMessage[];

      // Group by sender_email (user messages only, then attach assistant responses)
      const convMap = new Map<string, Conversation>();

      let currentEmail = "";
      for (const msg of messages) {
        if (msg.role === "user") {
          currentEmail = msg.sender_email || msg.sender_name;
          if (!convMap.has(currentEmail)) {
            convMap.set(currentEmail, {
              email: msg.sender_email,
              name: msg.sender_name,
              messages: [],
              lastMessageAt: msg.created_at,
            });
          }
          convMap.get(currentEmail)!.messages.push(msg);
          convMap.get(currentEmail)!.lastMessageAt = msg.created_at;
        } else if (msg.role === "assistant" && currentEmail) {
          // Attach assistant response to the current conversation
          convMap.get(currentEmail)?.messages.push(msg);
        }
      }

      return Array.from(convMap.values()).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    },
    enabled: open && !!roomId,
  });

  const handleClose = () => {
    setSelectedConversation(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedConversation ? (
              <>
                <button onClick={() => setSelectedConversation(null)} className="text-white/50 hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="truncate">{selectedConversation.name}</span>
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 text-primary" />
                Conversas — {roomName}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : selectedConversation ? (
          /* Message thread view */
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 pb-4">
              <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
                <Mail className="h-3 w-3" />
                <span>{selectedConversation.email || "Sem e-mail"}</span>
              </div>
              {selectedConversation.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-[hsl(14,90%,58%)] text-white"
                      : "bg-white/[0.05] border border-white/10 text-white/90"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(14,90%,58%)]/20">
                      <User className="h-3.5 w-3.5 text-[hsl(14,90%,58%)]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/30 gap-2">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Nenhuma conversa registrada nesta sala</p>
          </div>
        ) : (
          /* Conversation list view */
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 pb-4">
              {conversations.map((conv) => {
                const userMsgCount = conv.messages.filter((m) => m.role === "user").length;
                return (
                  <button
                    key={conv.email || conv.name}
                    onClick={() => setSelectedConversation(conv)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{conv.name}</p>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{conv.email || "Sem e-mail"}</span>
                      </div>
                      <p className="text-xs text-white/30 mt-0.5">{userMsgCount} mensagens</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}