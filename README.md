**Nível: B, com itens do A** · Projeto Final — Geração Tech 4.0 · Full Cycle (Módulo 4)

# sol-planet

[![CI](https://github.com/ranieryfialho/sol-planet/actions/workflows/ci.yml/badge.svg?branch=projeto-final-gt4)](https://github.com/ranieryfialho/sol-planet/actions/workflows/ci.yml)

Monitoramento das placas solares via API cloud do app **Solplanet** (engenharia reversa do APK 5.2.1): API REST, dashboard web e alertas e relatório diário no WhatsApp.

> **Sobre esta entrega.** O sol-planet já estava em desenvolvimento antes do projeto final: é um sistema real, em produção, que monitora a usina solar de casa. Para a entrega, ele foi **adaptado para ficar de acordo e alinhado com o padrão de mercado proposto na Geração Tech 4.0** (Proposta B): API REST com contrato OpenAPI, testes com cobertura mínima, CI, logs estruturados, métrica, SLO, ADR e teste de carga com k6. Nada do que já existia foi escondido: a tabela abaixo aponta a evidência de cada item avaliado, e o que vai além do escopo B está marcado como tal.

**Domínio:** monitoramento de geração solar e alertas.
**Fluxo principal (ponta a ponta):** coleta da usina → leituras no Postgres → regras de alerta → `GET /api/usinas/{id}/resumo`.

## Como rodar (um comando)

Pré-requisito: Docker. Não precisa de conta Solplanet nem de `.env`.

```bash
docker compose -f docker-compose.local.yml up --build
```

Sobe o **Postgres**, roda o **seed** (aplica as migrações e simula a coleta: usina demo `999001`, 400 dias de histórico e alertas) e sobe o **web** em http://localhost:3000.

```bash
curl http://localhost:3000/api/health     # {"status":"ok","banco":"ok",...}
curl http://localhost:3000/api/metrics    # formato Prometheus
```

Os endpoints de domínio exigem a sessão do dashboard (cookie `solar_session`). Para gerar a sessão da conta demo:

```bash
# Git Bash / Linux / macOS
pnpm install
T=$(pnpm --silent demo:session)     # cookie da conta demo (AUTH_SECRET do compose local)
curl -b "solar_session=$T" http://localhost:3000/api/usinas/999001/resumo
curl -b "solar_session=$T" "http://localhost:3000/api/alertas?tipo=offline&limite=5"
```

```powershell
# PowerShell (Windows): use curl.exe; "curl" sozinho é apelido do Invoke-WebRequest
pnpm install
$T = pnpm --silent demo:session
curl.exe -b "solar_session=$T" http://localhost:3000/api/usinas/999001/resumo
curl.exe -b "solar_session=$T" "http://localhost:3000/api/alertas?tipo=offline&limite=5"
```

O contrato completo está em [docs/openapi.yaml](docs/openapi.yaml). Para visualizar, abra o arquivo no [Swagger Editor](https://editor.swagger.io).

### Conta demo

O seed cria uma conta e uma usina simuladas (ver [apps/worker/src/seed-demo.ts](apps/worker/src/seed-demo.ts)):

| Item | Valor |
|---|---|
| Login | `demo@solar.local` |
| Senha | `demo-sem-coleta` |
| Id da conta | `1` |
| Id da usina | `999001` ("Minha Casa", 5,5 kWp) |
| `AUTH_SECRET` do compose local | `dev-local-troque-em-producao` (só desenvolvimento) |

**A senha não entra na tela de login.** O login do dashboard confere as credenciais na API real da Solplanet ou da Livoltek, e a conta demo não existe lá; a senha só preenche o campo obrigatório da tabela de contas. A conta demo é usada de duas formas:

1. **Pela API**: com o cookie gerado por `pnpm demo:session`, como nos `curl` acima. O teste de carga (`k6/smoke.js`) faz o mesmo.
2. **No dashboard, pelo navegador**: o proxy só confere a assinatura do cookie, então basta gravá-lo à mão:
   1. Rode `pnpm demo:session` e copie o valor impresso.
   2. Abra http://localhost:3000, aperte F12 e vá em Application (Chrome) ou Storage (Firefox), depois Cookies.
   3. Crie o cookie `solar_session` com esse valor (path `/`) e recarregue a página. O dashboard abre com a usina demo.

O cookie vale 30 dias e só funciona com o `AUTH_SECRET` do ambiente que o gerou. Em produção o `AUTH_SECRET` vem do `.env` da VPS, e a conta demo não existe lá.

## Como testar

```bash
pnpm install
pnpm lint             # ESLint
pnpm typecheck        # TypeScript em todos os pacotes
pnpm lint:openapi     # Spectral no docs/openapi.yaml
pnpm test             # unitários (a integração é pulada sem banco)

# integração + cobertura mínima (usa o Postgres do compose local, banco solar_test)
docker compose -f docker-compose.local.yml up -d postgres
TEST_DATABASE_URL=postgres://solar:solar@localhost:5432/solar_test pnpm test:coverage   # Git Bash

# smoke test k6 (com o compose local no ar; a 1ª execução baixa a imagem)
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -e BASE_URL=http://host.docker.internal:3000 grafana/k6:1.3.0 run - < k6/smoke.js     # Git Bash
```

No **PowerShell**, a variável de ambiente e o redirecionamento de arquivo têm outra sintaxe:

```powershell
# integração + cobertura (a variável vale só para esta janela do terminal)
$env:TEST_DATABASE_URL = "postgres://solar:solar@localhost:5432/solar_test"
pnpm test:coverage
Remove-Item Env:TEST_DATABASE_URL     # volta ao modo sem banco

# smoke test k6
Get-Content k6/smoke.js | docker run --rm -i --add-host=host.docker.internal:host-gateway -e BASE_URL=http://host.docker.internal:3000 grafana/k6:1.3.0 run -
```

**Cobertura mínima declarada** (em [vitest.config.mts](vitest.config.mts), cobrada na CI): **80%** de linhas, funções e statements e **70%** de branches, medida no código de domínio e da API. Último resultado: cerca de 90% de linhas e de funções, 88% de statements e acima de 85% de branches (os números variam um pouco entre execuções).

### Ver os resultados visualmente

| O quê | Para que serve |
|---|---|
| Relatório de cobertura | Cobertura por pasta e por arquivo; ao abrir um arquivo, as linhas cobertas ficam verdes e as não cobertas vermelhas |
| Interface do Vitest | Árvore de testes no navegador, com resultado e duração de cada um |
| Swagger UI | Contrato da API navegável (`docs/openapi.yaml`) |
| Dashboard do k6 | Gráficos de latência e de requisições por segundo durante o smoke test |

**1. Cobertura** (gerada por `pnpm test:coverage`, em `coverage/index.html`):

```bash
start coverage/index.html     # Git Bash ou PowerShell; no macOS: open coverage/index.html
```

**2. Interface do Vitest** (precisa do Postgres do compose no ar; fica em modo observação, encerre com Ctrl+C):

```bash
# Git Bash
export TEST_DATABASE_URL=postgres://solar:solar@localhost:5432/solar_test
pnpm test:ui
```

```powershell
# PowerShell
$env:TEST_DATABASE_URL = "postgres://solar:solar@localhost:5432/solar_test"
pnpm test:ui
```

O navegador abre sozinho. Se não abrir, use o endereço `http://localhost:51204/__vitest__/?token=...` que o terminal imprime (o token muda a cada execução).

**3. Swagger UI** em http://localhost:8081. Para chamar a API pela tela (*Try it out*), grave antes o cookie `solar_session` no navegador (ver [Conta demo](#conta-demo)):

```bash
# Git Bash: sem o MSYS_NO_PATHCONV o caminho /spec vira C:/Program Files/Git/spec e o Swagger abre o exemplo "petstore"
MSYS_NO_PATHCONV=1 docker run --rm -p 8081:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v "${PWD}/docs:/spec" swaggerapi/swagger-ui
```

```powershell
# PowerShell
docker run --rm -p 8081:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v "${PWD}/docs:/spec" swaggerapi/swagger-ui
```

**4. Dashboard do k6** em http://localhost:5665 durante os 30 s do teste (com o compose local no ar). Se a porta 5665 estiver ocupada por uma execução anterior, o `docker run` falha com "port is already allocated": veja com `docker ps` e encerre com `docker stop <nome>`.

```bash
# Git Bash
MSYS_NO_PATHCONV=1 docker run --rm -i -p 5665:5665 -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_HOST=0.0.0.0 \
  --add-host=host.docker.internal:host-gateway -e BASE_URL=http://host.docker.internal:3000 grafana/k6:1.3.0 run - < k6/smoke.js
```

```powershell
# PowerShell
Get-Content k6/smoke.js | docker run --rm -i -p 5665:5665 -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_HOST=0.0.0.0 --add-host=host.docker.internal:host-gateway -e BASE_URL=http://host.docker.internal:3000 grafana/k6:1.3.0 run -
```

## Conformidade com a Proposta B

| Módulo | Requisito | Evidência |
|---|---|---|
| M1 | Compose sobe com um comando | [docker-compose.local.yml](docker-compose.local.yml): `docker compose -f docker-compose.local.yml up --build` |
| M1 | SOLID | Regras puras em [apps/worker/src/domain.ts](apps/worker/src/domain.ts) separadas da busca e do envio ([rules.ts](apps/worker/src/rules.ts)). API em camadas: [handlers](apps/web/lib/api/handlers.ts) (HTTP), [repository](apps/web/lib/api/repository.ts) (banco, injetado por parâmetro) e [summary](apps/web/lib/api/summary.ts) (cálculo puro). Novas regras entram na lista de `runRules` sem mexer nas outras. |
| M1 | Um padrão justificado | Núcleo de domínio puro com E/S na borda (*functional core, imperative shell*): [ADR 0001](docs/adr/0001-nucleo-de-dominio-puro.md) |
| M2 | Testes unitários do domínio | [tests/domain.test.ts](tests/domain.test.ts), [tests/summary.test.ts](tests/summary.test.ts), [tests/rollover.test.ts](tests/rollover.test.ts), além de sessão, contas e WhatsApp (Vitest) |
| M2 | Um teste de integração | [tests/api.int.test.ts](tests/api.int.test.ts): rotas reais do Next + Postgres real + Supertest |
| M2 | Cobertura mínima declarada e cumprida | `thresholds` em [vitest.config.mts](vitest.config.mts). A CI falha abaixo do mínimo. |
| M3 | CI verde com install, lint e test | [.github/workflows/ci.yml](.github/workflows/ci.yml): install, lint, typecheck, Spectral, testes com cobertura e gitleaks |
| M3 | `.env.example` no repo, segredos fora | [.env.example](.env.example) sem valores reais e validado contra o código na CI (`pnpm lint:env`), `.env` no [.gitignore](.gitignore), gitleaks no histórico completo na CI (ver [Segredos](#segredos)) |
| M3 | Logs estruturados | pino em JSON, uma linha por requisição e por evento do worker: [packages/observability](packages/observability/src/index.ts) |
| M3 | Uma métrica | `http_request_duration_seconds` (histograma por rota e status) em `GET /api/metrics` |
| M3 | Um SLO simples | p95 < 300 ms e menos de 1% de erro em `/api/usinas/{id}/resumo`: [docs/desempenho.md](docs/desempenho.md) |
| M4 | README desde o início + um ADR | Este README e o [ADR 0001](docs/adr/0001-nucleo-de-dominio-puro.md) (MADR) |
| M4 | OpenAPI do endpoint principal | [docs/openapi.yaml](docs/openapi.yaml) (OpenAPI 3.1, todas as rotas, lint com Spectral na CI) |
| M4 | Smoke k6 com p95 medido | [k6/smoke.js](k6/smoke.js). Resultado: **p95 = 24,14 ms**, 0% de erro ([docs/desempenho.md](docs/desempenho.md)) |
| Entrega | `CONTRIBUTORS.md` e uso de IA | [CONTRIBUTORS.md](CONTRIBUTORS.md), [docs/ia.md](docs/ia.md) |

**Além do escopo B** (já existia antes da adaptação e não faz parte do que é avaliado): dashboard com cena 3D, alertas e relatórios no WhatsApp (Evolution API), servidor MCP com OAuth 2.1 para apps de IA, coletor Livoltek e deploy contínuo na VPS ([deploy.yml](.github/workflows/deploy.yml)).

## Itens do Nível A incorporados

O projeto é entregue no **Nível B** (API de um domínio, um fluxo central completo). Por já ser um sistema em produção, alguns requisitos que o escopo reserva ao **Nível A** foram adicionados. A tabela diz o que entrou e o que **não** entrou, para a avaliação não confundir um com o outro.

| Origem (nível A) | O que foi feito | Evidência |
|---|---|---|
| M3: dois ambientes, configuração por ambiente, segredos fora do código | Staging (dados simulados) e produção, com `.env` por ambiente e *secrets* no GitHub Environments | [docker-compose.staging.yml](docker-compose.staging.yml), [deploy.yml](.github/workflows/deploy.yml), [docs/deploy.md](docs/deploy.md) |
| M3: *feature flag* e estratégia de implantação | Flag `FEATURE_MCP` por variável de ambiente; staging automático, produção por acionamento manual, verificação de saúde e rollback | [apps/web/lib/flags.ts](apps/web/lib/flags.ts), [tests/flags.test.ts](tests/flags.test.ts), [docs/deploy.md](docs/deploy.md) |
| M4: ADR com a opção preterida | ADR 0002 (flag por env em vez de Unleash/GrowthBook; staging autocontido em vez de cópia da produção). O ADR 0001 também lista as opções descartadas | [ADR 0002](docs/adr/0002-flags-por-ambiente-e-staging-na-vps.md) |
| M4: modelos C4 de contexto e de contêiner | Dois diagramas em Mermaid | [docs/c4/contexto.md](docs/c4/contexto.md), [docs/c4/containers.md](docs/c4/containers.md) |

Além do escopo, e fora das duas propostas: validação automática do `.env.example` contra o código na CI (`pnpm lint:env`), commits semânticos e proteção da branch `main` (ver [Contribuindo](#contribuindo)).

**Não implementado do nível A** (continua só no B): monólito modular com módulos catálogo/pedidos/pagamentos e 100 mil registros sintéticos, testes de contrato (Pact) e Testcontainers, métricas RED completas com Prometheus/Grafana, rastreamento com OpenTelemetry/Jaeger, cache com tolerância a falhas e fila idempotente, e o k6 em três estágios com comparação antes/depois. O smoke test com p95 medido ([docs/desempenho.md](docs/desempenho.md)) é o do B.

## Contribuindo

- **Commits semânticos** ([Conventional Commits](https://www.conventionalcommits.org/pt-br/)): `tipo(escopo): descrição no imperativo`, em português. Tipos usados: `feat`, `fix`, `docs`, `test`, `ci`, `build`, `chore`, `refactor`. Exemplo: `feat(web): feature flag FEATURE_MCP para o servidor MCP`. O histórico anterior à adaptação não segue o padrão e não foi reescrito.
- **Branch `main` protegida**: sem push direto, só pull request com os checks da CI verdes. Como o deploy dispara na `main`, só código revisado chega aos ambientes.

## Segredos

- Configuração só por ambiente: `.env` local ou na VPS, fora do git. O [.env.example](.env.example) lista as variáveis sem valores reais.
- O `docker-compose.local.yml` usa um `AUTH_SECRET` de desenvolvimento e variáveis `LOCAL_*` próprias, para não herdar o `.env` de produção.
- A CI roda o **gitleaks** no histórico completo. Ele aponta como suspeitos a `appKey` e o `appSecret` do app Solplanet em [packages/solplanet/src/index.ts](packages/solplanet/src/index.ts). São identificadores **públicos do APK**, iguais em qualquer celular que instala o app, e não credenciais deste projeto. Por isso estão na allowlist [.gitleaksignore](.gitleaksignore), com essa justificativa. Credenciais de usuário (login Solplanet) ficam cifradas com AES-256-GCM no banco.

## Estrutura

```
apps/web               Next.js 16: dashboard + API REST (app/api) + MCP/OAuth
apps/worker            coleta a cada N min → Postgres → regras de alerta → WhatsApp
packages/db            schema Drizzle + migrações + contas e configurações
packages/observability logs (pino), métrica (prom-client) e health
packages/solplanet     cliente da API Solplanet (assinatura Alibaba API Gateway)
packages/livoltek      cliente da API Livoltek
packages/whatsapp      cliente da Evolution API
docs/                  openapi.yaml, adr/, c4/, deploy.md, desempenho.md, ia.md
k6/                    smoke test
tests/                 Vitest (unitários + integração)
docker-compose.local.yml  avaliação/local: um comando, sem credenciais
docker-compose.yml        produção na VPS (Postgres existente)
docker-compose.staging.yml  staging: Postgres próprio e dados simulados
```

---

*As seções abaixo documentam o sistema completo, como já existia antes da adaptação.*

## Telas

| Rota | Conteúdo |
|---|---|
| `/` | Início: casa com fluxo de energia (solar, inversor/bateria, consumo, rede), produção de hoje, resumo do mês com economia em R$, impacto ambiental, últimos 30 dias e eventos |
| `/historico` | Dia / Mês / Ano / Total, melhor período, média, produtividade (kWh/kWp) e comparação com o período anterior |
| `/alertas` | Status atual + linha do tempo filtrável (erros, offline, resolvidos), indicando o que foi enviado no WhatsApp |
| `/inversor` | Potência, tensão, corrente, frequência e temperatura (quando a API manda), strings PV e curva do dia |
| `/ajustes` | Pareamento do WhatsApp por QR code, destinatários, regras de alerta, horário do relatório e tarifa |

Consumo e rede só aparecem se a usina tiver medidor (`meterFlag`); bateria só com `storageFlag`. Sem medidor, a casa mostra a produção do dia e o total gerado.

## Deploy na VPS

1. **Bancos** no Postgres que já existe:
   ```bash
   docker exec -it <container-postgres> psql -U <user> -c "create database solar;" -c "create database evolution;"
   docker network ls   # anote a rede do container do postgres → PG_NETWORK
   ```
2. **Config**: copie o projeto, depois `cp .env.example .env` e preencha. O host no `DATABASE_URL` é o nome do container do Postgres.
3. **Subir**: `docker compose up -d --build`
4. **Conectar o WhatsApp** (use um chip secundário): abra o dashboard → **Ajustes** → **Conectar** e leia o QR code em WhatsApp → Aparelhos conectados.
5. **Destinatários**: em **Ajustes** → **Adicionar novo destinatário**. Com o WhatsApp conectado, aparece a lista dos seus grupos para escolher. Regras, horário do relatório e tarifa também ficam lá; o worker lê a cada ciclo.
6. **Testar**:
   ```bash
   docker compose exec worker ./node_modules/.bin/tsx src/cli.ts test     # mensagem de teste
   docker compose exec worker ./node_modules/.bin/tsx src/cli.ts dump-all # todas as respostas da API (mande para ajustar campos)
   docker compose exec worker ./node_modules/.bin/tsx src/cli.ts report   # relatório agora
   docker compose logs -f worker
   ```
7. **Dashboard**: escuta em `127.0.0.1:3000`. O login é a **mesma conta do app Solplanet** (`SOLPLANET_ACCOUNT`/`SOLPLANET_PASSWORD`); a sessão dura 30 dias. Coloque atrás do seu reverse proxy (nginx/Caddy) com HTTPS (repasse `X-Forwarded-Proto`) ou acesse por túnel SSH.

## Alertas

| Evento | Quando |
|---|---|
| 🚨 Erro / ⚠️ Alerta | status da usina 3/2, na hora |
| 🔌 Offline | status 0 por mais de N min, só dentro da janela do dia (à noite o inversor desliga) — configurável em Ajustes |
| ✅ Normalizado | volta ao normal depois de um alerta |
| 🚨 Erro do inversor | código novo em `errlistByIsno` (na 1ª execução só registra o histórico) |
| ❓ API fora | `API_FAILURE_THRESHOLD` falhas seguidas |
| ☀️ Relatório | diário no horário de Ajustes: geração, comparação com a média de 7 dias, pico, kWh/kWp e economia em R$ |

## Desenvolvimento local (sem Docker para o app)

```bash
pnpm install
cp .env.example .env                    # DATABASE_URL apontando para um Postgres local
pnpm --filter @sol/worker seed:demo     # dados simulados para o dashboard
pnpm dev:web                            # http://localhost:3000
pnpm dev:worker                         # coleta real (precisa do login Solplanet)
```

Mudou o schema (`packages/db/src/schema.ts`)? Rode `pnpm db:generate`. O worker aplica a migração no próximo boot.

## Protocolo da API (extraído do APK)

- **Host**: `aienergy-internation.aisweicloud.com` (Brasil), `aienergy-germany…` (UE), `intl.aienergy…` (CN). Fonte: `com.aiswei.common.BuildConfig`, `EnergyRepository.saveServerConfig`.
- **Assinatura**: Alibaba Cloud API Gateway, HMAC-SHA256 sobre método, headers e path com a query ordenada (`x-ca-key`, `x-ca-nonce`, `x-ca-timestamp`, `x-ca-signature`). Fonte: `common/alibaba/util/SignUtil`, `ApiRequestMaker`.
- **appKey/appSecret**: cifrados no BuildConfig com AES-128-CBC; chave e IV estão em `com.lt.library.util.AESEncrypt`.
- **Auth**: `POST /aienergy/user/login?account=&password=&isDemo=0` (senha em texto puro, form vazio `=`) devolve `token` e `userId`, enviados nos headers `token` e `userid`.
- **Unidades**: `power` em W, `etoday`/`etotal` em kWh (`ElectricPowerFormat`).
- **Status da usina**: 3 = erro, 2 = alerta (`PlantListAdapter`). 0 = offline e 1 = normal ainda precisam ser confirmados com dados reais (`cli dump`).

| Uso | Path | Params |
|---|---|---|
| Lista de usinas | `GET /aienergy/plant/plantlist/v4` | type, sortby, sort, own, page, size… |
| Detalhe da usina | `GET /aienergy/plant/detail/international/v4` | id |
| Fluxo de energia | `GET /aienergy/plant/detail/flow/v2` | id |
| Inversores | `GET /aienergy/equip/list/inverter/v3` | id |
| Detalhe do inversor | `GET /aienergy/equip/invdetail/v2` | id, isno |
| Curva do dia | `GET /aienergy/chart/hyperbola/v2` | id, isno, date |
| Erros | `GET /aienergy/plant/user/errlistByIsno` | isno, page, size |

O APK também tem comandos de controle remoto (`/aienergy/equip/remote/*`, como ligar e desligar o inversor). Eles ficaram de fora de propósito: este projeto só lê dados.
