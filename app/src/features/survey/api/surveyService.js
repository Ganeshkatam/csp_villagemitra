import { supabase as defaultSupabase } from '../../../lib/supabase.js';
import { offlineSyncManager } from '../../../lib/offlineSyncManager.js';

export const OFFLINE_SURVEY_STORAGE_KEY = 'csp_offline_surveys';

/**
 * Uploads a validated survey payload to Supabase with database-enforced idempotency.
 * 
 * 1. Checks if a record with survey_client_uuid already exists (idempotency guard).
 * 2. Inserts header record into survey_responses.
 * 3. Inserts normalized answer rows into survey_answers.
 * 
 * @param {Object} payload
 * @param {Object} [client] - Supabase client instance (defaults to app singleton)
 * @returns {Promise<{ id: string, alreadyExists: boolean, answersCount: number }>}
 */
export async function uploadSurveyPayload(payload, client = defaultSupabase) {
    if (!payload) throw new Error('Survey payload is missing.');
    const { answers, ...responseHeader } = payload;

    const clientUuid = responseHeader.survey_client_uuid || (
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            })
    );

    const rpcParams = {
        p_village_id: responseHeader.village_id,
        p_respondent_code: responseHeader.respondent_code,
        p_interviewer_name: responseHeader.interviewer_name,
        p_ward_street: responseHeader.ward_street || null,
        p_locality_ward: responseHeader.locality_ward || null,
        p_started_at: responseHeader.started_at || null,
        p_completed_at: responseHeader.completed_at || null,
        p_survey_client_uuid: clientUuid,
        p_notes: responseHeader.notes || null,
        p_answers: (answers || []).map(a => ({
            question_code: a.question_code,
            answer_value: a.answer_value,
            notes: a.notes || null
        }))
    };

    const { data, error } = await client.rpc('submit_survey', rpcParams);

    if (error) {
        throw error;
    }

    return {
        id: data.response_id,
        alreadyExists: data.already_existed,
        answersCount: data.answers_count
    };
}

export { offlineSyncManager };

/**
 * Retrieves the count of cached offline surveys from durable queue.
 * @returns {Promise<number>}
 */
export async function getOfflineSurveysCount() {
    return await offlineSyncManager.getPendingCount();
}

/**
 * Enqueues a survey payload into the durable offline queue.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function enqueueOfflineSurvey(payload) {
    return await offlineSyncManager.enqueue(payload);
}

/**
 * Synchronizes queued offline surveys to Supabase using atomic submit_survey RPC.
 * Automatically handles retry counts and dead-letter queue isolation.
 * @param {Object} [client]
 * @returns {Promise<{ successCount: number, failedCount: number, deadLetterCount: number, remainingCount: number }>}
 */
export async function syncOfflineSurveys(client = defaultSupabase) {
    return await offlineSyncManager.syncAll((p) => uploadSurveyPayload(p, client));
}

/**
 * Fetches secure, database-calculated aggregated survey analytics.
 * Anonymous clients receive high-level distributions with zero access to raw household rows,
 * respondent codes, interviewer names, or timestamps.
 * 
 * @param {string} [filterWard] - Optional ward to filter by (or 'ALL')
 * @param {Object} [client] - Supabase client instance
 * @returns {Promise<{ total_responses: number, question_distributions: Object, locality_distribution: Object }>}
 */
export async function getSurveyAnalyticsSummary(filterWard = 'ALL', client = defaultSupabase) {
    const { data, error } = await client.rpc('get_survey_analytics_summary', {
        filter_ward: filterWard
    });
    if (error) throw error;
    return data;
}
