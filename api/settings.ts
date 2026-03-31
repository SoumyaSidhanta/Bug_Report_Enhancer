import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Settings are now stored in the browser's localStorage.
 * This endpoint exists only for backward compatibility.
 * GET returns empty defaults, POST is a no-op success.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        return res.json({
            jiraUrl: '',
            jiraEmail: '',
            jiraApiToken: '',
            jiraProjectKey: '',
            jiraIssueType: 'Bug',
            groqApiKey: '',
        });
    }

    if (req.method === 'POST') {
        return res.json({ success: true, message: 'Settings are saved locally in your browser.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
