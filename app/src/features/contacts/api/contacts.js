import { supabase } from '../../../lib/supabase';

export const CONTACT_CATEGORIES = [
    'All',
    'Emergency',
    'Administration',
    'Healthcare',
    'Police',
    'Utilities',
    'Other Services'
];

export const contactService = {
    async getContacts({ category = 'All', search = '', limit } = {}) {
        let query = supabase
            .from('contacts')
            .select('id, village_id, name, name_te, designation, designation_te, category, phone, address, availability, source, verified_on, jurisdiction, status')
            .eq('status', 'published')
            .order('name');

        if (category && category !== 'All') {
            query = query.eq('category', category);
        }

        if (limit && Number.isInteger(limit) && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;

        let results = data || [];
        if (search && search.trim().length > 0) {
            const q = search.toLowerCase().trim();
            results = results.filter(c =>
                (c.name && c.name.toLowerCase().includes(q)) ||
                (c.name_te && c.name_te.toLowerCase().includes(q)) ||
                (c.designation && c.designation.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q)) ||
                (c.category && c.category.toLowerCase().includes(q))
            );
        }

        return results;
    },

    async getEmergencyHelplines() {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('status', 'published')
            .in('phone', ['108', '100', '104', '1912'])
            .order('phone');

        if (!error && data && data.length > 0) {
            return data;
        }

        // Default verified helplines fallback
        return [
            { id: '108', name: '108 Emergency Ambulance', phone: '108', category: 'Emergency', source: 'AP Health Dept', verified_on: '2026-09-01' },
            { id: '100', name: '100 Police Emergency', phone: '100', category: 'Emergency', source: 'AP Police', verified_on: '2026-09-01' },
            { id: '104', name: '104 Health Advisory', phone: '104', category: 'Healthcare', source: 'AP Health Dept', verified_on: '2026-09-01' },
            { id: '1912', name: '1912 Electricity Helpline', phone: '1912', category: 'Utilities', source: 'APEPDCL', verified_on: '2026-09-06' }
        ];
    }
};

export default contactService;
