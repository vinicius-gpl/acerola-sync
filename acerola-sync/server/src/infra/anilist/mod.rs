//! AniList GraphQL client. It is the only place in the server that talks to AniList: every
//! call goes through the same `RateGate`, so the limit applies to the whole process.

pub mod client;
pub mod queries;
pub mod types;

pub use client::AnilistClient;
