import { observeRoute } from "@/server/observability/request";
import { POST as handlePOST } from "@/server/auth/routes/logout/route";

export const POST = observeRoute("/api/auth/logout", handlePOST);
