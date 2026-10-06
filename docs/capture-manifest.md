# veno.instasafe.com — i365 admin console capture manifest

Captured 2026-09-19 (IST afternoon) from tenant **Veno** as debajyoti@instasafe.com. 502 HTML snapshots + 502 full-size PNGs across 72 pages/areas.

## How to use this folder

- `capture/<module>/<module>--<page>--<state>.html` — static DOM snapshot of that exact UI state. Open directly in Chrome; it links `../_assets/` for CSS, fonts and images.
- `capture/<module>/<module>--<page>--<state>.png` — full-size screenshot of the same snapshot (1707 px wide = your live viewport, scroll containers expanded so the full page is visible).
- `capture/_assets/` — every stylesheet, font and image the pages reference, mirrored by server path: `dist/css/{vendor,style,pagescss}.css`, `fonts/all.min.css` (Font Awesome), `webfonts/*.woff2`, `img/**`. The body font is `"Helvetica Neue", Helvetica, Arial` (a system font, so nothing to download).
- `capture/_work/` is scratch (transfer zips and a duplicate 404 file). Safe to delete, along with `Downloads\vcap__test1.txt` and `vcap__test2.txt`.
- Each HTML file starts with a `<!-- vcap {...} -->` comment: live URL, state, note, timestamp and viewport.

## Method notes (read before handing off)

- **HTML**: saved with an in-page serializer, not Ctrl+S. It keeps the live rendered DOM like "Webpage, Complete", plus three things Ctrl+S drops: rules injected through the CSSOM, typed form values/checked/selected state, and chart `<canvas>` (saved as PNG `<img>`). Scripts are stripped (commented with their original `src`), so the files stay static and never call the API. CSRF tokens, password values and S3-signed image URLs are redacted or localised.
- **Screenshots**: rendered from each snapshot by headless Chromium at the live viewport width, not DevTools "Capture full size screenshot". The DevTools route could not be automated in the background, and the app scrolls inside containers, so DevTools only returns an 800 px viewport anyway. Spot-checked against the live console. Fonts use Liberation Sans, which has the same metrics as Arial (your Windows fallback for Helvetica Neue).
- **Native validation**: most forms validate with the browser's built-in `required` bubbles, which are browser UI and do not exist in the DOM. In every `*--add-validation.html` the invalid fields carry `data-vcap-invalid="<browser message>"`, and the note lists them. Server-side errors appear as Bootstrap toasts (bottom-left, ~3 s); these were caught with `*--toast-danger.html` / `*--toast-dark.html`.
- **Native `<select>` dropdowns**: the OS draws their popups, so an "open" state cannot exist as HTML. For the forms that matter, each option was selected and snapped instead (`*--add-<field>-<option>.html`, for example all 7 application types, all 10 access-rule source/destination types and all 24 device-check types).
- Files ending `--dark-theme.html` were captured while dark mode was briefly active in a parallel lane. They are valid dark-mode snapshots, and each has a light twin. Intentional dark captures end `--dark.html`.
- **No tenant data was created, edited or deleted.** Delete-confirm modals were opened and then cancelled. Save was clicked only on empty forms, where native validation blocks submission. One Add User attempt with a fake `zzcap-test@example.com` was rejected by the server ("The email must be a valid email address"). Sign-in step 1 was tried with a fake username, which returned "Invalid Credentials". I signed out at the end to capture the sign-in page.

## Deliberately not clicked (side effects)

Controllers **Commit / Stop / Restart**, Live Users/Gateways **Disconnect**, Blocked Users **Unblock**, AD/LDAP/Azure/Google **Sync Now**, SCIM **Regenerate Token**, MFA **View QR Code / Register Key / Download**, SAML **Import IDP Metadata / Download SP Metadata**, Company **Upload File**, every **CSV / Advance User CSV** export, and any **Yes, Delete it!**.

## Pages captured

