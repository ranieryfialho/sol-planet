---
name: Lumina Solar Clean Energy
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#3c4a43'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#6c7a72'
  outline-variant: '#bbcac1'
  surface-tint: '#006c4e'
  primary: '#006c4e'
  on-primary: '#ffffff'
  primary-container: '#1db98a'
  on-primary-container: '#00432f'
  inverse-primary: '#52ddac'
  secondary: '#914d00'
  on-secondary: '#ffffff'
  secondary-container: '#fc9430'
  on-secondary-container: '#663500'
  tertiary: '#0053db'
  on-tertiary: '#ffffff'
  tertiary-container: '#80a0ff'
  on-tertiary-container: '#00328c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#72fac7'
  primary-fixed-dim: '#52ddac'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#00513a'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-telemetry:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-badge:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-unit:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.01em
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an atmospheric, bright, and reassuring environment for residential solar monitoring. It translates technical power metrics (kW, kWh, voltage, battery state of charge) into accessible, emotionally rewarding micro-moments of environmental impact and energy autonomy. 

### Target Audience & Tone
Geared toward modern homeowners, tech-conscious property owners, and sustainability advocates in Brazil. The language is Brazilian Portuguese (`pt-BR`), characterized by clear, natural phrasing (e.g., "Geração Solar", "Consumo Residencial", "Conectado à Rede"). The visual tone is optimistic, pristine, and authoritative—evoking clear daylight, effortless efficiency, and quiet engineering excellence.

### Aesthetic Movement
A synthesis of **Atmospheric Minimalism** and **Tactile Soft Glass**. The interface relies on luminous sky-tinted atmospheric backdrops (`#DCEBFA` blending down into soft ambient neutrals `#F3F5F7`), generous negative space, crisp opaque white surface cards with soft, diffused ambient light shadows, and zero harsh structural borders. High-contrast, tabular data typography elevates telemetry clarity, while lively status pills, dynamic energy flow indicators, and rounded tactile badges make sustainability feel tangible and rewarding.

## Colors

The color palette reflects daylight, renewable generation, and electrical flow:

- **Primary (`#1DB98A` - Emerald Mint):** Represents clean solar production, self-sufficiency, positive environmental balance, active system health, and affirmative badges such as "Conectado à Rede" (On Grid).
- **Secondary (`#F28C28` - Radiant Solar Orange):** Denotes household consumption, active loads, grid dependency/import, and battery discharge phases.
- **Tertiary (`#2563EB` - Sky Atmosphere Accent):** Reserved for atmospheric telemetry (irradiance, cloud cover, weather metrics) and interactive links.
- **System Alert (`#EF4444`):** Strictly restricted to inverter faults, grid disconnection errors, and battery safety thresholds.
- **Background Gradient:** Smooth linear canvas transition from sky daylight tint `#DCEBFA` at the top header down to soft clean off-white `#F3F5F7` along scrollable content.
- **Surfaces:** Pure opaque white (`#FFFFFF`) for cards and floating metric panels, complemented by ultra-soft neutral pills (`#F1F5F9`) for secondary data targets.
- **Typography Neutrals:** Primary text `#111827` (charcoal ink for high-contrast legibility), secondary labels `#4B5563`, and muted units/timestamps `#9CA3AF`.

## Typography

The type system is powered by **Plus Jakarta Sans**, providing clean modern geometry with subtle organic curvature that avoids cold clinical sterility.

### Key Rules
- **Tabular Numerals (`font-variant-numeric: tabular-nums`):** Mandatory for real-time energy outputs, dynamic wattage figures, and battery levels to eliminate horizontal jitter during live telemetry updates.
- **Hierarchy of Telemetry:** Numerical values are rendered in semi-bold or bold (`font-weight: 700 / 800`) at primary contrast (`#111827`), paired directly with lowercase or capitalized unit descriptors (`kW`, `kWh`, `V`, `A`) rendered in medium weight (`font-weight: 600`) in muted gray (`#9CA3AF`).
- **Brazilian Portuguese Optimization:** Line heights accommodate accent marks (diacritics: `ã`, `õ`, `ç`, `á`, `ê`) without clipping top vertical boundaries in dense dashboard widgets.

## Layout & Spacing

The layout embraces an airy, breathable hierarchy optimized for mobile thumb interaction while scaling cleanly to multi-column desktop command centers.

### Mobile Grid (Default)
- **Margins:** `16px` (`margin`) outer edge margin on standard viewports.
- **Gutters:** `12px` to `16px` between sibling cards.
- **Stacking:** Single-column modular feed. The architectural isometric home telemetry view occupies the upper viewport, anchored above vertically stacked insight modules.

