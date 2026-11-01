"use client";

import { useEffect } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * Aplica o tema do sol da usina (dia = claro, noite = escuro). O servidor reenvia o valor a cada atualização
 * automática do painel, então a virada no pôr do sol acontece sem recarregar. O cookie faz o próximo acesso
 * já nascer no tema certo, sem piscar.
 */
export function ThemeSync({ theme }: { theme: Theme }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);
  return null;
}
