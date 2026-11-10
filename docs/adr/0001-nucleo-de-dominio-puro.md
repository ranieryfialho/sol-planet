---
status: aceito
date: 2026-11-07
decision-makers: Raniery Fialho
---

# 0001 — Núcleo de domínio puro, com banco e rede na borda

## Contexto e problema

O sol-planet decide quando avisar o dono da usina: geração baixa, string PV fraca, tensão da rede fora da faixa, inversor sem gerar. Antes da adaptação para o projeto final, essas decisões ficavam em `apps/worker/src/rules.ts`, misturadas com consultas SQL, leitura e escrita no `kv` e envio pelo WhatsApp. O mesmo acontecia na API: o cálculo do resumo dependia de `cookies()` do Next e de `server-only`.

O resultado era que, para testar se 243 V é tensão fora da faixa, era preciso subir Postgres, simular o relógio e interceptar o WhatsApp. As regras mais importantes do produto ficavam sem teste unitário.

Como deixar as regras de negócio testáveis de forma isolada, sem reescrever o sistema que já roda em produção?

## Fatores de decisão

- Testar as regras de alerta e o cálculo do resumo sem banco, sem relógio e sem rede.
- Não mudar o comportamento em produção: a refatoração precisa preservar as regras atuais.
- Prazo curto (8 dias) e um desenvolvedor: a solução precisa ser pequena.
- Permitir um teste de integração que use as rotas reais com um Postgres real.

## Opções consideradas

1. **Núcleo de domínio puro com E/S na borda** (*functional core, imperative shell*).
2. Manter as regras como estavam e testar com mocks do banco e do WhatsApp.
3. Arquitetura hexagonal completa (portas e adaptadores com interfaces e classes para cada dependência).

## Decisão

Escolhida a **opção 1**.

- `apps/worker/src/domain.ts` concentra as decisões em funções puras: `isGridVoltageOff`, `hasStringImbalance`, `dropPercent`, `isMidday`, `isAfterSun` e outras. `rules.ts` só busca os dados, chama o domínio e, se for o caso, grava e envia o alerta.
- Na API, `apps/web/lib/api/summary.ts` calcula o resumo de forma pura, `repository.ts` faz as consultas recebendo o `db` por parâmetro (injeção de dependência simples, sem framework) e `handlers.ts` cuida só do HTTP: sessão, validação com zod e status.
- As rotas do Next (`app/api/**/route.ts`) só ligam o handler ao `getDb()` do processo.

### Consequências

- Bom: as regras de alerta e o resumo têm testes unitários rápidos ([tests/domain.test.ts](../../tests/domain.test.ts), [tests/summary.test.ts](../../tests/summary.test.ts)), que rodam em milissegundos.
- Bom: como o `db` é um parâmetro, o teste de integração usa as rotas reais com um Postgres real ([tests/api.int.test.ts](../../tests/api.int.test.ts)), sem mocks.
- Bom: atende a SOLID sem cerimônia. Cada módulo tem uma responsabilidade (SRP), e quem decide não depende de quem busca ou envia (DIP, via parâmetro). Uma regra nova entra na lista de `runRules` sem alterar as outras (OCP).
- Ruim: o resumo da API repete parte de consultas que o dashboard já faz em `lib/queries.ts`, que depende da sessão do Next. A unificação ficou para depois, para não mexer nas telas no prazo da entrega.
- Ruim: as consultas do `rules.ts` continuam sem teste unitário. Elas são cobertas indiretamente pelo uso em produção, e não pela suíte.

## Prós e contras das opções

### Opção 2 — Mocks do banco e do WhatsApp

- Bom: nenhuma refatoração.
- Ruim: os testes ficariam acoplados ao formato das consultas do Drizzle. Qualquer mudança de SQL quebraria testes que deveriam validar regra de negócio.
- Ruim: mock de query builder é frágil e esconde erros reais de SQL. **Descartada.**

### Opção 3 — Hexagonal completa

- Bom: fronteiras explícitas para tudo (repositórios, notificador, relógio).
- Ruim: interfaces e classes para um sistema pequeno, com um desenvolvedor e prazo de 8 dias. É o escopo inflado que a própria avaliação aponta como risco.
- Ruim: o mesmo ganho de testabilidade sai mais barato com funções puras. **Descartada.**
