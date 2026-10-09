import { handleHealthProbe } from '../src/lib/healthCheck.js';
import { supabase } from '../src/lib/supabase.js';

/**
 * Vercel Serverless Health Check Handler
 * Routes:
 *   GET /api/health?probe=liveness  -> HTTP 200 { status: 'ok', type: 'liveness', ... }
 *   GET /api/health?probe=readiness -> HTTP 200/503 { status: 'ready'|'degraded', type: 'readiness', ... }
 */
export default async function handler(req, res) {
    const probe = req.query?.probe || (req.url?.includes('/live') ? 'liveness' : 'readiness');
    const result = await handleHealthProbe({ probe }, supabase);

    res.setHeader('Content-Type', result.headers['Content-Type']);
    res.setHeader('Cache-Control', result.headers['Cache-Control']);
    return res.status(result.statusCode).json(result.body);
}
