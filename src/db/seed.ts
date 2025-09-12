import { db } from "@/db/client";
import { maps } from "@/db/schema";

async function main() {
  await db.insert(maps).values({ name: "Default" });
  console.log("Seeded: maps[1] Default");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
