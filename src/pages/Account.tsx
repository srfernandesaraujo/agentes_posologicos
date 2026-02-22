import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Coins, Clock, ArrowUpRight, ArrowDownRight, Gift, Mail, Lock, Check, Loader2, Camera, CreditCard, ExternalLink, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useSubscription, SUBSCRIPTION_TIERS } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";

export default function Account() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { subscribed, tier, tierInfo, subscriptionEnd } = useSubscription();
  const { isAdmin } = useIsAdmin();
  const { hasUnlimitedAccess } = useUnlimitedAccess();
  const isUnlimited = isAdmin || hasUnlimitedAccess;
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erro ao abrir portal de gerenciamento.");
    } finally {
      setPortalLoading(false);
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 2MB."); return; }

    setAvatarLoading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Erro ao enviar imagem."); setAvatarLoading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
    if (updateError) { toast.error("Erro ao atualizar perfil."); } else {
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setAvatarLoading(false);
  };

  const handleEmailChange = async () => {
    if (!newEmail) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailLoading(false);
    if (error) { toast.error(error.message); } else { toast.success("Um e-mail de confirmação foi enviado."); setNewEmail(""); }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem."); return; }
    if (newPassword.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres."); return; }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) { toast.error(error.message); } else { toast.success("Senha atualizada!"); setNewPassword(""); setConfirmPassword(""); }
  };

  const { data: ledger = [] } = useQuery({
    queryKey: ["ledger", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("credits_ledger").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const typeConfig: Record<string, { icon: typeof Coins; label: string; color: string }> = {
    purchase: { icon: ArrowUpRight, label: t("account.purchase"), color: "text-[hsl(152,60%,42%)]" },
    usage: { icon: ArrowDownRight, label: t("account.usage"), color: "text-[hsl(0,72%,51%)]" },
    bonus: { icon: Gift, label: t("account.bonus"), color: "text-[hsl(174,62%,47%)]" },
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">{t("account.title")}</h1>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar className="h-14 w-14 border-2 border-white/20">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt="Avatar" />
              ) : null}
              <AvatarFallback className="gradient-primary text-white text-lg font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarLoading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-white">{profile?.display_name || user?.email}</p>
              {isUnlimited ? (
                <div className="flex items-center gap-2 text-sm text-[hsl(174,62%,47%)]">
                  <Infinity className="h-4 w-4" />
                  Acesso ilimitado
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
                  {balance} {t("credits.credits")}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <CreditCard className="h-5 w-5 text-primary" /> Meu Plano
        </h2>
        {subscribed && tierInfo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <p className="font-display font-semibold text-white">Plano {tierInfo.name}</p>
                <p className="text-sm text-white/50">{tierInfo.credits} créditos/mês • {tierInfo.price}/mês</p>
                {subscriptionEnd && (
                  <p className="text-xs text-white/40 mt-1">
                    Próxima renovação: {new Date(subscriptionEnd).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-[hsl(152,60%,42%)]/20 px-3 py-1 text-xs font-medium text-[hsl(152,60%,42%)]">Ativo</span>
            </div>
            <Button onClick={handleManageSubscription} disabled={portalLoading} variant="outline" className="w-full gap-2 border-white/10 text-white hover:bg-white/5">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Gerenciar ou Cancelar Assinatura
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            {isUnlimited ? (
              <>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Infinity className="h-5 w-5 text-[hsl(174,62%,47%)]" />
                  <p className="text-[hsl(174,62%,47%)] text-sm font-medium">Você possui acesso ilimitado à plataforma.</p>
                </div>
                <Button disabled variant="outline" className="gap-2 border-white/10 text-white/30 cursor-not-allowed">
                  Ver Planos
                </Button>
              </>
            ) : (
              <>
                <p className="text-white/50 text-sm mb-3">Você não possui uma assinatura ativa.</p>
                <Button onClick={() => window.location.href = "/creditos"} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  Ver Planos
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Mail className="h-5 w-5 text-primary" /> {t("account.changeEmail")}
        </h2>
        <div className="space-y-3">
          <Input type="email" placeholder={t("account.newEmail")} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="border-white/10 bg-white/5 text-white placeholder:text-white/30" />
          <Button onClick={handleEmailChange} disabled={emailLoading || !newEmail} className="w-full gap-2">
            {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("account.updateEmail")}
          </Button>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Lock className="h-5 w-5 text-primary" /> {t("account.changePassword")}
        </h2>
        <div className="space-y-3">
          <Input type="password" placeholder={t("account.newPassword")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="border-white/10 bg-white/5 text-white placeholder:text-white/30" />
          <Input type="password" placeholder={t("account.confirmPassword")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="border-white/10 bg-white/5 text-white placeholder:text-white/30" />
          <Button onClick={handlePasswordChange} disabled={passwordLoading || !newPassword || !confirmPassword} className="w-full gap-2">
            {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("account.updatePassword")}
          </Button>
        </div>
      </div>

      <h2 className="mb-4 font-display text-xl font-semibold text-white">{t("account.history")}</h2>
      <div className="space-y-2">
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-white/40">{t("account.noHistory")}</p>
        ) : (
          ledger.map((entry) => {
            const cfg = typeConfig[entry.type] || typeConfig.usage;
            const EntryIcon = cfg.icon;
            return (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${cfg.color}`}>
                  <EntryIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white/80">{entry.description || cfg.label}</p>
                  <p className="text-xs text-white/30">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`font-display font-semibold ${cfg.color}`}>
                  {entry.amount > 0 ? "+" : ""}{entry.amount}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
