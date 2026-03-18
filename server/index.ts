import express from 'express';
import cors from 'cors';
import settingsRouter from './routes/settings.js';
import analyzeRouter from './routes/analyze.js';
import jiraRouter from './routes/jira.js';
import groqRouter from './routes/groq.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/settings', settingsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/jira', jiraRouter);
app.use('/api/groq', groqRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Bug Report Enhancer API running at http://localhost:${PORT}`);
});
