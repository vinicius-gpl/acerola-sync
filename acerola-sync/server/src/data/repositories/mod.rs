//! Acesso ao banco. `base` é o repositório genérico por `id`; as tabelas daqui têm chave
//! composta (`user_id`, `media_id`…), então cada uma tem o seu módulo com SQL explícito.

pub mod base;
pub mod entries;
pub mod media;
pub mod sync;
pub mod tracking;
pub mod users;

pub use base::*;
