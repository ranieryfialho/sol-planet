# Uso de IA

**Ferramenta:** Claude Code (Anthropic), no VS Code.
**Quando:** adaptação do projeto à Proposta B, em 07/11/2026, na branch `projeto-final-gt4`; ajustes posteriores a partir de 10/11/2026 (seção "Ajustes após a primeira entrega").
**Como trabalhei:** a IA levanta o contexto, propõe e executa; **as decisões são minhas**. Depois do primeiro passo, nenhuma alteração entrou sem plano aprovado, e cada módulo (M1 a M4) virou um commit separado para revisão.

> Os prompts abaixo estão **resumidos e revisados** (ortografia e clareza) a partir da conversa original. A ordem, a intenção e as decisões são as que aconteceram.

## Linha do tempo das interações

### 1. Contextualização

**Prompt:** "Leia o escopo do projeto final (aula 24) e me ajude a adequar o sol-planet à Proposta B."

**Resultado:** a IA leu o escopo, analisou o repositório (estrutura, testes, compose, CI) e listou o que já atendia e o que faltava em cada módulo.

### 2. Controle do processo: aprovar antes de alterar

**Prompt:** "Pare e desfaça o que foi feito. Quero aprovar o plano antes de qualquer alteração: a entrega precisa estar em conformidade com o escopo."

**Contexto:** a IA tinha começado a criar arquivos direto, a partir da própria análise.
**Resultado:** tudo foi revertido, e o fluxo passou a ser **plano → aprovação → execução**. Foi a lição mais importante sobre usar IA neste projeto: ela acelera o trabalho, mas o controle do escopo é de quem entrega.

### 3. Direção do plano

**Prompt:** "Quatro pontos: (1) quero documentar tudo o que o projeto já tem, sem esconder nada, com a Proposta B como régua da avaliação; (2) explique melhor a proposta de domínio e de fluxo principal; (3) o escopo sugere Vitest, Jest ou Supertest, então vamos usar essas ferramentas; (4) a branch será `projeto-final-gt4`."

**Resultado:**

- O README ganhou uma tabela de conformidade e uma seção "além do escopo B".
- A IA detalhou o domínio (monitoramento de geração e alertas) e o fluxo ponta a ponta (coleta → Postgres → regras → API). Ela também revisou a própria sugestão anterior: `/api/health` não é domínio, então o endpoint principal passou a ser `GET /api/usinas/{id}/resumo`.
- A proposta inicial de usar `node:test` foi descartada em favor de **Vitest + Supertest**.

### 4. Aprovação do plano

**Prompt:** "Aprovado: o endpoint principal é o resumo da usina, com os testes migrados para Vitest e integração via Supertest."

**Resultado:** antes de começar, a IA apresentou a lista completa de arquivos que seriam criados ou alterados em cada módulo.

### 5. Cobertura e posicionamento do projeto

**Prompt:** "O mínimo de 80% de cobertura é adequado para este projeto? Se for, pode seguir. No README, deixe claro que o projeto já existia e foi adaptado ao padrão de mercado proposto na Geração Tech 4.0."

**Resultado:** a IA explicou que o escopo exige um mínimo declarado e cumprido, sem fixar valor, e que 80% é um patamar usual e viável medindo domínio e API. O mínimo ficou declarado no `vitest.config.mts`, e o README abre com o contexto do projeto.

### 6. Segredos: achados do gitleaks

**Pergunta da IA:** o gitleaks apontou 6 ocorrências em `packages/solplanet/src/index.ts`. Tratar com allowlist justificada, mover para variáveis de ambiente ou varrer só o código atual?

**Minha decisão:** **allowlist justificada.** Os valores são a `appKey` e o `appSecret` públicos do APK da Solplanet, iguais em qualquer instalação do app, e não credenciais do projeto. Mover para o `.env` não limparia o histórico do git e ainda exigiria mudar o `.env` da VPS antes do próximo deploy. A justificativa está no README (seção Segredos) e no `.gitleaksignore`.

### 7. Revisão da documentação

**Prompt:** "O `docs/ia.md` ficou fraco. Reorganize com os prompts resumidos e inclua todas as interações relevantes."

**Resultado:** esta versão do documento.

### 8. Aprofundamento técnico

**8.1. Por que um núcleo de domínio puro, e não uma arquitetura hexagonal? Quais são os riscos?**
A hexagonal entrega a mesma testabilidade com muito mais estrutura: interfaces, adaptadores e injeção para cada dependência. Para um sistema deste tamanho e um prazo de 8 dias, funções puras em `domain.ts` e `summary.ts`, com o `db` passado por parâmetro, resolvem o problema real, que era testar as regras sem banco. O risco é a disciplina: nada impede que alguém volte a colocar SQL dentro de uma regra. A mitigação é a convenção registrada no [ADR 0001](adr/0001-nucleo-de-dominio-puro.md) e a cobertura cobrada na CI.

