import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, uploaded files and static assets.
  matcher: "/((?!api|_next|_vercel|uploads|.*\\..*).*)",
};
