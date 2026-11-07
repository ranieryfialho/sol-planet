# Documentação

| Arquivo | Conteúdo |
|---|---|
| [openapi.yaml](openapi.yaml) | Contrato OpenAPI 3.1 de todas as rotas HTTP. O endpoint principal é `GET /api/usinas/{id}/resumo`. O lint roda com Spectral na CI. |
| [adr/0001-nucleo-de-dominio-puro.md](adr/0001-nucleo-de-dominio-puro.md) | ADR (MADR): núcleo de domínio puro com E/S na borda, com as alternativas descartadas |
| [desempenho.md](desempenho.md) | SLO, smoke test k6 com o p95 medido, histograma do servidor e `EXPLAIN ANALYZE` |
| [ia.md](ia.md) | Prompts que importaram e decisões tomadas sobre as sugestões da IA |
| Aiswei API-EU End User V3.pdf | Referência da API oficial do fabricante (consulta durante a engenharia reversa) |

Como rodar e testar está no [README principal](../README.md).
