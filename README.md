# sol-planet

Monitoramento das placas solares via API cloud do app **Solplanet** (engenharia reversa do APK 5.2.1): dashboard web + alertas e relatório diário no WhatsApp.

```
apps/web           Next.js 16 — dashboard (design do Stitch em design/stitch_solar_monitoring_app_ui)
apps/worker        coleta a cada N min → Postgres → alertas/relatório no WhatsApp
packages/solplanet cliente da API (assinatura Alibaba API Gateway)
packages/db        schema Drizzle + migrações (rodam no boot do worker) + configurações
packages/whatsapp  cliente da Evolution API
docker-compose.yml web + worker + Evolution API (WhatsApp), usando o Postgres existente
```

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

## Desenvolvimento local

```bash
pnpm install
cp .env.example .env                    # DATABASE_URL apontando para um Postgres local
pnpm --filter @sol/worker seed:demo     # dados simulados para o dashboard
pnpm dev:web                            # http://localhost:3000
pnpm dev:worker                         # coleta real (precisa do login Solplanet)
pnpm typecheck
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
