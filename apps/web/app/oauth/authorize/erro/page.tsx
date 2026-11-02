export const metadata = { title: "Conectar IA · Solar" };

export default async function AuthorizeError({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[2rem] bg-surface p-6 shadow-card sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight">Não foi possível conectar</h1>
        <p className="mt-2 text-[15px] text-ink-2">{m?.slice(0, 200) || "Pedido inválido."} Volte ao aplicativo e tente de novo.</p>
      </div>
    </div>
  );
}
