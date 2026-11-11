# Journal REST API

All routes require an Auth.js session. Mutations also require a same-origin
`Origin` header. Responses use `Cache-Control: private, no-store`.

| Method | Route                            | Success                                               |
| ------ | -------------------------------- | ----------------------------------------------------- |
| GET    | `/api/journal?limit=20&cursor=…` | 200: `{ entries, pageInfo: { nextCursor, hasMore } }` |
| POST   | `/api/journal`                   | 201: `{ entry }`, with a `Location` header            |
| GET    | `/api/journal/:id`               | 200: `{ entry }`                                      |
| PATCH  | `/api/journal/:id`               | 200: `{ entry }`                                      |
| DELETE | `/api/journal/:id`               | 204, no body                                          |

POST requires `content` and `moodScore`. Optional fields include `title`,
`energyScore`, `sleepHours`, `exercised`, `socialScore`, and `tags`. PATCH validates
the same fields but preserves omitted values; nullable fields accept `null` to
clear them. Unknown fields, including `userId`, cannot change ownership. Validation
comes from `src/features/journal/schemas.ts`. Existing metadata fields and legacy
input aliases remain supported. DTOs include canonical fields with explicit nulls
for unknown optional metrics, plus legacy aliases for compatibility.

History is newest first, ordered by `createdAt DESC, id DESC`. The default page
size is 20 and the maximum is 100. Pass the returned opaque `nextCursor` unchanged
for the next page. A null cursor and `hasMore: false` mark the end. Cursors are
versioned and user-bound; malformed or foreign-user cursors return 400. They are
pagination positions, not authorization tokens: every query independently filters
by the authenticated owner. The seek query does not depend on the cursor entry
still existing. New entries created while paging appear on a fresh first page;
pagination is not a database snapshot.

Errors consistently use this shape, defined in
`src/features/journal/api-types.ts`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the journal fields.",
    "issues": [{ "path": "content", "message": "Write a note before saving." }]
  }
}
```

Codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_CURSOR` (400), and `INTERNAL_ERROR`
(500). Field issues appear on validation errors. Foreign-owned and missing entry
IDs both return 404; unexpected failures never return database details.

The reusable journal editor uses `/api/journal` for creation and editing. The
`/journal` history page requests 20 entries at a time through cursor pagination,
with explicit newer/older controls and loading, empty, and retry states. It never
uses the full-history session endpoint. View and edit links lead to protected
`/journal/:id` and `/journal/:id/edit` pages. The existing `/api/entries` API remains
compatible for legacy dashboard actions. Run `npm run test:journal` against the
local app to verify the API contract, and `npm run test:api` for legacy regressions.
