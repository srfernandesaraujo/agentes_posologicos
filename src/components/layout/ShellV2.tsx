import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PageTransition } from "@/components/ds/PageTransition";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Coins, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Search, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavCounts } from "@/hooks/useNavCounts";
import { useLanguage } from "@/contexts/LanguageContext";
import { BrandMark } from "@/components/ds/BrandMark";
import { LanguageSelector } from "@/components/LanguageSelector";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { OraculoWidget } from "@/components/oraculo/OraculoWidget";
import { CommandPaletteProvider } from "@/components/command/CommandPalette";
import { OfflineBanner } from "./OfflineBanner";
import { DebugOverlay } from "./DebugOverlay";
import { DOMAINS, resolveRoute, type Domain, type NavItem } from "./navConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PANEL_KEY = "pos-panel-open";
const auraOf = (d: Domain) => `hsl(var(--dom-${d.id}))`;
const openPalette = () => window.dispatchEvent(new CustomEvent("open-command-palette"));

/** Rótulos traduzidos que já existiam no menu antigo. */
function useLabels() {
  const { t } = useLanguage();
  return (item: NavItem) => {
    const map: Record<string, string> = {
      "/agentes": t("nav.agents"), "/meus-agentes": t("nav.myAgents"), "/conteudos": t("nav.content"),
      "/conversas": t("nav.conversations"), "/salas-virtuais": t("nav.virtualRooms"),
      "/configuracoes": t("nav.settings"), "/creditos": t("nav.credits"), "/conta": t("nav.account"),
    };
    return map[item.to] ?? item.label;
  };
}

function useVisibleItems() {
  const { isAdmin } = useIsAdmin();
  return (d: Domain) => d.items.filter((i) => !i.adminOnly || isAdmin);
}

