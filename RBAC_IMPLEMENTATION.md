# Vendor CMS permission-based access control

Driven entirely by the vendor login response. Two roles: `VENDOR_ADMIN` (whole vendor),
`VENDOR_STAFF` (branch-scoped).

## One place for the checks

`src/app/core/services/auth.service.ts` is the only file that reads `permissions` or `roleName`.

| API | Meaning |
|---|---|
| `canView(resource)` | `cms_<resource>:read` **or** `:manage` — manage implies read |
| `canManage(resource)` | `cms_<resource>:manage` only |
| `isStaff()` / `isAdmin()` | role, used for data scope only |
| `branchScope()` | `string[]` for staff, `null` for admin (= all branches) |
| `isSuspended()` | a *known* non-`ACTIVE` `accountStatus` |
| `displayName()` / `displayRole()` | header/sidenav; role translated, else humanized |

`resource` is the permission name with no `cms_` prefix and no level: `profile`, `offers`,
`locations`, `vendor_staff`, `redemptions`, `analytics`, `messaging_center`.

Session lives in a signal (`session`), mirrored to `localStorage`. On app start it rehydrates
from the stored account; if that key is gone but the token still decodes, it rebuilds from the
JWT payload. `logout()` clears both.

## Resource → route → menu

| Resource | Route | Sidenav `permissionKey` |
|---|---|---|
| `profile` | `/profile` | yes |
| `offers` | `/offers` | yes |
| `locations` | `/branches` | yes |
| `vendor_staff` | `/account-management` | yes |
| `redemptions` | `/redemption` | yes |
| `analytics` | `/analytics` | yes |
| `messaging_center` | `/messaging-center` | yes |

No permission has a missing page. Four pages have no permission — see Open items.

## Hidden vs. access-denied

Two different mechanisms, by design:

- **Hidden** — a page the account can't view never appears as a link. The sidenav (desktop *and*
  the mobile drawer, which reuses the same `<app-sidenav>`) filters on `canView`, and the navbar's
  profile-menu link is filtered too. A subaccount sees no Account Management entry at all.
- **`/access-denied`** — only reached by going around the UI: typing the URL, an old bookmark, a
  notification deep-link, or a 403 from the backend. `permissionGuard` catches it and names the
  refused resource.

Audited for leftover links into gated pages from anywhere a subaccount can reach: dashboard tiles
(`/offers`, `/request-center`, `/recent-activities`), quick actions (hidden for staff), the navbar
profile menu, and the navbar notification bell. The only entries into a gated page now come from
the filtered sidenav or a direct URL.

The bell needed the same treatment as the sidenav: its **Messages** section opens Messaging
Center, so it is rendered only when `canView('messaging_center')`, and the unread badge counts
only the sections that are actually shown — a badge for something you can't open is a dead end.
Offer deep-links check `canView('offers')` before navigating. This matters in practice because a
subaccount created through this app never receives a messaging permission:
`SUBACCOUNT_DEFAULT_PERMISSIONS` is profile/offers/locations read plus `cms_redemptions:manage`,
and `SUBACCOUNT_PERMISSION_OPTIONS` only adds redemption history, analytics and manage-branches
(`src/app/features/AccountManagement/models/account.model.ts`) — no `cms_messaging_center` in
either. The sample `VENDOR_STAFF` payload in the spec did include it; the app's own account
creation does not.

## Guards

`src/app/shared/guards/auth.guard.ts`

- `authGuard` / `authChildGuard` — valid JWT `exp`, else `/login`. A suspended account is sent to
  `/login?account=inactive`.
- `permissionGuard('<resource>')` — on all 7 top-level routes. Denied → `/access-denied?reason=<resource>`.
- `managePermissionGuard('<resource>')` — on every create/edit sub-route, so a read-only user who
  types the URL lands on access-denied instead of a form that can't submit.
- `vendorAdminGuard` — vendor-wide actions staff must not reach even holding `:manage`
  (`/branches/create` today).

## Interceptor

`Authorization: Bearer <token>` on every non-login request. 401 → clear session,
`/login?session=expired`. No refresh-token endpoint exists in this API, so 401 is terminal —
none was invented.

