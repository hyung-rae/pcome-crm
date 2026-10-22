export type Staff = {
  id: string;
  name: string;
  role: "admin" | "sub_admin";
  is_active: boolean;
  is_instructor: boolean;
  must_change_password: boolean;
  credentials_reset_at: string | null;
  created_at: string;
  updated_at: string;
};
export type StaffRow = Staff & { email: string; upcoming_sessions: number | null };
