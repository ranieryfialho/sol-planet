/**
 * Cliente da API cloud da Livoltek (app My Livoltek 4.6.3 / portal www.livoltek-portal.com).
 *
 * Protocolo extraído do APK (Flutter, strings do libapp.so) e do portal web, que usa o mesmo backend:
 * - Servidores (assets/countryListUrl.json): Brasil cai no "International Server" (www.livoltek-portal.com).
 * - Login de cliente: POST /nbp/login/customer, JSON { login_account, password: md5(senha), language, device_type }.
 *   Devolve data.access_token; o portal em seguida chama POST /ctrller-manager/login/login.
 * - Toda chamada leva "Authorization: Bearer <token>", "language" e "timeZone".
 * - Sucesso: msg_code (ou msgCode) === "operate.success". Token vencido: token.expiried | token.invalid | token.not.set.
 *
 * Só leitura: os comandos remotos (/hess-ota/device/operation/*) ficam de fora de propósito.
 */
import { createHash } from "node:crypto";

export const SERVERS = {
  /** Américas, Japão, Coreia, Oceania… (inclui BR) */
  international: "https://www.livoltek-portal.com",
  /** UE, Oriente Médio e África */
  europe: "https://evs.livoltek-portal.com",
  /** Sudeste Asiático, Índia, China */
  asia: "https://aa.livoltek-portal.com",
} as const;
export type Server = keyof typeof SERVERS;

const SUCCESS = "operate.success";
const TOKEN_ERRORS = new Set(["token.not.set", "token.expiried", "token.invalid"]);

export interface Envelope<T = any> {
  msg_code?: string;
  msgCode?: string;
  message?: string;
  data: T;
  total?: number;
}

export class LivoltekError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
  get tokenExpired() {
    return !!this.code && TOKEN_ERRORS.has(this.code);
  }
}

/** Granularidade de sample/getToCSample (portal: day=0, month=1, year=2, total=3). */
export const TIME_TYPE = { day: 0, month: 1, year: 2, total: 3 } as const;
export type Period = keyof typeof TIME_TYPE;

/** "yyyy-MM-dd HH:mm:ss" no fuso dado (o portal manda o horário local do navegador + header timeZone). */
export function fmtDateTime(d: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export class LivoltekClient {
  readonly base: string;
  token = "";
  customer: Record<string, any> | null = null;

  constructor(
    server: Server = "international",
    private language = "en",
    readonly timeZone = "America/Sao_Paulo",
    private timeoutMs = 30_000,
  ) {
    this.base = SERVERS[server];
  }

  async request<T = any>(method: "GET" | "POST" | "PUT", path: string, opts: { query?: Query; body?: unknown; auth?: boolean } = {}): Promise<Envelope<T>> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { language: this.language, timeZone: this.timeZone, accept: "application/json" };
    if (opts.auth !== false) headers.authorization = this.token ? `Bearer ${this.token}` : "";
    let body: string | undefined;
    if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["content-type"] = "application/json";
    }
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await res.text();
    let data: Envelope<T>;
    try {
      data = JSON.parse(text);
    } catch {
      throw new LivoltekError(`HTTP ${res.status} ${path}: ${text.slice(0, 200)}`, undefined, res.status);
    }
    const code = data.msg_code ?? data.msgCode;
    if (code !== SUCCESS) throw new LivoltekError(`${path}: ${code ?? `HTTP ${res.status}`}`, code, res.status);
    return data;
  }

  private post<T = any>(path: string, body?: unknown, query?: Query) {
    return this.request<T>("POST", `/ctrller-manager/${path}`, { body, query });
  }

  async login(account: string, password: string) {
    const { data } = await this.request<Record<string, any>>("POST", "/nbp/login/customer", {
      auth: false,
      body: {
        login_account: account,
        password: createHash("md5").update(password).digest("hex"),
        language: this.language,
        device_type: 0,
      },
    });
    if (!data?.access_token) throw new LivoltekError("login sem access_token (conta pede captcha?)", "no.token");
    this.token = data.access_token;
    this.customer = data;
    // o portal chama logo após o login: registra a sessão no ctrller-manager e devolve o perfil
    await this.post("login/login").catch(() => undefined);
    return data;
  }

  /** Usinas da conta (portal: getFindAllByCustomer). */
  async stations(page = 1, pageSize = 50): Promise<Record<string, any>[]> {
    const { data } = await this.post<any>("powerstation/findAllByCustomer", { start: page, pageSize, name: "" }, { isUseChangeUnit: true });
    return Array.isArray(data) ? data : (data?.list ?? data?.records ?? []);
  }
  /** Detalhe da usina (systemType 3/5 usam findOneEV no portal). */
  station(id: number | string) {
    return this.post("powerstation/findOne", undefined, { id, isUseChangeUnit: true }).then((r) => r.data);
  }
  /** Fluxo de energia em tempo real. */
  powerFlow(id: number | string) {
    return this.post(`powerstation/queryPowerFlow/${id}`).then((r) => r.data);
  }
  /** Geração de hoje/total: dailySolar(+Unit), totalSolar(+Unit), carbonReduction(+Unit). */
  solarInfo(id: number | string) {
    return this.post(`powerstation/solarInfo/${id}`).then((r) => r.data);
  }
  /** Equipamentos (inversores, baterias, medidores) da usina. */
  async devices(stationId: number | string, page = 1, pageSize = 50): Promise<Record<string, any>[]> {
    const r = await this.post<any>("energystorage/findAllByStation", { stationId, start: page, pageSize, isUseChangeUnit: true });
    return Array.isArray(r.data) ? r.data : (r.data?.list ?? []);
  }
  /** Detalhe em tempo real de um equipamento (tensões, correntes, potência). */
  device(id: number | string) {
    return this.post("energystorage/energyStorageInfo", undefined, { id, isUseChangeUnit: true }).then((r) => r.data);
  }
  /** Série histórica da usina (objectType 1). */
  sample(id: number | string, period: Period, start: Date, end: Date) {
    return this.post("sample/getToCSample", {
      id: Number(id),
      startTime: fmtDateTime(start, this.timeZone),
      endTime: fmtDateTime(end, this.timeZone),
      timeType: TIME_TYPE[period],
      objectType: 1,
    }).then((r) => r.data);
  }
  /** Alarmes da usina, mais recentes primeiro. */
  async alarms(stationId: number | string, page = 1, pageSize = 20): Promise<Record<string, any>[]> {
    const r = await this.post<any>("alarm/findAllFilter", {
      powerStationFilter: [Number(stationId)],
      filterTime: null,
      alarmType: null,
      level: null,
      pageSize,
      start: page,
      sn: "",
      fuzzyQueryId: true,
      showDescribe: true,
    });
    return Array.isArray(r.data) ? r.data : [];
  }
}
