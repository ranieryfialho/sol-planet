/**
 * Cliente da API cloud do app Solplanet (com.aiswei.international 5.2.1).
 *
 * Protocolo extraído do APK:
 * - Gateway Alibaba Cloud API: assinatura HMAC-SHA256 nos headers x-ca-* (SignUtil / ApiRequestMaker).
 * - appKey/appSecret cifrados no BuildConfig com AES-CBC (chave/IV fixos em AESEncrypt).
 * - /aienergy/user/login devolve token + userId, enviados nos headers `token` e `userid`.
 * - Unidades (ElectricPowerFormat): potência em W, energia em kWh.
 */
import { createDecipheriv, createHash, createHmac, randomUUID } from "node:crypto";

const APP_VERSION = "5.2.1";
const AES_KEY = Buffer.from("AISWEI20@121^23_");
const AES_IV = Buffer.from("a4c88f13ijklm#op");

const FORM = "application/x-www-form-urlencoded; charset=utf-8";
const JSON_CT = "application/json; charset=utf-8";

/** Brasil cai em "singapore" (EnergyRepository.saveServerConfig: fora da UE e da China). */
export const REGIONS = {
  singapore: {
    host: "aienergy-internation.aisweicloud.com",
    key: "rej9ZDMivYrd9xMhp3nocA==",
    secret: "BvtHu1r1vAet+fUVNb7Tk/XAIVBr8/fDf2LPaRJ6iTwBU1DPiIgNO7ZQVVJ1KOgE",
  },
  germany: {
    host: "aienergy-germany.aisweicloud.com",
    key: "oDETA8ZMKVUURWY8aDR2vw==",
    secret: "zgCXJuf1/4cvhbUYt2ax7EPsSBn2Q1W3FrukLN3HZkwmBnwFnppDt8Cujzhi07lw",
  },
  china: {
    host: "intl.aienergy.aisweicloud.com",
    key: "R0F9RQJfKYXS6k45Gx5B9w==",
    secret: "H5+AUtBSe17khRtBeZnabgNeT0QUsVyBpj5/1PL7MFUnO9yZJ3euJyjLa3p9+z39",
  },
} as const;
export type Region = keyof typeof REGIONS;

/** Status da usina em plantlist (PlantListAdapter: 3 = erro, 2 = alerta; 0/1 a confirmar). */
export const PLANT_STATUS: Record<number, string> = { 0: "offline", 1: "normal", 2: "alerta", 3: "erro" };

export interface PlantSummary {
  stationid: number;
  stationname: string;
  status: number;
  /** W */
  power: number;
  /** kWh */
  etoday: number;
  /** kWh */
  etotal: number;
  /** capacidade instalada, string vinda da API */
  totalpower?: string;
  ludt?: number;
  [k: string]: unknown;
}

export interface PlantError {
  isno: string;
  psno?: string;
  errCode: string;
  context?: string;
  plantName?: string;
  stationid?: number;
  level?: number;
  /** epoch ms */
  occdt: number;
  [k: string]: unknown;
}

/** /aienergy/plant/detail/flow/v2 (PlantFlowBean). Potências em W. grid > 0 = comprando da rede, < 0 = injetando (PowerFlowView). */
export interface PlantFlow {
  pv: number;
  grid: number;
  load: number;
  battery: number;
  soc?: string;
  meterFlag?: boolean;
  storageFlag?: boolean;
  ludt?: number;
  [k: string]: unknown;
}

export interface ParamRow {
  name: string;
  v?: string;
  i?: string;
  p?: string;
}

/** /aienergy/plant/storage/detail/v5 (InverterParamsBean) */
export interface InverterParams {
  pvList?: ParamRow[];
  acList?: ParamRow[];
  epsList?: ParamRow[];
  [k: string]: unknown;
}

export interface ProductionChart {
  unit: string;
  time: number[];
  list: { name: "ac" | "dc" | string; value: number[] }[];
}

/** Valores de uma série do gráfico ("ac" por padrão). */
export function chartSeries(chart: ProductionChart | undefined, name = "ac"): number[] {
  return chart?.list?.find((l) => l.name === name)?.value?.map((v) => Number(v) || 0) ?? [];
}

