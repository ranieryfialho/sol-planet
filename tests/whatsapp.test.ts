import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { Waha, sessionName } from "../packages/whatsapp/src/index";

const env = {} as NodeJS.ProcessEnv;

test("o nome da sessão identifica quem é: solar-<login>-<id>", () => {
  assert.equal(sessionName(1, "ranieryfialho@gmail.com", env), "solar-ranieryfialho-1");
  assert.equal(sessionName(7, "Maria.Souza+solar@Empresa.com.br", env), "solar-mariasouzasolar-7");
});

test("telefone não vai inteiro para o nome: só os 4 últimos dígitos", () => {
  assert.equal(sessionName(3, "+55 85 99998-5587", env), "solar-tel5587-3");
});

test("login vazio ou só símbolos cai em 'conta' e o id mantém o nome único", () => {
  assert.equal(sessionName(2, "@@@", env), "solar-conta-2");
  assert.notEqual(sessionName(1, "a@x.com", env), sessionName(2, "a@x.com", env));
});

test("prefixo configurável e login longo é cortado", () => {
  assert.equal(sessionName(1, "ab@x.com", { WAHA_SESSION_PREFIX: "casa" } as NodeJS.ProcessEnv), "casa-ab-1");
  assert.equal(sessionName(1, `${"a".repeat(40)}@x.com`, env), `solar-${"a".repeat(24)}-1`);
});

/**
 * WAHA simulado: responde por "MÉTODO caminho" (rota ausente = 404) e registra as chamadas.
 * Uma rota em lista de listas ({ cada: [...] }) devolve um item por chamada, repetindo o último.
 */
function fakeWaha(routes: Record<string, unknown>, cada: Record<string, unknown[]> = {}) {
  const calls: { key: string; body?: { chatId?: string; text?: string } }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const fila = cada[key];
    const body = fila ? (fila.length > 1 ? fila.shift() : fila[0]) : routes[key];
    return body === undefined ? new Response("não encontrado", { status: 404 }) : Response.json(body);
  });
  return calls;
}
const client = (session = "solar-teste-1") => new Waha({ url: "http://waha:3000", apiKey: "chave", session }, 0);

afterEach(() => vi.unstubAllGlobals());

test("o estado do WAHA vira open, connecting ou close", async () => {
  for (const [status, esperado] of [["WORKING", "open"], ["SCAN_QR_CODE", "connecting"], ["STARTING", "connecting"], ["STOPPED", "close"], ["FAILED", "close"]]) {
    fakeWaha({ "GET /api/sessions/solar-teste-1": { status, me: status === "WORKING" ? { id: "5585999990000@c.us" } : null } });
    assert.equal((await client().state()).state, esperado, status);
  }
  fakeWaha({});
  assert.equal((await client().state()).state, "close", "sessão inexistente");
});

test("conectar cria a sessão que falta, espera o QR e devolve a imagem", async () => {
  const calls = fakeWaha(
    { "POST /api/sessions": {}, "GET /api/solar-teste-1/auth/qr": { mimetype: "image/png", data: "AAAA" } },
    // a primeira consulta responde 404 (sessão ainda não existe)
    { "GET /api/sessions/solar-teste-1": [undefined, { status: "STARTING" }, { status: "SCAN_QR_CODE" }] },
  );
  assert.deepEqual(await client().connect(), { qr: "data:image/png;base64,AAAA", state: "connecting" });
  assert.ok(calls.some((c) => c.key === "POST /api/sessions"));
});

test("sessão que falhou é reiniciada antes de pedir o QR", async () => {
  const calls = fakeWaha(
    { "POST /api/sessions/solar-teste-1/restart": {}, "GET /api/solar-teste-1/auth/qr": { data: "BBBB" } },
    { "GET /api/sessions/solar-teste-1": [{ status: "FAILED" }, { status: "SCAN_QR_CODE" }] },
  );
  assert.equal((await client().connect()).qr, "data:image/png;base64,BBBB");
  assert.ok(calls.some((c) => c.key.endsWith("/restart")));
});

test("envio para número usa o chatId confirmado pelo WAHA; grupo vai direto", async () => {
  const calls = fakeWaha({
    "GET /api/contacts/check-exists": { numberExists: true, chatId: "558599990000@c.us" },
    "POST /api/sendText": {},
  });
  await client().sendText("5585999990000", "oi");
  await client().sendText("120363000000000000@g.us", "oi");
  const enviados = calls.filter((c) => c.key === "POST /api/sendText").map((c) => c.body?.chatId);
  assert.deepEqual(enviados, ["558599990000@c.us", "120363000000000000@g.us"]);
  assert.equal(calls.filter((c) => c.key.endsWith("check-exists")).length, 1);
  assert.match(calls.at(-1)?.body?.text ?? "", /Mensagem automática/);
});

test("número sem WhatsApp não é enviado", async () => {
  const calls = fakeWaha({ "GET /api/contacts/check-exists": { numberExists: false } });
  await assert.rejects(client().sendText("5585000000000", "oi"), /não foi encontrado/);
  assert.ok(!calls.some((c) => c.key === "POST /api/sendText"));
});

test("grupos no formato GOWS e contatos só os salvos na agenda", async () => {
  fakeWaha({
    "GET /api/solar-teste-1/groups": [{ JID: "1@g.us", Name: "Família" }],
    "GET /api/contacts/all": [
      { id: "5511@c.us", name: "Zeca" },
      { id: "5522@c.us", name: "Ana" },
      { id: "5533@c.us", pushname: "Desconhecido" },
      { id: "999@lid", name: "Oculto" },
    ],
  });
  assert.deepEqual(await client().listGroups(), [{ id: "1@g.us", subject: "Família" }]);
  assert.deepEqual(await client().listContacts(), [{ number: "5522", name: "Ana" }, { number: "5511", name: "Zeca" }]);
});

test("desconectar faz logout e depois para a sessão", async () => {
  const calls = fakeWaha({ "POST /api/sessions/solar-teste-1/logout": {}, "POST /api/sessions/solar-teste-1/stop": {} });
  await client().logout();
  assert.deepEqual(calls.map((c) => c.key.split("/").at(-1)), ["logout", "stop"]);
});
