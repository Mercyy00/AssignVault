import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CatalogManager, type CatalogData } from "@/components/admin/CatalogManager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = createServerClient();
  if (!supabase) {
    return <EmptyState title="Database not configured" description="Supabase env vars are missing." />;
  }

  const [subjectsRes, batchesRes, assignmentsRes] = await Promise.all([
    supabase.from("subjects").select("id, slug, name, sort_order").order("sort_order"),
    supabase.from("batches").select("id, name, sort_order").order("sort_order"),
    supabase.from("assignments").select("id, subject_id, number, title").order("number"),
  ]);

  const data: CatalogData = {
    subjects: (subjectsRes.data || []) as CatalogData["subjects"],
    batches: (batchesRes.data || []) as CatalogData["batches"],
    assignments: (assignmentsRes.data || []) as CatalogData["assignments"],
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catalog"
        description="Manage subjects, assignments and batches. Deletes are blocked when templates exist unless you confirm."
        backHref="/admin"
        backLabel="Dashboard"
      />
      <CatalogManager data={data} />
    </div>
  );
}
