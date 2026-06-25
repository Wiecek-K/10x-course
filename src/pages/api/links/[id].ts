import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { UpdateLinkSchema } from "@/lib/schemas/links";
import type { Database } from "@/db/database.types";
export const prerender = false;

const IdParam = z.uuid();

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const idResult = IdParam.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "validation_error", issues: idResult.error.issues }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_error", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const { visited, ...fields } = parsed.data;
  const updatePayload: Database["public"]["Tables"]["links"]["Update"] = { ...fields };
  if (visited) {
    updatePayload.last_visited = new Date().toISOString();
  }

  const { data, error } = await supabase.from("links").update(updatePayload).eq("id", idResult.data).select().single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    // eslint-disable-next-line no-console -- server-side error logging for Workers observability
    console.error("PATCH /api/links/[id] failed:", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return Response.json(data);
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const idResult = IdParam.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "validation_error", issues: idResult.error.issues }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const { error } = await supabase.from("links").delete().eq("id", idResult.data).select("id").single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    // eslint-disable-next-line no-console -- server-side error logging for Workers observability
    console.error("DELETE /api/links/[id] failed:", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
};
