import { getTableName, sql, type Column } from "drizzle-orm";

/**
 * A fully qualified `"table"."column"` reference, for use inside a raw
 * correlated subquery.
 *
 * Drizzle renders a column as a bare `"id"` when the surrounding select has
 * only one table, because nothing there is ambiguous. Inside a subquery that
 * bare name binds to the subquery's own tables instead, so
 * `where ls.source_id = "id"` quietly compares two inner columns and matches
 * no rows: the query returns zero instead of failing. Qualifying the reference
 * keeps it pointing at the outer row whether or not the outer select happens
 * to join another table.
 *
 * Use this for every outer-row reference inside a `sql` subquery. Interpolating
 * the column directly is only safe by accident.
 */
export function outer(column: Column) {
  return sql.raw(`"${getTableName(column.table)}"."${column.name}"`);
}
