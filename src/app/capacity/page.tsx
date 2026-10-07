import { getSettings } from "@/lib/service";
import CapacityEditor from "@/components/CapacityEditor";
export const dynamic = "force-dynamic";
export default async function CapacityPage() { return <CapacityEditor initial={await getSettings()} />; }
