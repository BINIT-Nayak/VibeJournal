import { observeRoute } from "@/server/observability/request";
import { GET as handleGET, POST as handlePOST } from "@/server/journal/routes/journal/route";

export const GET = observeRoute("/api/journal", handleGET);
export const POST = observeRoute("/api/journal", handlePOST);
