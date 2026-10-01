const env = (typeof import.meta !== 'undefined' && import.meta.env)
    ? import.meta.env
    : (typeof process !== 'undefined' ? process.env : {});
const DEFAULT_VILLAGE_ID = env.VITE_DEFAULT_VILLAGE_ID || '00000000-0000-0000-0000-000000000001';

export const REQUIRED_SURVEY_QUESTIONS = [
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6',
    'TECH1', 'TECH2', 'TECH3',
    'SCH1', 'SCH2', 'SCH3',
    'CON1_Panchayat', 'CON1_PHC', 'CON1_Police', 'CON1_Lineman', 'CON2',
    'HLTH1', 'EDU1', 'INFRA1',
    'BIZ1', 'BIZ2',
    'PRIO1'
];

/**
 * Validates a survey form state before submission.
 * Enforces respondent metadata, informed consent, and completeness of all required questions.
 *
 * @param {Object} formData
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateSurveyForm(formData) {
    if (!formData) {
        return { isValid: false, error: 'Form data is missing.' };
    }

    if (!formData.respondentCode || !formData.respondentCode.trim()) {
        return { isValid: false, error: 'Household ID Code is mandatory.' };
    }

    if (!formData.interviewerName || !formData.interviewerName.trim()) {
        return { isValid: false, error: 'Surveyor name or student ID is mandatory.' };
    }

    const finalLocality = formData.localityWard === 'OTHER'
        ? (formData.customLocality && formData.customLocality.trim())
        : (formData.localityWard && formData.localityWard.trim());

    if (!finalLocality) {
        return { isValid: false, error: 'Locality or ward must be selected or specified.' };
    }

    if (!formData.consentObtained) {
        return { isValid: false, error: 'Informed verbal consent is mandatory prior to recording survey responses.' };
    }

    // Verify household size is a valid positive integer
    const householdSize = parseInt(formData.D5, 10);
    if (isNaN(householdSize) || householdSize < 1 || householdSize > 30) {
        return { isValid: false, error: 'Household size (D5) must be a valid number between 1 and 30.' };
    }

    // Check all required 21 questions / 24 controls
    for (const qCode of REQUIRED_SURVEY_QUESTIONS) {
        const val = formData[qCode];
        if (val === undefined || val === null || String(val).trim() === '') {
            return { isValid: false, error: `Mandatory question ${qCode} has not been answered.` };
        }
    }

    // Check SCH4 multi-select (must have at least one selection; defaults to 'None' if empty)
    if (!formData.SCH4 || !Array.isArray(formData.SCH4) || formData.SCH4.length === 0) {
        return { isValid: false, error: 'Scheme benefit status (SCH4) must have at least one selection.' };
    }

    return { isValid: true, error: null };
}

/**
 * Assembles a normalized payload for submission to Supabase or local offline queue.
 *
 * @param {Object} formData
 * @param {string} clientUuid
 * @param {string} startTime
 * @param {string} [villageId]
 * @returns {Object} Normalized survey payload
 */
export function buildSurveyPayload(formData, clientUuid, startTime, villageId = DEFAULT_VILLAGE_ID) {
    const completedTime = new Date().toISOString();
    const finalLocality = formData.localityWard === 'OTHER'
        ? (formData.customLocality.trim() || 'General Habitation')
        : formData.localityWard;

    const answerRows = [
        // 01. Demographics
        { question_code: 'D1', answer_value: formData.D1 },
        { question_code: 'D2', answer_value: formData.D2 },
        { question_code: 'D3', answer_value: formData.D3 },
        { question_code: 'D4', answer_value: formData.D4 },
        { question_code: 'D5', answer_value: String(formData.D5) },
        { question_code: 'D6', answer_value: formData.D6 },

        // 02. Digital Connectivity
        { question_code: 'TECH1', answer_value: formData.TECH1 },
        { question_code: 'TECH2', answer_value: formData.TECH2 },
        { question_code: 'TECH3', answer_value: formData.TECH3 },

        // 03. Welfare Schemes
        { question_code: 'SCH1', answer_value: formData.SCH1 },
        { question_code: 'SCH2', answer_value: formData.SCH2 },
        { question_code: 'SCH3', answer_value: formData.SCH3 },

        // 04. Emergency Directory (4 discrete CON1 sub-codes + CON2)
        { question_code: 'CON1_Panchayat', answer_value: formData.CON1_Panchayat },
        { question_code: 'CON1_PHC', answer_value: formData.CON1_PHC },
        { question_code: 'CON1_Police', answer_value: formData.CON1_Police },
        { question_code: 'CON1_Lineman', answer_value: formData.CON1_Lineman },
        { question_code: 'CON2', answer_value: formData.CON2 },

        // 05. Healthcare & Education
        { question_code: 'HLTH1', answer_value: formData.HLTH1 },
        { question_code: 'EDU1', answer_value: formData.EDU1 },
        { question_code: 'INFRA1', answer_value: formData.INFRA1 },

        // 06. Local Livelihoods & Business Directory
        { question_code: 'BIZ1', answer_value: formData.BIZ1 },
        { question_code: 'BIZ2', answer_value: formData.BIZ2 },

        // 07. Information Priorities
        { question_code: 'PRIO1', answer_value: formData.PRIO1 }
    ];

    // Multi-select SCH4: Add a discrete normalized row per entitlement
    if (formData.SCH4 && formData.SCH4.length > 0) {
        formData.SCH4.forEach(scheme => {
            answerRows.push({ question_code: 'SCH4', answer_value: scheme });
        });
    } else {
        answerRows.push({ question_code: 'SCH4', answer_value: 'None' });
    }

    return {
        survey_client_uuid: clientUuid,
        village_id: villageId,
        respondent_code: formData.respondentCode.trim(),
        interviewer_name: formData.interviewerName.trim(),
        locality_ward: finalLocality,
        consent_obtained: Boolean(formData.consentObtained),
        notes: formData.notes && formData.notes.trim() ? formData.notes.trim() : null,
        started_at: startTime,
        completed_at: completedTime,
        answers: answerRows
    };
}
