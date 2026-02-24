import { NavLink } from "react-router-dom";
import { LayoutGrid, Bot, MessageSquare, Store, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { to: "/agentes", icon: LayoutGrid, label: "Agentes" },
  { to: "/meus-agentes", icon: Bot, label: "Meus" },
  { to: "/conversas", icon: MessageSquare, label: "Conversas" },
  { to: "/marketplace", icon: Store, label: "Market" },
  { to: "/configuracoes", icon: Settings, label: "Config" },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[hsl(220,25%,5%)]/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around py-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-[hsl(174,62%,47%)]" : "text-white/40"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
