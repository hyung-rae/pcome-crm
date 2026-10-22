import type { ClassColor } from "./palette";

export type ClassType = {
  id: string;
  name: string;
  default_capacity: number;
  default_duration_minutes: number;
  color: ClassColor;
  is_active: boolean;
};
export type Instructor = { id: string; name: string };
export type ClassSession = {
  id: string;
  series_id: string | null;
  occurrence_date: string | null;
  class_type_id: string;
  type_name: string;
  color: ClassColor;
  instructor_id: string | null;
  instructor_name: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: "scheduled" | "cancelled";
  is_modified: boolean;
  is_past: boolean;
  series: {
    weekdays: number[];
    start_date: string;
    end_date: string | null;
    start_time: string;
    duration_minutes: number;
    capacity: number;
    instructor_id: string | null;
    class_type_id: string;
  } | null;
};
export type ClassConflict = {
  id: string;
  starts_at: string;
  ends_at: string;
  class_name: string;
};
