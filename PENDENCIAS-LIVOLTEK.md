# Pendências — Livoltek

> Estado em **01/11/2026**. Integração do segundo fornecedor (app **My Livoltek 4.6.3**), no mesmo molde da Solplanet.

## Para retomar com o Claude Code

Sessão em que isso foi feito: **`fb502ef1-d9a1-40c1-b8bd-a0ef503eb3c4`**

```bash
cd "D:/Arquivos/RAFI WEB/RAFI DEV/sol-planet"
claude --resume fb502ef1-d9a1-40c1-b8bd-a0ef503eb3c4
```

Transcrição completa: `C:\Users\ranie\.claude\projects\D--Arquivos-RAFI-WEB-RAFI-DEV-sol-planet\fb502ef1-d9a1-40c1-b8bd-a0ef503eb3c4.jsonl`

---

## Onde paramos

**Pronto (no código, ainda sem commit)**

- `packages/livoltek`: cliente da API (login, usinas, detalhe, fluxo, geração, equipamentos, histórico, alarmes) e o `probe` (`pnpm --filter @sol/livoltek probe`, grava `probe-out.json`, que não é versionado).
- Protocolo validado no servidor real:
  - Uma conta inexistente devolve `no.user`.
  - A conta real fez login, mas veio `stations: []`, porque o revendedor ainda não vinculou a usina ao e-mail.
- Login do dashboard com seletor **Solplanet | Livoltek**: qualquer pessoa entra com a própria conta, que é validada na API e guardada cifrada. Não depende do `.env`.
- Migração `0006_spotty_redwing.sql`: coluna `accounts.provider` (default `solplanet`) e índice único `(provider, account)` no lugar do único em `account`.
- Worker: `apps/worker/src/livoltek-collector.ts`.
  - Faz login e reloga só quando o token vence (a sessão dura 30 dias).
  - Lista as usinas e marca "conta sem usina".
  - Avisa no WhatsApp quando a API cai.
  - Se a senha for recusada, para de tentar (evita o captcha) e avisa uma vez.
- `/feio/api` com a tabela de rotas da Livoltek.
- Typecheck dos 6 projetos ok; `pnpm test` 20/20.

**Bloqueios atuais**

- A usina ainda não está vinculada à conta Livoltek: o revendedor precisa cadastrar o e-mail.
- **A migração 0006 não foi aplicada.** O `DATABASE_URL` do `.env` local aponta para o **Postgres de produção**, então o localhost dá erro no login e na home (lê `accounts.provider`, que ainda não existe).

---

## 1. Subir o que já está pronto

- [ ] Commit + push na `main` (o deploy leva código novo e migração juntos; o worker aplica a migração no boot).
  - **Não** aplicar a 0006 à mão antes do deploy. O código atual de produção usa `onConflictDoUpdate` em `accounts.account`, que depende da constraint única que a 0006 remove. Aplicar antes quebraria o login de contas novas em produção.
- [ ] Depois do deploy: conferir que as contas antigas ficaram com `provider = 'solplanet'` e que o login Solplanet segue funcionando.
- [ ] Testar o login Livoltek no dashboard. Deve cair na tela "conta sem usina" com o texto que menciona o revendedor.
- [ ] Opcional: apontar o `.env` local para o Postgres de dev (`sol-pg-dev`, porta 5439) para não mexer em produção a partir do PC.

## 2. Quando a usina aparecer na conta

- [ ] Rodar o probe e salvar as respostas: `pnpm --filter @sol/livoltek probe`.
- [ ] Mapear os campos reais de cada resposta:
  - [ ] `findAllByCustomer`: id, nome, capacidade, status, potência.
  - [ ] `findOne`: coordenadas, `systemType`, `esCount`. O portal usa `findOneEV` para `systemType` 3/5; confirmar se é o caso.
  - [ ] `queryPowerFlow/{id}`: pv, load, grid, battery, soc, e os sinais (injetando ou comprando).
  - [ ] `solarInfo/{id}`: `dailySolar`/`totalSolar` e as unidades (Wh, kWh, MWh), CO₂.
  - [ ] `findAllByStation` + `energyStorageInfo`: inversor, SN, modelo, strings PV, saída AC.
  - [ ] `getToCSample`: formato dos pontos (dia = curva; mês e ano = kWh por dia e por mês).
  - [ ] `alarm/findAllFilter`: campos de código, nível, horário, SN e descrição.
