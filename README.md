# To-Do List — Laravel API + Nuxt SPA

A small task manager built on a decoupled SPA/API stack.

- **Backend** — Laravel 12 REST API (PHP 8.2+): Eloquent, migrations, seeders, Form Request validation, policies, Sanctum token auth, PHPUnit unit + feature tests, OpenAPI docs.
- **Frontend** — Nuxt 3 SPA (Vue 3, Composition API): Pinia stores, route middleware, an API plugin/composable, client-side validation, Vitest tests.
- **Database** — SQLite by default; MySQL/PostgreSQL work by changing `.env`.

```
.
├── backend/            # Laravel 12 API
├── frontend/           # Nuxt 3 SPA
├── docker-compose.yml  # one-command run
└── README.md
```

### Why Laravel 12

Laravel 12 is the newest stable release that supports PHP 8.2, which is what this project targets (`php -v` → 8.2). Laravel 13 requires PHP 8.3+, so 12 is the correct current choice here. Nuxt is pinned to 3.20.2 — the app is an SPA (`ssr: false`), and 3.21 has a regression that breaks the dev server in that mode.

---

## Auth approach — Sanctum bearer tokens (stateless)

I went with **Laravel Sanctum in API-token mode** rather than its cookie/session (SPA) mode.

**Why:** the Nuxt app runs on a different origin (`:3000`) from the API (`:8000`). Cookie-based Sanctum needs same-site cookies, a CSRF round trip, and matching `stateful_domains` / `SESSION_DOMAIN` settings — brittle across origins and inside Docker. A stateless bearer token is origin-agnostic and a natural fit for a decoupled SPA.

**How it works:**

1. `POST /api/auth/login` checks the credentials and returns a plain-text token from `createToken()`.
2. The SPA stores it in an `auth_token` cookie (via `useCookie`), so a page reload keeps the session.
3. Every request sends `Authorization: Bearer <token>` — see `frontend/plugins/api.ts`.
4. Protected routes sit behind the `auth:sanctum` guard. Any `401` clears the token client-side and redirects to `/login`.
5. `POST /api/auth/logout` revokes **only** the token that made the request, so other devices stay signed in.

---

## Quick start

### Option A — Docker

```bash
docker compose up --build
```

- App → http://localhost:3000
- API → http://127.0.0.1:8000
- API docs → http://127.0.0.1:8000/docs

The backend container copies `.env`, generates the app key, then migrates and seeds on start.

### Option B — Run it locally

**Backend**

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate

touch database/database.sqlite     # SQLite is the default
php artisan migrate --seed

php artisan serve                  # http://127.0.0.1:8000
```

**Frontend** (second terminal)

```bash
cd frontend
cp .env.example .env               # NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api
npm install
npm run dev                        # http://localhost:3000
```

Then open http://localhost:3000 and sign in with one of the accounts below.

> **Note on `127.0.0.1` vs `localhost`.** `php artisan serve` binds IPv4 only. Some Linux setups resolve `localhost` to `::1` first, and the browser then stalls on every API call. Using `127.0.0.1` for the API base sidesteps that; `http://localhost:8000/api` is fine on machines where that is not an issue.

> Prefer MySQL or PostgreSQL? Set `DB_CONNECTION` and the `DB_*` values in `backend/.env`, then run `php artisan migrate --seed`. The same migrations run on all three.

---

## Test accounts (seeded)

| Role  | Email               | Password   | Sees                 |
| ----- | ------------------- | ---------- | -------------------- |
| Admin | `admin@example.com` | `password` | **All** users' tasks |
| User  | `user@example.com`  | `password` | Only their own tasks |

There is a third account (`second@example.com` / `password`) with a few tasks of its own, so the admin view visibly contains more than one owner.

---

## API documentation

A real OpenAPI 3.0 spec lives at `backend/public/openapi.yaml`, and Swagger UI is served from the API itself:

- **http://127.0.0.1:8000/docs** — browse the endpoints, click **Authorize**, paste a token from `POST /api/auth/login`, and call the API straight from the page.

Swagger UI is vendored under `backend/public/vendor/swagger-ui`, so the docs work offline.

### Endpoints

Base URL `/api`. Everything returns JSON.

| Method    | Endpoint       | Access      | Purpose                               |
| --------- | -------------- | ----------- | ------------------------------------- |
| POST      | `/auth/login`  | public      | Authenticate, returns `{token, user}` |
| POST      | `/auth/logout` | auth        | Revoke the current token              |
| GET       | `/user`        | auth        | The current user                      |
| GET       | `/tasks`       | auth        | List: search, filter, sort, paginate  |
| POST      | `/tasks`       | auth        | Create a task                         |
| GET       | `/tasks/{id}`  | owner/admin | Fetch one task                        |
| PUT/PATCH | `/tasks/{id}`  | owner/admin | Update a task                         |
| DELETE    | `/tasks/{id}`  | owner/admin | Delete a task                         |

