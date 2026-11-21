import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useJoinMeeting } from "@/hooks/useMeetingGuests";
import { setReturnTo } from "@/lib/returnTo";

/** Entrada pelo link de convite. Conta é obrigatória: sem login, a pessoa entra ou cria a conta e volta para este endereço. */
export default function MeetingInvite() {
  const { token = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const join = useJoinMeeting();
  const started = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setReturnTo(`/reuniao-viva/convite/${token}`); return; }
    if (started.current) return;
    started.current = true;
    join.mutate(token, { onSuccess: (r) => navigate(`/reuniao-viva/${r.meetingId}`, { replace: true }) });
  }, [loading, user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1f1d] px-4 text-white">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300"><Users className="h-6 w-6" /></div>
        <h1 className="text-lg font-semibold">Convite para uma reunião ao vivo</h1>
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Carregando" />
        ) : !user ? (
          <>
            <p className="text-sm text-white/70">Para participar, entre na sua conta do Posologia ou crie uma. Depois você volta direto para a reunião.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild><Link to="/login">Entrar</Link></Button>
              <Button asChild variant="outline" className="border-white/20 bg-transparent"><Link to="/signup">Criar conta</Link></Button>
            </div>
          </>
        ) : join.isError ? (
          <>
            <p role="alert" className="text-sm text-red-300">{(join.error as Error).message}</p>
            <Button asChild variant="outline" className="border-white/20 bg-transparent"><Link to="/agentes">Ir para o início</Link></Button>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-white/70"><Loader2 className="h-4 w-4 animate-spin" /> Entrando na reunião...</p>
        )}
      </div>
    </div>
  );
}
