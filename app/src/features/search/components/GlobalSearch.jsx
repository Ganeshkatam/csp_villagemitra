import React, { useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export function GlobalSearch({
    query = '',
    onQueryChange,
    onSubmit,
    onClear,
    isLoading = false,
    placeholder = 'Search schemes, contacts, PHC timings, schools...',
    autoFocus = false,
    lang = 'en'
}) {
    const inputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSubmit) {
            onSubmit(query);
        }
    };

    const handleClear = () => {
        if (onClear) {
            onClear();
        }
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            handleClear();
        }
    };

    return (
        <form role="search" onSubmit={handleSubmit} className="global-search-form">
            <div className="global-search-input-wrap">
                <label htmlFor="global-search-input" className="sr-only">
                    {lang === 'te' ? 'గ్రామ మిత్ర సమగ్ర శోధన' : 'Search Village Mitra portal'}
                </label>

                <div className="global-search-icon" aria-hidden="true">
                    {isLoading ? (
                        <Loader2 size={18} className="animate-spin text-blue" />
                    ) : (
                        <Search size={18} />
                    )}
                </div>

                <input
                    ref={inputRef}
                    id="global-search-input"
                    type="search"
                    className="global-search-input"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoComplete="off"
                    autoFocus={autoFocus}
                    maxLength={100}
                    aria-describedby="global-search-hint"
                />

                {query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="global-search-clear-btn"
                        title={lang === 'te' ? 'శోధనను తొలగించండి' : 'Clear search text'}
                        aria-label={lang === 'te' ? 'శోధనను తొలగించండి' : 'Clear search text'}
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                )}

                <button
                    type="submit"
                    className="global-search-submit-btn"
                    aria-label={lang === 'te' ? 'వెతకండి' : 'Search'}
                >
                    <span>{lang === 'te' ? 'వెతకండి' : 'Search'}</span>
                </button>
            </div>

            <div id="global-search-hint" className="sr-only">
                Type terms to search across all public civic records. Press Escape to clear.
            </div>
        </form>
    );
}

export default GlobalSearch;
