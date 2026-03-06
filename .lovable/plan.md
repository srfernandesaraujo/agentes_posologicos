

# Plano: Corrigir renderização de tabelas Markdown no chat

## Problema
O `react-markdown` está instalado, mas **sem o plugin `remark-gfm`**. Sem ele, a sintaxe de tabelas GFM (pipes `|`) não é reconhecida e é exibida como texto cru. A função `sanitizeMarkdownTables` tenta reformatar tabelas malformadas, mas o parser subjacente simplesmente não suporta tabelas sem o plugin.

## Solução

### 1. Instalar `remark-gfm`
Adicionar a dependência `remark-gfm` ao projeto.

### 2. Atualizar `Chat.tsx`
- Importar `remarkGfm` de `remark-gfm`
- Passar `remarkPlugins={[remarkGfm]}` no componente `<ReactMarkdown>` dentro de `ChatMessageContent`

### 3. Melhorar o `sanitizeMarkdownTables`
A função atual falha em muitos cenários comuns (como a imagem mostra — linhas com múltiplos `|` em sequência sem quebras). Reescrever para:
- Detectar padrões de tabela em texto corrido (pipes sem newlines entre linhas)
- Garantir que cada row fique em sua própria linha
- Inserir separador `|---|---|` entre header e body quando ausente

### 4. Aplicar nas outras páginas que usam ReactMarkdown
- `VirtualRoomChat.tsx`
- `AgentEditor.tsx`
- `RoomConversations.tsx`

Todas usam `ReactMarkdown` sem `remarkGfm` — adicionar o plugin nelas também.

### 5. Estilização das tabelas (já existente)
Os `markdownComponents` já definem estilos para `table`, `thead`, `tr`, `th`, `td` com bordas, zebra-striping e hover. Uma vez que o parser reconheça tabelas, esses estilos serão aplicados automaticamente.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `package.json` | Adicionar `remark-gfm` |
| `src/pages/Chat.tsx` | Import + usar `remarkPlugins={[remarkGfm]}`, melhorar sanitize |
| `src/pages/VirtualRoomChat.tsx` | Adicionar `remarkGfm` |
| `src/pages/AgentEditor.tsx` | Adicionar `remarkGfm` |
| `src/components/rooms/RoomConversations.tsx` | Adicionar `remarkGfm` |

