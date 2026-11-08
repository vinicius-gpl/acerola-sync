use std::marker::PhantomData;

use sqlx::{
    postgres::{PgArguments, PgRow},
    query, query_as, FromRow, PgPool, Postgres,
};

use crate::infra::error::DbError;

pub trait Entity {
    fn columns() -> &'static [&'static str];
    fn table_name() -> &'static str;
    fn id(&self) -> i64;
}

pub trait Bindable {
    fn bind_insert<'query>(
        &'query self, query: query::Query<'query, Postgres, PgArguments>,
    ) -> query::Query<'query, Postgres, PgArguments>;

    fn bind_update<'query>(
        &'query self, query: query::Query<'query, Postgres, PgArguments>,
    ) -> query::Query<'query, Postgres, PgArguments>;
}

pub struct Repository<T: Entity> {
    pool: PgPool,
    _marker: PhantomData<T>,
}

impl<T: Entity> Clone for Repository<T> {
    fn clone(&self) -> Self {
        Self { pool: self.pool.clone(), _marker: PhantomData }
    }
}

/// Placeholders do Postgres (`$1, $2, …`) a partir de `start`.
fn placeholders(start: usize, count: usize) -> Vec<String> {
    (start..start + count).map(|index| format!("${}", index)).collect()
}

impl<T: Entity> Repository<T> {
    pub fn new(pool: PgPool) -> Self {
        Self { pool, _marker: PhantomData }
    }

    pub async fn count(&self) -> Result<i64, DbError> {
        let table = T::table_name();
        let result = query_as::<_, (i64,)>(&format!("SELECT COUNT(*) FROM {}", table))
            .fetch_one(&self.pool)
            .await?;
        Ok(result.0)
    }

    pub async fn find_all(&self) -> Result<Vec<T>, DbError>
    where
        T: Entity + for<'row> FromRow<'row, PgRow> + Send + Unpin,
    {
        let cols = T::columns().join(", ");
        let table = T::table_name();

        let result = query_as::<_, T>(&format!("SELECT {} FROM {}", cols, table))
            .fetch_all(&self.pool)
            .await?;

        Ok(result)
    }

    pub async fn insert(&self, entity: &T) -> Result<T, DbError>
    where
        T: Entity + Bindable + for<'row> FromRow<'row, PgRow> + Send + Unpin,
    {
        let table = T::table_name();
        let cols = T::columns().join(", ");
        let values = placeholders(1, T::columns().len()).join(", ");

        let sql = format!("INSERT INTO {} ({}) VALUES ({}) RETURNING *", table, cols, values);
        let row = entity.bind_insert(query(&sql)).fetch_one(&self.pool).await?;

        Ok(T::from_row(&row)?)
    }

    pub async fn update(&self, entity: &T) -> Result<T, DbError>
    where
        T: Entity + Bindable + for<'row> FromRow<'row, PgRow> + Send + Unpin,
    {
        let table = T::table_name();
        let update_columns =
            T::columns().iter().filter(|col| **col != "id").copied().collect::<Vec<_>>();
        let set_clause = update_columns
            .iter()
            .zip(placeholders(1, update_columns.len()))
            .map(|(col, placeholder)| format!("{} = {}", col, placeholder))
            .collect::<Vec<_>>()
            .join(", ");
        let id_placeholder = format!("${}", update_columns.len() + 1);

        let sql = format!(
            "UPDATE {} SET {} WHERE id = {} RETURNING *",
            table, set_clause, id_placeholder
        );

        let row = entity.bind_update(query(&sql)).fetch_one(&self.pool).await?;

        Ok(T::from_row(&row)?)
    }

    pub async fn delete(&self, id: i64) -> Result<(), DbError> {
        let table = T::table_name();
        query(&format!("DELETE FROM {} WHERE id = $1", table)).bind(id).execute(&self.pool).await?;
        Ok(())
    }
}
