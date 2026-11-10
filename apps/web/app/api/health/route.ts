import { handleHealth } from "@sol/observability/health";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleHealth(getDb);
}
