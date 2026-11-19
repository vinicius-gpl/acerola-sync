//! Table rows. AniList IDs are `Int` (32 bits) in GraphQL, so they go to the extension as
//! numbers without losing precision; only Postgres-generated IDs (`BIGSERIAL`) would follow the
//! `serialize_i64_as_string` rule, and none of them leaves here as a key.

pub mod entry;
pub mod media;
pub mod sync;
pub mod tracking;
pub mod user;
