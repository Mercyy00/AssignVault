"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { uploadFormSchema, UploadFormData } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Upload, Info, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { CatalogSubject, CatalogBatch, CatalogAssignment } from "@/lib/data/catalog";

interface SubmissionResponse {
  submissionId: string;
  status: string;
  format: "docx" | "pdf";
  message: string;
}

export default function UploadPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Live catalog states loaded from API
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [batches, setBatches] = useState<CatalogBatch[]>([]);
  const [assignments, setAssignments] = useState<CatalogAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    mode: "onChange",
    defaultValues: {
      subject: "",
      assignmentNumber: "",
      batch: "",
      fullName: "",
      rollNumber: "",
      folderName: "",
      fileDate: "",
      terminalOutput: "",
      website: "", // honeypot
    },
  });

  const selectedSubjectSlug = useWatch({ control, name: "subject" });
  const selectedFile = useWatch({ control, name: "file" });
  const isPdfFile = selectedFile?.name?.toLowerCase().endsWith(".pdf");

  // 1. Fetch subjects and batches on mount
  useEffect(() => {
    let ignore = false;
    async function loadCatalog() {
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
    loadCatalog();
    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch assignments whenever subject changes
  useEffect(() => {
    if (!selectedSubjectSlug) return;

    let ignore = false;
    async function loadAssignments() {
      setIsLoadingAssignments(true);
      try {
        const res = await fetch(`/api/catalog/assignments?subject=${encodeURIComponent(selectedSubjectSlug)}`);
        if (!ignore && res.ok) {
          const data = await res.json();
          const loadedAssignments: CatalogAssignment[] = data.assignments || [];
          setAssignments(loadedAssignments);
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
  }, [selectedSubjectSlug]);

  const displayedAssignments = selectedSubjectSlug ? assignments : [];

  const onSubmit = async (data: UploadFormData) => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      const formData = new FormData();
      formData.append("subject", data.subject);
      formData.append("assignmentNumber", data.assignmentNumber);
      formData.append("batch", data.batch);
      formData.append("fullName", data.fullName);
      formData.append("rollNumber", data.rollNumber);
      formData.append("folderName", data.folderName);
      formData.append("fileDate", data.fileDate);
      if (data.terminalOutput) {
        formData.append("terminalOutput", data.terminalOutput);
      }
      if (data.website) {
        formData.append("website", data.website);
      }
      formData.append("file", data.file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const resData = await response.json();

      if (!response.ok) {
        const message = resData.error || "Upload failed. Please check your submission.";
        setServerError(message);
        toast(message, "error");
        return;
      }

      setSubmissionResult({
        submissionId: resData.submissionId || "sub-pending",
        status: resData.status || "received",
        format: resData.format || "docx",
        message: resData.message || "File uploaded successfully!",
      });

      toast(resData.message || "Assignment uploaded successfully!", "success");
    } catch (err) {
      console.error("Upload error:", err);
      const msg = "Network error while uploading. Please check your connection and try again.";
      setServerError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    setSubmissionResult(null);
    setServerError(null);
  };

  if (submissionResult) {
    const isPdf = submissionResult.format === "pdf";

    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center p-8 sm:p-12 border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Submission Received!
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-4 text-base leading-relaxed">
            {isPdf
              ? "PDF converted to Word format and submitted for review."
              : "Thanks! Your file is in the review queue."}
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-mono mb-8 border border-zinc-200 dark:border-zinc-700">
            <FileText className="w-3.5 h-3.5" />
            <span>ID: {submissionResult.submissionId}</span>
          </div>

          <div>
            <Button onClick={handleReset} variant="outline">
              Upload Another Assignment
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="Upload Assignment"
        description="Share your completed assignment to help your batch. Provide the exact details you used in your document so our system can detect and templatize them accurately."
      />

      {serverError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-300 flex items-start gap-3 animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{serverError}</div>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* Honeypot field (hidden from human visitors) */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Leave this field blank</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...register("website")}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
                1
              </span>
              Assignment Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Subject Select */}
              <Select
                id="upload-subject"
                label="Subject"
                required
                error={errors.subject?.message}
                {...register("subject")}
              >
                <option value="" disabled>
                  Select Subject
                </option>
                {subjects.map((sub) => (
                  <option key={sub.slug} value={sub.slug}>
                    {sub.name}
                  </option>
                ))}
              </Select>

              {/* Dynamic Assignment Number Select */}
              <Select
                id="upload-assignment"
                label="Assignment Number"
                required
                disabled={!selectedSubjectSlug || displayedAssignments.length === 0 || isLoadingAssignments}
                error={errors.assignmentNumber?.message}
                helperText={
                  !selectedSubjectSlug
                    ? "Select a subject first"
                    : isLoadingAssignments
                    ? "Loading assignments..."
                    : undefined
                }
                {...register("assignmentNumber")}
              >
                <option value="" disabled>
                  Select Assignment #
                </option>
                {displayedAssignments.map((item) => (
                  <option key={item.id || item.number} value={String(item.number)}>
                    Assignment {item.number}
                  </option>
                ))}
              </Select>
            </div>

            {/* Practical Batch */}
            <Select
              id="upload-batch"
              label="Practical Batch"
              required
              error={errors.batch?.message}
              {...register("batch")}
            >
              <option value="" disabled>
                Select your practical batch
              </option>
              {batches.map((b) => (
                <option key={b.id} value={b.name}>
                  Batch {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
                2
              </span>
              Your Details (As They Appear In The File)
            </h3>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Enter the exact personal details you typed into this assignment. AssignVault searches
                for these tokens to replace them with placeholders.
              </span>
            </div>

            {/* Full Name */}
            <Input
              id="upload-fullName"
              label="Full Name in File"
              placeholder="e.g. Jayesh Prashant Ghagare"
              required
              error={errors.fullName?.message}
              helperText="At least 2 words (matches all case and surname order variations)"
              {...register("fullName")}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Roll Number */}
              <Input
                id="upload-rollNumber"
                label="Roll Number in File"
                placeholder="e.g. 24BCS042"
                required
                error={errors.rollNumber?.message}
                helperText="1 to 12 alphanumeric characters"
                {...register("rollNumber")}
              />

              {/* Terminal Folder Name */}
              <Input
                id="upload-folderName"
                label="Terminal Folder Name"
                placeholder="e.g. jayesh"
                required
                error={errors.folderName?.message}
                helperText="The user/project folder in your terminal output"
                {...register("folderName")}
              />
            </div>

            {/* Date used in file */}
            <Input
              id="upload-fileDate"
              type="date"
              label="Date Used in Document"
              required
              error={errors.fileDate?.message}
              helperText="The submission date written inside your assignment"
              {...register("fileDate")}
            />
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
                3
              </span>
              File &amp; Terminal Output
            </h3>

            {/* File Dropzone */}
            <Controller
              control={control}
              name="file"
              render={({ field: { onChange, value } }) => (
                <FileDropzone
                  onFileSelect={(file) => onChange(file)}
                  selectedFile={value}
                  error={errors.file?.message}
                />
              )}
            />

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
              <span>
                <strong>Tip:</strong> Uploading the original <code>.docx</code> file provides the fastest processing and preserves layout fidelity. PDFs are automatically converted to Word format before review.
              </span>
            </div>

            {/* Terminal Output Textarea */}
            <Textarea
              id="upload-terminalOutput"
              label="Paste Terminal Output (Optional)"
              placeholder="C:\Users\jayesh\Desktop\python-assign> python main.py&#10;Program output line 1...&#10;Program output line 2..."
              rows={4}
              error={errors.terminalOutput?.message}
              helperText="Paste the raw text of the program execution output shown in your screenshots. This helps regenerate sharp terminal output with the downloader's folder name in Step 7."
              {...register("terminalOutput")}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={!isValid || isSubmitting}
              isLoading={isSubmitting}
            >
              <Upload className="w-5 h-5" />
              {isSubmitting
                ? isPdfFile
                  ? "Converting PDF & Submitting..."
                  : "Uploading Assignment..."
                : "Submit Assignment for Review"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
