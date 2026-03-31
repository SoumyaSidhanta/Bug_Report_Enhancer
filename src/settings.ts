import { showToast } from './app';

interface Settings {
    jiraUrl: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraProjectKey: string;
    jiraIssueType: string;
    groqApiKey: string;
}

interface JiraProject {
    key: string;
    name: string;
}

const SETTINGS_STORAGE_KEY = 'bug-report-enhancer-settings';

// ===== localStorage-based Settings =====
export function loadSettingsFromStorage(): Settings {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch {
        // Corrupted storage, ignore
    }
    return {
        jiraUrl: '',
        jiraEmail: '',
        jiraApiToken: '',
        jiraProjectKey: '',
        jiraIssueType: 'Bug',
        groqApiKey: '',
    };
}

function saveSettingsToStorage(settings: Settings): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Storage full or blocked, ignore
    }
}

// ===== Safe JSON Response Parser =====
async function safeJsonParse(res: Response): Promise<{ ok: boolean; status: number; data: any }> {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await res.text();
        return {
            ok: false,
            status: res.status,
            data: { error: text || `Server returned status ${res.status}` },
        };
    }

    try {
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
    } catch {
        return {
            ok: false,
            status: res.status,
            data: { error: 'Server returned an invalid response. Please try again.' },
        };
    }
}

