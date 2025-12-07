// Application state
const state = {
    sidebarCollapsed: false,
    isRecording: false,
    isMuted: false,
    recordingTime: 0,
    recordingInterval: null,
    videoStream: null,
    recommendedQuestions: [],
    questionsCollapsed: true,
    isLoadingQuestions: false,
    questionsGenerated: false,
    questionHistory: [],
    transcript: [
        { timestamp: '15:49:03', text: "Hey my name is Thomas Uh I'm a junior engineer and I use React" }
    ],
    skillTree: null,
    candidateSkillTree: null,
    skillProgress: new Map(),
    waveformHeights: Array(20).fill(20),
    waveformAnimationFrame: null,
    lastProcessedIndex: 0,
    applicationUrl: null,
    candidateFileId: null,
    skillSimilarities: null // Stores similarity data from Grok API
};

// DOM elements
const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebarContent: document.getElementById('sidebarContent'),
    questionsToggle: document.getElementById('questionsToggle'),
    questionsIcon: document.getElementById('questionsIcon'),
    questionsContainer: document.getElementById('questionsContainer'),
    questionsLoading: document.getElementById('questionsLoading'),
    questionsList: document.getElementById('questionsList'),
    questionHistory: document.getElementById('questionHistory'),
    videoElement: document.getElementById('videoElement'),
    noVideo: document.getElementById('noVideo'),
    transcriptContainer: document.getElementById('transcriptContainer'),
    waveform: document.getElementById('waveform'),
    recordButton: document.getElementById('recordButton'),
    recordIcon: document.getElementById('recordIcon'),
    recordText: document.getElementById('recordText'),
    muteButton: document.getElementById('muteButton'),
    muteIcon: document.getElementById('muteIcon'),
    skillTreeContainer: document.getElementById('skillTreeContainer'),
    resetLayoutButton: document.getElementById('resetLayoutButton'),
    jobLinkButton: document.getElementById('jobLinkButton'),
    resumeUpload: document.getElementById('resumeUpload'),
    resumeUploadButton: document.getElementById('resumeUploadButton'),
    resumeStatus: document.getElementById('resumeStatus')
};

// Initialize waveform bars
function initWaveform() {
    const waveform = elements.waveform;
    waveform.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'waveform-bar';
        bar.style.height = '20%';
        waveform.appendChild(bar);
    }
}

// Animate waveform
function animateWaveform() {
    if (!state.isRecording) {
        // Reset waveform
        const bars = elements.waveform.querySelectorAll('.waveform-bar');
        bars.forEach(bar => {
            bar.style.height = '20%';
            bar.classList.remove('active');
        });
        if (state.waveformAnimationFrame) {
            cancelAnimationFrame(state.waveformAnimationFrame);
            state.waveformAnimationFrame = null;
        }
        return;
    }

    function animate() {
        if (!state.isRecording) return;
        
        const bars = elements.waveform.querySelectorAll('.waveform-bar');
        for (let i = 0; i < 3; i++) {
            const index = Math.floor(Math.random() * 20);
            const height = Math.random() * 100;
            bars[index].style.height = `${height}%`;
            bars[index].classList.add('active');
        }
        
        state.waveformAnimationFrame = requestAnimationFrame(animate);
    }
    
    animate();
}

// Format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize video stream
async function initVideoStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        state.videoStream = stream;
        elements.videoElement.srcObject = stream;
        elements.noVideo.style.display = 'none';
    } catch (error) {
        console.error('Error accessing media devices:', error);
        elements.noVideo.style.display = 'flex';
    }
}

// Toggle recording
function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!state.videoStream && elements.videoElement) {
        initVideoStream();
    }
    state.isRecording = true;
    state.recordingTime = 0;
    
    if (state.recordingInterval) {
        clearInterval(state.recordingInterval);
    }
    
    state.recordingInterval = setInterval(() => {
        if (state.isRecording) {
            state.recordingTime++;
            updateRecordButton();
            updateQuestionsOnRecordingChange();
        }
    }, 1000);
    
    animateWaveform();
    updateRecordButton();
    updateQuestionsOnRecordingChange();
}

