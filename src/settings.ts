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
    settingsBtn.addEventListener('click', async () => {
        modal.style.display = 'flex';
        await loadSettings();
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

    // ===== Load Settings =====
    async function loadSettings(): Promise<void> {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data: Settings = await res.json();
                jiraUrl.value = data.jiraUrl || '';
                jiraEmail.value = data.jiraEmail || '';
                jiraApiToken.value = data.jiraApiToken || '';
                jiraIssueType.value = data.jiraIssueType || 'Bug';
                groqApiKey.value = data.groqApiKey || '';

                // If we already have credentials + a saved project key, load projects automatically  
                if (data.jiraUrl && data.jiraEmail && data.jiraApiToken) {
                    await fetchProjects(data.jiraProjectKey);
                } else if (data.jiraProjectKey) {
                    // Just show the saved key as a fallback option
                    populateProjectSelect([{ key: data.jiraProjectKey, name: data.jiraProjectKey }], data.jiraProjectKey);
                }
            }
        } catch {
            // Settings file may not exist yet
        }
    }

    // ===== Load Projects Button =====
    loadProjectsBtn.addEventListener('click', async () => {
        await saveCurrentSettings();
        await fetchProjects();
    });

    async function fetchProjects(savedKey?: string): Promise<void> {
        loadProjectsBtn.disabled = true;
        loadProjectsBtn.textContent = 'Loading...';
        projectHint.textContent = 'Fetching your Jira projects...';

        try {
            const res = await fetch('/api/jira/projects');
            const data = await res.json();

            if (res.ok && data.projects && data.projects.length > 0) {
                populateProjectSelect(data.projects, savedKey);
                projectHint.textContent = `✅ ${data.projects.length} project(s) loaded. Select yours above.`;
            } else {
                projectHint.textContent = `❌ ${data.error || 'No projects found. Check Jira credentials.'}`;
            }
        } catch (err: any) {
            projectHint.textContent = `❌ Failed to load projects: ${err.message}`;
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

    // ===== Save Settings =====
    saveBtn.addEventListener('click', async () => {
        const settings: Settings = {
            jiraUrl: jiraUrl.value.trim(),
            jiraEmail: jiraEmail.value.trim(),
            jiraApiToken: jiraApiToken.value.trim(),
            jiraProjectKey: jiraProjectSelect.value.trim(),
            jiraIssueType: jiraIssueType.value.trim() || 'Bug',
            groqApiKey: groqApiKey.value.trim(),
        };

        if (!settings.jiraProjectKey) {
            showToast('Please select a Jira project first', 'error');
            return;
        }

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                showToast('Settings saved successfully!', 'success');
            } else {
                throw new Error('Failed to save');
            }
        } catch {
            showToast('Failed to save settings', 'error');
        }
    });

    // ===== Test Jira =====
    testJiraBtn.addEventListener('click', async () => {
        await saveCurrentSettings();
        showTestResult(jiraTestResult, 'Testing Jira connection...', 'loading');
        testJiraBtn.disabled = true;

        try {
            const res = await fetch('/api/jira/test', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                showTestResult(jiraTestResult, `✅ ${data.message}`, 'success');
                // Auto-load projects after successful test
                await fetchProjects();
            } else {
                showTestResult(jiraTestResult, `❌ ${data.error || 'Connection failed'}`, 'error');
            }
        } catch (err: any) {
            showTestResult(jiraTestResult, `❌ ${err.message || 'Connection failed'}`, 'error');
        } finally {
            testJiraBtn.disabled = false;
        }
    });

    // ===== Test Groq =====
    testGroqBtn.addEventListener('click', async () => {
        await saveCurrentSettings();
        showTestResult(groqTestResult, 'Testing Groq connection...', 'loading');
        testGroqBtn.disabled = true;

        try {
            const res = await fetch('/api/groq/test', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                showTestResult(groqTestResult, `✅ ${data.message}`, 'success');
            } else {
                showTestResult(groqTestResult, `❌ ${data.error || 'Connection failed'}`, 'error');
            }
        } catch (err: any) {
            showTestResult(groqTestResult, `❌ ${err.message || 'Connection failed'}`, 'error');
        } finally {
            testGroqBtn.disabled = false;
        }
    });

    // ===== Helpers =====
    async function saveCurrentSettings(): Promise<void> {
        const settings: Settings = {
            jiraUrl: jiraUrl.value.trim(),
            jiraEmail: jiraEmail.value.trim(),
            jiraApiToken: jiraApiToken.value.trim(),
            jiraProjectKey: jiraProjectSelect.value.trim(),
            jiraIssueType: jiraIssueType.value.trim() || 'Bug',
            groqApiKey: groqApiKey.value.trim(),
        };

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
        } catch {
            // Silently fail
        }
    }

    function showTestResult(el: HTMLDivElement, message: string, type: 'success' | 'error' | 'loading'): void {
        el.textContent = message;
        el.className = `test-result visible ${type}`;
    }

    function clearTestResults(): void {
        jiraTestResult.className = 'test-result';
        groqTestResult.className = 'test-result';
    }
}
