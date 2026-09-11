import { ImageResponse } from "next/og";
import { SITE_HOST } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK = "#1a1815";
const INK_2 = "#4a453d";
const MUTED = "#6b655d";
const PRIMARY = "#a34a2a";
const BG = "#faf8f5";
const LINE = "#e2ddd5";

/**
 * Branded 1200×630 card used for every Open Graph image. Text only on
 * purpose: listing photos are hotlinked from landlord hosts and can be slow
 * or gone, and a card that always renders beats one that sometimes does.
 */
export function ogCard({ kicker, title, subtitle, facts = [], footer }: { kicker: string; title: string; subtitle?: string; facts?: string[]; footer?: string }) {
  const titleSize = title.length > 48 ? 52 : title.length > 30 ? 64 : 76;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, color: INK, padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: `4px solid ${PRIMARY}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 20, height: 14, background: PRIMARY, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>plingplong</div>
          <div style={{ fontSize: 22, color: MUTED, marginLeft: 8 }}>{kicker}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 20 }}>
          <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 1040, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 34, color: INK_2, lineHeight: 1.25 }}>{subtitle}</div> : null}
          {facts.length ? (
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              {facts.map((f) => (
                <div key={f} style={{ fontSize: 26, fontWeight: 600, padding: "10px 20px", border: `2px solid ${LINE}`, borderRadius: 999, background: "#fff", color: INK_2 }}>
                  {f}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `2px solid ${LINE}`, paddingTop: 24, fontSize: 24, color: MUTED }}>
          <div>{footer ?? ""}</div>
          <div style={{ color: PRIMARY, fontWeight: 600 }}>{SITE_HOST}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