function stopRecording() {
    state.isRecording = false;
    if (state.recordingInterval) {
        clearInterval(state.recordingInterval);
        state.recordingInterval = null;
    }
    animateWaveform();
    updateRecordButton();
    updateQuestionsOnRecordingChange();
}

function updateRecordButton() {
    if (state.isRecording) {
        elements.recordButton.classList.add('destructive');
        elements.recordIcon.className = 'fas fa-stop';
        elements.recordText.textContent = `Stop ${formatTime(state.recordingTime)}`;
    } else {
        elements.recordButton.classList.remove('destructive');
        elements.recordIcon.className = 'fas fa-pause';
        elements.recordText.textContent = 'Start';
    }
}

// Toggle mute
function toggleMute() {
    state.isMuted = !state.isMuted;
    if (state.videoStream) {
        state.videoStream.getAudioTracks().forEach(track => {
            track.enabled = !state.isMuted;
        });
    }
    updateMuteButton();
}

function updateMuteButton() {
    if (state.isMuted) {
        elements.muteButton.classList.add('secondary');
        elements.muteButton.classList.remove('outline');
        elements.muteIcon.className = 'fas fa-microphone-slash';
    } else {
        elements.muteButton.classList.remove('secondary');
        elements.muteButton.classList.add('outline');
        elements.muteIcon.className = 'fas fa-microphone';
    }
}

// Load jobs list
async function loadJobs() {
    try {
        const response = await fetch('http://localhost:5000/api/v1/jobs');
        if (response.ok) {
            const data = await response.json();
            renderJobs(data.jobs);
        } else {
            elements.sidebarContent.innerHTML = '<div class="loading-text">Failed to load jobs</div>';
        }
    } catch (error) {
        console.error('Failed to load jobs:', error);
        elements.sidebarContent.innerHTML = '<div class="loading-text">Failed to load jobs</div>';
    }
}

// Render jobs list
function renderJobs(jobs) {
    if (!jobs || jobs.length === 0) {
        elements.sidebarContent.innerHTML = '<div class="loading-text">No jobs available</div>';
        return;
    }
    
    const jobList = document.createElement('div');
    jobList.className = 'job-list';
    
    jobs.forEach(job => {
        const jobItem = document.createElement('div');
        jobItem.className = 'job-item';
        jobItem.dataset.jobId = job.job_id;
        
        jobItem.innerHTML = `
            <div class="job-item-title">${job.job_title}</div>
            ${job.location ? `<div class="job-item-location">${job.location}</div>` : ''}
        `;
        
        jobItem.addEventListener('click', () => {
            // Remove active class from all items
            jobList.querySelectorAll('.job-item').forEach(item => {
                item.classList.remove('active');
            });
            // Add active class to clicked item
            jobItem.classList.add('active');
            // Show loading state
            elements.skillTreeContainer.innerHTML = '<div class="loading-text">Loading skill tree...</div>';
            // Reset visualization instance
            skillTreeViz = null;
            // Load skill tree for this job
            loadSkillTree(job.job_id);
        });
        
        jobList.appendChild(jobItem);
    });
    
    elements.sidebarContent.innerHTML = '';
    elements.sidebarContent.appendChild(jobList);
}

