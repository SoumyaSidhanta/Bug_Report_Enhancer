import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, '..', 'settings.json');

export interface Settings {
    jiraUrl: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraProjectKey: string;
    jiraIssueType: string;
    groqApiKey: string;
}

const defaultSettings: Settings = {
    jiraUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
    jiraProjectKey: 'VWO',
    jiraIssueType: 'Bug',
    groqApiKey: '',
};

export function loadSettings(): Settings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return { ...defaultSettings, ...JSON.parse(data) };
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
    return { ...defaultSettings };
}

export function saveSettings(settings: Settings): void {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}
