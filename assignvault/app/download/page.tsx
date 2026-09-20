"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { downloadFormSchema, DownloadFormData } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import {
  Download,
  Eye,
  CheckCircle2,
  User,
  Hash,
  Users,
  Calendar,
  Folder,
  Info,
  AlertTriangle,
  Flag,
} from "lucide-react";
import { CatalogSubject, CatalogBatch, CatalogAssignment } from "@/lib/data/catalog";

interface TemplateInfo {
  available: boolean;
  templateId?: string;
  requiresFolder: boolean;
  blockCount: number;
  warnings: string[];
}

function DownloadContent() {
  const searchParams = useSearchParams();
  const initialSubject = searchParams.get("subject") || "";
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Catalog data states
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [batches, setBatches] = useState<CatalogBatch[]>([]);
  const [assignments, setAssignments] = useState<CatalogAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  // Template capability info state
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [isLoadingTemplateInfo, setIsLoadingTemplateInfo] = useState(false);

  // Published batch date state (Step 8)
  const [batchDate, setBatchDate] = useState<{ date: string; display: string } | null>(null);
  const [isLoadingBatchDate, setIsLoadingBatchDate] = useState(false);

  // Post-download reporting state
  const [downloadedTemplateId, setDownloadedTemplateId] = useState<string | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isValid },
  } = useForm<DownloadFormData>({
    resolver: zodResolver(downloadFormSchema),
    mode: "onChange",
    defaultValues: {
      subject: initialSubject,
      assignmentNumber: "",
      batch: "",
      firstName: "",
      middleName: "",
      surname: "",
      rollNumber: "",
      folderName: "",
      customDate: "",
    },
  });

  const selectedSubjectSlug = useWatch({ control, name: "subject" });
  const selectedAssignmentNumber = useWatch({ control, name: "assignmentNumber" });
  const selectedBatch = useWatch({ control, name: "batch" });
  const formValues = useWatch({ control });

  // A custom date is required only when the batch has no published date.
  const customDateRequired = !batchDate;

  // 1. Fetch subjects and batches on mount
  useEffect(() => {
    let ignore = false;
    async function loadInitialCatalog() {
      try {
        const [subRes, batchRes] = await Promise.all([
          fetch("/api/catalog/subjects"),
          fetch("/api/catalog/batches"),
        ]);
        if (!ignore && subRes.ok) {
          const subData = await subRes.json();
          setSubjects(subData.subjects || []);
        }
        if (!ignore && batchRes.ok) {
          const batchData = await batchRes.json();
          setBatches(batchData.batches || []);
        }
      } catch (err) {
        console.error("Failed to load catalog:", err);
      }
    }
    loadInitialCatalog();
    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch assignments whenever subject changes
  useEffect(() => {
    let ignore = false;
    async function loadAssignments() {
      if (!selectedSubjectSlug) {
        setAssignments([]);
        return;
      }

      setIsLoadingAssignments(true);
      try {
        const res = await fetch(
          `/api/catalog/assignments?subject=${encodeURIComponent(selectedSubjectSlug)}&availableOnly=true`
        );
        if (!ignore && res.ok) {
          const data = await res.json();
          const loadedAssignments: CatalogAssignment[] = data.assignments || [];
          setAssignments(loadedAssignments);

          const currentVal = Number(formValues.assignmentNumber);
          const hasCurrent = loadedAssignments.some((a) => a.number === currentVal);
          if (!hasCurrent && loadedAssignments.length > 0) {
            setValue("assignmentNumber", String(loadedAssignments[0].number), {
              shouldValidate: true,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load assignments:", err);
      } finally {
        if (!ignore) {
          setIsLoadingAssignments(false);
        }
      }
    }

    loadAssignments();
    return () => {
      ignore = true;
    };
  }, [selectedSubjectSlug, setValue, formValues.assignmentNumber]);

  // 3. Fetch template info whenever subject and assignment are selected
  useEffect(() => {
    let ignore = false;
    async function checkTemplateInfo() {
      if (!selectedSubjectSlug || !selectedAssignmentNumber) {
        setTemplateInfo(null);
        return;
      }

      setIsLoadingTemplateInfo(true);
      try {
        const res = await fetch(
          `/api/template-info?subject=${encodeURIComponent(
            selectedSubjectSlug
          )}&assignment=${encodeURIComponent(selectedAssignmentNumber)}`
        );
        if (!ignore && res.ok) {
          const data = await res.json();
          setTemplateInfo(data);
        }
      } catch (err) {
        console.error("Failed to fetch template info:", err);
      } finally {
        if (!ignore) {
          setIsLoadingTemplateInfo(false);
        }
      }
    }

    checkTemplateInfo();
    return () => {
      ignore = true;
    };
  }, [selectedSubjectSlug, selectedAssignmentNumber]);

  // 3b. Fetch the published batch date once subject, assignment and batch are all chosen
  useEffect(() => {
    let ignore = false;
    async function loadBatchDate() {
      if (!selectedSubjectSlug || !selectedAssignmentNumber || !selectedBatch) {
        setBatchDate(null);
        return;
      }
      setIsLoadingBatchDate(true);
      try {
        const res = await fetch(
          `/api/batch-date?subject=${encodeURIComponent(
            selectedSubjectSlug
          )}&assignment=${encodeURIComponent(
            selectedAssignmentNumber
          )}&batch=${encodeURIComponent(selectedBatch)}`
        );
        if (!ignore && res.ok) {
          const data = await res.json();
          setBatchDate(data.date ? { date: data.date, display: data.display } : null);
        }
      } catch (err) {
        console.error("Failed to fetch batch date:", err);
      } finally {
        if (!ignore) setIsLoadingBatchDate(false);
      }
    }
    loadBatchDate();
    return () => {
      ignore = true;
    };
  }, [selectedSubjectSlug, selectedAssignmentNumber, selectedBatch]);

  const displayedAssignments = selectedSubjectSlug ? assignments : [];
  const selectedSubjectName =
    subjects.find((s) => s.slug === formValues.subject)?.name || "Not selected";

  // Build formatted student name in college order: Surname First Middle
  const collegeFormattedName = [
    formValues.surname?.trim(),
    formValues.firstName?.trim(),
    formValues.middleName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  // Handle form submission and document generation
  const onSubmit = async (data: DownloadFormData) => {
    // A submission date must exist: either a published batch date or a custom one.
    if (customDateRequired && !data.customDate) {
      const msg = "Your batch's date is not published yet. Please pick a custom date.";
      setDownloadError(msg);
      toast(msg, "error");
      return;
    }

    setIsSubmitting(true);
    setDownloadError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: data.subject,
          assignmentNumber: data.assignmentNumber,
          batch: data.batch,
          firstName: data.firstName || "",
          middleName: data.middleName || "",
          surname: data.surname || "",
          rollNumber: data.rollNumber,
          folderName: data.folderName || "assign",
          // Custom date overrides the stored batch date; empty lets the server use the batch date.
          customDate: data.customDate || "",
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error || "Failed to generate document. Please try again.";
        setDownloadError(errMsg);
        toast(errMsg, "error");
        return;
      }

      // Extract filename from header
      let filename = "assignment.docx";
      const disposition = response.headers.get("content-disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const templateId = response.headers.get("x-template-id") || templateInfo?.templateId || null;
      if (templateId) {
        setDownloadedTemplateId(templateId);
      }

      // Download file to user browser
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }, 2000);

      setHasDownloaded(true);
      toast(`Successfully downloaded ${filename}!`, "success");
    } catch (err) {
      console.error("Download error:", err);
      const msg = "Network error while generating document. Please check your connection.";
      setDownloadError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle post-download problem report
  const handleReportProblem = async () => {
    if (!downloadedTemplateId) return;
    setIsReporting(true);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: downloadedTemplateId,
          reason: reportReason.trim() || "Problem reported by downloader",
        }),
      });

      if (res.ok) {
        setReportSubmitted(true);
        toast("Thank you. Your report has been submitted to reviewers.", "success");
      } else {
        toast("Failed to submit report. Please try again later.", "error");
      }
    } catch {
      toast("Network error submitting report.", "error");
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Download Assignment"
        description="Select your subject, assignment, and practical batch. Enter your name, roll number, and date to download an approved assignment personalized for you."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form */}
        <div className="lg:col-span-7">
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {downloadError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{downloadError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject Select */}
                <Select
                  id="subject-select"
                  label="Subject"
                  required
                  placeholder="Select Subject"
                  error={errors.subject?.message}
                  {...register("subject")}
                >
                  <option value="" disabled>
                    Choose a subject
                  </option>
                  {subjects.map((sub) => (
                    <option key={sub.slug} value={sub.slug}>
                      {sub.name}
                    </option>
                  ))}
                </Select>

                {/* Assignment Number Select */}
                <Select
                  id="assignment-select"
                  label="Assignment Number"
                  required
                  disabled={!selectedSubjectSlug || displayedAssignments.length === 0 || isLoadingAssignments}
                  error={errors.assignmentNumber?.message}
                  helperText={
                    !selectedSubjectSlug
                      ? "Select a subject first"
                      : isLoadingAssignments
                      ? "Loading assignments..."
                      : `${displayedAssignments.length} assignments available`
                  }
                  {...register("assignmentNumber")}
                >
                  <option value="" disabled>
                    Choose assignment #
                  </option>
                  {displayedAssignments.map((item) => (
                    <option key={item.id || item.number} value={String(item.number)}>
                      Assignment {item.number}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Template Status Alerts */}
              {selectedSubjectSlug && selectedAssignmentNumber && !isLoadingTemplateInfo && (
                <>
                  {templateInfo && !templateInfo.available && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>
                        No file for this assignment yet.{" "}
                        <Link
                          href={`/upload?subject=${selectedSubjectSlug}&assignment=${selectedAssignmentNumber}`}
                          className="font-semibold underline hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          Be the first to upload it!
                        </Link>
                      </span>
                    </div>
                  )}

                  {templateInfo && templateInfo.available && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          Approved template ready ({templateInfo.blockCount} program block{templateInfo.blockCount > 1 ? "s" : ""})
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Batch Select */}
              <Select
                id="batch-select"
                label="Practical Batch"
                required
                error={errors.batch?.message}
                {...register("batch")}
              >
                <option value="" disabled>
                  Select your batch (e.g. P1, P2)
                </option>
                {batches.map((b) => (
                  <option key={b.id} value={b.name}>
                    Batch {b.name}
                  </option>
                ))}
              </Select>

              {/* Three-Part Student Name: First, Middle (Optional), Surname */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Student Name <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    id="firstName-input"
                    placeholder="First Name (e.g. Rahul)"
                    required
                    error={errors.firstName?.message}
                    {...register("firstName")}
                  />
                  <Input
                    id="middleName-input"
                    placeholder="Father/Middle (Optional)"
                    error={errors.middleName?.message}
                    {...register("middleName")}
                  />
                  <Input
                    id="surname-input"
                    placeholder="Surname (e.g. Sharma)"
                    required
                    error={errors.surname?.message}
                    {...register("surname")}
                  />
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Will be formatted in standard college order: <strong>Surname First Middle</strong>.
                </p>
              </div>

              {/* Student Roll Number & Submission Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="rollNumber-input"
                  label="Roll Number"
                  placeholder="e.g. 101 or 24BCS042"
                  required
                  error={errors.rollNumber?.message}
                  helperText="1 to 12 alphanumeric characters"
                  {...register("rollNumber")}
                />

                <Input
                  id="customDate-input"
                  type="date"
                  label={batchDate ? "Override Date (optional)" : "Submission Date"}
                  required={customDateRequired}
                  error={errors.customDate?.message}
                  helperText={
                    batchDate
                      ? `Leave empty to use your batch date (${batchDate.display})`
                      : "Your batch's date is not published yet. Pick a custom date."
                  }
                  {...register("customDate")}
                />
              </div>

              {/* Batch date status banner (Step 8) */}
              {selectedSubjectSlug && selectedAssignmentNumber && selectedBatch && !isLoadingBatchDate && (
                batchDate ? (
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span>
                      Date for your batch: <strong>{batchDate.display}</strong>. It will be filled
                      automatically unless you set an override date above.
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      Your batch&apos;s date is not published yet. Pick a custom date above or check
                      back later.
                    </span>
                  </div>
                )
              )}

              {/* Terminal Folder Name (Conditionally Shown Only When Template Requires It) */}
              {templateInfo?.requiresFolder && (
                <Input
                  id="folderName-input"
                  label="Terminal Folder Name"
                  placeholder="e.g. python-assign or 24BCS042"
                  required
                  error={errors.folderName?.message}
                  helperText="Required for this assignment (replaces execution paths in code output)"
                  {...register("folderName")}
                />
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full mt-2 gap-2"
                disabled={
                  !isValid ||
                  isSubmitting ||
                  (templateInfo ? !templateInfo.available : false) ||
                  (customDateRequired && !formValues.customDate)
                }
                isLoading={isSubmitting}
              >
                <Download className="w-5 h-5" />
                {isSubmitting ? "Generating Personalized Document..." : "Generate and Download"}
              </Button>
            </form>
          </Card>

          {/* Post-Download Problem Report Card */}
          {hasDownloaded && downloadedTemplateId && (
            <Card className="mt-4 border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                  <Flag className="w-4 h-4" />
                  <span>Report a problem with this file</span>
                </div>
                <CardDescription className="text-xs">
                  Did something not personal correctly or does the formatting look wrong? Let our review team know.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                {reportSubmitted ? (
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Report submitted. Our reviewers will inspect this template.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Describe what looks incorrect (e.g. wrong question, name not replaced in block 3...)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      rows={2}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReportProblem}
                      disabled={isReporting}
                      className="text-xs gap-1.5"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      {isReporting ? "Submitting Report..." : "Submit Report"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live "What will change in your file" Summary Card */}
        <div className="lg:col-span-5 sticky top-24">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-xs font-mono">
                <Eye className="w-4 h-4" />
                <span>live preview</span>
              </div>
              <CardTitle className="text-lg">What will change in your file</CardTitle>
              <CardDescription>
                Values that will replace the template placeholders in your downloaded .docx
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Name (College Order)</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {collegeFormattedName || <span className="text-zinc-400 italic">Enter first and surname</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Hash className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Roll Number</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {formValues.rollNumber || <span className="text-zinc-400 italic">Enter roll number</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Batch & Subject</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {formValues.batch ? `Batch ${formValues.batch}` : <span className="text-zinc-400 italic">No batch</span>}
                    {" • "}
                    <span className="text-blue-600 dark:text-blue-400">{selectedSubjectName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Submission Date</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {formValues.customDate ? (
                      <>
                        {formValues.customDate}{" "}
                        <span className="text-[11px] font-normal text-blue-500">(custom)</span>
                      </>
                    ) : batchDate ? (
                      <>
                        {batchDate.display}{" "}
                        <span className="text-[11px] font-normal text-sky-500">(batch)</span>
                      </>
                    ) : (
                      <span className="text-zinc-400 italic">Not published yet</span>
                    )}
                  </div>
                </div>
              </div>

              {templateInfo?.requiresFolder && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Terminal Folder</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate font-mono text-xs">
                      {formValues.folderName ? `...\\${formValues.folderName}` : <span className="text-zinc-400 italic font-sans">Enter folder name</span>}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Author and modifier metadata are completely scrubbed</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading form...</div>}>
      <DownloadContent />
    </Suspense>
  );
}
