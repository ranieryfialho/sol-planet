# Desempenho

## SLO

| Item | Valor |
|---|---|
| Endpoint | `GET /api/usinas/{id}/resumo` (fluxo principal) |
| Indicador (SLI) | latência das respostas, pelo histograma `http_request_duration_seconds{route="/api/usinas/{id}/resumo"}` em `/api/metrics` |
| Objetivo (SLO) | **p95 < 300 ms** e **menos de 1% de erro** (respostas 5xx ou falhas de rede) |
| Verificação | thresholds do k6 em [k6/smoke.js](../k6/smoke.js): o teste falha se o SLO não for cumprido |

Por que 300 ms: é o tempo de resposta que o dashboard e um app de IA (via MCP) toleram sem parecer lento. O resumo faz poucas consultas indexadas, então 300 ms dá folga para a VPS de produção, mais modesta que a máquina de desenvolvimento.

## Método

- **Ferramenta:** k6 1.3.0 (imagem `grafana/k6:1.3.0`), cenário *smoke*: 2 VUs constantes por 30 s, uma requisição a cada 0,5 s por VU.
- **Ambiente:** `docker-compose.local.yml` (Postgres 17 + web Next.js 16 em modo produção), Docker Desktop no Windows 11, 16 CPUs, 16 GB.
- **Dados:** seed da demo, com 1 usina, 401 dias em `daily_energy`, 288 leituras do dia e 3 alertas.
- **Autenticação:** o k6 assina a própria sessão (HMAC-SHA256, igual ao `apps/web/lib/session.ts`), sem depender da API da Solplanet.
- **Execução** (com o compose local no ar):
  ```bash
  docker run --rm -i --add-host=host.docker.internal:host-gateway \
    -e BASE_URL=http://host.docker.internal:3000 grafana/k6:1.3.0 run - < k6/smoke.js
  ```

## Resultado medido (07/11/2026)

### Cliente (k6)

| Métrica | Valor |
|---|---|
| Requisições ao resumo | 118 (+1 ao `/api/health` no setup) |
| Checks | 354 de 354 (100%) |
| Erros | 0,00% |
| Latência média | 16,23 ms |
| Mediana | 15,74 ms |
| p90 | 19,82 ms |
| **p95** | **24,14 ms** ✅ (SLO: < 300 ms) |
| p99 | 26,77 ms |
| Máximo | 32,05 ms |

```
http_req_duration{endpoint:resumo}
✓ 'p(95)<300' p(95)=24.14ms
http_req_failed{endpoint:resumo}
✓ 'rate<0.01' rate=0.00%
checks
✓ 'rate==1' rate=100.00%
```

### Servidor (`/api/metrics`, mesmo período)

| Faixa (`le`) | Requisições acumuladas |
|---|---|
| ≤ 5 ms | 4 |
| ≤ 10 ms | 66 |
| ≤ 25 ms | 118 |
| ≤ 50 ms | 119 |

Média no servidor: 1,207 s / 119 = **10,1 ms**. A diferença para os 16 ms do k6 vem da rede entre containers e do Docker Desktop.

### Banco (`EXPLAIN ANALYZE`)

A consulta mais cara do resumo, a média dos 7 dias anteriores, usa a chave primária `(plant_id, day)`:

```
Bitmap Index Scan on daily_energy_plant_id_day_pk (actual time=0.007..0.008 rows=7)
Planning Time: 0.953 ms
Execution Time: 0.072 ms
```

## Resultado no staging, pela rede (10/11/2026)

O mesmo smoke test, rodado pelo job `desempenho` do deploy ([deploy.yml](../.github/workflows/deploy.yml)) **a partir de um runner do GitHub Actions contra a URL pública do staging**. A medição inclui a distância de rede até a VPS, o proxy reverso e o HTTPS, que o teste local não tinha. O staging usa o Postgres próprio do compose, com a mesma massa do seed.

Duas execuções seguidas, no mesmo dia, do mesmo teste (30 s, 2 VUs):

| Métrica | 1ª execução | 2ª execução |
|---|---|---|
| Checks | 258 de 258 (100%) | 100% |
| Erros | 0,00% | 0,00% |
| Mediana | 195,0 ms | 161,1 ms |
| **p95** | **240,8 ms** ✅ | **189,0 ms** ✅ |
| p99 | 306,6 ms | 234,4 ms |
| Máximo | 323,1 ms | 237,8 ms |

A 1ª execução fez 87 requisições ao resumo. O SLO (p95 < 300 ms) foi cumprido nas duas.

Os valores são da métrica filtrada por `endpoint:resumo`, a mesma dos thresholds. A tabela geral que o k6 imprime inclui também a chamada de `/api/health` do `setup` e por isso difere nas casas decimais.

**Como ler:** o p95 passou de 24 ms (local) para cerca de 241 ms pela rede, porque a maior parte do tempo agora é rede, e não processamento: no servidor, o resumo continua em poucos milissegundos (ver `/api/metrics`). O SLO de 300 ms é cumprido nas duas, com folga de **cerca de 60 ms a 110 ms**, bem menor que a do teste local. A diferença de 50 ms entre as execuções mostra que, pela internet, o p95 oscila bastante. O p99 da 1ª execução (306 ms) passou do limite, mas o SLO é definido sobre o p95. São execuções curtas, de 30 s: provam o SLO, mas não são uma linha de base estatística. Se a folga apertar, o próximo passo é o item "juntar `canSeePlant` e `plants` num `join`" descrito em [ia.md](ia.md) (8.4).

## Análise e gargalo

- Com carga de smoke, o SLO tem folga de mais de 10 vezes: p95 de 24 ms contra o limite de 300 ms.
- O banco não é o gargalo: cada consulta executa em décimos de milissegundo. A maior parte dos 10 ms do servidor está nas **idas e voltas ao banco feitas em sequência**: `canSeePlant`, depois `plants` e depois três consultas em paralelo (dia, média e ajustes). São 3 rodadas de rede até o Postgres, mais o roteamento do Next.
- O smoke só valida o funcionamento e mede a latência de base. Ele **não** mede o limite de capacidade: isso exigiria um teste de carga (rampa de VUs) contra a VPS, fora do escopo B.

## O que eu faria diferente / próximos passos

1. Juntar `canSeePlant` e a leitura de `plants` numa consulta só (`join` com `account_plants`), reduzindo de 3 para 2 as rodadas até o banco.
2. Rodar o k6 também contra a VPS de produção (Postgres compartilhado com outros serviços), que é onde o SLO de verdade importa.
3. Coletar o `/api/metrics` com Prometheus e Grafana e alertar quando o p95 em janela de 5 min passar de 300 ms. Hoje o SLO é verificado só no teste.
