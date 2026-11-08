//! Cliente do GraphQL do AniList. É o único ponto do server que fala com o AniList: toda
//! chamada passa pelo mesmo `RateGate`, então o limite vale para o processo inteiro.

pub mod client;
pub mod queries;
pub mod types;

pub use client::AnilistClient;
