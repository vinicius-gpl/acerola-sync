---
name: acerola-design
description: Como todo app Acerola tem que parecer e se comportar visualmente (web, extensão, desktop Tauri, Android) — tokens de cor/raio/sombra do acerola-sync, tipografia (DM Sans, Noto Serif, Titan One só na marca), componentes, estados obrigatórios, acessibilidade, movimento GSAP, texto, ícone e mascote. Use ANTES de criar ou mudar qualquer tela, componente, cor, fonte, ícone, toast ou peça de marca, e ao revisar se algo segue o padrão.
---

# Design Acerola

Fonte da verdade visual de **todos** os apps Acerola. O padrão nasceu no acerola-sync. Os arquivos
publicados ficam no brand book (`/brand/css/tokens.css`, `theme.css`, `components.css`,
`tokens.json`, `/brand/logo`, `/brand/mascot`).

**Regra zero:** isto não é sugestão. O hook `scripts/design/check-design.mjs` recusa o arquivo que
fugir das regras marcadas com 🔒. Exceção só com `design-allow: <motivo>` na linha, e o motivo
precisa convencer quem revisa.

## 1. A cara do Acerola

Blocos sólidos, cantos muito redondos, tipografia grande e pesada, cor só onde significa algo.
Escuro é o padrão. Divertido na marca (mascote, Titan One, adesivo, fita) e sério na interface
(DM Sans, tokens e espaço).

## 2. Cor 🔒

- Cor **só por token**. CSS: `var(--primary)`. Tailwind: `bg-primary`, `text-success`.
- Proibido: hex, `rgb()`/`hsl()`/`oklch()`, paleta do Tailwind (`bg-emerald-500`), `black`,
  `white`, cor arbitrária `bg-[#…]`. Cor nova nasce no `tokens.css`, com nome de papel
  (`--warning`), nunca de cor (`--amarelo`).
- **Uma ação primária por tela** (`bg-primary`). Um destaque (`accent-hero`) por vez.
- Estado = fundo `*-soft` + texto do tom (`bg-success-soft text-success`), ou um ponto.
- Texto sobre cor cheia usa o `*-foreground` dela.
- Sobre capa ou arte: `bg-scrim/50` e `text-on-scrim`.
- Toda tela é conferida no **escuro e no claro** (`data-theme="light"`).

| Papel | Tokens |
|---|---|
| Fundo, do mais fundo ao mais alto | `crust` · `mantle` · `background` · `card` · `surface` |
| Texto | `foreground` · `muted-foreground` |
| Ação / destaque | `primary` (+ `-foreground`, `-soft`) · `accent-hero` |
| Estado | `success` · `warning` · `info` · `destructive` (+ `-soft`) |
| Gráfico | `chart-1` … `chart-5`, nessa ordem |

## 3. Forma e sombra 🔒

| Token | Raio | Para |
|---|---|---|
| `rounded-sheet` | 32px | painel/folha inteira |
| `rounded-card` | 28px | cartão grande, toast, aviso |
| `rounded-tile` | 24px | bloco de número, linha de lista, capa |
| `rounded-inner` | 16px | coisa dentro de cartão: campo, capa pequena, ícone |
| `rounded-full` | — | pílula, ficha, botão, progresso |

- Sombra: `shadow-lift` (parado) e `shadow-float` (flutua). Nenhuma outra.
- **Nenhuma borda colorida.** Divisória neutra (`border-border`) só quando o fundo não separa.
- Espaço só pela escala do Tailwind (4px). Respiro generoso: cartão com `p-5`, seção com `py-14`.

## 4. Tipografia 🔒

| Fonte | Token | Uso |
|---|---|---|
| **DM Sans** | `font-sans` | tudo da interface: texto, botão, lista, título, número |
| **Noto Serif** | `font-heading` | título editorial (post, documento). Raro |
| **Titan One** | `font-display` | **só a marca**: letreiro, hero, splash, capa, fita, adesivo, palco da tela de erro |