### Desktop Web Layout
- **Breakpoints:** `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.
- **Grid:** 12-column layout with `24px` (`gutter-desktop`) gutters and maximum container width of `1240px` centered.
- **Reflow:** The mobile top graphic converts into an expansive left/center interactive digital twin, with telemetry cards and environmental impact gauges distributing across a balanced 3-column dashboard arrangement.

## Elevation & Depth

Visual hierarchy avoids heavy borders and hard division lines, leaning into diffused atmospheric shadows and pure white surface floats over the sky-tinted background gradient.

### Shadow Styles
- **Surface Card Float:** `box-shadow: 0 10px 30px -5px rgba(27, 49, 77, 0.06), 0 4px 10px -2px rgba(27, 49, 77, 0.03)`. This soft cool-tinted shadow ensures cards lift naturally from the `#DCEBFA → #F3F5F7` backdrop.
- **Active Pill & Live Badge Float:** `box-shadow: 0 4px 14px rgba(29, 185, 138, 0.25)` for primary green elements; `box-shadow: 0 4px 12px rgba(17, 24, 39, 0.06)` for white pill badges.
- **Modal / Overlay Sheet:** `box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.12)`.

### Border Philosophy
Cards do not utilize standard `1px solid` grey borders. Instead, interfaces use pure white fill with optional ultra-subtle translucent highlighting: `border: 1px solid rgba(255, 255, 255, 0.8)`.

## Shapes

The design uses generous organic curvature throughout:

- **Cards & Primary Modules:** Uniform `24px` radius (`rounded-xl` / `1.5rem`), creating a soft, welcoming, and high-end hardware-software aesthetic.
- **Badges, Status Indicators, & Quick-Action Chips:** Full pill roundedness (`9999px`), ensuring distinction from functional content cards.
- **Circular Metric Badges:** Exact 1:1 aspect ratio circular containers (`border-radius: 50%`) with soft pastel tinted fills (e.g., `#E8F8F3` for tree/eco badges, `#EEF2F6` for carbon savings) to house iconography.

## Components

### 1. Cards
- **Structure:** Solid white (`#FFFFFF`) background, `24px` border radius, padding of `20px` mobile / `24px` desktop.
- **Card Headers:** Flexbox alignment with bold section title (`headline-sm`, `#111827`) on the left and subtle navigational chevron (`#9CA3AF`) on the right.

### 2. Status Badges & Pills
- **"On Grid" (Conectado à Rede) Pill:** Solid fill `#1DB98A`, white text `#FFFFFF`, bold `12px` font, full pill radius, horizontal padding `12px`, vertical padding `4px`.
- **"Live" (Ao Vivo) Badge:** Opaque white pill (`#FFFFFF`), charcoal text (`#111827`), soft shadow, with a dynamic pulsing radio-dot: an inner 6px solid emerald dot `#1DB98A` with an ambient breathing ring `rgba(29, 185, 138, 0.3)`.

### 3. Energy Telemetry Display
- **Layout:** Vertical stack pairing category subtitle (`body-sm`, `#4B5563`), big display number (`headline-md` or `headline-lg`, `#111827`), and an inline colored indicator (`#1DB98A` for "Geração", `#F28C28` for "Consumo").
- **Connector Lines:** Ultra-thin `1px` subtle lines (`#CBD5E1`) linking physical inverter/house illustrations directly to corresponding real-time metric groups.

### 4. Environmental Contribution Badges
- **Layout:** 3-column horizontal grid.
- **Icon Container:** 48px circular background in ultra-light pastel tint (`#E2E8F0` for coal, `#E0F2FE` for CO2, `#D1FAE5` for trees).
- **Metric Content:** Centered label (`body-sm`, `#4B5563`) above bold quantified value (`title-telemetry`, `#111827`) with appended unit (`toneladas`, `árvores`).

### 5. Buttons & Controls
- **Primary Button:** `#1DB98A` background, white label, full rounded pill shape (`9999px`), height 48px, bold `15px` label.
- **Secondary Button:** Opaque white surface with faint `#E2E8F0` edge, `#111827` text.
- **Segmented Time Period Selectors (Dia / Mês / Ano):** Enclosed rounded pill track (`#E2E8F0` background) with animated sliding white active pill.

### 6. Inverter Diagnostic & Charts
- **Area & Bar Charts:** Gradient fills fading from `rgba(29, 185, 138, 0.35)` to transparent along the baseline, rendered with smooth bezier curves. Secondary consumption line plotted in `#F28C28`.
- **Fault/Diagnostic Strip:** Soft red tinted background (`#FEF2F2`) with red accent text (`#EF4444`) and icon for error events; emerald tint (`#ECFDF5`) for normal operation.