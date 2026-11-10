# C4 — Nível 2: Contêineres

O que roda dentro do sol-planet. Cada caixa é um processo ou serviço que sobe no Docker Compose.

```mermaid
C4Container
    title Contêineres — sol-planet

    Person(dono, "Dono da usina")
    Person(ia, "App de IA")

    System_Boundary(sol, "sol-planet") {
        Container(web, "web", "Next.js 16, Node 24", "Dashboard, API REST (/api), servidor MCP (/mcp), OAuth e métricas Prometheus (/api/metrics)")
        Container(worker, "worker", "Node 24, tsx", "Coleta a cada N minutos, aplica as regras de alerta e envia o relatório diário")
        ContainerDb(db, "Postgres", "PostgreSQL 17", "Contas, usinas, leituras, alertas e configurações. Compartilhado por web e worker")
    }

    System_Ext(solplanet, "API Solplanet / Livoltek", "Dados do inversor")
    System_Ext(evolution, "Evolution API", "WhatsApp")

    Rel(dono, web, "Dashboard e API", "HTTPS, cookie de sessão")
    Rel(ia, web, "Ferramentas MCP", "HTTPS, Bearer OAuth 2.1")
    Rel(web, db, "Lê e grava", "SQL (Drizzle)")
    Rel(worker, db, "Grava leituras e alertas", "SQL (Drizzle)")
    Rel(worker, solplanet, "Coleta", "HTTPS")
    Rel(worker, evolution, "Envia mensagens", "HTTP")
    Rel(web, evolution, "Pareia e lista contatos", "HTTP")
```

## Como isso aparece no repositório

| Contêiner | Código | Imagem (`Dockerfile`) |
|---|---|---|
| web | [apps/web](../../apps/web) | alvo `web` |
| worker | [apps/worker](../../apps/worker) | alvo `worker` |
| Postgres | [packages/db](../../packages/db) (schema Drizzle e migrações) | `postgres:17-alpine` no [compose local](../../docker-compose.local.yml); em produção, o Postgres que já existe na VPS |

Bibliotecas compartilhadas, dentro de `packages/`: `solplanet`, `livoltek`, `whatsapp` (clientes de API) e `observability` (logs pino e métrica).

## Por ambiente

- **Avaliação/local** ([docker-compose.local.yml](../../docker-compose.local.yml)): Postgres, um contêiner `seed` que popula dados simulados, e o `web`. O `worker` só sobe com `--profile coleta`.
- **Produção** ([docker-compose.yml](../../docker-compose.yml)): `web` e `worker` ligados por rede externa ao Postgres da VPS. A Evolution API é opcional (`--profile evolution`).
