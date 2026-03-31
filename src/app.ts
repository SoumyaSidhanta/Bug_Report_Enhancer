import { loadSettingsFromStorage } from './settings';

let currentImageBase64: string | null = null;

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

export function initApp(): void {
    const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
    const dropPlaceholder = document.getElementById('drop-zone-placeholder') as HTMLDivElement;
    const dropPreview = document.getElementById('drop-zone-preview') as HTMLDivElement;
    const previewImage = document.getElementById('preview-image') as HTMLImageElement;
    const removeImageBtn = document.getElementById('remove-image') as HTMLButtonElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
    const analyzeBtnText = document.getElementById('analyze-btn-text') as HTMLSpanElement;
    const analyzeBtnLoading = document.getElementById('analyze-btn-loading') as HTMLSpanElement;
    const additionalNotes = document.getElementById('additional-notes') as HTMLTextAreaElement;
    const statusArea = document.getElementById('status-area') as HTMLDivElement;

    // ===== Drag & Drop =====
    dropZone.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-remove')) return;
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearImage();
    });

    function handleFile(file: File): void {
        if (!file.type.startsWith('image/')) {
            showToast('Please drop an image file (PNG, JPG, WEBP)', 'error');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast('Image is too large. Max size is 20MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            currentImageBase64 = reader.result as string;
            previewImage.src = currentImageBase64;
            dropPlaceholder.style.display = 'none';
            dropPreview.style.display = 'flex';
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    function clearImage(): void {
        currentImageBase64 = null;
        previewImage.src = '';
        dropPlaceholder.style.display = '';
        dropPreview.style.display = 'none';
        fileInput.value = '';
        analyzeBtn.disabled = true;
        statusArea.style.display = 'none';
    }

    // ===== Analyze & Push =====
    analyzeBtn.addEventListener('click', async () => {
        if (!currentImageBase64) {
            showToast('Please drop a screenshot first', 'error');
            return;
        }

        setLoading(true);
        showStatus('🔍 Analyzing screenshot with Groq Llama 4 Scout...', 'info');

        try {
            // Get credentials from localStorage (the source of truth)
            const settings = loadSettingsFromStorage();

            if (!settings.groqApiKey) {
                throw new Error('Groq API key is missing. Please set it in Settings.');
            }

            // Step 1: Analyze screenshot — pass groqApiKey in the body
            const analyzeRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: currentImageBase64,
                    additionalNotes: additionalNotes.value.trim(),
                    groqApiKey: settings.groqApiKey,
                }),
            });

            const analyzeResult = await safeJsonParse(analyzeRes);
            if (!analyzeResult.ok) {
                throw new Error(analyzeResult.data.error || 'Analysis failed');
            }

            showStatus('✅ Analysis complete! Creating Jira ticket...', 'info');

            if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiToken || !settings.jiraProjectKey) {
                throw new Error('Jira connection details are incomplete. Please update Settings.');
            }

            // Step 2: Create Jira ticket — pass all credentials in the body
            const jiraRes = await fetch('/api/jira/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: analyzeResult.data.summary,
                    description: analyzeResult.data.description,
                    jiraUrl: settings.jiraUrl,
                    jiraEmail: settings.jiraEmail,
                    jiraApiToken: settings.jiraApiToken,
                    jiraProjectKey: settings.jiraProjectKey,
                    jiraIssueType: settings.jiraIssueType,
                }),
            });

            const jiraResult = await safeJsonParse(jiraRes);
            if (!jiraResult.ok) {
                throw new Error(jiraResult.data.error || 'Jira ticket creation failed');
            }

            showStatus(
                `🎉 Jira ticket <a href="${jiraResult.data.url}" target="_blank" rel="noopener">${jiraResult.data.key}</a> created successfully!`,
                'success'
            );
            showToast(`Jira ticket ${jiraResult.data.key} created!`, 'success');

        } catch (err: any) {
            showStatus(`❌ Error: ${err.message}`, 'error');
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(loading: boolean): void {
        analyzeBtn.disabled = loading;
        analyzeBtnText.style.display = loading ? 'none' : 'inline-flex';
        analyzeBtnLoading.style.display = loading ? 'inline-flex' : 'none';
    }

    function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
        statusArea.innerHTML = message;
        statusArea.className = `status-area status-${type}`;
        statusArea.style.display = 'block';
    }
}

// ===== Toast Utility =====
export function showToast(message: string, type: 'success' | 'error'): void {
    const container = document.getElementById('toast-container')!;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toast.addEventListener('click', () => removeToast(toast));
    container.appendChild(toast);

    setTimeout(() => removeToast(toast), 4000);
}

function removeToast(toast: HTMLElement): void {
    if (toast.classList.contains('toast-removing')) return;
    toast.classList.add('toast-removing');
    setTimeout(() => toast.remove(), 300);
}
