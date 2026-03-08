import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Bot, Brain, Wrench, MessageSquare, CreditCard, DoorOpen, Database, Store, Zap, Shield, Search, Pill, Stethoscope, FileText, Smartphone, Key, ArrowUp, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FloatingAuth } from "@/components/auth/FloatingAuth";

interface DocSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

export default function PublicDocumentation() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("intro");

  const sections: DocSection[] = [
    {
      id: "intro",
      title: "Introdução",
      icon: BookOpen,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Bem-vindo à documentação da plataforma <strong className="text-white">Agentes Posológicos</strong>. Esta plataforma oferece agentes de inteligência artificial especializados nas áreas de saúde, educação, pesquisa e produção de conteúdo.
          </p>
          <p className="text-white/70 leading-relaxed">
            Nosso objetivo é fornecer ferramentas inteligentes que auxiliem profissionais de saúde, professores, pesquisadores e criadores de conteúdo em suas atividades diárias, economizando tempo e aumentando a qualidade do trabalho.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 mt-6">
            <h4 className="text-sm font-semibold text-white mb-3">Fluxo principal da plataforma</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(199,89%,48%)]/20 text-xs font-bold text-[hsl(199,89%,48%)]">1</span>Crie sua conta gratuita</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(199,89%,48%)]/20 text-xs font-bold text-[hsl(199,89%,48%)]">2</span>Acesse a biblioteca de agentes</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(199,89%,48%)]/20 text-xs font-bold text-[hsl(199,89%,48%)]">3</span>Escolha um agente (precisa de créditos)</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(199,89%,48%)]/20 text-xs font-bold text-[hsl(199,89%,48%)]">4</span>Envie sua pergunta ou dados e clique em "Enviar"</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(199,89%,48%)]/20 text-xs font-bold text-[hsl(199,89%,48%)]">5</span>Receba a resposta inteligente gerada pela IA</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "agents",
      title: "Agentes do Sistema",
      icon: Brain,
      content: (
        <div className="space-y-6">
          <p className="text-white/70 leading-relaxed">
            A plataforma oferece agentes pré-configurados organizados em 4 categorias. Cada agente possui instruções especializadas mantidas no servidor para garantir qualidade e segurança das respostas.
          </p>
          <div className="space-y-4">
            <div className="rounded-xl border border-[hsl(199,89%,48%)]/20 bg-[hsl(199,89%,48%)]/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[hsl(199,89%,48%)]" />
                <h4 className="font-semibold text-white">Prática Clínica e Farmácia</h4>
              </div>
              <ul className="space-y-2 text-sm text-white/60">
                <li><strong className="text-white/80">Analisador de Interações e Risco Cardiovascular</strong> — Cruza prescrições com dados do paciente para alertar sobre interações medicamentosas graves e calcular risco cardiovascular.</li>
                <li><strong className="text-white/80">Consultor de Antibioticoterapia</strong> — Sugere antimicrobianos baseados em diretrizes atualizadas, considerando quadro clínico e perfil de resistência.</li>
                <li><strong className="text-white/80">Educador e Tradutor Clínico</strong> — Transforma dados técnicos de tratamentos complexos em material educativo acessível para pacientes.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[hsl(174,62%,47%)]/20 bg-[hsl(174,62%,47%)]/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[hsl(174,62%,47%)]" />
                <h4 className="font-semibold text-white">EdTech e Professores 4.0</h4>
              </div>
              <ul className="space-y-2 text-sm text-white/60">
                <li><strong className="text-white/80">Arquiteto de Metodologias Ativas</strong> — Estrutura planos de aula com PBL, sala invertida, dinâmicas e critérios de avaliação.</li>
                <li><strong className="text-white/80">Simulador de Casos Clínicos</strong> — Gera cenários complexos e realistas para treinamento de estudantes e residentes.</li>
                <li><strong className="text-white/80">Analisador Adaptativo de Dados de Turma</strong> — Analisa desempenho dos alunos e sugere agrupamentos e adaptações de dificuldade.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[hsl(262,52%,56%)]/20 bg-[hsl(262,52%,56%)]/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[hsl(262,52%,56%)]" />
                <h4 className="font-semibold text-white">Pesquisa Acadêmica e Dados</h4>
              </div>
              <ul className="space-y-2 text-sm text-white/60">
                <li><strong className="text-white/80">Assistente de Editais de Fomento</strong> — Ajuda a estruturar projetos para editais estaduais e federais.</li>
                <li><strong className="text-white/80">Consultor de Análise Estatística</strong> — Indica testes estatísticos, prepara dados e interpreta resultados para publicações.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[hsl(38,92%,50%)]" />
                <h4 className="font-semibold text-white">Produção de Conteúdo e Nicho Tech</h4>
              </div>
              <ul className="space-y-2 text-sm text-white/60">
                <li><strong className="text-white/80">Estrategista de SEO para YouTube</strong> — Gera títulos, roteiros, tags e sugestões de thumbnails para conteúdo educativo.</li>
                <li><strong className="text-white/80">Desmistificador e Fact-Checker</strong> — Combate desinformação com argumentos baseados em evidências científicas.</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "custom-agents",
      title: "Agentes Personalizados",
      icon: Wrench,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Além dos agentes pré-configurados, você pode criar seus próprios agentes com configurações personalizadas.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Configurações disponíveis</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Nome e descrição</strong> — Identifique seu agente com clareza.</li>
              <li><strong className="text-white/80">Provedor e modelo de IA</strong> — Escolha entre OpenAI, Google, Anthropic, Groq, DeepSeek e outros.</li>
              <li><strong className="text-white/80">System prompt</strong> — Defina o comportamento e as instruções do agente.</li>
              <li><strong className="text-white/80">Temperatura</strong> — Controle a criatividade das respostas (0 = preciso, 1 = criativo).</li>
              <li><strong className="text-white/80">Bases de Conhecimento (RAG)</strong> — Vincule documentos para respostas contextualizadas.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "knowledge-base",
      title: "Bases de Conhecimento (RAG)",
      icon: Database,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O sistema suporta <strong className="text-white">RAG (Retrieval-Augmented Generation)</strong> — uma técnica que permite que seus agentes consultem documentos específicos ao gerar respostas.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1. Crie uma base de conhecimento</strong> — Dê um nome e descrição.</li>
              <li><strong className="text-white/80">2. Adicione fontes</strong> — Upload de PDF, DOCX, TXT, CSV, URLs ou texto direto.</li>
              <li><strong className="text-white/80">3. Vincule ao agente</strong> — No editor do agente, vincule uma ou mais bases.</li>
              <li><strong className="text-white/80">4. Converse</strong> — O agente consultará automaticamente os documentos relevantes.</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "chat",
      title: "Chat com Agentes",
      icon: MessageSquare,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O chat é a interface principal de interação com os agentes. Suporta múltiplas conversas, anexos de arquivos e templates de entrada.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Recursos do chat</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Múltiplas sessões</strong> — Crie várias conversas com contexto independente.</li>
              <li><strong className="text-white/80">Anexo de arquivos</strong> — Envie PDFs, imagens, planilhas e documentos.</li>
              <li><strong className="text-white/80">Templates de entrada</strong> — Salve e reutilize prompts frequentes.</li>
              <li><strong className="text-white/80">Copiar e exportar</strong> — Copie respostas ou exporte em PDF.</li>
              <li><strong className="text-white/80">Feedback</strong> — Avalie respostas com 👍 ou 👎.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "virtual-rooms",
      title: "Salas Virtuais",
      icon: DoorOpen,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            As Salas Virtuais permitem criar ambientes de chat colaborativo vinculados a um agente. Ideal para professores em sala de aula.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1. Crie uma sala</strong> — Defina nome, descrição, PIN e agente vinculado.</li>
              <li><strong className="text-white/80">2. Compartilhe o PIN</strong> — Alunos acessam sem precisar de conta.</li>
              <li><strong className="text-white/80">3. Acompanhe</strong> — Visualize todas as conversas em tempo real.</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "marketplace",
      title: "Marketplace",
      icon: Store,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O Marketplace permite compartilhar agentes personalizados com outros usuários e adquirir agentes criados pela comunidade.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Publicar</strong> — Ative "Publicar no Marketplace" no editor do agente.</li>
              <li><strong className="text-white/80">Adquirir</strong> — Custa 5 créditos (3 vão para o criador).</li>
              <li><strong className="text-white/80">Usar</strong> — Agentes adquiridos ficam na sua galeria com custo de 0,5 créditos por interação.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "whatsapp",
      title: "Integração WhatsApp",
      icon: Smartphone,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Conecte agentes personalizados ao WhatsApp para atendimento automatizado via mensagem. Suporta Evolution API e Z-API.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Configuração</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1.</strong> Ative "Publicar no WhatsApp" no editor do agente</li>
              <li><strong className="text-white/80">2.</strong> Escolha o serviço (Evolution API ou Z-API)</li>
              <li><strong className="text-white/80">3.</strong> Insira URL do webhook, token e phone number ID</li>
              <li><strong className="text-white/80">4.</strong> Salve e teste a conexão</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "api-keys",
      title: "Chaves de API",
      icon: Key,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Para agentes personalizados, cadastre uma chave de API do provedor de IA escolhido. As chaves são armazenadas de forma criptografada.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Provedores suportados</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">OpenAI</strong> — GPT-4o, GPT-4.1, o3 Mini</li>
              <li><strong className="text-white/80">Google</strong> — Gemini 2.0 Flash, Gemini 2.5 Pro/Flash</li>
              <li><strong className="text-white/80">Anthropic</strong> — Claude Sonnet 4, Claude 3.5 Haiku</li>
              <li><strong className="text-white/80">Groq</strong> — LLaMA 3.3 70B, Qwen QWQ 32B</li>
              <li><strong className="text-white/80">DeepSeek</strong> — DeepSeek Chat, DeepSeek Reasoner</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "credits",
      title: "Sistema de Créditos",
      icon: CreditCard,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            A plataforma utiliza créditos para controlar o uso dos agentes. Cada interação consome uma quantidade específica.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Custos</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Agentes nativos</strong> — 1, 2 ou 3 créditos dependendo da complexidade.</li>
              <li><strong className="text-white/80">Agentes personalizados</strong> — 0,5 créditos por interação.</li>
              <li><strong className="text-white/80">Bônus de boas-vindas</strong> — 15 créditos grátis ao criar a conta.</li>
              <li><strong className="text-white/80">Assinaturas</strong> — Planos mensais com créditos recorrentes.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "pubmed",
      title: "Especialista PubMed",
      icon: FileText,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O agente <strong className="text-white">Especialista PubMed</strong> realiza buscas em tempo real na base PubMed e sintetiza artigos científicos.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Recursos</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Chat Interativo</strong> — Faça perguntas e receba sínteses com citações e links diretos.</li>
              <li><strong className="text-white/80">Monitor Semanal</strong> — Cadastre interesses e receba notificações de novos artigos toda segunda-feira.</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const filteredSections = search.trim()
    ? sections.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sections;

  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold">Agentes Posológicos</span>
          </Link>
          <FloatingAuth />
        </div>
      </header>

      <div className="container max-w-6xl py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Documentação</h1>
              <p className="text-sm text-white/40">Guia completo da plataforma Agentes Posológicos</p>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20 space-y-1">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar seção..."
                  className="pl-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30"
                />
              </div>
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <nav className="space-y-0.5 pr-2">
                  {filteredSections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSection(s.id);
                        document.getElementById(`doc-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        activeSection === s.id
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/50 hover:bg-white/5 hover:text-white/70"
                      }`}
                    >
                      <s.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-12">
            <div className="lg:hidden relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar seção..."
                className="pl-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30"
              />
            </div>

            {filteredSections.map((section) => (
              <section key={section.id} id={`doc-${section.id}`} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                    <section.icon className="h-4 w-4 text-[hsl(199,89%,48%)]" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-white">{section.title}</h2>
                </div>
                <div className="pl-11">{section.content}</div>
              </section>
            ))}

            <div className="flex justify-center pt-8 pb-4">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="flex items-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                <ArrowUp className="h-4 w-4" />
                Voltar ao topo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
