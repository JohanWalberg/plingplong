/**
 * One result shape for staff and portal server actions. Failures carry a key
 * that the UI translates (never English zod text or a redacted `Error.message`);
 * `fields` names the form fields a validation failure concerns.
 */
export type ActionError = "invalid" | "missing" | "noChange" | "noUser" | "self" | "unexpected";
export type ActionFailure = { ok: false; error: ActionError; fields?: string[] };
export type ActionResult<T extends object = Record<never, never>> = ({ ok: true } & T) | ActionFailure;

export const OK: ActionResult = { ok: true };

export function fail(error: ActionError): ActionFailure {
  return { ok: false, error };
}

/** Maps zod issues to the top-level form field names they concern. */
export function invalid(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>): ActionFailure {
  const fields = [...new Set(issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))];
  return { ok: false, error: "invalid", fields };
}
