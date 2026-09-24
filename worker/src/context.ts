import type { Database } from "./db/database";

type AsyncMethods<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

/** The Database object's use-case methods as seen over RPC (every call returns a promise). */
export type Db = Omit<AsyncMethods<Database>, "fetch" | "alarm" | "webSocketMessage" | "webSocketClose" | "webSocketError">;

/**
 * The single Database Durable Object. In production it is pinned to the EU
 * jurisdiction (DB_JURISDICTION=eu) so all data is stored and processed in the
 * EU (GDPR). Local workerd has no jurisdictions, so dev/tests leave it empty.
 * Never change it on a live deployment: another jurisdiction is another (empty)
 * database.
 */
export function dbStub(env: Env): Db {
  const ns = env.DB as unknown as DurableObjectNamespace<Database>;
  const j = (env.DB_JURISDICTION ?? "").trim();
  const scoped = j ? ns.jurisdiction(j as DurableObjectJurisdiction) : ns;
  return scoped.getByName("primary") as unknown as Db;
}