// Load skill tree
async function loadSkillTree(jobId = null) {
    if (!jobId) {
        const urlParams = new URLSearchParams(window.location.search);
        jobId = urlParams.get('job_id');
    }
    
    // Don't load a tree if no jobId is provided
    if (!jobId) {
        elements.skillTreeContainer.innerHTML = '<div class="loading-text">Select a job to view skill tree</div>';
        state.skillTree = null;
        state.applicationUrl = null;
        updateJobLinkButton();
        state.skillProgress = new Map();
        state.skillSimilarities = null;
        state.questionsGenerated = false;
        state.recommendedQuestions = [];
        renderQuestions();
        return;
    }
    
    try {
        let skillTreeData;
        
        try {
            const response = await fetch(`http://localhost:5000/api/v1/skill-trees/${jobId}`);
            if (response.ok) {
                skillTreeData = await response.json();
            } else {
                throw new Error('Skill tree not found');
            }
        } catch (e) {
            console.warn('Failed to load skill tree:', e);
            elements.skillTreeContainer.innerHTML = '<div class="loading-text">Skill tree not found for this job</div>';
            state.skillTree = null;
            state.applicationUrl = null;
            updateJobLinkButton();
            state.skillProgress = new Map();
            state.skillSimilarities = null;
            state.questionsGenerated = false;
            state.recommendedQuestions = [];
            renderQuestions();
            return;
        }
        
        state.skillTree = skillTreeData;
        // Store application URL if available
        state.applicationUrl = skillTreeData.application_url || null;
        // Update job link button visibility
        updateJobLinkButton();
        // Reset skill progress when loading new tree
        state.skillProgress = new Map();
        initializeSkillProgress(skillTreeData);
        // Reset similarity data when loading new job
        state.skillSimilarities = null;
        renderSkillTree(skillTreeData);
        // Reset questions when loading new tree
        state.questionsGenerated = false;
        state.recommendedQuestions = [];
        renderQuestions();
    } catch (error) {
        console.error('Failed to load skill tree:', error);
        // Don't load default tree on error - show message instead
        elements.skillTreeContainer.innerHTML = '<div class="loading-text">Failed to load skill tree. Please select a job.</div>';
        state.skillTree = null;
        state.applicationUrl = null;
        updateJobLinkButton();
        state.skillProgress = new Map();
        state.skillSimilarities = null;
        state.questionsGenerated = false;
        state.recommendedQuestions = [];
        renderQuestions();
    }
}

function getDefaultSkillTree() {
    return {
        name: "Skills",
        children: [
            {
                name: "Technical Skills",
                children: [
                    {
                        name: "Programming Languages",
                        children: [
                            { name: "Python", type: "skill" },
                            { name: "Rust", type: "skill" }
                        ]
                    },
                    {
                        name: "Frameworks",
                        children: [
                            { name: "Jax", type: "skill" }
                        ]
                    },
                    {
                        name: "Technologies",
                        children: [
                            { name: "large-scale distributed machine learning systems", type: "skill" }
                        ]
                    }
                ]
            },
            {
                name: "ML/AI Concepts",
                children: [
                    { name: "fine-tuning large language models", type: "skill" },
                    { name: "reinforcement learning", type: "skill" },
                    { name: "reward models", type: "skill" },
                    { name: "model evaluation", type: "skill" },
                    { name: "inference-time search techniques", type: "skill" },
                    { name: "model optimizations", type: "skill" }
                ]
            },
            {
                name: "Methodologies & Techniques",
                children: [
                    { name: "data collection pipelines", type: "skill" },
                    { name: "data generation techniques", type: "skill" },
                    { name: "reinforcement learning algorithms", type: "skill" },
                    { name: "model training frameworks", type: "skill" }
                ]
            },
            {
                name: "Domain Expertise",
                children: [
                    { name: "post-training", type: "skill" },
                    { name: "pre-training", type: "skill" },
                    { name: "reasoning", type: "skill" },
                    { name: "multimodal", type: "skill" }
                ]
            }
        ],
        job_id: 4374125007,
        job_title: "Member of Technical Staff, Post-training",
        location: "Palo Alto, CA; San Francisco, CA"
    };
}

function initializeSkillProgress(node) {
    if (node.type === 'skill' || node.type === 'requirement') {
        state.skillProgress.set(node.name, 0);
    }
    if (node.children) {
        node.children.forEach(child => initializeSkillProgress(child));
    }
}

