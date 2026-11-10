# Uso de IA

**Ferramenta:** Claude Code (Anthropic), no VS Code.
**Quando:** adaptação do projeto à Proposta B, em 07/11/2026, na branch `projeto-final-gt4`; ajustes posteriores a partir de 10/11/2026 (seção "Ajustes após a primeira entrega").
**Como trabalhei:** a IA levanta o contexto, propõe e executa; **as decisões são minhas**. Depois do primeiro passo, nenhuma alteração entrou sem plano aprovado, e cada módulo (M1 a M4) virou um commit separado para revisão.

> Os prompts abaixo foram **resumidos, revisados e reescritos para ficar claros e completos** (objetivo, restrições e critério de pronto), e não são transcrições literais da conversa. A ordem, a intenção e as decisões são as que aconteceram.

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

Depois da primeira entrega, o projeto ganhou práticas que o escopo reserva ao nível A, mantendo a entrega como **nível B**. O README diz quais itens do A entraram e quais não.

### 9. Pedido dos ajustes e plano

**Prompt:** "Quero aproximar o projeto de práticas do nível A, mantendo a entrega como Proposta B. Itens: (1) ambientes de staging e produção; (2) feature flag e estratégia de deploy; (3) ADR com a alternativa descartada; (4) diagramas C4 de contexto e de contêiner em Mermaid; (5) README documentando com clareza quais recursos do A foram incorporados ao B; (6) commits semânticos; (7) deixar o projeto online para avaliação; (8) bloquear push na `main`; (9) proteger a branch; (10) validar o `.env.example`. Antes de alterar qualquer coisa, explique o que muda em cada item e como pretende fazer, já seguindo commits semânticos. Em anexo, as diretrizes do projeto final."

**Resultado:** a IA analisou o repositório e comparou com as diretrizes, sem alterar nada. Entregou um plano item a item, com a ordem dos commits e três perguntas em aberto (fluxo de branch, acesso do avaliador e subdomínio de staging). Três observações moldaram o resto do trabalho:

- Quase tudo na lista é requisito do **nível A**, então o README precisa dizer "B com itens do A", sem fingir que é A completo.
- O ADR 0001 já tinha alternativas descartadas. O ADR novo (0002) cobriria as decisões desta etapa.
- A `main` estava sem proteção, e o histórico antigo não segue commits semânticos. O padrão vale daqui em diante, **sem reescrever** commits já publicados.

### 10. Registro neste documento e dúvida sobre o staging online

**Prompt:** "Registre estas interações no `docs/ia.md`, no mesmo padrão das anteriores, para o documento continuar coerente. Outra questão: a diretriz não exige ambiente de produção online para a avaliação. Um staging com banco populado sinteticamente agregaria algo à avaliação?"

**Resultado:** as interações foram registradas aqui. Sobre o staging, a IA respondeu que **vale como complemento, não como exigência**: o caminho garantido continua sendo o compose local. O staging deixa o avaliador ver o dashboard sem conta Solplanet, cumpre o item "dois ambientes" e permite medir o p95 fora da máquina de desenvolvimento. O risco, expor um serviço público, é pequeno, porque os dados seriam fictícios.

### 11. Execução dos itens independentes

**Prompt:** "Plano aprovado. Execute os itens que não dependem das minhas respostas, com um commit semântico por item, validando cada um (lint, tipos e testes) antes de commitar."

**Resultado:** seis commits: validação do `.env.example` na CI (achou 3 variáveis que o código lia e o exemplo não documentava), diagramas C4, feature flag `FEATURE_MCP`, compose de staging, deploy em dois ambientes e ADR 0002 com `docs/deploy.md`, mais o README com os itens do A.

**Erro pego pela verificação:** ao subir o staging localmente, o `next build` falhou por um erro de tipo que a própria IA tinha introduzido em `nav.tsx` e que o `pnpm typecheck` da raiz não cobre. Teria derrubado o próximo deploy. Foi corrigido no mesmo commit, ainda não publicado, e a flag foi testada de ponta a ponta (ligada: `/mcp` responde 401; desligada: `/mcp`, `/oauth/token` e `/conectar-ia` respondem 404 e `/api/health` segue 200).

