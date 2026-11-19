# Acerola Sync — regras do projeto

Sincroniza o que você assiste e lê com o AniList: extensão (Svelte + WXT), servidor Rust e Postgres.

## Padrão Acerola — REGRA OBRIGATÓRIA

Antes de mexer, carregue a skill certa e siga-a:

| Vai mexer em | Skill |
|---|---|
| tela, componente, cor, fonte, ícone, toast, aviso, peça de marca | `acerola-design` |
| nome, pasta, rota, banco, texto de tela, i18n, camada, licença | `acerola-project` |
| commit, branch, PR, issue, workflow, release | `acerola-git` |

- **Tudo que o usuário não vê é em inglês**: pastas, arquivos, rotas, identificadores, chaves,
  tabelas, colunas, modelos, logs e comentários de código.
- **i18n obrigatório**: nenhum texto de tela no código; chave em inglês e aninhada por assunto,
  sem `_`/`-` emendando contexto (`acerola-sync/extension/svelte/messages/{pt-br,en}.json`).
- Commit `[tipo](local): Mensagem`; locais em `acerola.config.json` (`commit.scopes`).
- **Só três branches vivas: `main`, `develop` e a de trabalho.** Juntou, apaga (local e remota).
  Outra branch só fica se quem administra pedir de forma específica.
- `node scripts/design/check-design.mjs` e `node scripts/i18n/check-i18n.mjs` precisam passar
  (hooks do Claude, `pre-commit` do lefthook e CI). Exceção de design só com
  `design-allow: <motivo>` na linha.
- Licença MPL-2.0.

## Deste projeto

- Arquitetura e decisões: `docs/ARQUITETURA.md`. Extensão: `docs/EXTENSAO.md`.
- Server (Rust): SQL só em `data/repositories`, cada repositório com o seu `mod tests`; `cmd/` não
  tem regra de negócio.
- Extensão: todo componente em `lib/components/acerola-<nome>/` tem `.svelte` + `.test.ts` +
  `.stories.svelte`.
- Nada de request desnecessário ao AniList: tela lê do espelho (Postgres); query leve na
  lista/busca; detalhe só uma vez por obra.
- Datas guardadas em UTC; a tela mostra no horário de Brasília.
- Cores do tema em `theme/colors/catppuccin.css`, cópia exata do acerola-reader (só claro/escuro);
  raio e sombra em `theme/tokens.css`. Fora do Tailwind (aviso em shadow DOM no site), injete o
  `catppuccin.css` e use `var(--success)` etc., como em `lib/tracking/toast.ts`.
- Animação com as actions de `lib/utils/motion.utils.ts` (GSAP): `staggerIn`, `revealIn`,
  `countUp`, `pop`, `spinWhile`.
- Componente que mede tamanho ou posição (indicador, rolagem, fade) precisa de um caso em
  `extension/tests/e2e/visual.spec.ts`: o jsdom dos unitários não mede layout.
- Lista com `{#each … (chave)}`: a chave nunca repete (dado do AniList repete).

## Desvios do padrão

- **Tags por app**: `extension/vX.Y.Z` e `server/vX.Y.Z` (pré-versão `-rc.N`), em vez de uma
  `vX.Y.Z` por repositório: os dois apps têm versões próprias. A tag continua sendo a única coisa
  que publica e precisa estar na `main`.
- **Pastas**: os apps moram em `acerola-sync/extension/` e `acerola-sync/server/`; o local de
  commit do server é `backend`, não `server`, para manter o histórico.
- **Extensão sem rotas**: telas em `lib/screens/` (o WXT não tem router) e import por `$lib/*`
  em vez de `#lib/*`.
- **Migrations** (`server/src/infra/db/migrations/`) ficam com os comentários em português: mudar o
  arquivo muda o checksum e o sqlx recusa o banco que já aplicou a versão antiga.
- **`catppuccin.css`** fica com o comentário original: é cópia exata do acerola-reader.
