

# Plano: Suporte a Novos Formatos de Arquivo + Leitura Real de Conteúdo

## Problema Atual

1. **Formatos limitados**: Faltam RTF, XML, DOCX (leitura real), imagens para OCR
2. **Arquivos não são lidos**: PDFs, Word e imagens são enviados apenas como label `[Arquivo anexado: nome.pdf]` — o agente nunca vê o conteúdo
3. **Agentes específicos** (Narrativa Lattes, Revisor de Artigo, Auditor de Prescrição) não conseguem executar suas funções a partir de uploads

## Solução

### 1. Frontend — Aceitar novos formatos (`Chat.tsx`)

- Adicionar ao `accept`: `.rtf, .xml`
- Adicionar ao array `allowed`: `application/rtf`, `text/rtf`, `text/xml`, `application/xml`
- Já aceita `.doc`, `.docx`, `.png`, `.jpg` — esses estão OK

### 2. Frontend — Enviar arquivos como base64 para a Edge Function (`Chat.tsx`)

Atualmente o `sendMutation` envia apenas texto. Alterar para:
- Converter **todos** os arquivos anexados para base64 usando `fileToBase64()` (já existe)
- Enviar um array `files` no body da Edge Function: `{ name, type, base64 }`
- Limitar a 10MB por arquivo e 3 arquivos por mensagem

### 3. Edge Function — Processar arquivos reais (`agent-chat/index.ts`)

Receber o array `files` e extrair conteúdo conforme o tipo:

- **Texto puro** (`.txt`, `.csv`, `.xml`, `.rtf`): decodificar base64 → texto direto
- **PDF**: Usar a API do Google Gemini que aceita inline base64 PDFs nativamente (o modelo `gemini-2.5-flash` suporta multimodal com PDFs e imagens)
- **Word (.docx)**: Extrair texto via parsing simples do XML interno (docx é um ZIP com XML) usando JSZip no Deno
- **Imagens (.png, .jpg)**: Enviar como content part `image_url` com base64 data URI — o Gemini faz OCR nativo

**Estrategia multimodal**: Em vez de tentar parsear PDFs/imagens server-side, enviar diretamente como partes multimodais na request ao modelo. O Gemini 2.5 Flash aceita nativamente:
- Imagens inline (base64)
- PDFs inline (base64)

Para isso, o array `messages` passará a usar o formato multipart:
```text
{ role: "user", content: [
  { type: "text", text: "..." },
  { type: "image_url", url: "data:image/png;base64,..." },
  { type: "file", data: "base64...", mime_type: "application/pdf" }
]}
```

### 4. Tratamento por tipo de arquivo na Edge Function

| Formato | Estratégia |
|---|---|
| TXT, CSV, XML, RTF | Decodificar base64 → texto → injetar como contexto textual |
| PDF | Enviar como parte multimodal ao Gemini (suporte nativo) |
| DOCX | Parsear XML interno (simples) → extrair texto → contexto textual |
| PNG, JPG | Enviar como `image_url` base64 ao modelo (visão/OCR nativo) |

### 5. Atualizar prompts dos agentes específicos

- **`auditor-prescricao`**: Adicionar instrução para analisar imagens de prescrições quando recebidas
- **`narrativa-lattes`**: Adicionar instrução para processar dados de arquivo RTF/XML do Lattes
- **`revisor-artigo`**: Adicionar instrução para revisar artigos a partir de PDF/Word anexado

### Etapas de implementação

1. Atualizar `Chat.tsx` — aceitar RTF/XML + enviar arquivos como base64 no body
2. Atualizar `agent-chat/index.ts` — receber e processar array `files`, montar mensagens multimodais
3. Atualizar prompts dos 3 agentes mencionados
4. Deploy da Edge Function

### Limitações

- Fallback para provedores que não suportam multimodal (OpenAI, Anthropic): extrair texto quando possível, ignorar binários com mensagem informativa
- RTF complexo (tabelas, formatação rica) pode perder formatação — mas o texto bruto será extraído
- Limite de tamanho: truncar conteúdo a 50.000 caracteres por arquivo