function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, display_name").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  }).data;
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const profile = useProfile();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none ring-offset-2 ring-offset-pos-vacuo focus-visible:ring-2 focus-visible:ring-dom-inicio" data-tour="user-menu" aria-label="Menu da conta">
          <Avatar className="h-8 w-8">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="Avatar" /> : null}
            <AvatarFallback className="gradient-primary text-sm font-bold text-white">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-white/10 bg-pos-elevado text-white">
        <DropdownMenuItem onClick={() => navigate("/conta")} className="focus:bg-white/10 focus:text-white">{t("nav.account")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/creditos")} className="focus:bg-white/10 focus:text-white">{t("nav.credits")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/suporte")} className="focus:bg-white/10 focus:text-white">Suporte</DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => navigate("/admin")} className="text-[hsl(var(--dom-ajuda))] focus:bg-white/10 focus:text-[hsl(var(--dom-ajuda))]">
              <Shield className="mr-2 h-4 w-4" />{t("nav.admin")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onClick={() => signOut()} className="focus:bg-white/10 focus:text-white">
          <LogOut className="mr-2 h-4 w-4" />{t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Rail({ active }: { active: Domain }) {
  const main = DOMAINS.filter((d) => d.id !== "ajuda");
  const help = DOMAINS.find((d) => d.id === "ajuda")!;
  const btn = (d: Domain) => {
    const on = d.id === active.id;
    const Icon = d.icon;
    return (
      <NavLink
        key={d.id}
        to={d.items[0].to}
        aria-label={d.label}
        aria-current={on ? "page" : undefined}
        style={{ "--aura": auraOf(d) } as CSSProperties}
        className={`relative flex w-[52px] flex-col items-center gap-1 rounded-xl px-1 pb-1.5 pt-2 text-[10px] font-medium transition-colors ${
          on ? "bg-[color-mix(in_srgb,var(--aura)_14%,transparent)] text-[var(--aura)]" : "text-white/45 hover:bg-white/5 hover:text-white/80"
        }`}
      >
        {on && <span className="absolute -left-[8px] bottom-3 top-3 w-[3px] rounded-r bg-[var(--aura)]" />}
        <Icon className="h-[18px] w-[18px]" />
        <span>{d.label.split(" ")[0]}</span>
      </NavLink>
    );
  };
  return (
    <nav className="sticky top-0 z-30 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-1.5 border-r border-white/10 bg-pos-base py-3 md:flex" aria-label="Domínios">
      <Link to="/dashboard" className="mb-3" aria-label="Agentes Posológicos — início"><BrandMark size={38} /></Link>
      {main.map(btn)}
      <div className="flex-1" />
      {btn(help)}
    </nav>
  );
}

function SidePanel({ domain, pathname, collapsed }: { domain: Domain; pathname: string; collapsed: boolean }) {
  const label = useLabels();
  const visible = useVisibleItems();
  const counts = useNavCounts();
  const { item: current } = resolveRoute(pathname);
  if (collapsed) return null;
  const items = visible(domain);
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 overflow-y-auto border-r border-white/10 bg-pos-base px-3 py-4 lg:block" aria-label={domain.label} style={{ "--aura": auraOf(domain) } as CSSProperties}>
      <div className="mb-1 flex items-center gap-2 px-2 font-brand text-[15px] font-bold tracking-tight text-white">
        <span className="h-2 w-2 rounded-full bg-[var(--aura)] shadow-[0_0_12px_var(--aura)]" />
        {domain.label}
      </div>
      <p className="mb-4 px-2 text-xs text-white/40">{domain.tagline}</p>
      <div className="space-y-0.5">
        {items.map((it) => {
          const on = current?.to === it.to;
          const Icon = it.icon;
          const n = it.countKey ? counts[it.countKey] : 0;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              data-tour={it.dataTour}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                on ? "bg-pos-realce text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]" : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[var(--aura)]" : ""}`} />
              <span className="flex-1">{label(it)}</span>
              {n > 0 && <span className="font-mono text-[10.5px] text-white/40">{String(n).padStart(2, "0")}</span>}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}

function TopBar({ domain, itemLabel, collapsed, onToggle, isMobile }: { domain: Domain; itemLabel?: string; collapsed: boolean; onToggle: () => void; isMobile: boolean }) {
  const { balance } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { hasUnlimitedAccess } = useUnlimitedAccess();
  const free = isAdmin || hasUnlimitedAccess;
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/10 bg-pos-vacuo/80 px-4 backdrop-blur-xl md:px-6">
      {isMobile ? (
        <Link to="/dashboard" aria-label="Início"><BrandMark size={32} /></Link>
      ) : (
        <button onClick={onToggle} className="hidden rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white lg:block" aria-label={collapsed ? "Mostrar painel" : "Ocultar painel"}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}
      <nav className="hidden min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] text-white/40 md:flex" aria-label="Trilha">
        <span>Posologia</span><ChevronRight className="h-3 w-3" />
        <span style={{ color: auraOf(domain) }}>{domain.label}</span>
        {itemLabel && (<><ChevronRight className="h-3 w-3" /><span className="truncate font-semibold text-white">{itemLabel}</span></>)}
      </nav>
      <button
        type="button"
        onClick={openPalette}
        className="mx-auto flex min-w-0 max-w-[440px] flex-1 items-center gap-2.5 rounded-xl border border-white/15 bg-pos-base px-3 py-2 text-left text-[13px] text-white/45 transition hover:border-[hsl(var(--dom-inicio))] hover:shadow-[0_0_0_3px_hsl(var(--dom-inicio)/0.18)]"
        title="Buscar, navegar e executar (Ctrl/Cmd+K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Pergunte, calcule ou busque</span>
        <kbd className="hidden rounded border border-white/15 px-1.5 font-mono text-[10px] text-white/40 sm:block">Ctrl K</kbd>
      </button>
      <div className="hidden md:block"><LanguageSelector /></div>
      <Link to="/creditos" data-tour="credits" className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-xs text-white/75 hover:bg-white/5">
        <Coins className="h-3.5 w-3.5 text-[hsl(38,92%,50%)]" />{free ? "∞" : balance}
      </Link>
      <NotificationBell />
      <UserMenu />
    </header>
  );
}

function MobileNav({ active, pathname }: { active: Domain; pathname: string }) {
  const [sheet, setSheet] = useState<Domain | null>(null);
  const navigate = useNavigate();
  const label = useLabels();
  const visible = useVisibleItems();
  const counts = useNavCounts();
  const { item: current } = resolveRoute(pathname);
  const byId = (id: string) => DOMAINS.find((d) => d.id === id)!;
  const slot = (d: Domain) => {
    const Icon = d.icon;
    const on = d.id === active.id;
    return (
      <button
        key={d.id}
        onClick={() => (visible(d).length === 1 ? navigate(d.items[0].to) : setSheet(d))}
        className="flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium"
        style={{ color: on ? auraOf(d) : "rgba(255,255,255,0.45)" }}
        aria-current={on ? "page" : undefined}
      >
        <Icon className="h-5 w-5" />
        {d.label.split(" ")[0]}
      </button>
    );
  };
  const more = byId("ensino");
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-pos-base/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-end justify-around py-1">
          {slot(byId("inicio"))}
          {slot(byId("clinica"))}
          <button onClick={openPalette} aria-label="Buscar ou perguntar" className="-mt-5 grid h-12 w-12 place-items-center rounded-2xl text-[#04141a] shadow-[0_10px_24px_-6px_rgba(45,212,191,0.6)]" style={{ background: "linear-gradient(140deg,#2DD4BF,#38BDF8)" }}>
            <Plus className="h-6 w-6" />
          </button>
          {slot(byId("equipes"))}
          {slot(more)}
        </div>
      </nav>
      <Drawer open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <DrawerContent className="border-white/10 bg-pos-elevado text-white">
          <DrawerHeader><DrawerTitle className="font-brand">{sheet?.label}</DrawerTitle></DrawerHeader>
          <div className="space-y-1 px-4 pb-6">
            {sheet && visible(sheet).map((it) => {
              const Icon = it.icon;
              const n = it.countKey ? counts[it.countKey] : 0;
              return (
                <button key={it.to} onClick={() => { setSheet(null); navigate(it.to); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${current?.to === it.to ? "bg-pos-realce text-white" : "text-white/70"}`}>
                  <Icon className="h-4 w-4" style={{ color: auraOf(sheet) }} />
                  <span className="flex-1">{label(it)}</span>
                  {n > 0 && <span className="font-mono text-xs text-white/40">{n}</span>}
                </button>
              );
            })}
            {sheet?.id === "ensino" && (
              <>
                <p className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-widest text-white/35">Acervo</p>
                {visible(byId("acervo")).map((it) => (
                  <button key={it.to} onClick={() => { setSheet(null); navigate(it.to); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/70">
                    <it.icon className="h-4 w-4" style={{ color: auraOf(byId("acervo")) }} />{label(it)}
                  </button>
                ))}
                <p className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-widest text-white/35">Conta e ajuda</p>
                {visible(byId("ajuda")).map((it) => (
                  <button key={it.to} onClick={() => { setSheet(null); navigate(it.to); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/70">
                    <it.icon className="h-4 w-4" style={{ color: auraOf(byId("ajuda")) }} />{label(it)}
                  </button>
                ))}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** Casca do novo visual: trilho de domínios + painel contextual + faixa superior com omnibar. */
export function ShellV2() {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const label = useLabels();
  const { domain, item } = useMemo(() => resolveRoute(pathname), [pathname]);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_KEY) !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(PANEL_KEY, open ? "1" : "0"); } catch { /* storage bloqueado */ }
  }, [open]);
  const isChatPage = pathname.startsWith("/chat/");

  return (
    <div className="min-h-screen bg-pos-vacuo text-white" style={{ "--aura": auraOf(domain) } as CSSProperties}>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] opacity-70 transition-[background] duration-500" style={{ background: "radial-gradient(700px 320px at 62% -8%, color-mix(in srgb, var(--aura) 16%, transparent), transparent 70%)" }} />
      <OfflineBanner />
      <OnboardingTour />
      <DebugOverlay />
      <div className="relative z-10 flex">
        <Rail active={domain} />
        <SidePanel domain={domain} pathname={pathname} collapsed={!open} />
        <div className="min-w-0 flex-1">
          <TopBar domain={domain} itemLabel={item ? label(item) : undefined} collapsed={!open} onToggle={() => setOpen((v) => !v)} isMobile={isMobile} />
          <main className="pb-20 md:pb-0">
            <PageTransition><Outlet /></PageTransition>
          </main>
        </div>
      </div>
      <MobileNav active={domain} pathname={pathname} />
      {!isChatPage && <OraculoWidget />}
      <CommandPaletteProvider />
    </div>
  );
}
