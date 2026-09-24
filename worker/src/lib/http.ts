/** FastAPI-style errors + tiny request validation helpers (pydantic-like 422s). */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
    readonly headers: Record<string, string> = {},
  ) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
  }
}

export interface FieldError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export function validationError(errors: FieldError[]): HttpError {
  return new HttpError(422, errors);
}

type Obj = Record<string, unknown>;

/** Collects field errors while reading a JSON body, then throws one 422. */
export class Reader {
  readonly errors: FieldError[] = [];
  constructor(private readonly body: Obj) {}

  private fail(field: string, msg: string, type: string): void {
    this.errors.push({ loc: ["body", field], msg, type });
  }

  str(field: string, opts: { min?: number; max?: number; default?: string } = {}): string {
    const v = this.body[field];
    if (v === undefined || v === null) {
      if (opts.default !== undefined) return opts.default;
      this.fail(field, "Field required", "missing");
      return "";
    }
    if (typeof v !== "string") {
      this.fail(field, "Input should be a valid string", "string_type");
      return "";
    }
    if (opts.min !== undefined && v.length < opts.min) {
      this.fail(field, `String should have at least ${opts.min} character${opts.min === 1 ? "" : "s"}`, "string_too_short");
    }
    if (opts.max !== undefined && v.length > opts.max) {
      this.fail(field, `String should have at most ${opts.max} characters`, "string_too_long");
    }
    return v;
  }

  optStr(field: string): string | null {
    const v = this.body[field];
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") {
      this.fail(field, "Input should be a valid string", "string_type");
      return null;
    }
    return v;
  }

  bool(field: string, fallback: boolean): boolean {
    const v = this.body[field];
    if (v === undefined || v === null) return fallback;
    if (typeof v === "boolean") return v;
    if (v === 1 || v === 0) return v === 1;
    if (typeof v === "string" && ["true", "false", "1", "0", "yes", "no", "on", "off"].includes(v.toLowerCase())) {
      return ["true", "1", "yes", "on"].includes(v.toLowerCase());
    }
    this.fail(field, "Input should be a valid boolean", "bool_type");
    return fallback;
  }

  num(field: string, opts: { ge?: number; le?: number; default?: number } = {}): number {
    const raw = this.body[field];
    if (raw === undefined || raw === null) {
      if (opts.default !== undefined) return opts.default;
      this.fail(field, "Field required", "missing");
      return 0;
    }
    const v = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      this.fail(field, "Input should be a valid number", "float_type");
      return 0;
    }
    if (opts.ge !== undefined && v < opts.ge) this.fail(field, `Input should be greater than or equal to ${opts.ge}`, "greater_than_equal");
    if (opts.le !== undefined && v > opts.le) this.fail(field, `Input should be less than or equal to ${opts.le}`, "less_than_equal");
    return v;
  }

  strList(field: string): string[] {
    const v = this.body[field];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
      this.fail(field, "Input should be a valid list of strings", "list_type");
      return [];
    }
    return v as string[];
  }

  done(): void {
    if (this.errors.length) throw validationError(this.errors);
  }
}

/** Parse a JSON object body. ``optional``: a missing/empty body reads as {}. */
export async function jsonBody(req: Request, optional = false): Promise<Obj | null> {
  const text = await req.text();
  if (!text.trim()) {
    if (optional) return null;
    throw validationError([{ loc: ["body"], msg: "Field required", type: "missing" }]);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw validationError([{ loc: ["body", 0], msg: "JSON decode error", type: "json_invalid" }]);
  }
  if (data === null && optional) return null;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw validationError([{ loc: ["body"], msg: "Input should be a valid dictionary or object", type: "model_attributes_type" }]);
  }
  return data as Obj;
}

/** Integer query parameter with a default (FastAPI ``limit: int = 24``). */
export function intQuery(url: URL, name: string, fallback: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  if (!/^-?\d+$/.test(raw.trim())) {
    throw validationError([{ loc: ["query", name], msg: "Input should be a valid integer, unable to parse string as an integer", type: "int_parsing" }]);
  }
  return Number.parseInt(raw, 10);
}
