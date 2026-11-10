import { expect, test } from "vitest";
import { buildSummary, type SummaryInput } from "../apps/web/lib/api/summary";

const base: SummaryInput = {
  plant: { id: 1, name: "Minha Casa", status: 1, capacityKwp: 5.5, powerW: 3210.6, totalKwh: 8421.456, updatedAt: new Date("2026-11-07T15:00:00Z") },
  todayKwh: 22,
  peakW: 4300.4,
  avg7Kwh: 20,
  tariff: 0.95,
};

test("resumo do dia: economia, produtividade e comparação com a média", () => {
  const s = buildSummary(base);
  expect(s.usina).toEqual({ id: 1, nome: "Minha Casa", capacidadeKwp: 5.5 });
  expect(s.status).toEqual({ codigo: 1, rotulo: "Operando normalmente" });
  expect(s.agora).toEqual({ potenciaW: 3211, atualizadoEm: "2026-11-07T15:00:00.000Z" });
  expect(s.hoje).toEqual({ energiaKwh: 22, picoW: 4300, economiaReais: 20.9, produtividadeKwhKwp: 4, variacaoMedia7dPct: 10 });
  expect(s.media7dKwh).toBe(20);
  expect(s.totalKwh).toBe(8421.46);
});

test("dia abaixo da média dá variação negativa", () => {
  expect(buildSummary({ ...base, todayKwh: 15 }).hoje.variacaoMedia7dPct).toBe(-25);
});

test("usina nova (sem média) e sem capacidade cadastrada não inventa números", () => {
  const s = buildSummary({ ...base, avg7Kwh: null, plant: { ...base.plant, capacityKwp: null } });
  expect(s.hoje.variacaoMedia7dPct).toBeNull();
  expect(s.hoje.produtividadeKwhKwp).toBeNull();
  expect(s.media7dKwh).toBeNull();
});

test("status desconhecido da API aparece com o código", () => {
  expect(buildSummary({ ...base, plant: { ...base.plant, status: 9 } }).status).toEqual({ codigo: 9, rotulo: "Status 9" });
});
