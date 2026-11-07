import { resumoHandler } from "@/lib/api/handlers";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return resumoHandler(getDb(), req, (await ctx.params).id);
}
