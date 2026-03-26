import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRequestSettings } from '../settings';

// Convert plain text to Atlassian Document Format
function textToADF(text: string) {
    const lines = text.split('\n');
    const content: any[] = [];
    for (const line of lines) {
        content.push({
            type: 'paragraph',
            content: line.trim() ? [{ type: 'text', text: line }] : [],
        });
    }
    return { type: 'doc', version: 1, content };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = getRequestSettings(req);
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            return res.status(400).json({ error: 'Jira connection details are incomplete. Please update Settings.' });
        }

        const { summary, description } = req.body;
        if (!summary || !description) {
            return res.status(400).json({ error: 'Summary and description are required' });
        }

        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');
        const baseUrl = settings.jiraUrl.replace(/\/$/, '');

        // Try API v3 (ADF) first, then v2 (plain text)
        const attempts = [
            {
                label: 'API v3',
                url: `${baseUrl}/rest/api/3/issue`,
                body: {
                    fields: {
                        project: { key: settings.jiraProjectKey },
                        summary: summary.substring(0, 255),
                        description: textToADF(description),
                        issuetype: { name: settings.jiraIssueType || 'Bug' },
                    },
                },
            },
            {
                label: 'API v2',
                url: `${baseUrl}/rest/api/2/issue`,
                body: {
                    fields: {
                        project: { key: settings.jiraProjectKey },
                        summary: summary.substring(0, 255),
                        description: description,
                        issuetype: { name: settings.jiraIssueType || 'Bug' },
                    },
                },
            },
        ];

        let lastError = '';
        for (const attempt of attempts) {
            const response = await fetch(attempt.url, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(attempt.body),
            });

            if (response.ok) {
                const data = await response.json();
                const issueUrl = `${baseUrl}/browse/${data.key}`;
                return res.json({ success: true, key: data.key, id: data.id, url: issueUrl, message: `Jira issue ${data.key} created successfully` });
            }
            lastError = await response.text();
        }

        let errorDetails = '';
        try {
            const parsed = JSON.parse(lastError);
            if (parsed.errors) errorDetails = Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`).join('; ');
            if (parsed.errorMessages?.length) errorDetails = errorDetails ? `${errorDetails} | ${parsed.errorMessages.join('; ')}` : parsed.errorMessages.join('; ');
        } catch { errorDetails = lastError; }

        return res.status(400).json({ error: `Failed to create Jira issue: ${errorDetails || 'Bad Request'}` });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to create Jira issue' });
    }
}
