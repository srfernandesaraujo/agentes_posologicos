-- Guias de critério por tipo de trabalho acadêmico para o agente "revisor-banca",
-- no mesmo padrão de agent_format_guides (roteirista-ganchos-virais): uma linha por
-- tipo, carregada sob demanda pelo backend (agent-chat/index.ts) conforme o tipo de
-- trabalho que o usuário informar na Fase 0 da conversa, e injetada no systemPrompt
-- como <GUIA_TIPO_TRABALHO>. Mantém o system_prompt do agente enxuto e evita repetir
-- o problema de prompt gigante que o Roteirista teve antes de ser fatorado.

CREATE TABLE public.agent_review_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug TEXT NOT NULL,
  format_key TEXT NOT NULL,
  format_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  guide_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_slug, format_key)
);

ALTER TABLE public.agent_review_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Review guides are publicly readable" ON public.agent_review_guides FOR SELECT USING (true);

INSERT INTO public.agent_review_guides (agent_slug, format_key, format_label, sort_order, guide_markdown) VALUES

('revisor-banca', 'tcc', 'TCC (Trabalho de Conclusão de Curso)', 1, $tccguide$## GUIA — TCC (TRABALHO DE CONCLUSÃO DE CURSO / GRADUAÇÃO)

**Nível de exigência**: o TCC avalia se o aluno sabe estruturar uma investigação (ou projeto/estudo de caso) do início ao fim com rigor mínimo aceitável para a graduação — aplicação correta e coerente de conceitos já consolidados na literatura. NÃO se espera originalidade científica nem contribuição inédita para a área; isso seria exigir de um TCC o que só se exige de mestrado/doutorado, e um revisor competente não pune um TCC por "não trazer nada novo".

### Dimensões de avaliação (percorra todas)

1. **Estrutura e normas** (ABNT por padrão, ou a norma que o usuário informar): capa, folha de rosto, resumo/abstract com palavras-chave, sumário, elementos textuais (introdução, desenvolvimento, conclusão), referências, citações no formato correto (autor-data ou numérico), paginação, hierarquia de títulos/seções consistente.
2. **Introdução**: apresenta o tema, justifica a relevância (mesmo que de forma simples e prática, não precisa ser um "estado da arte"), define objetivo geral e objetivos específicos claros e exequíveis dentro do prazo de um TCC, delimita o escopo (o que o trabalho NÃO vai tratar).
3. **Referencial teórico**: usa fontes pertinentes e não excessivamente desatualizadas para a área, articula os autores entre si (não é uma lista de citações soltas, um parágrafo por autor sem diálogo), conecta a teoria ao problema do trabalho — não é uma seção "solta" que não é retomada depois.
4. **Metodologia**: descreve o tipo de pesquisa (bibliográfica, estudo de caso, exploratória, experimental, etc.), os procedimentos de coleta/análise, e justifica minimamente as escolhas (por que esse método, por que essa amostra/caso/empresa/período).
5. **Desenvolvimento/resultados**: conteúdo organizado, coerência lógica entre seções, sem contradições internas, sem repetição desnecessária do referencial teórico dentro dos resultados.
6. **Conclusão**: retoma os objetivos declarados na introdução e responde a eles explicitamente, um a um; não introduz dado/afirmação nova não discutida antes; reconhece limitações do trabalho de forma honesta (não precisa ser extensa).
7. **Redação acadêmica**: impessoalidade (evitar 1ª pessoa quando a norma da instituição não permite), coesão entre parágrafos e seções, ausência de coloquialismos, ortografia e gramática.
8. **Coerência global**: os objetivos da introdução batem com o que a conclusão realmente responde? A metodologia descrita é a que de fato foi seguida no desenvolvimento? O título do trabalho reflete o que foi efetivamente feito?

### Erros mais comuns em TCC (procure especificamente por estes)

- Objetivos genéricos demais, ou objetivos específicos que não são de fato subdivisões do objetivo geral.
- Referencial teórico "colado" sem diálogo com o problema de pesquisa nem retomada nos resultados.
- Metodologia descrita de forma vaga (ex.: "pesquisa qualitativa" sem explicar como os dados foram efetivamente coletados/analisados).
- Conclusão que não responde aos objetivos, ou que traz afirmação nova não discutida antes.
- Excesso de citação direta longa em vez de paráfrase com alguma análise própria do aluno.
- Normas de citação/referência inconsistentes (citação no texto sem entrada correspondente nas referências, ou vice-versa).
- Introdução e conclusão escritas em momentos diferentes do processo, sem revisão final de coerência entre elas.

### Checklist do revisor competente (TCC)

- [ ] Objetivo geral e específicos são claros, exequíveis e coerentes entre si.
- [ ] A metodologia descrita é suficiente para alguém entender como o estudo foi conduzido.
- [ ] Cada seção do desenvolvimento contribui visivelmente para responder ao objetivo.
- [ ] A conclusão responde ponto a ponto aos objetivos, sem introduzir novidade.
- [ ] As normas de citação/referência são usadas de forma consistente do início ao fim.
- [ ] Não há afirmações relevantes sem fonte que precisariam de uma.
- [ ] O trabalho é exequível para o nível de graduação (não está sendo cobrado como se fosse mestrado).

### Perguntas típicas de banca de TCC (use como modelo, adapte ao trabalho real lido)

- "Por que você escolheu esse método/abordagem e não outro possível para essa pergunta?"
- "Se você tivesse mais tempo ou recursos, o que faria diferente na coleta de dados?"
- "Dois dos autores que você cita discordam entre si nesse ponto — como você se posiciona?"
- "Como esse resultado se aplica na prática, fora do contexto específico do seu estudo?"
- "Qual foi a maior dificuldade metodológica que você enfrentou e como contornou?"$tccguide$),

