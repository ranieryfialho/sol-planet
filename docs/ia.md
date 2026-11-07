# Uso de IA

Ferramenta: **Claude Code** (Anthropic), no VS Code, durante a adaptação do projeto à Proposta B, em 07/11/2026.
Regra seguida: a IA propõe e executa, e **as decisões são minhas**. Nada entrou sem plano aprovado, e cada módulo virou um commit revisável na branch `projeto-final-gt4`.

## Prompts que importaram

### 1. Contexto e objetivo

> "leia esse link para se contextualizar... preciso adequar esse projeto a proposta B do escopo"
> (link da aula 24, Projeto Final)

A IA leu o escopo, levantou o estado do repositório e listou as lacunas em relação à Proposta B.

### 2. Freio: aprovar antes de alterar

> "calma! desfaça tudo o que voce fez... eu quero primeiro aprovar antes de seguir... como falei precisa estar em conformidade"

A IA tinha começado a criar arquivos direto. Mandei desfazer, e daí em diante o fluxo foi **plano → aprovação → execução**. Foi a principal lição sobre trabalhar com IA neste projeto: a IA acelera, mas o controle do escopo é de quem entrega.

### 3. Decisões de escopo

> "1 - acho que é interessante exportmos tudo, tendo em vista que é um projeto que ja existe, acho que seria legal entrar de acordo e não esconder o que ja tem, obviamente que o escopo do projeto B é e sempre sera a regra para essa entrega.
> 2 - preciso entender melhor sua proposta
> 3 - ele pede vitest ou jest ou supertest. vamos nos ater a um desses
> 4 - a branch sera projeto-final-gt4"

### 4. Cobertura e README

> "sobre o limite de cobertura 80%, esta de acordo com o projeto? se sim, pode acontinuar"
> "sobre o README.md informe também que o projeto ja havia sendo desenvolvido antes e que foi adaptador para para estar de acordo e alinhado com o padrão de mercado proposto na Geração Tech 4.0"

## O que a IA sugeriu e o que eu decidi

| Tema | Sugestão da IA | Decisão |
|---|---|---|
| Endpoint principal | No primeiro rascunho, `/api/health`. A própria IA depois apontou que health não é domínio. | ✅ `GET /api/usinas/{id}/resumo`, com `GET /api/alertas` de apoio |
| O que documentar | Só o escopo B | ❌ Mudei: **documentar tudo** o que já existe e marcar o que é extra |
| Ferramentas de teste | `node:test` nativo, para não mexer na stack | ❌ Recusei: seguir o escopo à risca, com **Vitest + Supertest** |
| Cobertura mínima | 80% de linhas | ✅ Aceito depois de confirmar que é o padrão de mercado e viável no projeto |
| Compose de um comando | Profile no compose de produção | A IA mudou para um arquivo separado (`docker-compose.local.yml`) ao ver o risco de quebrar o deploy da VPS |
| Achados do gitleaks | Allowlist justificada, mover para variáveis de ambiente ou varrer só o código atual | ✅ **Allowlist justificada**: são chaves públicas do APK, não credenciais |
| Padrão do M1 | Núcleo de domínio puro com E/S na borda | ✅ Registrado no [ADR 0001](adr/0001-nucleo-de-dominio-puro.md), com a hexagonal completa descartada |

## Problemas que a IA encontrou e corrigiu no caminho

- **typescript-eslint não suporta o TypeScript 7** do projeto. A solução foi seguir a orientação oficial da Microsoft: TS 6 lado a lado (`typescript` → `@typescript/typescript6`, `@typescript/native` → TS 7).
- **O compose local herdava o `.env` de produção** (o Docker Compose interpola o `.env` da raiz), e a sessão local era recusada. A correção foram variáveis `LOCAL_*` próprias.
- **A reversão inicial ficou incompleta**: uma instalação interrompida terminou depois e alterou `package.json` e `pnpm-lock.yaml`. A IA detectou, avisou e restaurou os arquivos.

## O que é meu e consigo explicar

O sistema antes da adaptação (coleta por engenharia reversa, regras, dashboard, WhatsApp, MCP) e cada decisão da tabela acima. O código gerado na adaptação foi revisado módulo a módulo, e a explicação de cada parte está no [ADR](adr/0001-nucleo-de-dominio-puro.md), no [desempenho.md](desempenho.md) e nos comentários do código.
