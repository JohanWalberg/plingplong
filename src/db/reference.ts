/**
 * Production-safe reference data: upserts municipalities and areas and nothing
 * else. Idempotent, so it runs after every migration in the pre-deploy step.
 * Run with `pnpm db:reference`.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "./index";
import { slugify } from "@/lib/slug";
import { AREAS, MUNIS, STOCKHOLM_COUNTY } from "./reference-data";

const { municipality, area } = schema;

export async function upsertReferenceData(): Promise<{ municipalities: number; areas: number }> {
  let municipalities = 0;
  const idByName = new Map<string, string>();
  for (const [code, sv, en, lat, lon, county = STOCKHOLM_COUNTY] of MUNIS) {
    const [row] = await db
      .insert(municipality)
      .values({ code, nameSv: sv, nameEn: en, slugSv: slugify(sv), slugEn: slugify(en), county: county[0], countySv: county[1], countyEn: county[2], centroid: { x: lon, y: lat } })
      .onConflictDoUpdate({
        target: municipality.code,
        set: { nameSv: sv, nameEn: en, slugSv: slugify(sv), slugEn: slugify(en), county: county[0], countySv: county[1], countyEn: county[2], centroid: sql`coalesce(${municipality.centroid}, ${sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`})` },
      })
      .returning({ id: municipality.id });
    idByName.set(sv, row.id);
    municipalities++;
  }
  let areas = 0;
  for (const [muniName, list] of Object.entries(AREAS)) {
    const municipalityId = idByName.get(muniName);
    if (!municipalityId) continue;
    for (const [name, lat, lon] of list) {
      const slug = slugify(name);
      const existing = await db.query.area.findFirst({ where: and(eq(area.municipalityId, municipalityId), eq(area.slug, slug)), columns: { id: true } });
      if (existing) await db.update(area).set({ name }).where(eq(area.id, existing.id));
      else await db.insert(area).values({ municipalityId, name, slug, centroid: { x: lon, y: lat } });
      areas++;
    }
  }
  return { municipalities, areas };
}

if (process.argv[1] && /reference\.ts$/.test(process.argv[1])) {
  upsertReferenceData()
    .then((r) => {
      console.log(`reference data in place: ${r.municipalities} municipalities, ${r.areas} areas`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
