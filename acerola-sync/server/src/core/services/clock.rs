use chrono::{FixedOffset, NaiveDate, Utc};

/// Brasília time (UTC−3, no daylight saving since 2019). Everything is stored in UTC; only the
/// AniList calendar dates (`startedAt`/`completedAt`) use the Brasília day, so an episode
/// watched at 10 pm does not fall on the next day.
pub fn brasilia_offset() -> FixedOffset {
    FixedOffset::west_opt(3 * 3600).expect("offset válido")
}

pub fn today_in_brasilia() -> NaiveDate {
    Utc::now().with_timezone(&brasilia_offset()).date_naive()
}
