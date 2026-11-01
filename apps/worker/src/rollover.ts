/**
 * "Hoje" (etoday) da Solplanet na virada do dia. A API não zera à meia-noite: ela segue devolvendo o total de ontem
 * por alguns minutos (zera ~00:05) e, com o inversor offline a noite toda, pode manter o valor até ele voltar.
 * Sem tratar isso, o valor de ontem era gravado como geração do dia novo.
 *
 * Regra: na primeira leitura do dia local, se a usina está sem produzir e ainda é madrugada, o valor que a API
 * devolver é o de ontem congelado. Ele vale 0 enquanto a API repetir exatamente esse número; quando ela zerar ou
 * mudar, a leitura passa a valer. Fora da madrugada (ex.: worker reiniciado à tarde) nada é congelado.
 */
export interface Carry {
  day: string;
  /** valor de ontem congelado (0 = nada congelado) */
  value: number;
}

/** Até quando, em minutos desde a meia-noite local, o primeiro valor positivo do dia só pode ser o de ontem. */
export const CARRY_WINDOW_MINUTES = 360;

export function resolveToday(
  carry: Carry | undefined,
  day: string,
  minutesOfDay: number,
  rawKwh: number,
  powerW: number,
): { todayKwh: number; carry: Carry } {
  let c: Carry = carry && carry.day === day ? carry : { day, value: powerW === 0 && rawKwh > 0 && minutesOfDay < CARRY_WINDOW_MINUTES ? rawKwh : 0 };
  // a API zerou ou andou: acabou o valor congelado
  if (c.value > 0 && rawKwh !== c.value) c = { day, value: 0 };
  const frozen = c.value > 0 && rawKwh === c.value && powerW === 0;
  return { todayKwh: frozen ? 0 : rawKwh, carry: c };
}
