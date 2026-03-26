export default function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
        success: true,
        message: 'Vanilla JS API is working!',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    }));
}
