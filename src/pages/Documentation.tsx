import { useState } from "react";
import { BookOpen, Bot, Brain, Wrench, MessageSquare, CreditCard, DoorOpen, Database, Store, Zap, Shield, ChevronRight, Search, Pill, Stethoscope, Video, FileText, Users, BarChart3, Smartphone, Key, ArrowUp, Workflow, GitBranch, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

export default function Documentation() {
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
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>Crie sua conta gratuita</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">2</span>Acesse a biblioteca de agentes em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/agentes</code></li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>Escolha um agente (precisa de créditos)</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">4</span>Envie sua pergunta ou dados e clique em "Enviar"</li>
              <li className="flex items-start gap-2"><span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">5</span>Receba a resposta inteligente gerada pela IA</li>
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
            Além dos agentes pré-configurados, você pode criar seus próprios agentes com configurações personalizadas. Acesse <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/meus-agentes</code> para começar.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Configurações disponíveis</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Nome e descrição</strong> — Identifique seu agente com clareza.</li>
              <li><strong className="text-white/80">Provedor e modelo de IA</strong> — Escolha entre OpenAI, Google, Anthropic, Groq, DeepSeek e outros.</li>
              <li><strong className="text-white/80">System prompt</strong> — Defina o comportamento e as instruções do agente. Use o modo simples (template guiado) ou avançado (prompt livre).</li>
              <li><strong className="text-white/80">Temperatura</strong> — Controle a criatividade das respostas (0 = preciso, 1 = criativo).</li>
              <li><strong className="text-white/80">Restrição de conteúdo</strong> — Limite respostas ao contexto definido no prompt.</li>
              <li><strong className="text-white/80">Resposta em Markdown</strong> — Ative para respostas formatadas com tabelas, listas e títulos.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Gerador de prompt com IA</h4>
            <p className="text-sm text-white/60 leading-relaxed">
              Não sabe escrever um system prompt? Use o gerador integrado! Descreva em linguagem natural o que seu agente deve fazer e a IA criará um prompt profissional para você. Também oferecemos um template guiado com campos como "Quem é o agente?", "O que ele faz?", "Como deve responder?" etc.
            </p>
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
            Para utilizar os agentes personalizados, você precisa cadastrar uma chave de API do provedor de IA escolhido. As chaves são armazenadas de forma criptografada no banco de dados.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Provedores suportados</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">OpenAI</strong> — GPT-4o, GPT-4o Mini, GPT-4.1, GPT-4.1 Mini, o3 Mini</li>
              <li><strong className="text-white/80">Google</strong> — Gemini 2.0 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash</li>
              <li><strong className="text-white/80">Anthropic</strong> — Claude Sonnet 4, Claude 3.5 Haiku</li>
              <li><strong className="text-white/80">Groq</strong> — LLaMA 3.3 70B, Qwen QWQ 32B</li>
              <li><strong className="text-white/80">DeepSeek</strong> — DeepSeek Chat, DeepSeek Reasoner</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-4">
            <p className="text-sm text-[hsl(38,92%,50%)]">
              <strong>Dica:</strong> Cadastre suas chaves em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conta</code> na seção "Chaves de API". Cada provedor precisa de sua própria chave.
            </p>
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
            O sistema suporta <strong className="text-white">RAG (Retrieval-Augmented Generation)</strong> — uma técnica que permite que seus agentes consultem documentos específicos ao gerar respostas, aumentando a precisão e relevância.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1. Crie uma base de conhecimento</strong> — Dê um nome e descrição em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conteudos</code>.</li>
              <li><strong className="text-white/80">2. Adicione fontes</strong> — Faça upload de documentos (PDF, DOCX, TXT, CSV), cole textos ou adicione URLs.</li>
              <li><strong className="text-white/80">3. Vincule ao agente</strong> — No editor do agente, vincule uma ou mais bases de conhecimento.</li>
              <li><strong className="text-white/80">4. Converse</strong> — O agente consultará automaticamente os documentos relevantes ao responder.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Tipos de fonte suportados</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li>📄 Texto direto (colar ou digitar)</li>
              <li>📎 Arquivos (PDF, DOCX, TXT, CSV, XLS/XLSX)</li>
              <li>🔗 URLs (páginas web)</li>
            </ul>
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
            O chat é a interface principal de interação com os agentes. Ele suporta múltiplas conversas, anexos de arquivos e templates de entrada.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Recursos do chat</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Múltiplas sessões</strong> — Crie várias conversas com o mesmo agente, cada uma com seu contexto independente.</li>
              <li><strong className="text-white/80">Anexo de arquivos</strong> — Envie PDFs, imagens, planilhas e documentos de texto junto com sua mensagem.</li>
              <li><strong className="text-white/80">Anexo de conversas</strong> — Incorpore contexto de conversas anteriores em novas mensagens.</li>
              <li><strong className="text-white/80">Templates de entrada</strong> — Salve e reutilize prompts frequentes para cada agente.</li>
              <li><strong className="text-white/80">Histórico de conversação</strong> — O agente mantém contexto de toda a conversa para respostas mais coerentes.</li>
              <li><strong className="text-white/80">Copiar e exportar</strong> — Copie respostas individuais ou exporte toda a conversa em PDF.</li>
              <li><strong className="text-white/80">Feedback</strong> — Avalie as respostas com 👍 ou 👎 para ajudar a melhorar o sistema.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Formatos suportados para anexo</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
              <span>📄 PDF</span>
              <span>📝 DOCX / DOC</span>
              <span>📊 XLSX / XLS / CSV</span>
              <span>🖼️ PNG / JPG / GIF / WebP</span>
              <span>📋 TXT</span>
            </div>
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
            As Salas Virtuais permitem que você crie ambientes de chat colaborativo vinculados a um agente personalizado. Ideal para professores que desejam usar agentes em sala de aula.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1. Crie uma sala</strong> — Defina nome, descrição, PIN de acesso e agente vinculado.</li>
              <li><strong className="text-white/80">2. Configure prazos</strong> — Opcionalmente defina data de expiração da sala e do agente.</li>
              <li><strong className="text-white/80">3. Compartilhe o PIN</strong> — Alunos acessam via <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/sala/PIN</code> sem precisar de conta.</li>
              <li><strong className="text-white/80">4. Acompanhe</strong> — Visualize todas as conversas dos participantes em tempo real.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-[hsl(174,62%,47%)]/20 bg-[hsl(174,62%,47%)]/5 p-4">
            <p className="text-sm text-[hsl(174,62%,47%)]">
              <strong>Dica:</strong> Marque a opção "Publicar na Sala Virtual" no agente para habilitar a publicação em salas virtuais.
            </p>
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
            O Marketplace permite que você compartilhe seus agentes personalizados com outros usuários da plataforma, e também adquira agentes criados por outros profissionais.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Publicar no Marketplace</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1.</strong> Acesse o editor do seu agente personalizado</li>
              <li><strong className="text-white/80">2.</strong> Na aba "Publicar", ative a opção "Publicar no Marketplace"</li>
              <li><strong className="text-white/80">3.</strong> Defina o preço em créditos</li>
              <li><strong className="text-white/80">4.</strong> Seu agente ficará disponível para compra por outros usuários</li>
            </ol>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Comprar um agente</h4>
            <p className="text-sm text-white/60 leading-relaxed">
              Ao adquirir um agente no Marketplace, você recebe uma cópia funcional que pode usar imediatamente. O custo é deduzido dos seus créditos. Você pode ver avaliações e reviews de outros usuários antes de comprar.
            </p>
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
            Conecte seus agentes personalizados ao WhatsApp para oferecer atendimento automatizado via mensagem. A integração suporta serviços como Evolution API e Z-API.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Configuração</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1.</strong> No editor do agente, ative "Publicar no WhatsApp"</li>
              <li><strong className="text-white/80">2.</strong> Escolha o serviço de integração (Evolution API ou Z-API)</li>
              <li><strong className="text-white/80">3.</strong> Insira a URL do webhook, token e phone number ID</li>
              <li><strong className="text-white/80">4.</strong> Salve e teste a conexão</li>
            </ol>
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
            O agente <strong className="text-white">Especialista PubMed</strong> realiza buscas em tempo real na base PubMed (NCBI) e sintetiza artigos científicos para você.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Modo Chat Interativo</h4>
            <p className="text-sm text-white/60 leading-relaxed">
              Faça perguntas como <em>"Quais os últimos estudos sobre metformina e longevidade?"</em> e o agente buscará artigos recentes, recuperará títulos, abstracts e autores, e sintetizará uma resposta citando as fontes com links diretos para o PubMed.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Monitor Proativo Semanal</h4>
            <p className="text-sm text-white/60 leading-relaxed">
              Cadastre seus interesses de pesquisa em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conta</code> (seção "Monitor PubMed"). Toda segunda-feira, o sistema buscará automaticamente novos artigos publicados nos últimos 7 dias e enviará notificações na plataforma com os achados relevantes.
            </p>
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
            A plataforma utiliza um sistema de créditos para controlar o uso dos agentes. Cada interação com um agente consome uma quantidade específica de créditos.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funcionam os créditos</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Agentes do sistema</strong> — Cada agente tem um custo específico (ex: 1 crédito por interação).</li>
              <li><strong className="text-white/80">Agentes personalizados</strong> — Custo fixo de 0,5 créditos por interação.</li>
              <li><strong className="text-white/80">Compra de créditos</strong> — Adquira pacotes de créditos via Stripe em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/creditos</code>.</li>
              <li><strong className="text-white/80">Assinaturas</strong> — Planos mensais com créditos recorrentes e benefícios extras.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Histórico</h4>
            <p className="text-sm text-white/60 leading-relaxed">
              Acompanhe seu saldo e histórico de transações em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conta</code>. O sistema registra cada débito e crédito com data, descrição e valor.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "dashboard",
      title: "Dashboard",
      icon: BarChart3,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O Dashboard oferece uma visão geral da sua atividade na plataforma, incluindo estatísticas de uso, conversas recentes e atalhos rápidos.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Informações disponíveis</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Saldo de créditos</strong> — Visualize rapidamente quantos créditos você possui.</li>
              <li><strong className="text-white/80">Conversas recentes</strong> — Acesse suas últimas interações com agentes.</li>
              <li><strong className="text-white/80">Agentes personalizados</strong> — Veja quantos agentes você criou.</li>
              <li><strong className="text-white/80">Bases de conhecimento</strong> — Acompanhe suas bases cadastradas.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "conversations",
      title: "Histórico de Conversas",
      icon: MessageSquare,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Todas as suas conversas são salvas automaticamente. Acesse <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conversas</code> para revisar, continuar ou exportar qualquer conversa anterior.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Funcionalidades</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Filtrar por agente</strong> — Encontre conversas específicas por agente.</li>
              <li><strong className="text-white/80">Continuar conversa</strong> — Retome qualquer conversa de onde parou.</li>
              <li><strong className="text-white/80">Exportar em PDF</strong> — Gere um PDF da conversa completa.</li>
              <li><strong className="text-white/80">Sidebar no chat</strong> — Navegue entre sessões anteriores diretamente no chat.</li>
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
    <div className="container max-w-6xl py-8">
      {/* Header */}
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
        {/* Sidebar navigation */}
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
          {/* Mobile search */}
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
            <section
              key={section.id}
              id={`doc-${section.id}`}
              className="scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-white">{section.title}</h2>
              </div>
              <div className="pl-11">
                {section.content}
              </div>
            </section>
          ))}

          {/* Back to top */}
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
  );
}
