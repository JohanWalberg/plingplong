/** Escapes LIKE/ILIKE wildcards so a user term matches literally; Postgres uses backslash as the default escape. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}
