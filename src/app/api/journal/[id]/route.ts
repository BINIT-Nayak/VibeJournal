import { observeRoute } from "@/server/observability/request";
import {
  GET as handleGET,
  PATCH as handlePATCH,
  DELETE as handleDELETE,
} from "@/server/journal/routes/journal/[id]/route";

export const GET = observeRoute("/api/journal/[id]", handleGET);
export const PATCH = observeRoute("/api/journal/[id]", handlePATCH);
export const DELETE = observeRoute("/api/journal/[id]", handleDELETE);
