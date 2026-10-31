/**
 * Impacto ambiental estimado a partir da energia gerada.
 * Fatores usuais dos apps de inversor (inclusive o da Solplanet): 0,4 kg de carvão e
 * 0,997 kg de CO₂ por kWh; uma árvore absorve ~18,3 kg de CO₂ por ano.
 * Quando a API manda o CO₂ (savings.co2), ele tem prioridade.
 */
export function ecoImpact(totalKwh: number, co2KgFromApi?: number | null) {
  const co2Kg = co2KgFromApi ?? totalKwh * 0.997;
  return {
    coalT: (totalKwh * 0.4) / 1000,
    co2T: co2Kg / 1000,
    trees: Math.round(co2Kg / 18.3),
  };
}
