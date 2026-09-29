import { supabase } from '../../../lib/supabase';

export const healthcareService = {
    async getHealthcareFacilities({ limit } = {}) {
        let query = supabase
            .from('institutions')
            .select('id, village_id, name, name_te, type, address, phone, timings, services, facilities, staff_count, source, verified_on, status')
            .eq('status', 'published')
            .eq('type', 'PHC')
            .order('name');

        if (limit && Number.isInteger(limit) && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getHealthcareContacts() {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('status', 'published')
            .eq('category', 'Healthcare')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async getHealthcareSchemes() {
        const { data, error } = await supabase
            .from('schemes')
            .select('*')
            .eq('status', 'published')
            .eq('category', 'Healthcare')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async getHealthcareAnnouncements() {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('status', 'published')
            .in('category', ['Health Camp', 'Health Advisory', 'Healthcare'])
            .order('event_date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getClinicalSchedules() {
        const { data, error } = await supabase
            .from('clinical_schedules')
            .select('*')
            .eq('status', 'published')
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async getImmunizationSchedules() {
        const { data, error } = await supabase
            .from('immunization_schedules')
            .select('*')
            .eq('status', 'published')
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async getDiagnosticServices() {
        const { data, error } = await supabase
            .from('diagnostic_services')
            .select('*')
            .eq('status', 'published')
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async getFacilityById(id) {
        const { data, error } = await supabase
            .from('institutions')
            .select('id, village_id, name, name_te, type, address, phone, timings, services, facilities, staff_count, source, verified_on, status')
            .eq('id', id)
            .eq('status', 'published')
            .limit(1);

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }
};

export default healthcareService;
