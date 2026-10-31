/** Status da usina (plantlist). Cores de status sempre acompanham ícone + rótulo. */
const PLANT = {
  0: { label: "Offline", icon: "wifi_off", tone: "sun", dot: "bg-sun" },
  1: { label: "Operando normalmente", icon: "check_circle", tone: "mint", dot: "bg-mint" },
  2: { label: "Alerta", icon: "warning", tone: "sun", dot: "bg-sun" },
  3: { label: "Erro", icon: "error", tone: "danger", dot: "bg-danger" },
} as const;

export type Tone = "mint" | "sun" | "danger" | "gray" | "sky";

export function statusOf(s: number): { label: string; icon: string; tone: Tone; dot: string } {
  return PLANT[s as keyof typeof PLANT] ?? { label: `Status ${s}`, icon: "help", tone: "gray", dot: "bg-ink-3" };
}

export const ALERT_KIND: Record<string, { label: string; icon: string; tone: Tone; group: "erros" | "offline" | "resolvidos" }> = {
  offline: { label: "Offline", icon: "wifi_off", tone: "sun", group: "offline" },
  warning: { label: "Alerta", icon: "warning", tone: "sun", group: "erros" },
  error: { label: "Erro", icon: "error", tone: "danger", group: "erros" },
  fault: { label: "Crítico", icon: "report", tone: "danger", group: "erros" },
  low_generation: { label: "Baixa geração", icon: "trending_down", tone: "sun", group: "erros" },
  low_capacity: { label: "Pico baixo", icon: "partly_cloudy_day", tone: "sun", group: "erros" },
  zero_generation: { label: "Sem geração", icon: "power_off", tone: "danger", group: "erros" },
  string_imbalance: { label: "String fraca", icon: "balance", tone: "sun", group: "erros" },
  grid_voltage: { label: "Tensão da rede", icon: "electrical_services", tone: "sun", group: "erros" },
  grid_import: { label: "Consumo da rede", icon: "home", tone: "sun", group: "erros" },
  monthly: { label: "Mês abaixo", icon: "calendar_month", tone: "sun", group: "erros" },
  stale_data: { label: "Sem dados", icon: "sync_problem", tone: "danger", group: "erros" },
  milestone: { label: "Marco", icon: "celebration", tone: "mint", group: "resolvidos" },
  recovered: { label: "Normalizado", icon: "verified", tone: "mint", group: "resolvidos" },
};
