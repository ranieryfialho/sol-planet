import { alertasHandler } from "@/lib/api/handlers";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return alertasHandler(getDb(), req);
}
