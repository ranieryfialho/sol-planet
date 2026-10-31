import { addMember, alerts, dailyEnergy, getKv, getSettings, inverters, kv, plants, powerPoints, readings, type Db, type Settings } from "@sol/db";
import { chartSeries, PLANT_STATUS, SolplanetClient, SolplanetError, type ParamRow, type PlantFlow, type PlantSummary } from "@sol/solplanet";
import { eq, sql } from "drizzle-orm";
import { addDays, config, localNow, zonedMidnight } from "./config";
import { runRules } from "./rules";
import { notify, notifyAlert, type Who } from "./whatsapp";

const OFFLINE = 0;
const WARNING = 2;
const ERROR = 3;
const BAD = new Set([OFFLINE, WARNING, ERROR]);
const KIND: Record<number, string> = { [OFFLINE]: "offline", [WARNING]: "warning", [ERROR]: "error" };
const ICON: Record<number, string> = { [OFFLINE]: "🔌", [WARNING]: "⚠️", [ERROR]: "🚨" };

const statusLabel = (s: number) => PLANT_STATUS[s] ?? `status ${s}`;
const fmtW = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};
/** Converte valor com unidade da API (Wh/kWh/MWh/GWh) para kWh. */
const toKwh = (v: unknown, unit?: unknown) => {
  const n = num(v);
  if (n === null) return null;
  const u = String(unit ?? "kWh").toLowerCase();
  return u.startsWith("gwh") ? n * 1e6 : u.startsWith("mwh") ? n * 1e3 : u === "wh" ? n / 1e3 : n;
};
/** Converte massa (kg/t) para kg. */
const toKg = (v: unknown, unit?: unknown) => {
  const n = num(v);
  if (n === null) return null;
  return /^t/i.test(String(unit ?? "kg")) ? n * 1000 : n;
};
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export class Collector {
  private client: SolplanetClient;
  private loggedIn = false;
  private apiFailures = 0;
  private apiDownNotified = false;
  private plantIds: number[] = [];
  settings!: Settings;

  /** Uma instância por conta Solplanet: sessão, contagem de falhas e ajustes são independentes. */
  constructor(
    private db: Db,
    readonly accountId: number,
    private creds: { account: string; password: string },
  ) {
    const { region, locale } = config.solplanet;
    this.client = new SolplanetClient(region, locale);
  }

  get who(): Who {
    return { id: this.accountId, login: this.creds.account };
  }

  /** Atualiza a senha (o usuário pode tê-la trocado) e força novo login se mudou. */
  setPassword(password: string) {
    if (password === this.creds.password) return;
    this.creds = { ...this.creds, password };
    this.loggedIn = false;
  }

  async login() {
    await this.client.login(this.creds.account, this.creds.password);
    this.loggedIn = true;
    console.log(`[${this.creds.account}] login ok (userid ${this.client.userId})`);
  }

  /** Chama a API refazendo login uma vez se o token expirou. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.loggedIn) await this.login();
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof SolplanetError)) throw e;
      console.warn(`${e.message} — refazendo login`);
      await this.login();
      return fn();
    }
  }

  /** Chamada opcional: falha só loga, não derruba o ciclo. */
  private async optional<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await this.call(fn);
    } catch (e) {
      console.warn(`${label} indisponível:`, e instanceof Error ? e.message : e);
      return undefined;
    }
  }

  /**
   * `claimed`: usinas já coletadas neste ciclo por outra conta. Uma usina dividida por duas contas é coletada
   * uma vez só (senão as leituras duplicariam); a conta só passa a enxergá-la.
   */
  async tick(claimed: Set<number> = new Set()) {
    this.settings = await getSettings(this.db, this.accountId);
    let list: PlantSummary[];
    try {
      list = await this.call(() => this.client.plants());
      if (this.apiDownNotified) await notify(this.who, "✅ API da Solplanet respondendo novamente.", this.settings);
      this.apiFailures = 0;
      this.apiDownNotified = false;
    } catch (e) {
      this.apiFailures++;
      this.loggedIn = false;
      console.error(`[${this.creds.account}] falha na coleta (${this.apiFailures}x):`, e);
      if (this.apiFailures >= config.apiFailureThreshold && !this.apiDownNotified) {
        this.apiDownNotified = true;
        await notify(this.who, `❓ Não consigo consultar a Solplanet (${this.creds.account}) há ${this.apiFailures} tentativas.\n${String(e).slice(0, 200)}`, this.settings);
      }
      return;
    }

    this.plantIds = list.map((p) => p.stationid);
    for (const p of list) {
      // a usina precisa existir antes da vinculação (chave estrangeira)
      if (!claimed.has(p.stationid)) {
        claimed.add(p.stationid);
        try {
          await this.savePlant(p);
        } catch (e) {
          claimed.delete(p.stationid); // outra conta que enxergue a usina ainda pode coletá-la neste ciclo
          throw e;
        }
      }
      await addMember(this.db, this.accountId, p.stationid);
      // regras e alertas são desta conta, mesmo que outra conta tenha coletado a usina
      const now = new Date();
      await this.evaluate(p.stationid, p.stationname, Number(p.status), num(p.power) ?? 0, num(p.etoday) ?? 0, now);
      await runRules(this.db, this.who, this.settings, p.stationid, now, localNow(now));
    }
    if (this.settings.rules.inverterErrors) await this.checkErrors();
  }

  private async savePlant(p: PlantSummary) {
    const now = new Date();
    const { day } = localNow(now);
    const id = p.stationid;
    const status = Number(p.status);
    const powerW = num(p.power) ?? 0;
    const todayKwh = num(p.etoday) ?? 0;
    const totalKwh = num(p.etotal) ?? 0;

    const [detailRes, flow] = await Promise.all([
      this.optional("detalhe da usina", () => this.client.plantDetail(id)) as Promise<Record<string, any> | undefined>,
      this.optional("fluxo de energia", () => this.client.plantFlow(id)) as Promise<PlantFlow | undefined>,
    ]);
    // a resposta vem como { permissions, weather, detail: {...} }
    const detail = (detailRes?.detail ?? detailRes) as Record<string, any> | undefined;

    const [prev] = await this.db.select().from(plants).where(eq(plants.id, id));
    const values = {
      accountId: this.accountId,
      name: p.stationname,
      capacityKwp: num(p.totalpower ?? detail?.totalpower),
      status,
      powerW,
      todayKwh,
      totalKwh,
      // a API não manda o mês: a tela soma daily_energy (sincronizado do gráfico mensal)
      monthKwh: detail?.eMonth != null ? toKwh(detail.eMonth, detail.eMonthUnit) : null,
      // co2Val e savings.co2 vêm em kg
      co2Kg: num(detail?.co2Val) ?? num(detail?.savings?.co2) ?? prev?.co2Kg ?? null,
      latitude: num(detail?.latitude) ?? num(p.latitude) ?? prev?.latitude ?? null,
      longitude: num(detail?.longitude) ?? num(p.longitude) ?? prev?.longitude ?? null,
      flow: flow ?? prev?.flow ?? null,
      // o fluxo diz meterFlag=true por padrão do modelo; o detalhe da usina diz se há medidor instalado de fato
      hasMeter: flow ? Boolean(flow.meterFlag) && detail?.meterFlag !== false : (prev?.hasMeter ?? false),
      hasBattery: flow ? Boolean(flow.storageFlag) : (prev?.hasBattery ?? false),
      raw: p,
      detail: detailRes ?? prev?.detail ?? null,
      updatedAt: now,
    };
    await this.db.insert(plants).values({ id, ...values }).onConflictDoUpdate({ target: plants.id, set: values });

    await this.db.insert(readings).values({
      plantId: id,
      ts: now,
      status,
      powerW,
      todayKwh,
      totalKwh,
      loadW: flow?.meterFlag ? num(flow.load) : null,
      gridW: flow?.meterFlag ? num(flow.grid) : null,
      batteryW: flow?.storageFlag ? num(flow.battery) : null,
      soc: flow?.storageFlag ? num(flow.soc) : null,
    });
    await this.db
      .insert(dailyEnergy)
      .values({ plantId: id, day, energyKwh: todayKwh, peakW: powerW })
      .onConflictDoUpdate({
        target: [dailyEnergy.plantId, dailyEnergy.day],
        set: {
          energyKwh: sql`greatest(${dailyEnergy.energyKwh}, excluded.energy_kwh)`,
          peakW: sql`greatest(${dailyEnergy.peakW}, excluded.peak_w)`,
        },
      });

    const sns = await this.saveInverters(id);
    const startDay = detail?.startdt ? localNow(new Date(Number(detail.startdt))).day : null;
    await this.syncHistory(id, sns, startDay);
    console.log(`${p.stationname}: ${statusLabel(status)} | ${fmtW(powerW)} | hoje ${todayKwh} kWh`);
  }

  /** Grava os inversores (pmuList[].invlist[]) com parâmetros em tempo real. Devolve os números de série. */
  private async saveInverters(plantId: number): Promise<string[]> {
    const list = await this.optional("lista de inversores", () => this.client.inverterList(plantId));
    const sns: string[] = [];
    for (const inv of list ?? []) {
      const sn = inv.isno;
      sns.push(sn);
      const params = await this.optional(`parâmetros do inversor ${sn}`, () => this.client.storageDetail(plantId, sn));
      // a API não manda nome nas linhas: PV1, PV2… / L1, L2…
      const named = (rows: ParamRow[] | undefined, prefix: string) => rows?.map((r, i) => ({ ...r, name: r.name ?? `${prefix}${i + 1}` })) ?? null;
      const values = {
        plantId,
        name: inv.alias ?? null,
        model: inv.devtypename ?? inv.alias ?? null,
        status: num(inv.status ?? inv.state),
        powerW: num(params?.pac ?? inv.pac),
        pv: named(params?.pvList, "PV"),
        ac: named(params?.acList, "L"),
        raw: inv,
        params: params ?? null,
        updatedAt: new Date(),
      };
      await this.db.insert(inverters).values({ sn, ...values }).onConflictDoUpdate({ target: inverters.sn, set: values });
    }
    return sns;
  }

  private backfilled = new Set<number>();
  private lastMonthSync = new Map<number, number>();

  /**
   * Sincroniza com os gráficos oficiais do app:
   * - curva de hoje (10 min) a cada ciclo;
   * - geração por dia do mês corrente a cada hora;
   * - no primeiro ciclo, tudo desde a instalação (curvas até 60 dias, meses inteiros).
   */
  private async syncHistory(plantId: number, sns: string[], startDay: string | null) {
    if (!sns.length) return;
    const today = localNow().day;
    const first = !this.backfilled.has(plantId);

    const curveDays = [today];
    if (first) {
      const limit = addDays(today, -60);
      const from = startDay && startDay > limit ? startDay : limit;
      for (let d = addDays(today, -1); d >= from; d = addDays(d, -1)) curveDays.push(d);
    }
    for (const d of curveDays) await this.syncDayCurve(plantId, sns, d);

    const last = this.lastMonthSync.get(plantId) ?? 0;
    if (first || Date.now() - last > 3600_000) {
      const current = today.slice(0, 7);
      const months = [current];
      if (first && startDay) {
        for (let m = startDay.slice(0, 7); m < current; m = addDays(`${m}-28`, 7).slice(0, 7)) months.push(m);
      }
      for (const m of months) await this.syncMonth(plantId, sns, m);
      this.lastMonthSync.set(plantId, Date.now());
    }
    this.backfilled.add(plantId);
  }

  /** Curva de um dia: 144 pontos de 10 min a partir da meia-noite local (o timestamp da API vem em UTC+8). */
  private async syncDayCurve(plantId: number, sns: string[], day: string) {
    const midnight = zonedMidnight(day);
    const sum: number[] = [];
    for (const sn of sns) {
      const chart = await this.optional(`curva ${day}`, () => this.client.productionChart("daily", plantId, sn, midnight + 12 * 3600_000));
      const values = chartSeries(chart);
      // a API rotula como "W", mas manda kW (pico ~5 num inversor de 5 kW; integral bate com o kWh do dia)
      const scale = /^kw$/i.test(chart?.unit ?? "") || Math.max(0, ...values) < 100 ? 1000 : 1;
      values.forEach((v, i) => (sum[i] = (sum[i] ?? 0) + v * scale));
    }
    const now = Date.now();
    const rows = sum
      .map((powerW, i) => ({ plantId, ts: new Date(midnight + i * 600_000), powerW }))
      .filter((r) => r.ts.getTime() <= now);
    if (!rows.length) return;
    await this.db
      .insert(powerPoints)
      .values(rows)
      .onConflictDoUpdate({ target: [powerPoints.plantId, powerPoints.ts], set: { powerW: sql`excluded.power_w` } });
    const peak = Math.max(...rows.map((r) => r.powerW));
    if (peak > 0) {
      await this.db
        .update(dailyEnergy)
        .set({ peakW: sql`greatest(${dailyEnergy.peakW}, ${peak})` })
        .where(sql`${dailyEnergy.plantId} = ${plantId} and ${dailyEnergy.day} = ${day}`);
    }
  }

  /** Geração por dia de um mês (yyyy-mm), direto do gráfico mensal do app. */
  private async syncMonth(plantId: number, sns: string[], month: string) {
    const sum: number[] = [];
    for (const sn of sns) {
      const chart = await this.optional(`mês ${month}`, () => this.client.productionChart("month", plantId, sn, zonedMidnight(`${month}-15`)));
      chartSeries(chart).forEach((v, i) => (sum[i] = (sum[i] ?? 0) + v));
    }
    const today = localNow().day;
    const rows = sum
      .map((energyKwh, i) => ({ plantId, day: `${month}-${String(i + 1).padStart(2, "0")}`, energyKwh, peakW: 0 }))
      .filter((r) => r.energyKwh > 0 && r.day <= today);
    if (!rows.length) return;
    await this.db
      .insert(dailyEnergy)
      .values(rows)
      .onConflictDoUpdate({
        target: [dailyEnergy.plantId, dailyEnergy.day],
        set: { energyKwh: sql`greatest(${dailyEnergy.energyKwh}, excluded.energy_kwh)` },
      });
  }

  private inDaylight(now: Date) {
    const { time } = localNow(now);
    const t = toMinutes(time);
    return t >= toMinutes(this.settings.rules.dayStart) && t < toMinutes(this.settings.rules.dayEnd);
  }

  /**
   * Status da usina contra as regras DESTA conta. O estado (desde quando está ruim, se já avisou) fica
   * por conta e usina no kv, porque cada conta tem tempo de tolerância e destinatários próprios.
   */
  private async evaluate(id: number, name: string, status: number, powerW: number, todayKwh: number, now: Date) {
    const { rules } = this.settings;
    const key = `bad:${this.accountId}:${id}`;
    const prev = await getKv<{ status: number; badSince: string; alertedAt: string | null }>(this.db, key);
    const save = (v: unknown) =>
      this.db.insert(kv).values({ key, value: v }).onConflictDoUpdate({ target: kv.key, set: { value: v, updatedAt: new Date() } });
    const alert = async (kind: string, msg: string, notified: boolean) => {
      if (notified) await notifyAlert(this.db, this.who, this.settings, id, kind, msg);
      await this.db.insert(alerts).values({ plantId: id, accountId: this.accountId, kind, message: msg, occurredAt: now, notifiedAt: notified ? now : null });
    };

    // à noite o inversor desliga e a usina aparece offline: não muda nada
    if (status === OFFLINE && (!rules.offline || (rules.daylightOnly && !this.inDaylight(now)))) return;

    if (BAD.has(status)) {
      const badSince = prev?.badSince ? new Date(prev.badSince) : now;
      const minutes = (now.getTime() - badSince.getTime()) / 60_000;
      const escalated = prev?.alertedAt && prev.status !== status;
      const ready = status !== OFFLINE || minutes >= rules.offlineMinutes;
      let alertedAt = prev?.alertedAt ?? null;

      if (ready && (!alertedAt || escalated)) {
        await alert(
          KIND[status],
          `${ICON[status]} *${name}*: ${statusLabel(status)}
` +
            (status === OFFLINE ? `Sem comunicação há ${Math.round(minutes)} min.` : `Potência: ${fmtW(powerW)} · Hoje: ${todayKwh} kWh`),
          true,
        );
        alertedAt = now.toISOString();
      }
      await save({ status, badSince: badSince.toISOString(), alertedAt });
      return;
    }

    if (prev?.alertedAt) {
      const down = Math.round((now.getTime() - new Date(prev.badSince ?? prev.alertedAt).getTime()) / 60_000);
      await alert("recovered", `✅ *${name}* voltou ao normal após ${down} min · ${fmtW(powerW)}`, rules.recovered);
    }
    if (prev) await this.db.delete(kv).where(eq(kv.key, key));
  }

  /** Códigos de erro dos inversores (lista de notificações do app). */
  private async checkErrors() {
    const errs = await this.optional("lista de erros", () => this.client.errors("", 1, 20));
    if (!errs) return;
    // "primeira execução" vale por conta: conta nova não dispara erros antigos
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(sql`${alerts.kind} = 'fault' and ${alerts.accountId} = ${this.accountId}`);
    const firstRun = count === 0;
    const dayAgo = Date.now() - 24 * 3600_000;

    for (const e of errs) {
      const fingerprint = `${this.accountId}|${e.isno}|${e.errCode}|${e.occdt}`;
      const occurredAt = e.occdt ? new Date(e.occdt) : new Date();
      const msg =
        `🚨 *Erro ${e.errCode}* em ${e.plantName ?? e.isno}\n` +
        `${e.context ?? ""}\n` +
        `Inversor ${e.isno} · ${occurredAt.toLocaleString("pt-BR", { timeZone: config.timezone })}`;
      // na primeira execução só registra o histórico, sem disparar mensagens antigas
      const shouldNotify = !firstRun && occurredAt.getTime() > dayAgo;
      const inserted = await this.db
        .insert(alerts)
        .values({
          plantId: e.stationid ?? this.plantIds[0] ?? null,
          accountId: this.accountId,
          kind: "fault",
          message: msg,
          errorCode: e.errCode,
          deviceSn: e.isno,
          fingerprint,
          occurredAt,
          notifiedAt: shouldNotify ? new Date() : null,
        })
        .onConflictDoNothing({ target: alerts.fingerprint })
        .returning({ id: alerts.id });
      if (inserted.length && shouldNotify) {
        const plantId = e.stationid ?? this.plantIds[0];
        if (plantId) await notifyAlert(this.db, this.who, this.settings, plantId, `fault:${e.errCode}`, msg);
        else await notify(this.who, msg, this.settings);
      }
    }
  }
}