**8.2. Por que a usina de outra conta responde 404 e não 403?**
O 403 confirma que o id existe, e ids de usina são números inteiros (os `stationid` do fornecedor), fáceis de testar em sequência. Com 403, um usuário logado poderia enumerar quais usinas existem no sistema. Com 404, quem não tem acesso não consegue diferenciar "não existe" de "não é seu". É a mesma prática do GitHub com repositórios privados. O teste de integração cobre esse caso.

**8.3. O SLO de 300 ms faz sentido se o p95 medido foi de 24 ms?**
Sim, por dois motivos. Primeiro, o teste rodou numa máquina de 16 CPUs com o banco local e exclusivo, enquanto a produção é uma VPS com o Postgres compartilhado com outros serviços. Segundo, um SLO é uma promessa ao usuário, e 300 ms é o limite em que o dashboard e o app de IA ainda parecem instantâneos. Apertar para 50 ms faria o alerta disparar por variação de infraestrutura, não por problema real. O certo é medir na VPS e só então recalibrar (próximo passo em [desempenho.md](desempenho.md)).

**8.4. Qual é o gargalo do resumo e como reduzir as idas ao banco?**
O banco executa cada consulta em décimos de milissegundo (`EXPLAIN ANALYZE`: 0,072 ms). O custo está nas **3 rodadas sequenciais**: `canSeePlant` → leitura de `plants` → três consultas em paralelo. Juntar as duas primeiras num `join` de `plants` com `account_plants` elimina uma rodada inteira, cerca de um terço da latência no servidor. *Decisão: registrado como próximo passo e não implementado nesta entrega, porque o SLO já está atendido com folga.*

**8.5. O teste de integração apaga dados. Como garantir que nunca rode contra produção?**
Há três travas: (1) ele só lê `TEST_DATABASE_URL`, nunca o `DATABASE_URL` da aplicação; (2) ele **recusa** qualquer banco cujo nome não termine em `_test` e lança erro antes de tocar em qualquer dado; (3) sem a variável, o teste é pulado (`describe.skipIf`). Na CI, o banco é um container descartável (`solar_test`) criado só para o job.

**8.6. Usar o cookie do dashboard para autenticar a API é adequado? Quais são as alternativas?**
Para o uso atual (o próprio dashboard e testes), é adequado. O cookie é `httpOnly` (o JavaScript da página não o lê), `sameSite=lax` (não vai em requisições de outros sites, o que protege contra CSRF), `secure` quando a conexão é HTTPS e assinado com HMAC-SHA256, com validade de 30 dias. A API só tem rotas GET, que não alteram nada. Para clientes externos (outro sistema, um app mobile), o melhor seria **token Bearer**: o projeto já emite tokens OAuth 2.1 com PKCE para o MCP, e estender esse mecanismo para a API REST seria o caminho natural. API key fixa foi descartada (não expira e vaza fácil), e JWT próprio não traz vantagem sobre o OAuth que já existe. *Decisão: manter o cookie nesta entrega e registrar o Bearer como evolução.*

**8.7. O que falta para esta entrega se aproximar do nível A?**
Pelo escopo A, faltaria: monólito modular com fronteiras explícitas e volume de 100 mil registros sintéticos; testes de contrato (Pact) e Testcontainers; dois ambientes com GitHub Environments; métricas RED completas com Prometheus e Grafana, um trace com OpenTelemetry e Jaeger; feature flag; diagramas C4; plano de cache e de filas idempotentes; k6 em 3 estágios com relatório antes e depois. Parte da base já existe (deploy contínuo, OAuth, histograma por rota), mas a diferença de escopo é grande. Por isso escolhi o nível B: como diz o próprio escopo, um B bem feito vale mais que um A pela metade.

## Ajustes após a primeira entrega (10/11/2026)

### 9. Lista de ajustes e plano

**Prompt:** "Quero fazer alguns ajustes no projeto: ambientes staging e produção; feature flag e estratégia de deploy; ADR com alternativa descartada; C4 em Mermaid; README descrevendo as features do A que entraram no B; commits semânticos; deixar online para avaliação; bloquear push na main e proteger a branch; validar o `.env.example`. Explique o que vamos mudar e como, seguindo commits semânticos. Segue o documento com as diretrizes do projeto."

