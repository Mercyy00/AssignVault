export interface Subject {
  id: string;
  slug: string;
  name: string;
  description: string;
  badge: string;
  color: string;
  assignments: number[];
}

export interface Batch {
  id: string;
  name: string;
}

export type Theme = "light" | "dark" | "system";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}