('revisor-banca', 'mestrado', 'Dissertação de Mestrado', 2, $mestradoguide$## GUIA — DISSERTAÇÃO DE MESTRADO

**Nível de exigência**: além de tudo que se exige de um TCC, o mestrado exige um problema de pesquisa bem delimitado e justificado academicamente, revisão de literatura robusta e atualizada (não só pertinente, mas com domínio real do que já foi publicado sobre o tema), rigor metodológico com escolhas justificadas teoricamente (não só descritas), e uma contribuição para a área — ainda que modesta, incremental ou de aplicação de um método já existente a um contexto novo. Não se exige ineditismo do nível de doutorado, mas se exige que o trabalho vá além de "descrever" — precisa analisar e discutir.

### Dimensões de avaliação (percorra todas)

1. **Problema de pesquisa**: está claramente delimitado, é relevante para a área (não só para o interesse pessoal do autor), e a pergunta de pesquisa/hipóteses decorrem logicamente da lacuna apontada na revisão de literatura.
2. **Revisão de literatura**: cobre a produção relevante e recente sobre o tema (não só livros-texto genéricos), organiza os autores por linhas/correntes teóricas quando aplicável, identifica claramente a lacuna que a dissertação pretende preencher, e é retomada na discussão dos resultados (não é um capítulo isolado).
3. **Referencial teórico**: consistente do início ao fim — os conceitos definidos no referencial são os mesmos usados na análise, sem mudança de definição no meio do caminho.
4. **Metodologia**: delineamento de pesquisa, população/amostra, instrumentos de coleta e procedimentos de análise descritos com detalhe suficiente para replicação, e — crucialmente — justificados (por que esse delineamento serve para responder a essa pergunta, por que essa análise estatística/qualitativa é a adequada).
5. **Resultados**: apresentados de forma organizada e sem interpretação misturada indevidamente com a descrição bruta dos dados (separar "o que foi encontrado" de "o que isso significa", mesmo que em seções próximas).
6. **Discussão**: compara os resultados com a literatura revisada (concorda? diverge? por quê?), interpreta implicações teóricas e/ou práticas, não é uma repetição dos resultados com outras palavras.
7. **Conclusão**: retoma pergunta/hipóteses, indica a contribuição do trabalho (mesmo que modesta), reconhece limitações reais (metodológicas, de amostra, de escopo) e sugere pesquisas futuras coerentes com essas limitações.
8. **Consistência objetivos↔hipóteses↔resultados↔conclusão**: o que foi prometido na introdução foi de fato respondido, nem mais nem menos.
9. **Escrita acadêmica**: precisão terminológica, argumentação encadeada (cada parágrafo avança o argumento, não repete o anterior com outras palavras).

### Erros mais comuns em dissertações (procure especificamente por estes)

- Revisão de literatura desatualizada ou superficial demais para o nível de mestrado (mistura fontes de qualidade muito diferente sem critério).
- Lacuna de pesquisa declarada mas não claramente sustentada pela revisão (o autor diz "não há estudos sobre X" sem evidenciar a busca).
- Metodologia descrita sem justificar as escolhas (por que essa técnica de análise e não outra).
- Resultados e discussão misturados sem distinção clara entre "dado encontrado" e "interpretação do autor".
- Discussão que não dialoga de fato com a literatura revisada — só reafirma os resultados.
- Conclusão que amplia demais o alcance do achado (generalização indevida a partir de amostra pequena/específica).
- Objetivos/hipóteses que mudam de redação entre a introdução e a conclusão.

### Checklist do revisor competente (Mestrado)

- [ ] O problema de pesquisa é relevante e a lacuna está evidenciada pela revisão de literatura, não apenas afirmada.
- [ ] A revisão de literatura é atual, tem volume e profundidade compatíveis com o tema, e dialoga com os resultados depois.
- [ ] As escolhas metodológicas são justificadas teoricamente, não só descritas.
- [ ] Resultados e discussão estão claramente distintos (descrição vs. interpretação).
- [ ] A discussão compara explicitamente os achados com estudos anteriores.
- [ ] As limitações reconhecidas são as limitações reais do estudo (não genéricas de "toda pesquisa tem limitações").
- [ ] A contribuição da dissertação está explicitada em algum lugar do texto, com clareza sobre para quem/o quê ela serve.

### Perguntas típicas de banca de Mestrado (use como modelo, adapte ao trabalho real lido)

- "Qual é exatamente a lacuna na literatura que este trabalho preenche, e como você tem certeza de que ela existe?"
- "Por que esse método de análise foi escolhido e não uma alternativa comum na área, como [X]?"
- "Seus resultados confirmam ou contradizem o que a literatura revisada previa? Como você explica isso?"
- "Esse achado se generaliza para além da sua amostra/contexto? Com que limites?"
- "Se você tivesse que apontar a principal fragilidade metodológica do seu próprio trabalho, qual seria?"$mestradoguide$),

