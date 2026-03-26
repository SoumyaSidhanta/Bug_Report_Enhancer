import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSettings, setSettings } from './_lib/settings_util';

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
