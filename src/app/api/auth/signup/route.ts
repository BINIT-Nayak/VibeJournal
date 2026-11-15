import { observeRoute } from "@/server/observability/request";
import { POST as handlePOST } from "@/server/auth/routes/signup/route";

export const POST = observeRoute("/api/auth/signup", handlePOST);
