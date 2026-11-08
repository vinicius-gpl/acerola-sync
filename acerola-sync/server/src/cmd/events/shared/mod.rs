/// IDs `i64` vão como string para o frontend: o `number` do JavaScript perde precisão acima
/// de 2^53.
pub fn serialize_i64_as_string<S>(val: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&val.to_string())
}
