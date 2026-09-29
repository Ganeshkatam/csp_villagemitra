import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Compass } from 'lucide-react';
import { useAppContext } from '../../app/providers';
import { useGlobalSearch, GlobalSearch, SearchResults } from '../../features/search';

export function SearchPage() {
    const { lang, t } = useAppContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    const {
        query,
        setQuery,
        results,
        state,
        error,
        searchNow,
        clearSearch
    } = useGlobalSearch(initialQuery, { debounceMs: 300, limit: 30 });

    // Sync URL when query changes
    useEffect(() => {
        const currentInUrl = searchParams.get('q') || '';
        if (query.trim() !== currentInUrl.trim()) {
            const nextParams = new URLSearchParams(searchParams);
            if (query.trim()) {
                nextParams.set('q', query.trim());
            } else {
                nextParams.delete('q');
            }
            setSearchParams(nextParams, { replace: true });
        }
    }, [query, searchParams, setSearchParams]);

    // Sync state if user clicks Back/Forward browser history buttons
    useEffect(() => {
        const urlQ = searchParams.get('q') || '';
        if (urlQ !== query) {
            setQuery(urlQ);
        }
    }, [searchParams]);

    const handleSuggestClick = (suggestion) => {
        searchNow(suggestion);
    };

    return (
        <div className="search-page-layout">
            {/* Page Header */}
            <div className="page-header">
                <div className="container page-header-inner">
                    <div className="page-badge-row">
                        <span className="badge badge-civic">
                            <Compass size={12} style={{ marginRight: '3px' }} aria-hidden="true" />
                            {lang === 'te' ? 'సమగ్ర పౌర శోధన' : 'Universal Civic Search'}
                        </span>
                        <span className="badge badge-verified">
                            {lang === 'te' ? 'ధృవీకరించబడిన డేటాబేస్' : 'PostgreSQL Authoritative'}
                        </span>
                    </div>

                    <h1 className="page-title">
                        {lang === 'te' ? 'గ్రామ మిత్ర సమగ్ర శోధన' : 'Civic Information Search'}
                    </h1>
                    <p className="page-subtitle">
                        {lang === 'te'
                            ? 'సంక్షేమ పథకాలు, పీహెచ్‌సీ సమయాలు, వైద్యుల వివరాలు, అత్యవసర హెల్ప్‌లైన్లు మరియు స్థానిక సేవలను ఒకే చోట శోధించండి.'
                            : 'Search verified records across government welfare schemes, Primary Health Centre duty rosters, emergency contacts, local businesses, and public advisories.'
                        }
                    </p>

                    <div className="search-page-bar-wrap">
                        <GlobalSearch
                            query={query}
                            onQueryChange={setQuery}
                            onSubmit={() => searchNow(query)}
                            onClear={clearSearch}
                            isLoading={state === 'loading'}
                            placeholder={t?.searchPlaceholder || (lang === 'te' ? 'పథకాలు, సంప్రదింపులు, పీహెచ్‌సీ సమయాలు, బడులు వెతకండి...' : 'Search schemes, contacts, PHC timings, schools...')}
                            autoFocus={!initialQuery}
                            lang={lang}
                        />
                    </div>
                </div>
            </div>

            {/* Results Content Area */}
            <div className="container" style={{ paddingBottom: '4rem', marginTop: '1.5rem' }}>
                <SearchResults
                    results={results}
                    state={state}
                    error={error}
                    query={query}
                    lang={lang}
                    onSuggestClick={handleSuggestClick}
                />
            </div>
        </div>
    );
}

export default SearchPage;
