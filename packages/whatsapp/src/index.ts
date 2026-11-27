/** Cliente mínimo do WAHA (WhatsApp não oficial, self-hosted; engine GOWS). */
export interface WahaConfig {
  url: string;
  apiKey: string;
  session: string;
}

export type ConnectionState = "open" | "connecting" | "close" | "unknown";

export function wahaFromEnv(env = process.env): Omit<WahaConfig, "session"> {
  return {
    url: (env.WAHA_URL ?? "http://localhost:3015").replace(/\/$/, ""),
    apiKey: env.WAHA_API_KEY ?? "",
  };
}

/** Parte do login usada no nome da sessão: legível e só com [a-z0-9]. Telefone vira "tel" + 4 últimos dígitos. */
function slug(login: string) {
  const local = login.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^\d+$/.test(local)) return `tel${local.slice(-4)}`;
  return local.slice(0, 24) || "conta";
}

/**
 * Cada conta do dashboard tem a própria sessão (e, portanto, o próprio número de WhatsApp), nomeada para
 * dar para saber de quem é no painel do WAHA: `solar-<login>-<id>`, ex.: solar-ranieryfialho-1.
 * O prefixo evita colidir com sessões de outros apps no mesmo servidor; o id garante nome único.
 * O WAHA aceita até 54 caracteres.
 */
export function sessionName(accountId: number, login: string, env = process.env) {
  return `${env.WAHA_SESSION_PREFIX ?? "solar"}-${slug(login)}-${accountId}`;
}

export const AUTO_FOOTER = "\n\n_🤖 Mensagem automática do monitor Solar. Não precisa responder._";

export function wahaFor(accountId: number, login: string, env = process.env) {
  return new Waha({ ...wahaFromEnv(env), session: sessionName(accountId, login, env) });
}

export interface WaContact {
  /** número com DDI (5585999999999), no formato aceito por sendText */
  number: string;
  name: string;
}

export interface SendTarget {
  to: string;
  name: string;
  enabled: boolean;
}

// número pareado por sessão, em memória (evita uma consulta de estado a cada mensagem)
const ownNumbers = new Map<string, { at: number; number: string }>();
const OWN_NUMBER_TTL_MS = 10 * 60_000;

const PAIRING_MAX_POLLS = 20;

/** Estado da sessão no WAHA; NOT_FOUND quando ela ainda não foi criada. */
interface Session {
  status: string;
  number?: string;
}

export class WahaError extends Error {
  constructor(readonly status: number, path: string, body: string) {
    super(`WAHA ${status} ${path}: ${body.slice(0, 300)}`);
  }
}

export class Waha {
  constructor(
    readonly cfg: WahaConfig,
    private readonly pollMs = 1000,
  ) {}

  get configured() {
    return Boolean(this.cfg.apiKey);
  }