// Generate questions from skill tree
async function generateQuestionsFromSkillTree(tree) {
    if (!tree) {
        tree = state.skillTree;
    }
    if (!tree) return;
    
    state.isLoadingQuestions = true;
    state.questionsGenerated = true;
    elements.questionsLoading.style.display = 'block';
    elements.questionsList.innerHTML = '';
    
    try {
        const skills = [];
        function extractSkills(node) {
            if (node.type === 'skill' || node.type === 'requirement') {
                skills.push(node.name);
            }
            if (node.children) {
                node.children.forEach(extractSkills);
            }
        }
        extractSkills(tree);
        
        const jobTitle = tree.job_title || 'Software Engineer';
        const location = tree.location || '';
        const skillsList = skills.slice(0, 10).join(', ');
        
        const response = await fetch('http://localhost:5000/api/v1/generate-interview-questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                job_title: jobTitle,
                location: location,
                skills: skillsList, // Keep for fallback
                job_skill_tree: tree, // Full job skill tree for Grok
                candidate_skill_tree: state.candidateSkillTree || null // Candidate skill tree if available
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.questions && Array.isArray(data.questions)) {
                state.recommendedQuestions = data.questions.map((q, idx) => ({
                    id: idx + 1,
                    text: q,
                    asked: false,
                    skipped: false
                }));
            }
        } else {
            // Fallback questions
            state.recommendedQuestions = skills.slice(0, 5).map((skill, idx) => ({
                id: idx + 1,
                text: `Can you explain your experience with ${skill}?`,
                asked: false,
                skipped: false
            }));
        }
    } catch (error) {
        console.error('Failed to generate questions:', error);
        state.recommendedQuestions = [
            {
                id: 1,
                text: 'Can you walk me through your relevant experience?',
                asked: false,
                skipped: false
            },
            {
                id: 2,
                text: 'What technical challenges have you faced in your previous projects?',
                asked: false,
                skipped: false
            },
            {
                id: 3,
                text: 'How do you approach problem-solving in a technical context?',
                asked: false,
                skipped: false
            }
        ];
    } finally {
        state.isLoadingQuestions = false;
        elements.questionsLoading.style.display = 'none';
        renderQuestions();
    }
}

