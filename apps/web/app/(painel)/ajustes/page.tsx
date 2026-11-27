import { currentWaha, currentSession } from "@/lib/account";
import { getAccountKv, getAccountSettings } from "@/lib/queries";
import { SettingsPanel } from "./settings-panel";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const waha = await currentWaha();
  const [settings, wa, lastReportAt, session] = await Promise.all([
    getAccountSettings(),
    waha.configured ? waha.state() : Promise.resolve({ state: "unknown" as const, number: undefined }),
    getAccountKv<string>("last_report_at"),
    currentSession(),
  ]);

  return (
    <SettingsPanel
      account={session?.sub}
      initial={settings}
      whatsapp={{ configured: waha.configured, state: wa.state, number: wa.number }}
      lastReportAt={lastReportAt ?? null}
    />
  );
}