### 12. Proteções do repositório

**Prompt:** "Vamos resolver os itens pendentes um por um, começando pela proteção da `main` e pelos Environments de staging e produção, com a regra de que ninguém faça push direto na `main`."

**Resultado:** a IA verificou o que o GitHub aceita antes de configurar, em vez de presumir:

- Environment `staging`: criado.
- Aprovador obrigatório em `production`: **o GitHub recusou** (erro 422), porque exige plano pago em repositório privado. Das três alternativas apresentadas, a decisão foi **produção só por acionamento manual**, a partir da `main`, com o mesmo botão servindo de rollback.
- Proteção da `main`: a API aceitou a regra, mas a IA desconfiou de que o plano gratuito pudesse aceitá-la sem aplicá-la. Provou com uma branch descartável (o GitHub recusou a exclusão) e removeu o teste depois. A regra final não tem exceção, nem para o dono, e o push direto na `main` foi recusado em teste.

### 13. Dúvida: dá para rodar todos os testes contra o projeto online?

**Prompt:** "Todos os testes do projeto podem ser executados contra o ambiente online?"

**Resultado:** não todos. Os unitários e as análises estáticas rodam no código, não na rede. O **teste de integração apaga dados do banco e nunca deve** apontar para staging ou produção. Só o **k6** aceita uma URL e pode medir o staging. A IA recomendou nunca rodar o k6 em produção e ofereceu um passo de k6 no deploy do staging, ainda **não implementado** (decisão adiada).

### 14. CI granular, no modelo de outro projeto

**Prompt:** "Quero que o CI siga a seguinte organização: jobs separados e granulares, com ações reutilizáveis."

**Resultado:** a IA leu o `.github` do outro projeto e aplicou o que ele tem de granular: jobs em paralelo por responsabilidade, um job `gates` como único check obrigatório da `main`, composite actions locais e permissões mínimas. O `ci.yml` virou seis jobs (`lint`, `tipos`, `build`, `contratos`, `testes`, `segredos`) mais o `gates`. O passo comum e o deploy viraram as actions `preparar` e `deploy-vps`. Entrou também um job de **build do Next**, que não existia e que teria pego o erro da entrada 11. A regra da `main` passou a exigir só o `gates`.

**Escolha da IA, a rever se quiser:** o CI deixou de rodar em todo push e passou a rodar em PR para a `main`, push na `main` e acionamento manual, como no outro projeto.

### 16. Publicação da branch e abertura do PR

**Prompt:** "Siga para a etapa de publicação: envie a branch `projeto-final-gt4` e abra o pull request para a `main`, mantendo o registro desta etapa no `docs/ia.md` no mesmo padrão. Não faça o merge: o deploy do staging depende da VPS, que ainda não está preparada."

**Resultado:** a IA conferiu o estado local antes de publicar (12 commits à frente da origem e um ajuste de redação seu não commitado no `ia.md`, que entrou como commit próprio, sem alterar o conteúdo). Enviou a branch e abriu o **PR #1** com descrição em duas partes (adaptação à Proposta B e ajustes desta rodada), instruções de teste e um aviso sobre o efeito do merge. Foi a primeira execução real da CI nova: **os 7 checks passaram** (`lint`, `tipos`, `build`, `contratos`, `testes`, `segredos` e `gates`), então as composite actions funcionaram como previsto. O PR ficou aberto e **sem merge**, de propósito.

**Decisão sua mantida:** o merge só acontece depois de preparar a VPS (item 3), porque o push na `main` implanta o staging.

### 17. Proxy reverso do staging (item 3)

**Prompt:** "Meu proxy reverso é o Nginx Proxy Manager e eu sigo o padrão nome do contêiner + porta (por exemplo, `solar-web:3000`). Quero manter esse padrão no staging."

