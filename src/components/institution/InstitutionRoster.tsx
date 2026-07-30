import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  institutionId: string;
}

const ROLE_LABEL: Record<string, string> = {
  institution_admin: "Administrador",
  teacher: "Professor",
  student: "Aluno",
};

export function InstitutionRoster({ institutionId }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["institution-members", institutionId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("institution_members")
        .select("id, user_id, role, created_at")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = (rows || []).map((r) => r.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : { data: [] as { user_id: string; display_name: string | null }[] };
      const nameByUser = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));
      return (rows || []).map((r) => ({ ...r, display_name: nameByUser.get(r.user_id) || null }));
    },
  });

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("institution-invite", {
        body: { institutionId, email: email.trim(), role },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Convite enviado!");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["institution-members", institutionId] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao convidar");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Membros da instituição</CardTitle>
        </div>
        <CardDescription>Convide professores e alunos para participar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="E-mail do convidado"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "teacher" | "student")}
            className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
          >
            <option value="student">Aluno</option>
            <option value="teacher">Professor</option>
          </select>
          <Button onClick={handleInvite} disabled={inviting || !email.trim()} className="gap-2">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Convidar
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro ainda.</p>
        ) : (
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm">
                <span>{m.display_name || "Usuário"}</span>
                <Badge variant="outline">{ROLE_LABEL[m.role] || m.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
