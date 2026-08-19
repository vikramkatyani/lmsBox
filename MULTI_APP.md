# Multi-tenancy (single app)

lmsBox is a **single application** with **shared-database multi-tenancy**.

## Hierarchy

```
SuperAdmin (platform)
  └── Tenant
        ├── TenantAdmin
        └── Organisation(s)  — one (default) or many when AllowsMultipleOrganisations
              ├── OrgAdmin
              └── Learners / courses / content
```

| Role | Scope |
|------|--------|
| SuperAdmin | No tenant/org. Creates tenants, global library. |
| TenantAdmin | One tenant. Manages organisations and OrgAdmins. Also OrgAdmin on primary org for day-to-day admin. |
| OrgAdmin | One organisation. |
| Learner | One organisation. |

## Logging in

- **Super Admin:** `/superadmin/login`
- **Tenant users:** `/t/{tenant-code}/login` (for example `/t/bifa/login`)
- Same email can exist in multiple tenants; each account only works on that tenant's login URL
- Tenant branding is edited in **Theme studio** (logo, favicon, login image, colours, font). Custom CSS is optional. Default LMS Box theme is used when none is set.

## Deployable stack

- API: `lmsBox.Server`
- UI: `lmsbox.client`

`glc.Server` / `glc.client` are **legacy multi-app hosts** and are not the tenancy model. Prefer creating a GLC (or any brand) as a **Tenant** in the shared lmsBox database. UI theme keys in `lmsbox.client/src/theme/tenants.json` are **branding only**, not data tenants.

## Local development

```bash
dotnet run --project lmsBox.Server
cd lmsbox.client && npm run dev
```

EF migrations run against the lmsBox database (`lmsbox.infrastructure`).

## Related docs

- Super Admin / tenant setup: see `SUPERADMIN_SETUP.md`
- Historical multi-app notes: projects remain in the solution for compatibility but tenancy is not per-host DB.