**Resultado:** a IA identificou, pela imagem, que o NPM alcança o contêiner pela **rede Docker**, e não pela porta do host, e que o compose de staging não tinha nada disso. Ajustou o `docker-compose.staging.yml`: nome fixo `solar-staging-web`, entrada do `web` na rede externa do proxy (`PROXY_NETWORK`) e porta do host apenas em `127.0.0.1`, para o health do deploy. O Postgres do staging continua só na rede do próprio compose.

**Validação:** simulando o NPM com uma rede compartilhada de teste, `http://solar-staging-web:3000/api/health` respondeu 200 e o Postgres do staging ficou inalcançável por ela. A rede e os contêineres do teste foram removidos.

**Premissa a confirmar na VPS:** o nome padrão da rede é `wp-network`, tirado do `.env.example`. O `docs/deploy.md` traz o comando para conferir o nome real.

### 18. Merge, verificação do staging e acesso do avaliador

**Prompt:** "O proxy host do staging está pronto. Faça o merge do PR, acompanhe o deploy e confirme se o staging responde. Depois resolva o acesso do avaliador: ele precisa conseguir entrar e ver o dashboard com os dados simulados."

**Resultado:**

- **Merge.** A IA tentou mesclar pela linha de comando, e o Claude Code bloqueou a ação por ser uma publicação na `main` sem revisão. A IA não contornou o bloqueio e devolveu a decisão: o merge foi feito por você, na interface do GitHub, com *merge commit* para preservar os commits semânticos.
- **Deploy.** O staging subiu com sucesso, e a produção ficou `skipped`, como projetado. Pela URL pública: `/api/health` responde 200 com HTTPS, `/api/metrics` responde 200, as rotas protegidas redirecionam ao login ou respondem 401 e o `/mcp` responde 401. A produção continua na versão anterior, sem tocar.
- **Acesso do avaliador.** A IA propôs criar uma nova flag de login demo, e você aprovou. Antes de escrever código, ela leu o fluxo de login e percebeu que ele **já aceita** uma conta conhecida com a senha guardada, sem chamar a Solplanet. Provou isso com um navegador real, no compose local e no staging público: `demo@solar.local` / `demo-sem-coleta` chega ao dashboard, e senha errada volta ao login com erro. **Nenhum código foi necessário**; o que estava errado era o README, que afirmava o contrário, e foi corrigido. A flag e o ADR 0003 propostos foram descartados por desnecessários.
- **Defeito encontrado no teste.** Na subida do zero (volume novo), o `seed` falhou uma vez com `ECONNREFUSED`: o `pg_isready` passava enquanto o Postgres ainda inicializava num servidor temporário. O mesmo healthcheck existia no `docker-compose.local.yml`, o caminho do avaliador. Foi corrigido nos dois compose, usando TCP (`-h 127.0.0.1`), e validado com 4 subidas do zero seguidas.

### 19. Teste de desempenho no deploy do staging

**Prompt:** "Retome o passo de k6 no deploy do staging: depois de cada deploy, rodar o smoke test contra a URL pública e registrar o p95 medido pela rede."

**Resultado:** a IA implementou um job `desempenho` em `deploy.yml`, que roda o `k6/smoke.js` na URL pública do staging depois do deploy, escreve o p95, a mediana, o p99 e os checks no resumo da execução e o job fica vermelho se o SLO não for cumprido, mas não bloqueia nada, já que a produção é manual. Para o k6 assinar a sessão demo, o deploy passou a gravar no `.env` do staging um `AUTH_SECRET` vindo de um secret do GitHub (`STAGING_AUTH_SECRET`). Sem o secret, o job avisa e é pulado, então o merge não quebra o deploy. O formato do resumo do k6 e o trecho que o formata foram testados localmente.

**Limite encontrado:** a IA tentou criar o secret pelo `gh`, e o Claude Code bloqueou a escrita de credencial no repositório. Ela não contornou e devolveu o passo: **você cria o secret** em Settings → Environments → staging. Depois que você criou o secret, a IA acionou o deploy do staging a partir da branch do PR para provar o job antes do merge. O k6 passou (**p95 de 240,8 ms** pela rede, 0% de erro, 258/258 checks; numa 2ª execução, após a correção, deu 189,0 ms), e o resultado está em `docs/desempenho.md`. Mas o job ficou **vermelho** por um passo supérfluo da própria IA, o upload do resumo como artefato, que bateu na cota de armazenamento do GitHub Actions da conta. O passo foi removido.

