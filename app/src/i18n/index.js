import en from './en.js';
import te from './te.js';

export const I18N_DICT = { en, te };

export function getLocalized(item, field, lang = 'en') {
    if (!item) return '';
    if (lang === 'te') {
        const teField = `${field}_te`;
        if (item[teField] && item[teField].trim().length > 0) {
            return item[teField];
        }
    }
    return item[field] || '';
}

export default I18N_DICT;
