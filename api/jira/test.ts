import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRequestSettings } from '../settings';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = getRequestSettings(req);
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            return res.status(400).json({ error: 'Jira connection details are incomplete. Please update Settings.' });
        }

        const url = `${settings.jiraUrl.replace(/\/$/, '')}/rest/api/2/myself`;
        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');

        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: `Jira connection failed: ${response.statusText}`, details: errorText });
        }

        const data = await response.json();
        return res.json({ success: true, message: `Connected successfully as ${data.displayName} (${data.emailAddress})` });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to connect to Jira' });
    }
}
