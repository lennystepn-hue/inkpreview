// PROMO_UNLIMITED=true, GUEST_GENERATION_LIMIT=1 project.
import { expect, it } from "vitest";

import { auth, call, postJson } from "../helpers";

it("launch promo lifts all caps (still ledgered)", async () => {
  const h = await auth();
  const usage = await (await call("/api/usage", { headers: h })).json<any>();
  expect(usage.limit).toBeNull();
  expect(usage.promo).toBe(true);
  for (let i = 0; i < 3; i++) expect((await postJson("/api/designs", { prompt: "x", styles: [] }, h)).status).toBe(202);
  expect((await (await call("/api/usage", { headers: h })).json<any>()).used).toBe(3);
});
