import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyInstitutions } from "@/hooks/useInstitutions";
import { InstitutionRoster } from "@/components/institution/InstitutionRoster";
import { TurmasManager } from "@/components/institution/TurmasManager";
import { TeacherTurmas } from "@/components/institution/TeacherTurmas";
import { StudentTurmas } from "@/components/institution/StudentTurmas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function Institution() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: memberships = [], isLoading } = useMyInstitutions();
  const [name, setName] = useState("");

  const createInstitution = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("institutions").insert({ name: name.trim(), created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instituição criada!");
      qc.invalidateQueries({ queryKey: ["my-institutions", user?.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar instituição"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="container max-w-lg py-8">
        <div className="mb-6">
          <h1 className="mb-2 font-display text-3xl font-bold">Modo Institucional</h1>
          <p className="text-muted-foreground">
            Crie sua instituição para gerenciar turmas, professores e alunos.
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nome da instituição" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => createInstitution.mutate()} disabled={!name.trim() || createInstitution.isPending} className="gap-2">
            {createInstitution.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            Criar
          </Button>
        </div>
      </div>
    );
  }

  const membership = memberships[0];

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="mb-1 font-display text-3xl font-bold">{membership.institution_name}</h1>
        <p className="text-muted-foreground">Modo institucional</p>
      </div>

      {membership.role === "institution_admin" && (
        <>
          <InstitutionRoster institutionId={membership.institution_id} />
          <TurmasManager institutionId={membership.institution_id} />
        </>
      )}

      {(membership.role === "institution_admin" || membership.role === "teacher") && user && (
        <TeacherTurmas institutionId={membership.institution_id} teacherId={user.id} />
      )}

      {membership.role === "student" && (
        <StudentTurmas institutionId={membership.institution_id} />
      )}
    </div>
  );
}
