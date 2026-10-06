# Care Portal

A patient and staff appointment application with a Node.js/Vite frontend and Java Spring Boot REST API, JPA, and MySQL backend.

## Run

Requirements: Node.js 20.19+ or 22.12+, Java 21+, Maven 3.9+, MySQL 8+.

1. Configure MySQL using `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` environment variables. Defaults: `jdbc:mysql://localhost:3306/careportal?createDatabaseIfNotExist=true`, user `root`, empty password.
2. In `backend`, run `mvn spring-boot:run` (port 8080).
3. In `frontend`, run `npm install` then `npm run dev` (port 5173). Open http://localhost:5173.

For a local demo without MySQL, run `mvn spring-boot:run -Dspring-boot.run.profiles=demo` in `backend`. This uses a persistent H2 database in `backend/data`.

Register staff first (a practitioner, a lab staff member, and optionally an assistant), then register a patient. Save each generated username shown after registration. There are no preset credentials. An assistant must assign themselves a doctor before managing that doctor's appointments.

## Behavior

- Database-generated primary keys and usernames `lastname_firstname_001` / `lastname_firstname_P001`; the numeric suffix uses the shared user ID sequence.
- BCrypt passwords, server-stored bearer sessions with 12-hour expiry, logout revocation, and server-side role and ownership checks.
- Assistant assignments, provider/date/status filters, practitioner patient lists, and assigned lab appointments.
- Patients book available 15-minute slots starting at 08:00. Practitioners offer 24 slots per day. The specification contains both 25 and 30 lab slots; the default is **25 per laboratory department per day**, configurable with `LAB_DAILY_SLOTS=30`.
- Appointments identify the assigned staff member. Completed/follow-up visits keep their occupied slot. No cancellation flow was specified.
- Assigned practitioners and laboratory staff upload PDF, PNG, JPEG, or text results up to 10 MB. Assistants can update status and comments. Patients can read and download their own results.
- Files are stored outside the web root under `UPLOAD_DIR` (default `./uploads`) and served only after an authorization check.
- Frontend sessions use browser session storage; API requests pass through the Vite development proxy. For production, serve built frontend assets behind a reverse proxy that routes `/api` to the backend over HTTPS.

## Validation

Run `mvn test` in `backend` and `npm run build` in `frontend`.

## Deployment considerations

This is an application foundation, not a certified clinical records system. Before production use, add controlled staff onboarding (the requested public staff registration grants staff privileges), account recovery, audit logging, backups, malware scanning, rate limiting, and organization-specific privacy controls. Use database migrations instead of automatic schema updates for production.
