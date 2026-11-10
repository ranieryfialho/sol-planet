# C4 — Nível 1: Contexto do sistema

Quem usa o sol-planet e com quais sistemas externos ele conversa. Os diagramas são Mermaid e o GitHub os renderiza direto.

```mermaid
C4Context
    title Contexto — sol-planet (monitoramento de usina solar)

    Person(dono, "Dono da usina", "Acompanha a geração no dashboard e recebe alertas e o relatório diário")
    Person(ia, "App de IA", "Claude ou outro assistente que consulta a usina pelo protocolo MCP")

    System(solplanet_app, "sol-planet", "API REST, dashboard web, coletor, regras de alerta e servidor MCP")

    System_Ext(solplanet, "API cloud Solplanet", "Dados da usina e do inversor (cliente via engenharia reversa do app)")
    System_Ext(livoltek, "API cloud Livoltek", "Mesmo papel, para usinas com inversor Livoltek")
    System_Ext(evolution, "Evolution API", "Gateway de WhatsApp, pareado por QR code")
    System_Ext(meteo, "Open-Meteo", "Previsão do tempo exibida no dashboard")
    System_Ext(maps, "Google Maps Static / OpenStreetMap", "Mapa de fundo da cena da casa (opcional)")

    Rel(dono, solplanet_app, "Usa o dashboard e a API", "HTTPS")
    Rel(ia, solplanet_app, "Consulta a usina", "MCP sobre HTTPS, OAuth 2.1 + PKCE")
    Rel(solplanet_app, solplanet, "Coleta leituras e status", "HTTPS, requisições assinadas")
    Rel(solplanet_app, livoltek, "Coleta leituras e status", "HTTPS")
    Rel(solplanet_app, evolution, "Envia alertas e relatório", "HTTP")
    Rel(evolution, dono, "Entrega as mensagens", "WhatsApp")
    Rel(solplanet_app, meteo, "Busca a previsão", "HTTPS")
    Rel(solplanet_app, maps, "Busca o mapa", "HTTPS")
```

## Notas

- O login do dashboard é a própria conta Solplanet ou Livoltek do usuário: o sol-planet confere as credenciais na API do fornecedor e guarda a senha cifrada (AES-256-GCM).
- O sistema só **lê** dados da usina. Os comandos de controle remoto do app foram deixados de fora de propósito.
- Open-Meteo e mapa são acessórios: se falharem, o dashboard segue funcionando sem eles.
