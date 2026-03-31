import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from '../config.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        const saved = loadSettings();
        const groqApiKey = req.body.groqApiKey || saved.groqApiKey;

        if (!groqApiKey) {
            res.status(400).json({ error: 'Groq API key is not configured. Please update Settings.' });
            return;
        }

        const { imageBase64, additionalNotes } = req.body;
        if (!imageBase64) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        // Ensure proper data URI format  
        let imageUrl: string;
        if (imageBase64.startsWith('data:')) {
            imageUrl = imageBase64;
        } else {
            imageUrl = `data:image/png;base64,${imageBase64}`;
        }

        console.log(`[Analyze] Image data URL length: ${Math.round(imageUrl.length / 1024)}KB`);
        console.log(`[Analyze] MIME type: ${imageUrl.substring(0, imageUrl.indexOf(';'))}`);
        console.log(`[Analyze] Additional notes: "${additionalNotes || 'none'}"`);

        const groq = new Groq({ apiKey: groqApiKey });

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
            top_p: 1,
            stream: false,
        });

        const analysisText =
            chatCompletion.choices[0]?.message?.content || 'No analysis generated.';

        console.log('[Analyze] Success! Analysis length:', analysisText.length);

        // Extract a summary line from the analysis
        const summaryMatch = analysisText.match(/Summary:?\s*(.+)/i);
        const summary = summaryMatch
            ? summaryMatch[1].replace(/\*+/g, '').trim().substring(0, 200)
            : 'Bug Report from Screenshot Analysis';

        res.json({
            success: true,
            summary,
            description: analysisText,
        });
    } catch (err: any) {
        console.error('[Analyze] Error:', err?.message || err);
        if (err?.error) {
            console.error('[Analyze] API error body:', JSON.stringify(err.error, null, 2));
        }

        const errorMessage = err?.error?.error?.message || err?.message || 'Failed to analyze screenshot with Groq';
        res.status(500).json({
            error: errorMessage,
        });
    }
});

export default router;
