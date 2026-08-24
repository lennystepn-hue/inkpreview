import type { Design } from "./api";

/** Group designs into version families by walking parent_design_id to a root.
 *  Each family is ordered oldest→newest (v1, v2, …); families are ordered by
 *  most-recent activity. Lets the gallery show a design's version tree. */
export function groupFamilies(designs: Design[]): Design[][] {
  const byId = new Map(designs.map((d) => [d.id, d]));

  const rootOf = (d: Design): string => {
    let cur = d;
    let guard = 0;
    while (cur.parent_design_id && byId.has(cur.parent_design_id) && guard++ < 50) {
      cur = byId.get(cur.parent_design_id)!;
    }
    return cur.id;
  };

  const families = new Map<string, Design[]>();
  for (const d of designs) {
    const root = rootOf(d);
    const fam = families.get(root);
    if (fam) fam.push(d);
    else families.set(root, [d]);
  }

  return [...families.values()]
    .map((f) => f.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)))
    .sort((a, b) => b[b.length - 1].created_at.localeCompare(a[a.length - 1].created_at));
}
