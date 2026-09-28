import { supabase, DEFAULT_VILLAGE_ID } from '../../../lib/supabase.js';
import { offlineQueue } from '../../../lib/offlineQueue.js';

const FEEDBACK_COOLDOWN_MS = 30000; // 30 seconds
const LAST_SUBMIT_KEY = 'csp_last_feedback_submission';

export const feedbackService = {
    async submitFeedback(feedbackData) {
        if (!feedbackData) throw new Error('Feedback data is required.');

        const message = (feedbackData.message || feedbackData.description || '').trim();
        if (message.length < 10) {
            throw new Error('Please provide at least 10 characters describing your request or feedback.');
        }
        if (message.length > 2000) {
            throw new Error('Feedback message cannot exceed 2000 characters.');
        }

        // Anti-abuse rate limiting check
        if (typeof localStorage !== 'undefined') {
            const lastSubmit = localStorage.getItem(LAST_SUBMIT_KEY);
            if (lastSubmit) {
                const elapsed = Date.now() - parseInt(lastSubmit, 10);
                if (elapsed < FEEDBACK_COOLDOWN_MS) {
                    const remainingSec = Math.ceil((FEEDBACK_COOLDOWN_MS - elapsed) / 1000);
                    throw new Error(`Please wait ${remainingSec} seconds before submitting additional feedback.`);
                }
            }
        }

        const currentYear = new Date().getFullYear();
        const randNum = Math.floor(10000 + Math.random() * 90000);
        const refId = `VM-FB-${currentYear}-${randNum}`;

        const payload = {
            village_id: feedbackData.village_id || DEFAULT_VILLAGE_ID,
            reference_id: refId,
            name: (feedbackData.name || '').trim() || 'Anonymous Resident',
            phone: (feedbackData.phone || '').trim() || null,
            feedback_type: feedbackData.category || feedbackData.feedback_type || 'General',
            message: message,
            status: 'Pending'
        };

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            offlineQueue.enqueue({ type: 'feedback', data: payload });
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(LAST_SUBMIT_KEY, Date.now().toString());
            }
            return { offline: true, success: true, reference_id: refId };
        }

        try {
            const res = await supabase.from('citizen_feedback').insert([payload]);

            if (res.error) {
                console.warn('Citizen feedback insertion note, queuing offline:', res.error);
                offlineQueue.enqueue({ type: 'feedback', data: payload });
                return { offline: true, success: true, reference_id: refId };
            }

            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(LAST_SUBMIT_KEY, Date.now().toString());
            }
            return { success: true, reference_id: refId };
        } catch (err) {
            console.warn('Network error during feedback submit, queuing offline:', err);
            offlineQueue.enqueue({ type: 'feedback', data: payload });
            return { offline: true, success: true, reference_id: refId };
        }
    },

    /**
     * Privacy-preserving public lookup of feedback / grievance status.
     * Invokes secure database function that returns strictly status metadata.
     * Contains zero PII (no citizen name, phone, or raw message).
     */
    async checkFeedbackStatus(referenceId) {
        if (!referenceId || typeof referenceId !== 'string') {
            throw new Error('Please enter a valid Reference ID.');
        }

        const { data, error } = await supabase.rpc('check_feedback_status', {
            p_reference_id: referenceId.trim()
        });

        if (error) throw error;
        return data;
    },

    async getFeedbackList() {
        let { data, error } = await supabase
            .from('citizen_feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !data) {
            data = [];
        }

        return data || [];
    }
};

export default feedbackService;
