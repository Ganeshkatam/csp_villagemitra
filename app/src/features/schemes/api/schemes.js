import { supabase } from '../../../lib/supabase';

export const SCHEME_CATEGORIES = [
    'All',
    'Agriculture',
    'Employment',
    'Housing',
    'Education',
    'Healthcare',
    'Women & Child',
    'Social Welfare'
];

export function generateSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export const schemeService = {
    getAllSchemes,
    getSchemeBySlugOrId,
    getSchemesByCategory
};

export async function getAllSchemes({ category = 'All', search = '', limit } = {}) {
    let query = supabase
        .from('schemes')
        .select('id, village_id, name, name_te, category, description, eligibility, image_url, verified_on, source, application_process, benefits, exclusions, documents, status')
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
        results = results.filter(s =>
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.name_te && s.name_te.toLowerCase().includes(q)) ||
            (s.category && s.category.toLowerCase().includes(q)) ||
            (s.description && s.description.toLowerCase().includes(q)) ||
            (s.eligibility && s.eligibility.toLowerCase().includes(q))
        );
    }

    return results;
}

export async function getSchemeBySlugOrId(identifier) {
    if (!identifier) return null;

    // Try lookup by ID first, strictly enforcing published status
    const { data: byId, error: errId } = await supabase
        .from('schemes')
        .select('id, village_id, name, name_te, category, description, eligibility, image_url, verified_on, source, application_process, benefits, exclusions, documents, status')
        .eq('id', identifier)
        .eq('status', 'published')
        .limit(1);

    if (!errId && byId && byId.length > 0) {
        return byId[0];
    }

    // Fallback: match by name slug
    const { data: all, error: errAll } = await supabase
        .from('schemes')
        .select('id, village_id, name, name_te, category, description, eligibility, image_url, verified_on, source, application_process, benefits, exclusions, documents, status')
        .eq('status', 'published');

    if (errAll) throw errAll;

    const matched = (all || []).find(s => 
        generateSlug(s.name) === identifier ||
        s.name.toLowerCase() === identifier.toLowerCase().replace(/-/g, ' ')
    );

    return matched || null;
}

export async function getSchemesByCategory(category) {
    return getAllSchemes({ category });
}

export default schemeService;
