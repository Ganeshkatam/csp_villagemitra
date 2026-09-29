import { supabase } from '../../../lib/supabase';

export const announcementService = {
    async getAnnouncements({ limit } = {}) {
        let query = supabase
            .from('announcements')
            .select('id, village_id, title, title_te, category, description, priority, event_date, source, verified_on, image_url, status')
            .eq('status', 'published')
            .order('event_date', { ascending: true });

        if (limit && Number.isInteger(limit) && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getAnnouncementById(id) {
        const { data, error } = await supabase
            .from('announcements')
            .select('id, village_id, title, title_te, category, description, priority, event_date, source, verified_on, image_url, status')
            .eq('id', id)
            .eq('status', 'published')
            .limit(1);

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }
};

export default announcementService;
