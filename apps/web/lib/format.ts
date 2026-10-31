const nf = (digits: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "4,2" — número no padrão brasileiro */
export const n = (v: number, digits = 1) => nf(digits).format(v);

/** Potência em W → {value, unit} com troca automática para kW */
export function power(w: number) {
  return Math.abs(w) >= 1000 ? { value: n(w / 1000, 1), unit: "kW" } : { value: n(w, 0), unit: "W" };
}

/** Energia em kWh → {value, unit} com troca para MWh */
export function energy(kwh: number, digits = 1) {
  return kwh >= 1000 ? { value: n(kwh / 1000, 2), unit: "MWh" } : { value: n(kwh, digits), unit: "kWh" };
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmtPower = (w: number) => {
  const p = power(w);
  return `${p.value} ${p.unit}`;
};

export function timeAgo(d: Date, now = new Date()) {
  const min = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}