/** Item de pmuList[].invlist[] */
export interface InverterSummary {
  isno: string;
  psno?: string;
  devtypename?: string;
  alias?: string;
  maxPower?: number;
  /** W */
  pac?: number;
  /** kWh */
  e_today?: number;
  state?: number;
  status?: number;
  cpv?: string;
  [k: string]: unknown;
}

export interface ApiEnvelope<T = any> {
  status_code?: number;
  status_msg?: string;
  data: T;
  time?: number;
}

export class SolplanetError extends Error {
  constructor(message: string, readonly httpStatus?: number, readonly apiCode?: number) {
    super(message);
  }
}

function aesDecrypt(b64: string): string {
  const d = createDecipheriv("aes-128-cbc", AES_KEY, AES_IV);
  return Buffer.concat([d.update(Buffer.from(b64, "base64")), d.final()]).toString();
}

/** java.net.URLEncoder.encode (espaço vira '+', mantém *-._) */
function javaUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

const encodeParams = (p: Record<string, string>) =>
  Object.entries(p).map(([k, v]) => `${k}=${javaUrlEncode(v)}`).join("&");

/** Extrai a lista de um payload que pode vir como array ou {plantlist|list|records|rows|…}. */
export function listOf<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  for (const k of ["plantlist", "list", "records", "rows"]) if (Array.isArray(data?.[k])) return data[k];
  // fallback: primeiro array do objeto (a API muda o nome da chave entre endpoints)
  const first = data && typeof data === "object" ? Object.values(data).find(Array.isArray) : undefined;
  return (first as T[]) ?? [];
}

type Params = Record<string, string | number | undefined | null>;

export class SolplanetClient {
  readonly host: string;
  private readonly appKey: string;
  private readonly appSecret: string;
  token = "";
  userId = "";

  constructor(region: Region = "singapore", private locale = "en", private timeoutMs = 30_000) {
    const r = REGIONS[region];
    this.host = r.host;
    this.appKey = aesDecrypt(r.key);
    this.appSecret = aesDecrypt(r.secret);
  }

  private sign(method: string, path: string, headers: Record<string, string>, query: Record<string, string>, form: Record<string, string>) {
    const caKeys = Object.keys(headers).filter((k) => k.startsWith("x-ca-")).sort();
    const merged = { ...query, ...form };
    const keys = Object.keys(merged).sort();
    let resource = path;
    if (keys.length) resource += "?" + keys.map((k) => (merged[k] ? `${k}=${merged[k]}` : k)).join("&");
    const toSign =
      [method, headers["accept"] ?? "", headers["content-md5"] ?? "", headers["content-type"] ?? "", headers["date"] ?? ""].join("\n") +
      "\n" +
      caKeys.map((k) => `${k}:${headers[k]}\n`).join("") +
      resource;
    headers["x-ca-signature-headers"] = caKeys.join(",");
    headers["x-ca-signature"] = createHmac("sha256", this.appSecret).update(toSign).digest("base64");
  }

