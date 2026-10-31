/** Cliente mínimo da Evolution API v2 (WhatsApp não oficial, self-hosted). */
export interface EvolutionConfig {
  url: string;
  apiKey: string;
  instance: string;
}

export type ConnectionState = "open" | "connecting" | "close" | "unknown";

export function evolutionFromEnv(env = process.env): EvolutionConfig {
  return {
    url: (env.EVOLUTION_URL ?? "http://localhost:8080").replace(/\/$/, ""),
    apiKey: env.EVOLUTION_API_KEY ?? "",
    instance: env.EVOLUTION_INSTANCE ?? "solplanet",
  };
}

/** Parte do login usada no nome da instância: legível e só com [a-z0-9]. Telefone vira "tel" + 4 últimos dígitos. */
function slug(login: string) {
  const local = login.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^\d+$/.test(local)) return `tel${local.slice(-4)}`;
  return local.slice(0, 24) || "conta";
}

/**
 * Cada conta do dashboard tem a própria instância (e, portanto, o próprio número de WhatsApp), nomeada para
 * dar para saber de quem é no Manager da Evolution: `solar-<login>-<id>`, ex.: solar-ranieryfialho-1.
 * O prefixo evita colidir com instâncias de outros apps no mesmo servidor; o id garante nome único.
 */
export function instanceName(accountId: number, login: string, env = process.env) {
  return `${env.EVOLUTION_INSTANCE_PREFIX ?? "solar"}-${slug(login)}-${accountId}`;
}

export function evolutionFor(accountId: number, login: string, env = process.env) {
  return new Evolution({ ...evolutionFromEnv(env), instance: instanceName(accountId, login, env) });
}

export interface WaContact {
  /** número com DDI (5585999999999), no formato aceito por sendText */
  number: string;
  name: string;
}

export class Evolution {
  constructor(readonly cfg: EvolutionConfig = evolutionFromEnv()) {}

  get configured() {
    return Boolean(this.cfg.apiKey);
  }

  private async call<T = any>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
    const res = await fetch(`${this.cfg.url}${path}`, {
      ...init,
      headers: { "content-type": "application/json", apikey: this.cfg.apiKey, ...init?.headers },
      signal: AbortSignal.timeout(init?.timeoutMs ?? 20_000),
    });
    if (!res.ok) throw new Error(`Evolution ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T>;
  }

  sendText(number: string, text: string) {
    return this.call(`/message/sendText/${this.cfg.instance}`, { method: "POST", body: JSON.stringify({ number, text }) });
  }

  async state(): Promise<{ state: ConnectionState; number?: string }> {
    try {
      const r = await this.call<{ instance?: { state?: string } }>(`/instance/connectionState/${this.cfg.instance}`);
      const state = (r.instance?.state ?? "unknown") as ConnectionState;
      let number: string | undefined;
      if (state === "open") {
        const list = await this.call<any[]>(`/instance/fetchInstances?instanceName=${this.cfg.instance}`).catch(() => []);
        const owner: string | undefined = list?.[0]?.ownerJid ?? list?.[0]?.instance?.owner;
        number = owner?.split("@")[0];
      }
      return { state, number };
    } catch {
      return { state: "unknown" };
    }
  }

  /** Cria a instância se não existir e devolve o QR code (data URL) para parear. */
  async connect(): Promise<{ qr?: string; state: ConnectionState }> {
    const { state } = await this.state();
    if (state === "open") return { state };
    if (state === "unknown") {
      await this.call(`/instance/create`, {
        method: "POST",
        body: JSON.stringify({ instanceName: this.cfg.instance, integration: "WHATSAPP-BAILEYS", qrcode: true }),
      }).catch(() => undefined);
    }
    const r = await this.call<{ base64?: string }>(`/instance/connect/${this.cfg.instance}`);
    return { qr: r.base64, state: "connecting" };
  }

  /** A doc promete um array puro; aceita também o formato envelopado ({ data: [...] }). */
  private static rows(raw: unknown): any[] {
    return Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: any[] }).data : [];
  }

  async listGroups(): Promise<{ id: string; subject: string }[]> {
    // a Evolution busca os metadados de cada grupo: com ~100 grupos passa de 20 s
    const raw = await this.call(`/group/fetchAllGroups/${this.cfg.instance}?getParticipants=false`, { timeoutMs: 120_000 });
    return Evolution.rows(raw)
      .map((g) => ({ id: String(g.id ?? g.jid ?? ""), subject: String(g.subject ?? g.name ?? "") }))
      .filter((g) => g.id);
  }

  /**
   * Contatos da agenda do número pareado (só pessoas; grupos vêm de listGroups).
   * A Evolution devolve tudo que o número já viu (milhares de entradas, incluindo membros de grupos e
   * @lid); `isSaved` separa quem está de fato na agenda.
   */
  async listContacts(): Promise<WaContact[]> {
    const raw = await this.call(`/chat/findContacts/${this.cfg.instance}`, { method: "POST", body: JSON.stringify({ where: {} }) });
    const byNumber = new Map<string, WaContact>();
    for (const c of Evolution.rows(raw)) {
      const jid: string = c.remoteJid ?? c.id ?? "";
      // @lid, @g.us, newsletter e bots ficam de fora: sendText precisa do número
      if (!jid.endsWith("@s.whatsapp.net") || c.isSaved === false) continue;
      const number = jid.split("@")[0];
      if (!byNumber.has(number)) byNumber.set(number, { number, name: c.pushName || c.name || `+${number}` });
    }
    return [...byNumber.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  /** Desconecta o número (a instância continua; dá para parear de novo). */
  logout() {
    return this.call(`/instance/logout/${this.cfg.instance}`, { method: "DELETE" });
  }
}