`GET /tasks` query parameters:

| Param       | Values                                            | Default      |
| ----------- | ------------------------------------------------- | ------------ |
| `search`    | string, matched against title and description      | —            |
| `status`    | `pending` \| `in_progress` \| `completed`         | —            |
| `sort`      | `due_date` \| `status` \| `title` \| `created_at` | `created_at` |
| `direction` | `asc` \| `desc`                                   | `desc`       |
| `per_page`  | 1–100                                             | `10`         |
| `page`      | integer                                           | `1`          |

Anything outside those values is a `422` rather than a silently ignored filter.

### Task model

| Field                     | Type         | Notes                                     |
| ------------------------- | ------------ | ----------------------------------------- |
| `id`                      | integer      | Primary key                               |
| `user_id`                 | integer      | Owner, taken from the authenticated user  |
| `title`                   | string       | Required, 3–255 characters                |
| `description`             | text \| null | Optional                                  |
| `due_date`                | date \| null | Optional                                  |
| `status`                  | enum         | `pending` \| `in_progress` \| `completed` |
| `created_at`/`updated_at` | datetime     | Timestamps                                |

### Error format

Every failure has the same shape — a `message`, plus an `errors` map on validation failures:

```json
{ "message": "The title field is required.", "errors": { "title": ["The title field is required."] } }
```

| Status | When                                     |
| ------ | ---------------------------------------- |
| 401    | Missing, invalid or expired token        |
| 403    | Authenticated, but not the owner nor admin |
| 404    | The task does not exist                  |
| 422    | Validation failed (`errors` is populated) |
| 500    | Unexpected server error                  |

It is defined in one place: `backend/app/Exceptions/ApiExceptionHandler.php`.

### Example

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"email":"user@example.com","password":"password"}' | jq -r .token)

curl -s "http://127.0.0.1:8000/api/tasks?status=pending&sort=due_date&direction=asc" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'
```

---

## What's implemented

**Backend**

- `Task` model with query scopes for search, status filtering and whitelisted sorting (tasks without a deadline always sort last).
- `IndexTaskRequest` / `StoreTaskRequest` / `UpdateTaskRequest` Form Requests. The update request is PATCH-friendly: every field optional, validated when present.
- `TaskPolicy` limits view/update/delete to the owner; admins may act on any task. A task's owner always comes from the authenticated user, never from the request body.
- API Resources (`TaskResource`, `UserResource`) shape the output.
- A `role` column (`user` / `admin`) drives both the list scope and authorization.
- One exception handler for the whole JSON error contract.

**Frontend**

- Login page with error handling; `auth` / `guest` route middleware; a `401` anywhere clears the session and redirects to `/login`.
- Task list with sorting (due date, status, title, created), status filter, and a **debounced search kept in sync with the URL query** — so a filtered list is shareable, bookmarkable and survives a refresh.
- Create/edit in a modal, delete behind a confirmation — no page reloads.
- Loading, API-error (with retry) and empty-list states, kept distinct from one another.
- Client-side validation mirrors the backend rules; the backend's `422` field errors are mapped back onto the form.
- Edit/Delete buttons are hidden when the user has no permission for that action.
- Pagination on both ends.

---

## Tests

**Backend** — PHPUnit. Unit tests cover the policy and the status enum; feature tests cover the auth flow, CRUD, ownership and admin authorization, validation, the error contract, search, filtering, sorting and pagination.

```bash
cd backend
php artisan test
```

**Frontend** — Vitest, running in the Nuxt environment.

```bash
cd frontend
npm run test        # unit tests + component/store tests
npm run typecheck   # vue-tsc
```

The frontend tests cover the critical paths: the login store (success, wrong credentials, error fallback), the tasks store (loading, empty, error, update-in-place, delete), the permission rules that hide Edit/Delete, and the form validation helpers.

---

## Notes

- Laravel 12 slim skeleton: middleware and exceptions are configured in `bootstrap/app.php`.
- CORS origins are env-driven (`CORS_ALLOWED_ORIGINS`); Sanctum's token lifetime is `SANCTUM_TOKEN_EXPIRATION` (empty = never expires).
- SQLite was chosen so the project runs with no database server to install.
- `php artisan serve` uses PHP's single-threaded dev server. If requests ever appear to stall, `php artisan serve --no-reload` with `PHP_CLI_SERVER_WORKERS=4` gives it a few workers.
