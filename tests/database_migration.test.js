import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Database migrations are well-formed and chronologically ordered', () => {
    const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
    assert.ok(fs.existsSync(migrationsDir), 'supabase/migrations directory must exist');

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    assert.strictEqual(files.length, 15, 'Expected exactly 15 migration files matching schema_migrations');

    const expectedSequence = [
        '20260901000000_initial_schema.sql',
        '20260903091318_refined_csp_schema_v2.sql',
        '20260904161503_relax_survey_answers_unique_constraint_for_multi_select.sql',
        '20260904161517_add_survey_client_uuid_to_survey_responses.sql',
        '20260904161527_add_notes_to_survey_responses.sql',
        '20260904161537_create_village_localities_catalog.sql',
        '20260906164219_add_provenance_and_structured_address_model.sql',
        '20260928170226_phase_0_security_hardening.sql',
        '20260928170246_phase_0_villages_policy_consolidation.sql',
        '20260928173138_atomic_survey_ingestion_and_idempotency.sql',
        '20260928173256_add_citizen_feedback_abuse_guards.sql',
        '20260928180000_server_enforced_anti_abuse_and_survey_hardening.sql',
        '20260930010000_create_server_authoritative_search_portal.sql',
        '20260930020000_harden_security_definer_and_cohort_privacy.sql',
        '20261001000000_fix_create_admin_user_pgcrypto_resolution.sql'
    ].map(f => f.endsWith('.sql') ? f : f + '.sql');

    assert.deepStrictEqual(files, expectedSequence, 'Migration sequence must match expected chronological baseline');

    // Verify chronological naming: YYYYMMDDHHMMSS_<name>.sql
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const match = file.match(/^(\d{14})_(.+)\.sql$/);
        assert.ok(match, `Migration ${file} does not match required timestamp format YYYYMMDDHHMMSS_name.sql`);

        if (i > 0) {
            const prevTimestamp = files[i - 1].match(/^(\d{14})_/)[1];
            const currTimestamp = match[1];
            assert.ok(
                currTimestamp >= prevTimestamp,
                `Migrations must be chronologically ordered: ${files[i - 1]} vs ${file}`
            );
        }

        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        assert.ok(content.trim().length > 0, `Migration ${file} must not be empty`);
    }
});

test('Consolidated schema.sql contains all 16 required tables and security controls', () => {
    const schemaPath = path.join(rootDir, 'database', 'schema.sql');
    assert.ok(fs.existsSync(schemaPath), 'database/schema.sql must exist');

    const content = fs.readFileSync(schemaPath, 'utf-8');

    const requiredTables = [
        'villages',
        'admin_users',
        'village_localities',
        'survey_questions',
        'survey_responses',
        'survey_answers',
        'schemes',
        'contacts',
        'institutions',
        'businesses',
        'announcements',
        'citizen_feedback',
        'clinical_schedules',
        'immunization_schedules',
        'diagnostic_services',
        'search_aliases'
    ];

    for (const table of requiredTables) {
        assert.ok(
            content.includes(`TABLE IF NOT EXISTS public.${table}`) ||
            content.includes(`TABLE IF NOT EXISTS ${table}`),
            `schema.sql must define table ${table}`
        );
    }

    // Verify security_invoker on analytical view
    assert.ok(
        content.includes('security_invoker = true'),
        'schema.sql must set security_invoker = true on view_survey_metric_counts'
    );

    // Verify search_path pinning
    assert.ok(
        content.includes("search_path TO 'public', 'pg_temp'"),
        'schema.sql must pin search_path on public functions'
    );

    // Verify submit_survey atomic ingestion RPC
    assert.ok(
        content.includes('FUNCTION public.submit_survey('),
        'schema.sql must define submit_survey RPC'
    );

    // Verify search_portal RPC and search_normalization function
    assert.ok(
        content.includes('FUNCTION public.search_portal('),
        'schema.sql must define search_portal RPC'
    );
    assert.ok(
        content.includes('FUNCTION public.search_normalization('),
        'schema.sql must define search_normalization function'
    );

    // Verify citizen feedback abuse prevention check constraint and server trigger
    assert.ok(
        content.includes('chk_citizen_feedback_message_length'),
        'schema.sql must define chk_citizen_feedback_message_length check constraint'
    );
    assert.ok(
        content.includes('enforce_citizen_feedback_abuse_guards'),
        'schema.sql must define enforce_citizen_feedback_abuse_guards trigger function'
    );

    // Verify zero insecure admin policies
    assert.strictEqual(
        content.includes('"Admin manage villages"\n  ON public.villages FOR ALL\n  TO authenticated\n  USING (true)'),
        false,
        'schema.sql must not contain insecure admin policy with USING (true)'
    );

    // Verify zero emojis rule
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(
        emojiRegex.test(content),
        false,
        'schema.sql must strictly contain zero emojis'
    );
});
