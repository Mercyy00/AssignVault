import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { BookOpen, ShieldCheck, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="About AssignVault"
        description="A student-driven platform designed to simplify practical assignment management for 3rd-year BCS students."
      />

      <Card className="space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Project Purpose
          </h2>
          <p>
            AssignVault was created to help BCS (Bachelor of Computer Science) students streamline
            their practical coursework across four key subjects:{" "}
            <strong>C#, Core Java, Basic Python, and React JS</strong>.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            How It Helps
          </h2>
          <p>
            Rather than manually altering names, roll numbers, dates, and terminal output paths in
            shared assignment files, AssignVault uses an automated templating engine to detect and
            personalize all occurrences safely and accurately.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Privacy &amp; Safety
          </h2>
          <p>
            When an assignment is submitted, author metadata (such as creator name, revision
            history, and personal directory paths) is scrubbed. Raw files are stored securely and
            never made publicly accessible.
          </p>
        </div>
      </Card>
    </div>
  );
}
