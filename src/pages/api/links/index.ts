import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { CreateLinkSchema, ListLinksQuerySchema } from "@/lib/schemas/links";
import type { Link } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_error", issues: parsed.error.issues }, { status: 400 });
  }

  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("links")
    .insert({ user_id: context.locals.user.id, url: parsed.data.url })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
};

export const GET: APIRoute = async (context) => {
  const parsed = ListLinksQuerySchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "validation_error", issues: parsed.error.issues }, { status: 400 });
  }

  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  const baseQuery = supabase.from("links").select("*").order("created_at", { ascending: false });

  const { data, error } = await (parsed.data.in_library !== undefined
    ? baseQuery.eq("in_library", parsed.data.in_library)
    : baseQuery);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ links: data as Link[] });
};
