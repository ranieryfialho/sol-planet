export const metadata = { title: "API · feio" };

type Rota = { m: "GET" | "POST"; path: string; params: string; uso: string; quem: string };

const SOLPLANET: Rota[] = [
  { m: "POST", path: "/aienergy/user/login", params: "account, password, isDemo=0", uso: "login; devolve token e userId (headers das demais chamadas)", quem: "worker + login do dashboard" },
  { m: "GET", path: "/aienergy/plant/plantlist/v4", params: "type, sortby, sort, own, page, size, ...", uso: "lista de usinas: status, potência, etoday, etotal", quem: "worker (todo ciclo)" },
  { m: "GET", path: "/aienergy/plant/detail/international/v4", params: "id", uso: "detalhe da usina: coordenadas, CO2, startdt, meterFlag", quem: "worker (todo ciclo)" },
  { m: "GET", path: "/aienergy/plant/detail/flow/v2", params: "id", uso: "fluxo de energia: pv, load, grid, battery, soc", quem: "worker (todo ciclo)" },
  { m: "GET", path: "/aienergy/equip/list/inverter/v3", params: "id", uso: "inversores da usina (pmuList[].invlist[])", quem: "worker (todo ciclo)" },
  { m: "GET", path: "/aienergy/plant/storage/detail/v5", params: "id, isno", uso: "parâmetros em tempo real: strings PV e saída AC (v, i, p)", quem: "worker (todo ciclo)" },
  { m: "GET", path: "/aienergy/chart/inverter/production/international/v4/{daily|week|month|year|total}", params: "id, isno, date (epoch ms)", uso: "histórico oficial: curva de 10 min, kWh por dia/mês/ano", quem: "worker (sincroniza histórico)" },
  { m: "GET", path: "/aienergy/plant/user/errlistByIsno", params: "isno, page, size", uso: "códigos de erro dos inversores", quem: "worker (se alerta de erros ligado)" },
  { m: "GET", path: "/aienergy/chart/hyperbola/v2", params: "id, isno, date (yyyy-MM-dd)", uso: "curva do dia de um inversor", quem: "não usada (CLI/cliente)" },
  { m: "GET", path: "/aienergy/equip/invdetail/v2", params: "id, isno", uso: "detalhe do inversor", quem: "não usada (CLI/cliente)" },
  { m: "GET", path: "/aienergy/equip/list/v6/allData", params: "id", uso: "todos os dispositivos da usina", quem: "não usada (CLI dump-all)" },
  { m: "GET", path: "/aienergy/plant/dashboard/international", params: "-", uso: "resumo geral da conta", quem: "não usada (CLI dump-all)" },
];

// prefixo /ctrller-manager/ salvo o login (/nbp/). Campos das respostas ainda a confirmar com uma conta real.
const LIVOLTEK: Rota[] = [
  { m: "POST", path: "/nbp/login/customer", params: "JSON: login_account, password=md5(senha), language, device_type=0", uso: "login; devolve access_token (vai em Authorization: Bearer)", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/login/login", params: "-", uso: "registra a sessão logo após o login (o portal sempre chama)", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/powerstation/findAllByCustomer?isUseChangeUnit=true", params: "JSON: start, pageSize, name", uso: "lista de usinas da conta", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/powerstation/findOne", params: "query: id, isUseChangeUnit", uso: "detalhe da usina: coordenadas, systemType, esCount", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/powerstation/queryPowerFlow/{id}", params: "-", uso: "fluxo de energia em tempo real", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/powerstation/solarInfo/{id}", params: "-", uso: "geração hoje/total (dailySolar, totalSolar + unidades), CO2", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/energystorage/findAllByStation", params: "JSON: stationId, start, pageSize, isUseChangeUnit", uso: "equipamentos da usina (inversor, bateria, medidor)", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/energystorage/energyStorageInfo", params: "query: id, isUseChangeUnit", uso: "parâmetros em tempo real do equipamento", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/sample/getToCSample", params: "JSON: id, startTime, endTime (yyyy-MM-dd HH:mm:ss), timeType 0=dia 1=mes 2=ano 3=total, objectType=1", uso: "histórico: curva do dia, kWh por dia/mês/ano", quem: "packages/livoltek (probe)" },
  { m: "POST", path: "/ctrller-manager/alarm/findAllFilter", params: "JSON: powerStationFilter[id], start, pageSize, level, alarmType, sn", uso: "alarmes da usina", quem: "packages/livoltek (probe)" },
];

