import { Router, Request, Response } from 'express';
import { loadSettings } from '../config.js';

const router = Router();

/**
 * Helper: merge body credentials with file-based settings.
 * Body values take precedence (stateless-first design).
 */
function getEffectiveSettings(req: Request) {
    const saved = loadSettings();
    const body = req.body || {};
    return {
        jiraUrl: body.jiraUrl || saved.jiraUrl,
        jiraEmail: body.jiraEmail || saved.jiraEmail,
        jiraApiToken: body.jiraApiToken || saved.jiraApiToken,
        jiraProjectKey: body.jiraProjectKey || saved.jiraProjectKey,
        jiraIssueType: body.jiraIssueType || saved.jiraIssueType || 'Bug',
    };
}

// Test Jira connection
router.post('/test', async (req: Request, res: Response) => {
    try {
        const settings = getEffectiveSettings(req);
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            res.status(400).json({ error: 'Jira connection details are incomplete. Please update Settings.' });
            return;
        }

        const url = `${settings.jiraUrl.replace(/\/$/, '')}/rest/api/2/myself`;
        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({
                error: `Jira connection failed: ${response.statusText}`,
                details: errorText,
            });
            return;
        }

        const data = await response.json();
        res.json({
            success: true,
            message: `Connected successfully as ${data.displayName} (${data.emailAddress})`,
        });
    } catch (err: any) {
        console.error('Jira test error:', err);
        res.status(500).json({
            error: err?.message || 'Failed to connect to Jira',
        });
    }
});

// Convert plain text to Atlassian Document Format (ADF)
function textToADF(text: string) {
    const lines = text.split('\n');
    const content: any[] = [];

    for (const line of lines) {
        if (line.trim() === '') {
            content.push({ type: 'paragraph', content: [] });
        } else {
            content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
            });
        }
    }

    return { type: 'doc', version: 1, content };
}

// Fetch Jira projects
router.post('/projects', async (req: Request, res: Response) => {
    try {
        const settings = getEffectiveSettings(req);
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            res.status(400).json({ error: 'Jira connection details are incomplete.' });
            return;
        }

        const url = `${settings.jiraUrl.replace(/\/$/, '')}/rest/api/2/project`;
        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({
                error: `Failed to fetch projects: ${response.statusText}`,
                details: errorText,
            });
            return;
        }

        const projects: Array<{ key: string; name: string }> = await response.json();
        res.json({
            success: true,
            projects: projects.map((p) => ({ key: p.key, name: p.name })),
        });
    } catch (err: any) {
        console.error('[Jira] Fetch projects error:', err);
        res.status(500).json({ error: err?.message || 'Failed to fetch Jira projects' });
    }
});

// Create Jira issue
router.post('/create', async (req: Request, res: Response) => {
    try {
        const settings = getEffectiveSettings(req);
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            res.status(400).json({ error: 'Jira connection details are incomplete. Please update Settings.' });
            return;
        }

        const { summary, description } = req.body;
        if (!summary || !description) {
            res.status(400).json({ error: 'Summary and description are required' });
            return;
        }

        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiToken}`).toString('base64');
        const baseUrl = settings.jiraUrl.replace(/\/$/, '');

        // Try API v3 first (supports ADF), then fallback to API v2 (plain text)
        const attempts = [
            {
                label: 'API v3 (ADF)',
                url: `${baseUrl}/rest/api/3/issue`,
                body: {
                    fields: {
                        project: { key: settings.jiraProjectKey || 'SCRUM' },
                        summary: summary.substring(0, 255),
                        description: textToADF(description),
                        issuetype: { name: settings.jiraIssueType || 'Bug' },
                    },
                },
            },
            {
                label: 'API v2 (plain text)',
                url: `${baseUrl}/rest/api/2/issue`,
                body: {
                    fields: {
                        project: { key: settings.jiraProjectKey || 'SCRUM' },
                        summary: summary.substring(0, 255),
                        description: description,
                        issuetype: { name: settings.jiraIssueType || 'Bug' },
                    },
                },
            },
        ];

        let lastError = '';

        for (const attempt of attempts) {
            console.log(`[Jira] Trying ${attempt.label} at ${attempt.url}`);

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

                console.log(`[Jira] Success via ${attempt.label}! Created ${data.key}`);

                res.json({
                    success: true,
                    key: data.key,
                    id: data.id,
                    url: issueUrl,
                    message: `Jira issue ${data.key} created successfully`,
                });
                return;
            }

            const errorText = await response.text();
            console.error(`[Jira] ${attempt.label} failed (${response.status}): ${errorText}`);
            lastError = errorText;
        }

        // Both attempts failed
        let errorDetails = '';
        try {
            const parsed = JSON.parse(lastError);
            if (parsed.errors) {
                errorDetails = Object.entries(parsed.errors)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('; ');
            }
            if (parsed.errorMessages && parsed.errorMessages.length > 0) {
                errorDetails = errorDetails
                    ? `${errorDetails} | ${parsed.errorMessages.join('; ')}`
                    : parsed.errorMessages.join('; ');
            }
        } catch {
            errorDetails = lastError;
        }

        res.status(400).json({
            error: `Failed to create Jira issue: ${errorDetails || 'Bad Request'}`,
        });
    } catch (err: any) {
        console.error('[Jira] Create error:', err);
        res.status(500).json({
            error: err?.message || 'Failed to create Jira issue',
        });
    }
});

export default router;