export function initSettings(): void {
    const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
    const modal = document.getElementById('settings-modal') as HTMLDivElement;
    const modalCloseBtn = document.getElementById('modal-close') as HTMLButtonElement;
    const saveBtn = document.getElementById('save-settings-btn') as HTMLButtonElement;

    // Inputs
    const jiraUrl = document.getElementById('jira-url') as HTMLInputElement;
    const jiraEmail = document.getElementById('jira-email') as HTMLInputElement;
    const jiraApiToken = document.getElementById('jira-api-token') as HTMLInputElement;
    const jiraProjectSelect = document.getElementById('jira-project') as HTMLSelectElement;
    const jiraIssueType = document.getElementById('jira-issue-type') as HTMLInputElement;
    const groqApiKey = document.getElementById('groq-api-key') as HTMLInputElement;

    // Buttons
    const loadProjectsBtn = document.getElementById('load-projects-btn') as HTMLButtonElement;
    const testJiraBtn = document.getElementById('test-jira-btn') as HTMLButtonElement;
    const testGroqBtn = document.getElementById('test-groq-btn') as HTMLButtonElement;
    const jiraTestResult = document.getElementById('jira-test-result') as HTMLDivElement;
    const groqTestResult = document.getElementById('groq-test-result') as HTMLDivElement;
    const projectHint = document.getElementById('project-hint') as HTMLSpanElement;

    // ===== Open / Close =====
    settingsBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        loadSettingsIntoForm();
    });

    modalCloseBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        clearTestResults();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            clearTestResults();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            clearTestResults();
        }
    });

    // ===== Load Settings from localStorage into form =====
    function loadSettingsIntoForm(): void {
        const settings = loadSettingsFromStorage();
        jiraUrl.value = settings.jiraUrl || '';
        jiraEmail.value = settings.jiraEmail || '';
        jiraApiToken.value = settings.jiraApiToken || '';
        jiraIssueType.value = settings.jiraIssueType || 'Bug';
        groqApiKey.value = settings.groqApiKey || '';

        // If we already have credentials + a saved project key, load projects automatically  
        if (settings.jiraUrl && settings.jiraEmail && settings.jiraApiToken) {
            fetchProjects(settings.jiraProjectKey);
        } else if (settings.jiraProjectKey) {
            // Just show the saved key as a fallback option
            populateProjectSelect([{ key: settings.jiraProjectKey, name: settings.jiraProjectKey }], settings.jiraProjectKey);
        }
    }

    // ===== Get current form values as a settings object =====
    function getCurrentFormSettings(): Settings {
        return {
            jiraUrl: jiraUrl.value.trim(),
            jiraEmail: jiraEmail.value.trim(),
            jiraApiToken: jiraApiToken.value.trim(),
            jiraProjectKey: jiraProjectSelect.value.trim(),
            jiraIssueType: jiraIssueType.value.trim() || 'Bug',
            groqApiKey: groqApiKey.value.trim(),
        };
    }

    // ===== Load Projects Button =====
    loadProjectsBtn.addEventListener('click', async () => {
        // Auto-save to localStorage before fetching
        saveSettingsToStorage(getCurrentFormSettings());
        await fetchProjects();
    });

    async function fetchProjects(savedKey?: string): Promise<void> {
        loadProjectsBtn.disabled = true;
        loadProjectsBtn.textContent = 'Loading...';
        projectHint.textContent = 'Fetching your Jira projects...';

        try {
            const settings = getCurrentFormSettings();

            if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
                projectHint.textContent = '❌ Please fill in Jira URL, Email, and API Token first.';
                return;
            }

            const res = await fetch('/api/jira/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jiraUrl: settings.jiraUrl,
                    jiraEmail: settings.jiraEmail,
                    jiraApiToken: settings.jiraApiToken,
                }),
            });

            const { ok, data } = await safeJsonParse(res);

            if (ok && data.projects && data.projects.length > 0) {
                populateProjectSelect(data.projects, savedKey);
                projectHint.textContent = `✅ ${data.projects.length} project(s) loaded. Select yours above.`;
            } else {
                projectHint.textContent = `❌ ${data.error || 'No projects found. Check Jira credentials.'}`;
            }
        } catch (err: any) {
            projectHint.textContent = `❌ Network error: ${err.message}`;
        } finally {
            loadProjectsBtn.disabled = false;
            loadProjectsBtn.textContent = 'Load Projects';
        }
    }

    function populateProjectSelect(projects: JiraProject[], selectedKey?: string): void {
        const currentKey = selectedKey || jiraProjectSelect.value;
        jiraProjectSelect.innerHTML = '';

        if (projects.length === 0) {
            jiraProjectSelect.innerHTML = '<option value="">-- No projects found --</option>';
            return;
        }

        for (const project of projects) {
            const option = document.createElement('option');
            option.value = project.key;
            option.textContent = `${project.name} (${project.key})`;
            if (project.key === currentKey) option.selected = true;
            jiraProjectSelect.appendChild(option);
        }
    }

    // ===== Save Settings (to localStorage only) =====
    saveBtn.addEventListener('click', () => {
        const settings = getCurrentFormSettings();

        if (!settings.jiraProjectKey) {
            showToast('Please select a Jira project first', 'error');
            return;
        }

        saveSettingsToStorage(settings);
        showToast('Settings saved successfully!', 'success');
    });

    // ===== Test Jira =====
    testJiraBtn.addEventListener('click', async () => {
        const settings = getCurrentFormSettings();

        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken) {
            showTestResult(jiraTestResult, '❌ Please fill in all Jira details first', 'error');
            return;
        }

        // Auto-save to localStorage
        saveSettingsToStorage(settings);
        showTestResult(jiraTestResult, 'Testing Jira connection...', 'loading');
        testJiraBtn.disabled = true;

        try {
            const res = await fetch('/api/jira/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jiraUrl: settings.jiraUrl,
                    jiraEmail: settings.jiraEmail,
                    jiraApiToken: settings.jiraApiToken,
                }),
            });

            const { ok, data } = await safeJsonParse(res);

            if (ok && data.success) {
                showTestResult(jiraTestResult, `✅ ${data.message}`, 'success');
                // Auto-load projects after successful test
                await fetchProjects();
            } else {
                showTestResult(jiraTestResult, `❌ ${data.error || 'Connection failed'}`, 'error');
            }
        } catch (err: any) {
            showTestResult(jiraTestResult, `❌ Network error: ${err.message || 'Connection failed'}`, 'error');
        } finally {
            testJiraBtn.disabled = false;
        }
    });

    // ===== Test Groq =====
    testGroqBtn.addEventListener('click', async () => {
        const apiKey = groqApiKey.value.trim();
        if (!apiKey) {
            showTestResult(groqTestResult, '❌ Please enter Groq API key first', 'error');
            return;
        }

        // Auto-save to localStorage
        saveSettingsToStorage(getCurrentFormSettings());
        showTestResult(groqTestResult, 'Testing Groq connection...', 'loading');
        testGroqBtn.disabled = true;

        try {
            const res = await fetch('/api/groq/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groqApiKey: apiKey }),
            });

            const { ok, data } = await safeJsonParse(res);

            if (ok && data.success) {
                showTestResult(groqTestResult, `✅ ${data.message}`, 'success');
            } else {
                showTestResult(groqTestResult, `❌ ${data.error || 'Connection failed'}`, 'error');
            }
        } catch (err: any) {
            showTestResult(groqTestResult, `❌ Network error: ${err.message || 'Connection failed'}`, 'error');
        } finally {
            testGroqBtn.disabled = false;
        }
    });

    // ===== Helpers =====
    function showTestResult(el: HTMLDivElement, message: string, type: 'success' | 'error' | 'loading'): void {
        el.textContent = message;
        el.className = `test-result visible ${type}`;
    }

    function clearTestResults(): void {
        jiraTestResult.className = 'test-result';
        groqTestResult.className = 'test-result';
    }
}
