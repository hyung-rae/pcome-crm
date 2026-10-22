import { Dashboard } from "@/components/dashboard/dashboard";
import { StaffManager } from "@/components/staff/staff-manager";
import { requirePage } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const { staff } = await requirePage(true);
  return (
    <Dashboard staff={staff} title="관리자 관리" description="직원 계정과 접근 권한을 관리하세요.">
      <StaffManager />
    </Dashboard>
  );
}
