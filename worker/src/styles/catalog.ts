/**
 * Style catalog — loaded from recipes.json (static reference data).
 *
 * Internal prompt cues (positive_cues / negative_cues / base_qualifiers) drive
 * generation and are NOT exposed to the client; only public fields are served.
 */

import data from "./recipes.json";

export interface StyleRecipe {
  slug: string;
  name: string;
  category: string;
  description: string;
  positive_cues: string;
  negative_cues: string;
  base_qualifiers: string;
  default_modifiers: Record<string, unknown>;
  tags: string[];
}

type RawRecipe = Partial<StyleRecipe> & { slug: string; name: string };

const RECIPES = new Map<string, StyleRecipe>();
for (const r of ((data as { recipes: RawRecipe[] }).recipes ?? []) as RawRecipe[]) {
  RECIPES.set(r.slug, {
    slug: r.slug,
    name: r.name,
    category: r.category ?? "other",
    description: r.description ?? "",
    positive_cues: r.positive_cues ?? "",
    negative_cues: r.negative_cues ?? "",
    base_qualifiers: r.base_qualifiers ?? "",
    default_modifiers: r.default_modifiers ?? {},
    tags: r.tags ?? [],
  });
}

// Python sorts by (category, name) with plain code-point comparison.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const SORTED = [...RECIPES.values()].sort((a, b) => cmp(a.category, b.category) || cmp(a.name, b.name));

export function allRecipes(): StyleRecipe[] {
  return SORTED;
}

export function getRecipe(slug: string): StyleRecipe | undefined {
  return RECIPES.get(slug);
}
