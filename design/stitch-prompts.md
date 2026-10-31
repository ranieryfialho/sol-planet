# Prompts para o Stitch

Referência: `referencia-pinterest.png` (anexe no Stitch junto com o prompt base).

## 0. Base (design system)

```
Use the attached image as the visual reference. Design system for "Solar", a personal solar monitoring app, mobile-first (iPhone size) with a matching responsive web version. Language: Brazilian Portuguese.

Visual style: bright, airy and premium. Background is a soft vertical gradient from light sky blue (#DCEBFA) at the top fading to very light gray (#F3F5F7). Hero element is a soft 3D isometric clay-style illustration of a white house with dark solar panels on the roof, with glowing mint-green energy lines running along the walls between the components. Thin vertical leader lines connect each component of the illustration to a floating label above or below it (label in gray, value in large bold black with a small gray unit, e.g. "4,2 kW").

Cards: pure white, large corner radius (24px), no borders, very soft shadow, generous padding, card title bold dark gray on the left with a chevron ">" on the right.
Accent colors: mint/emerald green (#1DB98A) for production and "online/On Grid" pills; orange (#F28C28) for consumption; red only for errors. Pills: small rounded rectangles, solid green with white text ("On Grid", "Normal") or white with dark text and a radio-dot icon ("ao vivo").
Typography: rounded geometric sans-serif (like SF Pro Rounded / Nunito), big bold numbers with lighter small units, tabular numerals.
Icons: soft circular light-gray backgrounds with small flat colored illustrations.
Bottom tab bar (mobile): Início, Histórico, Alertas, Ajustes.
```

## 1. Início (tela principal)

```
Home screen of the Solar app, following the attached reference closely.
Top bar: "Minha Casa" with a dropdown caret on the left; weather on the right (partly cloudy icon, "29°C").
Below: green pill "On Grid" on the left, white pill with radio dot "ao vivo" on the right.
Hero: 3D isometric house illustration with solar panels on the roof, an inverter box on the wall, and a power pole/grid connection on the side, with glowing mint-green energy lines. Floating labels with leader lines: "Solar 4,2 kW" (top left), "Inversor Normal" (top right), "Casa 1,8 kW" (bottom left), "Rede 2,4 kW ↑ injetando" (bottom right).
Card "Hoje": "21,8 kWh" Produção (green label), "+12% vs média 7 dias" small green arrow, and a smooth area chart of power through the day (05:00 to 19:00) in mint green with soft gradient fill.
Card "Contribuição ambiental": three columns with circular icons: "Carvão evitado 3,6 t", "CO₂ reduzido 7,2 t", "Árvores equivalentes 119".
Card "Resumo": "Este mês 512 kWh", "Total 8,46 MWh", "Economia R$ 342".
Bottom tab bar.
```

## 2. Histórico

```
"Histórico" screen in the same style as the reference. Light sky gradient header with title "Histórico" and a segmented control in a white pill: Dia, Mês, Ano, Total. Date navigator "< Outubro 2026 >".
White card with big number "512,4 kWh" and label "Produção" in green, then a bar chart of daily generation with rounded mint-green bars and one highlighted bar with a floating tooltip "18/10 · 24,6 kWh".
Below, three small white cards in a row: "Melhor dia 31,2 kWh", "Média diária 19,7 kWh", "Produtividade 3,6 kWh/kWp".
Card "Comparação": this month vs last month with two horizontal bars (green vs light gray).
Bottom tab bar.
```

## 3. Alertas

```
"Alertas" screen in the same style. Header with title and filter chips in white pills: Todos, Erros, Offline, Resolvidos.
Status hero card at the top: large green check in a soft circle, "Tudo funcionando", "Último alerta há 3 dias".
List grouped by day ("Hoje", "Ontem", "27 out"), each item a white rounded card with a colored circular icon (red X for erro, orange plug for offline, green check for normalizado), bold title ("Erro F17 · Tensão da rede fora da faixa"), gray subtitle ("Inversor SN 2201… · durou 41 min"), time on the right and a tiny WhatsApp icon with "enviado".
Bottom tab bar.
```

## 4. Detalhe do inversor

```
Inverter detail screen in the same style. Header: back arrow, "Inversor", 3D clay-style render of a white wall-mounted inverter with a glowing mint status light, model "Solplanet ASW5000-S", serial number, green pill "Online".
Grid of white cards (2 columns) with icon, label and big value: "Potência AC 4,2 kW", "Tensão 220 V", "Frequência 60,0 Hz", "Temperatura 41 °C".
Card "Strings": PV1 and PV2 rows with voltage, current and power and slim mint progress bars.
Card "Curva do dia": smooth mint area chart with a date selector.
```

## 5. Ajustes / notificações

```
"Ajustes" screen in the same style. Card "WhatsApp": green WhatsApp icon, "Conectado · +55 11 9xxxx-xxxx", button "Reconectar". List "Destinatários" with avatar circles: "Grupo Casa Solar" and "Raniery", each with a green toggle, plus "+ Adicionar".
Card "Regras de alerta": rows with toggles and values: "Offline por mais de 20 min", "Apenas entre 07:00 e 17:00", "Erros do inversor", "Avisar quando normalizar".
Card "Relatório diário": time "19:00", toggle on, button "Enviar teste".
Bottom tab bar.
```

## 6. Versão web (desktop)

```
Desktop web version (1440px) of the Solar home screen in the same visual style as the attached reference. Left: slim white sidebar with logo "Solar" and navigation Início, Histórico, Alertas, Inversor, Ajustes. Main area on the light sky gradient: top bar with "Minha Casa ▾", "On Grid" pill, "ao vivo" pill and weather. Large hero card with the 3D isometric house illustration and floating labels (Solar, Inversor, Casa, Rede) on the left two-thirds; on the right a column of white cards: "Hoje 21,8 kWh" with mini area chart, "Este mês 512 kWh", "Contribuição ambiental" (carvão, CO₂, árvores). Below: wide card "Produção — últimos 30 dias" with rounded mint bars, and card "Últimos alertas".
```
