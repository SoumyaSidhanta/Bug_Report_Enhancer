import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from '../config.js';

const router = Router();

router.post('/test', async (req: Request, res: Response) => {
    try {
        const saved = loadSettings();
        const groqApiKey = req.body.groqApiKey || saved.groqApiKey;

        if (!groqApiKey) {
            res.status(400).json({ error: 'Groq API key is not configured. Please update Settings.' });
            return;
        }

        const groq = new Groq({ apiKey: groqApiKey });

        const chatCompletion = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: 'Respond with exactly: "Connection successful"',
                },
            ],
            max_tokens: 20,
            temperature: 0,
        });

        const responseText = chatCompletion.choices[0]?.message?.content || '';

        res.json({
            success: true,
            message: `Groq connection successful. Model responded: "${responseText.trim()}"`,
        });
    } catch (err: any) {
        console.error('Groq test error:', err);
        res.status(500).json({
            error: err?.message || 'Failed to connect to Groq',
        });
    }
});

export default router;
