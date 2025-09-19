// DOM Elements
const taskInput = document.getElementById('taskInput');
const addTaskButton = document.getElementById('addTask');
const taskList = document.getElementById('taskList');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const testConnectionBtn = document.getElementById('testConnection');
const apiEndpointInput = document.getElementById('apiEndpoint');
const deploymentNameInput = document.getElementById('deploymentName');
const apiKeyInput = document.getElementById('apiKey');

// Task Data Structure
let tasks = [];
let archivedTasks = [];

// Storage keys
const SETTINGS_KEY = 'todoAppSettings';
const TASKS_KEY = 'tasks';
const ARCHIVED_TASKS_KEY = 'archivedTasks';

// Load tasks from localStorage
function loadTasks() {
    const savedTasks = localStorage.getItem(TASKS_KEY);
    const savedArchivedTasks = localStorage.getItem(ARCHIVED_TASKS_KEY);
    
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    
    if (savedArchivedTasks) {
        archivedTasks = JSON.parse(savedArchivedTasks);
    }
    
    renderTasks();
    renderArchivedTasks();
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    localStorage.setItem(ARCHIVED_TASKS_KEY, JSON.stringify(archivedTasks));
}

// Archive a task
function archiveTask(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        const task = tasks[taskIndex];
        task.archiveDate = new Date().toISOString();
        archivedTasks.unshift(task);
        tasks.splice(taskIndex, 1);
        saveTasks();
        renderTasks();
        renderArchivedTasks();
    }
}

// Render archived tasks
function renderArchivedTasks() {
    const archiveList = document.getElementById('archiveList');
    archiveList.innerHTML = '';
    
    if (archivedTasks.length === 0) {
        archiveList.innerHTML = '<div class="no-tasks">No archived tasks</div>';
        return;
    }

    archivedTasks.forEach(task => {
        const taskElement = createArchivedTaskElement(task);
        archiveList.appendChild(taskElement);
    });
}

// Create archived task element
function createArchivedTaskElement(task) {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    const archiveDate = new Date(task.archiveDate).toLocaleDateString();
    
    taskItem.innerHTML = `
        <div class="task-content">
            <div class="task-title">
                <input type="checkbox" checked disabled>
                <span class="completed">${task.title}</span>
                <span class="archive-date">Archived on ${archiveDate}</span>
            </div>
            <div class="subtasks"></div>
        </div>
    `;

    // Render completed subtasks
    const subtasksContainer = taskItem.querySelector('.subtasks');
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
            const subtaskElement = document.createElement('div');
            subtaskElement.className = 'subtask-item';
            subtaskElement.innerHTML = `
                <input type="checkbox" ${subtask.completed ? 'checked' : ''} disabled>
                <span class="${subtask.completed ? 'completed' : ''}">${subtask.title}</span>
            `;
            subtasksContainer.appendChild(subtaskElement);
        });
    }

    return taskItem;
}

// Create a new task
function createTask(title) {
    return {
        id: Date.now(),
        title,
        completed: false,
        subtasks: []
    };
}

// Create a new subtask
function createSubtask(title) {
    return {
        id: Date.now(),
        title,
        completed: false
    };
}

// Render tasks
function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
}

