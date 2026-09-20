export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SourceFormat = "docx" | "pdf";
export type SubmissionStatus =
  | "received"
  | "awaiting_conversion"
  | "converted"
  | "templated"
  | "failed";
export type TemplateStatus = "pending" | "approved" | "rejected";

export type Database = {
  public: {
    Tables: {
      subjects: {
        Row: {
          id: string;
          slug: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      batches: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          subject_id: string;
          number: number;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          number: number;
          title?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          number?: number;
          title?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      batch_dates: {
        Row: {
          id: string;
          batch_id: string;
          assignment_id: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          assignment_id: string;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string;
          assignment_id?: string;
          date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          assignment_id: string;
          batch_id: string;
          uploader_name: string;
          uploader_roll: string;
          uploader_folder: string;
          uploader_date: string;
          terminal_output_text: string | null;
          raw_file_path: string | null;
          converted_docx_path: string | null;
          source_format: SourceFormat;
          status: SubmissionStatus;
          error_message: string | null;
          ip_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          batch_id: string;
          uploader_name: string;
          uploader_roll: string;
          uploader_folder: string;
          uploader_date: string;
          terminal_output_text?: string | null;
          raw_file_path: string;
          converted_docx_path?: string | null;
          source_format: SourceFormat;
          status?: SubmissionStatus;
          error_message?: string | null;
          ip_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          batch_id?: string;
          uploader_name?: string;
          uploader_roll?: string;
          uploader_folder?: string;
          uploader_date?: string;
          terminal_output_text?: string | null;
          raw_file_path?: string;
          converted_docx_path?: string | null;
          source_format?: SourceFormat;
          status?: SubmissionStatus;
          error_message?: string | null;
          ip_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          submission_id: string;
          assignment_id: string;
          batch_id: string;
          file_path: string | null;
          status: TemplateStatus;
          placeholder_counts: Json;
          warnings: Json;
          output_images: Json;
          needs_review: boolean;
          converted_from_pdf: boolean;
          report_count: number;
          rejected_reason: string | null;
          approved_at: string | null;
          pinned: boolean;
          requires_folder: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          assignment_id: string;
          batch_id: string;
          file_path?: string | null;
          status?: TemplateStatus;
          placeholder_counts?: Json;
          warnings?: Json;
          output_images?: Json;
          needs_review?: boolean;
          converted_from_pdf?: boolean;
          report_count?: number;
          rejected_reason?: string | null;
          approved_at?: string | null;
          pinned?: boolean;
          requires_folder?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          assignment_id?: string;
          batch_id?: string;
          file_path?: string | null;
          status?: TemplateStatus;
          placeholder_counts?: Json;
          warnings?: Json;
          output_images?: Json;
          needs_review?: boolean;
          converted_from_pdf?: boolean;
          report_count?: number;
          rejected_reason?: string | null;
          approved_at?: string | null;
          pinned?: boolean;
          requires_folder?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      downloads_log: {
        Row: {
          id: string;
          template_id: string;
          batch_id: string;
          downloader_roll: string;
          ip_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          batch_id: string;
          downloader_roll: string;
          ip_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          batch_id?: string;
          downloader_roll?: string;
          ip_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor: string | null;
          action: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor?: string | null;
          action: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor?: string | null;
          action?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
