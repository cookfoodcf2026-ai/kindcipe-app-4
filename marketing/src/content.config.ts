import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  // Keep the `.en`/`.zh` suffix so the two locales don't collide on id.
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/blog",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    lang: z.enum(["zh-HK", "en"]),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    // YAML parses an unquoted `2026-10-12` as a Date; normalise to YYYY-MM-DD.
    date: z
      .union([z.string(), z.date()])
      .transform((v) => (typeof v === "string" ? v : v.toISOString().slice(0, 10))),
    order: z.number(),
  }),
});

const recipes = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/recipes",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    lang: z.enum(["zh-HK", "en"]),
    key: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    cookTime: z.number(),
    difficulty: z.string(),
    cuisine: z.string(),
    tags: z.array(z.string()),
    ingredients: z.array(z.string()),
    steps: z.array(z.string()),
  }),
});

export const collections = { blog, recipes };
