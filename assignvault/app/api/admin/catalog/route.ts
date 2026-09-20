import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { createServerClient } from "@/lib/supabase/server";
import {
  createSubject,
  updateSubject,
  deleteSubject,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  createBatch,
  updateBatch,
  deleteBatch,
} from "@/lib/admin/catalogAdmin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const slugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and dashes.");

const createSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("subject"),
    slug: slugSchema,
    name: z.string().min(1).max(120),
    sortOrder: z.number().int().optional(),
  }),
  z.object({
    resource: z.literal("assignment"),
    subjectId: z.string().uuid(),
    number: z.number().int().min(1).max(1000),
    title: z.string().max(200).nullable().optional(),
  }),
  z.object({
    resource: z.literal("batch"),
    name: z.string().min(1).max(60),
    sortOrder: z.number().int().optional(),
  }),
]);

const updateSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("subject"),
    id: z.string().uuid(),
    slug: slugSchema.optional(),
    name: z.string().min(1).max(120).optional(),
    sortOrder: z.number().int().optional(),
  }),
  z.object({
    resource: z.literal("assignment"),
    id: z.string().uuid(),
    number: z.number().int().min(1).max(1000).optional(),
    title: z.string().max(200).nullable().optional(),
  }),
  z.object({
    resource: z.literal("batch"),
    id: z.string().uuid(),
    name: z.string().min(1).max(60).optional(),
    sortOrder: z.number().int().optional(),
  }),
]);

const deleteSchema = z.object({
  resource: z.enum(["subject", "assignment", "batch"]),
  id: z.string().uuid(),
  force: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server database configuration is missing" }, { status: 500 });
  }

  const data = parsed.data;
  let result;
  if (data.resource === "subject") {
    result = await createSubject(supabase, { slug: data.slug, name: data.name, sortOrder: data.sortOrder });
  } else if (data.resource === "assignment") {
    result = await createAssignment(supabase, {
      subjectId: data.subjectId,
      number: data.number,
      title: data.title ?? null,
    });
  } else {
    result = await createBatch(supabase, { name: data.name, sortOrder: data.sortOrder });
  }

  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: `catalog_create_${data.resource}`,
    details: { ...data },
  } as never);

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server database configuration is missing" }, { status: 500 });
  }

  const data = parsed.data;
  let result;
  if (data.resource === "subject") {
    result = await updateSubject(supabase, data.id, {
      slug: data.slug,
      name: data.name,
      sortOrder: data.sortOrder,
    });
  } else if (data.resource === "assignment") {
    result = await updateAssignment(supabase, data.id, { number: data.number, title: data.title });
  } else {
    result = await updateBatch(supabase, data.id, { name: data.name, sortOrder: data.sortOrder });
  }

  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: `catalog_update_${data.resource}`,
    details: { ...data },
  } as never);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server database configuration is missing" }, { status: 500 });
  }

  const { resource, id, force } = parsed.data;
  let result;
  if (resource === "subject") result = await deleteSubject(supabase, id, force);
  else if (resource === "assignment") result = await deleteAssignment(supabase, id, force);
  else result = await deleteBatch(supabase, id, force);

  if (result.error) {
    // A blocked safe-delete is a 409 (needs force), other failures 400.
    const status = result.error.includes("Confirm to delete") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: `catalog_delete_${resource}`,
    details: { id, force: !!force },
  } as never);

  return NextResponse.json({ ok: true });
}
