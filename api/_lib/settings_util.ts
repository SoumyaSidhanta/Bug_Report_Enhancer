import type { VercelRequest } from '@vercel/node';

// In-memory settings for the current function instance
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