| Module | Page | Route | Records | States captured |
|---|---|---|---|---|
| dashboard | dashboard | `/dashboard` |  | 5: dark, default, quick-start-guide, range-month, range-week |
| asset-inventory | asset-inventory | `/asset-inventory` |  | 1: default |
| graph | graph | `/graph` |  | 2: default, updated |
| controllers-gateways | controllers | `/controllers` | 1 | 9: add, add-protocol-tcp, add-protocol-udp, default, delete-confirm, edit, edit-form, empty, row-selected |
| controllers-gateways | gateways | `/gateways` | 1 | 9: add, add-validation, bulk-add, default, delete-confirm, edit, edit-form, empty, row-selected |
| general-settings | company-details | `/settings/company-details` |  | 4: add-contact, default, tab-renewal-contact, tab-tech-contact |
| general-settings | subscription-details | `/settings/subscription-details` |  | 1: default |
| general-settings | sms-settings | `/sms-settings` |  | 1: default |
| general-settings | email-settings | `/email-settings` |  | 2: change-password, default |
| auth-profiles | local | `/profile/local` |  | 1: default |
| auth-profiles | active-directory | `/profile/active-directory` | 0 | 7: add, add-authentication-type-certificate, add-authentication-type-password-certs, add-validation, default, delete-confirm, empty |
| auth-profiles | openldap | `/profile/ldap` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| auth-profiles | radius | `/profile/radius` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| auth-profiles | saml | `/profile/saml` | 2 | 9: add, add-integration-type-saml2-0, add-validation, default, delete-confirm, edit, edit-form, empty, row-selected |
| auth-profiles | oauth | `/profile/oauth` | 1 | 11: add, add-provider-azure, add-provider-generic, add-provider-google, add-validation, default, delete-confirm, edit, edit-form, empty, row-selected |
| auth-profiles | openid | `/profile/openid` | 1 | 8: add, add-validation, default, delete-confirm, edit, edit-form, empty, row-selected |
| auth-profiles | passwordless | `/profile/passwordless` | 1 | 14: add, add-fallback-auth-digital-certificate, add-fallback-auth-hardware-key, add-fallback-auth-password, add-primary-auth-digital-certificate, add-primary-auth-hardware-key, add-primary-auth-kerberos, add-validation, default, delete-confirm, edit, edit-form, empty, row-selected |
| user-providers | azure-ad | `/profile/azuread` | 1 | 8: add, add-validation, default, delete-confirm, edit, edit-form, empty, row-selected |
| user-providers | google | `/profile/google` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| user-providers | scim-import | `/profile/scim-import` |  | 1: default |
| users-groups | users | `/users` | 4 | 27: add, add-activation-method-automatically-on-first-login, add-activation-method-immediately-on-provisioning, add-activation-method-on-date-time, add-authentication-type-certificate, add-authentication-type-password-certs, add-dark, add-tab-advanced, add-tab-options, add-tab-options-dropdown-1, add-validation, add-validation-error, bulk-ops, dark, … (+13) |
| users-groups | user-groups | `/usergroups` | 1 | 11: add, add-validation, bulk-ops, default, delete-confirm, edit, edit-form, edit-form-dropdown-1, empty, graph, row-selected |
| users-groups | blocked-users | `/limit-exceeders` | 0 | 2: default, empty |
| user-settings | user-settings | `/user-settings` |  | 2: dark, default |
| user-settings | shift-schedules | `/time-schedules` | 1 | 9: add, add-validation, default, delete-confirm, edit, edit-form, edit-form--dark-theme, empty, row-selected |
| user-settings | risk-profiles | `/risk-profiles` | 0 | 13: add, add-action-deny-access, add-action-deny-access--dark-theme, add-action-disconnect-user, add-action-disconnect-user--dark-theme, add-action-email-admin, add-action-email-admin--dark-theme, add-action-suspend-user, add-action-suspend-user--dark-theme, add-validation, default, delete-confirm, empty |
| user-settings | dns-wins | `/settings/dns-wins` |  | 1: default |
| devices-checks | devices | `/devices` | 5 | 10: add, add-validation, bulk-ops, default, delete-confirm, edit, edit-form, empty, graph, row-selected |
| devices-checks | authenticator-devices | `/auth-devices` | 1 | 4: default, delete-confirm, empty, row-selected |
| devices-checks | device-policies | `/device-policy` | 0 | 8: add, add-os-linux, add-os-macos, add-os-windows, add-validation, default, delete-confirm, empty |
| devices-checks | device-checks | `/device-checks` | 2 | 62: add, add-check-antispyware, add-check-antispywarestatus, add-check-antivirus, add-check-antiviruslastupdate, add-check-antivirusstatus, add-check-bitlocker, add-check-browserid, add-check-domainname, add-check-fileexists, add-check-filenotexists, add-check-firewall, add-check-firewallstatus, add-check-hotfix, … (+48) |
| devices-checks | geofences | `/geo-fences` | 1 | 9: add, add-validation, default, delete-confirm, edit, edit-form, edit-form--dark-theme, empty, row-selected |
| devices-checks | blocked-apps | `/app-blocker` | 2 | 9: add, add-validation, default, delete-confirm, edit, edit-form, edit-form--dark-theme, empty, row-selected |
| devices-checks | device-updates | `/device-updates` | 0 | 15: add, add-install-schedule-after-reboot, add-install-schedule-after-reboot--dark-theme, add-install-schedule-immediate, add-install-schedule-immediate--dark-theme, add-install-schedule-uninstall, add-install-schedule-uninstall--dark-theme, add-post-validation-check-file-present, add-post-validation-check-file-present--dark-theme, add-post-validation-check-registry-key-present, add-post-validation-check-registry-key-present--dark-theme, add-validation, default, delete-confirm, … (+1) |
| filters | url | `/url-filter` | 0 | 8: add, add-url-type-exact-match, add-url-type-regex-match, add-url-type-wildcard-match, add-validation, default, delete-confirm, empty |
| filters | content | `/content-filter` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| filters | file-type | `/filetype-filter` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| filters | domain-lists | `/domainlists` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| applications | application-services | `/application-services` | 31 | 10: add, add-validation, bulk-add, default, delete-confirm, edit, edit-form, empty, page-2, row-selected |
| applications | applications | `/applications` | 6 | 31: add, add-type-db, add-type-fqdn, add-type-rdp, add-type-ssh, add-type-vnc, add-type-web, add-type-wfs, add-validation, bulk-add, default, delete-confirm, edit, edit-form, … (+17) |
| applications | application-groups | `/application-groups` | 0 | 5: add, bulk-add, default, delete-confirm, empty |
| access-rules | access-rules | `/access-rules` | 5 | 47: add, add-dark, add-destination-type-application, add-destination-type-application-group, add-destination-type-content-filter, add-destination-type-custom-application, add-destination-type-domain-list, add-destination-type-filetype-filter, add-destination-type-url-filter, add-source-type-application, add-source-type-user, add-source-type-user-group, add-validation, bulk-add, … (+33) |
| logs-reports | live-users | `/reports/live` | 1 | 2: default, empty |
| logs-reports | live-gateways | `/reports/gateway` | 1 | 2: default, empty |
| logs-reports | user-last-login | `/reports/user-last-login` | 5 | 2: default, empty |
| logs-reports | data-usage | `/reports/data-uses-log` | 1 | 2: default, empty |
| logs-reports | time-usage | `/reports/time-uses-log` | 1 | 2: default, empty |
| logs-reports | network-test | `/reports/network-test` | 1 | 2: default, empty |
| logs-reports | risk-report | `/reports/anomaly-logs` | 6 | 2: default, empty |
| logs-reports | session-recording | `/reports/session-recording` | 0 | 2: default, empty |
| logs-reports | session-log | `/reports/session-log` | 402 | 3: default, empty, page-2 |
| logs-reports | access-log | `/reports/access-logs` | 35 | 3: default, empty, page-2 |
| logs-reports | application-access-log | `/reports/application-access-logs` | 7 | 2: default, empty |
| logs-reports | event-log | `/reports/event-logs` | 4 | 4: dark, default, empty, filter-1-open |
| report-settings | export-log | `/profile/export-log` | 0 | 4: add, default, delete-confirm, empty |
| report-settings | report-subscriptions | `/report-subscriptions` | 0 | 5: add, add-dropdown-1, default, delete-confirm, empty |
| downloads | user-agents | `/downloads/user-agents` |  | 1: default |
| downloads | gateway-agents | `/downloads/gateway-agents` | 2 | 1: default |
| sub-admins | sub-admins | `/sub-admin/all` | 0 | 4: add, default, delete-confirm, empty |
| sub-admins | sub-admin-roles | `/sub-admin/roles` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| idam | scim-export | `/scim-export` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| idam | oauth2-service | `/oauth2-service` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| idam | openid-provider | `/openid-idp` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| idam | saml-idp | `/saml-idp` | 1 | 11: add, add-sp-type-azure, add-sp-type-custom, add-sp-type-google, add-validation, default, delete-confirm, edit, edit-form, empty, row-selected |
| idam | radius-service | `/authserver/radius` | 0 | 5: add, add-validation, default, delete-confirm, empty |
| tech-support | tech-support | `/tech-support` | 0 | 3: add, default, empty |
| account | profile | `/profile` |  | 3: change-password, default, update-profile |
| account | mfa-profile | `/mfa-profile` |  | 1: default |
| login | signin | `/signin` |  | 5: after-next-1s, after-next-3s, default, username-filled, validation |
| global | nav | `(left nav)` |  | 3: expanded, expanded-dom-only, group-open |
| global | header | `(header)` |  | 1: user-menu |
| global | 404 | `/login (404)` |  | 1: default |

