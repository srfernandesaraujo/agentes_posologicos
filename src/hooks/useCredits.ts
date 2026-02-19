import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCredits() {
  const { user } = useAuth();

  const { data: balance = 0, refetch, isLoading } = useQuery({
    queryKey: ["credits", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("credits_ledger")
        .select("amount")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).reduce((sum, row) => sum + row.amount, 0);
    },
    enabled: !!user,
  });

  return { balance, refetch, isLoading };
}
