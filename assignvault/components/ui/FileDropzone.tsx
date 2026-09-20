"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  error?: string;
  accept?: string;
  maxSizeMB?: number;
}

export function FileDropzone({
  onFileSelect,
  selectedFile,
  error,
  accept = ".docx,.pdf",
  maxSizeMB = 10,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSet(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSet(file);
    }
  };

  const validateAndSet = (file: File) => {
    onFileSelect(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Assignment File (.docx or .pdf) <span className="text-red-500">*</span>
      </label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center select-none min-h-[140px]",
          isDragOver
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            : error
              ? "border-red-500 bg-red-50/30 dark:bg-red-950/10"
              : "border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />

        {selectedFile ? (
          <div className="flex items-center gap-3 w-full max-w-md bg-white dark:bg-zinc-800 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              aria-label="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="text-sm">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Click to upload
              </span>{" "}
              or drag and drop
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Word (.docx) or PDF (.pdf) up to {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5 mt-1">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
