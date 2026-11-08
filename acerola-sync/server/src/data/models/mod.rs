//! Linhas das tabelas. Os IDs do AniList são `Int` (32 bits) no GraphQL, então vão como
//! número para a extensão sem perder precisão; só os IDs gerados pelo Postgres (`BIGSERIAL`)
//! seguiriam a regra de `serialize_i64_as_string`, e nenhum deles sai daqui como chave.

pub mod entry;
pub mod media;
pub mod sync;
pub mod tracking;
pub mod user;