**Resultado:** antes de alterar qualquer coisa, a IA leu a branch `projeto-final-gt4` (README, CI, deploy, compose, ADR, `.env.example`) e comparou com as diretrizes. Apresentou uma tabela de cada item (o que muda e como fazer), uma ordem de execução em commits pequenos e três perguntas em aberto (fluxo de branch, acesso do avaliador e banco/subdomínio de staging na VPS). Nada foi alterado nesta etapa, mantendo o fluxo **plano → aprovação → execução** da interação 2.

**Observações da IA que mudaram o enquadramento:**

- A maior parte da lista são requisitos do **nível A** (dois ambientes, feature flag, estratégia de deploy, C4). Por isso o README deve dizer que o projeto é "B com itens do A", sem fingir que é A completo.
- O [ADR 0001](adr/0001-nucleo-de-dominio-puro.md) já traz duas alternativas descartadas. O item não parte do zero: o ADR 0002 registra as decisões novas (flag por variável de ambiente e staging na mesma VPS).
- Hoje a `main` não tem nenhuma proteção (confirmado pela API do GitHub), e o histórico anterior mistura `M1: ...` com frases soltas. O padrão semântico vale daqui em diante, **sem reescrever** commits já publicados.

### 10. Registro das interações e o staging online

**Prompt:** "Essas interações precisam ser validadas no `docs/ia.md`, seguindo o mesmo padrão, para não ficar incoerente. Outro detalhe: na aula não se diz que é estritamente necessário ter ambiente de produção online. Você acha que um staging com banco populado sinteticamente seria interessante para a avaliação?"

**Resultado:** esta seção. Sobre o staging, a IA respondeu que **vale como complemento, não como exigência**. A aula pede repositório, README que reproduza a execução local, CI verde, `docs/desempenho.md` e `CONTRIBUTORS.md`, e não pede nada online. O compose local continua sendo o caminho garantido. O staging com dados sintéticos ajuda porque deixa o avaliador ver o dashboard sem conta Solplanet (o seed já gera 400 dias de histórico), cumpre o item "dois ambientes" e permite medir o p95 fora da máquina de desenvolvimento (próximo passo da 8.3). O custo é baixo, porque reaproveita o `seed-demo.ts` e a VPS existente. O risco é expor um serviço público, mas só com dados fictícios.

**Regra para as próximas entradas:** a cada etapa executada, este documento ganha uma entrada com o prompt resumido, o resultado e a decisão. Decisões ainda não tomadas ficam marcadas como pendentes na tabela abaixo.

### 11. Aprovação e primeiras entregas

**Prompt:** "Sim, vamos lá."

**Resultado:** com o plano aprovado, a IA executou os itens que não dependiam das perguntas em aberto, um commit semântico por item, rodando lint, typecheck e testes (com Postgres do compose local) antes de cada commit:

- `ci(env)`: `scripts/check-env.mjs` confere o `.env.example` contra o código e o compose, e recusa valores com cara de segredo. Ao rodar pela primeira vez, ele achou três variáveis que o código já lia e o exemplo não documentava (`EVOLUTION_INSTANCE`, `READINGS_RETENTION_DAYS`, `DEMO_ACCOUNT_ID`).
- `docs(c4)`: diagramas de contexto e de contêineres em Mermaid, com as integrações conferidas no código (Solplanet, Livoltek, Evolution, Open-Meteo, mapa).
- `feat(web)`: flag `FEATURE_MCP`, que desliga o MCP, o OAuth e a página "Conectar IA".
- `build(compose)`, `ci(deploy)` e `docs(adr)`: staging autocontido, deploy em dois estágios com verificação de saúde e rollback, ADR 0002 e `docs/deploy.md`.
- `docs(readme)`: tabela dos itens do A incorporados e do que **não** entrou.

**Problemas que a verificação pegou:** ao subir o staging localmente para validá-lo, o `next build` da imagem falhou: o commit da flag tinha um erro de tipo em `nav.tsx` que o `pnpm typecheck` da raiz não cobre. Teria quebrado o próximo deploy de produção. Foi corrigido no mesmo commit (ainda não publicado) e a flag foi testada de ponta a ponta no compose de staging (com ela ligada, `/mcp` responde 401; desligada, `/mcp`, `/oauth/token` e `/conectar-ia` respondem 404 e `/api/health` continua 200).

### 12. Proteções do repositório (item 1 da lista pendente)

**Prompt:** "Calma, vamos por partes. [lista do que faltava]. Vamos resolver 1 por 1."

