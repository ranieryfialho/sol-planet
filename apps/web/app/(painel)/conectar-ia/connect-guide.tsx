"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

const APPS = [
  {
    id: "claude",
    label: "Claude",
    steps: [
      "Abra o Claude (claude.ai) e vá em Configurações → Conectores.",
      "Escolha “Adicionar conector personalizado”.",
      "Dê o nome “Solar” e cole o endereço copiado acima.",
      "Clique em Conectar, entre com a conta do seu inversor e toque em Permitir.",
      "Numa conversa, ative o conector “Solar” e faça sua pergunta.",
    ],
  },
  {
    id: "gemini",
    label: "Gemini (em teste)",
    steps: [
      "Abra o Gemini (gemini.google.com) e, no menu lateral, clique em Personalizar.",
      "Na aba Conectores, em “Apps Conectados”, clique em “+ Personalizado”.",
      "Dê o nome “Solar”, cole o endereço copiado acima e continue.",
      "Entre com a conta do seu inversor e toque em Permitir.",
      "Numa conversa, ative o conector “Solar” e pergunte.",
    ],
  },
] as const;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = "Copiar", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        setState((await copyText(text)) ? "ok" : "fail");
        setTimeout(() => setState("idle"), 2000);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3.5 py-2 text-[13px] font-semibold text-mint-dark transition hover:brightness-95 ${className}`}
    >
      <Icon name={state === "ok" ? "check" : "content_copy"} className="text-[16px]" />
      {state === "ok" ? "Copiado" : state === "fail" ? "Selecione e copie" : label}
    </button>
  );
}

export function AppSteps() {
  const [id, setId] = useState<(typeof APPS)[number]["id"]>("claude");
  const app = APPS.find((a) => a.id === id) ?? APPS[0];
  return (
    <div>
      <div role="tablist" aria-label="App de IA" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-surface-low p-1">
        {APPS.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={id === a.id}
            onClick={() => setId(a.id)}
            className={`h-10 rounded-full text-[14px] font-semibold transition ${id === a.id ? "bg-surface text-ink shadow-pill" : "text-ink-3 hover:text-ink"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <ol className="space-y-3">
        {app.steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-[14px] leading-5 text-ink-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint-soft text-[12px] font-bold text-mint-dark">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12px] leading-4 text-ink-3">
        Os nomes dos menus mudam com o tempo e alguns planos não liberam conectores personalizados. Se não encontrar, procure por “conectores” ou “MCP” na ajuda do app.
      </p>
    </div>
  );
}
