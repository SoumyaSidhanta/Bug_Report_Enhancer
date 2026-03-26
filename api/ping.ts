import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    return res.json({
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        env: {
            nodeVersion: process.version,
        }
    });
}
