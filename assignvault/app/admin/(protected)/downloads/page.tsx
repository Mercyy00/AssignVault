import { getSubjects, getBatches } from "@/lib/data/catalog";
import { createServerClient } from "@/lib/supabase/server";
import { listDownloads } from "@/lib/admin/reportsDownloads";
import { PageHeader } from "@/components/ui/PageHeader";
import { DownloadsExplorer } from "@/components/admin/DownloadsExplorer";

export const dynamic = "force-dynamic";

export default async function DownloadsPage() {
  const supabase = createServerClient();
  const [subjects, batches, initialRows] = await Promise.all([
    getSubjects(),
    getBatches(),
    supabase ? listDownloads(supabase, { limit: 500 }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Downloads log"
        description="Every personalized download. Roll numbers are personal data — visible to admins only."
        backHref="/admin"
        backLabel="Dashboard"
      />
      <DownloadsExplorer
        subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))}
        batches={batches.map((b) => b.name)}
        initialRows={initialRows}
      />
    </div>
  );
}
