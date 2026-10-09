# CSP VillageMitra — Secret & Credential Lifecycle Runbook

## 1. Overview
This document specifies the lifecycle management, exposure containment, and zero-downtime rotation protocol for all cryptographic secrets and credentials utilized by CSP VillageMitra.

---

## 2. Credential Inventory

| Secret Name | Location | Sensitivity | Blast Radius |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel Environment, `app/.env` | Public / Non-secret | API endpoint routing |
| `VITE_SUPABASE_ANON_KEY` | Vercel Environment, `app/.env` | Public (Client-side) | Anonymous read access & rate-limited submissions |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Vault (Never in git) | Critical / Private | Bypasses all Row-Level Security policies |
| `SUPABASE_JWT_SECRET` | Supabase Dashboard | Critical / Private | Signs all authentication and role claim tokens |
| `DATABASE_PASSWORD` | Supabase Dashboard | Critical / Private | Direct PostgreSQL superuser connection |

---

## 3. Zero-Downtime Rotation Protocols

### Protocol A: Anonymous Key Rotation
1. **Generate New Key**: In the Supabase Dashboard (`Project Settings -> API`), generate a new JWT secret and anon key pair.
2. **Dual-Key Window**: The previous key remains valid during the transition period configured in the dashboard.
3. **Update Vercel**:
   ```bash
   vercel env add VITE_SUPABASE_ANON_KEY production
   ```
4. **Trigger Atomic Redeployment**: Trigger a production build in Vercel to compile client bundles with the updated anon key.
5. **Revoke Previous Key**: Confirm via Vercel analytics that previous client sessions have reloaded, then deactivate the legacy key in the Supabase Dashboard.

### Protocol B: Database Superuser Password Rotation
1. **Generate High-Entropy Password**: Generate 32+ character alphanumeric string with symbols.
2. **Update in Supabase**: Update the database password under `Project Settings -> Database -> Database password`.
3. **Update Migration / CI Secrets**: If GitHub Actions uses direct connection strings, update the corresponding repository secret `SUPABASE_DB_PASSWORD`.
4. **Verify Connectivity**: Run `node --test tests/*.test.js` against the updated instance.

---

## 4. Exposure & Compromise Containment
If any service key or repository secret is suspected of exposure:
1. Immediately revoke the affected key in Supabase Dashboard.
2. Review Supabase Auth and PostgREST logs for anomalous access patterns (`Project Settings -> Logs`).
3. Rotate all associated secrets following Protocol A or B.
4. Redeploy the frontend application immediately.
