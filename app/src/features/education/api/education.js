import { supabase } from '../../../lib/supabase';

export const educationService = {
    async getEducationInstitutions({ limit } = {}) {
        let query = supabase
            .from('institutions')
            .select('id, village_id, name, name_te, type, address, phone, timings, services, services_te, image_url, source, verified_on, status')
            .eq('status', 'published')
            .eq('type', 'Education')
            .order('name');

        if (limit && Number.isInteger(limit) && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getInstitutionById(id) {
        const { data, error } = await supabase
            .from('institutions')
            .select('id, village_id, name, name_te, type, address, phone, timings, services, services_te, image_url, source, verified_on, status')
            .eq('id', id)
            .eq('status', 'published')
            .limit(1);

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }
};

export default educationService;
