# Como contribuir

Este projeto segue o padrão Acerola, o mesmo de todos os repositórios Acerola. As regras completas
estão nas skills em `.claude/skills/` (`acerola-design`, `acerola-project`, `acerola-git`); o que só
vale aqui está no [CLAUDE.md](CLAUDE.md).

## Preparar a máquina

1. Node 22 ou mais novo (os scripts do padrão são `.mjs`) e
   [lefthook](https://github.com/evilmartians/lefthook) (`mise use -g lefthook`,
   `scoop install lefthook` ou `winget install evilmartians.lefthook`).
2. Na raiz: `node scripts/git/setup-git.mjs`. Grava o Git-Flow, o template de commit e instala os hooks.
3. Extensão: `npm install` dentro de `acerola-sync/`. Server: Rust estável e um Postgres; o
   `acerola-sync/server/.env` sai do `.env.example`. Os atalhos estão no `acerola-sync/mise.toml`.

## Fluxo

- Branch `feature/<nome>` ou `bugfix/<nome>` (em inglês) a partir da `develop`. A `main` e a
  `develop` são travadas.
- Commit `[tipo](local): Mensagem`, um local por commit. Locais em `acerola.config.json`.
- PR para a `develop`, com o template preenchido e prints no claro e no escuro quando mexer em tela.

## Antes do PR

```bash
node scripts/design/check-design.mjs
node scripts/i18n/check-i18n.mjs
cd acerola-sync && npm run lint && npm run typecheck && npm test      # extensão
cd acerola-sync/server && cargo fmt --check && cargo clippy --all-targets && cargo test   # server
```

## Licença

Ao contribuir, você concorda que sua contribuição sai sob a [MPL-2.0](LICENSE).
