---
name: acerola-project
description: Padrão de todo projeto Acerola — inglês em tudo que o usuário não vê (pastas, arquivos, rotas, código, banco, logs, comentários), i18n obrigatório com JSON aninhado, estrutura de pastas da raiz e de cada app (Svelte, Rust, Android), padrões de código por camada, licença MPL-2.0, arquivos obrigatórios (CLAUDE.md, acerola.config.json, lefthook, .gitmessage) e como começar um projeto novo a partir do kit. Use ao criar projeto, app, pasta, arquivo, rota, tabela, módulo, camada ou texto de tela, ao decidir onde um arquivo mora ou como algo se chama, e ao revisar se um projeto segue o padrão.
---

# Projeto Acerola

Todo repositório Acerola tem a mesma cara, seja web, extensão, desktop, Android ou Rust. O
`acerola-brand` é o ponto de partida: ele segue este padrão e entrega o kit (`acerola-template.zip`).

Os padrões de código (seção 5) são **o padrão**, não lei física. Um projeto pode trocar um deles
quando houver motivo; aí a troca e o porquê ficam escritos no `CLAUDE.md` do projeto, na seção
"Desvios do padrão". As seções 1 e 2 (idioma e i18n) **não** têm desvio.

## 1. Idioma: o que o usuário não vê é em inglês 🔒

**Inglês, sempre:**

- nomes de pasta e arquivo (`library/`, `media-card.svelte`, nunca `biblioteca/`, `capa.svelte`);
- rotas e URLs (`/library/anime`, `/settings`), âncoras (`#downloads`) e query strings;
- identificadores: variável, função, tipo, classe, componente, enum, constante;
- banco: tabela, coluna, índice, migração, modelo/entidade (`media_progress.updated_at`);
- chaves de JSON, de config (`acerola.config.json`), de i18n e de storage (`acerola-theme`);
- logs, códigos de erro, eventos de analytics, nomes de fila, de bucket e de variável de ambiente;
- **comentários de código** e docstrings.

**Português (o que pessoas leem):**

- o texto que aparece na tela, **sempre via i18n** (nunca escrito no código);
- docs para pessoas (README, CONTRIBUTING, docs/), skills, `CLAUDE.md`;
- mensagens de commit e de PR, títulos de issue;
- mensagens que um script imprime no terminal para quem roda.

Conteúdo de exemplo dentro de um snippet de código (o texto de um botão num exemplo HTML) é
conteúdo, não identificador: pode ficar em português.

## 2. i18n 🔒

Todo projeto tem i18n, mesmo que hoje só fale português.

- **Paraglide (inlang)** em projeto web/Svelte; recursos do Android (`strings.xml`) e `fluent`/
  `rust-i18n` em Rust seguem as mesmas regras de chave.
- Idiomas: `pt-br` (base) e `en`. Arquivos em `<app>/messages/{locale}.json`.
- Texto de tela nunca escrito no código: `m['library.search.placeholder']()`.
- **Chave em inglês e aninhada por assunto.** Cada nível é um segmento: uma palavra, ou camelCase
  para um substantivo composto (`primaryForeground`). Nunca `_` ou `-` para emendar contexto:
  isso é mais um nível.

```jsonc
// certo
{ "library": { "search": { "placeholder": "Buscar título", "empty": "Nada encontrado" } } }

// errado
{ "library_search_placeholder": "…" }          // _ emendando contexto
{ "library": { "search_empty": "…" } }          // idem, no meio
{ "biblioteca": { "busca": "…" } }               // chave em português
```

- Todo idioma tem exatamente as chaves do idioma base; nenhum valor vazio.
- Parâmetro com nome em inglês: `"Ep {current} de {total}"`.
- Conferido por `scripts/i18n/check-i18n.mjs` (hook do Claude, `pre-commit` e CI).

## 3. Raiz do repositório

A raiz guarda o que é do repositório; o código mora em pastas com o nome do local do commit.

```
<repo>/
├── <app>/                 cada app numa pasta (ou acerola/<app>/ quando são vários)
│   └── messages/          pt-br.json · en.json
├── lib/<name>/            biblioteca compartilhada entre apps (dependência por caminho)
├── docs/                  ARQUITETURA.md e guias; docs/github/ guarda imagem do README
├── scripts/
│   ├── git/               branch-guard.sh · commit-msg.mjs · setup-git.mjs
│   ├── design/            check-design.mjs
│   ├── i18n/              check-i18n.mjs
│   └── release/           bump e afins
├── .claude/               settings.json (hooks) · skills/ (acerola-design, acerola-project, acerola-git)
├── .github/               workflows/ · ISSUE_TEMPLATE/ · PULL_REQUEST_TEMPLATE.md · CODEOWNERS · dependabot.yml
├── acerola.config.json    project, commit.scopes, design (scan/extensions/exempt), i18n (messages/baseLocale)
├── CLAUDE.md              regras do projeto e "Desvios do padrão"
├── README.md · CONTRIBUTING.md · RELEASE.md · LICENSE
└── .gitmessage · .gitattributes · .editorconfig · lefthook.yml
```

