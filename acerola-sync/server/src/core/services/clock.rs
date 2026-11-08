use chrono::{FixedOffset, NaiveDate, Utc};

/// Horário de Brasília (UTC−3, sem horário de verão desde 2019). Tudo é guardado em UTC; só
/// as datas de calendário do AniList (`startedAt`/`completedAt`) usam o dia de Brasília, para
/// um episódio visto às 22h não cair no dia seguinte.
pub fn brasilia_offset() -> FixedOffset {
    FixedOffset::west_opt(3 * 3600).expect("offset válido")
}

pub fn today_in_brasilia() -> NaiveDate {
    Utc::now().with_timezone(&brasilia_offset()).date_naive()
}
