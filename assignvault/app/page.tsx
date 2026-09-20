import Link from "next/link";
import { Download, Upload, ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MOCK_SUBJECTS } from "@/mocks/catalog";

export default function HomePage() {
  const steps = [
    {
      k: "01",
      title: "Someone uploads a finished assignment",
      body: "They submit the .docx or PDF and enter the exact name, roll number and folder used inside it.",
    },
    {
      k: "02",
      title: "AssignVault scrubs the author out",
      body: "Every name, roll number and folder path is detected and swapped for a neutral placeholder. No trace of who wrote it.",
    },
    {
      k: "03",
      title: "You download it as your own",
      body: "Pick the subject, assignment and batch, enter your details, and get a clean personalized copy in seconds.",
    },
  ];

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* Hero: asymmetric split, type-forward, no eyebrow pill */}
      <section className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center pt-2 sm:pt-6">
        <div className="lg:col-span-7 space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] text-zinc-950 dark:text-white">
            Stop rewriting the same
            <br className="hidden sm:block" /> assignment by hand.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
            One person uploads a finished practical. Everyone else in the batch downloads it
            personalized with their own name and roll number, with no sign the file came from
            someone else.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link href="/download" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                <Download className="w-5 h-5" />
                Download an assignment
              </Button>
            </Link>
            <Link href="/upload" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                <Upload className="w-5 h-5" />
                Share yours
              </Button>
            </Link>
          </div>
        </div>

        {/* Honest product illustration: the core placeholder transform */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 font-mono text-sm shadow-sm">
            <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              what the engine does
            </div>
            <div className="space-y-3">
              <TransformRow token="{{NAME}}" value="Priya Verma" />
              <TransformRow token="{{ROLL}}" value="22IT099" />
              <TransformRow token="{{BATCH}}" value="P1" />
              <TransformRow token="{{DATE}}" value="14/09/2026" />
            </div>
            <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              The uploader&apos;s identity never appears in your copy.
            </div>
          </div>
        </div>
      </section>

      {/* Subjects: clean divided grid, no gradient-chip cards */}
      <section className="space-y-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Practical subjects
          </h2>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
            {MOCK_SUBJECTS.length} courses
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
          {MOCK_SUBJECTS.map((subject) => (
            <Link
              key={subject.id}
              href={`/download?subject=${subject.slug}`}
              className="group bg-white dark:bg-zinc-950 p-6 flex flex-col gap-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                  {subject.badge}
                </span>
                <ArrowUpRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 transition-all group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">
                {subject.name}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {subject.description}
              </p>
              <span className="mt-auto pt-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                {subject.assignments.length} assignments
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works: numbered flow, no cards, hairline rhythm */}
      <section className="space-y-10">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white max-w-lg">
          How it works
        </h2>

        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step) => (
            <div key={step.k} className="space-y-3">
              <div className="font-mono text-sm text-blue-600 dark:text-blue-400">{step.k}</div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                {step.title}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 pt-4">
            Have a finished assignment your batch could use?
          </p>
          <Link
            href="/upload"
            className="sm:pt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:gap-2.5 transition-all"
          >
            Share it <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function TransformRow({ token, value }: { token: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 dark:text-zinc-500 w-[92px] shrink-0">{token}</span>
      <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
      <span className="text-zinc-950 dark:text-white font-medium">{value}</span>
    </div>
  );
}
