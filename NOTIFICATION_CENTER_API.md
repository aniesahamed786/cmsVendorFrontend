# Notification bell — backend APIs needed

The bell talks to **one API only**: `{backendUrl}/api/v1/cmsVendor/notification`. No ticket,
messaging or system-log calls. Every request is wrapped in `catchError → []`, so the bell
renders empty (no errors, no logout) until these land.

## Endpoints

### 1. `GET /cmsVendor/notification`
Guard: `VendorAccountGuard`. All notifications addressed to the authenticated vendor with
computed status `SENT`, newest first, each carrying that vendor's `isRead`.

```jsonc
{
  "_id": "…",              // or { "$oid": "…" }
  "type": "MESSAGE",       // MESSAGE | SYSTEM | ADMIN  — see below
  "title": "…", "title_ar": "…",
  "description": "…", "description_ar": "…",
  "image": "/media/…",     // optional; relative is fine, the app prefixes the API base
  "isRead": false,
  "createdAt": "2026-09-09T10:00:00.000Z",
  "ticketId": "…",         // MESSAGE rows only — deep-links the ticket
  "actionType": "Open Specific Offer",   // optional
  "actionValue": "…",                    // optional
  "offerId": "…"                         // optional
}
```

`type` drives everything the UI does with a row:

| `type` | Section | Icon | Click |
|---|---|---|---|
| `MESSAGE` | MESSAGES | `pi-comments` | → `/messaging-center` |
| `SYSTEM` | NOTIFICATIONS | `pi-cog` | offer / external link if set |
| `ADMIN` | NOTIFICATIONS | `pi-bell` | offer / external link if set |

Unknown/missing `type` falls back to `ADMIN`.

### 2. `PUT /cmsVendor/notification/:id/read`
### 3. `PUT /cmsVendor/notification/read-all`
`VendorAccountGuard`, `200`, empty body. Read-state keyed on the **vendorAccount id**.

## Why this needs new backend code

`NotificationController` is `@Controller(['user/notification','mobile/user/notification'])`
behind `UserGuard`. Adding `'cmsVendor/notification'` to that array is **not** enough:
`UserGuard` rejects vendor tokens, `actorFromJwt` throws unless the id is a `users._id`, and
`AudienceService.resolveUserType` has no vendor type. Mirror
`messaging-center-vendor.controller.ts` instead — `VendorAccountGuard` + `VendorAccountActor`
— and store read-state per vendorAccount.

## Producers — what has to write rows

1. **CMS admin** — `POST /admin/notification` needs vendor targeting: an audience value
   (`VENDOR` / `ALL_VENDORS`) and/or `targetVendorIds[]`. Emits `type: "ADMIN"`.
2. **System updates** — insert `type: "SYSTEM"` rows. **Every change in the system originates
   from a ticket or a request** — those two flows are the only sources of a SYSTEM
   notification, so hook the writes there and nowhere else:
   - **Requests** (request-center): submitted, approved, rejected, recalled, cancelled — on
     offers, branches, banners, highlights, profile and account changes. A vendor change only
     becomes real once its request is approved, so the request state machine is the event
     source; carry the request id in `actionValue` (and `offerId` where the target is an offer).
   - **Tickets** (messaging-center): status changes on a vendor's ticket — assigned, status
     moved (New → In Progress → Closed). The ticket *state* is a SYSTEM row; a ticket *reply*
     is a MESSAGE row (below).

   Nothing else writes SYSTEM rows: no direct DB edits, no ad-hoc service calls. If a new
   vendor-visible change appears, it goes through a request or a ticket first, and the
   notification follows from that.
3. **Messages** — insert `type: "MESSAGE"` rows when an admin replies on a vendor's ticket
   (with `ticketId`), and mark them read when that ticket is read. This is what keeps the
   frontend off the messaging endpoints.

## Optional — live push

A socket event (e.g. `vendor.notification.created`) would make the badge live. Without it the
bell reloads on navbar init and on every popover open, which is what ships today.

## Frontend touch points

- `src/app/shared/services/notification-center.service.ts` — the three calls, mapping, badge count.
- `src/app/main-layout/Components/navbar/navbar.{ts,html,css}` — bell, popover, sections.
- `public/assets/i18n/{en,ar}.json` → `notifications.*`.
