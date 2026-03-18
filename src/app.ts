let currentImageBase64: string | null = null;

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
            // Step 1: Analyze screenshot
            const analyzeRes = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: currentImageBase64,
                    additionalNotes: additionalNotes.value.trim(),
                }),
            });

            const analyzeData = await analyzeRes.json();
            if (!analyzeRes.ok) {
                throw new Error(analyzeData.error || 'Analysis failed');
            }

            showStatus('✅ Analysis complete! Creating Jira ticket...', 'info');

            // Step 2: Create Jira ticket
            const jiraRes = await fetch('/api/jira/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: analyzeData.summary,
                    description: analyzeData.description,
                }),
            });

            const jiraData = await jiraRes.json();
            if (!jiraRes.ok) {
                throw new Error(jiraData.error || 'Jira ticket creation failed');
            }

            showStatus(
                `🎉 Jira ticket <a href="${jiraData.url}" target="_blank" rel="noopener">${jiraData.key}</a> created successfully!`,
                'success'
            );
            showToast(`Jira ticket ${jiraData.key} created!`, 'success');

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