  private async call<T = any>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
    const res = await fetch(`${this.cfg.url}${path}`, {
      ...init,
      headers: { "content-type": "application/json", accept: "application/json", "x-api-key": this.cfg.apiKey, ...init?.headers },
      signal: AbortSignal.timeout(init?.timeoutMs ?? 30_000),
    });
    if (!res.ok) throw new WahaError(res.status, path, await res.text());
    return res.json() as Promise<T>;
  }

  /** O envio precisa do chatId real: números brasileiros podem estar registrados com ou sem o 9º dígito. */
  private async chatId(to: string): Promise<string> {
    if (to.endsWith("@s.whatsapp.net")) return to.replace("@s.whatsapp.net", "@c.us");
    if (to.includes("@")) return to;
    const query = new URLSearchParams({ phone: to.replace(/\D/g, ""), session: this.cfg.session });
    const found = await this.call<{ numberExists?: boolean; chatId?: string }>(`/api/contacts/check-exists?${query}`);
    if (!found.numberExists || !found.chatId) throw new Error(`o número ${to} não foi encontrado no WhatsApp`);
    return found.chatId;
  }

  /** Toda mensagem sai com o aviso de que é automática: quem recebe sabe de onde veio e que não adianta responder. */
  async sendText(to: string, text: string) {
    const chatId = await this.chatId(to);
    return this.call(`/api/sendText`, { method: "POST", body: JSON.stringify({ session: this.cfg.session, chatId, text: `${text}${AUTO_FOOTER}` }) });
  }

  private async session(): Promise<Session> {
    try {
      const r = await this.call<{ status?: string; me?: { id?: string } | null }>(`/api/sessions/${this.cfg.session}`);
      return { status: r.status ?? "STOPPED", number: r.me?.id?.split("@")[0] };
    } catch (e) {
      if (e instanceof WahaError && e.status === 404) return { status: "NOT_FOUND" };
      throw e;
    }
  }

  async state(): Promise<{ state: ConnectionState; number?: string }> {
    try {
      const { status, number } = await this.session();
      if (status === "WORKING") return { state: "open", number };
      return { state: ["STOPPED", "FAILED", "NOT_FOUND"].includes(status) ? "close" : "connecting" };
    } catch {
      return { state: "unknown" };
    }
  }

  private action(name: "start" | "stop" | "restart" | "logout") {
    return this.call(`/api/sessions/${this.cfg.session}/${name}`, { method: "POST" });
  }

  /**
   * Devolve o QR code (data URL) para parear: cria a sessão se não existir, inicia a que está parada,
   * reinicia a que falhou (QR vencido sem leitura) e espera o WAHA gerar o código.
   */
  async connect(): Promise<{ qr?: string; state: ConnectionState }> {
    let { status } = await this.session();
    if (status === "NOT_FOUND") {
      // 422: outra requisição criou a sessão nesse meio tempo
      await this.call(`/api/sessions`, { method: "POST", body: JSON.stringify({ name: this.cfg.session, start: true }) }).catch((e) => {
        if (!(e instanceof WahaError && e.status === 422)) throw e;
      });
    }
    if (status === "STOPPED") await this.action("start");
    if (status === "FAILED") await this.action("restart");

    for (let poll = 0; poll < PAIRING_MAX_POLLS && status !== "WORKING" && status !== "SCAN_QR_CODE"; poll++) {
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
      status = (await this.session()).status;
    }
    if (status === "WORKING") return { state: "open" };
    if (status !== "SCAN_QR_CODE") throw new Error(`o WAHA ainda não gerou o QR code (estado: ${status}); tente de novo`);

    const r = await this.call<{ mimetype?: string; data?: string }>(`/api/${this.cfg.session}/auth/qr?format=image`);
    return { qr: r.data ? `data:${r.mimetype ?? "image/png"};base64,${r.data}` : undefined, state: "connecting" };
  }

  /** A engine GOWS devolve JID/Name; as outras, id/subject. */
  async listGroups(): Promise<{ id: string; subject: string }[]> {
    // com muitos grupos a listagem pode demorar
    const raw = await this.call<unknown>(`/api/${this.cfg.session}/groups?exclude=participants`, { timeoutMs: 120_000 });
    const rows: any[] = Array.isArray(raw) ? raw : Object.values((raw ?? {}) as object);
    return rows.map((g) => ({ id: String(g.JID ?? g.id ?? ""), subject: String(g.Name ?? g.subject ?? "") })).filter((g) => g.id);
  }

  /**
   * Contatos da agenda do número pareado (só pessoas; grupos vêm de listGroups).
   * O WAHA devolve tudo que o número já viu (milhares de entradas, incluindo membros de grupos e @lid);
   * só quem está salvo na agenda vem com `name` (o `pushname` é o nome que a própria pessoa escolheu).
   */
  async listContacts(): Promise<WaContact[]> {
    const query = new URLSearchParams({ session: this.cfg.session });
    const rows = await this.call<any[]>(`/api/contacts/all?${query}`, { timeoutMs: 60_000 });
    const byNumber = new Map<string, WaContact>();
    for (const c of rows) {
      const id: string = c.id ?? "";
      // @lid, @g.us, newsletter e bots ficam de fora: o destinatário é salvo pelo número
      if (!id.endsWith("@c.us") || !c.name) continue;
      const number = id.split("@")[0];
      if (!byNumber.has(number)) byNumber.set(number, { number, name: c.name });
    }
    return [...byNumber.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  /** Número pareado nesta sessão (com cache); undefined se o WhatsApp não está conectado. */
  async ownNumber(): Promise<string | undefined> {
    const hit = ownNumbers.get(this.cfg.session);
    if (hit && Date.now() - hit.at < OWN_NUMBER_TTL_MS) return hit.number;
    const { state, number } = await this.state();
    if (state !== "open" || !number) return undefined;
    ownNumbers.set(this.cfg.session, { at: Date.now(), number });
    return number;
  }

  /**
   * Para quem enviar: os destinatários ativos. Sem nenhum cadastrado, o próprio número conectado
   * (quem parear o WhatsApp e não escolher ninguém recebe os avisos no próprio celular).
   */
  async resolveTargets(recipients: SendTarget[]): Promise<{ targets: SendTarget[]; self: boolean }> {
    const active = recipients.filter((r) => r.enabled);
    if (active.length) return { targets: active, self: false };
    const me = await this.ownNumber();
    return me ? { targets: [{ to: me, name: "Você", enabled: true }], self: true } : { targets: [], self: false };
  }

  /** Desconecta o número. O logout reinicia a sessão (voltaria a gerar QR codes), por isso o stop em seguida. */
  async logout() {
    ownNumbers.delete(this.cfg.session);
    await this.action("logout");
    await this.action("stop");
  }
}
