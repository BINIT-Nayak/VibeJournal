import type { MoodEntry } from "./mood";

export type JournalEntryDto = Omit<MoodEntry, "sleepHours"> & {
  updatedAt: string;
  title: string | null;
  content: string;
  moodScore: number;
  energyScore: number | null;
  sleepHours: number | null;
  exercised: boolean | null;
  socialScore: number | null;
};

export type JournalApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "INVALID_CURSOR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";
export type JournalApiError = {
  error: {
    code: JournalApiErrorCode;
    message: string;
    issues?: Array<{ path: string; message: string }>;
  };
};
export type JournalEntryResponse = { entry: JournalEntryDto };
export type JournalHistoryResponse = {
  entries: JournalEntryDto[];
  pageInfo: { nextCursor: string | null; hasMore: boolean };
};
