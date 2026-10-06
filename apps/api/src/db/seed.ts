import "dotenv/config";
import { db } from ".";
import { projects } from "./schema";

async function seed() {
  const existing = await db
    .select({
      id: projects.id,
      publicKey: projects.publicKey,
    })
    .from(projects)
    .limit(1);

  if (existing.length > 0) {
    console.log("A project already exists. Nothing to seed.");

    return;
  }

  const [project] = await db
    .insert(projects)
    .values({
      publicKey: "pub_test",
      name: "Test Project",
    })
    .returning({
      id: projects.id,
      publicKey: projects.publicKey,
      name: projects.name,
    });

  if (!project) {
    throw new Error("Failed to create seed project.");
  }

  console.log("Created project:");
  console.log(project);
}

await seed();
