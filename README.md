# Property Management System

Web adaptation of PROG3-MCO2 by Hephzi Tolentino and Francine Santos. Preserves the name and cream (#EBE9E1), rose (#D6536D), orange (#E43D12), and gold (#EFB11F) palette. Hotels, entire houses, and entire condos share the reservation workflow.

## Run

Requirements: Node.js 22+, Java 21+, Maven, MySQL 8+.

1. In `backend`, set `DB_USERNAME` and `DB_PASSWORD` for your MySQL account. Optionally set `DB_URL` (default `jdbc:mysql://localhost:3306/hrs?createDatabaseIfNotExist=true`). The account needs permission to create the database/tables, or create `hrs` beforehand.
2. Run `mvn spring-boot:run` in `backend` (port 8081).
3. In `frontend`, run `npm install`, then `npm run dev` (http://localhost:5174).
4. Register as a property owner to list a hotel, house, or condo; register a separate customer account to book.

For a local preview without MySQL, run `mvn spring-boot:run -Dspring-boot.run.profiles=demo`. This explicitly selected profile uses a persistent H2 database. The normal configuration uses MySQL and JPA.

Validation: `mvn test` in backend; `npm run build` in frontend.

## Features

- Registration, login, logout, BCrypt passwords, expiring opaque sessions, server-side ownership checks.
- Property creation, unique names, rename, location/description edits, confirmed deletion and reservation-count/earnings summary.
- Hotels: 1–50 rooms; Standard, Deluxe (+20%), Executive (+35%); generated room numbers; add rooms, remove unreserved rooms individually or by range, keep at least one room. Houses/condos: one entire-property booking unit.
- Default base price 1299, minimum 100; changing base price blocked while active reservations exist.
- Free booking with room/date selection; date-first booking with available-room filtering; room-first booking with availability checking. Date and room search, monthly room calendar, customer reservation details, owner reservation search by guest/date/reference.
- Check-in included, checkout excluded; no overlapping reservations; booking and cancellation lock the unit to serialize competing requests. Full dates replace the original fixed June 1–31 calendar.
- Nightly price breakdown and immutable saved reservation totals; modifiers per date (50–150%), default 100%; voucher previews and eligibility validation.
- Original protected vouchers: I_WORK_HERE (10%); PAYDAY (7% when occupied stay includes day 15 or 30); STAY4_GET1 (first night free for 4+ nights). Custom percentage, qualifying day, and stay-length vouchers; list and delete custom vouchers. One voucher per reservation.
- Customer and owner reservation cancellation frees availability and adjusts estimated earnings. Past cancelled reservations retain their price breakdown.

## API

Base path `/api`. Authenticated requests use `X-Session` from login/register. Public: properties, details, availability, quote. Auth: `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`. Owner management: `/properties`, `/properties/{id}`, `/properties/{id}/units`, `/units/{id}`, `/properties/{id}/rates`, `/properties/{id}/vouchers`, `/vouchers/{id}`. Bookings: `/reservations/quote`, `/reservations`, `/reservations/{id}`. Owner reservation list: `/reservations?propertyId={id}`.

## Delivery scope

This is a local runnable implementation, not a deployed service. No accounts or listings are seeded. Production hosting needs HTTPS, environment secrets, database backups and migrations, and same-origin routing to `/api`. No email verification, password reset, payment collection, or external booking integrations are included. Existing project files and the source ZIP are untouched.

Stack reference: https://docs.spring.io/spring-boot/3.5/reference/data/sql.html
