import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      <AppHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
