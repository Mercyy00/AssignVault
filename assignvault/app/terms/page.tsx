import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { AlertCircle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="Terms of Use &amp; Academic Integrity"
        description="Guidelines and ethical responsibilities when using the AssignVault platform."
      />

      <Card className="space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Academic Integrity Notice</h3>
            <p>
              AssignVault is provided as an educational aid and reference repository. You are
              expected to understand and solve your own practical code. Always follow your
              institution&apos;s academic code of conduct.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            1. Upload Guidelines
          </h2>
          <p>
            When uploading assignments, only submit files that you have completed or have permission
            to share. Do not upload malicious files, copyrighted textbooks, or confidential
            examination material.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            2. Personal Data &amp; Templating
          </h2>
          <p>
            By uploading a file, you consent to our automated templating engine scanning and
            replacing your personal identifying tokens (full name, roll number, folder path,
            submission date) with generic placeholder markers.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">3. Disclaimers</h2>
          <p>
            Templates and generated assignments are provided &ldquo;as is&rdquo;. Users must review
            the generated documents prior to official academic submission.
          </p>
        </div>
      </Card>
    </div>
  );
}
