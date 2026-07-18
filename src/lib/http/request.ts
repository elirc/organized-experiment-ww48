import { z } from "zod";

/**
 * This file owns route-level request parsing so handlers stay thin and explicit.
 * What calls it: App Router API route files.
 * What it calls: Zod schemas supplied by validation modules.
 * A junior engineer would likely get this wrong by trusting request.json()
 * blindly and skipping normalization of query params.
 */
export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const body = await request.json();
  return schema.parse(body);
}

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const searchParams = new URL(url).searchParams;
  const rawObject = Object.fromEntries(searchParams.entries());
  return Promise.resolve(schema.parse(rawObject));
}

