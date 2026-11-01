"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui";
import { login, type LoginState } from "./actions";

const PROVIDERS = [
  { id: "solplanet", label: "Solplanet", user: "E-mail ou telefone", placeholder: "voce@email.com", },
  { id: "livoltek", label: "Livoltek", user: "E-mail ou usuário", placeholder: "voce@email.com", },
] as const;
type ProviderId = (typeof PROVIDERS)[number]["id"];

const field =
  "flex items-center gap-3 rounded-2xl bg-surface-low px-4 transition focus-within:bg-surface focus-within:ring-2 focus-within:ring-mint/50";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(state.provider ?? "solplanet");
  const current = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />

      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-semibold text-ink-2">App do seu inversor</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full bg-surface-low p-1">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex h-10 cursor-pointer items-center justify-center rounded-full text-[14px] font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mint/50 ${
                provider === p.id ? "bg-surface text-ink shadow-pill" : "text-ink-3 hover:text-ink"
              }`}
            >
              <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="sr-only" />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{current.user}</span>
        <span className={field}>
          <Icon name="mail" className="text-[20px] text-ink-3" />
          <input
            name="account"
            type="text"
            inputMode="email"
            autoComplete="username"
            required
            autoFocus
            defaultValue={state.account}
            placeholder={current.placeholder}
            className="h-13 w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-ink-3"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Senha</span>
        <span className={field}>
          <Icon name="lock" className="text-[20px] text-ink-3" />
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder={`Sua senha do app ${current.label}`}
            className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink"
          >
            <Icon name={show ? "visibility_off" : "visibility"} className="text-[20px]" />
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          <Icon name="error" className="text-[18px]" />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mint text-[15px] font-bold text-white shadow-pill-mint transition hover:brightness-105 disabled:opacity-70"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Entrando…
          </>
        ) : (
          <>
            Entrar
            <Icon name="arrow_forward" className="text-[20px]" />
          </>
        )}
      </button>
    </form>
  );
}
