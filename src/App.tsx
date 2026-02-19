import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Landing from "./pages/Landing";
import Agents from "./pages/Agents";
import Chat from "./pages/Chat";
import Credits from "./pages/Credits";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import MyAgents from "./pages/MyAgents";
import AgentEditor from "./pages/AgentEditor";
import Conversations from "./pages/Conversations";
import Knowledge from "./pages/Knowledge";
import KnowledgeDetail from "./pages/KnowledgeDetail";
import VirtualRooms from "./pages/VirtualRooms";
import VirtualRoomChat from "./pages/VirtualRoomChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/sala/:pin" element={<VirtualRoomChat />} />
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/agentes" element={<Agents />} />
              <Route path="/chat/:agentId" element={<Chat />} />
              <Route path="/creditos" element={<Credits />} />
              <Route path="/conta" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/meus-agentes" element={<MyAgents />} />
              <Route path="/meus-agentes/:agentId" element={<AgentEditor />} />
              <Route path="/conversas" element={<Conversations />} />
              <Route path="/conteudos" element={<Knowledge />} />
              <Route path="/conteudos/:kbId" element={<KnowledgeDetail />} />
              <Route path="/salas-virtuais" element={<VirtualRooms />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
