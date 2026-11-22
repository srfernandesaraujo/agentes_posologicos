import { Suspense } from "react";
import { lazyPage } from "@/lib/lazyPage";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NewUIProvider } from "@/contexts/NewUIContext";
import { useForceDark } from "@/contexts/NewUIContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
const Login = lazyPage(() => import("./pages/Login"));
const Signup = lazyPage(() => import("./pages/Signup"));
import Landing from "./pages/Landing";
const Agents = lazyPage(() => import("./pages/Agents"));
const Chat = lazyPage(() => import("./pages/Chat"));
const Credits = lazyPage(() => import("./pages/Credits"));
const Account = lazyPage(() => import("./pages/Account"));
const Institution = lazyPage(() => import("./pages/Institution"));
const Admin = lazyPage(() => import("./pages/Admin"));
const Settings = lazyPage(() => import("./pages/Settings"));
const MyAgents = lazyPage(() => import("./pages/MyAgents"));
const AgentEditor = lazyPage(() => import("./pages/AgentEditor"));
const NativeAgentEditor = lazyPage(() => import("./pages/NativeAgentEditor"));
const Conversations = lazyPage(() => import("./pages/Conversations"));
const Knowledge = lazyPage(() => import("./pages/Knowledge"));
const KnowledgeDetail = lazyPage(() => import("./pages/KnowledgeDetail"));
const VirtualRooms = lazyPage(() => import("./pages/VirtualRooms"));
const VirtualRoomChat = lazyPage(() => import("./pages/VirtualRoomChat"));
const LiveClass = lazyPage(() => import("./pages/LiveClass"));
const Marketplace = lazyPage(() => import("./pages/Marketplace"));
const MarketplaceFlows = lazyPage(() => import("./pages/MarketplaceFlows"));
const Orchestrator = lazyPage(() => import("./pages/Orchestrator"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const Flows = lazyPage(() => import("./pages/Flows"));
const Squads = lazyPage(() => import("./pages/Squads"));
const SquadDetail = lazyPage(() => import("./pages/SquadDetail"));
const Meetings = lazyPage(() => import("./pages/Meetings"));
const FlowEditor = lazyPage(() => import("./pages/FlowEditor"));
const Projects = lazyPage(() => import("./pages/Projects"));
const ProjectDetail = lazyPage(() => import("./pages/ProjectDetail"));
const UserDashboard = lazyPage(() => import("./pages/UserDashboard"));
const DoseCalculatorPage = lazyPage(() => import("./pages/DoseCalculatorPage"));
const VisualLab = lazyPage(() => import("./pages/VisualLab"));
const Contact = lazyPage(() => import("./pages/Contact"));
const Support = lazyPage(() => import("./pages/Support"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const Documentation = lazyPage(() => import("./pages/Documentation"));
const PublicCredits = lazyPage(() => import("./pages/PublicCredits"));
const PublicMarketplace = lazyPage(() => import("./pages/PublicMarketplace"));
const PublicDocumentation = lazyPage(() => import("./pages/PublicDocumentation"));
const PublicContact = lazyPage(() => import("./pages/PublicContact"));
const TermsOfService = lazyPage(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazyPage(() => import("./pages/CookiePolicy"));
const VerifyCertificate = lazyPage(() => import("./pages/VerifyCertificate"));
const Briefing = lazyPage(() => import("./pages/Briefing"));
const OSCE = lazyPage(() => import("./pages/OSCE"));
const OSCEStationEditor = lazyPage(() => import("./pages/OSCEStationEditor"));
const OSCEAttendance = lazyPage(() => import("./pages/OSCEAttendance"));
const OSCEResult = lazyPage(() => import("./pages/OSCEResult"));
const OSCEExamEditor = lazyPage(() => import("./pages/OSCEExamEditor"));
const OSCEJoin = lazyPage(() => import("./pages/OSCEJoin"));
const OSCESessionTeacher = lazyPage(() => import("./pages/OSCESessionTeacher"));
const OSCESessionStudent = lazyPage(() => import("./pages/OSCESessionStudent"));
const MeetingInvite = lazyPage(() => import("./pages/MeetingInvite"));
const MeetingGuest = lazyPage(() => import("./pages/MeetingGuest"));
import { CookieConsent } from "./components/cookies/CookieConsent";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

/** Páginas públicas e de convidado são desenhadas só no escuro. */
const Dark = ({ children }: { children: React.ReactNode }) => { useForceDark(); return <>{children}</>; };

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NewUIProvider>
        <LanguageProvider>
        <AuthProvider>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Carregando"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" /></div>}>
          <Routes>
            <Route path="/" element={<Dark><Landing /></Dark>} />
            <Route path="/login" element={<Dark><Login /></Dark>} />
            <Route path="/signup" element={<Dark><Signup /></Dark>} />
            <Route path="/redefinir-senha" element={<Dark><ResetPassword /></Dark>} />
            <Route path="/sala/:pin" element={<Dark><VirtualRoomChat /></Dark>} />
            {/* Acesso público de alunos por PIN ao OSCE */}
            <Route path="/osce/entrar" element={<Dark><OSCEJoin /></Dark>} />
            <Route path="/osce/sala/:sessionId" element={<Dark><OSCESessionStudent /></Dark>} />
            <Route path="/osce/atendimento/:attemptId" element={<Dark><OSCEAttendance /></Dark>} />
            <Route path="/precos" element={<Dark><PublicCredits /></Dark>} />
            <Route path="/vitrine" element={<Dark><PublicMarketplace /></Dark>} />
            <Route path="/docs" element={<Dark><PublicDocumentation /></Dark>} />
            <Route path="/fale-conosco" element={<Dark><PublicContact /></Dark>} />
            <Route path="/termos" element={<Dark><TermsOfService /></Dark>} />
            <Route path="/privacidade" element={<Dark><PrivacyPolicy /></Dark>} />
            <Route path="/cookies" element={<Dark><CookiePolicy /></Dark>} />
            <Route path="/verificar" element={<Dark><VerifyCertificate /></Dark>} />
            <Route path="/briefing/:id" element={<Dark><Briefing /></Dark>} />
            {/* Reunião Viva: convidado entra pelo link (a página pede login e volta) */}
            <Route path="/reuniao-viva/convite/:token" element={<Dark><MeetingInvite /></Dark>} />
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/agentes" element={<Agents />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/calculadora" element={<DoseCalculatorPage />} />
              <Route path="/laboratorio-visual" element={<VisualLab />} />
              <Route path="/chat/:agentId" element={<Chat />} />
              <Route path="/creditos" element={<Credits />} />
              <Route path="/conta" element={<Account />} />
              <Route path="/instituicao" element={<Institution />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/meus-agentes" element={<MyAgents />} />
              <Route path="/meus-agentes/:agentId" element={<AgentEditor />} />
              <Route path="/admin/agente/:agentId" element={<NativeAgentEditor />} />
              <Route path="/conversas" element={<Conversations />} />
              <Route path="/conteudos" element={<Knowledge />} />
              <Route path="/conteudos/:kbId" element={<KnowledgeDetail />} />
              <Route path="/salas-virtuais" element={<VirtualRooms />} />
              <Route path="/salas-virtuais/aula/:pin" element={<LiveClass />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/marketplace/fluxos" element={<MarketplaceFlows />} />
              <Route path="/orquestrador" element={<Orchestrator />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/suporte" element={<Support />} />
              <Route path="/documentacao" element={<Documentation />} />
              <Route path="/fluxos" element={<Flows />} />
              <Route path="/squads" element={<Squads />} />
              <Route path="/squads/:squadId" element={<SquadDetail />} />
              <Route path="/fluxos/:flowId" element={<FlowEditor />} />
              <Route path="/reunioes" element={<Meetings />} />
              <Route path="/reuniao-viva/:meetingId" element={<MeetingGuest />} />
              <Route path="/projetos" element={<Projects />} />
              <Route path="/projetos/:projectId" element={<ProjectDetail />} />
              <Route path="/osce" element={<OSCE />} />
              <Route path="/osce/estacao/:id" element={<OSCEStationEditor />} />
              <Route path="/osce/resultado/:attemptId" element={<OSCEResult />} />
              <Route path="/osce/prova/:id" element={<OSCEExamEditor />} />
              <Route path="/osce/sessao/:sessionId" element={<OSCESessionTeacher />} />
            </Route>
            <Route path="*" element={<Dark><NotFound /></Dark>} />
          </Routes>
          </Suspense>
        </AuthProvider>
        </LanguageProvider>
        </NewUIProvider>
        <CookieConsent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
