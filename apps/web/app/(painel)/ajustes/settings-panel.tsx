"use client";

import type { Recipient, Settings } from "@sol/db";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Card, CardHeader, Icon, IconBadge, Pill } from "@/components/ui";
import { logout } from "@/app/login/actions";
import { connectWhatsApp, disconnectWhatsApp, listContacts, sendTest, updateSettings, whatsappState } from "./actions";
import { RULE_INFO, type RuleInfo } from "./rule-info";

interface WaInfo {
  configured: boolean;
  state: string;
  number?: string;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-mint" : "bg-surface-high"}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

/**
 * Linha de regra. Título + botão (i) + toggle ficam na primeira linha; os campos (minutos, %, horários) vão
 * numa linha própria embaixo, para não espremer a frase em telas estreitas. O (i) abre um painel com a explicação.
 */
function Row({
  icon,
  iconClass = "",
  title,
  subtitle,
  info,
  fields,
  children,
}: {
  icon: string;
  iconClass?: string;
  title: string;
  subtitle?: string;
  info?: RuleInfo;
  fields?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-b border-line/60 py-4 last:border-0">
      <div className="flex items-start gap-3">
        <Icon name={icon} className={`mt-0.5 text-[22px] ${iconClass || "text-ink-2"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-medium leading-6">{title}</span>
            {info && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={`O que é: ${title}`}
                onClick={() => setOpen(!open)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${open ? "bg-sky-soft text-sky" : "text-ink-3 hover:text-ink"}`}
              >
                <Icon name="info" fill={open} className="text-[20px]" />
              </button>
            )}
          </div>
          {subtitle && <p className="text-[13px] leading-[18px] text-ink-2">{subtitle}</p>}
        </div>
        {children}
      </div>
      {fields && <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 pl-[34px] text-[15px] text-ink-2">{fields}</div>}
      {info && open && (
        <div id={panelId} className="mt-3 space-y-2 rounded-2xl bg-surface-low p-4 text-[13px] leading-5 text-ink-2 sm:ml-[34px]">
          <p>{info.what}</p>
          {info.on && (
            <p>
              <span className="font-semibold text-mint-dark">Ligado: </span>
              {info.on}
            </p>
          )}
          {info.off && (
            <p>
              <span className="font-semibold text-ink">Desligado: </span>
              {info.off}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Grupo de regras que abre e fecha; o resumo mostra quantas estão ligadas. */
function Section({ title, icon, active, total, defaultOpen = false, children }: { title: string; icon: string; active: number; total: number; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-t border-line/60 first:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} className="text-[22px] text-mint-dark" />
        <span className="flex-1 text-[15px] font-bold">{title}</span>
        <span className="text-xs font-semibold text-ink-2">
          {active}/{total} ligadas
        </span>
        <Icon name="expand_more" className="text-[22px] text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div>{children}</div>
    </details>
  );
}

type NumRule = {
  [K in keyof Settings["rules"]]: Settings["rules"][K] extends number ? K : never;
}[keyof Settings["rules"]];

const inputCls = "rounded-full bg-surface px-3 py-1 text-center font-semibold shadow-pill outline-none focus:ring-2 focus:ring-mint/40";

export function SettingsPanel({ initial, whatsapp, lastReportAt, account }: { initial: Settings; whatsapp: WaInfo; lastReportAt: string | null; account?: string }) {
  const [s, setS] = useState(initial);
  const [saving, startSave] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [wa, setWa] = useState(whatsapp);
  const [qr, setQr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [targets, setTargets] = useState<{ groups: { id: string; subject: string }[]; contacts: { number: string; name: string }[] } | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ name: "", to: "" });

  // Grava 600 ms depois da última alteração: digitar num campo numérico não dispara uma gravação por tecla.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (next: Settings) => {
    setS(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      startSave(async () => {
        const clean = await updateSettings(next);
        // se o usuário já mexeu de novo, a resposta é velha: não sobrescreve o que ele digitou
        if (!timer.current) setS(clean);
      });
    }, 600);
  };
  const rules = (patch: Partial<Settings["rules"]>) => save({ ...s, rules: { ...s.rules, ...patch } });
  /** campo numérico de uma regra */
  const num = (k: NumRule, min: number, max: number, disabled = false) => (
    <input type="number" inputMode="numeric" min={min} max={max} disabled={disabled} className={`${inputCls} w-16`} value={s.rules[k]} onChange={(e) => rules({ [k]: Number(e.target.value) })} />
  );
  const r = s.rules;
  const report = (patch: Partial<Settings["report"]>) => save({ ...s, report: { ...s.report, ...patch } });
  const setRecipient = (id: string, patch: Partial<Recipient>) => save({ ...s, recipients: s.recipients.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const removeRecipient = (id: string) => save({ ...s, recipients: s.recipients.filter((r) => r.id !== id) });

  const flash = (t: { ok: boolean; message: string }) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  const reconnect = () =>
    startSave(async () => {
      const r = await connectWhatsApp();
      if (r.error) return flash({ ok: false, message: r.error });
      if (r.qr) setQr(r.qr);
      else setWa({ ...wa, ...(await whatsappState()) });
    });

  const disconnect = () =>
    startSave(async () => {
      const r = await disconnectWhatsApp();
      flash(r);
      setTargets(null);
      setWa({ ...wa, ...(await whatsappState()) });
    });

  // Enquanto o QR está na tela, confere a conexão a cada 3 s: ao ler no celular, ele some sozinho.
  useEffect(() => {
    if (!qr) return;
    const id = setInterval(async () => {
      const st = await whatsappState();
      if (st.state === "open") {
        setQr(null);
        setWa((w) => ({ ...w, ...st }));
        flash({ ok: true, message: "WhatsApp conectado." });
      }
    }, 3000);
    return () => clearInterval(id);
  }, [qr]);

  // contatos chegam na hora; grupos demoram (a Evolution leva ~1 min com muitos grupos) e entram quando prontos
  const [groupsLoading, setGroupsLoading] = useState(false);
  const loadTargets = (force = false) => {
    listContacts().then((contacts) => setTargets((t) => ({ groups: t?.groups ?? [], contacts })));
    setGroupsLoading(true);
    fetch(`/api/whatsapp/groups${force ? "?force=1" : ""}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((groups) => setTargets((t) => ({ contacts: t?.contacts ?? [], groups })))
      .catch(() => undefined)
      .finally(() => setGroupsLoading(false));
  };
  const openAdd = () => {
    setAdding(true);
    if (targets === null && wa.state === "open") loadTargets();
  };

  const addRecipient = () => {
    if (!draft.to.trim()) return;
    const isGroup = draft.to.includes("@g.us");
    save({
      ...s,
      recipients: [...s.recipients, { id: crypto.randomUUID(), name: draft.name.trim() || (isGroup ? "Grupo" : draft.to), to: draft.to.trim(), enabled: true }],
    });
    setDraft({ name: "", to: "" });
    setAdding(false);
  };

  const connected = wa.state === "open";
  const enabled = s.recipients.filter((r) => r.enabled).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-9 tracking-tight">Configurações</h1>
          <p className="text-[15px] text-ink-2">Notificações e preferências do sistema</p>
        </div>
        <Pill tone="white">
          <span className={`mr-1 h-2 w-2 rounded-full ${saving ? "animate-pulse bg-sun" : "bg-mint"}`} />
          {saving ? "Salvando" : "Ativo"}
        </Pill>
      </div>

      {/* WhatsApp */}
      <Card className="!rounded-[2rem]">
        <CardHeader title="WhatsApp Notificações" subtitle="Alertas instantâneos via Evolution API" icon="chat" />
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-mint" : wa.configured ? "bg-sun" : "bg-ink-3"}`} />
            <div>
              <p className="font-semibold">{connected ? "Conectado" : wa.configured ? "Desconectado" : "Não configurado"}</p>
              <p className="text-[13px] text-ink-2">
                {connected ? (wa.number ? `+${wa.number}` : "Instância ativa") : wa.configured ? "Conecte o seu número para receber os alertas" : "Defina EVOLUTION_API_KEY no .env"}
              </p>
            </div>
          </div>
          {wa.configured && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {connected && (
                <button type="button" onClick={disconnect} className="rounded-full px-3 py-2 text-sm font-semibold text-danger">
                  Desconectar
                </button>
              )}
              <button type="button" onClick={reconnect} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-pill">
                {connected ? "Reconectar" : "Conectar"}
              </button>
            </div>
          )}
        </div>

        {qr && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-surface-low p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code do WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" />
            <p className="text-sm text-ink-2">WhatsApp → Aparelhos conectados → Conectar aparelho. Use um número secundário. O QR expira em cerca de 40 s: se vencer, toque em Reconectar.</p>
            <button
              type="button"
              onClick={() => startSave(async () => { const st = await whatsappState(); setWa({ ...wa, ...st }); if (st.state === "open") setQr(null); })}
              className="rounded-full bg-mint px-5 py-2 text-sm font-bold text-white shadow-pill-mint"
            >
              Já li o QR code
            </button>
          </div>
        )}

        <div className="mb-3 mt-6 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-2">Destinatários cadastrados</span>
          <span className="text-xs font-semibold text-mint-dark">{enabled} ativo(s)</span>
        </div>
        {connected && enabled === 0 && (
          <p className="mb-3 rounded-2xl bg-sky-soft px-4 py-3 text-[13px] text-ink-2">
            Sem destinatários, os avisos chegam no seu próprio número{wa.number ? ` (+${wa.number})` : ""}. Adicione um grupo ou contato para enviar a outros.
          </p>
        )}
        <div className="space-y-3">
          {s.recipients.map((r) => {
            const group = r.to.includes("@g.us");
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface-low p-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${group ? "bg-sky-soft text-mint-dark" : "bg-sun-soft text-sun-dark"}`}>
                  {group ? <Icon name="home" /> : (r.name[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-[13px] text-ink-2">{group ? "Grupo do WhatsApp" : `+${r.to}`}</p>
                </div>
                <button type="button" aria-label={`Remover ${r.name}`} onClick={() => removeRecipient(r.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:text-danger">
                  <Icon name="delete" className="text-[20px]" />
                </button>
                <Toggle on={r.enabled} onChange={(v) => setRecipient(r.id, { enabled: v })} label={`Ativar ${r.name}`} />
              </div>
            );
          })}

          {adding ? (
            <div className="space-y-3 rounded-2xl bg-surface-low p-4">
              {wa.state === "open" ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl bg-surface px-3 py-2.5 shadow-pill outline-none"
                    placeholder="Buscar grupo ou contato da sua lista…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {targets === null ? (
                    <p className="px-1 text-[13px] text-ink-2">Carregando a sua lista…</p>
                  ) : (
                    (() => {
                      const q = query.trim().toLowerCase();
                      const taken = new Set(s.recipients.map((r) => r.to));
                      const items = [
                        ...targets.groups.map((g) => ({ to: g.id, name: g.subject, group: true })),
                        ...targets.contacts.map((c) => ({ to: c.number, name: c.name, group: false })),
                      ].filter((i) => !taken.has(i.to) && (!q || i.name.toLowerCase().includes(q) || i.to.includes(q)));
                      return (
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-surface p-1 shadow-pill">
                          {items.slice(0, 40).map((i) => (
                            <button
                              key={i.to}
                              type="button"
                              onClick={() => save({ ...s, recipients: [...s.recipients, { id: crypto.randomUUID(), name: i.name, to: i.to, enabled: true }] })}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-low"
                            >
                              <Icon name={i.group ? "groups" : "person"} className="text-[20px] text-ink-3" />
                              <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                              <span className="text-xs text-ink-3">{i.group ? "Grupo" : `+${i.to}`}</span>
                            </button>
                          ))}
                          {items.length === 0 && (
                            <p className="px-3 py-2 text-[13px] text-ink-2">
                              {targets.groups.length + targets.contacts.length === 0 ? "Nada na lista ainda: logo após conectar, o WhatsApp leva um tempo para sincronizar." : "Nenhum resultado."}
                            </p>
                          )}
                          {items.length > 40 && <p className="px-3 py-1 text-xs text-ink-3">Mostrando 40 de {items.length}: refine a busca.</p>}
                        </div>
                      );
                    })()
                  )}
                  {groupsLoading && <p className="px-1 text-xs text-ink-3">Buscando os grupos… pode levar até 1 min; os contatos já estão na lista.</p>}
                  <button type="button" onClick={() => loadTargets(true)} className="px-1 text-xs font-semibold text-mint-dark">
                    Atualizar lista
                  </button>
                </div>
              ) : (
                <p className="px-1 text-[13px] text-ink-2">Conecte o WhatsApp acima para escolher grupos e contatos da sua lista, ou digite um número abaixo.</p>
              )}
              <input
                className="w-full rounded-xl bg-surface px-3 py-2.5 shadow-pill outline-none"
                placeholder="Nome (ex.: Grupo Casa Solar)"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <input
                className="w-full rounded-xl bg-surface px-3 py-2.5 shadow-pill outline-none"
                placeholder="Número com DDI e DDD (5511999999999) ou ID do grupo"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAdding(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-2">
                  Cancelar
                </button>
                <button type="button" onClick={addRecipient} className="rounded-full bg-mint px-5 py-2 text-sm font-bold text-white shadow-pill-mint">
                  Adicionar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={openAdd} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-low py-3.5 font-semibold text-mint-dark">
              <Icon name="person_add" className="text-[20px]" />
              Adicionar novo destinatário
            </button>
          )}
        </div>
      </Card>

      {/* Regras */}
      <Card className="!rounded-[2rem]">
        <CardHeader title="Regras de Alerta" subtitle="Toque no (i) para entender cada uma" icon="warning" iconTone="sun" />
        <Section title="Rotina e relatórios" icon="event_note" active={[r.cycleStart, r.cycleEnd, r.cycleEndInReport, r.recovered, r.weeklySummary, r.monthlyReport].filter(Boolean).length} total={6} defaultOpen>
          <Row
            icon="wb_twilight"
            iconClass="text-mint-dark"
            title="Início do dia"
            subtitle="Avisa no primeiro dado de geração do dia, não no nascer do sol"
            info={RULE_INFO.cycleStart}
            fields={<span className={r.cycleStart ? "" : "opacity-50"}>Avisar se nada chegar após {num("noStartMinutes", 30, 240, !r.cycleStart)} min do amanhecer</span>}
          >
            <Toggle on={r.cycleStart} onChange={(v) => rules({ cycleStart: v })} label="Avisar início do dia" />
          </Row>
          <Row icon="bedtime" iconClass="text-mint-dark" title="Fim do dia" subtitle="Avisa 30 min após o pôr do sol, com a geração do dia" info={RULE_INFO.cycleEnd}>
            <Toggle on={r.cycleEnd} onChange={(v) => rules({ cycleEnd: v })} label="Avisar fim do dia" />
          </Row>
          <Row icon="merge" iconClass="text-mint-dark" title="Fim do dia junto com o relatório" subtitle="Uma mensagem só. Precisa do fim do dia e do relatório ligados" info={RULE_INFO.cycleEndInReport}>
            <Toggle on={r.cycleEndInReport} onChange={(v) => rules({ cycleEndInReport: v })} label="Juntar fim do dia ao relatório" />
          </Row>
          <Row icon="check_circle" iconClass="text-mint-dark" title="Avisar quando normalizar" subtitle="Confirmação de que o problema passou" info={RULE_INFO.recovered}>
            <Toggle on={r.recovered} onChange={(v) => rules({ recovered: v })} label="Avisar normalização" />
          </Row>
          <Row icon="summarize" title="Resumo semanal" subtitle="Domingo, no horário do relatório diário" info={RULE_INFO.weeklySummary}>
            <Toggle on={r.weeklySummary} onChange={(v) => rules({ weeklySummary: v })} label="Enviar resumo semanal" />
          </Row>
          <Row icon="calendar_month" title="Relatório mensal" subtitle="Dia 1, com o resumo do mês anterior" info={RULE_INFO.monthlyReport}>
            <Toggle on={r.monthlyReport} onChange={(v) => rules({ monthlyReport: v })} label="Enviar relatório mensal" />
          </Row>
        </Section>

        <Section title="Produção" icon="trending_down" active={[r.zeroGeneration, r.staleData, r.lowCapacity, r.lowGeneration, r.monthly].filter(Boolean).length} total={5}>
          <Row icon="power_off" iconClass="text-danger" title="Sem gerar" subtitle="Inversor online, mas sem produzir em pleno dia" info={RULE_INFO.zeroGeneration} fields={<>Avisar após {num("zeroGenerationMinutes", 10, 180)} min sem gerar</>}>
            <Toggle on={r.zeroGeneration} onChange={(v) => rules({ zeroGeneration: v })} label="Alertar geração zerada" />
          </Row>
          <Row icon="sync_problem" iconClass="text-danger" title="Sem dados novos" subtitle="Coleta ou API da Solplanet paradas" info={RULE_INFO.staleData} fields={<>Avisar após {num("staleMinutes", 6, 240)} min sem dados</>}>
            <Toggle on={r.staleData} onChange={(v) => rules({ staleData: v })} label="Alertar falta de dados" />
          </Row>
          <Row icon="partly_cloudy_day" iconClass="text-sun-dark" title="Pico baixo" subtitle="Maior potência do dia vs kWp instalados, após o fim do sol" info={RULE_INFO.lowCapacity} fields={<>Pico abaixo de {num("lowCapacityPct", 5, 90)}% da capacidade</>}>
            <Toggle on={r.lowCapacity} onChange={(v) => rules({ lowCapacity: v })} label="Alertar pico baixo" />
          </Row>
          <Row icon="trending_down" iconClass="text-sun-dark" title="Geração abaixo da média" subtitle="Compara o dia com a média dos 7 anteriores, após o fim do sol" info={RULE_INFO.lowGeneration} fields={<>Dia {num("lowGenerationPct", 5, 90)}% abaixo da média</>}>
            <Toggle on={r.lowGeneration} onChange={(v) => rules({ lowGeneration: v })} label="Alertar baixa geração" />
          </Row>
          <Row icon="calendar_month" iconClass="text-sun-dark" title="Ritmo do mês" subtitle="A partir do dia 20. Também avisa a cada 500 kWh gerados" info={RULE_INFO.monthly} fields={<>Mês {num("monthlyPct", 5, 90)}% abaixo da média</>}>
            <Toggle on={r.monthly} onChange={(v) => rules({ monthly: v })} label="Alertar ritmo do mês" />
          </Row>
        </Section>

        <Section title="Equipamento" icon="solar_power" active={[r.offline, r.daylightOnly, r.inverterErrors, r.stringImbalance, r.gridVoltage, r.gridImportKwh > 0].filter(Boolean).length} total={6}>
          <Row icon="cloud_off" title="Offline" subtitle="Inversor sem sinal de telemetria" info={RULE_INFO.offline} fields={<>Avisar após {num("offlineMinutes", 5, 240)} min sem sinal</>}>
            <Toggle on={r.offline} onChange={(v) => rules({ offline: v })} label="Alertar offline" />
          </Row>
          <Row
            icon="schedule"
            title="Somente durante o dia"
            subtitle={r.dayAuto ? "Nascer e pôr do sol da usina, atualizado todo dia" : "À noite o inversor desliga e aparece offline"}
            info={RULE_INFO.daylightOnly}
            fields={
              <>
                Entre <input type="time" disabled={r.dayAuto} className={`${inputCls} disabled:opacity-60`} value={r.dayStart} onChange={(e) => rules({ dayStart: e.target.value })} /> e{" "}
                <input type="time" disabled={r.dayAuto} className={`${inputCls} disabled:opacity-60`} value={r.dayEnd} onChange={(e) => rules({ dayEnd: e.target.value })} />
                <button
                  type="button"
                  onClick={() => rules({ dayAuto: !r.dayAuto })}
                  aria-pressed={r.dayAuto}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${r.dayAuto ? "bg-sky-soft text-mint-dark" : "bg-sun-soft text-sun-dark"}`}
                >
                  {r.dayAuto ? "Auto" : "Manual"}
                </button>
              </>
            }
          >
            <Toggle on={r.daylightOnly} onChange={(v) => rules({ daylightOnly: v })} label="Somente durante o dia" />
          </Row>
          <Row
            icon="bolt"
            iconClass="text-danger"
            title="Erros e avisos do inversor"
            subtitle="Falhas e status “alerta” reportados pela Solplanet"
            info={RULE_INFO.inverterErrors}
            fields={
              <span className={r.inverterErrors ? "" : "opacity-50"}>
                Status “alerta” só após {num("warningMinutes", 0, 120, !r.inverterErrors)} min (0 = na hora)
              </span>
            }
          >
            <Toggle on={r.inverterErrors} onChange={(v) => rules({ inverterErrors: v })} label="Alertar erros do inversor" />
          </Row>
          <Row icon="balance" iconClass="text-sun-dark" title="Strings desiguais" subtitle="Uma string rende bem menos que a outra (sombra, sujeira)" info={RULE_INFO.stringImbalance} fields={<>Quando uma ficar {num("stringImbalancePct", 10, 90)}% mais fraca</>}>
            <Toggle on={r.stringImbalance} onChange={(v) => rules({ stringImbalance: v })} label="Alertar desequilíbrio de strings" />
          </Row>
          <Row icon="electrical_services" iconClass="text-sun-dark" title="Tensão da rede fora da faixa" subtitle="Perto do limite em que o inversor se desliga" info={RULE_INFO.gridVoltage}>
            <Toggle on={r.gridVoltage} onChange={(v) => rules({ gridVoltage: v })} label="Alertar tensão da rede" />
          </Row>
          <Row icon="home" iconClass="text-sun-dark" title="Compra da rede" subtitle="Só com medidor. 0 desliga o alerta" info={RULE_INFO.gridImport} fields={<>Acima de {num("gridImportKwh", 0, 1000)} kWh por dia</>}>
            <Toggle on={r.gridImportKwh > 0} onChange={(v) => rules({ gridImportKwh: v ? 20 : 0 })} label="Alertar consumo da rede" />
          </Row>
        </Section>
      </Card>

      {/* Relatório */}
      <Card className="!rounded-[2rem]">
        <CardHeader title="Relatório de Fechamento" subtitle="Resumo diário consolidado" icon="insights" iconTone="sky" aside={<Toggle on={s.report.enabled} onChange={(v) => report({ enabled: v })} label="Relatório diário" />} />
        <p className="text-[15px] text-ink-2">Receba o resumo de produção e economia todo fim de tarde, com métricas em kWh e economia em R$.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-surface-low px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-ink-2">
              <Icon name="alarm" className="text-[20px]" />
              Horário de envio
            </span>
            <input type="time" className={`${inputCls} text-lg`} value={s.report.time} onChange={(e) => report({ time: e.target.value })} />
          </label>
          <button
            type="button"
            onClick={() => startSave(async () => flash(await sendTest()))}
            className="flex items-center justify-center gap-2 rounded-2xl bg-surface-mid px-5 py-3 font-semibold shadow-pill"
          >
            <Icon name="send" className="text-[18px]" />
            Testar
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-low px-4 py-3">
            <p className="text-[13px] text-ink-2">Último envio</p>
            <p className="font-semibold">{lastReportAt ? new Date(lastReportAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Ainda não enviado"}</p>
          </div>
          <label className="rounded-2xl bg-surface-low px-4 py-3">
            <span className="block text-[13px] text-ink-2">Tarifa (R$/kWh)</span>
            <input
              type="number"
              step="0.01"
              min={0}
              className="w-full bg-transparent font-semibold outline-none"
              value={s.tariff}
              onChange={(e) => save({ ...s, tariff: Number(e.target.value) })}
            />
          </label>
        </div>
      </Card>

      <Card className="!rounded-[2rem]">
        <div className="flex items-center gap-4">
          <IconBadge name="person" tone="mint" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-2">Conectado como</p>
            <p className="truncate font-semibold">{account ?? "—"}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-2 rounded-full bg-surface-low px-4 py-2.5 text-sm font-semibold text-danger">
              <Icon name="logout" className="text-[18px]" />
              Sair
            </button>
          </form>
        </div>
      </Card>

      <div className="flex items-center gap-3 rounded-2xl bg-surface/60 px-4 py-3 text-sm">
        <Icon name="verified_user" className="text-[20px] text-ink-2" />
        <div className="flex-1">
          <p className="font-medium">Somente leitura na Solplanet</p>
          <p className="text-xs text-ink-2">O monitor nunca envia comandos ao inversor.</p>
        </div>
      </div>

      {toast && (
        <div className={`fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-sheet lg:bottom-8 ${toast.ok ? "bg-mint-dark text-white" : "bg-danger text-white"}`}>
          <IconBadge name={toast.ok ? "check" : "error"} tone={toast.ok ? "mint" : "danger"} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
