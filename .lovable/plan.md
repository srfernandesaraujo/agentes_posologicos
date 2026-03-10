

## Plano: Agente "Consultor de Farmacovigilância Global" (VigiAccess)

### Contexto

O VigiAccess (vigiaccess.org) é mantido pela OMS/UMC e expõe endpoints públicos em `api.who-umc.org` que o próprio site usa via XHR. Esses endpoints permitem buscar medicamentos por nome e obter dados agregados de reações adversas (ADRs), distribuição demográfica, geográfica e temporal — sem necessidade de API key paga.

### Arquitetura

O agente seguirá o mesmo padrão dos agentes nativos existentes (PubMed, TMDB/Cinema):

1. **Prompt hardcoded** em `AGENT_PROMPTS` no `agent-chat/index.ts`
2. **Integração em tempo real** com a API pública do VigiAccess, injetando dados no contexto do LLM via tag `<VIGIACCESS_CONTEXT>`
3. **Registro no banco** via migration SQL

### Detalhes técnicos

**Slug:** `consultor-vigiaccess`
**Categoria:** `Prática Clínica e Farmácia`
**Ícone:** `ShieldAlert` (já disponível em `icons.ts`)
**Custo:** 1 crédito

#### 1. System Prompt (`AGENT_PROMPTS["consultor-vigiaccess"]`)

Prompt estruturado com as seções padrão `<OBJETIVO>`, `<LIMITACOES>`, `<ESTILO>`, `<INSTRUCOES>` cobrindo:

- **Tradução PT→EN** de nomes comerciais brasileiros para princípios ativos (INN) e termos MedDRA
- **Resumo estruturado** dos efeitos colaterais mais reportados por SOC (System Organ Class)
- **Análise demográfica** (faixa etária, gênero, continente, ano)
- **Comparativo entre medicamentos** em formato tabular
- **Aviso ético obrigatório** em toda resposta: dados são relatos de suspeita, não prova de causalidade; nunca interromper tratamento sem consultar médico
- **Mapeamento de nomes comerciais** brasileiros para INN (ex: Tylenol → Paracetamol/Acetaminophen)
- **Regra de continuidade** com opções de follow-up

#### 2. Integração com API VigiAccess (no bloco `if (builtInAgent.slug === "consultor-vigiaccess")`)

Fluxo de enriquecimento de contexto:

```text
Input do usuário
    ↓
Extrair nome(s) de medicamento(s) do texto
    ↓
Para cada medicamento:
  1. GET api.who-umc.org/.../dimensions/drug?tradename=X
     → Obtém substanceId e nome INN
  2. GET api.who-umc.org/.../result?substanceId=Y
     → Obtém total de relatos, ADRs por SOC, dados demográficos
    ↓
Montar <VIGIACCESS_CONTEXT> com dados estruturados
    ↓
Injetar no systemPrompt antes de chamar o LLM
```

Os endpoints do VigiAccess usam autenticação Basic com credenciais públicas que o próprio site vigiaccess.org envia (visíveis no tráfego de rede do site). O agente incluirá esse header.

**Dados extraídos e injetados:**
- Total de relatos (ICSRs)
- Top ADRs por SOC com contagens
- Distribuição por continente
- Distribuição por faixa etária
- Distribuição por sexo
- Distribuição temporal (por ano)

Para comparativos, o agente buscará ambos os medicamentos e injetará os dados lado a lado.

#### 3. Migration SQL

```sql
INSERT INTO public.agents (slug, name, description, category, icon, credit_cost, active)
VALUES (
  'consultor-vigiaccess',
  'Consultor de Farmacovigilância Global',
  'Consulte dados reais da OMS sobre reações adversas a medicamentos...',
  'Prática Clínica e Farmácia',
  'ShieldAlert',
  1,
  true
);
```

#### 4. Arquivo `icons.ts`

`ShieldAlert` já está importado e mapeado — nenhuma alteração necessária.

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/agent-chat/index.ts` | Adicionar prompt em `AGENT_PROMPTS` + bloco de integração VigiAccess |
| `supabase/migrations/XXXX.sql` | INSERT do agente na tabela `agents` |

### Limitações conhecidas

- A API pública do VigiAccess não é oficialmente documentada para uso externo; se a UMC mudar os endpoints, o agente falhará graciosamente (usando conhecimento do LLM como fallback)
- Monitoramento periódico/alertas (item 5 da descrição) exigiria um cron job separado — pode ser implementado como fase 2

