/**
 * @typedef {Object} SearchResult
 * @property {'scheme'|'contact'|'healthcare'|'education'|'business'|'announcement'|'diagnostic_service'|'clinical_schedule'|'immunization_schedule'} entity_type
 * @property {string} entity_id Stable UUID of the entity
 * @property {string} title Primary title in English
 * @property {string|null} title_te Primary title in Telugu
 * @property {string|null} subtitle Secondary descriptive summary
 * @property {string} category Domain classification badge
 * @property {string} url Deep navigation link
 * @property {number} score Relevance score (0.0 to 1.0)
 * @property {string|null} verified_at Provenance verification date
 * @property {string|null} [phone] Contact phone number if applicable
 */

export { searchService, searchPortal, normalizeQuery } from './api/search';
export { useGlobalSearch } from './hooks/useGlobalSearch';
export { GlobalSearch } from './components/GlobalSearch';
export { SearchResults } from './components/SearchResults';
export { SearchResultGroup } from './components/SearchResultGroup';
