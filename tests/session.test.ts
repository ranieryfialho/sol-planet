import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createSession, readSession } from "../apps/web/lib/session";

beforeEach(() => {
  process.env.AUTH_SECRET = "segredo-de-teste";
});

test("sessão válida devolve conta e id", () => {
  assert.deepEqual(readSession(createSession("a@b.com", 7)), { sub: "a@b.com", aid: 7 });
});

test("sem cookie ou com lixo, não há sessão", () => {
  assert.equal(readSession(undefined), null);
  assert.equal(readSession("lixo"), null);
  assert.equal(readSession("a.b"), null);
});

test("payload adulterado é rejeitado (trocar o id de conta)", () => {
  const [payload, sig] = createSession("a@b.com", 7).split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), aid: 1 })).toString("base64url");
  assert.equal(readSession(`${forged}.${sig}`), null);
});

test("sessão assinada com outro segredo é rejeitada", () => {
  const token = createSession("a@b.com", 7);
  process.env.AUTH_SECRET = "outro";
  assert.equal(readSession(token), null);
});

test("sessão expirada é rejeitada", () => {
  const real = Date.now;
  Date.now = () => real() - 31 * 86400_000;
  const token = createSession("a@b.com", 7);
  Date.now = real;
  assert.equal(readSession(token), null);
});