## States still missing

| Module | Page | Missing state | Why / what unblocks it |
|---|---|---|---|
| graph | graph | rendered graph | WebGL canvas renders blank while the Chrome tab is in the background — needs the tab in front |
| controllers-gateways | controllers | validation errors | Save not clicked (adds a controller / config push) |
| general-settings | company-details | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| general-settings | subscription-details | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| general-settings | sms-settings | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| general-settings | email-settings | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| auth-profiles | local | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| auth-profiles | active-directory | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| auth-profiles | openldap | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| auth-profiles | radius | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| user-providers | google | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| user-providers | scim-import | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| users-groups | users | Graph view content | WebGL 3D graph blank (tab was hidden) — layout/toolbar captured, canvas empty |
| users-groups | user-groups | Graph view content | WebGL 3D graph blank (tab was hidden) — layout/toolbar captured, canvas empty |
| user-settings | user-settings | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| user-settings | risk-profiles | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| user-settings | dns-wins | validation errors | not triggered — Save on a live settings form would overwrite tenant config |
| devices-checks | devices | Graph view content | WebGL 3D graph blank (tab was hidden) — layout/toolbar captured, canvas empty |
| devices-checks | authenticator-devices | edit (view + edit form) | row click did not open a panel |
| devices-checks | device-policies | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| devices-checks | device-updates | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| filters | url | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| filters | content | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| filters | file-type | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| filters | domain-lists | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| applications | application-groups | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| applications | application-groups | validation errors | Save button not found by automation |
| access-rules | access-rules | Graph view content | WebGL 3D graph blank (tab was hidden) — layout/toolbar captured, canvas empty |
| report-settings | export-log | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| report-settings | export-log | validation errors | Save not clicked (starts a log export job) |
| report-settings | report-subscriptions | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| report-settings | report-subscriptions | validation errors | Save not clicked (schedules report emails) |
| sub-admins | sub-admins | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| sub-admins | sub-admins | validation errors | Save not clicked (sends an admin invite email) |
| sub-admins | sub-admin-roles | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| idam | scim-export | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| idam | oauth2-service | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| idam | openid-provider | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| idam | radius-service | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| tech-support | tech-support | edit (view + edit form) | no records in tenant (0 rows) — needs a zzcap test record; creating was blocked pending your OK |
| tech-support | tech-support | delete-confirm modal | no Delete action |
| tech-support | tech-support | validation errors | Save not clicked (opens a support session/ticket) |
| login | signin | password / MFA step (step 2) | only reachable with a real username. Using yours could trigger a push-MFA prompt, so it was skipped |
| login | forgot-password | forgot-password page | there is no forgot-password link on /signin step 1 |
| all | all | success toast (green) | needs a successful create/update. Creating zzcap- test records was blocked pending your OK |
| users-groups | users | user avatar image | the S3 photo is broken in the live app too (0×0), so it is left as a broken image |