**403 deliberately does not redirect** (a deviation from spec item 9). It was wired to
`/access-denied` first, and that broke Redemption: the page loads several endpoints, the backend
403'd one of them, and the whole app got ejected from a page `permissionGuard` had correctly
allowed. A 403 is refused *data*, not a refused page — page-level access is the guard's job, so
the interceptor now logs and lets the error reach the caller, which already surfaces it via
`extractApiErrorMessage`. If a 403 should ever bounce the user, it has to be per-call, not global. The role-tailored
endpoints above should remove most of these 403s at the source.

Diagnostic for the future: an `/access-denied` URL **with** `?reason=<resource>` came from a route
guard; **without** one it came from something else.

## Per role, as implemented

| Page | VENDOR_ADMIN | VENDOR_STAFF |
|---|---|---|
| Profile | view + edit | view only (edit button and `/profile/edit` gone) |
| Offers | view + edit | view only (no "Add New", row menu view-only, no Edit on the detail page) |
| Branches | view + edit + create + cancel | view + edit own branch; no create, no cancel |
| Redemption form | record redemptions | record redemptions (`:read`-only sees history only) |
| Account Management | view + edit | hidden in sidenav, URL → `/access-denied` |
| Redemption | view + edit | view + edit |
| Analytics | view only | view only |
| Messaging Center | view + edit | view + edit |
| Dashboard | full | quick-actions section hidden |

Write controls gated inside pages, beyond the route guards: offers "Add New" + row menu +
detail-page Edit and Raise Ticket, branches "Add Branch" + row menu + view-branch Edit, the
profile hero Edit, account-management "Add" + row menu, redemption "Upload Excel" **and the
record-a-redemption form** (a `cms_redemptions:read`-only user sees the history table only, which
is the one write form living on a route reachable with `:read`), and the messaging new-ticket
button.

## Not verified

The per-role table above was checked by build + unit tests, not by signing in as each role: the
`backend-api` MCP server failed to connect this session and there are no role credentials here.
A walkthrough with a real `VENDOR_ADMIN` and `VENDOR_STAFF` login is still worth doing —
especially open item 1, where staff data scoping rests entirely on the backend today.

## Open items

1. **Staff branch scope is not wired, and stays that way on purpose.** The login response carries
   no branch id. `branchScope()` returns `[]` for staff — "scoped, but the ids aren't known here" —
   and the frontend does no client-side branch filtering.

   **Decided: the table/list endpoints get role-tailored versions server-side.** The backend will
   return the rows a given role is allowed to see, so the frontend keeps its tables as they are —
   no per-role filtering, no branch pickers to lock. Don't add client-side scoping later without
   revisiting this; it would double-filter data the API has already narrowed.

   `branchScope()` stays in place for the case where a branch id is genuinely needed client-side.
   If the id ever lands (login payload, JWT `locationIds`, or a staff-readable `GET /accounts/{id}`),
   populate `locationIds` on the session and it starts returning real ids with no call site changing.
   No "All branches" picker option exists anywhere today, so nothing needed hiding.
2. **Four pages sit outside the permission scheme** — Dashboard, Request Center, Recent
   Activities, Settings. Left visible to both roles, per your call to handle them later.
3. **Cancel-branch is treated as admin-only.** Staff hold `cms_locations:manage`, but your answer
   was "edit their assigned branch(es) only", and removing a branch from the vendor is not an
   edit. If cancel should follow the permission literally, drop `canAddBranch()` back to
   `auth.canManage('locations')` in the branches row menu.
4. **`?vendorId=` removed from the offer form.** It could aim a vendor-scoped call at another
   vendor's id. The form already pins `selectedVendor` to the session's `vendorId`.

## Tests

`npx ng test --watch=false` — 66 passing, 3 failures that predate this work
(`app.spec.ts > should render title`, and two `i18n.spec.ts` cases about
`redemption.label.paidAmount` / `totalAmount` missing from `ar.json` plus 3 Arabic strings equal
to their English).

New coverage: `canView`/`canManage` incl. manage-implies-view, no-session denial, `branchScope()`
for admin / staff / unknown-branch staff, suspended-account handling, JWT rehydration,
`permissionGuard` allow + deny-with-reason, `managePermissionGuard` on a read-only grant,
`vendorAdminGuard` staff vs admin, `authGuard` on a suspended account, and the interceptor's
403 → `/access-denied`.