- Texto forte: `font-black tracking-tight`. Número: `font-black tabular-nums`.
- Título de tela: `text-[44px] font-black tracking-tighter leading-none`, com `text-xs
  font-semibold text-muted-foreground` acima. Os tipos (Anime/Mangá) são as palavras do título.
- Título de seção: `text-lg font-black tracking-tight`.
- Corpo mínimo de 14px; 16px em campo no celular. Rótulo em caixa alta só curto (≤ 3 palavras).
- 🔒 Titan One nunca entra em botão, aba, campo, lista ou título de tela.

## 5. Componentes

Em Svelte, `lib/components/acerola-<nome>/`. Fora do Svelte, as classes `.ac-*` do
`components.css` são o modelo.

| Peça | Regra |
|---|---|
| Botão | pílula `h-11`/`h-12`, `font-black`. Principal `bg-primary`; secundário `bg-surface`; sobre cor `bg-foreground text-background` |
| Abas | `AcerolaChipTabs`: trilha `bg-surface`, ativa `bg-foreground text-background`, desliza com GSAP |
| Navegação | `AcerolaPillNav`: pílula flutuante, ativo vira pílula `bg-primary` com o nome |
| Número | `AcerolaStatTile` com tom: fundo soft + texto do tom |
| Capa | `AcerolaMediaCard`: 2/3, `rounded-tile`, ficha sobre scrim, progresso `bg-primary` |
| Toast/aviso | `rounded-card`, sem borda, fundo e texto no tom do tipo |
| Vazio | `AcerolaEmptyState`: mascote (ou ícone redondo) + título `font-black` + uma frase + uma ação |
| Diálogo | folha `rounded-sheet` com `shadow-float`; ação de confirmar `bg-foreground` |
| Tela de erro | `AcerolaErrorScreen` / `.ac-error`: texto de um lado, mascote sobre o código do outro. Seção 6.1 |

## 6. Estados obrigatórios

Toda tela que carrega dado tem os quatro, desenhados (nunca tela em branco):

1. **Carregando**: esqueleto no formato do conteúdo (`bg-surface` pulsando), nunca spinner solto.
2. **Vazio**: `AcerolaEmptyState` com a mascote e uma ação.
3. **Erro**: aviso `destructive-soft` com o que aconteceu e o que fazer (tentar de novo).
4. **Pronto**: o conteúdo.

### 6.1 Tela de erro 🔒

Todo app tem **uma** tela para qualquer erro (404, 401, 403, 500, 503, sem conexão…), igual à do
brand book (App → Tela de erro). Nunca a página padrão do framework, do servidor ou do host.

- Modelo pronto em `reference/error-screen/` desta skill (no zip; no acerola-brand a fonte é o
  próprio site, em `acerola-brand/src/`): `+error.svelte`,
  `acerola-error-screen.svelte`, `error.util.ts` e as chaves `error.*` em `messages.pt-br.json` e
  `messages.en.json`. Fora do Svelte, as classes `.ac-error*` do `components.css`.
- Momento de marca, como o hero: de um lado o texto (eyebrow "Erro {status}" em
  `destructive-soft`, título grande, uma frase que diz o que fazer e duas ações); do outro, o palco
  com carimbo girando, o código em letreiro Titan One, a mascote, a fita e o adesivo "Ops!".
- **Só o erro na tela**: sem barra de navegação, rodapé ou menu do app. A tela ocupa a janela
  inteira, centralizada; as duas ações são a saída.
- **Tela pequena** (o espaço da tela abaixo de 720px, por container query, não pela janela): o
  palco vem primeiro e menor, o texto centralizado embaixo e as duas ações dividem a largura. Tudo
  cabe na primeira tela do celular.
- Ação principal: **4xx → "Ir para o início"**; **5xx, tempo esgotado, limite e sem conexão →
  "Tentar de novo"**. A outra vira secundária (`bg-surface`).
- O código (404) é decoração `aria-hidden`; nunca mostrar `error.message` cru, stack ou id técnico.
- Site estático: o host serve a tela no 404 (`fallback: '404.html'` no `adapter-static`) e a página
  leva `noindex`.

