# Product decisions

Answers from the product owner on 2026-09-05 to the questions in
`DESIGN-REVIEW.md`, plus the defaults accepted there. Update this file when a
decision changes.

| # | Question | Decision |
|---|---|---|
| 1 | Product name | **Hyrabostad**. Package name `hyrabostad`, User-Agent `Hyrabostad/1.0 (+https://hyrabostad.se/om-insamling)`, domain assumed `hyrabostad.se`. |
| 2 | Manual publishing | In the MVP. Manual listings go live immediately when published by an approved landlord. Staff can review afterwards; the review is logged on the listing timeline. |
| 3 | Sublets | Out of scope for now. `contract_type` stays in the schema, the UI only offers first-hand. |
| 4 | Saved searches / save home | Implemented in the browser with `localStorage`, no account. |
| 5 | Landlord auth | Email and password to start. Owners invite colleagues to their workspace by email; invited users set a password from the invite link. BankID is added later through an OIDC broker; the auth layer keeps a provider slot for it. |
| 5b | Eligibility | Any organisation with an organisation number may apply. Brf associations and applicants without a website skip the email-domain check; the check is recorded as "not applicable" for the reviewer. |
| 6 | Admin language | Localised, same as the public site: `/sv/admin/...` and `/en/admin/...`. |
| 7 | Photos | Both. Fetched listings hotlink the source image URL. Manual listings can upload images, stored on local disk in development behind a storage interface. |
| 8 | BankID | Not now. Landlord and staff sign in with email and password. Staff SSO and landlord BankID are later provider additions. |

Deviations from the implementation brief that follow from these answers:

- **Auth library**: Better Auth instead of Auth.js. Email and password, organisations, invitations and magic links are built in, and BankID can be added as a generic OIDC provider later. Auth.js has no first-class password or organisation support.
- **Next.js 16** instead of 15, because 15 is no longer the current line. Middleware is `proxy.ts`, route params are promises.
- All defaults in section 6 of `DESIGN-REVIEW.md` are accepted.
