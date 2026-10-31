import { currentEvolution, currentSession } from "@/lib/account";
import { getAccountKv, getAccountSettings } from "@/lib/queries";
import { SettingsPanel } from "./settings-panel";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const evolution = await currentEvolution();
  const [settings, wa, lastReportAt, session] = await Promise.all([
    getAccountSettings(),
    evolution.configured ? evolution.state() : Promise.resolve({ state: "unknown" as const, number: undefined }),
    getAccountKv<string>("last_report_at"),
    currentSession(),
  ]);

  return (
    <SettingsPanel
      account={session?.sub}
      initial={settings}
      whatsapp={{ configured: evolution.configured, state: wa.state, number: wa.number }}
      lastReportAt={lastReportAt ?? null}
    />
  );
}