('revisor-banca', 'doutorado', 'Tese de Doutorado', 3, $doutoradoguide$## GUIA — TESE DE DOUTORADO

**Nível de exigência**: o padrão mais alto. Além de tudo exigido no mestrado, a tese precisa demonstrar originalidade/ineditismo explícito, domínio do estado da arte nacional E internacional (não só nacional), profundidade teórica com articulação conceitual própria do autor (não apenas aplicação de teoria alheia), rigor metodológico elevado com justificativa inclusive epistemológica das escolhas, e uma contribuição científica clara e defensável para o campo — o candidato precisa conseguir argumentar por que o que ele fez é novo e por que importa, e antecipar contra-argumentos plausíveis de pares da área.

### Dimensões de avaliação (percorra todas)

1. **Originalidade/ineditismo**: o que exatamente é novo aqui — um novo método, uma nova aplicação, uma nova síntese teórica, um novo dado empírico, uma refutação/qualificação de algo estabelecido? Isso precisa estar explicitado pelo próprio autor, não inferido pelo leitor.
2. **Estado da arte**: a revisão de literatura demonstra domínio da produção internacional relevante (não só trabalhos em português ou só da própria instituição/orientador), identifica correntes teóricas concorrentes quando existem, e situa a tese dentro desse mapa com precisão.
3. **Articulação teórica**: o autor não apenas aplica um referencial pronto — ele o problematiza, cruza referenciais quando pertinente, e constrói um argumento teórico próprio que sustenta as escolhas metodológicas e a interpretação dos resultados.
4. **Rigor metodológico**: delineamento robusto e adequado à pergunta, instrumentos validados ou devidamente construídos/justificados, análise apropriada ao tipo de dado, e — no nível de doutorado — justificativa que vai além do "como" e chega ao "por que esse é o desenho epistemologicamente correto para essa pergunta".
5. **Produção científica associada**: verifique (perguntando ao usuário se não estiver no documento) se há publicações, comunicações em eventos ou submissões decorrentes da tese — não é obrigatório em toda instituição, mas quando existe, fortalece a defesa e deve ser mencionado no relatório.
6. **Discussão e contribuição**: a discussão não só compara com a literatura, mas argumenta explicitamente qual é a contribuição teórica e/ou prática, para quem ela importa (a área, a prática profissional, políticas públicas, etc.), e antecipa objeções plausíveis de pesquisadores da área.
7. **Consistência teórica ao longo de toda a tese**: os conceitos-chave mantêm a mesma definição do capítulo teórico até a conclusão; não há mudança tácita de referencial no meio do texto.
8. **Conclusão**: sintetiza a contribuição de forma defensável (sem exagero nem modéstia excessiva), reconhece limitações reais sem desqualificar o próprio trabalho, e projeta agenda de pesquisa futura coerente com o que foi encontrado.
9. **Capacidade de defesa/argumentação**: com base no texto, quais pontos são mais vulneráveis a questionamento de banca e precisam de resposta preparada?

### Erros mais comuns em teses (procure especificamente por estes)

- Ineditismo alegado mas não demonstrado com precisão (o autor diz "isso é inédito" sem mapear o que já existe de mais próximo e diferenciar explicitamente).
- Revisão de literatura enviesada para uma única linha teórica sem reconhecer correntes concorrentes.
- Metodologia rigorosa tecnicamente mas sem justificativa epistemológica de por que aquele é o caminho certo para aquela pergunta.
- Discussão que soa como uma segunda revisão de literatura, sem argumentar a contribuição própria com clareza.
- Conclusão desproporcional ao que foi de fato investigado (contribuição inflacionada) ou, no extremo oposto, autor tão cauteloso que não reivindica a contribuição real que o trabalho tem.
- Inconsistência de definição de conceito-chave entre capítulos.

### Checklist do revisor competente (Doutorado)

- [ ] A originalidade está explicitamente nomeada e diferenciada do que já existe na literatura mais próxima.
- [ ] A revisão de literatura cobre produção internacional relevante, não só nacional.
- [ ] Há articulação teórica própria do autor, não apenas aplicação de teoria alheia.
- [ ] As escolhas metodológicas têm justificativa que vai além do operacional (chega ao epistemológico).
- [ ] A discussão argumenta explicitamente a contribuição e antecipa objeções plausíveis.
- [ ] Os conceitos-chave são usados de forma consistente do capítulo teórico à conclusão.
- [ ] A conclusão é proporcional ao que foi investigado — nem inflacionada, nem subestimada.

### Perguntas típicas de banca de Doutorado (use como modelo, adapte ao trabalho real lido)

- "Em que exatamente este trabalho avança em relação ao que [autor/corrente mais próxima] já havia proposto?"
- "Que corrente teórica concorrente você deliberadamente não seguiu, e por que essa escolha é defensável?"
- "Qual seria a crítica mais forte que um revisor cético desta área faria ao seu método, e como você responderia?"
- "Se um pesquisador replicasse este estudo em outro contexto, o que você espera que mudasse nos resultados, e por quê?"
- "Qual é, na sua visão, o limite da generalização teórica que esta tese permite?"$doutoradoguide$),

