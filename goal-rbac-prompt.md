## Login responses (source of truth)
Both have the same shape. `accessToken` is a JWT whose payload carries the same
`vendorId`, `roleId`, `roleName`, `permissions` and `exp`.

**VENDOR_ADMIN** (the vendor owner, full access):
```json
{
  "accessToken": "<JWT>",
  "vendorAccount": {
    "id": "6a81a6ea8e514f101efdb338",
    "vendorId": "6a81a4538e514f101efdb29f",
    "roleId": "6a65d25accc8bbcbf39f8b8d",
    "roleName": "VENDOR_ADMIN",
    "permissions": [
      "cms_profile:read", "cms_profile:manage",
      "cms_offers:read", "cms_offers:manage",
      "cms_locations:read", "cms_locations:manage",
      "cms_vendor_staff:read", "cms_vendor_staff:manage",
      "cms_redemptions:read", "cms_redemptions:manage",
      "cms_analytics:read",
      "cms_messaging_center:manage"
    ],
    "name": "Jane Adamson",
    "email": "testvendor@vendor.com",
    "accountStatus": "ACTIVE",
    "language": "ENGLISH",
    "theme": "LIGHT"
  }
}
```

**VENDOR_STAFF** (a sub-account, restricted to their branch):
```json
{
  "accessToken": "<JWT>",
  "vendorAccount": {
    "id": "6aa78c8e6a771f917dd4e74f",
    "vendorId": "6a81a4538e514f101efdb29f",
    "roleId": "6a82c8c716b28539b2f7ce08",
    "roleName": "VENDOR_STAFF",
    "permissions": [
      "cms_profile:read",
      "cms_offers:read",
      "cms_locations:read", "cms_locations:manage",
      "cms_redemptions:manage",
      "cms_messaging_center:manage",
      "cms_analytics:read"
    ],
    "name": "Hasan AL Qaisoom",
    "email": "sdf@dfhd.com",
    "accountStatus": "ACTIVE",
    "language": "ENGLISH",
    "theme": "LIGHT"
  }
}
```

## How it must work
1. **Store the session.** On login, save `accessToken` and a session object
   `{ id, vendorId, roleId, roleName, permissions, accountStatus, name, email }` from
   `vendorAccount` to localStorage and to reactive state (signal/store). Rehydrate it on app start;
   if the stored session is missing but the token is valid, rebuild it from the JWT payload.
   Clear both on logout. If `accountStatus` is not `ACTIVE`, don't open the app: show an
   "account inactive" message.
2. **Permissions decide which pages and actions are available, not `roleName`.**
   Permission format is `cms_<resource>:<level>`, level `read` or `manage`.
   - **See** a resource: `cms_<resource>:read` OR `cms_<resource>:manage` (manage implies read,
     e.g. `cms_redemptions:manage` alone must still open Redemptions).
   - **Create / edit / delete**: only with `cms_<resource>:manage`.
3. **`roleName` decides only data scope.**
   - `VENDOR_ADMIN` → sees all data for `vendorId` (all branches).
   - `VENDOR_STAFF` → sees and acts on data for **their own branch only**, in every page
     (offers, locations, redemptions, analytics, messaging). Branch pickers/filters are locked
     to that branch, and there's no "all branches" option.
   - **The login response contains no branch id.** Before writing scoping code, find where the
     staff member's branch comes from: a field on the staff account (the `cms_vendor_staff`
     API), a profile/me endpoint, or scoping the backend already applies from the token.
     If the backend already filters by token, don't duplicate it in the frontend; only hide the
     branch pickers. If you can't find the source, stop and ask. Don't guess.
4. **One place for the checks.** In the auth service: `canView(resource)`, `canManage(resource)`,
   `isStaff()`, and `branchScope()` (the staff member's branch id, or `null` for admin).
   `resource` is the name without the `cms_` prefix and without the level (`offers`,
   `vendor_staff`, `messaging_center` …). No component reads `permissions` or `roleName` directly.
5. **Route guards.** One guard factory `permissionGuard('<resource>')` on every top-level route.
   Denied → redirect to `/access-denied?reason=<resource>`. An auth guard on the layout's children
   checks the token is valid (decode JWT `exp`), otherwise sends the user to `/login`.
6. **Sidenav.** Each menu item has a `permissionKey`; the menu is filtered with `canView`,
   so users never see links they can't open.
7. **Inside pages.** Hide create/edit/delete buttons, row actions and form submit unless
   `canManage`. Read-only users see the same page without those controls.
8. **API calls.** Use `vendorId` from the session for vendor-scoped calls (never a hard-coded or
   URL-supplied id). For staff, also pass `branchScope()` wherever the API accepts a branch filter.
9. **HTTP interceptor.** Attach `Authorization: Bearer <accessToken>`. On 401 → clear the session
   and go to `/login?session=expired`. On 403 → navigate to `/access-denied`.
10. **Show the role.** Display `name` and `roleName` humanized (`VENDOR_ADMIN` → "Vendor Admin",
    `VENDOR_STAFF` → "Vendor Staff") in the header/sidenav.

## Expected result per role
| Page | VENDOR_ADMIN | VENDOR_STAFF |
|---|---|---|
| Profile | view + edit | view only |
| Offers | view + edit | view only, own branch |
| Locations | view + edit | view + edit, own branch |
| Vendor Staff | view + edit | hidden, URL → `/access-denied` |
| Redemptions | view + edit | view + edit, own branch |
| Analytics | view only | view only, own branch |
| Messaging Center | view + edit | view + edit, own branch |

## Rules
- The backend still enforces permissions; the frontend only hides and redirects.
- Reuse the existing auth service, router, HTTP client and interceptor in this project if they
  exist. Don't add libraries.
- Map each resource (`profile`, `offers`, `locations`, `vendor_staff`, `redemptions`,
  `analytics`, `messaging_center`) to its route and menu item. List any permission with no
  matching page, and any page with no permission, as questions. Don't invent mappings.
- Ask before building: can staff with `cms_locations:manage` create new locations, or only edit
  their own branch?
- If there's a refresh-token endpoint, use it on 401 and retry once; if not, don't build one.

## Done when
- Logging in as each role shows exactly the table above.
- A staff user can't reach another branch's data through filters, pickers or URL params.
- Removing `cms_<x>:manage` hides that page's edit actions; removing both read and manage
  hides the menu item, and the direct URL redirects to `/access-denied`.
- Small tests: `permissionGuard` (allowed → true, denied → redirect), `canView`/`canManage`
  (manage implies view), and `branchScope()` (admin → `null`, staff → their branch).
