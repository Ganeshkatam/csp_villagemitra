import { supabase } from '../../../lib/supabase';

export const BUSINESS_CATEGORIES = [
    'All',
    'Dairy & Agriculture',
    'Handloom & Textiles',
    'Electrical & Repair',
    'Transport & Logistics'
];

export const businessService = {
    async getBusinesses({ category = 'All', search = '', limit } = {}) {
        let query = supabase
            .from('businesses')
            .select('id, village_id, name, name_te, category, owner_name, phone, address, services, services_te, image_url, source, verified_on, status')
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
            results = results.filter(b =>
                (b.name && b.name.toLowerCase().includes(q)) ||
                (b.name_te && b.name_te.toLowerCase().includes(q)) ||
                (b.owner_name && b.owner_name.toLowerCase().includes(q)) ||
                (b.services && b.services.toLowerCase().includes(q)) ||
                (b.category && b.category.toLowerCase().includes(q))
            );
        }

        return results;
    }
};

export default businessService;