**Correção do PR:** você apontou um erro no texto do PR, que tinha o título "Antes do merge" (parecendo obrigatório) e dizia "nada quebra sem o secret", duas coisas contraditórias. Além disso, o "nada quebra" nunca tinha sido testado. A descrição foi reescrita só com o que foi verificado.

### 20. Swagger e verificação da API no staging

**Prompt:** "Quais rotas de teste já conseguimos entregar direto no staging, incluindo o Swagger? Você faria só o Swagger? Os outros testes ficaram de fora?"

**Resultado:** antes de responder, a IA testou cada rota do contrato no staging real, inclusive as que exigem login (entrando com a conta demo num navegador automatizado). Mostrou o que já funcionava, o que não era útil para avaliar (`/api/whatsapp/groups` devolve `[]`, sem Evolution) e a lacuna: **não havia Swagger no staging**. Você perguntou se ela faria só o Swagger. A resposta foi não, e o pedido ganhou três partes:

- **Swagger UI em `/docs`**, com a flag `FEATURE_DOCS` (desligada por padrão, ligada só no staging) e o contrato servido com a origem da requisição como primeiro servidor, para o *Try it out* chamar o próprio ambiente com o cookie do login. Verificado em navegador real: login demo, abrir `/docs`, executar o resumo, resposta 200 com a usina demo. Com a flag desligada, `/docs` responde 404.
- **`scripts/smoke-api.mjs`**: 11 verificações (saúde, métricas, 401 sem login, resumo 200, 404, 400 e o Swagger) que só fazem chamadas sem gravar dados. Roda no deploy do staging, antes do k6, e na máquina do avaliador. Testado no staging real (11 de 11) e com credencial ausente (as 5 que exigem login ficam "puladas") e ambiente fora do ar (sai com erro). Um teste unitário garante que a sessão que o script assina é aceita pelo `readSession` real do app.
- **Guia "Como testar o staging"** em `docs/deploy.md`, com cada rota e o resultado esperado.

**Defeitos encontrados só porque a imagem foi construída e testada de verdade:** (1) o `.dockerignore` excluía a pasta `docs` inteira, então o contrato não entrava na imagem e o deploy do staging teria falhado; (2) o contrato declarava só `http://localhost:3000` como servidor, e o *Try it out* iria para o endereço errado. Ambos foram corrigidos antes do PR.

## Sugestões da IA × decisões

