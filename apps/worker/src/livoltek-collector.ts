import { accountKey, getKv, getSettings, kv, type Db, type Settings } from "@sol/db";
import { LivoltekClient, LivoltekError, type Server } from "@sol/livoltek";
import { eq } from "drizzle-orm";
import { config } from "./config";
import { notify, type Who } from "./whatsapp";

/**
 * Coletor de uma conta Livoltek. Por enquanto: login, lista de usinas, aviso de API fora e de conta sem usina.
 *
 * Gravar a usina (plants/readings/daily_energy) depende dos campos reais das respostas, que só aparecem
 * quando a conta tiver usina vinculada. Até lá a lista crua fica no kv (`livoltek_stations:<conta>`) para o
 * mapeamento, e nada é inventado. Atenção: os ids da Livoltek passam de 2^31 (ex.: 464946968203264), então
 * plants.id (integer) vai precisar de bigint ou de um id próprio.
 */
export class LivoltekCollector {
  private client: LivoltekClient;
  private loggedIn = false;
  private apiFailures = 0;
  private apiDownNotified = false;
  /** Login recusado: não insiste com a mesma senha (a Livoltek passa a pedir captcha depois de alguns erros). */
  private rejected = false;
  stationCount = 0;
  ticked = false;
  settings!: Settings;

  constructor(
    private db: Db,
    readonly accountId: number,
    private creds: { account: string; password: string },
  ) {
    this.client = new LivoltekClient((process.env.LIVOLTEK_SERVER ?? "international") as Server, "en", config.timezone);
  }

  get who(): Who {
    return { id: this.accountId, login: this.creds.account };
  }

  /** Relatórios só fazem sentido com usina gravada; até o mapeamento ficar pronto, não há. */
  get hasPlants() {
    return false;
  }

  setPassword(password: string) {
    if (password === this.creds.password) return;
    this.creds = { ...this.creds, password };
    this.loggedIn = false;
    this.rejected = false;
  }

  private async login() {
    try {
      await this.client.login(this.creds.account, this.creds.password);
    } catch (e) {
      if (e instanceof LivoltekError && e.code) this.rejected = true;
      throw e;
    }
    this.loggedIn = true;
    console.log(`[livoltek ${this.creds.account}] login ok`);
  }

  /** Chama a API refazendo login uma vez se o token venceu (a sessão dura 30 dias). */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.loggedIn) await this.login();
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof LivoltekError && e.tokenExpired)) throw e;
      await this.login();
      return fn();
    }
  }

  async tick(_claimed: Set<number> = new Set()) {
    this.ticked = true;
    this.settings = await getSettings(this.db, this.accountId);
    if (this.rejected) return; // espera a pessoa entrar de novo no dashboard com a senha nova

    let stations: Record<string, any>[];
    try {
      stations = await this.call(() => this.client.stations());
      if (this.apiDownNotified) await notify(this.who, "✅ API da Livoltek respondendo novamente.", this.settings);
      this.apiFailures = 0;
      this.apiDownNotified = false;
    } catch (e) {
      this.apiFailures++;
      this.loggedIn = false;
      console.error(`[livoltek ${this.creds.account}] falha na coleta (${this.apiFailures}x):`, e);
      if (this.rejected) {
        await notify(this.who, `🔑 A Livoltek recusou o login de ${this.creds.account}. Entre de novo no dashboard com a senha atual do app My Livoltek.`, this.settings);
      } else if (this.apiFailures >= config.apiFailureThreshold && !this.apiDownNotified) {
        this.apiDownNotified = true;
        await notify(this.who, `❓ Não consigo consultar a Livoltek (${this.creds.account}) há ${this.apiFailures} tentativas.\n${String(e).slice(0, 200)}`, this.settings);
      }
      return;
    }

    this.stationCount = stations.length;
    // mesma marca que a tela inicial usa para "a conta entrou, mas não tem usina"
    const emptyKey = accountKey("no_plants", this.accountId);
    const now = new Date().toISOString();
    if (!stations.length) {
      console.warn(`[livoltek ${this.creds.account}] a conta entrou, mas a Livoltek não devolveu nenhuma usina`);
      await this.db.insert(kv).values({ key: emptyKey, value: now }).onConflictDoUpdate({ target: kv.key, set: { value: now, updatedAt: new Date() } });
      return;
    }
    if ((await getKv(this.db, emptyKey)) !== undefined) await this.db.delete(kv).where(eq(kv.key, emptyKey));

    const rawKey = accountKey("livoltek_stations", this.accountId);
    await this.db.insert(kv).values({ key: rawKey, value: stations }).onConflictDoUpdate({ target: kv.key, set: { value: stations, updatedAt: new Date() } });
    console.warn(`[livoltek ${this.creds.account}] ${stations.length} usina(s) encontrada(s); gravação pendente do mapeamento dos campos (rode o probe)`);
  }
}
