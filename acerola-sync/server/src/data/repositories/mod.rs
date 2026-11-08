//! Acesso ao banco. As tabelas têm chave composta (`user_id`, `media_id`…), então cada uma
//! tem o seu módulo com SQL explícito.

pub mod entries;
pub mod media;
pub mod sync;
pub mod tracking;
pub mod users;
