# Pendências — sol-planet

> Estado em **31/10/2026** (atualizado no fim do dia). Para retomar: leia "Onde paramos", suba o ambiente local e siga a lista por prioridade.

## Onde paramos

**Pronto e validado com a conta real**

- Engenharia reversa do APK Solplanet 5.2.1: assinatura do gateway, login e endpoints (ver `README.md` → Protocolo).
- Worker coletando a cada **2 min** (`POLL_MINUTES=2`): usina, fluxo, inversor e strings PV, mais a sincronização do histórico oficial (curva de 10 min e geração por dia desde a instalação).
- Dados batendo com o app: total de **535,7 kWh** desde 13/10, e 30/10 = 30,9 kWh com pico de 5,5 kW.
- Dashboard (Next.js 16) com 6 telas no design do Stitch: Login, Início, Histórico, Alertas, Inversor e Ajustes.
- Login com a conta do app Solplanet, sessão de 30 dias, botão Sair.
- **Multiusuário (até 3 contas Solplanet)**: cada pessoa entra com a própria conta, que é validada na API e guardada cifrada (AES-256-GCM) para o worker coletar. Dados, alertas e ajustes isolados por conta. `SOLPLANET_ACCOUNT/PASSWORD` no `.env` agora são opcionais; `ADMIN_ACCOUNT` define quem administra o WhatsApp compartilhado.
- **WhatsApp por conta**: cada pessoa pareia o próprio número (QR em Ajustes) e escolhe grupos e contatos da própria lista.
- **Alertas novos** (por usuário, em Ajustes → Regras): baixa geração vs média 7d, pico abaixo de X% da capacidade, sem geração em pleno dia, string PV fraca, tensão da rede, consumo da rede (só com medidor), ritmo do mês + marcos de 500 kWh, vigia de dados parados (roda no web). Mais os relatórios **semanal** (domingo) e **mensal** (dia 1).
- Páginas de apoio `/feio` (dados crus) e `/feio/api` (rotas consumidas), ambas atrás do login.
- Layout mobile do card Relatório de Fechamento (botão Testar) corrigido.
- Builds Docker (`web` e `worker`) passando.

**Usina real**: "Augusto/Fortaleza", 5 kWp, inversor ASW5000-S-G2 (SN `SA500087S25A1261`), instalada em 13/10/2026. **Não tem medidor de consumo** (o detalhe da usina diz `meterFlag: false`; `load` e `grid` do fluxo vêm sempre 0) e **não tem bateria**. Por isso a home mostra "Hoje" e "Total gerado" no lugar de Casa e Rede.

**Rodando no PC agora** (ver "Ambiente local" para subir de novo):