- [ ] Definir os códigos de status (normal / offline / alerta / erro) para a mesma regra de "caiu" da Solplanet.

## 3. Gravar os dados (banco)

- [ ] **IDs maiores que int32** (ex.: `464946968203264`), e `plants.id` é `integer`. Escolher entre:
  - migrar `plants.id` e as FKs (`account_plants`, `inverters`, `power_points`, `readings`, `daily_energy`, `alerts.plant_id`) para `bigint`, ou
  - usar id próprio (serial) e guardar `provider` + `external_id` em `plants`. Assim também não há colisão entre ids da Solplanet e da Livoltek.
- [ ] Migração nova com essa decisão.
- [ ] `LivoltekCollector.tick` gravando `plants`, `account_plants`, `inverters`, `readings`, `daily_energy`, `power_points`. Remover o kv `livoltek_stations:<conta>`, que é provisório.
- [ ] `hasPlants` passa a ser verdadeiro quando houver usina gravada, o que libera os relatórios.
- [ ] Sincronização do histórico oficial (curva do dia e kWh por dia desde a instalação), como na Solplanet.

## 4. Alertas e relatórios

- [ ] Regra de usina offline / em erro (mesmos tempos e mensagens da Solplanet).
- [ ] Alarmes da Livoltek → tabela `alerts`, com deduplicação por fingerprint (SN + código + horário).
- [ ] Conferir as regras de Ajustes que dependem de dados que a Livoltek pode não ter: strings PV, tensão da rede, medidor.
- [ ] Relatórios diário, semanal e mensal com dados reais da Livoltek. Testar o envio.

## 5. Telas e textos

- [ ] Textos fixos "Solplanet" ainda no código: `settings-panel.tsx` (linhas ~334, 340 e 436), o modelo padrão da página do inversor, a mensagem do `watchdog.ts` e o `cli.ts`.
- [ ] `/feio/api`: marcar as rotas confirmadas e trocar "usado por" para `worker`.
- [ ] Revisar as telas Início, Histórico e Inversor com usina Livoltek: bateria, medidor e unidades.

## 6. Outros

- [ ] Servidor: hoje vem de `LIVOLTEK_SERVER` (default `international`, que cobre o Brasil). Se entrar alguém da Europa ou da Ásia, guardar o servidor por conta.
- [ ] As variáveis `LIVOLTEK_*` do `.env` servem só para o probe. Deixar isso claro no `README.md`.

---

## Referência rápida do protocolo

- Servidores:
  - Internacional (Brasil): `https://www.livoltek-portal.com`
  - Europa: `https://evs.livoltek-portal.com`
  - Ásia: `https://aa.livoltek-portal.com`
- Login: `POST /nbp/login/customer` com o JSON `{ login_account, password: md5(senha), language, device_type: 0 }`.
  - Devolve `access_token`, que vai no header `Authorization: Bearer`.
  - Logo depois, chamar `POST /ctrller-manager/login/login`.
- Quase tudo é **POST**. Os parâmetros vão em três lugares, conforme a rota:
  - na query: `findOne`, `energyStorageInfo`;
  - no corpo JSON: `findAllByCustomer`, `findAllByStation`, `getToCSample`, `alarm/findAllFilter`;
  - no caminho: `queryPowerFlow/{id}`, `solarInfo/{id}`.
- Respostas:
  - Sucesso quando `msg_code` (ou `msgCode`) vale `operate.success`.
  - Token vencido: `token.expiried`, `token.invalid` ou `token.not.set`.
- `getToCSample`: `{ id, startTime, endTime ("yyyy-MM-dd HH:mm:ss"), timeType 0=dia 1=mês 2=ano 3=total, objectType: 1 }`.
- **Cuidado:** várias senhas erradas seguidas fazem a Livoltek pedir captcha (`login_leave` conta as tentativas que restam). Não testar senha errada à toa.
- Fora de propósito (o projeto só lê dados): comandos remotos `/hess-ota/device/operation/*`.
- Artefatos da análise (APK extraído, JS do portal, scripts) no scratchpad da sessão: `C:\Users\ranie\AppData\Local\Temp\claude\D--Arquivos-RAFI-WEB-RAFI-DEV-sol-planet\fb502ef1-d9a1-40c1-b8bd-a0ef503eb3c4\scratchpad\` (é temporário e pode sumir).
