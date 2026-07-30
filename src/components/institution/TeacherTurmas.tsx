import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  institutionId: string;
  teacherId: string;
}

function TurmaCard({ turmaId, turmaName, institutionId }: { turmaId: string; turmaName: string; institutionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [studentToAdd, setStudentToAdd] = useState("");

  const { data: enrollments = [] } = useQuery({
    queryKey: ["turma-enrollments", turmaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("turma_enrollments").select("id, student_id").eq("turma_id", turmaId);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: institutionStudents = [] } = useQuery({
    queryKey: ["institution-students", institutionId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("institution_members")
        .select("user_id")
        .eq("institution_id", institutionId)
        .eq("role", "student");
      const userIds = (rows || []).map((r) => r.user_id);
      if (userIds.length === 0) return [] as { user_id: string; display_name: string | null }[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
      return profiles || [];
    },
    enabled: open,
  });

  const { data: gradebook = [], isLoading: gradebookLoading } = useQuery({
    queryKey: ["turma-gradebook", turmaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_turma_gradebook", { _turma_id: turmaId });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("turma_enrollments").insert({ turma_id: turmaId, student_id: studentToAdd });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno matriculado!");
      setStudentToAdd("");
      qc.invalidateQueries({ queryKey: ["turma-enrollments", turmaId] });
      qc.invalidateQueries({ queryKey: ["turma-gradebook", turmaId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao matricular"),
  });

  const enrolledIds = new Set(enrollments.map((e) => e.student_id));
  const availableStudents = institutionStudents.filter((s) => !enrolledIds.has(s.user_id));

  return (
    <div className="rounded-lg border border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        {turmaName}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-border/40 p-3">
          <div className="flex gap-2">
            <select
              value={studentToAdd}
              onChange={(e) => setStudentToAdd(e.target.value)}
              className="flex-1 rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs"
            >
              <option value="">Selecionar aluno da instituição...</option>
              {availableStudents.map((s) => (
                <option key={s.user_id} value={s.user_id}>{s.display_name || s.user_id}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => enroll.mutate()} disabled={!studentToAdd || enroll.isPending} className="gap-1">
              <UserPlus className="h-3 w-3" /> Matricular
            </Button>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Gradebook (resultados OSCE)</p>
            {gradebookLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : gradebook.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum resultado ainda.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1">Aluno</th>
                    <th className="py-1">Estação</th>
                    <th className="py-1">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {gradebook.map((g: any, i: number) => (
                    <tr key={i} className="border-t border-border/30">
                      <td className="py-1">{g.student_name}</td>
                      <td className="py-1">{g.station_title || "—"}</td>
                      <td className="py-1">{g.score != null ? `${g.score}/${g.max_score}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherTurmas({ institutionId, teacherId }: Props) {
  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ["teacher-turmas", institutionId, teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, name")
        .eq("institution_id", institutionId)
        .eq("teacher_id", teacherId);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Minhas turmas</CardTitle>
        </div>
        <CardDescription>Matricule alunos e acompanhe o gradebook de resultados OSCE.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : turmas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma turma atribuída a você ainda.</p>
        ) : (
          turmas.map((t) => <TurmaCard key={t.id} turmaId={t.id} turmaName={t.name} institutionId={institutionId} />)
        )}
      </CardContent>
    </Card>
  );
}
