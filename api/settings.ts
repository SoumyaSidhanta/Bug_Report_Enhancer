import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory settings for serverless (on Vercel, use env vars or a DB in production)
// For local dev, falls back to the Express server
let memorySettings: Record<string, string> = {};

export function getSettings() {
    return {
        jiraUrl: process.env.JIRA_URL || memorySettings.jiraUrl || '',
        jiraEmail: process.env.JIRA_EMAIL || memorySettings.jiraEmail || '',
        jiraApiToken: process.env.JIRA_API_TOKEN || memorySettings.jiraApiToken || '',
        jiraProjectKey: process.env.JIRA_PROJECT_KEY || memorySettings.jiraProjectKey || '',
        jiraIssueType: process.env.JIRA_ISSUE_TYPE || memorySettings.jiraIssueType || 'Bug',
        groqApiKey: process.env.GROQ_API_KEY || memorySettings.groqApiKey || '',
    };
}

export function getRequestSettings(req: VercelRequest) {
    const body = req.body || {};
    const settings = getSettings();

    return {
        jiraUrl: body.jiraUrl || settings.jiraUrl,
        jiraEmail: body.jiraEmail || settings.jiraEmail,
        jiraApiToken: body.jiraApiToken || settings.jiraApiToken,
        jiraProjectKey: body.jiraProjectKey || settings.jiraProjectKey,
        jiraIssueType: body.jiraIssueType || settings.jiraIssueType,
        groqApiKey: body.groqApiKey || settings.groqApiKey,
    };
}

export function setSettings(settings: Record<string, string>) {
    memorySettings = { ...memorySettings, ...settings };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        return res.json(getSettings());
    }

    if (req.method === 'POST') {
        const body = req.body;
        setSettings(body);
        return res.json({ success: true, message: 'Settings saved (in-memory for this session)' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