const WAHA: Rota[] = [
  { m: "GET", path: "/api/contacts/check-exists", params: "phone, session", uso: "chatId certo do número (9º dígito)", quem: "worker + botão Testar" },
  { m: "POST", path: "/api/sendText", params: "session, chatId, text", uso: "envia mensagem no WhatsApp", quem: "worker + botão Testar" },
  { m: "GET", path: "/api/sessions/{session}", params: "-", uso: "estado da conexão e número conectado", quem: "Ajustes" },
  { m: "POST", path: "/api/sessions", params: "name, start", uso: "cria a sessão do WhatsApp", quem: "Ajustes → Conectar" },
  { m: "POST", path: "/api/sessions/{session}/start|restart|logout|stop", params: "-", uso: "inicia, reinicia ou desconecta a sessão", quem: "Ajustes" },
  { m: "GET", path: "/api/{session}/auth/qr?format=image", params: "format", uso: "QR code (base64) para parear", quem: "Ajustes → Conectar" },
  { m: "GET", path: "/api/{session}/groups?exclude=participants", params: "exclude", uso: "lista de grupos", quem: "Ajustes (admin)" },
  { m: "GET", path: "/api/contacts/all", params: "session", uso: "contatos salvos na agenda", quem: "Ajustes" },
];

const WEB = [
  ["/", "Início"],
  ["/historico?periodo=dia|mes|ano|total&ref=", "Histórico"],
  ["/alertas?f=todos|erros|offline|resolvidos", "Alertas"],
  ["/inversor?sn=", "Inversor"],
  ["/ajustes", "Ajustes (server actions: updateSettings, sendTest, connectWhatsApp, whatsappState, listGroups)"],
  ["/login", "Login (server action: login / logout)"],
  ["/feio", "versão feia dos dados"],
  ["/feio/api", "esta página"],
];

function Tabela({ titulo, host, rotas }: { titulo: string; host: string; rotas: Rota[] }) {
  return (
    <>
      <h2>== {titulo} ==</h2>
      <p>{host}</p>
      <pre>
        {rotas.map((r) => `${r.m.padEnd(5)} ${r.path}\n      params: ${r.params}\n      ${r.uso}\n      usado por: ${r.quem}\n`).join("\n")}
      </pre>
    </>
  );
}

export default function FeioApi() {
  return (
    <main style={{ background: "#000", color: "#0f0", fontFamily: "monospace", fontSize: 14, padding: 16, minHeight: "100vh" }}>
      <h1>SOL-PLANET: rotas de API (versao feia)</h1>
      <p>
        <a href="/feio" style={{ color: "#0f0" }}>[voltar para /feio]</a>
      </p>
      <Tabela
        titulo="SOLPLANET (API do app, engenharia reversa do APK)"
        host="https://aienergy-internation.aisweicloud.com (Brasil) | headers: token, userid, x-ca-* (assinatura Alibaba)"
        rotas={SOLPLANET}
      />
      <Tabela
        titulo="LIVOLTEK (app My Livoltek 4.6.3 + portal web, mesmo backend) — em integração"
        host="https://www.livoltek-portal.com (Brasil) | headers: Authorization: Bearer <access_token>, language, timeZone | sucesso: msg_code=operate.success"
        rotas={LIVOLTEK}
      />
      <Tabela titulo="WAHA (WhatsApp)" host="WAHA_URL (header X-Api-Key)" rotas={WAHA} />
      <h2>== DASHBOARD (rotas deste app; nao ha /api, tudo e pagina + server action) ==</h2>
      <pre>{WEB.map(([p, d]) => `${p.padEnd(44)} ${d}`).join("\n")}</pre>
      <h2>== NOTAS ==</h2>
      <pre>
        {`- A API oficial para integradores (PDF em docs/) e outra: eu-api-genergal.aisweicloud.com
  com /planlist, /getPlantOverview, /getInverterData etc. Nao e usada aqui.
- O app Solplanet tambem tem comandos de controle remoto (/aienergy/equip/remote/*).
  Ficaram de fora de proposito: o projeto so le dados.
- Livoltek: o app e Flutter (Dart AOT); hosts e endpoints sairam das strings do libapp.so,
  o login do portal web (mesmo backend). Senha vai em md5; o RSA do APK e so do login de operador.
  Comandos remotos (/hess-ota/device/operation/*) tambem ficaram de fora.
  Outros servidores: evs.livoltek-portal.com (UE/Africa), aa.livoltek-portal.com (Asia).`}
      </pre>
    </main>
  );
}
