import { logout } from "@/app/login/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { BottomNav, MobileHeader, Sidebar } from "@/components/nav";
import { getPlants } from "@/lib/queries";
import { statusOf } from "@/lib/status";

export const dynamic = "force-dynamic";

async function SidebarFooter() {
  const plants = await getPlants().catch(() => []);
  const p = plants[0];
  const s = p ? statusOf(p.status) : null;
  return (
    <div className="space-y-3">
      {p && s && (
        <div className="flex items-center justify-between rounded-xl bg-surface-low px-3 py-2 text-xs font-semibold">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
          <span className="text-ink-2">{p.capacityKwp ? `${p.capacityKwp} kWp` : ""}</span>
        </div>
      )}
      <div className="flex items-center gap-3 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-dark text-white">
          <span className="material-symbols-outlined text-[18px]">home</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{p?.name ?? "Solar"}</span>
          <span className="block text-xs text-ink-2">{plants.length > 1 ? `+${plants.length - 1} usina(s)` : "Usina residencial"}</span>
        </span>
        <form action={logout}>
          <button type="submit" aria-label="Sair" title="Sair" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-low hover:text-ink">
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoRefresh seconds={30} />
      <Sidebar footer={<SidebarFooter />} />
      <MobileHeader />
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-20 lg:max-w-none lg:pb-12 lg:pl-[calc(15rem+3rem)] lg:pr-12 lg:pt-8">{children}</main>
      <BottomNav />
    </>
  );
}
