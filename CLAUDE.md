# Acerola Sync — regras do projeto

- Arquitetura e decisões: `docs/ARQUITETURA.md`. Extensão: `docs/EXTENSAO.md`.
- Commits seguem `.gitmessage`: `[tipo](local): Mensagem`, um local por commit.
- Server (Rust): SQL só em `data/repositories`, cada repositório com o seu `mod tests`; `cmd/` não tem regra de negócio.
- Extensão: todo componente em `lib/components/` tem `.svelte` + `.test.ts` + `.stories.svelte`.
- Nada de request desnecessário ao AniList: tela lê do espelho (Postgres); query leve na lista/busca; detalhe só uma vez por obra.
- Datas guardadas em UTC; a tela mostra no horário de Brasília.

## Design — REGRA OBRIGATÓRIA

Antes de criar ou mudar qualquer tela, componente, toast ou aviso, carregue a skill
`acerola-design` (`.claude/skills/acerola-design/SKILL.md`) e siga-a.

- Cor **só por token** do tema (`theme/colors/catppuccin.css`, cópia exata do acerola-reader). Proibido hex, `rgb()`/`hsl()`, paleta padrão do Tailwind e cor arbitrária.
- Raio **só por token**: `rounded-sheet | card | tile | inner | full`. Sombra: `shadow-lift | shadow-float`.
- **Nenhuma borda colorida.** Estado vai no fundo (`*-soft`) ou num ponto.
- Animação com as actions de `lib/utils/motion.utils.ts` (GSAP).
- `npm run lint:design` precisa passar (roda no pre-commit e no hook do Claude Code). Exceção só com `design-allow: <motivo>` na linha.
