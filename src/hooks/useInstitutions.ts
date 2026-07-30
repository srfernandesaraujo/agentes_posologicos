import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type InstitutionRole = "institution_admin" | "teacher" | "student";

export interface InstitutionMembership {
  institution_id: string;
  institution_name: string;
  role: InstitutionRole;
}

// A user's institution memberships — usually one, but the shape supports more than one
// institution per user (e.g. a teacher who also studies elsewhere).
export function useMyInstitutions() {
  const { user } = useAuth();

  return useQuery<InstitutionMembership[]>({
    queryKey: ["my-institutions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_members")
        .select("institution_id, role, institutions(name)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        institution_id: row.institution_id,
        institution_name: row.institutions?.name || "Instituição",
        role: row.role as InstitutionRole,
      }));
    },
  });
}