// Create task element
function createTaskElement(task) {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.innerHTML = `
        <div class="task-content">
            <div class="task-title">
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <i class="fas fa-tasks task-icon"></i>
                <span class="editable ${task.completed ? 'completed' : ''}" contenteditable="true">${task.title}</span>
                <button class="plan-for-me">
                    <i class="fas fa-wand-magic-sparkles"></i> Plan For Me
                </button>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            </div>
            <div class="subtasks"></div>
            <button class="add-subtask"><i class="fas fa-plus"></i> Add Subtask</button>
        </div>
    `;

// Add task event listeners
const checkbox = taskItem.querySelector('input[type="checkbox"]');
const titleSpan = taskItem.querySelector('.task-title span');
const deleteBtn = taskItem.querySelector('.delete-btn');
const planForMeBtn = taskItem.querySelector('.plan-for-me');
const addSubtaskBtn = taskItem.querySelector('.add-subtask');
const subtasksContainer = taskItem.querySelector('.subtasks');

// PlanForMe button event listener
planForMeBtn.addEventListener('click', async () => {
    const settings = getSettings();
    if (!settings.endpoint || !settings.key || !settings.deploymentName) {
        alert('Please configure all API settings first');
        settingsModal.style.display = 'block';
        return;
    }

    try {
        planForMeBtn.innerHTML = '<div class="spinner"></div>Planning...';
        planForMeBtn.disabled = true;

        // Format the endpoint URL
        if (!settings.endpoint.endsWith('.cognitiveservices.azure.com')) {
            settings.endpoint = `${settings.endpoint}.cognitiveservices.azure.com`;
        }
        if (!settings.endpoint.startsWith('https://')) {
            settings.endpoint = `https://${settings.endpoint}`;
        }

        const response = await fetch(`${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=2024-02-15-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': settings.key
            },
            body: JSON.stringify({
                messages: [
                    { 
                        role: "system", 
                        content: "You are a task breakdown assistant. Your job is to break down tasks into specific, actionable subtasks. Respond with a numbered list of subtasks, one per line. Keep each subtask concise and clear."
                    },
                    { 
                        role: "user", 
                        content: `Please break down this task into smaller subtasks: ${task.title}. Provide 3-7 specific, actionable steps.` 
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
            console.error('Unexpected API response format:', data);
            throw new Error('Invalid API response format');
        }

        // Split the content by newlines and filter out empty lines and numbering
        const subtasks = data.choices[0].message.content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => line.replace(/^\d+\.\s*/, '')); // Remove numbering like "1. "

        // Add the suggested subtasks
        subtasks.slice(0, 10).forEach(subtaskTitle => {
            const subtask = createSubtask(subtaskTitle);
            task.subtasks.push(subtask);
        });

        renderSubtasks(task, subtasksContainer);
        saveTasks();

    } catch (error) {
        console.error('Error generating plan:', error);
        alert('Failed to generate plan. Please try again.');
    } finally {
        planForMeBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Plan For Me';
        planForMeBtn.disabled = false;
    }
});    checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        titleSpan.classList.toggle('completed', task.completed);
        
        if (task.completed) {
            const shouldArchive = confirm('Would you like to move this completed task to the archive?');
            if (shouldArchive) {
                archiveTask(task.id);
            } else {
                saveTasks();
            }
        } else {
            saveTasks();
        }
    });

    titleSpan.addEventListener('blur', () => {
        task.title = titleSpan.textContent;
        saveTasks();
    });

    titleSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleSpan.blur();
        }
    });

    deleteBtn.addEventListener('click', () => {
        tasks = tasks.filter(t => t.id !== task.id);
        renderTasks();
        saveTasks();
    });

    addSubtaskBtn.addEventListener('click', () => {
        const subtask = createSubtask('New Subtask');
        task.subtasks.push(subtask);
        renderSubtasks(task, subtasksContainer);
        saveTasks();
    });

    // Render existing subtasks
    renderSubtasks(task, subtasksContainer);

    return taskItem;
}

// Render subtasks
function renderSubtasks(task, container) {
    // Clear the container
    container.innerHTML = '';
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Add each subtask to the fragment
    task.subtasks.forEach(subtask => {
        const subtaskElement = createSubtaskElement(task, subtask);
        fragment.appendChild(subtaskElement);
    });
    
    // Add all subtasks at once
    container.appendChild(fragment);
}

// Create subtask element
// Get appropriate icon for subtask based on its content
function getSubtaskIcon(title) {
    const title_lower = title.toLowerCase();
    
    // Research/Analysis tasks
    if (title_lower.includes('research') || title_lower.includes('analyze') || title_lower.includes('study') || title_lower.includes('review')) {
        return 'fa-magnifying-glass';
    }
    
    // Communication tasks
    if (title_lower.includes('email') || title_lower.includes('call') || title_lower.includes('contact') || title_lower.includes('meet') || title_lower.includes('discussion')) {
        return 'fa-comments';
    }
    
    // Document/Writing tasks
    if (title_lower.includes('write') || title_lower.includes('document') || title_lower.includes('draft') || title_lower.includes('create')) {
        return 'fa-file-lines';
    }
    
    // Design tasks
    if (title_lower.includes('design') || title_lower.includes('draw') || title_lower.includes('sketch')) {
        return 'fa-palette';
    }
    
    // Testing/Checking tasks
    if (title_lower.includes('test') || title_lower.includes('check') || title_lower.includes('verify') || title_lower.includes('validate')) {
        return 'fa-clipboard-check';
    }
    
    // Planning tasks
    if (title_lower.includes('plan') || title_lower.includes('schedule') || title_lower.includes('organize')) {
        return 'fa-calendar';
    }
    
    // Implementation/Coding tasks
    if (title_lower.includes('implement') || title_lower.includes('code') || title_lower.includes('develop') || title_lower.includes('build')) {
        return 'fa-code';
    }
    
    // Review/Feedback tasks
    if (title_lower.includes('review') || title_lower.includes('feedback') || title_lower.includes('evaluate')) {
        return 'fa-eye';
    }
    
    // Update/Modify tasks
    if (title_lower.includes('update') || title_lower.includes('modify') || title_lower.includes('change') || title_lower.includes('edit')) {
        return 'fa-pen-to-square';
    }
    
    // Default icon for other tasks
    return 'fa-circle-check';
}

function getTaskIcon(title) {
    const title_lower = title.toLowerCase();
    
    // Research/Study tasks
    if (title_lower.includes('research') || title_lower.includes('study') || title_lower.includes('learn') || title_lower.includes('investigate')) {
        return 'fa-book';
    }
    
    // Meeting/Discussion tasks
    if (title_lower.includes('meet') || title_lower.includes('discuss') || title_lower.includes('call') || title_lower.includes('present')) {
        return 'fa-users';
    }
    
    // Document/Write tasks
    if (title_lower.includes('document') || title_lower.includes('write') || title_lower.includes('draft') || title_lower.includes('report')) {
        return 'fa-file-lines';
    }
    
    // Email/Communication tasks
    if (title_lower.includes('email') || title_lower.includes('send') || title_lower.includes('contact') || title_lower.includes('message')) {
        return 'fa-envelope';
    }
    
    // Design/Creative tasks
    if (title_lower.includes('design') || title_lower.includes('create') || title_lower.includes('draw') || title_lower.includes('sketch')) {
        return 'fa-palette';
    }
    
    // Testing/Review tasks
    if (title_lower.includes('test') || title_lower.includes('check') || title_lower.includes('review') || title_lower.includes('verify')) {
        return 'fa-clipboard-check';
    }
    
    // Planning/Scheduling tasks
    if (title_lower.includes('plan') || title_lower.includes('schedule') || title_lower.includes('organize') || title_lower.includes('prepare')) {
        return 'fa-calendar';
    }
    
    // Development/Implementation tasks
    if (title_lower.includes('implement') || title_lower.includes('code') || title_lower.includes('develop') || title_lower.includes('build')) {
        return 'fa-code';
    }
    
    // Analysis/Data tasks
    if (title_lower.includes('analyze') || title_lower.includes('data') || title_lower.includes('report') || title_lower.includes('calculate')) {
        return 'fa-chart-line';
    }
    
    // Update/Modify tasks
    if (title_lower.includes('update') || title_lower.includes('modify') || title_lower.includes('change') || title_lower.includes('revise')) {
        return 'fa-pen-to-square';
    }
    
    // Deadline/Priority tasks
    if (title_lower.includes('urgent') || title_lower.includes('priority') || title_lower.includes('deadline') || title_lower.includes('asap')) {
        return 'fa-bell';
    }
    
    // Bug/Issue tasks
    if (title_lower.includes('bug') || title_lower.includes('fix') || title_lower.includes('issue') || title_lower.includes('problem')) {
        return 'fa-bug';
    }

    // Default icon
    return 'fa-circle-dot';
}

function createSubtaskElement(parentTask, subtask) {
    const subtaskItem = document.createElement('div');
    subtaskItem.className = 'subtask-item';
    const iconClass = getTaskIcon(subtask.title);
    subtaskItem.innerHTML = `
        <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
        <i class="fas ${iconClass} subtask-icon"></i>
        <span class="editable ${subtask.completed ? 'completed' : ''}" contenteditable="true">${subtask.title}</span>
        <button class="delete-btn"><i class="fas fa-times"></i></button>
    `;

    // Get the elements
    const checkbox = subtaskItem.querySelector('input[type="checkbox"]');
    const titleSpan = subtaskItem.querySelector('span');
    const deleteBtn = subtaskItem.querySelector('.delete-btn');

    checkbox.addEventListener('change', () => {
        subtask.completed = checkbox.checked;
        titleSpan.classList.toggle('completed', subtask.completed);
        saveTasks();
    });

    titleSpan.addEventListener('blur', () => {
        subtask.title = titleSpan.textContent;
        saveTasks();
    });

    titleSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleSpan.blur();
        }
    });

    deleteBtn.addEventListener('click', () => {
        const index = parentTask.subtasks.findIndex(s => s.id === subtask.id);
        if (index !== -1) {
            parentTask.subtasks.splice(index, 1); // Remove only this specific subtask
            renderSubtasks(parentTask, subtaskItem.parentElement);
            saveTasks();
        }
    });

    return subtaskItem;
}

// Add task event listener
addTaskButton.addEventListener('click', () => {
    const title = taskInput.value.trim();
    if (title) {
        const task = createTask(title);
        tasks.push(task);
        renderTasks();
        saveTasks();
        taskInput.value = '';
    }
});

// Enter key event listener for task input
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTaskButton.click();
    }
});

// Settings Management
function getSettings() {
    const encryptedSettings = localStorage.getItem(SETTINGS_KEY);
    if (encryptedSettings) {
        try {
            const decryptedSettings = atob(encryptedSettings);
            return JSON.parse(decryptedSettings);
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }
    return {};
}

// Test connection with user input
async function testConnectionWithUserInput(settings) {
    console.log('Testing connection with provided settings...');
    
    try {
        const response = await fetch(`${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=2024-02-15-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': settings.key
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are a helpful task planner." },
                    { role: "user", content: "Test connection" }
                ],
                max_tokens: 50
            })
        });

        console.log('Response status:', response.status);
        console.log('Response status text:', response.statusText);

        const responseData = await response.text();
        console.log('Response data:', responseData);

        if (response.ok) {
            console.log('Connection successful!');
            return true;
        } else {
            console.error('Connection failed:', response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        return false;
    }
}

function loadSettings() {
    const settings = getSettings();
    apiEndpointInput.value = settings.endpoint || '';
    deploymentNameInput.value = settings.deploymentName || '';
    apiKeyInput.value = settings.key || '';
}

function saveSettings() {
    let endpoint = apiEndpointInput.value.trim();
    
    // Format the endpoint URL
    if (!endpoint.endsWith('.cognitiveservices.azure.com')) {
        endpoint = `${endpoint}.cognitiveservices.azure.com`;
    }
    if (!endpoint.startsWith('https://')) {
        endpoint = `https://${endpoint}`;
    }

    const settings = {
        endpoint: endpoint,
        deploymentName: deploymentNameInput.value.trim(),
        key: apiKeyInput.value.trim()
    };
    
    try {
        const encryptedSettings = btoa(JSON.stringify(settings));
        localStorage.setItem(SETTINGS_KEY, encryptedSettings);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

async function testConnection() {
    try {
        let settings = {
            endpoint: apiEndpointInput.value.trim(),
            deploymentName: deploymentNameInput.value.trim(),
            key: apiKeyInput.value.trim()
        };

        console.log('Original settings:', { 
            endpoint: settings.endpoint,
            deploymentName: settings.deploymentName,
            keyLength: settings.key?.length
        });

        // Validate settings
        if (!settings.endpoint || !settings.key || !settings.deploymentName) {
            throw new Error('Please enter all required fields: API endpoint, deployment name, and key');
        }

        // Format endpoint
        if (!settings.endpoint.endsWith('.cognitiveservices.azure.com')) {
            settings.endpoint = `${settings.endpoint}.cognitiveservices.azure.com`;
        }
        if (!settings.endpoint.startsWith('https://')) {
            settings.endpoint = `https://${settings.endpoint}`;
        }

        console.log('Formatted endpoint:', settings.endpoint);

        testConnectionBtn.innerHTML = '<div class="spinner"></div>Testing...';
        testConnectionBtn.disabled = true;

        // First, try a basic health check
        console.log('Attempting health check...');
        const healthResponse = await fetch(`${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=2024-02-15-preview/health`, {
            method: 'GET',
            headers: {
                'api-key': settings.key
            }
        });

        console.log('Health check response:', {
            status: healthResponse.status,
            statusText: healthResponse.statusText
        });

        // if (!healthResponse.ok) {
        //     const errorText = await healthResponse.text();
        //     console.error('Health check failed:', errorText);
        //     throw new Error(`Health check failed: ${healthResponse.status} ${healthResponse.statusText}`);
        // }

        // If health check passes, try deployment check
        console.log('Attempting deployment check...');
        const deploymentResponse = await fetch(`${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=2024-02-15-preview`, {
            method: 'GET',
            headers: {
                'api-key': settings.key,
                'Content-Type': 'application/json'
            }
        });

        console.log('Deployment check response:', {
            status: deploymentResponse.status,
            statusText: deploymentResponse.statusText
        });

        if (!deploymentResponse.ok) {
            const errorText = await deploymentResponse.text();
            console.error('Deployment check failed:', errorText);
            throw new Error(`Deployment check failed: ${deploymentResponse.status} ${deploymentResponse.statusText}`);
        }

        // If we get here, both checks passed
        console.log('All checks passed successfully');
        alert('Connection successful! API endpoint and deployment are valid.');

    } catch (error) {
        console.error('Connection test failed:', error);
        let errorMessage = 'Connection failed. ';

        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Could not reach the API endpoint. Please check:\n' +
                          '1. The endpoint URL is correct\n' +
                          '2. You have internet connectivity\n' +
                          '3. No firewall is blocking the connection';
        } else if (error.message.includes('401')) {
            errorMessage += 'Authentication failed. Please check your API key.';
        } else if (error.message.includes('404')) {
            errorMessage += 'Deployment not found. Please check the deployment name.';
        } else if (error.message.includes('403')) {
            errorMessage += 'Access forbidden. Please check your API key permissions.';
        } else {
            errorMessage += error.message;
        }

        alert(errorMessage);
    } finally {
        testConnectionBtn.innerHTML = 'Test Connection';
        testConnectionBtn.disabled = false;
    }
}

// Clear settings function
function clearSettings() {
    apiEndpointInput.value = '';
    deploymentNameInput.value = '';
    apiKeyInput.value = '';
}

// Tab Switching
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update button states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update content visibility
        const tabName = button.getAttribute('data-tab');
        document.getElementById('activeTab').style.display = tabName === 'active' ? 'block' : 'none';
        document.getElementById('archiveTab').style.display = tabName === 'archive' ? 'block' : 'none';

        // Refresh the appropriate view
        if (tabName === 'archive') {
            renderArchivedTasks();
        } else {
            renderTasks();
        }
    });
});

