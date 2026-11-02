import { bigserial, boolean, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** Contas (Solplanet ou Livoltek) que o dashboard aceita e o worker coleta (senha cifrada com AES-256-GCM). */
export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    /** fornecedor do app: solplanet | livoltek */
    provider: text("provider").notNull().default("solplanet"),
    /** login da conta no app do fornecedor, em minúsculas (e-mail, telefone ou usuário) */
    account: text("account").notNull(),
    passwordEnc: text("password_enc").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // o mesmo e-mail pode ter conta nos dois fornecedores
  (t) => [uniqueIndex("accounts_provider_account_idx").on(t.provider, t.account)],
);

/** Estado atual de cada usina (uma linha por stationid). */
export const plants = pgTable("plants", {
  id: integer("id").primaryKey(), // stationid da Solplanet
  /** dona da usina; null só em dados antigos, atribuídos à conta principal na primeira coleta */
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  capacityKwp: doublePrecision("capacity_kwp"),
  status: integer("status").notNull(),
  powerW: doublePrecision("power_w").notNull().default(0),
  todayKwh: doublePrecision("today_kwh").notNull().default(0),
  totalKwh: doublePrecision("total_kwh").notNull().default(0),
  /** desde quando a usina está em estado ruim (offline/alerta/erro) */
  badSince: timestamp("bad_since", { withTimezone: true }),
  /** já notificamos esse estado ruim? */
  alertedAt: timestamp("alerted_at", { withTimezone: true }),
  monthKwh: doublePrecision("month_kwh"),
  /** CO₂ evitado em kg (savings da API, quando vier) */
  co2Kg: doublePrecision("co2_kg"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  /** último fluxo de energia (PlantFlow) */
  flow: jsonb("flow"),
  /** tem medidor de consumo / bateria (flags do fluxo) */
  hasMeter: boolean("has_meter").notNull().default(false),
  hasBattery: boolean("has_battery").notNull().default(false),
  raw: jsonb("raw"),
  detail: jsonb("detail"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Quem enxerga cada usina. Uma usina pode ter várias contas (ex.: dois irmãos); ela é coletada uma vez só
 * e cada conta vê os mesmos dados. `plants.account_id` é só a última conta que coletou.
 */
export const accountPlants = pgTable(
  "account_plants",
  {
    accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.plantId] })],
);

/** Inversores de cada usina, com os últimos parâmetros em tempo real. */
export const inverters = pgTable("inverters", {
  sn: text("sn").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  name: text("name"),
  model: text("model"),
  status: integer("status"),
  powerW: doublePrecision("power_w"),
  /** strings fotovoltaicas: [{name, v, i, p}] */
  pv: jsonb("pv"),
  /** saída AC: [{name, v, i, p}] */
  ac: jsonb("ac"),
  raw: jsonb("raw"),
  params: jsonb("params"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Curva de potência oficial da Solplanet (pontos de 10 min do gráfico diário do app). */
export const powerPoints = pgTable(
  "power_points",
  {
    plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    /** W (soma dos inversores, saída AC) */
    powerW: doublePrecision("power_w").notNull(),
  },
  (t) => [primaryKey({ columns: [t.plantId, t.ts] })],
);

/** Série temporal de leituras (uma por coleta). */
export const readings = pgTable(
  "readings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    status: integer("status").notNull(),
    powerW: doublePrecision("power_w").notNull(),
    todayKwh: doublePrecision("today_kwh").notNull(),
    totalKwh: doublePrecision("total_kwh").notNull(),
    /** W, só com medidor */
    loadW: doublePrecision("load_w"),
    /** W, > 0 comprando da rede, < 0 injetando */
    gridW: doublePrecision("grid_w"),
    batteryW: doublePrecision("battery_w"),
    soc: doublePrecision("soc"),
  },
  (t) => [index("readings_plant_ts_idx").on(t.plantId, t.ts)],
);

/** Geração por dia (upsert com o maior etoday visto no dia). */
export const dailyEnergy = pgTable(
  "daily_energy",
  {
    plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    energyKwh: doublePrecision("energy_kwh").notNull(),
    peakW: doublePrecision("peak_w").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.plantId, t.day] })],
);

/** Eventos notificados: mudança de status e erros vindos da API. */
export const alerts = pgTable(
  "alerts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    plantId: integer("plant_id"),
    /** conta cujas regras dispararam o alerta (null: alertas antigos, de todas as contas da usina) */
    accountId: integer("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    /** offline | warning | error | recovered | fault */
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    errorCode: text("error_code"),
    deviceSn: text("device_sn"),
    /** chave de deduplicação para erros da API (isno|errCode|occdt) */
    fingerprint: text("fingerprint").unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [index("alerts_occurred_idx").on(t.occurredAt)],
);

/** Apps de IA (Gemini, Claude…) registrados sozinhos no OAuth do MCP (registro dinâmico de cliente). */
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Códigos de autorização (uso único, 5 min). Só o hash fica no banco. */
export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Tokens do MCP (access e refresh). Só o hash fica no banco; revogar = apagar a linha. */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    /** access | refresh */
    kind: text("kind").notNull(),
    clientId: text("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
    accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oauth_tokens_account_idx").on(t.accountId, t.clientId)],
);

/** Chave/valor para estado do worker (ex.: último relatório enviado). */
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