**Resultado:** a IA consultou o repositório antes de configurar (privado, conta pessoal, você como admin) e testou o que o GitHub aceitava, em vez de presumir:

- Environment `staging`: criado.
- Aprovador obrigatório em `production`: **recusado pelo GitHub (422)**, pois exige plano pago em repositório privado. A IA apresentou três alternativas, e a decisão foi **produção só por acionamento manual**, a partir da `main`, com o mesmo botão servindo de rollback.
- Proteção da `main`: a API aceitou o *ruleset*, mas a IA desconfiou de que o plano gratuito pudesse aceitá-lo sem aplicá-lo. Provou com uma branch descartável: o GitHub recusou a exclusão ("push declined due to repository rule violations"). O ruleset e a branch de teste foram removidos em seguida.
- Decisão sobre exceções: **sem bypass, nem para o dono**.

## Sugestões da IA × decisões

| Tema                       | Sugestão da IA                                        | Decisão                                                                               |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Endpoint principal         | `/api/health` no primeiro rascunho                   | ❌ Trocado por `GET /api/usinas/{id}/resumo` (domínio real)                         |
| O que documentar           | Só o escopo B                                         | ❌ **Documentar tudo** e marcar o que é extra                                   |
| Ferramentas de teste       | `node:test` nativo                                   | ❌ **Vitest + Supertest**, como o escopo sugere                                  |
| Cobertura mínima          | 80% de linhas                                          | ✅ Aceito depois de confirmar a viabilidade                                            |
| Compose de um comando      | Profile no compose de produção                       | 🔄 Arquivo separado (`docker-compose.local.yml`), para não arriscar o deploy da VPS |
| Gitleaks                   | Três alternativas                                     | ✅ Allowlist justificada                                                               |
| Padrão do M1              | Núcleo de domínio puro com E/S na borda              | ✅ [ADR 0001](adr/0001-nucleo-de-dominio-puro.md), com a hexagonal completa descartada  |
| Rodadas ao banco no resumo | Juntar `canSeePlant` e `plants` num `join`       | ⏸️ Próximo passo: o SLO já está atendido com folga                                |
| Autenticação da API      | Bearer via OAuth já existente, para clientes externos | ⏸️ Mantido o cookie nesta entrega, com o Bearer registrado como evolução           |
| Aprovação da produção     | Aprovador obrigatório no Environment `production` | 🔄 O GitHub recusou (422): exige plano pago em repositório privado. **Decisão:** produção só por acionamento manual, a partir da `main` |
| Bypass na proteção da `main` | Sem exceção, nem para o admin | ✅ Aceito |
| Ajustes pós-entrega        | Plano em 7 passos, começando por `.env.example`, C4, flag e ADR 0002, com a proteção da `main` por último | ✅ Aprovado ("vamos lá"); itens 1 a 5 executados, restam proteção da `main` e staging online |
| Commits                    | Conventional Commits em português, sem reescrever o histórico publicado | ✅ Adotado daqui em diante |
| Staging online com seed    | Útil como complemento, não exigido pela aula          | 🔄 Compose e deploy prontos; falta publicar na VPS e decidir o acesso do avaliador |
| Flag de funcionalidade     | Variável de ambiente em vez de Unleash/GrowthBook     | ✅ [ADR 0002](adr/0002-flags-por-ambiente-e-staging-na-vps.md) |
| Banco do staging           | Postgres próprio com dados simulados, em vez de cópia da produção | ✅ [ADR 0002](adr/0002-flags-por-ambiente-e-staging-na-vps.md) |

## Problemas encontrados no caminho

- **typescript-eslint não suporta o TypeScript 7** do projeto. A solução foi seguir a orientação oficial da Microsoft: TS 6 lado a lado (`typescript` → `@typescript/typescript6`, `@typescript/native` → TS 7).
- **O compose local herdava o `.env` de produção** (o Docker Compose interpola o `.env` da raiz), e a sessão era recusada. A correção foram variáveis `LOCAL_*` próprias.
- **A reversão do passo 2 ficou incompleta**: uma instalação interrompida terminou depois e alterou `package.json` e `pnpm-lock.yaml`. A IA detectou, avisou e restaurou os arquivos.

## O que é meu e consigo explicar

O sistema anterior à adaptação (coleta por engenharia reversa, regras de alerta, dashboard, WhatsApp, MCP/OAuth, deploy) e cada decisão da tabela acima. O código da adaptação foi revisado módulo a módulo. As justificativas técnicas estão no [ADR](adr/0001-nucleo-de-dominio-puro.md), no [desempenho.md](desempenho.md) e nos comentários do código.
