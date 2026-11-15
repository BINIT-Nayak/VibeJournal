import { observeRoute } from "@/server/observability/request";
import { POST as handlePOST } from "@/server/auth/routes/password-reset/request/route";

export const POST = observeRoute("/api/auth/password-reset/request", handlePOST);
