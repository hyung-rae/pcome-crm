import { Dashboard } from "@/components/dashboard/dashboard";
import { StaffManager } from "@/components/staff/staff-manager";
import { requirePage } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const { staff } = await requirePage(true);
  return (
    <Dashboard staff={staff} title="관리자 관리">
      <StaffManager />
    </Dashboard>
  );
}
