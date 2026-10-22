import { Dashboard } from "@/components/dashboard/dashboard";
import { ClassSchedule } from "@/components/classes/class-schedule";
import { requirePage } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function ClassesPage() {
  const { staff } = await requirePage();
  return (
    <Dashboard staff={staff} title="수업 시간표" description="그룹수업 종류와 주간 시간표를 관리하세요.">
      <ClassSchedule />
    </Dashboard>
  );
}
