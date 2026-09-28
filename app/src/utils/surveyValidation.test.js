import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSurveyForm, buildSurveyPayload } from './surveyValidation.js';

test('validateSurveyForm enforces mandatory respondent metadata', () => {
    const invalidForm = {
        respondentCode: '',
        interviewerName: 'Student A',
        localityWard: 'Central Bazaar',
        consentObtained: true
    };
    const res = validateSurveyForm(invalidForm);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error, /Household ID Code is mandatory/);
});

test('validateSurveyForm enforces interviewer name attribution', () => {
    const invalidForm = {
        respondentCode: 'HH-100',
        interviewerName: '',
        localityWard: 'Central Bazaar',
        consentObtained: true
    };
    const res = validateSurveyForm(invalidForm);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error, /Surveyor name or student ID is mandatory/);
});

test('validateSurveyForm enforces informed consent', () => {
    const invalidForm = {
        respondentCode: 'HH-100',
        interviewerName: 'Student A',
        localityWard: 'Central Bazaar',
        consentObtained: false
    };
    const res = validateSurveyForm(invalidForm);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error, /Informed verbal consent is mandatory/);
});

test('validateSurveyForm validates household size D5 bounds', () => {
    const baseForm = {
        respondentCode: 'HH-100',
        interviewerName: 'Student A',
        localityWard: 'Central Bazaar',
        consentObtained: true,
        D1: '26-40', D2: 'Female', D3: 'Agriculture', D4: 'Secondary',
        D6: 'White-BPL-Card', TECH1: 'Yes', TECH2: '4G', TECH3: 'Independent',
        SCH1: 'Yes', SCH2: 'Yes', SCH3: 'Clear', SCH4: ['None'],
        CON1_Panchayat: 'Yes', CON1_PHC: 'Yes', CON1_Police: 'Yes', CON1_Lineman: 'Yes', CON2: 'Self',
        HLTH1: 'PHC', EDU1: 'Govt', INFRA1: 'Piped', BIZ1: 'Direct', BIZ2: 'None', PRIO1: 'Water'
    };

    const invalidD5 = validateSurveyForm({ ...baseForm, D5: '0' });
    assert.strictEqual(invalidD5.isValid, false);
    assert.match(invalidD5.error, /Household size/);

    const validD5 = validateSurveyForm({ ...baseForm, D5: '5' });
    assert.strictEqual(validD5.isValid, true);
    assert.strictEqual(validD5.error, null);
});

test('buildSurveyPayload constructs normalized response and answers', () => {
    const formData = {
        respondentCode: 'HH-050',
        interviewerName: 'Ganesh Katam',
        localityWard: 'East Weavers Colony',
        consentObtained: true,
        notes: 'Field interview conducted in afternoon',
        D1: '26-40', D2: 'Male', D3: 'Weaving', D4: 'Secondary', D5: '4', D6: 'White-BPL-Card',
        TECH1: 'Smartphone', TECH2: 'Mobile-Data-4G', TECH3: 'Independent',
        SCH1: 'Aware', SCH2: 'Enrolled', SCH3: 'Clear',
        SCH4: ['Aarogyasri', 'YSR-Rythu-Bharosa'],
        CON1_Panchayat: 'Yes', CON1_PHC: 'Yes', CON1_Police: 'No', CON1_Lineman: 'Yes', CON2: 'Panchayat-Notice',
        HLTH1: 'Denkada-PHC', EDU1: 'MPPS-Modavalasa', INFRA1: 'Panchayat-RO-Plant',
        BIZ1: 'Direct-Sale', BIZ2: 'Working-Capital', PRIO1: 'Healthcare-Access'
    };

    const clientUuid = '11111111-2222-3333-4444-555555555555';
    const startTime = '2026-09-28T10:00:00.000Z';
    const payload = buildSurveyPayload(formData, clientUuid, startTime);

    assert.strictEqual(payload.survey_client_uuid, clientUuid);
    assert.strictEqual(payload.respondent_code, 'HH-050');
    assert.strictEqual(payload.interviewer_name, 'Ganesh Katam');
    assert.strictEqual(payload.locality_ward, 'East Weavers Colony');
    assert.strictEqual(payload.consent_obtained, true);
    assert.strictEqual(payload.notes, 'Field interview conducted in afternoon');
    assert.strictEqual(payload.started_at, startTime);

    // Verify answers array includes Demographics, Tech, Directory, Schemes
    assert.ok(payload.answers.length >= 22);

    // Verify SCH4 multi-select normalization creates discrete rows
    const sch4Rows = payload.answers.filter(a => a.question_code === 'SCH4');
    assert.strictEqual(sch4Rows.length, 2);
    assert.strictEqual(sch4Rows[0].answer_value, 'Aarogyasri');
    assert.strictEqual(sch4Rows[1].answer_value, 'YSR-Rythu-Bharosa');
});
