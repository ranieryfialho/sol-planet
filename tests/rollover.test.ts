import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveToday, type Carry } from "../apps/worker/src/rollover";

const D1 = "2026-11-01";

test("virada do dia: o valor de ontem congelado vale 0 até a API zerar", () => {
  // 00:00, API ainda devolve 33.2 com a usina parada
  let r = resolveToday({ day: "2026-10-31", value: 0 }, D1, 0, 33.2, 0);
  assert.equal(r.todayKwh, 0);
  assert.deepEqual(r.carry, { day: D1, value: 33.2 });
  // 00:02, continua igual
  r = resolveToday(r.carry, D1, 2, 33.2, 0);
  assert.equal(r.todayKwh, 0);
  // 00:05, a API zerou
  r = resolveToday(r.carry, D1, 5, 0, 0);
  assert.equal(r.todayKwh, 0);
  assert.equal(r.carry.value, 0);
  // 09:00, geração real
  r = resolveToday(r.carry, D1, 540, 0.1, 293);
  assert.equal(r.todayKwh, 0.1);
});

test("inversor offline a noite toda: segue 0 até a API mudar, mesmo depois das 03:00", () => {
  let r = resolveToday(undefined, D1, 1, 18.4, 0);
  assert.equal(r.todayKwh, 0);
  for (const min of [200, 300, 350]) {
    r = resolveToday(r.carry, D1, min, 18.4, 0);
    assert.equal(r.todayKwh, 0);
  }
  r = resolveToday(r.carry, D1, 400, 0.2, 400);
  assert.equal(r.todayKwh, 0.2);
});

test("worker reiniciado à tarde com a usina parada não zera um valor verdadeiro", () => {
  const r = resolveToday({ day: "2026-10-31", value: 0 }, D1, 14 * 60, 12.5, 0);
  assert.equal(r.todayKwh, 12.5);
  assert.equal(r.carry.value, 0);
});

test("dia normal: a leitura passa sem alteração", () => {
  let r = resolveToday(undefined, D1, 0, 0, 0);
  assert.equal(r.todayKwh, 0);
  r = resolveToday(r.carry, D1, 600, 3.2, 1800);
  assert.equal(r.todayKwh, 3.2);
  r = resolveToday(r.carry, D1, 1100, 33.2, 0); // fim do dia, mesmo número de ontem: já é valor de hoje
  assert.equal(r.todayKwh, 33.2);
});

test("um novo dia descarta o estado do dia anterior", () => {
  const old: Carry = { day: "2026-10-31", value: 30 };
  const r = resolveToday(old, D1, 1, 30, 0);
  assert.equal(r.todayKwh, 0);
  assert.deepEqual(r.carry, { day: D1, value: 30 });
});
