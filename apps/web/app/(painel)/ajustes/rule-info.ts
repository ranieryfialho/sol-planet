/** Explicação de cada regra de alerta, mostrada no botão (i) da tela de Ajustes. Texto para o usuário final. */
export interface RuleInfo {
  /** o que a regra observa */
  what: string;
  /** o que acontece com o toggle ligado */
  on: string;
  /** o que acontece com o toggle desligado */
  off: string;
}

export const RULE_INFO = {
  offline: {
    what: "A Solplanet marca a usina como offline quando o inversor deixa de enviar dados: o Wi-Fi caiu, a internet da casa falhou ou o inversor foi desligado.",
    on: "Você recebe um aviso quando a usina ficar sem sinal pelo tempo definido. Quedas curtas, menores que esse tempo, não geram mensagem.",
    off: "Nenhum aviso de queda de comunicação. Você só perceberia olhando o painel.",
  },
  daylightOnly: {
    what: "À noite o inversor desliga sozinho e a Solplanet mostra a usina como offline. Esta janela define quando o offline conta como problema.",
    on: "Só avisa offline entre o nascer e o pôr do sol. No modo Auto, os horários são calculados pela localização da usina e mudam todo dia.",
    off: "Pode avisar offline também à noite, quando o inversor está desligado normalmente.",
  },
  inverterErrors: {
    what: "Códigos de falha e o status “alerta” que o inversor informa à Solplanet. Alguns inversores mantêm um alerta interno o dia inteiro, mesmo gerando normalmente.",
    on: "Avisa os códigos de falha. O status “alerta” só vira mensagem se a usina estiver gerando pouco (abaixo de 10% da capacidade) por mais do tempo definido; se ela estiver gerando bem, o aviso é ignorado.",
    off: "Atenção: com isto desligado você NÃO fica sabendo dos erros do inversor, nem das falhas reais. Se o equipamento tiver um problema de verdade, nenhuma mensagem será enviada e a usina pode ficar parada sem você perceber. Desligue só se o seu inversor mantém um alerta fixo, já conhecido, que gera mensagens sem necessidade, e acompanhe o painel com frequência.",
  },
  stringImbalance: {
    what: "Os painéis ligam ao inversor em grupos chamados strings (PV1, PV2…). Se uma rende bem menos que a outra, pode haver sombra, sujeira ou um painel com defeito.",
    on: "Avisa quando uma string rende a porcentagem definida a menos que a mais forte.",
    off: "Sem aviso. Um problema parcial nos painéis pode passar semanas sem ser percebido.",
  },
  gridVoltage: {
    what: "A tensão da rede elétrica que a Solplanet lê no inversor. Se passar de certos limites, o inversor se desliga para se proteger.",
    on: "Avisa quando a tensão chega perto do limite, antes do inversor desligar.",
    off: "Sem aviso. Se a rede passar do limite, o inversor desliga e você só vê o efeito depois.",
  },
  gridImport: {
    what: "Energia que a casa comprou da concessionária no dia. Só funciona se a usina tiver medidor de consumo ligado à Solplanet.",
    on: "Avisa quando a compra do dia passar do valor definido. Pode indicar consumo alto ou geração baixa.",
    off: "Sem aviso de consumo da rede (o valor fica em 0).",
  },
  zeroGeneration: {
    what: "O inversor está online na Solplanet, mas não produz nada em horário de sol. Pode ser disjuntor desligado, falha interna ou sombra total.",
    on: "Avisa depois do tempo definido sem geração em pleno dia.",
    off: "Sem aviso. Uma usina parada com o inversor ligado passa despercebida.",
  },
  staleData: {
    what: "O monitor não recebe dados novos da Solplanet: a API dela ou a nossa coleta pararam.",
    on: "Avisa quando passar do tempo definido sem dados novos.",
    off: "Sem aviso. Os números do painel podem ficar congelados sem você saber.",
  },
  lowCapacity: {
    what: "Compara a maior potência do dia com a capacidade instalada (kWp). Pico baixo pode indicar painéis sujos, sombra ou um dia muito nublado.",
    on: "Depois do pôr do sol, avisa se o pico do dia ficou abaixo da porcentagem definida.",
    off: "Sem aviso de pico baixo.",
  },
  lowGeneration: {
    what: "Compara a geração do dia com a média dos 7 dias anteriores, segundo os dados da Solplanet.",
    on: "Depois do pôr do sol, avisa se o dia ficou abaixo da média pela porcentagem definida. Dia nublado também dispara.",
    off: "Sem aviso de geração abaixo da média.",
  },
  monthly: {
    what: "Compara o ritmo do mês com a média dos meses anteriores. Também comemora a cada 500 kWh gerados.",
    on: "A partir do dia 20, avisa se o mês está abaixo da média pela porcentagem definida.",
    off: "Sem aviso de ritmo do mês.",
  },
  cycleStart: {
    what: "Marca o começo da produção do dia. O inversor acorda depois do nascer do sol, então o aviso vem no primeiro dado de geração recebido da Solplanet.",
    on: "Recebe uma mensagem quando a usina começa a gerar. Se nada chegar no prazo definido abaixo, avisa com as causas possíveis.",
    off: "Sem mensagem de início do dia, e sem o alerta de “não começou a gerar”.",
  },
  noStart: {
    what: "Prazo, a partir do amanhecer, para avisar que nenhuma geração chegou. Só vale com o aviso de início do dia ligado.",
    on: "",
    off: "",
  },
  cycleEnd: {
    what: "Marca o fim da produção do dia, 30 minutos depois do pôr do sol.",
    on: "Recebe a geração do dia e o horário em que o relatório chega.",
    off: "Sem mensagem de fim do dia. O relatório diário continua chegando se estiver ligado.",
  },
  cycleEndInReport: {
    what: "Evita duas mensagens seguidas no fim da tarde. Precisa do aviso de fim do dia e do relatório diário ligados.",
    on: "O aviso de fim do dia vira a abertura do relatório, numa mensagem só.",
    off: "O aviso de fim do dia e o relatório chegam em mensagens separadas.",
  },
  recovered: {
    what: "Mensagem ✅ quando um problema avisado antes termina. Só é enviada se o inversor estiver gerando e o problema tiver durado menos de 12 horas.",
    on: "Você sabe que o problema acabou sem precisar abrir o painel.",
    off: "Você só recebe o aviso do problema, nunca a confirmação de que ele passou.",
  },
  weeklySummary: {
    what: "Resumo da semana de geração e economia, enviado no domingo, no mesmo horário do relatório diário.",
    on: "Recebe o resumo toda semana.",
    off: "Sem resumo semanal.",
  },
  monthlyReport: {
    what: "Resumo do mês anterior com geração, economia e alertas, enviado no dia 1.",
    on: "Recebe o relatório todo mês.",
    off: "Sem relatório mensal.",
  },
} satisfies Record<string, RuleInfo>;

export type RuleInfoKey = keyof typeof RULE_INFO;
