import { describe, expect, test } from "vitest";
import { CYCLE_END_HEADER, connectedStrings, cycleEndMessage, cycleStartMessage, isNoStartTime, noStartMessage, dropPercent, fmtW, hasStringImbalance, isAfterSun, isGridVoltageOff, isMidday, mins } from "../apps/worker/src/domain";

describe("horários", () => {
  test("HH:MM vira minutos desde a meia-noite", () => {
    expect(mins("00:00")).toBe(0);
    expect(mins("07:30")).toBe(450);
    expect(mins("17")).toBe(1020); // sem minutos
  });

  test("depois do sol: só 30 min após o fim da janela", () => {
    expect(isAfterSun("17:29", "17:00")).toBe(false);
    expect(isAfterSun("17:30", "17:00")).toBe(true);
  });

  test("meio do dia: 2 h de folga do nascer e do pôr do sol", () => {
    expect(isMidday("08:59", "07:00", "17:00")).toBe(false);
    expect(isMidday("09:00", "07:00", "17:00")).toBe(true);
    expect(isMidday("14:59", "07:00", "17:00")).toBe(true);
    expect(isMidday("15:00", "07:00", "17:00")).toBe(false);
  });
});

describe("queda de geração", () => {
  test("percentual em relação à média", () => {
    expect(dropPercent(15, 20)).toBeCloseTo(25);
    expect(dropPercent(20, 20)).toBe(0);
  });

  test("acima da média dá queda negativa (não alerta)", () => {
    expect(dropPercent(30, 20)).toBeCloseTo(-50);
  });
});

describe("desequilíbrio de strings PV", () => {
  const pv = [
    { name: "PV1", v: 340, p: 2300 },
    { name: "PV2", v: 330, p: 1200 },
    { name: "PV3", v: 0, p: 0 }, // string vazia (sem painéis)
  ];

  test("só strings com tensão contam como conectadas", () => {
    expect(connectedStrings(pv).map((s) => s.name)).toEqual(["PV1", "PV2"]);
    expect(connectedStrings(null)).toEqual([]);
  });

  test("valores em texto (como a API manda) também valem", () => {
    expect(connectedStrings([{ name: "PV1", v: "340" as unknown as number }])).toHaveLength(1);
  });

  test("uma string rendendo bem menos que a melhor é desequilíbrio", () => {
    expect(hasStringImbalance(connectedStrings(pv), 3500, 30)).toBe(true);
  });

  test("diferença dentro da tolerância não alerta", () => {
    expect(hasStringImbalance(connectedStrings(pv), 3500, 60)).toBe(false);
  });

  test("inversor gerando pouco (< 1 kW) ou com uma string só não alerta", () => {
    expect(hasStringImbalance(connectedStrings(pv), 900, 30)).toBe(false);
    expect(hasStringImbalance([pv[0]], 3500, 30)).toBe(false);
  });
});

describe("tensão da rede", () => {
  test("rede 220 V: faixa de 191,4 V a 242 V", () => {
    expect(isGridVoltageOff(220)).toBe(false);
    expect(isGridVoltageOff(242)).toBe(false);
    expect(isGridVoltageOff(243)).toBe(true);
    expect(isGridVoltageOff(190)).toBe(true);
  });

  test("rede 127 V: usa o nominal mais próximo", () => {
    expect(isGridVoltageOff(127)).toBe(false);
    expect(isGridVoltageOff(140)).toBe(true);
    expect(isGridVoltageOff(110)).toBe(true);
  });
});

test("potência formatada em W ou kW", () => {
  expect(fmtW(850.4)).toBe("850 W");
  expect(fmtW(4200)).toBe("4.20 kW");
});

describe("início e fim do dia", () => {
  test("sem geração: só avisa depois do prazo contado do início da janela e antes do fim", () => {
    expect(isNoStartTime("06:41", "05:12", "17:30", 90)).toBe(false);
    expect(isNoStartTime("06:42", "05:12", "17:30", 90)).toBe(true);
    expect(isNoStartTime("17:30", "05:12", "17:30", 90)).toBe(false);
    expect(isNoStartTime("05:42", "05:12", "17:30", 30)).toBe(true); // prazo configurável
  });

  test("início: usina em aviso não é descrita como normal", () => {
    const msg = cycleStartMessage([
      { name: "Casa", statusLabel: "normal", ok: true, powerW: 928 },
      { name: "Sítio", statusLabel: "alerta", ok: false, powerW: 208 },
    ]);
    expect(msg).toContain("*Casa*: operando normalmente · 928 W");
    expect(msg).toContain("*Sítio*: ⚠️ com alerta · 208 W");
  });

  test("sem geração: lista causas e deixa claro que não é diagnóstico", () => {
    const msg = noStartMessage("05:12");
    expect(msg).toContain("05:12");
    expect(msg).toContain("não é um diagnóstico");
    expect(msg).toContain("empresa responsável pela instalação");
  });

  test("fim: cita o horário do relatório só quando ele ainda vai chegar", () => {
    const plants = [{ name: "Casa", todayKwh: 35.84 }];
    expect(cycleEndMessage(plants, "18:00")).toContain("O relatório diário chega às 18:00.");
    expect(cycleEndMessage(plants, null)).not.toContain("relatório");
    expect(cycleEndMessage(plants, null)).toContain("35.8 kWh gerados hoje");
    expect(CYCLE_END_HEADER).toContain("encerrado");
  });
});
