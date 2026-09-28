# Database Architecture & Supabase Specification

## 1. Overview
The database backend for the Village Information Portal is built on **Supabase PostgreSQL (Postgres 15+)**. It supports both the **Field Survey & Dashboard** and the **Public Village Information Portal** with academic rigor, respondent privacy, publication lifecycle management, cryptographic access controls, and Row Level Security (RLS).

All database schema evolutions are managed as reproducible, ordered migrations in `supabase/migrations/` and track 1:1 with the live production Supabase deployment.

---

## 2. Table Architecture & Traceability

The database schema comprises 14 relational tables in the `public` schema:

| Table Name | Primary Function | RLS Security Model | Maps to Portal Component |
| :--- | :--- | :--- | :--- |
| `villages` | Master habitation metadata and profile | Public: Read<br>Admin: Write/Update/Delete (`is_admin()`) | Module 1: Village Profile |
| `admin_users` | Verified administrative accounts | Self: `auth.uid()` lookup only<br>Admin: Managed via secure RPC | Security & Access Control |
| `village_localities` | Cadastral localities and ward catalog | Public: Read<br>Admin: Manage | Survey & Demographic Filter |
| `survey_questions` | Standardized questionnaire specification | Public: Read<br>Admin: Manage | Field Survey Instrument |
| `survey_responses` | Pseudonymous household interview sessions | Public: Insert (`consent_obtained = true`)<br>Admin: Full CRUD | Field Survey Collection |
| `survey_answers` | Normalized question-code to answer pairs | Public: Insert<br>Admin: Full CRUD | Field Survey Collection |
| `schemes` | Verified welfare programs | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Module 2: Welfare Schemes |
| `contacts` | Emergency and administration directory | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Module 3: Important Contacts |
| `institutions` | Schools, Anganwadis, and PHC facilities | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Module 4: Education & Healthcare |
| `businesses` | Local artisans, mechanics, shops, and SHGs | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Module 5: Local Economy |
| `announcements` | Verified public notices (Grama Sabha, camps) | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Module 6: Important Notices |
| `citizen_feedback` | Public grievance and listing requests | Public: Insert only<br>Admin: Full CRUD & status update | Citizen Feedback Loop |
| `clinical_schedules` | PHC doctor OPD duty rosters and clinics | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Clinical Services |
| `immunization_schedules` | Maternal and child immunization drives | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | Public Health Immunization |
| `diagnostic_services` | Laboratory tests and diagnostic availability | Public: `status = 'published'` only<br>Admin: All statuses (`is_admin()`) | NHM Free Diagnostics |

---

## 3. Privacy & Respondent Identity Specification

The survey schema enforces **pseudonymous household data collection without direct resident PII**:
- **Excluded**: Resident names, personal phone numbers, Aadhaar numbers, and street door numbers are strictly prohibited.
- **Included**: Pseudonymous household identifier (e.g. `HH-001`), interviewer attribution (the student surveyor name for academic auditability), optional broad locality/ward, interview duration timestamps (`started_at`, `completed_at`), and an idempotency token (`survey_client_uuid`).

---

## 4. Security Architecture & RLS Enforcement

1. **Role-Based Authorization (`is_admin()`)**:
   Administrative privileges are verified server-side through the `public.is_admin()` function, which validates that the caller holds an authenticated session and is registered in `public.admin_users`. Client-side role claims are never trusted.

2. **Immutable Function Search Paths**:
   All public functions and triggers enforce `SET search_path TO 'public', 'pg_temp'` to prevent search-path hijacking attacks.

3. **Restricted Administrative RPCs**:
   Sensitive administrative functions (`create_admin_user`, `get_admin_users`) have execute permissions revoked from `anon` and `PUBLIC`.

4. **Public Read Filtering**:
   All civic information tables (`schemes`, `contacts`, `institutions`, `businesses`, `announcements`, `clinical_schedules`, `immunization_schedules`, `diagnostic_services`) enforce `status = 'published'` for anonymous and non-admin queries.

5. **Security Invoker Analytical Views**:
   The analytical view `public.view_survey_metric_counts` is created with `security_invoker = true`, ensuring queries execute with the permissions of the invoking user rather than bypassing RLS.

---

## 5. Migration Management & Source of Truth

Database schema migrations are located in `supabase/migrations/`:

```text
supabase/migrations/
├── 20260901000000_initial_schema.sql
├── 20260903091318_refined_csp_schema_v2.sql
├── 20260904161503_relax_survey_answers_unique_constraint_for_multi_select.sql
├── 20260904161517_add_survey_client_uuid_to_survey_responses.sql
├── 20260904161527_add_notes_to_survey_responses.sql
├── 20260904161537_create_village_localities_catalog.sql
├── 20260906164219_add_provenance_and_structured_address_model.sql
├── 20260928170226_phase_0_security_hardening.sql
├── 20260928170246_phase_0_villages_policy_consolidation.sql
├── 20260928173138_atomic_survey_ingestion_and_idempotency.sql
├── 20260928173256_add_citizen_feedback_abuse_guards.sql
└── 20260928180000_server_enforced_anti_abuse_and_survey_hardening.sql
```

The consolidated schema baseline is also maintained at `database/schema.sql` for single-script execution and local test database provisioning. Every migration corresponds 1:1 to an applied migration version in `supabase_migrations.schema_migrations`.
