

# Plano: Superfontes para o Tutor de Farmacologia

## Fontes de Alto Impacto com APIs Abertas

| Fonte | O que traz | API |
|-------|-----------|-----|
| **DrugBank** (via DailyMed) | Bulas completas FDA, mecanismos, farmacocinética, interações | REST gratuita (NLM) |
| **KEGG DRUG/Pathway** | Vias metabólicas, alvos moleculares, mapas de sinalização | REST gratuita |
| **ChEMBL (EBI)** | Dados de bioatividade, IC50, afinidade por receptores, SAR | REST gratuita |
| **PharmGKB** | Farmacogenômica — variantes genéticas que alteram resposta a fármacos | REST gratuita |
| **ClinicalTrials.gov** | Ensaios clínicos ativos/concluídos, evidência translacional | REST v2 gratuita |
| **Cochrane/PubMed Systematic Reviews** | Meta-análises e revisões sistemáticas filtradas | Via PubMed (já integrado) |
| **WHO ICD/ATC** | Classificação ATC completa com DDD (doses diárias definidas) | Dados estáticos |
| **UniProt** | Proteínas-alvo dos fármacos, estrutura, função | REST gratuita |

## Impacto por Fonte

```text
Nível de "superpoder":

DrugBank/DailyMed  ████████████ Bulas + interações + PK completa
KEGG Pathway       ██████████   Visualização de vias metabólicas
ChEMBL             █████████    Dados quantitativos de bioatividade
PharmGKB           █████████    Farmacogenômica (medicina personalizada)
ClinicalTrials.gov ████████     Evidência clínica em tempo real
UniProt            ███████      Alvos moleculares detalhados
```

## Implementação

### 1. Novas funções de busca no `agent-chat`

Adicionar ao `agent-chat/index.ts` funções análogas às já existentes (`buildPubMedContext`, `buildOpenFDAContext`):

- **`buildDailyMedContext(drug)`** — Consulta `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=X` para obter bulas FDA completas com mecanismo de ação, farmacocinética, contraindicações e interações
- **`buildChEMBLContext(drug)`** — Consulta `https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=X` para dados de bioatividade (IC50, Ki, EC50), alvos moleculares e relação estrutura-atividade
- **`buildKEGGContext(drug)`** — Consulta `https://rest.kegg.jp/find/drug/X` e `https://rest.kegg.jp/get/DXXXXX` para vias metabólicas, enzimas CYP envolvidas e mapas de pathway
- **`buildPharmGKBContext(drug)`** — Consulta `https://api.pharmgkb.org/v1/data/chemical?name=X` para variantes farmacogenômicas, recomendações de dosagem baseadas em genótipo e guidelines CPIC
- **`buildClinicalTrialsContext(drug)`** — Consulta `https://clinicaltrials.gov/api/v2/studies?query.term=X&filter.overallStatus=RECRUITING` para ensaios clínicos relevantes em andamento
- **`buildUniProtContext(target)`** — Consulta `https://rest.uniprot.org/uniprotkb/search?query=X+AND+organism_id:9606` para detalhes dos alvos proteicos (função, localização, estrutura)

### 2. Orquestração inteligente no `agent-chat`

Em vez de chamar todas as fontes sempre (seria lento e caro), implementar detecção de contexto:

- **Pergunta sobre mecanismo de ação** → PubMed + DailyMed + KEGG + ChEMBL
- **Pergunta sobre efeitos adversos** → OpenFDA + DailyMed + PubMed
- **Pergunta sobre interações** → DailyMed + KEGG (enzimas CYP) + PharmGKB
- **Pergunta sobre farmacogenômica** → PharmGKB + PubMed
- **Pergunta sobre evidência clínica** → PubMed (filtro systematic review) + ClinicalTrials.gov
- **Pergunta sobre alvo molecular** → UniProt + ChEMBL + KEGG Pathway

Usar keywords no input do usuário para ativar seletivamente cada fonte via `Promise.all` (paralelo).

### 3. Atualização do prompt do tutor

Expandir a seção de fontes e prefixos de citação:

- `📚 Aulas do Prof. Sérgio Araújo` — fonte primária (já existe)
- `🔬 PubMed` — artigos científicos (já existe)
- `🏥 FDA/OpenFDA` — dados de segurança (já existe)
- `💊 DailyMed (NLM)` — bula FDA oficial
- `🧬 PharmGKB` — farmacogenômica
- `⚗️ ChEMBL` — bioatividade e SAR
- `🗺️ KEGG` — vias metabólicas
- `🏥 ClinicalTrials.gov` — ensaios clínicos
- `🎯 UniProt` — alvos proteicos

### 4. Formato de resposta enriquecido

O tutor passará a estruturar respostas complexas em seções quando múltiplas fontes forem consultadas:

```text
📚 Base do Prof. Sérgio Araújo: [conteúdo da aula]
🎓 Para aprofundar: Aula "Farmacologia dos IBPs"

💊 Dados complementares (DailyMed): [farmacocinética detalhada]
🧬 Farmacogenômica (PharmGKB): [variantes CYP2C19]
⚗️ Bioatividade (ChEMBL): [IC50, seletividade]

📖 Referências:
- PubMed: PMID 12345678
- PharmGKB: PA12345
- ClinicalTrials: NCT01234567
```

## Arquivos Modificados

- `supabase/functions/agent-chat/index.ts` — novas funções de busca + orquestração inteligente + prompt atualizado

## Observações

- Todas as APIs listadas são **gratuitas e abertas** — não requerem API keys
- O mapeamento PT→EN de termos farmacológicos já existente será reutilizado e expandido
- O tempo de resposta será controlado com `Promise.race` (timeout de 5s por fonte) para não degradar a experiência

