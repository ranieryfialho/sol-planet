import type { Region } from "@sol/solplanet";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente ${name} não definida`);
  return v;
}

/** Só o que não é editável pelo dashboard. Regras, destinatários e horário ficam em Settings (banco). */
export const config = {
  solplanet: {
    // opcionais: as contas vêm da tabela accounts (login no dashboard); com elas, a conta é semeada na partida
    account: process.env.SOLPLANET_ACCOUNT ?? "",
    password: process.env.SOLPLANET_PASSWORD ?? "",
    region: (process.env.SOLPLANET_REGION ?? "singapore") as Region,
    locale: process.env.SOLPLANET_LOCALE ?? "en",
  },
  timezone: process.env.TZ ?? "America/Sao_Paulo",
  pollMinutes: Number(process.env.POLL_MINUTES ?? 5),
  /** quantas falhas seguidas da API antes de avisar */
  apiFailureThreshold: Number(process.env.API_FAILURE_THRESHOLD ?? 3),
};

/** Deslocamento do fuso configurado em ms (ex.: -3h → -10800000) num instante. */
function tzOffset(at: number) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: config.timezone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-03:00"
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600_000 + Number(m[3]) * 60_000) : 0;
}

/** Instante da meia-noite local (no fuso configurado) de um dia yyyy-mm-dd. */
export function zonedMidnight(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return utc - tzOffset(utc);
}

/** Soma n dias a uma data yyyy-mm-dd. */
export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Data/hora local no fuso configurado. */
export function localNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
  };
}
