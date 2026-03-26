import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { getRequestSettings } from '../settings';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = getRequestSettings(req);
        if (!settings.groqApiKey) {
            return res.status(400).json({ error: 'Groq API key is not configured. Please update Settings.' });
        }

        const groq = new Groq({ apiKey: settings.groqApiKey });

        const chatCompletion = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{ role: 'user', content: 'Respond with exactly: "Connection successful"' }],
            max_tokens: 20,
            temperature: 0,
        });

        const responseText = chatCompletion.choices[0]?.message?.content || '';
        return res.json({ success: true, message: `Groq connection successful. Model responded: "${responseText.trim()}"` });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Failed to connect to Groq' });
    }
}