// Settings Modal Event Listeners
settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

const clearSettingsBtn = document.getElementById('clearSettings');
clearSettingsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all settings?')) {
        clearSettings();
        localStorage.removeItem(SETTINGS_KEY);
        alert('Settings cleared successfully!');
    }
});

saveSettingsBtn.addEventListener('click', () => {
    if (saveSettings()) {
        alert('Settings saved successfully!');
        settingsModal.style.display = 'none';
    } else {
        alert('Error saving settings. Please try again.');
    }
});

testConnectionBtn.addEventListener('click', async () => {
    // Get current input values
    const settings = {
        endpoint: apiEndpointInput.value.trim(),
        deploymentName: deploymentNameInput.value.trim(),
        key: apiKeyInput.value.trim()
    };

    // Validate inputs
    if (!settings.endpoint || !settings.deploymentName || !settings.key) {
        alert('Please fill in all fields: API endpoint, deployment name, and API key');
        return;
    }

    // Format endpoint URL if needed
    if (!settings.endpoint.endsWith('.cognitiveservices.azure.com')) {
        settings.endpoint = `${settings.endpoint}.cognitiveservices.azure.com`;
    }
    if (!settings.endpoint.startsWith('https://')) {
        settings.endpoint = `https://${settings.endpoint}`;
    }

    testConnectionBtn.innerHTML = '<div class="spinner"></div>Testing...';
    testConnectionBtn.disabled = true;
    
    try {
        const result = await testConnectionWithUserInput(settings);
        if (result) {
            alert('Connection successful! The API endpoint is working correctly.');
        } else {
            alert('Connection failed. Please check the console for detailed error messages.');
        }
    } catch (error) {
        console.error('Test failed:', error);
        alert('Connection test failed. Please check the console for detailed error messages.');
    } finally {
        testConnectionBtn.innerHTML = 'Test Connection';
        testConnectionBtn.disabled = false;
    }
});

window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Initialize the app
loadTasks();
loadSettings();