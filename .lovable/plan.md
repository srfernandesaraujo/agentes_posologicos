

## Plano: Simulador Interativo de Validação de Prescrição

### Visão Geral

Transformar o módulo de Validação de Prescrição de um simples card de leitura (PrescriptionAuditCard) em um **simulador interativo completo** inspirado no software de farmácia mostrado nas imagens. O aluno interage ativamente com prescrições e etiquetas, identifica erros, e recebe feedback ao finalizar.

### Fluxo do Simulador

```text
┌─────────────────────────────────────────────────────┐
│  TELA 1: BANCADA DA FARMÁCIA                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│  │ 📦1│ │ 📦2│ │ 📦3│ │ 📦4│  ← cestinhas clicáveis│
│  │    │ │    │ │    │ │    │     com status visual  │
│  └────┘ └────┘ └────┘ └────┘     (pendente/feita)   │
│  Imagem de fundo: bancada de farmácia               │
└─────────────────────────────────────────────────────┘
          │ clica numa cestinha
          ▼
┌─────────────────────────────────────────────────────┐
│  TELA 2: ITENS PARA REVISAR                         │
│  ◄ Voltar                              [Finalizar]  │
│  ┌──────────────────┐ ┌──────────────────┐          │
│  │ 📋 Prescrição    │ │ 🏷️ Etiqueta 1    │          │
│  │ imagem simulada  │ │ campos clicáveis │          │
│  │ [✏️ Revisar]     │ │ [✏️ Revisar]     │          │
│  └──────────────────┘ └──────────────────┘          │
└─────────────────────────────────────────────────────┘
          │ clica "Revisar"
          ▼
┌─────────────────────────────────────────────────────┐
│  TELA 3: REVISÃO DA PRESCRIÇÃO/ETIQUETA             │
│  ◄ Voltar                                           │
│  ┌─────────────────────────┐ ┌────────────────────┐ │
│  │  Prescrição/Etiqueta    │ │ Instruções:        │ │
│  │  com campos clicáveis:  │ │ "Clique nos campos │ │
│  │  ┌──────────────────┐   │ │ que achar incorreto│ │
│  │  │ Nome do med      │←──│─│ e siga os passos"  │ │
│  │  │ Dose       Qty   │   │ │                    │ │
│  │  │ Posologia        │   │ │ Falhas encontradas:│ │
│  │  │ Prescritor  Data │   │ │ × Nome incompleto  │ │
│  │  │ Farmácia         │   │ │ × Dose incorreta   │ │
│  │  └──────────────────┘   │ │                    │ │
│  └─────────────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │ clica num campo (ex: "Prescritor")
          ▼
┌─────────────────────────────────────────────────────┐
│  DROPDOWN DE FALHAS (sobre o campo clicado)         │
│  ┌─────────────────────────────┐                    │
│  │ Prescritor                  │                    │
│  │ ─────────────────────────── │                    │
│  │ Nome do prescritor ausente  │  ← opções de falha│
│  │ Nome incompleto         [+] │                    │
│  │ Prescritor incorreto    [+] │                    │
│  └─────────────────────────────┘                    │
│  Ao selecionar → aparece na sidebar "Falhas"        │
└─────────────────────────────────────────────────────┘
          │ clica "Finalizar"
          ▼
┌─────────────────────────────────────────────────────┐
│  TELA 4: FINALIZAR VALIDAÇÃO                        │
│  ┌─────────────────────┐ ┌───────────────────────┐  │
│  │ Falhas selecionadas:│ │ Notas opcionais:      │  │
│  │ • Nome ausente      │ │ ┌───────────────────┐ │  │
│  │ • Dose incorreta    │ │ │                   │ │  │
│  │                     │ │ │                   │ │  │
│  └─────────────────────┘ │ └───────────────────┘ │  │
│                          └───────────────────────┘  │
│         [Finalizar Validação]                       │
└─────────────────────────────────────────────────────┘
          │ finaliza
          ▼
     Próxima cestinha (ou resultado final se todas feitas)
```

### Arquitetura Técnica

**Como funciona**: O agente AI (auditor-prescricao) gera o cenário do exercício com múltiplas prescrições em formato estruturado JSON. O frontend renderiza o simulador interativo em vez do markdown.

**1. Prompt do agente** (`supabase/functions/agent-chat/index.ts`)

Atualizar o prompt do `auditor-prescricao` para incluir um modo "simulador" que, quando ativado por input do aluno (ex: "Iniciar simulação" ou template), gera output em JSON estruturado:

```json
[SIMULACAO_PRESCRICAO]
{
  "baskets": [
    {
      "id": 1,
      "patient": "Cesare Bergamaschi",
      "prescriber": { "name": "Dr. Ralph Neilson", "crm": "RM98941", "address": "..." },
      "items": [
        {
          "type": "prescription",
          "medication": "Allopurinol (PROGOUT) 100mg Tab",
          "dose": "100mg", "qty": 100, "repeats": 2,
          "directions": "Take ONE tablet by mouth TWICE daily with food",
          "fields": {
            "medicationName": { "value": "PROGOUT 100mg Tab", "faults": ["Nome genérico ausente", "Nome comercial incompleto"] },
            "dose": { "value": "100mg", "faults": ["Dose incorreta", "Dose não especificada"] },
            "prescriber": { "value": "Ralph Neilson", "faults": ["Nome do prescritor ausente", "Nome incompleto", "Prescritor incorreto"] },
            "directions": { "value": "...", "faults": ["Posologia incorreta", "Via não especificada"] },
            "quantity": { "value": "100", "faults": ["Quantidade incorreta", "Quantidade ausente"] },
            "date": { "value": "31/03/2026", "faults": ["Data ausente", "Data expirada"] }
          },
          "expectedFaults": ["Nome genérico ausente"],
          "label": { ... }
        }
      ]
    }
  ]
}
[/SIMULACAO_PRESCRICAO]
```

