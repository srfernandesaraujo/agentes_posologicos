import {
  BookOpen, Brain, Wrench, MessageSquare, CreditCard, DoorOpen, Database, Store, Zap,
  Search, FileText, BarChart3, Smartphone, Key, Workflow, Server, Code, Lock, Layers,
  Globe, Cpu, HardDrive, ClipboardCheck, FolderKanban, ShieldCheck, Video, Sparkles,
  Mic, Headphones, UserCog,
} from "lucide-react";

export interface DocSection {
  id: string;
  title: string;
  icon: any;
  /** Only rendered for users with the admin role, and only on the internal (protected) docs page. */
  adminOnly?: boolean;
  content: React.ReactNode;
}

/**
 * Single source of truth for user-facing documentation content.
 * Shared between the public docs page (/docs) and the internal docs page (/documentacao)
 * so the two never drift out of sync.
 */
export const docSections: DocSection[] = [
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
            <li><strong className="text-white/80">Provedor e modelo de IA</strong> — Escolha entre OpenAI, Google, Anthropic, Groq, DeepSeek e outros (requer sua própria chave de API — veja a seção Chaves de API).</li>
            <li><strong className="text-white/80">System prompt</strong> — Defina o comportamento e as instruções do agente. Use o modo simples (template guiado) ou avançado (prompt livre).</li>
            <li><strong className="text-white/80">Temperatura</strong> — Controle a criatividade das respostas (0 = preciso, 1 = criativo).</li>
            <li><strong className="text-white/80">Restrição de conteúdo</strong> — Limite respostas ao contexto definido no prompt.</li>
            <li><strong className="text-white/80">Resposta em Markdown</strong> — Ative para respostas formatadas com tabelas, listas e títulos.</li>
            <li><strong className="text-white/80">Bases de Conhecimento (RAG)</strong> — Vincule documentos para respostas contextualizadas.</li>
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
            <li><strong className="text-white/80">OpenAI</strong> — GPT-4o, GPT-4.1, o3 Mini e outros modelos compatíveis</li>
            <li><strong className="text-white/80">Google</strong> — Gemini 2.5 Pro, Gemini 2.5 Flash e demais modelos Gemini</li>
            <li><strong className="text-white/80">Anthropic</strong> — Claude Sonnet 4, Claude 3.5 Haiku</li>
            <li><strong className="text-white/80">Groq</strong> — LLaMA 3.3 70B e outros modelos de baixa latência</li>
            <li><strong className="text-white/80">NVIDIA, GitHub Models e OpenRouter</strong> — provedores adicionais compatíveis com o padrão OpenAI</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-4">
          <p className="text-sm text-[hsl(38,92%,50%)]">
            <strong>Dica:</strong> Cadastre suas chaves em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conta</code> na seção "Chaves de API". Cada provedor precisa de sua própria chave. Antes de salvar, o sistema testa a validade da chave automaticamente.
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
            <li>🔗 URLs (páginas web e vídeos do YouTube, com transcrição automática)</li>
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
          O chat é a interface principal de interação com os agentes. Ele suporta múltiplas conversas, anexos de arquivos, entrada por voz e templates de entrada.
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
            <li><strong className="text-white/80">Feedback</strong> — Avalie as respostas com 👍 ou 👎; esse sinal alimenta o ajuste automático de agentes personalizados.</li>
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
    id: "voice",
    title: "Recursos de Voz",
    icon: Mic,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          O chat suporta entrada e saída por voz, útil para consultas rápidas ou em situações onde digitar não é prático.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Ditar mensagens</strong> — Grave um áudio diretamente no chat; o sistema transcreve automaticamente para texto antes de enviar ao agente.</li>
            <li><strong className="text-white/80">Ouvir respostas</strong> — Qualquer resposta de um agente pode ser convertida em áudio narrado (voz natural em pt-BR) com um clique, direto no chat.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "briefing",
    title: "Briefing por Voz",
    icon: Headphones,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          O <strong className="text-white">Briefing por Voz</strong> gera um resumo narrado e por escrito combinando os interesses de pesquisa cadastrados por você com as últimas novidades da plataforma.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Geração automática</strong> — O sistema cruza seus interesses de pesquisa com atualizações recentes da plataforma e artigos relevantes.</li>
            <li><strong className="text-white/80">Áudio + texto</strong> — O briefing pode ser lido ou ouvido, com narração por voz.</li>
            <li><strong className="text-white/80">Link compartilhável</strong> — Cada briefing tem uma página própria (<code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/briefing/:id</code>) que pode ser acessada e compartilhada mesmo sem login.</li>
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
          As Salas Virtuais permitem que você crie ambientes de chat colaborativo vinculados a um agente personalizado. Ideal para professores que desejam usar agentes em sala de aula.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1. Crie uma sala</strong> — Defina nome, descrição, PIN de acesso e agente vinculado.</li>
            <li><strong className="text-white/80">2. Configure prazos</strong> — Opcionalmente defina data de expiração da sala e do agente.</li>
            <li><strong className="text-white/80">3. Compartilhe o PIN</strong> — Alunos acessam via <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/sala/PIN</code> sem precisar de conta.</li>
            <li><strong className="text-white/80">4. Acompanhe</strong> — Visualize todas as conversas dos participantes em tempo real no Painel do Professor, incluindo um resumo automático das dúvidas agrupadas por tema.</li>
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
            <li><strong className="text-white/80">3.</strong> Seu agente ficará disponível para compra por outros usuários</li>
          </ol>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Comprar um agente</h4>
          <p className="text-sm text-white/60 leading-relaxed">
            Adquirir um agente no Marketplace custa <strong className="text-white">5 créditos</strong>, dos quais <strong className="text-white">3 créditos são repassados ao criador</strong> do agente. Você recebe uma cópia funcional que pode usar imediatamente.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Marketplace de Fluxos</h4>
          <p className="text-sm text-white/60 leading-relaxed">
            Em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/marketplace/fluxos</code>, é possível publicar e instalar fluxos completos (Rede de Agentes) criados por outros usuários, com o custo em créditos debitado no momento da instalação.
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
            <li><strong className="text-white/80">2. Monte o pipeline</strong> — Adicione agentes como nós no editor visual e conecte-os na ordem desejada, ou peça para a IA montar o fluxo automaticamente a partir de uma descrição.</li>
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
    id: "orchestrator",
    title: "Agente Orquestrador",
    icon: Sparkles,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          O <strong className="text-white">Agente Orquestrador</strong> (<code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/orquestrador</code>) recebe uma demanda complexa em linguagem natural, decide sozinho quais agentes nativos são necessários, executa cada um automaticamente e consolida tudo em um dossiê final único — sem que você precise montar um fluxo manualmente.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1.</strong> Descreva sua necessidade em texto livre (ex: "Preparar atendimento de paciente com DM2 + HAS recém diagnosticado").</li>
            <li><strong className="text-white/80">2.</strong> O sistema decompõe a demanda em sub-tarefas e seleciona os agentes nativos mais adequados para cada uma.</li>
            <li><strong className="text-white/80">3.</strong> Cada sub-tarefa é executada e os resultados são combinados em um dossiê final, que pode ser exportado em PDF.</li>
          </ol>
        </div>
        <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-4">
          <p className="text-sm text-[hsl(38,92%,50%)]">
            <strong>Créditos:</strong> custo fixo de 12 créditos por execução (gratuito para administradores e contas com acesso ilimitado).
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
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como as mensagens são respondidas</h4>
          <p className="text-sm text-white/60 leading-relaxed">
            Toda mensagem recebida no número conectado é processada automaticamente: o sistema identifica o agente vinculado, gera a resposta com a IA configurada e a envia de volta pelo WhatsApp — sem intervenção manual.
          </p>
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
            Cadastre seus interesses de pesquisa em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conta</code> (seção "Monitor PubMed"). Toda segunda-feira, o sistema buscará automaticamente novos artigos publicados nos últimos 7 dias e enviará notificações na plataforma com os achados relevantes. Esses mesmos interesses também alimentam o Briefing por Voz.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "osce",
    title: "OSCE — Estações Clínicas",
    icon: ClipboardCheck,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          O módulo <strong className="text-white">OSCE</strong> (Objective Structured Clinical Examination) permite criar <strong className="text-white">estações clínicas com paciente virtual</strong> alimentado por IA, agrupá-las em provas e aplicá-las de forma assíncrona ou ao vivo para uma turma inteira com PIN de acesso.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Estrutura</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Estação</strong> — cenário clínico com título, briefing, perguntas-chave esperadas, condutas, rubrica de avaliação e dificuldade (fácil / média / difícil).</li>
            <li><strong className="text-white/80">Prova</strong> — agrupa várias estações em ordem para compor um exame.</li>
            <li><strong className="text-white/80">Sessão ao vivo</strong> — aplicação sincronizada da prova para uma turma, controlada pelo professor em tempo real.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Modo assíncrono</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1.</strong> O aluno entra na estação a qualquer momento.</li>
            <li><strong className="text-white/80">2.</strong> Conversa com o paciente virtual (IA) — anamnese, conduta, contraindicações.</li>
            <li><strong className="text-white/80">3.</strong> Ao encerrar, o sistema avalia conforme a rubrica e gera boletim com nota, evidências e feedback.</li>
          </ol>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Modo ao vivo (sessão)</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1.</strong> Em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/osce</code>, abra a prova e clique em <strong className="text-white">"Aplicar ao vivo"</strong>. O sistema gera um <strong className="text-white">PIN de 6 dígitos</strong>.</li>
            <li><strong className="text-white/80">2.</strong> Alunos acessam <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/osce/entrar</code>, digitam o PIN e entram na sala — com conta ou como convidados (nome + e-mail).</li>
            <li><strong className="text-white/80">3.</strong> O professor vê os participantes em tempo real e clica <strong className="text-white">"Iniciar"</strong> — todos começam a primeira estação juntos.</li>
            <li><strong className="text-white/80">4.</strong> O painel mostra cronômetro, ranking parcial e status de cada aluno. Controles: <em>Próxima estação</em>, <em>Pausar</em>, <em>Encerrar</em>.</li>
            <li><strong className="text-white/80">5.</strong> Ao final, cada aluno recebe boletim consolidado e o professor visualiza notas e rubricas da turma.</li>
          </ol>
        </div>
        <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-4">
          <p className="text-sm text-[hsl(38,92%,50%)]">
            <strong>Créditos:</strong> 10 (fácil), 15 (média) ou 20 (difícil) por estação avaliada. Cada sessão ao vivo gera um PIN novo — depois de encerrada, gere uma nova aplicação para reutilizar a mesma prova.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "meetings",
    title: "Reuniões com IA (Atas)",
    icon: Video,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          Em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/reunioes</code>, conecte sua conta do <strong className="text-white">Google</strong> (com o Gemini ativado no Meet) e cole o link de uma reunião — o sistema busca automaticamente na sua Google Drive a ata/transcrição que o Gemini gera nativamente ao fim da chamada, e gera uma ata estruturada com IA a partir dela. Não depende mais de nenhum bot de terceiros entrando na reunião.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">O que você recebe</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Transcrição completa</strong> extraída do documento gerado pelo Gemini no Meet.</li>
            <li><strong className="text-white/80">Ata estruturada</strong> com tópicos discutidos, decisões e ações.</li>
            <li><strong className="text-white/80">Regenerar com prompt customizado</strong> para diferentes formatos (ata formal, resumo executivo, plano de aula).</li>
            <li><strong className="text-white/80">Status em tempo real</strong>: pending → matched → transcribing → summarizing → done.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "skills",
    title: "Skills Modulares",
    icon: Zap,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          <strong className="text-white">Skills</strong> são pacotes de instruções plugáveis que adicionam capacidades específicas a agentes personalizados — raciocínio clínico, citação ABNT, copywriting, uso de CID-10, etc.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como usar</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1.</strong> No editor do agente personalizado, abra a aba <em>Skills</em>.</li>
            <li><strong className="text-white/80">2.</strong> Ative as skills desejadas — globais (compartilhadas) ou criadas por você.</li>
            <li><strong className="text-white/80">3.</strong> O conteúdo da skill é injetado como bloco <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">&lt;SKILL&gt;</code> no prompt do agente em cada interação.</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "projects",
    title: "Projetos e Colaboração",
    icon: FolderKanban,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          Organize conversas, agentes e bases de conhecimento em <strong className="text-white">Projetos</strong>. Convide colaboradores para compartilhar acesso e manter o trabalho centralizado.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Recursos</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Itens no projeto</strong> — adicione conversas, agentes e bases via menu "Adicionar ao projeto".</li>
            <li><strong className="text-white/80">Colaboradores</strong> — convide por e-mail, com permissão de visualização ou edição.</li>
            <li><strong className="text-white/80">Exportação</strong> — gere relatório consolidado do projeto em PDF, com todos os itens e colaboradores.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "verify",
    title: "Certificado e Verificação de Conteúdo",
    icon: ShieldCheck,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          Toda resposta gerada pode receber um <strong className="text-white">certificado com hash SHA-256</strong>, garantindo a integridade do conteúdo. Qualquer pessoa pode verificar a autenticidade em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/verificar</code>.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como funciona</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1.</strong> Após uma resposta, clique em "Certificar" para gerar o código.</li>
            <li><strong className="text-white/80">2.</strong> Compartilhe o código ou o link com quem precisar validar o conteúdo.</li>
            <li><strong className="text-white/80">3.</strong> Em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/verificar</code>, cole o código ou o texto — o sistema confirma se bate com o original (hash idêntico).</li>
          </ol>
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
          A plataforma utiliza um sistema de créditos para controlar o uso dos agentes. Cada interação com um agente consome uma quantidade específica de créditos, debitada sempre no servidor (nunca no navegador).
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Como funcionam os créditos</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Agentes do sistema</strong> — Cada agente nativo tem um custo específico (1 a 3 créditos por interação, conforme a complexidade).</li>
            <li><strong className="text-white/80">Agentes personalizados</strong> — Custo fixo de 1 crédito por interação.</li>
            <li><strong className="text-white/80">Agente Orquestrador</strong> — Custo fixo de 12 créditos por execução.</li>
            <li><strong className="text-white/80">Bônus de boas-vindas</strong> — 15 créditos grátis ao criar a conta.</li>
            <li><strong className="text-white/80">Compra de créditos</strong> — Adquira pacotes de créditos via Stripe em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/creditos</code>.</li>
            <li><strong className="text-white/80">Assinaturas</strong> — Planos mensais com créditos recorrentes e benefícios extras.</li>
            <li><strong className="text-white/80">Acesso ilimitado</strong> — Administradores e contas convidadas com acesso ilimitado não consomem créditos.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Histórico</h4>
          <p className="text-sm text-white/60 leading-relaxed">
            Acompanhe seu saldo e histórico de transações em <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/conta</code>. O sistema registra cada débito e crédito com data, descrição e valor em um ledger append-only (nada é editado ou apagado).
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
  {
    id: "admin",
    title: "Painel Admin",
    icon: UserCog,
    adminOnly: true,
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          O <strong className="text-white">Painel Admin</strong> (<code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/admin</code>) é restrito a contas com a role <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">admin</code>. Usuários sem essa role são redirecionados automaticamente ao acessar a rota.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Abas do painel</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">Dashboard</strong> — Métricas gerais: usuários ativos, uso de créditos, agentes mais utilizados.</li>
            <li><strong className="text-white/80">Agentes</strong> — Gestão dos agentes nativos: criação, edição de prompt/modelo e custo em créditos.</li>
            <li><strong className="text-white/80">Usuários</strong> — Busca de usuários, saldo de créditos e gestão de roles.</li>
            <li><strong className="text-white/80">Salas</strong> — Visão de todas as salas virtuais ativas e expiradas.</li>
            <li><strong className="text-white/80">Convidados</strong> — Concessão de acesso ilimitado (sem consumo de créditos) a contas específicas.</li>
            <li><strong className="text-white/80">Pipeline</strong> — Roadmap público de atualizações da plataforma, exibido também no Briefing por Voz dos usuários.</li>
          </ul>
        </div>
      </div>
    ),
  },
];