  async request<T = any>(method: "GET" | "POST", path: string, opts: { query?: Params; form?: Params; json?: unknown } = {}): Promise<ApiEnvelope<T>> {
    const clean = (p?: Params) =>
      Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
    const query = { locale: this.locale, ...clean(opts.query) };
    const form = clean(opts.form);
    const isJson = opts.json !== undefined;
    const now = new Date();
    const headers: Record<string, string> = {
      date: now.toUTCString(),
      "x-ca-timestamp": String(now.getTime()),
      "x-ca-nonce": randomUUID(),
      "x-ca-key": this.appKey,
      "user-agent": "ALIYUN-ANDROID-DEMO",
      "content-type": isJson ? JSON_CT : FORM,
      accept: isJson ? "application/text; charset=utf-8" : JSON_CT,
      // HttpApi.sendAsyncRequest
      factory: "aiswei",
      token: this.token,
      versionCode: APP_VERSION,
      usertype: "1",
      os: "Android",
      userid: this.userId,
      locale: this.locale,
      region: "1",
    };
    let body: string | undefined;
    if (Object.keys(form).length) {
      body = encodeParams(form);
    } else if (isJson) {
      body = JSON.stringify(opts.json);
      headers["content-md5"] = createHash("md5").update(body).digest("base64");
    }
    this.sign(method, path, headers, query, form);

    const res = await fetch(`https://${this.host}${path}?${encodeParams(query)}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.status !== 200) {
      const msg = res.headers.get("x-ca-error-message") ?? (await res.text()).slice(0, 300);
      throw new SolplanetError(`HTTP ${res.status} ${path}: ${msg}`, res.status);
    }
    const data = (await res.json()) as ApiEnvelope<T>;
    if (data.status_code !== undefined && data.status_code !== 200) {
      throw new SolplanetError(`${path}: status_code=${data.status_code} ${data.status_msg ?? ""}`, 200, data.status_code);
    }
    return data;
  }

  private async get<T = any>(path: string, query: Params = {}): Promise<T> {
    return (await this.request<T>("GET", path, { query: { userid: this.userId || undefined, ...query } })).data;
  }

  async login(account: string, password: string) {
    // HttpApi.login: parâmetro BODY vazio ("" = "") entra na assinatura e no corpo do form
    const { data } = await this.request<{ token: string; userId: string | number; accountType: number }>("POST", "/aienergy/user/login", {
      query: { account, password, isDemo: 0 },
      form: { "": "" },
    });
    this.token = data.token;
    this.userId = String(data.userId);
    return data;
  }

  dashboard() {
    return this.get("/aienergy/plant/dashboard/international");
  }
  /** Mesmos parâmetros do PlantsFragment com o SortFilterBean padrão. */
  async plants(page = 1, size = 50): Promise<PlantSummary[]> {
    return listOf<PlantSummary>(
      await this.get("/aienergy/plant/plantlist/v4", {
        type: 1,
        name: "",
        sortby: 1,
        sort: 2,
        group: "null",
        state: 0,
        own: 1,
        totalpower: 0,
        country: "",
        province: "",
        startdt: 0,
        enddt: 0,
        sn: "",
        page,
        size,
      }),
    );
  }
  plantDetail(id: number | string) {
    return this.get("/aienergy/plant/detail/international/v4", { id });
  }
  plantFlow(id: number | string): Promise<PlantFlow> {
    return this.get("/aienergy/plant/detail/flow/v2", { id });
  }
  async inverters(id: number | string): Promise<Record<string, any>[]> {
    return listOf(await this.get("/aienergy/equip/list/inverter/v3", { id }));
  }
  allDevices(id: number | string) {
    return this.get("/aienergy/equip/list/v6/allData", { id });
  }
  inverterDetail(id: number | string, isno: string) {
    return this.get("/aienergy/equip/invdetail/v2", { id, isno });
  }
  /** date: yyyy-MM-dd */
  inverterChart(id: number | string, isno: string, date: string) {
    return this.get("/aienergy/chart/hyperbola/v2", { id, isno, date });
  }
  /** Parâmetros em tempo real do inversor: pvList/acList com {name, v, i, p} (InverterParamsVm). */
  storageDetail(id: number | string, isno: string): Promise<InverterParams> {
    return this.get("/aienergy/plant/storage/detail/v5", { id, isno });
  }
  /**
   * Histórico de produção (HttpApi.getInverterProductionChart). date = epoch ms dentro do período.
   * daily: 144 pontos de 10 min em W (timestamps no fuso UTC+8 do servidor — use o índice);
   * month: 1 ponto por dia em kWh; year: 1 por mês; total: 1 por ano.
   */
  productionChart(period: "daily" | "week" | "month" | "year" | "total", id: number | string, isno: string, date: number): Promise<ProductionChart> {
    return this.get(`/aienergy/chart/inverter/production/international/v4/${period}`, { id, isno, date });
  }

  /** Inversores da usina, achatando pmuList[].invlist[] (formato de /equip/list/inverter/v3). */
  async inverterList(id: number | string): Promise<InverterSummary[]> {
    const groups = await this.inverters(id);
    const out: InverterSummary[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node.isno === "string" && node.isno) out.push(node);
      for (const k of ["pmuList", "invlist", "invList"]) if (Array.isArray(node[k])) walk(node[k]);
    };
    walk(groups);
    return out;
  }
  async errors(isno = "", page = 1, size = 20): Promise<PlantError[]> {
    return listOf<PlantError>(await this.get("/aienergy/plant/user/errlistByIsno", { isno, page, size }));
  }
}
