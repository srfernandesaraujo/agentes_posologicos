
# Corrigir Tabelas no Chat - Formatacao Profissional

## Problema Identificado

O agente esta retornando dados tabulares como texto corrido com pipes (`|`) em uma unica linha, em vez de usar a sintaxe correta de tabelas Markdown (uma linha por registro, com separador `|---|---|`). O ReactMarkdown nao consegue interpretar esse formato como tabela HTML, exibindo tudo como paragrafo de texto ilegivel.

## Solucao em 2 Frentes

### Frente 1: Corrigir o prompt do agente (edge function)

Adicionar instrucao explicita em TODOS os prompts dos agentes para que SEMPRE formatem tabelas com:
- Uma linha por registro
- Linha separadora apos o cabecalho (`|---|---|---| `)
- Nunca colocar multiplas linhas de dados na mesma linha de texto

Exemplo do formato correto que sera instruido:

```text
| Medicamento | n | % |
|---|---|---|
| Metformina | 14 | 11.67 |
| Levotiroxina | 13 | 10.83 |
```

### Frente 2: Pre-processamento no frontend (Chat.tsx)

Adicionar uma funcao de sanitizacao que detecta tabelas malformadas (multiplos `|...|` na mesma linha) e as reformata em markdown valido antes de passar para o ReactMarkdown. Isso garante compatibilidade mesmo que o modelo ocasionalmente retorne o formato antigo.

### Frente 3: Melhorar o estilo visual das tabelas no chat

Atualizar o `markdownComponents` para um visual mais profissional:
- Cabecalho com fundo de destaque solido (ex: `bg-[hsl(199,89%,48%)]/20`)
- Bordas mais visiveis e consistentes
- Zebra-striping (linhas alternadas com fundo ligeiramente diferente)
- Padding mais generoso
- Fonte monospacada para numeros/dados
- Borda arredondada no container da tabela

## Detalhes Tecnicos

### Arquivos modificados

1. **`supabase/functions/agent-chat/index.ts`**
   - Adicionar bloco de instrucao global sobre formatacao de tabelas (aplicado a todos os agentes)
   - Instrucao: "Sempre use tabelas Markdown com uma linha por registro e separador de cabecalho"

2. **`src/pages/Chat.tsx`**
   - Criar funcao `sanitizeMarkdownTables(content: string)` que:
     - Detecta linhas com multiplos blocos `| valor |` concatenados
     - Separa em linhas individuais
     - Insere separador de cabecalho quando ausente
   - Atualizar `markdownComponents` com estilos visuais melhorados para tabelas
   - Aplicar `sanitizeMarkdownTables` no conteudo antes de passar ao ReactMarkdown

### Estilo visual das tabelas

- Container com `rounded-lg overflow-hidden border border-white/15`
- Cabecalho: `bg-primary/15 text-white font-semibold`
- Linhas alternadas: `even:bg-white/[0.03]`
- Hover: `hover:bg-white/[0.06]`
- Celulas com padding `px-4 py-2.5` e alinhamento consistente