E também: foco visível (`ring`), desabilitado com `opacity-60` e `cursor-not-allowed`, e feedback de
toda ação em até 100ms (toast, `pop`, troca de estado).

## 7. Acessibilidade

- Contraste AA nos dois modos (os tokens já passam; não invente combinação).
- Alvo de toque mínimo de 44px (`--control-height`).
- Todo controle com nome acessível; ícone sozinho tem `aria-label`.
- Ordem de foco segue a leitura; `Esc` fecha o que abriu.
- `prefers-reduced-motion`: animação de entrada e loop desligam (GSAP `matchMedia`).

## 8. Movimento (GSAP)

- Entrada com GSAP, nunca CSS solto: em Svelte, as actions `staggerIn`, `revealIn`, `countUp`,
  `pop` e `spinWhile` (`lib/utils/motion.utils.ts`).
- Curva da marca `--ease-brand` (`cubic-bezier(.32,.72,0,1)`); duração de interface 200–420ms.
- Loop infinito (fita, carimbo, mascote respirando) só em tela de marca: hero, splash, vazio, erro.
- Tudo dentro de `gsap.matchMedia()` com `(prefers-reduced-motion: no-preference)` e `revert()` ao
  desmontar.

## 9. Ícone e mascote

| Peça | Arquivo | Uso |
|---|---|---|
| Ícone de app | `logo/acerola-logo-foreground.svg` · `icons/logo/web/favicon.ico` · `logo/png/` | app, favicon (só o SVG foreground), aba, notificação, barra |
| Ícone com fundo | `logo/acerola-logo.svg` | **só imagem** (README, post). Nunca ícone de app |
| Mascote | `mascot/acerola-mascot.svg` | boas-vindas, vazio, perfil, avatar, aviso, hero |

- A acerola é o ícone; a mascote é a personalidade. A mascote nunca vira ícone de app.
- Nunca recolorir, esticar, girar ou redesenhar ícone ou mascote.
- Ícones de interface: **Lucide**, traço 2, nos tamanhos 16/18/20/24.

## 10. Texto da interface

- Português do Brasil, frase com só a primeira maiúscula ("Buscar títulos", não "Buscar Títulos").
- Botão diz o que faz, com verbo: "Sincronizar agora", não "OK".
- Erro diz o que aconteceu e o que fazer. Sem culpar quem usa, sem código de erro cru.
- Sem ponto final em botão, aba, título e toast curto.
- Data na hora de Brasília; número com `Intl.NumberFormat('pt-BR')`.
- Todo texto via i18n (Paraglide), `pt-br` e `en`, com chave em inglês e aninhada
  (`library.search.placeholder`, nunca `library_search_placeholder`): regras na skill
  `acerola-project`, seção 2.
- Classe, id, âncora e nome de arquivo em inglês, mesmo quando o texto da tela é português.

## 11. Multiplataforma

| Plataforma | Como pega os tokens |
|---|---|
| Svelte/Tailwind (web, extensão, Tauri) | `@import 'tailwindcss'` + `tailwind.css` (ou `theme.css` + fontes) + `components.css` |
| HTML/CSS solto | `<link rel="stylesheet" href="…/brand/css/acerola.css">` |
| Android (Compose) | gere o `Color.kt`/`Shape.kt` a partir do `tokens.json`; mesmos nomes de papel |
| Rust/CLI/TUI | `tokens.json` (cores em hex) para o tema do terminal |

O nome do papel é o mesmo em toda plataforma (`primary`, `surface`, `success-soft`…).

## 12. Antes de entregar

- [ ] `node scripts/design/check-design.mjs` sem erro.
- [ ] Escuro e claro conferidos, no celular e no desktop.
- [ ] Os quatro estados (carregando, vazio, erro, pronto) existem.
- [ ] Uma ação primária; destaque usado uma vez; Titan só na marca.
- [ ] Alvo ≥ 44px, foco visível, `aria-label` em ícone sozinho, reduced-motion respeitado.