- Um app por pasta; o nome da pasta é o **local** do commit (`[feat](desktop): …`).
- Nada de código solto na raiz. Configuração global (lefthook, editorconfig) sim.
- Gerado não entra no git (`build/`, `target/`, `node_modules/`, zip, `paraglide/`, `*.generated.*`).
- Nomes de pasta e arquivo em kebab-case (Kotlin e Rust seguem a convenção da linguagem).

## 4. Dentro de cada app

### Svelte (SvelteKit, extensão, front do Tauri)

```
src/
├── lib/
│   ├── components/acerola-<name>/   <name>.svelte · .test.ts · .stories.svelte
│   ├── hooks/use-<name>/            use-<name>.svelte.ts (estado com runes)
│   ├── utils/<name>.util.ts         função pura
│   ├── data/                        conteúdo estático (aponta para mensagens, nunca texto)
│   ├── types/<name>.type.ts         só tipo
│   ├── api/                         cliente HTTP/IPC
│   ├── paraglide/                   gerado pelo Paraglide (fora do git)
│   └── theme/                       tokens (cópia do brand book)
└── routes/                          páginas; lógica vai para lib/
```

- Import com alias `#lib/*` (package.json `imports`).
- Props no formato **`data` / `events` / `ui`**: dado, callback, aparência.
- Componente não busca dado: recebe em `data`. Quem busca é a rota ou um hook.

### Rust (server, CLI, lib, Tauri)

```
src/
├── cmd/            entrada (main, CLI, comandos Tauri): sem regra de negócio
├── domain/         regra de negócio e tipos, sem I/O
├── data/
│   └── repositories/   SQL e acesso a dado; cada repositório com o seu mod tests
└── infra/          db, http, fila, config, logs
```

- Erro tipado (`thiserror`) na lib; `anyhow` só na borda (`cmd/`).
- Log técnico em inglês; texto para quem usa vai pelo i18n do app.

### Android (Kotlin + Compose)

```
app/src/main/java/<package>/
├── ui/<screen>/    Screen + ViewModel (estado exposto em StateFlow)
├── ui/theme/       Color.kt, Shape.kt, Type.kt gerados do tokens.json
├── domain/         casos de uso
└── data/           repositório, fonte local e remota
```

## 5. Padrões de código (trocáveis com motivo escrito)

| Camada | Padrão |
|---|---|
| Interface | componente burro (`data/events/ui`) + página que orquestra |
| Estado | hook (`use-*.svelte.ts`) ou ViewModel; nada de estado global solto |
| Domínio | serviço/caso de uso puro, testável sem I/O |
| Dados | **Repository**: SQL e chamada externa só ali |
| Plataforma | porta (trait/interface) no domínio, adaptador na infra (ports & adapters) |
| Erro | tipado, com mensagem que diz o que fazer; nunca engolido |
| Config | arquivo + variável de ambiente; segredo nunca no código |

Regras gerais: datas guardadas em UTC e mostradas na hora de Brasília; nada de request repetido
(cache/espelho primeiro); toda funcionalidade com teste no nível em que a regra mora.

## 6. Licença

- Tudo o que é nosso é **MPL-2.0**: código, CSS, scripts, skills, docs e arte (ícone, mascote).
- `LICENSE` na raiz com o texto da MPL-2.0; `"license": "MPL-2.0"` no `package.json`,
  `license = "MPL-2.0"` no `Cargo.toml`.
- Arquivo de código novo pode começar com `SPDX-License-Identifier: MPL-2.0` no comentário de topo.
- O que é de terceiros mantém a licença de origem e fica escrito no README: fontes (SIL OFL 1.1),
  código vendorizado (ex.: iroh, MIT/Apache-2.0).

## 7. Começar um projeto novo

1. Baixe `acerola-template.zip` no brand book e descompacte na raiz do repositório novo.
2. Edite `acerola.config.json`: `project`, `commit.scopes`, `design.scan` e `i18n.messages`.
3. Ajuste `CLAUDE.md` (regras do projeto) e `.github/CODEOWNERS`.
4. `node scripts/git/setup-git.mjs` (Git-Flow, template de commit e lefthook).
5. i18n: `messages/pt-br.json` e `en.json`, Paraglide compilando no `dev`/`build`/`check`.
6. Tokens: `theme.css` + `components.css` (web) ou o tema gerado do `tokens.json` (Android).
7. Primeiro commit na `develop`, por uma `feature/…`, no formato `[chore](docs): …`.

## 8. Antes de entregar

- [ ] Tudo que o usuário não vê em inglês (nomes, rotas, banco, chaves, logs, comentários).
- [ ] Nenhum texto de tela no código: tudo via i18n, chaves aninhadas, `pt-br` e `en` iguais.
- [ ] `node scripts/i18n/check-i18n.mjs` e `node scripts/design/check-design.mjs` sem erro.
- [ ] Arquivo no lugar certo (seções 3 e 4).
- [ ] Padrão seguido, ou desvio escrito no `CLAUDE.md`.
- [ ] Licença MPL-2.0 declarada; terceiros listados.
