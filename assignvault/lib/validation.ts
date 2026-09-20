import { z } from "zod";

/**
 * Constant regex for roll number format.
 * Change this constant when the college's roll number format changes.
 */
export const ROLL_NUMBER_REGEX = /^[a-zA-Z0-9]{1,12}$/;

/**
 * Regex for characters allowed in student names:
 * letters (upper & lower), spaces, dots, hyphens.
 */
export const NAME_CHARS_REGEX = /^[a-zA-Z\s.-]+$/;

/**
 * Illegal filename characters: slashes, colons, asterisks, question marks, quotes, brackets, pipes.
 */
export const ILLEGAL_FOLDER_CHARS_REGEX = /[\\/:*?"<>|]/;

export const fullNameSchema = z
  .string()
  .min(3, "Full name must be at least 3 characters")
  .max(60, "Full name must not exceed 60 characters")
  .regex(NAME_CHARS_REGEX, "Name can only contain English letters, spaces, dots, and hyphens")
  .refine(
    (val) => val.trim().split(/\s+/).filter(Boolean).length >= 2,
    "Please enter your full name with at least 2 words (e.g., First Last)"
  );

export const rollNumberSchema = z
  .string()
  .min(1, "Roll number is required")
  .max(12, "Roll number cannot exceed 12 characters")
  .regex(ROLL_NUMBER_REGEX, "Roll number must be alphanumeric and 1 to 12 characters");

export const folderNameSchema = z
  .string()
  .min(1, "Folder name is required")
  .max(32, "Folder name cannot exceed 32 characters")
  .refine(
    (val) => !ILLEGAL_FOLDER_CHARS_REGEX.test(val),
    'Folder name cannot contain slashes (/ or \\), colons (:), or illegal characters (* ? " < > |)'
  )
  .refine((val) => val.trim().length > 0, "Folder name cannot be empty spaces");

export const firstNameSchema = z
  .string()
  .min(1, "First name is required")
  .max(30, "First name cannot exceed 30 characters")
  .regex(NAME_CHARS_REGEX, "Name can only contain English letters, spaces, dots, and hyphens");

export const middleNameSchema = z
  .string()
  .max(30, "Middle name cannot exceed 30 characters")
  .regex(NAME_CHARS_REGEX, "Name can only contain English letters, spaces, dots, and hyphens")
  .optional()
  .or(z.literal(""));

export const surnameSchema = z
  .string()
  .min(1, "Surname is required")
  .max(30, "Surname cannot exceed 30 characters")
  .regex(NAME_CHARS_REGEX, "Name can only contain English letters, spaces, dots, and hyphens");

export const downloadFormSchema = z
  .object({
    subject: z.string().min(1, "Please select a subject"),
    assignmentNumber: z.string().min(1, "Please select an assignment number"),
    batch: z.string().min(1, "Please select your batch"),
    firstName: z.string().max(30).optional().or(z.literal("")),
    middleName: z.string().max(30).optional().or(z.literal("")),
    surname: z.string().max(30).optional().or(z.literal("")),
    fullName: fullNameSchema.optional().or(z.literal("")),
    rollNumber: rollNumberSchema,
    folderName: z.string().max(32).optional().or(z.literal("")),
    customDate: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => Boolean((data.firstName && data.surname) || data.fullName),
    {
      message: "Please enter your first name and surname",
      path: ["firstName"],
    }
  );

export type DownloadFormData = z.infer<typeof downloadFormSchema>;

export const uploadFormSchema = z.object({
  subject: z.string().min(1, "Please select a subject"),
  assignmentNumber: z.string().min(1, "Please select an assignment number"),
  batch: z.string().min(1, "Please select your batch"),
  fullName: fullNameSchema,
  rollNumber: rollNumberSchema,
  folderName: folderNameSchema,
  fileDate: z.string().min(1, "Please select the date used in your file"),
  terminalOutput: z
    .string()
    .max(10000, "Terminal output cannot exceed 10,000 characters")
    .optional(),
  file: z
    .custom<File>((val) => val instanceof File, "Please upload a file")
    .refine((file) => file && file.size <= 10 * 1024 * 1024, "File size must be under 10 MB")
    .refine((file) => {
      if (!file) return false;
      const ext = file.name.split(".").pop()?.toLowerCase();
      return ext === "docx" || ext === "pdf";
    }, "Only .docx and .pdf files are accepted"),
  // Honeypot field (must remain empty)
  website: z.string().optional(),
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
