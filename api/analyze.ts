import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { getRequestSettings } from './settings';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = getRequestSettings(req);
        if (!settings.groqApiKey) {
            return res.status(400).json({ error: 'Groq API key is not configured. Please update Settings.' });
        }

        const { imageBase64, additionalNotes } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'No image provided' });
        }

        let imageUrl: string;
        if (imageBase64.startsWith('data:')) {
            imageUrl = imageBase64;
        } else {
            imageUrl = `data:image/png;base64,${imageBase64}`;
        }

        const groq = new Groq({ apiKey: settings.groqApiKey });

        const promptText = `You are an expert QA engineer. Analyze this screenshot for bugs, issues, or defects.
Generate a structured bug report with the following sections:
- Summary: A concise one-line summary of the bug
- Description: Detailed description of what is seen in the screenshot
- Steps to Reproduce: Likely steps that led to this state
- Expected Behavior: What should have happened
- Actual Behavior: What actually happened (as seen in the screenshot)
- Severity: Critical / Major / Minor / Trivial

${additionalNotes ? `Additional context from the reporter: "${additionalNotes}"` : ''}

Format the output as plain text suitable for a Jira ticket description.`;

        const chatCompletion = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: promptText },
                        { type: 'image_url', image_url: { url: imageUrl } },
                    ],
                },
            ],
            max_tokens: 2048,
            temperature: 0.3,
        });

        const analysisText = chatCompletion.choices[0]?.message?.content || 'No analysis generated.';

        const summaryMatch = analysisText.match(/Summary:?\s*(.+)/i);
        const summary = summaryMatch
            ? summaryMatch[1].replace(/\*+/g, '').trim().substring(0, 200)
            : 'Bug Report from Screenshot Analysis';

        return res.json({ success: true, summary, description: analysisText });
    } catch (err: any) {
        console.error('[Analyze] Error:', err?.message || err);
        const errorMessage = err?.error?.error?.message || err?.message || 'Failed to analyze screenshot with Groq';
        return res.status(500).json({ error: errorMessage });
    }
}