| Tema                             | Sugestão da IA                                                                                                   | Decisão                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint principal               | `/api/health` no primeiro rascunho                                                                              | ❌ Trocado por `GET /api/usinas/{id}/resumo` (domínio real)                                                                                       |
| O que documentar                 | Só o escopo B                                                                                                    | ❌ **Documentar tudo** e marcar o que é extra                                                                                                 |
| Ferramentas de teste             | `node:test` nativo                                                                                              | ❌ **Vitest + Supertest**, como o escopo sugere                                                                                                |
| Cobertura mínima                | 80% de linhas                                                                                                     | ✅ Aceito depois de confirmar a viabilidade                                                                                                          |
| Compose de um comando            | Profile no compose de produção                                                                                  | 🔄 Arquivo separado (`docker-compose.local.yml`), para não arriscar o deploy da VPS                                                               |
| Gitleaks                         | Três alternativas                                                                                                | ✅ Allowlist justificada                                                                                                                             |
| Padrão do M1                    | Núcleo de domínio puro com E/S na borda                                                                         | ✅ [ADR 0001](adr/0001-nucleo-de-dominio-puro.md), com a hexagonal completa descartada                                                                |
| Rodadas ao banco no resumo       | Juntar `canSeePlant` e `plants` num `join`                                                                  | ⏸️ Próximo passo: o SLO já está atendido com folga                                                                                              |
| Autenticação da API            | Bearer via OAuth já existente, para clientes externos                                                            | ⏸️ Mantido o cookie nesta entrega, com o Bearer registrado como evolução                                                                         |
| Publicação                     | PR para a `main`, sem merge até a VPS estar pronta                                                             | ✅ PR #1 aberto, CI verde                                                                                                                            |
| Proxy do staging                 | Mesmo padrão da produção (nome do contêiner + porta, pela rede do NPM)                                        | ✅ Compose ajustado e testado; rede `wp-network` ainda a confirmar na VPS                                                                          |
| Acesso do avaliador | Nova flag `FEATURE_DEMO_LOGIN` (login demo só no staging) | ❌ Descartada por desnecessária: o login já aceita a conta demo (provado em teste); só o README estava errado |
| Healthcheck do Postgres | `pg_isready` por socket | 🔄 Trocado por TCP nos dois compose, após o seed falhar na 1ª subida |
| k6 no deploy do staging | Job `desempenho` com o secret `STAGING_AUTH_SECRET` | ✅ Secret criado por você, execução real provada: p95 de 240,8 ms pela rede (SLO < 300 ms) |
| Swagger no staging | Rota `/docs` com `FEATURE_DOCS` (em vez de um contêiner swagger-ui com outro subdomínio) | ✅ Aprovado por você; mesma origem, então o *Try it out* envia o cookie |
| Escopo dos testes no staging | Swagger + verificação automática da API + guia, e não só o Swagger | ✅ Aprovado por você |
| Estrutura do CI                  | Jobs paralelos + `gates` + composite actions, como no medguia                                                   | ✅ Aplicado                                                                                                                                          |
| Aprovação da produção        | Aprovador obrigatório no Environment `production`                                                              | 🔄 O GitHub recusou (422): exige plano pago em repositório privado. **Decisão:** produção só por acionamento manual, a partir da `main` |
| Bypass na proteção da `main` | Sem exceção, nem para o admin                                                                                   | ✅ Aceito                                                                                                                                            |
| Ajustes pós-entrega             | Plano em 7 passos, começando por `.env.example`, C4, flag e ADR 0002, com a proteção da `main` por último | ✅ Aprovado ("vamos lá"); itens 1 a 5 executados, restam proteção da `main` e staging online                                                    |
| Commits                          | Conventional Commits em português, sem reescrever o histórico publicado                                         | ✅ Adotado daqui em diante                                                                                                                           |
| Staging online com seed          | Útil como complemento, não exigido pela aula                                                                    | 🔄 Compose e deploy prontos; falta publicar na VPS e decidir o acesso do avaliador                                                                   |
| Flag de funcionalidade           | Variável de ambiente em vez de Unleash/GrowthBook                                                                | ✅ [ADR 0002](adr/0002-flags-por-ambiente-e-staging-na-vps.md)                                                                                        |
| Banco do staging                 | Postgres próprio com dados simulados, em vez de cópia da produção                                             | ✅ [ADR 0002](adr/0002-flags-por-ambiente-e-staging-na-vps.md)                                                                                        |

## Problemas encontrados no caminho

- **typescript-eslint não suporta o TypeScript 7** do projeto. A solução foi seguir a orientação oficial da Microsoft: TS 6 lado a lado (`typescript` → `@typescript/typescript6`, `@typescript/native` → TS 7).
- **O compose local herdava o `.env` de produção** (o Docker Compose interpola o `.env` da raiz), e a sessão era recusada. A correção foram variáveis `LOCAL_*` próprias.
- **A reversão do passo 2 ficou incompleta**: uma instalação interrompida terminou depois e alterou `package.json` e `pnpm-lock.yaml`. A IA detectou, avisou e restaurou os arquivos.

## O que é meu e consigo explicar

O sistema anterior à adaptação (coleta por engenharia reversa, regras de alerta, dashboard, WhatsApp, MCP/OAuth, deploy) e cada decisão da tabela acima. O código da adaptação foi revisado módulo a módulo. As justificativas técnicas estão no [ADR](adr/0001-nucleo-de-dominio-puro.md), no [desempenho.md](desempenho.md) e nos comentários do código.