**2. Novos componentes** (`src/components/chat/prescription-sim/`)

| Componente | Responsabilidade |
|---|---|
| `PrescriptionSimulator.tsx` | Orquestrador principal: controla estado (bancada → itens → revisão → finalizar), navega entre telas |
| `PharmacyCounter.tsx` | Tela 1: bancada com cestinhas coloridas, status de cada uma (pendente/completa/em revisão) |
| `BasketItems.tsx` | Tela 2: lista de itens (prescrição + etiquetas) da cestinha, com botão "Revisar" |
| `PrescriptionReview.tsx` | Tela 3: prescrição renderizada como "documento" com campos clicáveis + sidebar de falhas |
| `LabelReview.tsx` | Revisão da etiqueta: similar ao PrescriptionReview mas para etiquetas de dispensação |
| `FaultSelector.tsx` | Dropdown/popover que aparece ao clicar num campo, mostrando opções de falha pertinentes |
| `FaultsSidebar.tsx` | Painel lateral mostrando falhas selecionadas, com botão de remover (x) |
| `FinalizationModal.tsx` | Tela 4: resumo das falhas + textarea para notas + botão "Finalizar Validação" |
| `SimulationResults.tsx` | Resultado final: score, falhas corretas vs incorretas vs não encontradas, feedback da IA |

**3. Parser** (`src/lib/chatParsers.ts`)

- Adicionar `isPrescriptionSimulation(content)` que detecta o marcador `[SIMULACAO_PRESCRICAO]`
- Adicionar `extractSimulationData(content)` que extrai o JSON do cenário

**4. Integração no Chat** (`src/pages/Chat.tsx`)

- No `ChatMessageContent`, adicionar detecção antes dos outros cards:
  - Se `isPrescriptionSimulation(content)` → renderizar `<PrescriptionSimulator data={...} />`
- Quando o aluno finaliza todas as cestinhas, o componente pode enviar automaticamente as respostas ao agente para feedback personalizado

**5. Estado do simulador**

Estado local gerenciado via `useState` no `PrescriptionSimulator`:
- `currentView`: 'counter' | 'basket' | 'review' | 'finalize' | 'results'
- `activeBasketId`: qual cestinha está ativa
- `activeItemId`: qual item está sendo revisado
- `selectedFaults`: `Map<basketId, Map<itemId, Map<fieldId, string[]>>>` - falhas selecionadas pelo aluno
- `notes`: `Map<basketId, string>` - notas por cestinha
- `completedBaskets`: `Set<basketId>` - cestinhas já validadas

### Visual e UX

- **Bancada**: fundo com gradiente dark, cestinhas como cards 3D com sombra, ícone de cesta/caixa, badge de status (pendente/completa)
- **Prescrição**: renderizada como um "documento" com fundo claro (simulando papel), campos com borda pontilhada que ficam highlighted ao hover, cursor pointer
- **Etiqueta**: renderizada como label de farmácia (fundo branco, texto red "KEEP OUT OF REACH", layout de etiqueta real)
- **Falhas**: popover com opções, item selecionado fica com fundo rosa/vermelho e badge "Added"
- **Sidebar**: painel escuro com lista de falhas, cada uma com botão X para remover
- **Transições**: animações suaves entre telas (fade/slide)

### Aproveitamento do código existente

- **PrescriptionAuditCard**: continua sendo usado para o modo de **análise passiva** (quando o farmacêutico envia uma prescrição real para auditoria)
- **chatParsers.ts**: estendido com os novos parsers de simulação
- **Design system**: mesmos tokens CSS (teal/dark), badges, cards glass

### Arquivos a criar/editar

1. **Criar** `src/components/chat/prescription-sim/PrescriptionSimulator.tsx`
2. **Criar** `src/components/chat/prescription-sim/PharmacyCounter.tsx`
3. **Criar** `src/components/chat/prescription-sim/BasketItems.tsx`
4. **Criar** `src/components/chat/prescription-sim/PrescriptionReview.tsx`
5. **Criar** `src/components/chat/prescription-sim/LabelReview.tsx`
6. **Criar** `src/components/chat/prescription-sim/FaultSelector.tsx`
7. **Criar** `src/components/chat/prescription-sim/FaultsSidebar.tsx`
8. **Criar** `src/components/chat/prescription-sim/FinalizationModal.tsx`
9. **Criar** `src/components/chat/prescription-sim/SimulationResults.tsx`
10. **Editar** `src/lib/chatParsers.ts` — adicionar parsers de simulação
11. **Editar** `src/pages/Chat.tsx` — integrar o simulador
12. **Editar** `supabase/functions/agent-chat/index.ts` — modo simulador no prompt