/**
 * Internal architecture documentation — database schema, edge functions, secrets and
 * security patterns. Rendered only on the protected /documentacao page, and only for
 * admins: it maps the system's attack surface (table names, RLS patterns, secret names)
 * and has no reason to be visible to a regular authenticated user.
 */
export const technicalDocSections: DocSection[] = [
  {
    id: "tech-overview",
    title: "Visão Geral Técnica",
    icon: Server,
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(38,92%,50%)]/20 bg-[hsl(38,92%,50%)]/5 p-4 mb-4">
          <p className="text-sm text-[hsl(38,92%,50%)]">
            <strong>Seção Técnica (admin):</strong> As seções a seguir descrevem a arquitetura interna, banco de dados, APIs e tecnologias utilizadas na construção da plataforma.
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
            <div><strong className="text-white/80">Modelos de IA:</strong> OpenAI, Google Gemini, Anthropic Claude, Groq, NVIDIA, GitHub Models e OpenRouter — chamados diretamente pela Edge Function com a chave de API do usuário/agente, sem gateway intermediário</div>
            <div><strong className="text-white/80">Voz:</strong> ElevenLabs (texto-para-voz) + provedores de transcrição com fallback</div>
            <div><strong className="text-white/80">Reuniões:</strong> transcrição nativa do Google Meet (Gemini), lida via OAuth + Google Drive API</div>
            <div><strong className="text-white/80">Exportação:</strong> jsPDF + html2canvas</div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Fluxo de uma requisição típica</h4>
          <ol className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">1.</strong> Usuário envia mensagem no chat (React frontend)</li>
            <li><strong className="text-white/80">2.</strong> Frontend chama <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">supabase.functions.invoke("agent-chat")</code></li>
            <li><strong className="text-white/80">3.</strong> Edge Function valida JWT via <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">getClaims()</code>, verifica créditos e carrega contexto RAG</li>
            <li><strong className="text-white/80">4.</strong> Edge Function tenta os provedores de IA configurados em ordem de prioridade (chave própria do agente primeiro, depois demais chaves do usuário), com streaming SSE</li>
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
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flow_executions</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent_flow_node_results</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">flow_installs</code>
              <p className="text-white/50 text-xs mt-1">Execuções de fluxos (input/output de cada etapa, status e timestamps) e registro de instalações vindas do Marketplace de Fluxos.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">virtual_rooms</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">room_messages</code>
              <p className="text-white/50 text-xs mt-1">Salas virtuais com PIN de acesso. room_messages permite inserção sem autenticação (anon) para salas ativas.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">osce_stations</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">osce_exams</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">osce_attempts</code>
              <p className="text-white/50 text-xs mt-1">Módulo OSCE: estações clínicas, provas e tentativas de alunos (respostas, avaliação, nota e status da sessão ao vivo).</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meetings</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">google_connections</code>
              <p className="text-white/50 text-xs mt-1">Reuniões do Google Meet. `meetings` armazena meet_link, drive_file_id, transcript, summary e status (pending→matched→transcribing→summarizing→done); `google_connections` guarda o OAuth (tokens criptografados) de cada usuário conectado.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">projects</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">project_items</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">project_collaborators</code>
              <p className="text-white/50 text-xs mt-1">Projetos de colaboração: itens vinculados (conversas, agentes, bases) e colaboradores convidados por e-mail.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">content_certificates</code>
              <p className="text-white/50 text-xs mt-1">Certificados de integridade (hash SHA-256) emitidos para respostas de agentes, verificáveis publicamente em /verificar.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">user_memory_facts</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">user_profile_context</code>
              <p className="text-white/50 text-xs mt-1">Memória de longo prazo do usuário: fatos extraídos do perfil e das conversas, usados para personalizar respostas futuras.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">user_research_interests</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">briefing_settings</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">system_updates</code>
              <p className="text-white/50 text-xs mt-1">Base do Briefing por Voz e do roadmap público (aba "Pipeline" do Painel Admin).</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">profiles</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">user_roles</code> + <code className="text-[hsl(174,62%,47%)] font-mono text-xs">unlimited_users</code>
              <p className="text-white/50 text-xs mt-1">Perfis de usuário, roles (admin/user) em tabela separada com função security definer has_role() para evitar recursão de RLS, e contas com acesso ilimitado (sem débito de créditos).</p>
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
          Toda a lógica de backend roda em <strong className="text-white">Supabase Edge Functions</strong> — funções serverless escritas em TypeScript executadas no runtime Deno. Ao todo, o sistema tem 41 funções, organizadas por área abaixo.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Chat, agentes e qualidade</h4>
          <div className="space-y-3 text-sm">
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-chat</code>
              <p className="text-white/50 text-xs mt-1">Core do sistema. Recebe mensagem, valida auth, verifica créditos, carrega contexto RAG (knowledge bases), chama o provedor de IA com streaming SSE, debita créditos e salva mensagens. Suporta chamadas server-to-server (isServerCall) para fluxos automatizados.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-transform</code>
              <p className="text-white/50 text-xs mt-1">Reprocessa uma resposta já gerada (ex: mudar formato, resumir, expandir), checando créditos e permissões do usuário.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-prompt-optimizer</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-prompt-rollback</code>
              <p className="text-white/50 text-xs mt-1">Analisa o histórico de feedbacks (👍/👎) de um agente e sugere ajustes automáticos no system prompt; a segunda função aprova, rejeita ou reverte essas versões.</p>
            </div>
            <div>
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">clinical-validator</code>
              <p className="text-white/50 text-xs mt-1">Validação clínica de respostas geradas em contextos de saúde, checando consistência e segurança do conteúdo.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Rede de Agentes, Orquestrador e Vendas</h4>
          <div className="space-y-3 text-sm">
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-flow-execute</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-flow-plan</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-flow-plan-complex</code>
              <p className="text-white/50 text-xs mt-1">Executam uma etapa do pipeline (via agent-chat com SUPABASE_SERVICE_ROLE_KEY) e geram fluxos automaticamente via IA a partir de descrição em linguagem natural; a versão "complex" considera os agentes nativos e personalizados já existentes do usuário.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">install-flow</code>
              <p className="text-white/50 text-xs mt-1">Instala uma cópia de um fluxo publicado no Marketplace de Fluxos na conta do usuário, debitando os créditos correspondentes.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">agent-orchestrator</code>
              <p className="text-white/50 text-xs mt-1">Decompõe uma demanda complexa em sub-tarefas, aciona múltiplos agentes nativos automaticamente e consolida os resultados em um dossiê único. Custo fixo de 12 créditos.</p>
            </div>
            <div>
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">sales-agent</code>
              <p className="text-white/50 text-xs mt-1">Agente comercial que atende visitantes no site público, recomendando o plano de créditos mais adequado.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Voz, reuniões e OSCE</h4>
          <div className="space-y-3 text-sm">
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">tts-elevenlabs</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">voice-transcribe</code>
              <p className="text-white/50 text-xs mt-1">Converte texto em áudio narrado (ElevenLabs, voz pt-BR) e transcreve áudio do usuário em texto, com fallback entre provedores.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-register</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-google-oauth-start</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-google-oauth-callback</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-sync</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-sync-cron</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">meeting-summary</code>
              <p className="text-white/50 text-xs mt-1">Conecta a conta Google do usuário via OAuth, registra a reunião, casa o registro com o documento de anotações que o Gemini gera na Drive do organizador, extrai a transcrição, gera/regenera a ata com IA e sincroniza periodicamente (via polling e via cron) o status de reuniões em andamento.</p>
            </div>
            <div>
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">osce-patient</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">osce-evaluate</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">osce-session-control</code>
              <p className="text-white/50 text-xs mt-1">Simula o paciente virtual da estação, avalia a tentativa conforme a rubrica e controla a sessão ao vivo (iniciar, avançar etapa, pausar, encerrar).</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Conhecimento, pesquisa e conteúdo institucional</h4>
          <div className="space-y-3 text-sm">
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">youtube-transcript</code>
              <p className="text-white/50 text-xs mt-1">Extrai transcrição automática de vídeos do YouTube para uso como fonte de conhecimento RAG.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">pubmed-monitor</code>
              <p className="text-white/50 text-xs mt-1">Busca artigos recentes no PubMed baseado nos interesses de pesquisa do usuário. Executado semanalmente via cron.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">generate-briefing</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">generate-roadmap</code>
              <p className="text-white/50 text-xs mt-1">Geram o Briefing por Voz (interesses de pesquisa + novidades da plataforma) e o roadmap público exibido no Painel Admin.</p>
            </div>
            <div>
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">aggregate-questions</code>
              <p className="text-white/50 text-xs mt-1">Agrupa por tema as dúvidas anônimas enviadas por alunos durante uma aula ao vivo em Sala Virtual, gerando um resumo para o professor.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Pagamentos, certificação e projetos</h4>
          <div className="space-y-3 text-sm">
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">create-checkout</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">stripe-webhook</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">customer-portal</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">check-subscription</code>
              <p className="text-white/50 text-xs mt-1">Integração Stripe. Cria sessões de checkout, processa webhooks (pagamento confirmado → credita créditos), gerencia portal do cliente e verifica status de assinatura.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">purchase-agent</code>
              <p className="text-white/50 text-xs mt-1">Processa compra de agentes no Marketplace: debita 5 créditos do comprador e credita 3 ao criador.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">content-certificate</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">export-project</code>
              <p className="text-white/50 text-xs mt-1">Gera e verifica certificados de integridade (hash SHA-256) e exporta os dados consolidados de um projeto (itens, colaboradores).</p>
            </div>
            <div>
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">extract-user-facts</code>
              <p className="text-white/50 text-xs mt-1">Extrai fatos relevantes do perfil e das conversas do usuário para personalizar respostas futuras (memória de longo prazo).</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Comunicação, administração e manutenção</h4>
          <div className="space-y-3 text-sm">
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">whatsapp-webhook</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">contact-form</code>
              <p className="text-white/50 text-xs mt-1">Recebe mensagens do WhatsApp (Evolution API) e responde automaticamente pelo agente vinculado; envia e-mails do formulário de contato (Resend).</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">manage-api-keys</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">test-api-key</code>
              <p className="text-white/50 text-xs mt-1">CRUD de chaves de API dos provedores (criptografia via pgcrypto) e teste de validade antes de salvar.</p>
            </div>
            <div className="border-b border-white/5 pb-2">
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">admin-analytics</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">hub-metrics</code> / <code className="text-[hsl(174,62%,47%)] font-mono text-xs">invite-user</code>
              <p className="text-white/50 text-xs mt-1">Agregam dados para o Painel Admin, expõem métricas para monitoramento externo e convidam usuários com acesso ilimitado (restrito a admins).</p>
            </div>
            <div>
              <code className="text-[hsl(174,62%,47%)] font-mono text-xs">expire-rooms</code>
              <p className="text-white/50 text-xs mt-1">Expira salas virtuais com prazo vencido.</p>
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
                <div className="h-2 w-2 rounded-full bg-[hsl(199,89%,48%)]" />
                <strong className="text-white">Provedores de IA (via chave do usuário/agente)</strong>
              </div>
              <p className="text-white/50 text-xs ml-4">OpenAI, Google AI, Anthropic, Groq, NVIDIA, GitHub Models e OpenRouter. Chaves armazenadas criptografadas no banco. O agent-chat tenta os provedores em ordem de prioridade (chave configurada no agente primeiro, depois demais chaves do usuário) — não há gateway central de IA compartilhado.</p>
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
                <div className="h-2 w-2 rounded-full bg-pink-400" />
                <strong className="text-white">ElevenLabs</strong>
              </div>
              <p className="text-white/50 text-xs ml-4">Texto-para-voz (TTS) usado nas respostas do chat e no Briefing por Voz. Voz padrão multilíngue com sotaque natural em pt-BR. Chave: ELEVENLABS_API_KEY.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <strong className="text-white">Google Drive API (OAuth por usuário)</strong>
              </div>
              <p className="text-white/50 text-xs ml-4">API: <code className="bg-white/10 px-1 py-0.5 rounded">https://www.googleapis.com/drive/v3</code><br/>Cada usuário conecta sua própria conta Google; o sistema lê a pasta "Meet Recordings" da Drive dele para localizar e exportar o documento de anotações/transcrição que o Gemini gera nativamente no Meet. Autenticação: OAuth 2.0 (access/refresh token criptografados por usuário).</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <strong className="text-white">PubMed (NCBI E-utilities)</strong>
              </div>
              <p className="text-white/50 text-xs ml-4">API pública do NCBI para busca de artigos científicos. Endpoints esearch e efetch. Usado pelo agente PubMed, pelo monitor semanal e pelo Briefing por Voz.</p>
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
              <p className="text-white/50 text-xs ml-4">Integração opcional para conectar agentes ao WhatsApp, nos dois sentidos: configuração por agente (webhook URL, token, phone number ID) para enviar respostas, e whatsapp-webhook para receber mensagens, validado por EVOLUTION_WEBHOOK_SECRET.</p>
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
            <li><strong className="text-white/80">Webhooks assinados</strong> — Webhooks externos (WhatsApp/Evolution API) validam um segredo compartilhado (EVOLUTION_WEBHOOK_SECRET) antes de processar o evento.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Secrets configurados</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-white/50 font-mono">
            <span>SUPABASE_SERVICE_ROLE_KEY</span>
            <span>SUPABASE_ANON_KEY</span>
            <span>STRIPE_SECRET_KEY</span>
            <span>STRIPE_WEBHOOK_SECRET</span>
            <span>API_ENCRYPTION_KEY</span>
            <span>GOOGLE_CLIENT_ID</span>
            <span>GOOGLE_CLIENT_SECRET</span>
            <span>GOOGLE_OAUTH_REDIRECT_URI</span>
            <span>GOOGLE_OAUTH_STATE_SECRET</span>
            <span>CRON_SECRET</span>
            <span>ELEVENLABS_API_KEY</span>
            <span>RESEND_API_KEY</span>
            <span>EVOLUTION_WEBHOOK_SECRET</span>
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
            <li><strong className="text-white/80">Hooks personalizados</strong> — useCredits, useAgents, useCustomAgents, useSubscription, useIsAdmin, useUnlimitedAccess, etc. Encapsulam lógica de dados.</li>
            <li><strong className="text-white/80">Streaming SSE</strong> — Parsing line-by-line de Server-Sent Events para renderização token-por-token das respostas de IA.</li>
            <li><strong className="text-white/80">Exportação PDF</strong> — Motor dedicado via jsPDF com branding "Agentes Posológicos" (cabeçalhos Slate-900, acentos Teal-500).</li>
            <li><strong className="text-white/80">Conteúdo de documentação compartilhado</strong> — As páginas <code className="bg-white/10 px-1 py-0.5 rounded text-xs">/docs</code> e <code className="bg-white/10 px-1 py-0.5 rounded text-xs">/documentacao</code> consomem o mesmo array de seções (<code className="bg-white/10 px-1 py-0.5 rounded text-xs">src/data/docSections.tsx</code>) para evitar divergência de conteúdo entre as duas.</li>
            <li><strong className="text-white/80">i18n</strong> — Sistema de traduções com LanguageContext suportando PT-BR e EN.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Padrões do Backend</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li><strong className="text-white/80">CORS headers padrão</strong> — Todas as Edge Functions incluem headers CORS para compatibilidade com web apps.</li>
            <li><strong className="text-white/80">verify_jwt = false</strong> — JWT validado em código (não no gateway) usando getClaims() para compatibilidade com signing-keys.</li>
            <li><strong className="text-white/80">Graceful error handling</strong> — Retorna status 200 com dados padrão em vez de 500 para manter estabilidade do frontend.</li>
            <li><strong className="text-white/80">Service role para webhooks</strong> — Webhooks externos (Stripe, Google OAuth callback, WhatsApp) usam SUPABASE_SERVICE_ROLE_KEY para acessar dados sem JWT de usuário.</li>
            <li><strong className="text-white/80">Append-only ledger</strong> — Credits nunca são editados/deletados — apenas novas entradas são inseridas.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="text-sm font-semibold text-white mb-3">Estrutura de diretórios</h4>
          <pre className="text-xs text-white/50 font-mono leading-relaxed overflow-x-auto">{`src/
├── components/     # Componentes React (ui/, layout/, chat/, agents/, etc.)
├── contexts/       # AuthContext, LanguageContext
├── data/           # Conteúdo de documentação compartilhado (docSections.tsx)
├── hooks/          # Custom hooks (useCredits, useAgents, etc.)
├── integrations/   # Cliente Supabase + tipos auto-gerados
├── lib/            # Utilitários (exportPdf, icons, utils)
├── pages/          # Páginas/rotas da aplicação
└── i18n/           # Traduções PT-BR / EN

supabase/
└── functions/      # Edge Functions (Deno runtime)
    ├── agent-chat/
    ├── meeting-register/
    ├── meeting-google-oauth-start/
    ├── meeting-google-oauth-callback/
    └── ...45 funções ao total`}</pre>
        </div>
      </div>
    ),
  },
];
