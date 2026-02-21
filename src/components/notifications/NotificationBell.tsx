import { useState } from "react";
import { Bell, Check, Trash2, Info, AlertTriangle, Gift, Megaphone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  credit: Gift,
  feature: Megaphone,
};

const typeColors: Record<string, string> = {
  info: "text-[hsl(174,62%,47%)]",
  warning: "text-[hsl(38,92%,50%)]",
  credit: "text-[hsl(14,90%,58%)]",
  feature: "text-[hsl(262,80%,65%)]",
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications" as any)
        .update({ read: true })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications" as any)
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications" as any)
        .delete()
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (notif: Notification) => {
    if (!notif.read) markRead.mutate(notif.id);
    if (notif.link) {
      setOpen(false);
      navigate(notif.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white/60 hover:text-white hover:bg-white/10"
          data-tour="notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(14,90%,58%)] px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 border-white/10 bg-[hsl(220,25%,10%)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-display font-semibold text-sm text-white">Notificações</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
            >
              <Check className="h-3 w-3" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Bell className="h-8 w-8 text-white/20 mb-2" />
              <p className="text-xs text-white/40">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.map((notif) => {
                const Icon = typeIcons[notif.type] || Info;
                const color = typeColors[notif.type] || "text-white/50";
                return (
                  <div
                    key={notif.id}
                    className={`group flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${
                      !notif.read ? "bg-white/[0.03]" : ""
                    }`}
                    onClick={() => handleClick(notif)}
                  >
                    <div className={`mt-0.5 shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium truncate ${!notif.read ? "text-white" : "text-white/70"}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[hsl(14,90%,58%)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/40 line-clamp-2 mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-white/25 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate(notif.id);
                      }}
                      className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
