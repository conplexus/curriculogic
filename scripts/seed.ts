// scripts/seed.ts
import { db } from "@/db/client";
import { courses } from "@/db/schema";

async function run() {
  await db.insert(courses).values([
    { code: "PHRM101", title: "Foundations I", term: "Fall", year: 2025, credits: 3 },
    { code: "PHRM102", title: "Pharmacology I", term: "Fall", year: 2025, credits: 4 },
  ]);
  console.log("Seed complete");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
