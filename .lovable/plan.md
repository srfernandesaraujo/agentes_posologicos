

# Agente Especialista PubMed — Análise de Viabilidade e Plano

## Resposta curta: Sim, é totalmente possível

A PubMed oferece APIs públicas e gratuitas (sem necessidade de chave de API) que permitem buscar, consultar e recuperar artigos científicos em tempo real. Combinado com a infraestrutura atual do projeto, é viável criar um agente completo com busca interativa e notificações proativas semanais.

---

## Como funcionaria

### Modo 1: Chat interativo com PubMed
O usuário faz perguntas como *"Quais os últimos estudos sobre metformina e longevidade?"* e o agente:
1. Converte a pergunta em termos de busca otimizados para PubMed
2. Consulta a API E-utilities (ESearch + EFetch) em tempo real
3. Recupera títulos, abstracts, autores, DOI e datas
4. Sintetiza uma resposta em linguagem acessível citando os artigos encontrados

### Modo 2: Monitor proativo semanal
O usuário cadastra seus interesses (ex: *"farmacogenômica", "resistência antimicrobiana"*). Semanalmente:
1. Um cron job dispara a Edge Function
2. A função busca artigos publicados nos últimos 7 dias para cada interesse
3. Compara com artigos já notificados (evita duplicatas)
4. Envia notificações na plataforma com resumo dos novos achados

---

## Arquitetura técnica

### APIs da PubMed (gratuitas, sem chave)

- **ESearch**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=QUERY&retmode=json&retmax=10&sort=relevance`
- **EFetch**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=PMID1,PMID2&rettype=abstract&retmode=xml`
- **ESummary**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=PMID1,PMID2&retmode=json`

Recomendação do NCBI: registrar um `api_key` gratuito para aumentar o rate limit de 3 para 10 requisições/segundo.

### Componentes a criar

| Componente | Descrição |
|---|---|
| **Agente na tabela `agents`** | Novo registro com slug `especialista-pubmed` |
| **Prompt no `agent-chat`** | Prompt especializado que instrui o LLM a formular queries PubMed, chamar a API via fetch dentro da Edge Function, e sintetizar resultados |
| **Tabela `user_research_interests`** | Armazena interesses do usuário (user_id, terms, created_at) |
| **Tabela `pubmed_notifications_log`** | Registra PMIDs já notificados para evitar duplicatas |
| **Edge Function `pubmed-monitor`** | Cron job semanal que busca novos artigos e cria notificações |
| **UI de interesses** | Seção na página do agente ou em /conta para gerenciar interesses |

### Fluxo no `agent-chat` (busca em tempo real)

```text
Usuário envia pergunta
       ↓
agent-chat recebe { agentId: "especialista-pubmed", input }
       ↓
Edge Function faz fetch para ESearch API com query extraída
       ↓
Recebe PMIDs → faz fetch para ESummary/EFetch
       ↓
Monta contexto com títulos + abstracts
       ↓
Envia para LLM: system_prompt + contexto PubMed + pergunta do usuário
       ↓
LLM sintetiza resposta citando artigos com links
       ↓
Retorna ao frontend
```

### Fluxo do monitor semanal

```text
Cron (pg_cron) → POST para pubmed-monitor Edge Function
       ↓
Busca todos os interesses ativos em user_research_interests
       ↓
Para cada interesse: ESearch com filtro datetype=pdat&mindate=7_dias_atrás
       ↓
Filtra PMIDs já notificados via pubmed_notifications_log
       ↓
Para novos artigos: ESummary para pegar título/autores
       ↓
Insere notificação na tabela notifications (já existente)
       ↓
Registra PMIDs em pubmed_notifications_log
```

### Banco de dados (novas tabelas)

```sql
-- Interesses de pesquisa do usuário
CREATE TABLE user_research_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  terms text NOT NULL,          -- ex: "metformina longevidade"
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Log de PMIDs já notificados
CREATE TABLE pubmed_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pmid text NOT NULL,
  interest_id uuid REFERENCES user_research_interests(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pmid)
);
```

### Diferencial competitivo

- Nenhuma plataforma de agentes de IA em português oferece busca em tempo real no PubMed integrada a chat com IA
- O monitor proativo transforma o agente de reativo em **assistente de pesquisa contínuo**
- Potencial de upsell: cobrar mais créditos pelo monitoramento semanal como feature premium

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | CREATE 2 tabelas + INSERT agente + RLS policies |
| `supabase/functions/agent-chat/index.ts` | Novo prompt + lógica de fetch PubMed em tempo real |
| `supabase/functions/pubmed-monitor/index.ts` | Nova Edge Function para cron semanal |
| `supabase/config.toml` | Registrar `pubmed-monitor` |
| `src/lib/icons.ts` | Adicionar ícone (ex: `BookOpen`) |
| UI de interesses | Componente para gerenciar termos de pesquisa |

