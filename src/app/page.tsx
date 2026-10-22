import { Dashboard } from "@/components/dashboard/dashboard";
import { requirePage } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { staff } = await requirePage();
  return <Dashboard staff={staff} />;
}
