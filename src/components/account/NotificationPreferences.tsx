import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { toast } from "sonner";

export function NotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: enabled } = useQuery<boolean>({
    queryKey: ["notification_preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("email_notifications_enabled")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.email_notifications_enabled ?? false;
    },
  });

  const [local, setLocal] = useState<boolean | null>(null);
  useEffect(() => { if (enabled !== undefined) setLocal(enabled); }, [enabled]);

  const save = useMutation({
    mutationFn: async (value: boolean) => {
      setLocal(value);
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user!.id, email_notifications_enabled: value }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_preferences", user?.id] }),
    onError: () => toast.error("Não foi possível salvar"),
  });

  const value = local ?? enabled ?? false;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Alertas por E-mail</CardTitle>
        </div>
        <CardDescription>
          Além do sino de notificações, receba por e-mail os alertas de novos artigos PubMed
          dos seus interesses de pesquisa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Receber alertas por e-mail</p>
            <p className="text-xs text-muted-foreground">Mesmo conteúdo do sino de notificações</p>
          </div>
          <Switch checked={value} onCheckedChange={(v) => save.mutate(v)} />
        </div>
      </CardContent>
    </Card>
  );
}