('revisor-banca', 'projeto_qualificacao', 'Projeto de Pesquisa / Qualificação', 4, $projguide$## GUIA — PROJETO DE PESQUISA / QUALIFICAÇÃO (PRÉ-DEFESA FINAL)

**Nível de exigência**: diferente dos outros três guias, aqui NÃO há resultados ainda — o documento é um projeto/pré-projeto (mestrado ou doutorado) sendo avaliado antes da coleta de dados ou da defesa final. O foco do revisor muda de "os resultados sustentam a conclusão?" para "esse desenho de pesquisa é viável, bem delimitado, e consegue ser executado no prazo que resta?". Trate isso como uma revisão de VIABILIDADE E DESENHO, não de resultados.

### Dimensões de avaliação (percorra todas)

1. **Delimitação do problema/pergunta de pesquisa**: está claro, específico e do tamanho certo para o tempo/recursos que restam até a defesa final? Um erro comum aqui é um projeto ambicioso demais para o prazo.
2. **Justificativa e lacuna**: a revisão de literatura preliminar já demonstra, mesmo que de forma inicial, por que essa pergunta importa e que lacuna ela pretende preencher?
3. **Referencial teórico preliminar**: os conceitos-chave já estão claramente definidos e adequados à pergunta, mesmo que o capítulo teórico ainda vá crescer depois da qualificação?
4. **Metodologia proposta**: o delineamento, a amostra/população pretendida, os instrumentos e o plano de análise são adequados à pergunta e — principalmente — SÃO EXEQUÍVEIS dentro do tempo, orçamento e acesso a campo que o candidato realmente tem?
5. **Cronograma**: é realista? Contempla tempo para imprevistos (atraso de aprovação em comitê de ética, dificuldade de acesso a participantes, etc.)? Está compatível com o prazo regimental do programa?
6. **Riscos e contingências**: o candidato já identificou o que pode dar errado (baixa adesão da amostra, indisponibilidade de dados, mudança de cenário) e tem um plano B minimamente pensado?
7. **Aspectos éticos**: se envolve seres humanos/dados sensíveis, há menção a submissão a comitê de ética (CEP/CONEP no Brasil) ou justificativa de por que não se aplica?
8. **Maturidade para seguir em frente**: o que precisa amadurecer ANTES da coleta de dados começar — isso é o entregável mais importante desta revisão, mais até do que apontar defeitos de redação.

### Erros mais comuns em projetos/qualificação (procure especificamente por estes)

- Pergunta de pesquisa ainda ampla demais, tentando responder mais de uma coisa ao mesmo tempo.
- Metodologia coerente na teoria mas inviável na prática (amostra que o candidato não tem como acessar, análise que exige dados que não existem ainda).
- Cronograma otimista demais, sem folga para imprevistos comuns (ética, campo, disponibilidade de sujeitos).
- Referencial teórico ainda desconectado da metodologia proposta (a teoria promete uma coisa, o método vai medir outra).
- Ausência de plano de contingência para os riscos mais óbvios do próprio desenho.

### Checklist do revisor competente (Projeto/Qualificação)

- [ ] A pergunta de pesquisa é específica o suficiente para ser respondida no prazo que resta.
- [ ] A metodologia proposta é exequível com os recursos e acesso a campo reais do candidato (não hipotéticos).
- [ ] O cronograma tem folga para os imprevistos mais prováveis desse tipo de pesquisa.
- [ ] Questões éticas relevantes já estão endereçadas ou com plano de submissão claro.
- [ ] Há ao menos um plano de contingência para o risco mais provável de inviabilizar a coleta.
- [ ] O referencial teórico já dialoga com a metodologia proposta, não são dois blocos desconectados.

### Perguntas típicas de banca de Projeto/Qualificação (use como modelo, adapte ao trabalho real lido)

- "Se você não conseguir acesso à amostra/campo como planejado, qual é o seu plano B?"
- "Esse cronograma já considera o tempo de aprovação no comitê de ética? Quanto isso costuma levar nessa instituição?"
- "Por que esse recorte da pergunta e não um mais amplo/mais restrito?"
- "O que, no seu referencial teórico atual, ainda precisa ser aprofundado antes da coleta de dados?"
- "Quais desses objetivos específicos você julga mais arriscado não conseguir cumprir no prazo, e por quê?"$projguide$);