// Render questions
function renderQuestions() {
    elements.questionsList.innerHTML = '';
    
    // Show generate button if questions haven't been generated
    if (!state.questionsGenerated) {
        const generateButton = document.createElement('button');
        generateButton.className = 'btn btn-primary';
        generateButton.style.width = '100%';
        generateButton.innerHTML = '<i class="fas fa-sparkles"></i> Generate Questions';
        generateButton.addEventListener('click', async () => {
            await generateQuestionsFromSkillTree(state.skillTree);
        });
        elements.questionsList.appendChild(generateButton);
        return;
    }
    
    // Show loading state
    if (state.isLoadingQuestions) {
        elements.questionsLoading.style.display = 'block';
        return;
    }
    
    elements.questionsLoading.style.display = 'none';
    
    // Show questions if they exist
    const questions = state.recommendedQuestions.filter(q => !q.asked && !q.skipped);
    
    if (questions.length === 0 && state.questionsGenerated) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-text';
        emptyMessage.textContent = 'No questions available. Click "Generate Questions" to create some.';
        elements.questionsList.appendChild(emptyMessage);
        return;
    }
    
    questions.forEach(question => {
        const card = document.createElement('div');
        card.className = 'question-card';
        
        const timeDisplay = state.isRecording 
            ? `<div class="recording-timer">
                <i class="fas fa-pause"></i>
                ${formatTime(state.recordingTime)}
               </div>`
            : '';
        
        card.innerHTML = `
            ${timeDisplay}
            <p class="question-text">${question.text}</p>
            <div class="question-actions">
                <button class="btn-icon-small ask" data-question-id="${question.id}" data-action="ask">
                    <i class="fas fa-check-circle"></i>
                </button>
                <button class="btn-icon-small skip" data-question-id="${question.id}" data-action="skip">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add event listeners
        const askBtn = card.querySelector('[data-action="ask"]');
        const skipBtn = card.querySelector('[data-action="skip"]');
        askBtn.addEventListener('click', () => handleQuestionAction(question.id, 'ask'));
        skipBtn.addEventListener('click', () => handleQuestionAction(question.id, 'skip'));
        
        elements.questionsList.appendChild(card);
    });
}

// Re-render questions when recording state changes
function updateQuestionsOnRecordingChange() {
    if (state.recommendedQuestions.length > 0) {
        renderQuestions();
    }
}

// Handle question action
function handleQuestionAction(questionId, action) {
    const question = state.recommendedQuestions.find(q => q.id === questionId);
    if (question) {
        if (action === 'ask') {
            question.asked = true;
            state.questionHistory.push({
                id: Date.now(),
                text: question.text,
                timestamp: new Date().toLocaleTimeString()
            });
        } else {
            question.skipped = true;
        }
        renderQuestions();
        renderQuestionHistory();
    }
}

// Render question history
function renderQuestionHistory() {
    if (state.questionHistory.length === 0) {
        elements.questionHistory.innerHTML = '<p class="empty-text">No questions asked yet.</p>';
    } else {
        elements.questionHistory.innerHTML = state.questionHistory.map(q => `
            <div class="history-entry">
                <p class="history-time">${q.timestamp}</p>
                <p class="history-text">${q.text}</p>
            </div>
        `).join('');
    }
}

// Render transcript
function renderTranscript() {
    elements.transcriptContainer.innerHTML = state.transcript.map(entry => `
        <div class="transcript-entry">
            <p class="transcript-time">${entry.timestamp}</p>
            <p class="transcript-text">${entry.text}</p>
        </div>
    `).join('');
}

let skillTreeViz = null;

// Render skill tree using D3
function renderSkillTree(tree) {
    if (!tree) {
        // Show message if no tree is loaded
        elements.skillTreeContainer.innerHTML = '<div class="loading-text">Select a job to view skill tree</div>';
        skillTreeViz = null; // Reset visualization
        return;
    }
    
    // Initialize D3 visualization
    if (typeof window.SkillTreeVisualization !== 'undefined') {
        // Always recreate visualization to avoid stale references when switching jobs
        // Clear container first
        elements.skillTreeContainer.innerHTML = '';
        
        // Reset visualization instance
        skillTreeViz = null;
        
        // Create new visualization instance
        skillTreeViz = new window.SkillTreeVisualization(
            elements.skillTreeContainer,
            { skillTree: tree, skillProgress: state.skillProgress }
        );
        
        // Handle window resize (only add listener once)
        if (!window.skillTreeResizeHandler) {
            let resizeTimeout;
            window.skillTreeResizeHandler = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (skillTreeViz) {
                        skillTreeViz.resize();
                    }
                }, 250);
            };
            window.addEventListener('resize', window.skillTreeResizeHandler);
        }
        
        skillTreeViz.update(tree, state.candidateSkillTree, state.skillSimilarities);
    } else {
        // Fallback if D3 not loaded
        elements.skillTreeContainer.innerHTML = '<div class="loading-text">Loading visualization...</div>';
    }
}

function updateSkillTreeDisplay() {
    if (state.skillTree) {
        renderSkillTree(state.skillTree);
    }
}

// Update skill progress
function updateSkillProgress(skillName, progress) {
    const newProgress = Math.min(100, Math.max(0, progress));
    state.skillProgress.set(skillName, newProgress);
    
    if (skillTreeViz) {
        skillTreeViz.updateProgress(skillName, newProgress, state.candidateSkillTree, state.skillSimilarities);
    } else if (state.skillTree) {
        renderSkillTree(state.skillTree);
    }
}

function incrementSkillProgress(skillName, amount = 25) {
    const current = state.skillProgress.get(skillName) || 0;
    updateSkillProgress(skillName, current + amount);
}

// Process transcript for skill mentions
function processTranscript() {
    if (state.transcript.length > state.lastProcessedIndex && state.isRecording) {
        const newEntries = state.transcript.slice(state.lastProcessedIndex);
        state.lastProcessedIndex = state.transcript.length;
        
        setTimeout(() => {
            if (!state.isRecording) return;
            
            const lastEntry = newEntries[newEntries.length - 1];
            if (!lastEntry) return;
            
            const text = lastEntry.text.toLowerCase();
            const updates = [];
            
            if (text.includes('react') || text.includes('component')) {
                updates.push(['React', 20]);
            }
            if (text.includes('typescript') || text.includes('interface')) {
                updates.push(['TypeScript', 20]);
            }
            if (text.includes('css') || text.includes('flexbox') || text.includes('styling')) {
                updates.push(['CSS3', 20]);
            }
            if (text.includes('javascript')) {
                updates.push(['JavaScript', 20]);
            }
            
            if (updates.length > 0) {
                updates.forEach(([skill, amount]) => {
                    incrementSkillProgress(skill, amount);
                });
            }
        }, 500);
    }
}

// Event listeners
elements.sidebarToggle?.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    elements.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    
    // Update chevron icon direction
    const icon = elements.sidebarToggle?.querySelector('i');
    if (icon) {
        if (state.sidebarCollapsed) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-left';
        }
    }
});

elements.questionsToggle?.addEventListener('click', () => {
    state.questionsCollapsed = !state.questionsCollapsed;
    elements.questionsContainer.style.display = state.questionsCollapsed ? 'none' : 'block';
    elements.questionsIcon.className = state.questionsCollapsed 
        ? 'fas fa-chevron-down' 
        : 'fas fa-chevron-up';
});

// Initialize questions section as collapsed
if (elements.questionsContainer) {
    elements.questionsContainer.style.display = 'none';
}
if (elements.questionsIcon) {
    elements.questionsIcon.className = 'fas fa-chevron-down';
}

elements.recordButton?.addEventListener('click', toggleRecording);
elements.muteButton?.addEventListener('click', toggleMute);

// Update job link button
function updateJobLinkButton() {
    if (elements.jobLinkButton) {
        if (state.applicationUrl) {
            elements.jobLinkButton.style.display = 'inline-flex';
        } else {
            elements.jobLinkButton.style.display = 'none';
        }
    }
}

// Job link button
elements.jobLinkButton?.addEventListener('click', () => {
    if (state.applicationUrl) {
        window.open(state.applicationUrl, '_blank', 'noopener,noreferrer');
    }
});

// Resume upload handlers
elements.resumeUploadButton?.addEventListener('click', () => {
    elements.resumeUpload?.click();
});

elements.resumeUpload?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        elements.resumeStatus.textContent = 'Error: Please upload a PDF file';
        elements.resumeStatus.className = 'resume-status error';
        return;
    }
    
    elements.resumeStatus.textContent = 'Uploading and processing resume...';
    elements.resumeStatus.className = 'resume-status loading';
    elements.resumeUploadButton.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('resume', file);
        
        // Include current job_id if available
        if (state.skillTree && state.skillTree.job_id) {
            formData.append('job_id', state.skillTree.job_id);
        }
        
        const response = await fetch('http://localhost:5000/api/v1/upload-resume', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success && data.skill_tree) {
            state.candidateSkillTree = data.skill_tree;
            state.candidateFileId = data.file_id;
            state.skillSimilarities = data.similarity_data || null;
            elements.resumeStatus.textContent = 'Resume processed successfully!';
            elements.resumeStatus.className = 'resume-status success';
            
            // Re-render skill tree with candidate skills and similarities
            if (state.skillTree) {
                renderSkillTree(state.skillTree);
            }
        } else {
            throw new Error(data.error || 'Failed to process resume');
        }
    } catch (error) {
        console.error('Error uploading resume:', error);
        elements.resumeStatus.textContent = `Error: ${error.message}`;
        elements.resumeStatus.className = 'resume-status error';
    } finally {
        elements.resumeUploadButton.disabled = false;
        elements.resumeUpload.value = '';
    }
});

// Reset layout button
elements.resetLayoutButton?.addEventListener('click', () => {
    if (skillTreeViz && state.skillTree) {
        // Reset skill progress
        state.skillProgress = new Map();
        initializeSkillProgress(state.skillTree);
        // Reset zoom to default
        skillTreeViz.resetZoom();
        // Re-render the tree
        skillTreeViz.update(state.skillTree, state.candidateSkillTree, state.skillSimilarities);
    }
});

// Initialize
async function init() {
    initWaveform();
    await initVideoStream();
    await loadJobs(); // Load jobs first
    // Don't load skill tree on startup - wait for job selection
    renderQuestionHistory();
    renderTranscript();
    renderQuestions(); // Initialize questions display
    updateMuteButton();
    
    // Watch for transcript updates
    setInterval(() => {
        processTranscript();
    }, 1000);
}

// Start app
init();

