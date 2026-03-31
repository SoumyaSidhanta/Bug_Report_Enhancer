import type { VercelRequest, VercelResponse } from '@vercel/node';

function getSettings(req: VercelRequest) {
    const body = req.body || {};
    return {
        jiraUrl: body.jiraUrl || process.env.JIRA_URL || '',
        jiraEmail: body.jiraEmail || process.env.JIRA_EMAIL || '',
        jiraApiToken: body.jiraApiToken || process.env.JIRA_API_TOKEN || '',
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = getSettings(req);
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            return res.status(400).json({ error: 'Jira connection details are incomplete.' });
        }

        const url = `${settings.jiraUrl.replace(/\/$/, '')}/rest/api/2/project`;
        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');

        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: `Failed to fetch projects: ${response.statusText}`, details: errorText });
        }

        const projects: Array<{ key: string; name: string }> = await response.json();
        return res.json({ success: true, projects: projects.map((p) => ({ key: p.key, name: p.name })) });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to fetch Jira projects' });
    }
}
