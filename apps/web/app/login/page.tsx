import Image from "next/image";
import { Icon, LivePill, Pill } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Solar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 lg:px-12">
      <div className="grid w-full max-w-[1100px] items-stretch gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        {/* imagem / marca */}
        <section className="relative overflow-hidden rounded-[2rem] bg-surface/80 p-4 shadow-card backdrop-blur-md lg:p-0">
          <div className="mb-4 flex items-center gap-3 lg:absolute lg:left-8 lg:top-8 lg:z-10 lg:mb-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-white shadow-pill-mint">
              <Icon name="solar_power" className="text-[24px]" />
            </span>
            <span>
              <span className="block text-xl font-bold leading-6">Solar</span>
              <span className="block text-xs text-ink-2 lg:text-ink">Monitoramento</span>
            </span>
          </div>

          <div className="relative h-52 overflow-hidden rounded-2xl lg:h-full lg:min-h-[620px] lg:rounded-[2rem]">
            <Image src="/img/casa-desktop.jpg" alt="Casa com painéis solares" fill priority sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/0 to-white/10 lg:from-white/80 lg:via-white/10" />
            <div className="absolute left-3 top-3 flex gap-2 lg:hidden">
              <Pill tone="mint" icon="bolt" className="uppercase tracking-wider">On Grid</Pill>
            </div>
            <div className="absolute right-3 top-3 lg:hidden">
              <LivePill />
            </div>

            {/* destaque desktop */}
            <div className="absolute inset-x-8 bottom-8 hidden lg:block">
              <div className="max-w-sm rounded-3xl bg-surface/90 p-6 shadow-card backdrop-blur">
                <div className="mb-3 flex items-center gap-2">
                  <Pill tone="mint" icon="bolt">Conectado à Rede</Pill>
                  <LivePill />
                </div>
                <p className="text-2xl font-bold leading-8 tracking-tight">Sua energia solar, em tempo real.</p>
                <p className="mt-2 text-[15px] text-ink-2">Produção, economia e alertas da sua usina, com aviso no WhatsApp quando algo sair do normal.</p>
              </div>
            </div>
          </div>
        </section>

        {/* formulário */}
        <section className="flex flex-col justify-center rounded-[2rem] bg-surface p-6 shadow-card sm:p-10">
          <div className="mb-8">
            <span className="mb-5 hidden h-14 w-14 items-center justify-center rounded-full bg-mint-soft text-mint-dark lg:flex">
              <Icon name="wb_sunny" fill className="text-[28px]" />
            </span>
            <h1 className="text-[28px] font-bold leading-9 tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-1 text-[15px] text-ink-2">Entre para acompanhar suas placas solares.</p>
          </div>

          <LoginForm next={next} />

          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-low p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-mint-dark shadow-pill">
              <Icon name="solar_power" className="text-[18px]" />
            </span>
            <p className="text-[13px] leading-5 text-ink-2">
              Use a <span className="font-semibold text-ink">mesma conta do app do seu inversor</span> (Solplanet ou My Livoltek): o login e a senha que você usa no celular.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
