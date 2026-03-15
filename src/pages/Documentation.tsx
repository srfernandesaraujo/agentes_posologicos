import { useState } from "react";
import { BookOpen, Bot, Brain, Wrench, MessageSquare, CreditCard, DoorOpen, Database, Store, Zap, Shield, ChevronRight, Search, Pill, Stethoscope, Video, FileText, Users, BarChart3, Smartphone, Key, ArrowUp, Workflow, GitBranch, FileDown, Server, Code, Lock, Layers, Globe, Cpu, HardDrive, Cable, Webhook } from "lucide-react";
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
      id: "flows",
      title: "Rede de Agentes (Fluxos)",
      icon: Workflow,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            A <strong className="text-white">Rede de Agentes</strong> permite encadear múltiplos agentes em um pipeline sequencial. Cada agente recebe a saída do anterior como contexto, criando fluxos de trabalho complexos e automatizados.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1. Crie um fluxo</strong> — Acesse <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/fluxos</code> e defina nome e descrição.</li>
              <li><strong className="text-white/80">2. Monte o pipeline</strong> — Adicione agentes como nós no editor visual e conecte-os na ordem desejada.</li>
              <li><strong className="text-white/80">3. Execute</strong> — Forneça o input inicial e o sistema processará cada etapa automaticamente.</li>
              <li><strong className="text-white/80">4. Interaja</strong> — Se um agente precisar de informações adicionais, o fluxo pausa e exibe um chat inline para você responder.</li>
              <li><strong className="text-white/80">5. Exporte</strong> — Ao final, gere um PDF com o resultado completo de todas as etapas.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Recursos do pipeline</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Pipeline visual</strong> — Indicador fixo no topo mostra a etapa atual e o status (processando/concluído) de cada nó.</li>
              <li><strong className="text-white/80">Modo interativo</strong> — Detecção automática de perguntas do agente com pausa para resposta do usuário.</li>
              <li><strong className="text-white/80">Transição inteligente</strong> — Cada agente recebe o contexto completo das etapas anteriores para respostas complementares.</li>
              <li><strong className="text-white/80">Exportação em PDF</strong> — Botão "Gerar PDF" disponível ao final do fluxo para download do resultado completo.</li>
              <li><strong className="text-white/80">Mapas mentais</strong> — Agentes que geram mapas mentais renderizam automaticamente uma visualização SVG interativa com zoom e pan.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[hsl(174,62%,47%)]/20 bg-[hsl(174,62%,47%)]/5 p-4">
            <p className="text-sm text-[hsl(174,62%,47%)]">
              <strong>Exemplo de fluxo:</strong> Arquiteto de Metodologias → Simulador de Casos Clínicos → Gerador de Mapas Mentais. O professor insere um tema e recebe um plano de aula completo, casos clínicos para discussão e um mapa mental visual — tudo encadeado automaticamente.
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
    // ──────────────── DOCUMENTAÇÃO TÉCNICA ────────────────
    {
      id: "tech-overview",
      title: "Visão Geral Técnica",
      icon: Server,
      content: (
        <div className="space-y-4">
          <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-4 mb-4">
            <p className="text-sm text-[hsl(38,92%,50%)]">
              <strong>Seção Técnica:</strong> As seções a seguir descrevem a arquitetura interna, banco de dados, APIs e tecnologias utilizadas na construção da plataforma.
            </p>
          </div>
          <p className="text-white/70 leading-relaxed">
            O <strong className="text-white">Agentes Posológicos</strong> é uma aplicação web SPA (Single Page Application) construída com arquitetura serverless. O frontend é uma aplicação React hospedada estaticamente, enquanto toda a lógica de backend roda em <strong className="text-white">Supabase Edge Functions</strong> (Deno runtime).
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Stack principal</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/60">
              <div><strong className="text-white/80">Frontend:</strong> React 18 + TypeScript + Vite</div>
              <div><strong className="text-white/80">Estilização:</strong> Tailwind CSS + shadcn/ui</div>
              <div><strong className="text-white/80">State Management:</strong> TanStack React Query</div>
              <div><strong className="text-white/80">Roteamento:</strong> React Router v6</div>
              <div><strong className="text-white/80">Backend:</strong> Supabase (PostgreSQL + Auth + Storage + Edge Functions)</div>
              <div><strong className="text-white/80">Runtime Backend:</strong> Deno (Edge Functions)</div>
              <div><strong className="text-white/80">Pagamentos:</strong> Stripe (Checkout + Webhooks)</div>
              <div><strong className="text-white/80">IA Gateway:</strong> Lovable AI (Gemini / GPT-5)</div>
              <div><strong className="text-white/80">Reuniões:</strong> Recall.ai (transcrição Meet)</div>
              <div><strong className="text-white/80">Exportação:</strong> jsPDF + html2canvas</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Fluxo de uma requisição típica</h4>
            <ol className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">1.</strong> Usuário envia mensagem no chat (React frontend)</li>
              <li><strong className="text-white/80">2.</strong> Frontend chama <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">supabase.functions.invoke("agent-chat")</code></li>
              <li><strong className="text-white/80">3.</strong> Edge Function valida JWT via <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">getClaims()</code>, verifica créditos e carrega contexto RAG</li>
              <li><strong className="text-white/80">4.</strong> Edge Function chama o Lovable AI Gateway (ou provedor configurado) com streaming SSE</li>
              <li><strong className="text-white/80">5.</strong> Resposta é transmitida token-por-token ao frontend via Server-Sent Events</li>
              <li><strong className="text-white/80">6.</strong> Edge Function debita créditos e salva mensagens no banco</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "tech-database",
      title: "Estrutura do Banco de Dados",
      icon: HardDrive,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O banco de dados é <strong className="text-white">PostgreSQL</strong> gerenciado pelo Supabase. Todas as tabelas utilizam <strong className="text-white">Row-Level Security (RLS)</strong> para isolamento de dados por usuário.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Tabelas principais</h4>
            <div className="space-y-3 text-sm">
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agents</code>
                <p className="text-white/50 text-xs mt-1">Agentes nativos do sistema. Campos: name, slug, category, system_prompt, model, provider, temperature, credit_cost. Leitura pública, edição apenas por admins.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">custom_agents</code>
                <p className="text-white/50 text-xs mt-1">Agentes personalizados dos usuários. Inclui system_prompt, model, provider, temperature, flags de publicação (marketplace, WhatsApp, sala virtual), restrict_content e markdown_response.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">chat_sessions</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">messages</code>
                <p className="text-white/50 text-xs mt-1">Sessões de chat e mensagens. Cada sessão vincula user_id + agent_id (sem FK para suportar nativos e custom). Messages armazena role, content e tokens_used.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">knowledge_bases</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">knowledge_sources</code>
                <p className="text-white/50 text-xs mt-1">Bases de conhecimento RAG. Sources armazena content (texto extraído), type (text/file/url/youtube), file_path, url e metadata JSON.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_knowledge_bases</code>
                <p className="text-white/50 text-xs mt-1">Tabela de junção N:N entre custom_agents e knowledge_bases. Permite vincular múltiplas bases a um agente.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">credits_ledger</code>
                <p className="text-white/50 text-xs mt-1">Ledger financeiro append-only. Registra type (bonus, purchase, usage, refund), amount e description. Saldo = SUM(amount).</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flows</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flow_nodes</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flow_edges</code>
                <p className="text-white/50 text-xs mt-1">Rede de Agentes. Flows contém metadata, nodes representam agentes no pipeline (com position e sort_order), edges conectam nós.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flow_executions</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flow_node_results</code>
                <p className="text-white/50 text-xs mt-1">Execuções de fluxos. Armazena input/output de cada etapa, status e timestamps.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">virtual_rooms</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">room_messages</code>
                <p className="text-white/50 text-xs mt-1">Salas virtuais com PIN de acesso. room_messages permite inserção sem autenticação (anon) para salas ativas.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meetings</code>
                <p className="text-white/50 text-xs mt-1">Reuniões do Google Meet. Armazena meet_link, bot_id (Recall.ai), transcript, summary e status (pending→recording→transcribing→summarizing→done).</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">profiles</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">user_roles</code>
                <p className="text-white/50 text-xs mt-1">Perfis de usuário e sistema de roles (admin/user). Roles em tabela separada com função security definer has_role() para evitar recursão de RLS.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">user_api_keys</code>
                <p className="text-white/50 text-xs mt-1">Chaves de API dos provedores de IA. Criptografadas em repouso com pgcrypto (AES) via funções encrypt_api_key/decrypt_api_key.</p>
              </div>
              <div>
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">analytics_events</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">ai_usage_log</code>
                <p className="text-white/50 text-xs mt-1">Eventos de analytics (page views, cliques, UTMs) e log de uso de IA (provider, model, tokens, custo estimado).</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Storage Buckets</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">knowledge-files</code> — Arquivos de fontes de conhecimento (privado)</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">avatars</code> — Fotos de perfil dos usuários (público)</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Funções de banco de dados</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">has_role(user_id, role)</code> — Verifica role do usuário (security definer, evita recursão RLS)</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">encrypt_api_key(key)</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">decrypt_api_key(encrypted)</code> — Criptografia AES via pgcrypto</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">get_room_by_pin(pin)</code> — Busca sala virtual por PIN (security definer)</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">get_current_user_email()</code> — Retorna email do usuário autenticado</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">handle_new_user()</code> — Trigger: cria perfil automaticamente no cadastro</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">grant_signup_bonus()</code> — Trigger: concede 15 créditos no cadastro</li>
              <li><code className="text-[hsl(174,62%,47%)] font-mono text-xs">update_updated_at_column()</code> — Trigger genérico para atualizar updated_at</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "tech-edge-functions",
      title: "Edge Functions (Backend)",
      icon: Cpu,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Toda a lógica de backend roda em <strong className="text-white">Supabase Edge Functions</strong> — funções serverless escritas em TypeScript executadas no runtime Deno. Cada função é deployada automaticamente.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Funções disponíveis</h4>
            <div className="space-y-3 text-sm">
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-chat</code>
                <p className="text-white/50 text-xs mt-1">Core do sistema. Recebe mensagem, valida auth, verifica créditos, carrega contexto RAG (knowledge bases), chama o provedor de IA com streaming SSE, debita créditos e salva mensagens. Suporta chamadas server-to-server (isServerCall) para fluxos automatizados.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-flow-execute</code>
                <p className="text-white/50 text-xs mt-1">Executa uma etapa do pipeline de fluxos. Chama agent-chat internamente usando SUPABASE_SERVICE_ROLE_KEY para autenticação server-to-server.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-flow-plan</code>
                <p className="text-white/50 text-xs mt-1">Gera fluxos automaticamente via IA a partir de descrição em linguagem natural. Usa tool calling para retornar estrutura JSON de nós e conexões.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-bot</code>
                <p className="text-white/50 text-xs mt-1">Envia bot do Recall.ai para uma reunião do Google Meet. Valida formato do link, cria bot via API REST e salva na tabela meetings.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-webhook</code>
                <p className="text-white/50 text-xs mt-1">Recebe callbacks do Recall.ai (status changes, transcrição pronta). Busca transcrição completa, gera ata com IA e atualiza o banco.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-summary</code>
                <p className="text-white/50 text-xs mt-1">Regenera ata de reunião a partir da transcrição existente. Permite prompt customizado.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">create-checkout</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">stripe-webhook</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">customer-portal</code>
                <p className="text-white/50 text-xs mt-1">Integração Stripe. Cria sessões de checkout, processa webhooks (pagamento confirmado → credita créditos) e gerencia portal do cliente.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">check-subscription</code>
                <p className="text-white/50 text-xs mt-1">Verifica status de assinatura do usuário via Stripe API. Retorna status padrão (200) em vez de erros para estabilidade do frontend.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">youtube-transcript</code>
                <p className="text-white/50 text-xs mt-1">Extrai transcrição automática de vídeos do YouTube para uso como fonte de conhecimento RAG.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">pubmed-monitor</code>
                <p className="text-white/50 text-xs mt-1">Busca artigos recentes no PubMed baseado nos interesses de pesquisa do usuário. Executado semanalmente via cron.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">manage-api-keys</code>
                <p className="text-white/50 text-xs mt-1">CRUD de chaves de API dos provedores. Usa pgcrypto para criptografia/descriptografia em repouso.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">admin-analytics</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">hub-metrics</code>
                <p className="text-white/50 text-xs mt-1">Endpoints de analytics e métricas. admin-analytics agrega dados para o painel admin. hub-metrics expõe métricas para monitoramento externo.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">invite-user</code>
                <p className="text-white/50 text-xs mt-1">Convida usuários para acesso ilimitado. Restrito a admins via validação de role.</p>
              </div>
              <div className="border-b border-white/5 pb-2">
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">purchase-agent</code>
                <p className="text-white/50 text-xs mt-1">Processa compra de agentes no Marketplace. Debita créditos do comprador e registra a aquisição.</p>
              </div>
              <div>
                <code className="text-[hsl(174,62%,47%)] font-mono text-xs">contact-form</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">expire-rooms</code>
                <p className="text-white/50 text-xs mt-1">Envia emails de contato (Resend) e expira salas virtuais com prazo vencido.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tech-apis",
      title: "APIs e Serviços Externos",
      icon: Globe,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O sistema integra com diversas APIs externas. Todas as chamadas são feitas server-side (Edge Functions) para proteger chaves de API.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Serviços integrados</h4>
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-[hsl(174,62%,47%)]" />
                  <strong className="text-white">Lovable AI Gateway</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">Endpoint: <code className="bg-white/10 px-1 py-0.5 rounded">https://ai.gateway.lovable.dev/v1/chat/completions</code><br/>Modelos: Google Gemini (2.5 Pro, 2.5 Flash, 3 Flash Preview), OpenAI GPT-5. Usado para agentes nativos, geração de atas e planejamento de fluxos. Autenticação via LOVABLE_API_KEY (auto-provisionada).</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-[hsl(199,89%,48%)]" />
                  <strong className="text-white">Provedores de IA (via chave do usuário)</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">OpenAI, Google AI, Anthropic, Groq, DeepSeek. Chaves armazenadas criptografadas no banco. O agent-chat seleciona o endpoint correto baseado no provider do agente.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-[hsl(262,52%,56%)]" />
                  <strong className="text-white">Stripe</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">Checkout Sessions para compra de créditos, Webhooks para confirmação de pagamento, Customer Portal para gestão de assinaturas. Chaves: STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <strong className="text-white">Recall.ai</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">API: <code className="bg-white/10 px-1 py-0.5 rounded">https://us-west-2.recall.ai/api/v1/bot</code><br/>Cria bots que entram em reuniões do Google Meet, gravam áudio, transcrevem e enviam webhooks. Autenticação: Token header.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                  <strong className="text-white">PubMed (NCBI E-utilities)</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">API pública do NCBI para busca de artigos científicos. Endpoints esearch e efetch. Usado pelo agente PubMed e pelo monitor semanal.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <strong className="text-white">Resend</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">Serviço de envio de emails transacionais. Usado pelo formulário de contato. Chave: RESEND_API_KEY.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <strong className="text-white">WhatsApp (Evolution API / Z-API)</strong>
                </div>
                <p className="text-white/50 text-xs ml-4">Integração opcional para conectar agentes ao WhatsApp. Configuração por agente com webhook URL, token e phone number ID.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tech-security",
      title: "Segurança e Autenticação",
      icon: Lock,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            A segurança é implementada em múltiplas camadas: autenticação via Supabase Auth, autorização via RLS e roles, criptografia de dados sensíveis e validação server-side.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Camadas de segurança</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Autenticação</strong> — Supabase Auth com email/senha. JWT validado via <code className="bg-white/10 px-1 py-0.5 rounded text-xs">getClaims()</code> em todas as Edge Functions.</li>
              <li><strong className="text-white/80">Row-Level Security (RLS)</strong> — Todas as tabelas têm RLS ativado. Cada usuário acessa apenas seus próprios dados. Função <code className="bg-white/10 px-1 py-0.5 rounded text-xs">has_role()</code> com security definer para verificar roles sem recursão.</li>
              <li><strong className="text-white/80">Roles em tabela separada</strong> — Roles (admin/user) armazenados na tabela <code className="bg-white/10 px-1 py-0.5 rounded text-xs">user_roles</code>, nunca no perfil — prevenindo escalação de privilégio.</li>
              <li><strong className="text-white/80">Criptografia de API Keys</strong> — Chaves de provedores de IA criptografadas com AES via extensão pgcrypto. Chave mestra: API_ENCRYPTION_KEY (secret do Supabase).</li>
              <li><strong className="text-white/80">Server-to-server auth</strong> — Comunicação interna entre Edge Functions usa SUPABASE_SERVICE_ROLE_KEY com padrão isServerCall para processos automatizados.</li>
              <li><strong className="text-white/80">Validação de input</strong> — Limite de 60.000 caracteres por mensagem, histórico máximo de 50 mensagens, sanitização de HTML.</li>
              <li><strong className="text-white/80">Débito server-side</strong> — Créditos são debitados na Edge Function após geração da resposta, nunca no frontend.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Secrets configurados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-white/50 font-mono">
              <span>SUPABASE_SERVICE_ROLE_KEY</span>
              <span>SUPABASE_ANON_KEY</span>
              <span>LOVABLE_API_KEY</span>
              <span>STRIPE_SECRET_KEY</span>
              <span>STRIPE_WEBHOOK_SECRET</span>
              <span>API_ENCRYPTION_KEY</span>
              <span>RECALL_API_KEY</span>
              <span>RESEND_API_KEY</span>
              <span>HUB_SERVICE_KEY / HUB_METRICS_KEY</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tech-architecture",
      title: "Padrões de Arquitetura",
      icon: Layers,
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O projeto segue padrões arquiteturais consistentes para manter a qualidade e facilitar a manutenção.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Padrões do Frontend</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">Design System</strong> — Tokens semânticos em CSS (--primary, --background, etc.) com tema dark-first. Componentes shadcn/ui customizados.</li>
              <li><strong className="text-white/80">Data Fetching</strong> — TanStack React Query para cache, refetch e invalidação. Queries com keys compostas (ex: ["meetings", userId]).</li>
              <li><strong className="text-white/80">Hooks personalizados</strong> — useCredits, useAgents, useCustomAgents, useSubscription, useIsAdmin, etc. Encapsulam lógica de dados.</li>
              <li><strong className="text-white/80">Streaming SSE</strong> — Parsing line-by-line de Server-Sent Events para renderização token-por-token das respostas de IA.</li>
              <li><strong className="text-white/80">Exportação PDF</strong> — Motor dedicado via jsPDF com branding "Agentes Posológicos" (cabeçalhos Slate-900, acentos Teal-500).</li>
              <li><strong className="text-white/80">i18n</strong> — Sistema de traduções com LanguageContext suportando PT-BR e EN.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Padrões do Backend</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><strong className="text-white/80">CORS headers padrão</strong> — Todas as Edge Functions incluem headers CORS para compatibilidade com web apps.</li>
              <li><strong className="text-white/80">verify_jwt = false</strong> — JWT validado em código (não no gateway) usando getClaims() para compatibilidade com signing-keys.</li>
              <li><strong className="text-white/80">Graceful error handling</strong> — Retorna status 200 com dados padrão em vez de 500 para manter estabilidade do frontend.</li>
              <li><strong className="text-white/80">Service role para webhooks</strong> — Webhooks externos (Stripe, Recall.ai) usam SUPABASE_SERVICE_ROLE_KEY para acessar dados sem JWT de usuário.</li>
              <li><strong className="text-white/80">Append-only ledger</strong> — Credits nunca são editados/deletados — apenas novas entradas são inseridas.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Estrutura de diretórios</h4>
            <pre className="text-xs text-white/50 font-mono leading-relaxed overflow-x-auto">{`src/
├── components/     # Componentes React (ui/, layout/, chat/, agents/, etc.)
├── contexts/       # AuthContext, LanguageContext
├── hooks/          # Custom hooks (useCredits, useAgents, etc.)
├── integrations/   # Cliente Supabase + tipos auto-gerados
├── lib/            # Utilitários (exportPdf, icons, utils)
├── pages/          # Páginas/rotas da aplicação
└── i18n/           # Traduções PT-BR / EN

supabase/
└── functions/      # Edge Functions (Deno runtime)
    ├── agent-chat/
    ├── meeting-bot/
    ├── meeting-webhook/
    └── ...16 funções ao total`}</pre>
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
