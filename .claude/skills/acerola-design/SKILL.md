---
name: acerola-design
description: Design system do Acerola Sync (e base para os outros apps Acerola) — tokens de cor, raio e sombra, cartões sem borda, tipografia grande, fichas e pílulas, animação com GSAP. Use ao criar ou mudar qualquer tela, componente, toast ou aviso da extensão (`acerola-sync/extension`), e quando o usuário pedir para seguir/aplicar o padrão de design.
---

# Design do Acerola

A interface é feita de **blocos sólidos com cantos bem redondos e sem borda**. O estado de uma
coisa aparece na **cor do fundo** (tons `*-soft`) ou num **ponto**, nunca numa borda colorida.

## Cores: só token

As cores vêm de `extension/svelte/src/theme/colors/catppuccin.css`, que é **cópia exata** do
acerola-reader (paleta única; só existe claro/escuro). Nunca escreva cor fora dele.

| Uso | Tokens |
|---|---|
| Fundo da página / cartão / elemento interno | `bg-background` · `bg-card` · `bg-surface` · `bg-mantle` · `bg-crust` |
| Texto | `text-foreground` · `text-muted-foreground` |
| Destaque | `bg-primary` + `text-primary-foreground` · `bg-accent-hero` + `text-accent-hero-foreground` |
| Estado (fundo + texto do mesmo tom) | `bg-success-soft text-success` · `bg-warning-soft text-warning` · `bg-info-soft text-info` · `bg-destructive-soft text-destructive` · `bg-primary-soft text-primary` |
| Ponto/indicador | `bg-success` · `bg-warning` · `bg-destructive` · `bg-info` · `bg-primary` |
| Sobre capa ou arte | `bg-scrim/50` · `from-scrim/70` · `text-on-scrim` · `bg-on-scrim/15` |

Proibido: hex, `rgb()`/`hsl()`/`oklch()`, paleta do Tailwind (`emerald-500`, `black`, `white`…),
cor arbitrária (`bg-[#…]`). Fora do Tailwind (ex.: aviso em shadow DOM no site), injete o
`catppuccin.css` e use `var(--success)` etc. — ver `lib/tracking/toast.ts`.

## Forma: só token

Definidos em `extension/svelte/src/theme/tokens.css`.

| Token | Raio | Para |
|---|---|---|
| `rounded-sheet` | 32px | painel/folha inteira |
| `rounded-card` | 28px | cartão grande, toast, aviso no site |
| `rounded-tile` | 24px | bloco de número, linha de lista, capa |
| `rounded-inner` | 16px | coisa dentro de um cartão (capa pequena, campo, ícone de site) |
| `rounded-full` | — | pílula, ficha, botão redondo, barra de progresso |

Sombras: `shadow-lift` (cartão parado), `shadow-float` (o que flutua: barra em pílula, painel,
toast). **Nenhuma borda colorida** (`border-primary`, `border-l-4`, `border-left:`…).

## Composição

- **Título de tela**: palavra grande e pesada (`text-[44px]`/`text-6xl font-black tracking-tighter leading-none`) com uma linha pequena `text-xs font-semibold text-muted-foreground` acima.
- **Abas**: `AcerolaChipTabs` (fichas numa trilha `bg-surface`, a ativa `bg-foreground text-background`, desliza com GSAP). Tipos grandes (Anime/Mangá) são as próprias palavras do título.
- **Navegação**: `AcerolaPillNav` — pílula flutuante; o item ativo vira pílula `bg-primary` com o nome.
- **Números**: `AcerolaStatTile` com tom (`primary | success | warning | info | danger | neutral`).
- **Ação principal**: botão pílula `h-11/h-12 rounded-full bg-primary font-black`; secundária `bg-surface`; em fundo colorido, `bg-foreground text-background` ou `bg-background/40`.
- **Toasts** (`svelte-sonner`): `rounded-card`, sem borda, fundo e texto no tom do tipo (sucesso é verde). Avisos no site seguem o mesmo desenho.
- **Ícone de site**: `AcerolaSiteIcon` (favicon, cai na inicial).

## Movimento (GSAP)

Use as actions de `lib/utils/motion.utils.ts` — nunca CSS solto para entrada:
`staggerIn` (grade/lista em cascata), `revealIn` (bloco), `countUp` (número), `pop` (confirmação),
`spinWhile` (girando enquanto roda). Todas respeitam `prefers-reduced-motion`.

## Validação

- `npm run lint:design` (raiz do workspace `acerola-sync/`) varre `extension/svelte/src`; roda no `pre-commit` junto do prettier.
- O hook do Claude Code (`.claude/settings.json`) roda o mesmo script em cada arquivo editado e devolve o erro na hora.
- Layout de verdade: `extension/tests/e2e/visual.spec.ts` (Playwright headless, tamanho do popup) confere indicador deslizante alinhado à ficha ativa, troca Anime ↔ Mangá sem pulo, fade e moldura das fichas, e diálogo sem borda; salva screenshots em `test-results/visual/`. O jsdom dos unitários não mede layout: componente que mede tamanho/posição (indicador, rolagem, fade) **precisa** de um caso aqui, e os screenshots são olhados antes de entregar.
- Lista com `{#each … (chave)}`: a chave nunca pode repetir (dado do AniList repete); repetida derruba a tela inteira.
- Exceção pontual: comentário `design-allow: <motivo>` na linha. Use pouco e sempre com motivo.
- Isentos: `theme/`, `components/ui/` (shadcn), componentes copiados do reader, testes.

## Checklist de componente novo

1. `lib/components/acerola-<nome>/` com `.svelte` + `.test.ts` + `.stories.svelte` (regra do reader).
2. Props no formato `data` / `events` / `ui`.
3. Só tokens de cor, raio e sombra; nenhuma borda colorida.
4. Entrada/feedback com as actions de `motion.utils.ts`.
5. Textos via paraglide (`m['sync.…']()`), pt-BR e en.
