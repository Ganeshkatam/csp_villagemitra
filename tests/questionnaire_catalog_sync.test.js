import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_SURVEY_QUESTIONS } from '../app/src/utils/surveyValidation.js';
import { SURVEY_CANONICAL_OPTIONS } from '../app/src/lib/surveyConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Questionnaire catalog invariant: all client questions and canonical options exist in database schema', () => {
    const schemaPath = path.join(rootDir, 'database', 'schema.sql');
    assert.ok(fs.existsSync(schemaPath), 'database/schema.sql must exist');

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // 1. Verify every required survey question code is registered in database schema seed
    const allExpectedCodes = [...REQUIRED_SURVEY_QUESTIONS, 'SCH4'];

    for (const qCode of allExpectedCodes) {
        assert.ok(
            schemaContent.includes(`('${qCode}',`),
            `Questionnaire invariant failure: question_code '${qCode}' is defined in application code but missing from database/schema.sql catalog seeds`
        );
    }

    // 2. Verify all option values from SURVEY_CANONICAL_OPTIONS are present in schema.sql
    const optionChecklist = [
        ...SURVEY_CANONICAL_OPTIONS.D1,
        ...SURVEY_CANONICAL_OPTIONS.D2,
        ...SURVEY_CANONICAL_OPTIONS.D3,
        ...SURVEY_CANONICAL_OPTIONS.D4,
        ...SURVEY_CANONICAL_OPTIONS.D6,
        ...SURVEY_CANONICAL_OPTIONS.TECH1,
        ...SURVEY_CANONICAL_OPTIONS.TECH2,
        ...SURVEY_CANONICAL_OPTIONS.TECH3,
        ...SURVEY_CANONICAL_OPTIONS.SCH1,
        ...SURVEY_CANONICAL_OPTIONS.SCH2,
        ...SURVEY_CANONICAL_OPTIONS.SCH3,
        ...SURVEY_CANONICAL_OPTIONS.SCH4_OPTIONS,
        ...SURVEY_CANONICAL_OPTIONS.CON2,
        ...SURVEY_CANONICAL_OPTIONS.HLTH1,
        ...SURVEY_CANONICAL_OPTIONS.EDU1,
        ...SURVEY_CANONICAL_OPTIONS.INFRA1,
        ...SURVEY_CANONICAL_OPTIONS.BIZ1,
        ...SURVEY_CANONICAL_OPTIONS.BIZ2,
        ...SURVEY_CANONICAL_OPTIONS.PRIO1
    ];

    for (const opt of optionChecklist) {
        assert.ok(
            schemaContent.includes(`"value": "${opt.value}"`) || schemaContent.includes(`"value":"${opt.value}"`),
            `Questionnaire invariant failure: option value '${opt.value}' is defined in surveyConstants.js but missing from database/schema.sql`
        );
    }
});
