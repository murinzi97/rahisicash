export type Role = "agent" | "admin";
export type AgentStatus = "pending" | "active" | "suspended" | "rejected";
export type Lang = "en" | "fr";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  status: AgentStatus;
  language: Lang;
  id_type: "national_id" | "passport" | null;
  avatar_path: string | null; // the verified selfie: the profile picture everywhere
}
