

## Extrair Transcrição Automática do YouTube para Fontes de Conhecimento

### Problema
Quando o usuario adiciona uma URL do YouTube como fonte de conhecimento, o sistema salva apenas a URL sem extrair o conteudo textual. O agente nao consegue usar essa fonte porque o campo `content` fica vazio.

### Solucao
Criar uma Edge Function `youtube-transcript` que extrai a transcrição automática (legendas) do YouTube e salva como conteudo textual da fonte. Apos a criacao da fonte, o frontend chama automaticamente essa funcao para processar o video.

### Como vai funcionar (fluxo do usuario)

1. Usuario adiciona uma URL do YouTube como fonte de conhecimento
2. A fonte e criada com status "pending"
3. O sistema chama automaticamente a Edge Function para extrair a transcricao
4. A transcricao e salva no campo `content` e o status muda para "ready"
5. O agente passa a usar o texto transcrito como contexto

### Etapas de implementacao

**1. Criar Edge Function `youtube-transcript`**

Arquivo: `supabase/functions/youtube-transcript/index.ts`

- Recebe `source_id` e `url` do YouTube
- Extrai o `video_id` da URL (suporta formatos youtube.com/watch?v=, youtu.be/, etc.)
- Busca a pagina do video para encontrar os dados de legendas disponíveis (captions/timedtext)
- Extrai a transcrição em português (pt) ou inglês (en) como fallback
- Limpa tags XML das legendas e formata como texto puro
- Atualiza o `content` e `status` da fonte no banco usando service role
- Trunca a 50.000 caracteres se necessário
- Se nao houver legendas, salva mensagem informativa e marca status como "error"

**2. Registrar funcao no `supabase/config.toml`**

Adicionar:
```text
[functions.youtube-transcript]
verify_jwt = false
```

**3. Atualizar `KnowledgeDetail.tsx`**

Apos criar uma fonte do tipo "youtube", chamar automaticamente a Edge Function:
```text
await supabase.functions.invoke("youtube-transcript", {
  body: { source_id: newSource.id, url: sourceUrl }
});
```

Mostrar toast informando que a transcrição esta sendo extraída.

**4. Atualizar `DocumentManager.tsx`**

Aplicar a mesma logica quando uma fonte YouTube e adicionada via gerenciador de documentos do agente, chamando a Edge Function apos a criacao.

### Detalhes tecnicos da extracao

A Edge Function vai:
1. Fazer fetch da pagina do video YouTube
2. Extrair o JSON `ytInitialPlayerResponse` que contem os dados de captions
3. Buscar a URL da track de legendas automaticas (ASR) ou manuais
4. Fazer fetch do XML de legendas
5. Parsear as tags `<text>` removendo timestamps e tags HTML
6. Concatenar todo o texto como conteudo limpo

Fallback: se a API interna do YouTube nao retornar legendas, a funcao marca a fonte com status "error" e conteudo explicativo.