## Not applicable (checked and nothing to capture)

- **Pagination past page 1**: every other list has 10 or fewer records, so there is no page 2. Page 2 *was* captured for application-services (31), access-log and session-log. The pager is one shared component. Lists without a page 2: controllers (1), gateways (1), active-directory (0), openldap (0), radius (0), saml (2), oauth (1), openid (1), passwordless (1), azure-ad (1), google (0), users (4), user-groups (1), blocked-users (0), shift-schedules (1), risk-profiles (0), devices (5), authenticator-devices (1), device-policies (0), device-checks (2), geofences (1), blocked-apps (2), device-updates (0), url (0), content (0), file-type (0), domain-lists (0), applications (6), application-groups (0), access-rules (5), live-users (1), live-gateways (1), user-last-login (5), data-usage (1), time-usage (1), network-test (1), risk-report (6), session-recording (0), application-access-log (7), event-log (4), export-log (0), report-subscriptions (0), sub-admins (0), sub-admin-roles (0), scim-export (0), oauth2-service (0), openid-provider (0), saml-idp (1), radius-service (0), tech-support (0).
- **Dropdown open**: these forms have only native `<select>`s (or no dropdown). The option lists are in the HTML; the key selects were captured option by option as `--add-<field>-<option>`: access-log, application-access-log, application-groups, application-services, authenticator-devices, azure-ad, blocked-apps, blocked-users, content, data-usage, devices, dns-wins, domain-lists, export-log, file-type, gateways, geofences, google, live-gateways, live-users, local, network-test, oauth2-service, openid, openid-provider, openldap, radius, radius-service, risk-report, scim-export, scim-import, session-log, session-recording, shift-schedules, sms-settings, sub-admin-roles, sub-admins, subscription-details, tech-support, time-usage, user-last-login, user-settings.
- **Create / edit / delete-confirm on read-only reports**: access-log, application-access-log, blocked-users, data-usage, event-log, live-gateways, live-users, network-test, risk-report, session-log, session-recording, time-usage, user-last-login.

