import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "vitest";
import { appSecret, decryptSecret, encryptSecret, isPrimaryAccount, normalizeAccount } from "../packages/db/src/accounts";

const saved = { ...process.env };
beforeEach(() => {
  process.env.AUTH_SECRET = "segredo-de-teste";
  delete process.env.SOLPLANET_ACCOUNT;
  delete process.env.ADMIN_ACCOUNT;
});
afterEach(() => {
  process.env = { ...saved };
});

test("cifra e decifra a senha da conta", () => {
  assert.equal(decryptSecret(encryptSecret("minha-senha")), "minha-senha");
});

test("cada cifra usa um IV novo", () => {
  assert.notEqual(encryptSecret("x"), encryptSecret("x"));
});

test("texto adulterado não decifra", () => {
  const enc = encryptSecret("minha-senha");
  const [iv, tag, ct] = enc.split(".");
  assert.equal(decryptSecret([iv, tag, ct.slice(0, -2) + (ct.endsWith("AA") ? "BB" : "AA")].join(".")), null);
  assert.equal(decryptSecret("lixo"), null);
});

test("trocar o AUTH_SECRET torna a senha ilegível (e não derruba)", () => {
  const enc = encryptSecret("minha-senha");
  process.env.AUTH_SECRET = "outro";
  assert.equal(decryptSecret(enc), null);
});

test("sem AUTH_SECRET nem credenciais, recusa em vez de usar um valor fixo", () => {
  delete process.env.AUTH_SECRET;
  assert.throws(() => appSecret(), /AUTH_SECRET/);
});

test("conta administradora: ADMIN_ACCOUNT, senão SOLPLANET_ACCOUNT, ignorando caixa e espaços", () => {
  assert.equal(isPrimaryAccount("a@b.com"), false);
  process.env.SOLPLANET_ACCOUNT = "A@B.com";
  assert.equal(isPrimaryAccount(" a@b.com "), true);
  process.env.ADMIN_ACCOUNT = "admin@x.com";
  assert.equal(isPrimaryAccount("a@b.com"), false);
  assert.equal(isPrimaryAccount("ADMIN@x.com"), true);
  assert.equal(normalizeAccount("  Fulano@X.com "), "fulano@x.com");
});
