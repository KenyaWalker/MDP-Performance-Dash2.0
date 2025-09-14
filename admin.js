class AdminPanel {
    constructor() {
        this.allResponses = [];
        this.filteredResponses = [];
        this.filters = {
            mdp: '',
            function: '',
            manager: '',
            rotation: '',        modalTitle.textContent = `${this.formatNameForPrivacy(response.mdpName)} - Rotation ${response.rotation}`;
        
        modalBody.innerHTML = `
            <div class="response-section">
                <div class="section-title">Participant Information</div>
                <p><strong>MDP Name:</strong> ${this.formatNameForPrivacy(response.mdpName)}</p>
                <p><strong>Function:</strong> ${response.functionName}</p>
                <p><strong>Manager:</strong> ${response.manager}</p>
                <p><strong>Rotation:</strong> ${response.rotation}</p>
                <p><strong>Submitted:</strong> ${new Date(response.submittedAt).toLocaleString()}</p>
            </div>`;  search: ''
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadResponses();
    }

    setupEventListeners() {
        // Filter event listeners
        document.getElementById('mdpFilter').addEventListener('change', (e) => {
            this.filters.mdp = e.target.value;
            this.applyFilters();
        });

        document.getElementById('functionFilter').addEventListener('change', (e) => {
            this.filters.function = e.target.value;
            this.applyFilters();
        });

        document.getElementById('managerFilter').addEventListener('change', (e) => {
            this.filters.manager = e.target.value;
            this.applyFilters();
        });

        document.getElementById('rotationFilter').addEventListener('change', (e) => {
            this.filters.rotation = e.target.value;
            this.applyFilters();
        });

        document.getElementById('searchFilter').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('responseModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    async loadResponses() {
        try {
            const response = await fetch('/api/survey-responses');
            if (!response.ok) throw new Error('Failed to load responses');
            
            this.allResponses = await response.json();
            this.populateFilters();
            this.applyFilters();
            this.updateStats();
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error loading responses:', error);
            document.getElementById('tableContent').innerHTML = 
                '<div class="no-data">Error loading responses. Please try again.</div>';
        }
    }

    populateFilters() {
        // Populate MDP filter
        const mdps = [...new Set(this.allResponses.map(r => r.mdpName))].sort();
        this.populateSelect('mdpFilter', mdps, 'All MDPs');

        // Populate Function filter
        const functions = [...new Set(this.allResponses.map(r => r.functionName))].sort();
        this.populateSelect('functionFilter', functions, 'All Functions');

        // Populate Manager filter (normalized)
        const managers = [...new Set(this.allResponses.map(r => 
            r.manager.trim().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
        ))].sort();
        this.populateSelect('managerFilter', managers, 'All Managers');

        // Populate Rotation filter
        const rotations = [...new Set(this.allResponses.map(r => r.rotation))].sort((a, b) => a - b);
        this.populateSelect('rotationFilter', rotations, 'All Rotations');
    }

    populateSelect(selectId, options, defaultText) {
        const select = document.getElementById(selectId);
        select.innerHTML = `<option value="">${defaultText}</option>`;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
    }

    applyFilters() {
        this.filteredResponses = this.allResponses.filter(response => {
            // Normalize manager name for comparison
            const normalizedManager = response.manager.trim().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');

            return (
                (!this.filters.mdp || response.mdpName === this.filters.mdp) &&
                (!this.filters.function || response.functionName === this.filters.function) &&
                (!this.filters.manager || normalizedManager === this.filters.manager) &&
                (!this.filters.rotation || response.rotation.toString() === this.filters.rotation) &&
                (!this.filters.search || 
                    response.mdpName.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                    response.manager.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                    response.functionName.toLowerCase().includes(this.filters.search.toLowerCase())
                )
            );
        });

        this.renderTable();
        this.updateStats();
    }

    renderTable() {
        const tableContent = document.getElementById('tableContent');
        
        if (this.filteredResponses.length === 0) {
            tableContent.innerHTML = '<div class="no-data">No responses match your filters.</div>';
            return;
        }

        const tableHTML = `
            <table class="responses-table">
                <thead>
                    <tr>
                        <th>MDP Name</th>
                        <th>Function</th>
                        <th>Manager</th>
                        <th>Rotation</th>
                        <th>Overall Score</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.filteredResponses.map(response => this.renderResponseRow(response)).join('')}
                </tbody>
            </table>
        `;

        tableContent.innerHTML = tableHTML;
    }

    // Privacy: Format names as "First Name L." for display
    formatNameForPrivacy(fullName) {
        if (!fullName || fullName === 'Anonymous' || fullName === 'N/A') {
            return fullName;
        }
        
        const nameParts = fullName.trim().split(' ');
        if (nameParts.length === 1) {
            return nameParts[0]; // Just first name if only one name provided
        }
        
        const firstName = nameParts[0];
        const lastNameInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
        return `${firstName} ${lastNameInitial}.`;
    }

    renderResponseRow(response) {
        const scoreClass = this.getScoreClass(response.overall);
        const submittedDate = new Date(response.submittedAt).toLocaleDateString();
        
        return `
            <tr>
                <td><strong>${this.formatNameForPrivacy(response.mdpName)}</strong></td>
                <td>${response.functionName}</td>
                <td>${response.manager}</td>
                <td>Rotation ${response.rotation}</td>
                <td><span class="score-badge ${scoreClass}">${response.overall.toFixed(2)}</span></td>
                <td>${submittedDate}</td>
                <td>
                    <button class="action-btn" onclick="admin.viewResponse('${response.id}')">View Details</button>
                    <button class="action-btn" onclick="admin.exportSingleResponse('${response.id}')">Export</button>
                </td>
            </tr>
        `;
    }

    getScoreClass(score) {
        if (score >= 4.5) return 'score-excellent';
        if (score >= 4.0) return 'score-good';
        if (score >= 3.0) return 'score-fair';
        return 'score-poor';
    }

    updateStats() {
        const responses = this.filteredResponses;
        
        // Total responses
        document.getElementById('totalResponses').textContent = responses.length;
        
        // Unique MDPs
        const uniqueMdps = new Set(responses.map(r => r.mdpName)).size;
        document.getElementById('uniqueMdps').textContent = uniqueMdps;
        
        // Average score
        const avgScore = responses.length > 0 
            ? (responses.reduce((sum, r) => sum + r.overall, 0) / responses.length).toFixed(2)
            : '--';
        document.getElementById('avgScore').textContent = avgScore;
        
        // Latest rotation
        const latestRotation = responses.length > 0 
            ? Math.max(...responses.map(r => parseInt(r.rotation)))
            : '--';
        document.getElementById('latestRotation').textContent = latestRotation;
    }

    updateLastUpdated() {
        const now = new Date().toLocaleString();
        document.getElementById('lastUpdated').textContent = `Last updated: ${now}`;
    }

    viewResponse(responseId) {
        const response = this.allResponses.find(r => r.id === responseId);
        if (!response) return;

        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        modalTitle.textContent = `${this.formatNameForPrivacy(response.mdpName)} - Rotation ${response.rotation}`;
        
        modalBody.innerHTML = `
            <div class="response-section">
                <div class="section-title">Participant Information</div>
                <p><strong>MDP Name:</strong> ${this.formatNameForPrivacy(response.mdpName)}</p>
                <p><strong>Function:</strong> ${response.functionName}</p>
                <p><strong>Manager:</strong> ${response.manager}</p>
                <p><strong>Rotation:</strong> ${response.rotation}</p>
                <p><strong>Submitted:</strong> ${new Date(response.submittedAt).toLocaleString()}</p>
            </div>

            <div class="response-section">
                <div class="section-title">Performance Scores</div>
                <p><strong>Overall Score:</strong> <span class="score-badge ${this.getScoreClass(response.overall)}">${response.overall.toFixed(2)}</span></p>
                <p><strong>Job Knowledge:</strong> ${response.jobKnowledge.toFixed(2)}</p>
                <p><strong>Quality of Work:</strong> ${response.qualityOfWork.toFixed(2)}</p>
                <p><strong>Communication:</strong> ${response.communication.toFixed(2)}</p>
                <p><strong>Initiative:</strong> ${response.initiative.toFixed(2)}</p>
            </div>

            <div class="response-section">
                <div class="section-title">Individual Question Responses</div>
                ${this.renderQuestionResponses(response)}
            </div>

            <div class="response-section">
                <div class="section-title">Export Options</div>
                <button class="export-btn" onclick="admin.exportSingleResponse('${response.id}')">Export This Response</button>
            </div>
        `;

        document.getElementById('responseModal').style.display = 'block';
    }

    renderQuestionResponses(response) {
        const questions = Object.entries(response.responses);
        return questions.map(([questionId, score]) => `
            <div class="question-item">
                <div class="question-text">Question ${questionId.substring(1)}</div>
                <div class="question-answer">
                    <span>Score: <span class="answer-score">${score}</span></span>
                </div>
            </div>
        `).join('');
    }

    closeModal() {
        document.getElementById('responseModal').style.display = 'none';
    }

    exportSingleResponse(responseId) {
        const response = this.allResponses.find(r => r.id === responseId);
        if (!response) return;

        const csvContent = this.generateCSV([response]);
        const filename = `${this.formatNameForPrivacy(response.mdpName).replace(' ', '_')}_Rotation_${response.rotation}_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadCSV(csvContent, filename);
    }

    exportAllResponses() {
        const csvContent = this.generateCSV(this.allResponses);
        const filename = `All_Survey_Responses_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadCSV(csvContent, filename);
    }

    exportFilteredResponses() {
        const csvContent = this.generateCSV(this.filteredResponses);
        const filename = `Filtered_Survey_Responses_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadCSV(csvContent, filename);
    }

    generateCSV(responses) {
        if (responses.length === 0) return '';

        // CSV Headers
        const headers = [
            'MDP Name',
            'Function',
            'Manager',
            'Rotation',
            'Overall Score',
            'Job Knowledge',
            'Quality of Work',
            'Communication',
            'Initiative',
            'Submitted Date',
            'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'
        ];

        // CSV Rows
        const rows = responses.map(response => [
            this.formatNameForPrivacy(response.mdpName),
            response.functionName,
            response.manager,
            response.rotation,
            response.overall.toFixed(2),
            response.jobKnowledge.toFixed(2),
            response.qualityOfWork.toFixed(2),
            response.communication.toFixed(2),
            response.initiative.toFixed(2),
            new Date(response.submittedAt).toLocaleString(),
            ...Object.values(response.responses)
        ]);

        // Combine headers and rows
        const csvArray = [headers, ...rows];
        
        // Convert to CSV string
        return csvArray.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// Global functions for onclick handlers
window.loadResponses = () => admin.loadResponses();
window.exportAllResponses = () => admin.exportAllResponses();
window.exportFilteredResponses = () => admin.exportFilteredResponses();
window.closeModal = () => admin.closeModal();

// Initialize admin panel
const admin = new AdminPanel();