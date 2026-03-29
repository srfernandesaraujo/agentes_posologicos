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
import NativeAgentEditor from "./pages/NativeAgentEditor";
import Conversations from "./pages/Conversations";
import Knowledge from "./pages/Knowledge";
import KnowledgeDetail from "./pages/KnowledgeDetail";
import VirtualRooms from "./pages/VirtualRooms";
import VirtualRoomChat from "./pages/VirtualRoomChat";
import Marketplace from "./pages/Marketplace";
import NotFound from "./pages/NotFound";
import Flows from "./pages/Flows";
import Meetings from "./pages/Meetings";
import FlowEditor from "./pages/FlowEditor";
import UserDashboard from "./pages/UserDashboard";
import Contact from "./pages/Contact";
import ResetPassword from "./pages/ResetPassword";
import Documentation from "./pages/Documentation";
import PublicCredits from "./pages/PublicCredits";
import PublicMarketplace from "./pages/PublicMarketplace";
import PublicDocumentation from "./pages/PublicDocumentation";
import PublicContact from "./pages/PublicContact";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import VerifyCertificate from "./pages/VerifyCertificate";
import { CookieConsent } from "./components/cookies/CookieConsent";

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
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/sala/:pin" element={<VirtualRoomChat />} />
            <Route path="/precos" element={<PublicCredits />} />
            <Route path="/vitrine" element={<PublicMarketplace />} />
            <Route path="/docs" element={<PublicDocumentation />} />
            <Route path="/fale-conosco" element={<PublicContact />} />
            <Route path="/termos" element={<TermsOfService />} />
            <Route path="/privacidade" element={<PrivacyPolicy />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/verificar" element={<VerifyCertificate />} />
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/agentes" element={<Agents />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/chat/:agentId" element={<Chat />} />
              <Route path="/creditos" element={<Credits />} />
              <Route path="/conta" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/meus-agentes" element={<MyAgents />} />
              <Route path="/meus-agentes/:agentId" element={<AgentEditor />} />
              <Route path="/admin/agente/:agentId" element={<NativeAgentEditor />} />
              <Route path="/conversas" element={<Conversations />} />
              <Route path="/conteudos" element={<Knowledge />} />
              <Route path="/conteudos/:kbId" element={<KnowledgeDetail />} />
              <Route path="/salas-virtuais" element={<VirtualRooms />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/documentacao" element={<Documentation />} />
              <Route path="/fluxos" element={<Flows />} />
              <Route path="/fluxos/:flowId" element={<FlowEditor />} />
              <Route path="/reunioes" element={<Meetings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </LanguageProvider>
        <CookieConsent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
