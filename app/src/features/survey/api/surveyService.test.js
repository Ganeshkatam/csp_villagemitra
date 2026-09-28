import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSurveyPayload } from './surveyService.js';

test('uploadSurveyPayload delegates to submit_survey RPC with correctly shaped parameters', async () => {
    let capturedMethod = null;
    let capturedParams = null;

    const mockClient = {
        rpc: async (methodName, params) => {
            capturedMethod = methodName;
            capturedParams = params;
            return {
                data: {
                    success: true,
                    response_id: 'mock-response-id-1234',
                    already_existed: false,
                    answers_count: 2
                },
                error: null
            };
        }
    };

    const mockPayload = {
        survey_client_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        village_id: '99999999-9999-9999-9999-999999999999',
        respondent_code: 'HH-042',
        interviewer_name: 'Field Auditor',
        locality_ward: 'Central Bazaar',
        started_at: '2026-09-28T09:00:00Z',
        completed_at: '2026-09-28T09:15:00Z',
        notes: 'Verified verbal consent',
        answers: [
            { question_code: 'D1', answer_value: '26-40' },
            { question_code: 'D2', answer_value: 'Male' }
        ]
    };

    const result = await uploadSurveyPayload(mockPayload, mockClient);

    assert.strictEqual(capturedMethod, 'submit_survey');
    assert.strictEqual(capturedParams.p_survey_client_uuid, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    assert.strictEqual(capturedParams.p_respondent_code, 'HH-042');
    assert.strictEqual(capturedParams.p_interviewer_name, 'Field Auditor');
    assert.strictEqual(capturedParams.p_locality_ward, 'Central Bazaar');
    assert.strictEqual(capturedParams.p_answers.length, 2);

    assert.strictEqual(result.id, 'mock-response-id-1234');
    assert.strictEqual(result.alreadyExists, false);
    assert.strictEqual(result.answersCount, 2);
});

test('uploadSurveyPayload idempotently recognizes existing submissions', async () => {
    const mockClient = {
        rpc: async () => ({
            data: {
                success: true,
                response_id: 'existing-id-5678',
                already_existed: true,
                answers_count: 22
            },
            error: null
        })
    };

    const payload = {
        survey_client_uuid: 'existing-uuid-1111',
        village_id: 'mock-village',
        respondent_code: 'HH-001',
        interviewer_name: 'Auditor',
        answers: []
    };

    const result = await uploadSurveyPayload(payload, mockClient);
    assert.strictEqual(result.id, 'existing-id-5678');
    assert.strictEqual(result.alreadyExists, true);
    assert.strictEqual(result.answersCount, 22);
});

test('uploadSurveyPayload raises error when RPC fails', async () => {
    const mockClient = {
        rpc: async () => ({
            data: null,
            error: new Error('Postgres connection lost')
        })
    };

    const payload = {
        respondent_code: 'HH-001',
        interviewer_name: 'Auditor'
    };

    await assert.rejects(
        () => uploadSurveyPayload(payload, mockClient),
        /Postgres connection lost/
    );
});