- Postgres `sol-pg-dev` (Docker, porta 5439)
- `pnpm dev` na raiz sobe o dashboard (http://localhost:3000) e o worker juntos
- ao mudar o `.env`, reiniciar **os dois** (o Next só lê o `.env` ao subir)

---

## 1. WhatsApp / Evolution

Cada conta pareia o **próprio número** numa instância nomeada `solar-<login>-<id>` (ex.: `solar-ranieryfialho-1`), escolhe grupos e contatos da própria lista e recebe só o que as regras dela disparam.

- [X] Evolution configurada e testada (31/10): `EVOLUTION_URL`/`EVOLUTION_API_KEY` no `.env` local, API respondendo (v2.3.7).
- [X] **Ajustes → Conectar**: o QR aparece, o status vira "Conectado" sozinho e o número aparece.
- [X] Adicionar destinatário: a lista de grupos funciona (grupo "Os irmãos" cadastrado). A Evolution leva ~1 min para listar 100+ grupos, então a tela pede grupos à parte (`/api/whatsapp/groups`) e os contatos aparecem na hora.
- [X] Relatórios diário, semanal e mensal, e um exemplo de cada alerta (17 mensagens), enviados ao número pareado e aprovados no formato (31/10).
- [X] Lista de contatos na tela funcionou (31/10).
- [X] Botão **Testar** (Ajustes) funcionou (31/10). Falta só o `pnpm --filter @sol/worker cli test`.
- [x] Sem destinatários cadastrados, os avisos (alertas, relatórios e o botão Testar) vão para o **próprio número conectado** (31/10). Se o WhatsApp estiver desconectado, nada é enviado.
- [X] Instância antiga `solar-1` apagada; a atual (`solar-ranieryfialho-1`) está pareada e trazendo informações corretas.
- [ ] Usar **chip secundário**: a conexão não é oficial e o número pode ser banido.
- [X] **Privacidade (decisão em 31/10: manter a Evolution compartilhada da VPS, sem subir outra).** Ela tem `DATABASE_SAVE_DATA_NEW_MESSAGE/CHATS/MESSAGE_UPDATE=true` e `CONTACTS=true`, então grava no seu Postgres as mensagens, chats e contatos dos números pareados (inclusive os do irmão e do amigo). Você não gostou disso; ficou como está por ora. Para reduzir, sem outra Evolution: desligar `NEW_MESSAGE`, `MESSAGE_UPDATE` e `CHATS` (o seletor de contatos precisa só de `CONTACTS`), se o `status-monitor` e os outros apps não dependerem delas. Os amigos devem ser avisados de que isso é guardado.
- [X] A `EVOLUTION_API_KEY` é igual à senha do `root` do Postgres e ambas foram coladas em chat: trocar as duas por valores aleatórios (`openssl rand -hex 32`).

## 2. Validar durante o dia (comparar com o app, lado a lado)

- [X] **Potência ao vivo** (Solar) igual à do app.
- [X] **Casa / Rede**: zerados porque a usina **não tem medidor** (31/10). O worker agora só considera medidor se fluxo **e** detalhe concordarem. Continua pendente: confirmar o **sinal da rede** (assumi `grid > 0` = comprando) se um dia houver medidor.
- [X] **Status 1 = normal**: confirmado (31/10): usina e inversor com status 1 gerando 4,8 kW. O 2 (alerta) e o 3 (erro) ainda vêm só do código do APK.
- [ ] Card "Hoje": a curva enche ao longo do dia; depois das 17h aparece a comparação "vs 7d".
- [X] Alerta de **offline durante o dia**: desligar o Wi-Fi do inversor por mais de 20 min e ver se o alerta aparece (e o "normalizado" depois).
- [X] **Erros do inversor** (`/aienergy/plant/user/errlistByIsno`): formato real ainda não visto, porque não houve erro. Campos assumidos: `errCode`, `context`, `occdt`, `isno`, `plantName`.

## 3. Tela Ajustes — não clicada de verdade

- [X] Salvar regras, horários, tarifa e toggles; recarregar a página e conferir se persistiu.
- [X] Adicionar e remover destinatário.
- [X] Os inputs de número e horário salvam a cada tecla (uma server action por digitação). Colocar **debounce** ou salvar no blur.
- [X] Ajustar a **tarifa real** (R$/kWh da Enel CE; o padrão é 0,95).

## 4. Deploy na VPS

- [X] `Dockerfile` corrigido (faltava copiar `packages/whatsapp/package.json`, o `pnpm install --frozen-lockfile` falharia) e os dois builds (`web` e `worker`) passam. O `docker-compose.yml` usa a Evolution existente (a do compose só sobe com `--profile evolution`).
- [ ] Criar o banco `solar` e o usuário `solar_user` no `postgres-db` (rede `wp-network`, já identificada); não usar o `root`. As tabelas o worker cria sozinho (migrações).
- [ ] Postgres e MariaDB da VPS publicam `5432`/`3306` em `0.0.0.0`: prender em `127.0.0.1` ou fechar no firewall.
- [ ] No Nginx Proxy Manager, host do Solar com `proxy_read_timeout 180s;` em Advanced (listar grupos leva ~1 min).
- [ ] Decidir o domínio (sugestão: `solar.rafiweb.tech`).
- [ ] Copiar o projeto para a VPS e montar o `.env` a partir do `.env.example`: `PG_NETWORK=wp-network`, `DATABASE_URL` com host `postgres-db`, `EVOLUTION_URL=http://evolution:8080`, `WEB_PORT=3010` (a 3000 do host é do status-monitor), `AUTH_SECRET` e `EVOLUTION_API_KEY` novos.
- [ ] `docker compose up -d --build`.
- [ ] Domínio + HTTPS pelo Nginx Proxy Manager já existente (encaminhar para `solar-web:3000` na `wp-network`; `WEB_PORT=3010` porque a 3000 do host está ocupada pelo status-monitor). Conferir se o login funciona e se o cookie fica `secure`.
- [ ] Parear o WhatsApp pela tela Ajustes já em produção.
- [ ] Ver se `docker compose logs -f worker` mostra a coleta e a sincronização sem erro.
- [ ] Parar o worker local quando a VPS assumir, para não coletar em dobro (os bancos são separados, mas ficariam dois alertas).

## 5. Dados e API — pontos frágeis conhecidos

- [X] A **curva diária** vem rotulada "W" mas em **kW**. A conversão usa uma heurística (`máx < 100` → kW, ×1000) em `apps/worker/src/collector.ts` → `syncDayCurve`. Funciona para usinas residenciais; revisar se um dia houver usina > 100 kW.
- [ ] Os horários da curva vêm em UTC+8 (fuso do servidor deles); uso o índice do ponto (00:00 + i×10 min). Se a API mudar, a curva desloca.
- [X] A API **não manda a geração do mês** (`eMonth`); o mês é a soma de `daily_energy`.
- [X] **Frequência e temperatura** do inversor não vêm na API, então os cards ficam ocultos. Conferido em 31/10: `storage/detail/v5` só traz `pac`, `pvList`, `acList` (v, i, p) e metadados. Ainda não olhei `invdetail`; investigar se fizer falta (a regra de frequência da rede depende disso).
- [ ] Impacto ambiental: o CO₂ vem da API (`co2Val`, kg); carvão (0,4 kg/kWh) e árvores (18,3 kg CO₂/árvore/ano) são estimativas.
- [ ] O clima vem do Open-Meteo. A própria API manda `detail.weather` (tmp, texto, ícone), dá para trocar se preferir igualar ao app.
- [ ] `TZ=America/Sao_Paulo`; Fortaleza tem o mesmo offset (UTC−3, sem horário de verão). Opcional trocar para `America/Fortaleza`.
- [ ] A chave do app (extraída do APK) pode mudar numa atualização da Solplanet. Se a coleta quebrar com erro de assinatura, extrair de novo do APK novo (ver `README.md`).
- [ ] A tabela `readings` cresce cerca de 288 linhas por dia: definir retenção (ex.: apagar com mais de 90 dias, já que `power_points` e `daily_energy` guardam o histórico).

## 6. Decisões em aberto

- [X] **Várias contas**: decidido e feito (31/10): multiusuário com credenciais cifradas por conta, limite `MAX_ACCOUNTS=3`. Falta: pesquisar a **API oficial** para instaladores (há um PDF em `docs/`, mas é outra API e exige AppKey do fornecedor) e cuidados de LGPD se abrir para clientes da agência.
- [X] Seletor "Minha Casa ▾" no topo: hoje é só visual (existe uma usina). Implementar se houver mais de uma.
- [X] Relatórios semanal (domingo) e mensal (dia 1, resumo do mês anterior) no WhatsApp, além do diário, cada um com toggle em Ajustes. O mensal só foi testado com o mês parcial de outubro (usina desde 13/10); a comparação com o mês anterior só aparece com 10+ dias de dados nele.

## 7. Projeto e manutenção

- [ ] **Git**: o projeto ainda não é repositório. `git init` e remote **privado**. O `.env` (com a senha Solplanet) e o `.xapk` já estão no `.gitignore`.
- [ ] Sem testes automatizados. Candidatos: assinatura do cliente (`packages/solplanet`), conversões do coletor, sessão (`apps/web/lib/session.ts`).
- [ ] O limite de tentativas de login fica em memória e zera quando o web reinicia; aceitável para um usuário.
- [ ] Imagem da Evolution fixada em `v2.3.7`; checar atualizações de vez em quando.
- [ ] REA (MCP): a configuração aponta para um JAR do JADX inexistente (`RAFI DEV/open-solplanet/_tools/jadx-headless-mcp-0.7.1-all.jar`). Corrigir só se for usar o REA de novo; o JADX oficial funcionou sozinho.

## 8. Multiusuário e alertas novos — validar

- [ ] **Login de uma 2ª conta Solplanet real**: cadastro automático, worker passando a coletar, e isolamento de dados entre as contas (nunca testado com duas contas).
- [ ] Alertas novos foram testados só com dados forçados (transação revertida). Validar na prática: sem geração, string fraca, tensão da rede, vigia de dados parados (nunca executado).
- [ ] Alerta do **mês** só funciona com 14+ dias de meses anteriores; a usina tem desde 13/10, então só vale a partir de dezembro.
- [ ] Observar 1 ou 2 dias com coleta de 2 min: erros 403/429 ou falha de login na API da Solplanet.
- [ ] Testar o fluxo do WhatsApp com a conta do irmão e a do amigo (cada um pareia o próprio número).
- [x] Primeiro acesso: a tela mostra "Bem-vindo! Estamos buscando os seus dados" e o worker coleta a conta nova em até ~15 s (antes esperava o ciclo de 2 min). A coleta do histórico ainda leva 1 a 3 min.
- [x] Diagnóstico de conta: `pnpm --filter @sol/worker cli check <email>` (pede a senha sem mostrar, não grava nada). Se uma conta entrar e não vier usina, a tela diz que a conta não tem usinas. Hipótese não confirmada: o filtro `own=1` esconder usinas compartilhadas; só tratar se o `check` mostrar usina em `own=0/2`.
- [ ] Na VPS: definir `AUTH_SECRET` (cifra as senhas das contas; trocá-lo deixa as senhas ilegíveis até cada pessoa entrar de novo) e `ADMIN_ACCOUNT`.
- [ ] Decidir se `/feio` e `/feio/api` ficam em produção (estão atrás do login, mas mostram dados crus).
- [ ] Usina compartilhada entre duas contas: a última a coletar vira dona. Tratar se acontecer.
- [ ] Região da API (`SOLPLANET_REGION`) é única para todas as contas.

---

## Ambiente local (para retomar)

```powershell
docker start sol-pg-dev                       # Postgres local (porta 5439)
pnpm dev                                      # dashboard (http://localhost:3000) + worker
# ou separados: pnpm dev:web / pnpm dev:worker
```

Utilitários do worker (`pnpm --filter @sol/worker cli <cmd>`):

| Comando      | Para quê                                                         |
| ------------ | ----------------------------------------------------------------- |
| `dump`     | JSON bruto das usinas                                             |
| `dump-all` | Todas as respostas da API (detalhe, fluxo, inversores, gráficos) |
| `errors`   | Últimos erros do inversor                                        |
| `report`   | Monta e envia o relatório diário agora                          |
| `groups`   | Lista os grupos do WhatsApp                                       |
| `test`     | Mensagem de teste no WhatsApp                                     |

Dados de demonstração (apaga os reais!): `pnpm --filter @sol/worker seed:demo`.

## Onde está cada coisa

| Caminho                                                                          | O quê                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/solplanet/src/index.ts`                                              | Cliente da API (assinatura, endpoints, tipos)                                      |
| `apps/worker/src/collector.ts`                                                 | Coleta (uma instância por conta), sincronização do histórico, regras de status |
| `apps/worker/src/rules.ts`                                                     | Alertas extras (baixa geração, strings, tensão, mês...)                        |
| `apps/worker/src/report.ts`                                                    | Texto dos relatórios diário, semanal e mensal                                    |
| `packages/db/src/accounts.ts`                                                  | Contas Solplanet, cifra das senhas, `AUTH_SECRET`                                |
| `apps/web/lib/watchdog.ts` + `instrumentation.ts`                            | Vigia de "sem dados" (roda no web)                                                 |
| `packages/db/src/schema.ts`                                                    | Tabelas; depois de mudar, rodar `pnpm db:generate`                               |
| `packages/db/src/settings.ts`                                                  | Configurações editáveis (destinatários, regras, tarifa)                        |
| `packages/whatsapp/src/index.ts`                                               | Cliente da Evolution API (instância por conta, grupos, contatos)                  |
| `apps/web/app/api/whatsapp/groups/route.ts`                                    | Lista de grupos (rota HTTP: é lenta e não pode travar a fila de server actions)  |
| `tests/`                                                                       | Testes (`pnpm test`): cifra, sessão, nome da instância                         |
| `apps/web/app/(painel)/`                                                       | Telas do dashboard                                                                 |
| `apps/web/app/login/` + `lib/session.ts` + `lib/account.ts` + `proxy.ts` | Login por conta, sessão e proteção das rotas                                    |
| `design/`                                                                      | Referência do Pinterest, prompts e export do Stitch                               |
