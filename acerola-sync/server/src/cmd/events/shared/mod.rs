/// `i64` IDs go to the frontend as strings: JavaScript's `number` loses precision above 2^53.
pub fn serialize_i64_as_string<S>(val: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&val.to_string())
}
