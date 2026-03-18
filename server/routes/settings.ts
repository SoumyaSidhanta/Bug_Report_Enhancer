import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings, Settings } from '../config.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
    try {
        const settings = loadSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

router.post('/', (req: Request, res: Response) => {
    try {
        const settings: Settings = req.body;
        saveSettings(settings);
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

export default router;
