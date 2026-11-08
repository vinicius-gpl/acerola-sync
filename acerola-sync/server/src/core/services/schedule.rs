use chrono::{DateTime, Duration, NaiveTime, Utc};

/// O horário agendado mais recente que já passou (hoje ou ontem, em UTC).
pub fn latest_slot(times: &[NaiveTime], now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let today = now.date_naive();
    let yesterday = today - Duration::days(1);

    times
        .iter()
        .flat_map(|time| [today.and_time(*time).and_utc(), yesterday.and_time(*time).and_utc()])
        .filter(|slot| *slot <= now)
        .max()
}

/// Devolve o horário que deve rodar agora, se houver um que ainda não foi atendido. Se o
/// server ficou fora do ar, roda uma vez só ao voltar, não uma por horário perdido.
pub fn due_slot(
    times: &[NaiveTime], last_done: Option<DateTime<Utc>>, now: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    let slot = latest_slot(times, now)?;
    match last_done {
        Some(last_done) if last_done >= slot => None,
        _ => Some(slot),
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    fn at(hour: u32, minute: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 7, hour, minute, 0).unwrap()
    }

    fn time(hour: u32, minute: u32) -> NaiveTime {
        NaiveTime::from_hms_opt(hour, minute, 0).unwrap()
    }

    #[test]
    fn test_latest_slot_picks_most_recent_past_time() {
        let times = [time(9, 0), time(21, 0)];
        assert_eq!(latest_slot(&times, at(10, 0)), Some(at(9, 0)));
        assert_eq!(latest_slot(&times, at(22, 0)), Some(at(21, 0)));
    }

    #[test]
    fn test_latest_slot_falls_back_to_yesterday() {
        let slot = latest_slot(&[time(9, 0)], at(8, 0)).unwrap();
        assert_eq!(slot, Utc.with_ymd_and_hms(2026, 11, 6, 9, 0, 0).unwrap());
    }

    #[test]
    fn test_due_slot_runs_once_per_slot() {
        let times = [time(9, 0)];
        assert_eq!(due_slot(&times, None, at(9, 0)), Some(at(9, 0)));
        assert_eq!(due_slot(&times, Some(at(9, 0)), at(9, 30)), None);
    }

    #[test]
    fn test_due_slot_without_times_is_never_due() {
        assert_eq!(due_slot(&[], None, at(9, 0)), None);
    }
}
