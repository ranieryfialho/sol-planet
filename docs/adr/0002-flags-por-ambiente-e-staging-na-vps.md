---
status: aceito
date: 2026-11-10
decision-makers: Raniery Fialho
---

# 0002 — Feature flags por variável de ambiente e staging autocontido na mesma VPS

## Contexto e problema

O sol-planet roda em produção, numa VPS, e cada push na `main` implantava direto lá. Para a entrega final, duas lacunas ficaram claras: não havia um ambiente de homologação separado da produção, e não havia como ligar ou desligar uma funcionalidade sem publicar código novo. A candidata natural a ser desligável é o servidor MCP com OAuth 2.1 (`/mcp`, `/oauth/*`), que expõe uma superfície a mais na internet e está fora do escopo do nível B.

Como ganhar isso com um desenvolvedor, uma VPS e poucos dias, sem criar um segundo sistema para operar?

## Fatores de decisão

- Não mudar o comportamento da produção atual (a flag nasce ligada).
- Custo operacional baixo: nada de novo serviço para manter, atualizar ou pagar.
- Staging sem risco para os dados reais: nenhuma credencial de usuário, nenhum acesso ao banco de produção.
- Dar ao avaliador um ambiente que mostre dados sem exigir conta Solplanet.
- Ser fácil de explicar e de testar.

## Opções consideradas

**Feature flag**

1. **Variável de ambiente `FEATURE_*`**, lida por um módulo pequeno e puro (`apps/web/lib/flags.ts`).
2. Plataforma de flags (Unleash, GrowthBook): painel, segmentação por usuário, percentuais.

**Staging**

3. **Staging autocontido na mesma VPS**: Postgres próprio e dados simulados pelo `seed`, em outra pasta, projeto compose e porta.
4. Staging apontando para uma cópia do banco de produção.
5. Staging num PaaS separado (Render, Railway).

## Decisão

Escolhidas as **opções 1 e 3**.

- A flag `FEATURE_MCP` (padrão: ligada) desliga o MCP, o OAuth e a página "Conectar IA": as rotas respondem 404 e o item some do menu. Mudar o valor e reiniciar o contêiner basta, sem novo build.
- O staging é o [docker-compose.staging.yml](../../docker-compose.staging.yml): Postgres próprio, `seed` com a usina demo e `web`. Não tem `worker` de coleta, WhatsApp nem credenciais reais. O deploy segue **staging → produção**, com aprovação manual para produção ([docs/deploy.md](../deploy.md)).

### Consequências

- Bom: zero infraestrutura nova. A flag é uma função pura com teste unitário, e a mesma variável vale nos dois ambientes, então dá para validar o desligamento no staging antes de aplicá-lo em produção.
- Bom: o staging é descartável e seguro. Seus dados são fictícios, então pode ser público para a avaliação sem expor ninguém.
- Ruim: a flag vale para o ambiente todo e só muda com reinício do contêiner. Não há liberação gradual nem segmentação por usuário, nem painel. Para as flags que o projeto tem hoje (uma), isso é suficiente. Se aparecerem flags por usuário, a opção 2 volta a ser a resposta.
- Ruim: staging e produção dividem a mesma máquina. Um build pesado no staging pode competir por CPU com a produção. Mitigação: o staging não tem worker, e o build roda antes da aprovação de produção.
- Ruim: o staging não exercita a coleta real nem o WhatsApp. Esses caminhos continuam validados só em produção.

## Prós e contras das opções

### Opção 2 — Unleash ou GrowthBook

- Bom: segmentação, rollout percentual, auditoria e painel.
- Ruim: é mais um serviço (e seu banco) para hospedar e manter na mesma VPS, ou uma dependência externa, para controlar uma única flag. **Descartada** por ser desproporcional ao tamanho atual.

### Opção 4 — Staging com cópia do banco de produção

- Bom: dados idênticos aos reais.
- Ruim: leva credenciais Solplanet/Livoltek cifradas e dados de pessoas para um ambiente de menor cuidado, e expõe o ambiente para avaliação com dados reais. Também exige rotina de cópia e anonimização. **Descartada** por risco de privacidade.

### Opção 5 — Staging num PaaS separado

- Bom: isolamento total de recursos.
- Ruim: outra conta, outro pipeline e outro custo, com uma configuração a mais para um desenvolvedor só. **Descartada** neste momento; fica como evolução se a VPS ficar apertada.
