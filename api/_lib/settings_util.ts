import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Extract settings from the request body.
 * This is a purely stateless approach — credentials are always
 * sent from the frontend in the request body.
 * Falls back to environment variables if body values are missing.
 */
export function getRequestSettings(req: VercelRequest) {
    const body = req.body || {};

    return {
        jiraUrl: body.jiraUrl || process.env.JIRA_URL || '',
        jiraEmail: body.jiraEmail || process.env.JIRA_EMAIL || '',
        jiraApiToken: body.jiraApiToken || process.env.JIRA_API_TOKEN || '',
        jiraProjectKey: body.jiraProjectKey || process.env.JIRA_PROJECT_KEY || '',
        jiraIssueType: body.jiraIssueType || process.env.JIRA_ISSUE_TYPE || 'Bug',
        groqApiKey: body.groqApiKey || process.env.GROQ_API_KEY || '',
    };
}
