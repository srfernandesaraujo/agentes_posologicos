import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { Coins, User, LogOut, Pill, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { balance } = useCredits();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/agentes" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shrink-0">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold gradient-text">Agentes Posológicos</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSelector />

          {isAdmin && (
            <Link to="/admin">
              <Button variant="outline" size="sm" className="gap-2 font-medium border-[hsl(14,90%,58%)]/40 bg-[hsl(14,90%,58%)]/10 text-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,58%)]/20 hover:text-[hsl(14,90%,58%)]">
                <Shield className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}

          <Link to="/creditos">
            <Button variant="outline" size="sm" className="gap-2 font-medium border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
              <span>{isAdmin ? "∞" : balance}</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary">
                  <User className="h-4 w-4 text-white" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-white/10 bg-[hsl(220,25%,10%)] text-white">
              <DropdownMenuItem onClick={() => navigate("/conta")} className="text-white/80 focus:bg-white/10 focus:text-white">
                <User className="mr-2 h-4 w-4" />
                {t("nav.account")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/creditos")} className="text-white/80 focus:bg-white/10 focus:text-white">
                <Coins className="mr-2 h-4 w-4" />
                {t("nav.credits")}
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="text-[hsl(14,90%,58%)] focus:bg-white/10 focus:text-[hsl(14,90%,58%)]">
                    <Shield className="mr-2 h-4 w-4" />
                    {t("nav.admin")}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => signOut()} className="text-white/80 focus:bg-white/10 focus:text-white">
                <LogOut className="mr-2 h-4 w-4" />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