## Redesign focus notes (ZTNA lens, from the captured screens)

1. **The policy core is buried and flat.** Access Rules sits between Applications and Logs in an 18-group nav. The list shows only Name/Src/Dst/Action. Posture (device policy/checks), schedule, geofence and risk profile are not visible per rule. The Add form is a linear stack, and when no Application Group exists it dead-ends with "Please add a Application Group to proceed further…". Candidate: a rule builder that reads as *who → what → under which conditions → action*, with inline creation of missing objects.
2. **Split-pane CRUD.** Add/View compresses the list to half width, which truncates columns. A row click opens a read-only "View X" panel, and editing takes a second click on **Edit**. Candidate: an overlay drawer, and editable-by-default for admins.
3. **Validation is mostly native browser bubbles** with no inline text. Server errors appear as ~3 s bottom-left toasts (e.g. `example.com` rejected as an invalid email). Design inline field errors and a persistent error summary.
4. **Destructive UX.** Delete is enabled with nothing selected, and its confirm text is generic ("Do you want to delete domainlist"), with no count or names. Controllers show **Stop / Restart / Commit** inline in the table row next to read data.
5. **Button colour semantics are inconsistent.** CSV and Graph use the same green as Save, Bulk Ops uses the same purple as Add, and Delete is red on every page.
6. **Long enumerations as plain selects.** Device-check OS has dozens of distro versions and Check has 24 types. Access-rule destination types (7), application types (7) and SP types are also plain selects. All need searchable comboboxes and grouping.
7. **Identity sprawl in the IA.** Authentication Profiles (8), User Providers (3) and IDAM (5) are three separate groups. Candidate: "Identity" (sources) and "Federation / IdP" (what i365 serves).
8. **Empty states.** Dashboard pies draw a full single-colour circle when there is no data, next to other tiles saying "No results found". 21 lists are empty with a bare "No results found" row and no call to action.
9. **Header.** The session timer shows ~3 h from the 180-min portal timeout. Sign out is hidden in the avatar menu. The theme toggle exists and dark mode is captured.
10. **Copy issues**: "commma", "seperated", "a Application Group", "Signin", "Add Ldap Profile".

