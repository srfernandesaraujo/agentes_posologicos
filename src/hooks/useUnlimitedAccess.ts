import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnlimitedAccess() {
  const { user } = useAuth();

  const { data: hasUnlimitedAccess = false, isLoading } = useQuery({
    queryKey: ["unlimited-access", user?.id],
    queryFn: async () => {
      if (!user?.email) return false;
      const { data, error } = await supabase
        .from("unlimited_users" as any)
        .select("id, is_active")
        .eq("email", user.email.toLowerCase())
        .eq("is_active", true)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return { hasUnlimitedAccess, isLoading };
}
