

# Plano: Criador de Agentes Premium

## Problema

O `PROMPT_GENERATOR_PROMPT` atual é genérico e rígido — força uma estrutura XML (`<OBJETIVO>`, `<LIMITACOES>`, etc.) para todos os tipos de agentes. Isso gera prompts com "ruído" visível (ex: "Resposta do Paciente:", "Percepção Atual:", "Próxima Interação Desejada:") porque o gerador não entende que certos agentes precisam de **naturalidade humana** e não de estrutura técnica.

Além disso:
- O nome do agente é truncado do input (`aiPrompt.slice(0, 60)`) em vez de ser gerado pela IA
- Usa modelo `gemini-2.5-flash` (rápido mas superficial) em vez de um modelo mais poderoso
- Não usa tool calling para extrair nome + descrição + prompt de forma estruturada

## Solução

### 1. Reescrever o `PROMPT_GENERATOR_PROMPT` (agent-chat)

Substituir o prompt atual por um "Meta-Prompt Engineer" que:

- **Detecta automaticamente o tipo de agente** (roleplay/personagem, assistente técnico, tutor, analista, etc.)
- **Para agentes de roleplay/personagem**: gera prompts que produzem comportamento humano natural, SEM rótulos meta (nunca "Resposta do Paciente:", "Percepção Atual:"), com personalidade, vícios de linguagem, emoções implícitas
- **Para agentes técnicos**: mantém a estrutura organizada mas com profundidade premium
- **Injeta regras anti-ruído**: "NUNCA exiba rótulos internos como 'Resposta:', 'Percepção:', 'Próxima Ação:'. Responda SEMPRE em primeira pessoa, como se fosse a pessoa real"
- **Gera prompts longos e detalhados** (1000-2000 palavras) com psicologia do personagem, gatilhos emocionais, padrões de fala, limites de comportamento

### 2. Usar Tool Calling para saída estruturada

Em vez de pedir texto livre, usar tool calling com uma function `create_agent` que retorna:
```json
{
  "name": "Lucas Almeida - Paciente Virtual",
  "description": "Paciente de 33 anos, analista de sistemas, que pesquisa sintomas na internet...",
  "system_prompt": "<prompt completo e detalhado>"
}
```

Isso elimina o `aiPrompt.slice(0, 60)` e garante nome e descrição de qualidade.

### 3. Usar modelo mais poderoso

Trocar `gemini-2.5-flash` por `google/gemini-2.5-pro` no fallback do Lovable Gateway para geração de prompts premium.

### 4. Atualizar `MyAgents.tsx`

Usar o JSON estruturado retornado (name, description, system_prompt) para criar o agente com dados gerados pela IA em vez de usar o input bruto do usuário como nome/descrição.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-chat/index.ts` | Novo `PROMPT_GENERATOR_PROMPT` premium com detecção de tipo + tool calling + modelo superior |
| `src/pages/MyAgents.tsx` | Usar name/description/system_prompt do JSON retornado pela IA |

