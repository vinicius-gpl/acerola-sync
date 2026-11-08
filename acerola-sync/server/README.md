# acerola-sync (server)

API do **Acerola Sync** em Rust. Espelha a lista do AniList num Postgres, serve as telas da extensão a partir do espelho e escreve no AniList e no espelho ao mesmo tempo.

## Camadas

| Pasta | O que mora ali |
| --- | --- |
| `src/bios/` | Configuração, conexão com o banco, estado e rotas. |
| `src/cmd/` | Handlers HTTP e payloads (sem regra de negócio). |
| `src/core/` | Serviços (sync, entradas, rastreio, busca) e workers (agenda, reenvio). |
| `src/data/` | Modelos e repositórios. **Todo SQL fica aqui**, cada repositório com o seu `mod tests`. |
| `src/infra/` | Cliente do AniList (GraphQL), migrations, criptografia e erros. |

## Sync

- **Incremental**: entradas da mais recente para a mais antiga, até a primeira que não mudou desde o último pull. Quase sempre 1 request.
- **Lista inteira**: no primeiro sync, quando pedida, ou no intervalo escolhido na tela (só no botão, 6h, diária, 3 dias, semanal). É a que acha o que foi apagado no AniList.
- **Próximo episódio**: atualizado em lotes de 50 para o que está em lançamento.
- Limite de 30 requests por minuto e logs de cada execução (`/sync/runs/{id}/logs`).

## Rodando

```bash
cp .env.example .env    # preencha DATABASE_URL, ENCRYPTION_KEY e ANILIST_CLIENT_ID
cargo run
```

Ou pelo Docker, na pasta `acerola-sync/`: `mise run build:server`.

## Testes

```bash
cargo test                                                  # unitários
TEST_DATABASE_URL=postgres://user:pass@host:5432/db cargo test   # com banco: cria e apaga bancos acerola_unit_* / acerola_test_*
cargo clippy --all-targets -- -D warnings && cargo fmt --check
```

Os testes de fluxo (`tests/flows.rs`) rodam contra um Postgres de verdade e um AniList simulado (wiremock).

## Deploy

Pelo Ansible em [`../.config/ansible/`](../.config/ansible/). Veja [Release e deploy](../../README.md#release-e-deploy).
