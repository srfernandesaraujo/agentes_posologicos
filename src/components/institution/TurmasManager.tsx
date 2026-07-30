import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  institutionId: string;
}

export function TurmasManager({ institutionId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: teachers = [] } = useQuery({
    queryKey: ["institution-teachers", institutionId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("institution_members")
        .select("user_id")
        .eq("institution_id", institutionId)
        .eq("role", "teacher");
      const userIds = (rows || []).map((r) => r.user_id);
      if (userIds.length === 0) return [] as { user_id: string; display_name: string | null }[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
      return profiles || [];
    },
  });

  const [teacherId, setTeacherId] = useState<string>("");

  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ["turmas", institutionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, name, description, teacher_id, created_at")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const effectiveTeacherId = teacherId || user!.id;
      const { error } = await supabase.from("turmas").insert({
        institution_id: institutionId,
        teacher_id: effectiveTeacherId,
        name: name.trim(),
        description: description.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma criada!");
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["turmas", institutionId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar turma"),
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Turmas</CardTitle>
        </div>
        <CardDescription>Crie turmas e atribua um professor responsável.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Nome da turma" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="flex-1 rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
          >
            <option value="">Eu mesmo(a)</option>
            {teachers.map((t) => (
              <option key={t.user_id} value={t.user_id}>{t.display_name || t.user_id}</option>
            ))}
          </select>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar turma
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : turmas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma turma ainda.</p>
        ) : (
          <div className="space-y-1">
            {turmas.map((t) => (
              <div key={t.id} className="rounded-md border border-border/40 px-3 py-2 text-sm">
                <p className="font-medium">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
