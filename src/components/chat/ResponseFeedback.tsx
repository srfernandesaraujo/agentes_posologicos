import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ResponseFeedbackProps {
  messageId: string;
  agentId: string;
  sessionId?: string | null;
  roomId?: string | null;
}

export function ResponseFeedback({ messageId, agentId, sessionId, roomId }: ResponseFeedbackProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = async (newRating: "up" | "down", feedbackComment?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("response_feedback" as any)
        .upsert(
          {
            user_id: user.id,
            message_id: messageId,
            agent_id: agentId,
            session_id: sessionId || null,
            room_id: roomId || null,
            rating: newRating,
            comment: feedbackComment || null,
          },
          { onConflict: "message_id,user_id" }
        );

      if (error) throw error;
      setRating(newRating);
      setSubmitted(true);
      if (feedbackComment) {
        setShowComment(false);
        toast.success("Feedback enviado!");
      }
    } catch (err) {
      console.error("Feedback error:", err);
      toast.error("Erro ao enviar feedback");
    }
  };

  const handleRate = (newRating: "up" | "down") => {
    submitFeedback(newRating);
    if (newRating === "down") {
      setShowComment(true);
    }
  };

  const handleSubmitComment = () => {
    if (!rating) return;
    submitFeedback(rating, comment);
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleRate("up")}
          className={`rounded p-1 transition-colors ${
            rating === "up"
              ? "text-green-400 bg-green-400/10"
              : "text-white/30 hover:text-white/60 hover:bg-white/5"
          }`}
          title="Resposta útil"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handleRate("down")}
          className={`rounded p-1 transition-colors ${
            rating === "down"
              ? "text-red-400 bg-red-400/10"
              : "text-white/30 hover:text-white/60 hover:bg-white/5"
          }`}
          title="Resposta não ajudou"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        {rating && !showComment && !submitted && (
          <button
            onClick={() => setShowComment(true)}
            className="rounded p-1 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title="Adicionar comentário"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )}
        {submitted && !showComment && (
          <span className="text-[10px] text-white/30 ml-1">Obrigado!</span>
        )}
      </div>

      {showComment && (
        <div className="flex items-center gap-1.5 max-w-sm">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="O que poderia melhorar?"
            className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitComment();
            }}
          />
          <button
            onClick={handleSubmitComment}
            className="rounded p-1.5 text-white/50 hover:text-green-400 hover:bg-green-400/10 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowComment(false)}
            className="rounded p-1.5 text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
