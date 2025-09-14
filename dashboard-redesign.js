// MDP Performance Dashboard - Redesigned
// Maintains existing API endpoints while implementing new UI architecture

class MDPDashboard {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.charts = {};
        this.viewMode = 'cohort';
        this.selectedMdpA = '';
        this.selectedMdpB = '';
        this.selectedIndividualMdp = '';
        this.filters = {
            function: '',
            manager: '',
            rotation: '',
            search: ''
        };
        
        // Assessment areas as defined in requirements
        this.assessmentAreas = [
            'Job Knowledge',
            'Quality of Work', 
            'Communication Skills & Teamwork',
            'Initiative & Productivity'
        ];
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.populateFilters();
            this.updateLastUpdated();
            this.render();
            this.loadUserPreferences();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
        }
    }

    async loadData() {
        try {
            const response = await fetch('/api/survey-responses');
            if (!response.ok) throw new Error('Failed to fetch data');
            
            const rawData = await response.json();
            
            // Transform data to match expected structure
            this.data = rawData.map(item => ({
                ...item,
                mdpId: item.id,
                rotation: typeof item.rotation === 'string' ? 
                    parseInt(item.rotation.replace('Rotation ', '')) : 
                    parseInt(item.rotation), // Handle both string and numeric rotation values
                scores: {
                    'Job Knowledge': item.jobKnowledge || 0,
                    'Quality of Work': item.qualityOfWork || 0,
                    'Communication Skills & Teamwork': item.communication || 0,
                    'Initiative & Productivity': item.initiative || 0
                }
            }));
            
            this.filteredData = [...this.data];
            console.log('Data loaded and transformed:', this.data.length, 'records');
        } catch (error) {
            console.error('Error loading data:', error);
            this.data = [];
            this.filteredData = [];
        }
    }

    setupEventListeners() {
        // Mode selection
        document.getElementById('modeSelect').addEventListener('change', (e) => {
            this.handleModeChange(e.target.value);
        });

        // Filters
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

        // Comparison selects
        document.getElementById('mdpA').addEventListener('change', (e) => {
            this.selectedMdpA = e.target.value;
            this.validateComparison();
            this.render();
        });

        document.getElementById('mdpB').addEventListener('change', (e) => {
            this.selectedMdpB = e.target.value;
            this.validateComparison();
            this.render();
        });

        // Significant delta toggle
        document.getElementById('significantDelta').addEventListener('change', () => {
            this.render();
        });
    }

    handleModeChange(value) {
        if (value === 'cohort' || value === 'compare') {
            this.viewMode = value;
        } else {
            // Individual MDP selected
            this.viewMode = 'individual';
            this.selectedIndividualMdp = value;
        }
        
        this.updateModeBadge();
        this.showHideComparisonPicker();
        this.render();
        this.saveUserPreferences();
    }

    updateModeBadge() {
        const badge = document.getElementById('modeBadge');
        switch (this.viewMode) {
            case 'cohort':
                badge.textContent = 'Cohort (filtered)';
                break;
            case 'compare':
                badge.textContent = 'Comparison (A vs B)';
                break;
            case 'individual':
                badge.textContent = `Individual (${this.formatNameForPrivacy(this.selectedIndividualMdp)})`;
                break;
        }
    }

    showHideComparisonPicker() {
        const picker = document.getElementById('comparisonPicker');
        const deltaToggle = document.getElementById('deltaToggle');
        
        if (this.viewMode === 'compare') {
            picker.style.display = 'block';
            deltaToggle.style.display = 'flex';
        } else {
            picker.style.display = 'none';
            deltaToggle.style.display = 'none';
        }
    }

    validateComparison() {
        if (this.viewMode === 'compare' && this.selectedMdpA && this.selectedMdpB && this.selectedMdpA === this.selectedMdpB) {
            // Show error - MDPs must be different
            const picker = document.getElementById('comparisonPicker');
            let errorMsg = picker.querySelector('.error-message');
            if (!errorMsg) {
                errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.style.cssText = 'color: var(--danger); font-size: 0.9rem; margin-top: 0.5rem;';
                picker.appendChild(errorMsg);
            }
            errorMsg.textContent = 'Error: Please select two different associates for comparison';
            return false;
        } else {
            // Remove error message
            const picker = document.getElementById('comparisonPicker');
            const errorMsg = picker.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
            return true;
        }
    }

    populateFilters() {
        this.populateModeSelect();
        this.populateFunctionFilter();
        this.populateManagerFilter();
        this.populateRotationFilter();
        this.populateComparisonSelects();
    }

    populateModeSelect() {
        const select = document.getElementById('modeSelect');
        
        // Get unique MDP names and sort alphabetically
        const mdpNames = [...new Set(this.data.map(item => item.mdpName))].sort();
        
        // Clear existing individual options (keep cohort, compare, divider)
        const existingOptions = Array.from(select.options);
        existingOptions.forEach((option, index) => {
            if (index > 2) { // Remove everything after the divider
                select.removeChild(option);
            }
        });

        // Add MDP names
        mdpNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = this.formatNameForPrivacy(name);
            select.appendChild(option);
        });
    }

    populateFunctionFilter() {
        const select = document.getElementById('functionFilter');
        const functions = [...new Set(this.data.map(item => item.functionName))].sort();
        
        // Clear existing options except "All Functions"
        select.innerHTML = '<option value="">All Functions</option>';
        
        functions.forEach(func => {
            const option = document.createElement('option');
            option.value = func;
            option.textContent = func;
            select.appendChild(option);
        });
    }

    populateManagerFilter() {
        const select = document.getElementById('managerFilter');
        // Normalize manager names (trim spaces and proper case)
        const normalizedManagers = this.data.map(item => {
            return item.manager.trim().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        });
        const managers = [...new Set(normalizedManagers)].sort();
        
        // Clear existing options except "All Managers"
        select.innerHTML = '<option value="">All Managers</option>';
        
        managers.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager;
            option.textContent = manager;
            select.appendChild(option);
        });
    }

    populateRotationFilter() {
        const select = document.getElementById('rotationFilter');
        const rotations = [...new Set(this.data.map(item => item.rotation))].sort((a, b) => a - b);
        
        // Clear existing options except "All Rotations"
        select.innerHTML = '<option value="">All Rotations</option>';
        
        rotations.forEach(rotation => {
            const option = document.createElement('option');
            option.value = rotation;
            option.textContent = `Rotation ${rotation}`;
            select.appendChild(option);
        });
    }

    populateComparisonSelects() {
        const mdpNames = [...new Set(this.data.map(item => item.mdpName))].sort();
        
        ['mdpA', 'mdpB'].forEach(selectId => {
            const select = document.getElementById(selectId);
            const placeholder = selectId === 'mdpA' ? 'Select First Associate...' : 'Select Second Associate...';
            
            select.innerHTML = `<option value="">${placeholder}</option>`;
            
            mdpNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = this.formatNameForPrivacy(name);
                select.appendChild(option);
            });
        });
    }

    applyFilters() {
        this.filteredData = this.data.filter(item => {
            if (this.filters.function && item.functionName !== this.filters.function) return false;
            
            // Normalize manager names for comparison
            if (this.filters.manager) {
                const normalizedItemManager = item.manager.trim().split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
                if (normalizedItemManager !== this.filters.manager) return false;
            }
            
            if (this.filters.rotation && item.rotation.toString() !== this.filters.rotation) return false;
            if (this.filters.search && !item.mdpName.toLowerCase().includes(this.filters.search.toLowerCase())) return false;
            return true;
        });
        
        this.render();
    }

    // Data Adapter Helper Functions
    getCohortAverages(rows) {
        if (!rows.length) return { overall: 0, byArea: {}, byRotation: {} };
        
        const overall = rows.reduce((sum, item) => sum + item.overall, 0) / rows.length;
        
        const byArea = {};
        this.assessmentAreas.forEach(area => {
            const scores = rows.map(item => item.scores[area]).filter(score => score !== undefined);
            byArea[area] = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
        });
        
        const byRotation = {};
        const rotations = [...new Set(rows.map(item => item.rotation))];
        rotations.forEach(rotation => {
            const rotationData = rows.filter(item => item.rotation === rotation);
            byRotation[rotation] = rotationData.length ? 
                rotationData.reduce((sum, item) => sum + item.overall, 0) / rotationData.length : 0;
        });
        
        return { overall, byArea, byRotation };
    }

    getTopPerformer(rows) {
        if (!rows.length) return { mdpId: '', mdpName: '', score: 0, isTied: false };
        
        // Get latest score for each MDP
        const mdpLatest = {};
        rows.forEach(item => {
            const key = item.mdpName;
            if (!mdpLatest[key] || new Date(item.submittedAt) > new Date(mdpLatest[key].submittedAt)) {
                mdpLatest[key] = item;
            }
        });
        
        const performers = Object.values(mdpLatest);
        
        // Find the highest score
        const maxScore = Math.max(...performers.map(p => p.overall));
        
        // Find all performers with the max score
        const topPerformers = performers.filter(p => p.overall === maxScore);
        
        // Check if there's a tie
        if (topPerformers.length > 1) {
            return {
                mdpId: 'multiple',
                mdpName: `${topPerformers.length} Associates Tied`,
                score: maxScore,
                isTied: true,
                tiedNames: topPerformers.map(p => p.mdpName)
            };
        } else {
            const top = topPerformers[0];
            return {
                mdpId: top.mdpId || top.mdpName,
                mdpName: top.mdpName,
                score: top.overall,
                isTied: false
            };
        }
    }

    getAreaExtrema(byArea) {
        const areas = Object.keys(byArea);
        if (!areas.length) return { strengthArea: '', devArea: '' };
        
        const strengthArea = areas.reduce((best, current) => 
            byArea[current] > byArea[best] ? current : best
        );
        
        const devArea = areas.reduce((lowest, current) => 
            byArea[current] < byArea[lowest] ? current : lowest
        );
        
        return { strengthArea, devArea };
    }

    getMdpSeries(rows, mdpId) {
        const mdpData = rows.filter(item => item.mdpName === mdpId);
        const byRotation = {};
        
        mdpData.forEach(item => {
            byRotation[item.rotation] = {
                overall: item.overall,
                byArea: { ...item.scores }
            };
        });
        
        return { byRotation };
    }

    compareMdps(rows, aId, bId) {
        const aData = rows.filter(item => item.mdpName === aId);
        const bData = rows.filter(item => item.mdpName === bId);
        
        if (!aData.length || !bData.length) {
            return {
                overall: { a: 0, b: 0, delta: 0 },
                bestRotation: { a: { rot: 0, score: 0 }, b: { rot: 0, score: 0 } },
                byArea: {}
            };
        }
        
        // Get latest scores
        const latestA = aData[aData.length - 1];
        const latestB = bData[bData.length - 1];
        
        const overall = {
            a: latestA.overall,
            b: latestB.overall,
            delta: latestA.overall - latestB.overall
        };
        
        // Find best rotations
        const bestA = aData.reduce((best, current) => 
            current.overall > best.overall ? current : best
        );
        const bestB = bData.reduce((best, current) => 
            current.overall > best.overall ? current : best
        );
        
        const bestRotation = {
            a: { rot: bestA.rotation, score: bestA.overall },
            b: { rot: bestB.rotation, score: bestB.overall }
        };
        
        // Compare by area
        const byArea = {};
        const cohortAverages = this.getCohortAverages(rows);
        
        this.assessmentAreas.forEach(area => {
            const aScore = latestA.scores[area] || 0;
            const bScore = latestB.scores[area] || 0;
            
            byArea[area] = {
                a: aScore,
                b: bScore,
                delta: aScore - bScore,
                cohort: cohortAverages.byArea[area] || 0
            };
        });
        
        return { overall, bestRotation, byArea };
    }

    // Rendering Methods
    render() {
        this.renderDynamicSummary();
        this.renderTiles();
        this.renderCharts();
        this.renderTable();
    }

    renderDynamicSummary() {
        const summary = document.getElementById('dynamicSummary');
        
        switch (this.viewMode) {
            case 'cohort':
                // Hide summary for cohort view - cleaner look
                summary.style.display = 'none';
                break;
                
            case 'individual':
                summary.style.display = 'none';
                break;
                
            case 'compare':
                summary.style.display = 'none';
                break;
        }
    }

    renderTiles() {
        const grid = document.getElementById('tilesGrid');
        
        switch (this.viewMode) {
            case 'cohort':
                grid.innerHTML = this.renderCohortTiles();
                break;
            case 'compare':
                grid.innerHTML = this.renderCompareTiles();
                break;
            case 'individual':
                grid.innerHTML = this.renderIndividualTiles();
                break;
        }
    }

    renderCohortTiles() {
        const averages = this.getCohortAverages(this.filteredData);
        const topPerformer = this.getTopPerformer(this.filteredData);
        const { strengthArea, devArea } = this.getAreaExtrema(averages.byArea);
        
        const mdpCount = new Set(this.filteredData.map(item => item.mdpName)).size;
        
        return `
            <div class="tile" onclick="dashboard.filterByOverall()">
                <div class="tile-header">
                    <div class="tile-title">Cohort Average</div>
                    <div class="score-badge ${this.getScoreClass(averages.overall)}">${averages.overall.toFixed(2)}</div>
                </div>
                <div class="tile-value">${averages.overall.toFixed(2)}</div>
                <div class="tile-subtitle">${mdpCount} MDPs</div>
            </div>
            
            <div class="tile" ${topPerformer.isTied ? '' : `onclick="dashboard.filterByMdp('${topPerformer.mdpName}')"`}>
                <div class="tile-header">
                    <div class="tile-title">Top Performer${topPerformer.isTied ? 's' : ''}</div>
                    <div class="score-badge ${this.getScoreClass(topPerformer.score)}">${topPerformer.score.toFixed(2)}</div>
                </div>
                <div class="tile-value">${this.formatNameForPrivacy(topPerformer.mdpName)}</div>
                <div class="tile-subtitle">${topPerformer.isTied ? topPerformer.tiedNames.map(name => this.formatNameForPrivacy(name)).join(', ') : `Score: ${topPerformer.score.toFixed(2)}`}</div>
            </div>
            
            <div class="tile" onclick="dashboard.filterByArea('${strengthArea}')">
                <div class="tile-header">
                    <div class="tile-title">Cohort Strength</div>
                    <div class="score-badge ${this.getScoreClass(averages.byArea[strengthArea])}">${averages.byArea[strengthArea]?.toFixed(2) || 'N/A'}</div>
                </div>
                <div class="tile-value">${strengthArea}</div>
                <div class="tile-subtitle">${averages.byArea[strengthArea]?.toFixed(2) || 'N/A'}</div>
            </div>
            
            <div class="tile" onclick="dashboard.filterByArea('${devArea}')">
                <div class="tile-header">
                    <div class="tile-title">Development Area</div>
                    <div class="score-badge ${this.getScoreClass(averages.byArea[devArea])}">${averages.byArea[devArea]?.toFixed(2) || 'N/A'}</div>
                </div>
                <div class="tile-value">${devArea}</div>
                <div class="tile-subtitle">${averages.byArea[devArea]?.toFixed(2) || 'N/A'}</div>
            </div>
        `;
    }

    renderCompareTiles() {
        if (!this.selectedMdpA && !this.selectedMdpB) {
            return `
                <div class="tile" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div class="tile-header">
                        <div class="tile-title">Select MDPs</div>
                    </div>
                    <div class="tile-value" style="font-size: 1.5rem; margin: 1rem 0;">📊</div>
                    <div class="tile-subtitle">Choose two associates to compare side by side</div>
                </div>
            `;
        }
        
        if (!this.selectedMdpA || !this.selectedMdpB) {
            const missing = !this.selectedMdpA ? 'First Associate' : 'Second Associate';
            return `
                <div class="tile" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div class="tile-header">
                        <div class="tile-title">Select ${missing}</div>
                    </div>
                    <div class="tile-value" style="font-size: 1.5rem; margin: 1rem 0;">⚠️</div>
                    <div class="tile-subtitle">Select ${missing} to continue with the comparison</div>
                </div>
            `;
        }
        
        if (!this.validateComparison()) {
            return `
                <div class="tile" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div class="tile-header">
                        <div class="tile-title">Invalid Selection</div>
                    </div>
                    <div class="tile-value" style="font-size: 1.5rem; margin: 1rem 0; color: var(--danger);">❌</div>
                    <div class="tile-subtitle">Please select two different associates</div>
                </div>
            `;
        }
        
        const comparison = this.compareMdps(this.filteredData, this.selectedMdpA, this.selectedMdpB);
        const { strengthArea: strengthA, devArea: devA } = this.getAreaExtrema(
            Object.fromEntries(this.assessmentAreas.map(area => [area, comparison.byArea[area]?.a || 0]))
        );
        const { strengthArea: strengthB, devArea: devB } = this.getAreaExtrema(
            Object.fromEntries(this.assessmentAreas.map(area => [area, comparison.byArea[area]?.b || 0]))
        );
        
        return `
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Overall Comparison</div>
                    <div class="score-badge ${comparison.overall.delta >= 0 ? 'score-high' : 'score-low'}">
                        ${comparison.overall.delta >= 0 ? '+' : ''}${comparison.overall.delta.toFixed(2)}
                    </div>
                </div>
                <div class="tile-value" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpA}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">${comparison.overall.a.toFixed(2)}</div>
                    </div>
                    <div style="font-size: 1rem; color: var(--neutral1);">vs</div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpB}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">${comparison.overall.b.toFixed(2)}</div>
                    </div>
                </div>
                <div class="tile-subtitle">Overall Performance</div>
            </div>
            
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Best Rotations</div>
                </div>
                <div class="tile-value" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpA}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">R${comparison.bestRotation.a.rot}: ${comparison.bestRotation.a.score.toFixed(2)}</div>
                    </div>
                    <div style="font-size: 1rem; color: var(--neutral1);">vs</div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpB}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">R${comparison.bestRotation.b.rot}: ${comparison.bestRotation.b.score.toFixed(2)}</div>
                    </div>
                </div>
                <div class="tile-subtitle">Highest Performing Rotation</div>
            </div>
            
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Strengths</div>
                </div>
                <div class="tile-value" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpA}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">${strengthA}: ${comparison.byArea[strengthA]?.a.toFixed(2)}</div>
                    </div>
                    <div style="font-size: 1rem; color: var(--neutral1);">vs</div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpB}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">${strengthB}: ${comparison.byArea[strengthB]?.b.toFixed(2)}</div>
                    </div>
                </div>
                <div class="tile-subtitle">Top Assessment Areas</div>
            </div>
            
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Development Areas</div>
                </div>
                <div class="tile-value" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpA}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">${devA}: ${comparison.byArea[devA]?.a.toFixed(2)}</div>
                    </div>
                    <div style="font-size: 1rem; color: var(--neutral1);">vs</div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: var(--neutral1);">${this.selectedMdpB}</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">${devB}: ${comparison.byArea[devB]?.b.toFixed(2)}</div>
                    </div>
                </div>
                <div class="tile-subtitle">Areas for Growth</div>
            </div>
        `;
    }

    renderIndividualTiles() {
        const mdpData = this.filteredData.filter(item => item.mdpName === this.selectedIndividualMdp);
        
        if (!mdpData.length) {
            return `
                <div class="tile">
                    <div class="tile-header">
                        <div class="tile-title">No Data</div>
                    </div>
                    <div class="tile-value">--</div>
                    <div class="tile-subtitle">No data available for ${this.selectedIndividualMdp}</div>
                </div>
            `;
        }
        
        const latest = mdpData[mdpData.length - 1];
        const topRotation = mdpData.reduce((best, current) => 
            current.overall > best.overall ? current : best
        );
        
        const { strengthArea, devArea } = this.getAreaExtrema(latest.scores);
        
        return `
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Overall Score</div>
                    <div class="score-badge ${this.getScoreClass(latest.overall)}">${latest.overall.toFixed(2)}</div>
                </div>
                <div class="tile-value">${latest.overall.toFixed(2)}</div>
                <div class="tile-subtitle">Latest Assessment</div>
            </div>
            
            <div class="tile" onclick="dashboard.filterByRotation(${topRotation.rotation})">
                <div class="tile-header">
                    <div class="tile-title">Top Rotation</div>
                    <div class="score-badge ${this.getScoreClass(topRotation.overall)}">${topRotation.overall.toFixed(2)}</div>
                </div>
                <div class="tile-value">Rotation ${topRotation.rotation}</div>
                <div class="tile-subtitle">Score: ${topRotation.overall.toFixed(2)}</div>
            </div>
            
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Individual Strength</div>
                    <div class="score-badge ${this.getScoreClass(latest.scores[strengthArea])}">${latest.scores[strengthArea]?.toFixed(2)}</div>
                </div>
                <div class="tile-value">${strengthArea}</div>
                <div class="tile-subtitle">${latest.scores[strengthArea]?.toFixed(2)}</div>
            </div>
            
            <div class="tile">
                <div class="tile-header">
                    <div class="tile-title">Development Focus</div>
                    <div class="score-badge ${this.getScoreClass(latest.scores[devArea])}">${latest.scores[devArea]?.toFixed(2)}</div>
                </div>
                <div class="tile-value">${devArea}</div>
                <div class="tile-subtitle">${latest.scores[devArea]?.toFixed(2)}</div>
            </div>
        `;
    }

    renderCharts() {
        const grid = document.getElementById('chartsGrid');
        
        switch (this.viewMode) {
            case 'cohort':
                grid.innerHTML = this.renderCohortCharts();
                break;
            case 'compare':
                grid.innerHTML = this.renderCompareCharts();
                break;
            case 'individual':
                grid.innerHTML = this.renderIndividualCharts();
                break;
        }
        
        // Initialize charts after DOM update
        setTimeout(() => this.initializeCharts(), 100);
    }

    renderCohortCharts() {
        return `
            <div class="chart-container">
                <h4 class="chart-title">Average Overall by Rotation</h4>
                <canvas id="rotationChart" class="chart-canvas"></canvas>
            </div>
            <div class="chart-container">
                <h4 class="chart-title">Function × Assessment Heatmap</h4>
                <canvas id="heatmapChart" class="chart-canvas"></canvas>
            </div>
        `;
    }

    renderCompareCharts() {
        if (!this.selectedMdpA || !this.selectedMdpB) {
            return `
                <div class="chart-container">
                    <div class="chart-title">Select both MDPs to view comparison charts</div>
                </div>
            `;
        }
        
        return `
            <div class="chart-container">
                <h4 class="chart-title">Overall by Rotation Comparison</h4>
                <canvas id="compareTrendChart" class="chart-canvas"></canvas>
            </div>
            <div class="chart-container">
                <h4 class="chart-title">Assessment Profile Comparison</h4>
                <canvas id="compareRadarChart" class="chart-canvas"></canvas>
            </div>
            <div class="chart-container">
                <h4 class="chart-title">Per-Area Comparison</h4>
                <canvas id="compareBarChart" class="chart-canvas"></canvas>
            </div>
        `;
    }

    renderIndividualCharts() {
        return `
            <div class="chart-container">
                <h4 class="chart-title">Overall by Rotation</h4>
                <canvas id="trendChart" class="chart-canvas"></canvas>
            </div>
            <div class="chart-container">
                <h4 class="chart-title">Assessment Profile</h4>
                <canvas id="radarChart" class="chart-canvas"></canvas>
            </div>
            <div class="chart-container">
                <h4 class="chart-title">vs Cohort Average</h4>
                <canvas id="cohortCompareChart" class="chart-canvas"></canvas>
            </div>
        `;
    }

    initializeCharts() {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};

        switch (this.viewMode) {
            case 'cohort':
                this.createRotationChart();
                this.createHeatmapChart();
                break;
            case 'compare':
                if (this.selectedMdpA && this.selectedMdpB) {
                    this.createCompareTrendChart();
                    this.createCompareRadarChart();
                    this.createCompareBarChart();
                }
                break;
            case 'individual':
                this.createTrendChart();
                this.createRadarChart();
                this.createCohortCompareChart();
                break;
        }
    }

    createRotationChart() {
        const ctx = document.getElementById('rotationChart');
        if (!ctx) return;

        const averages = this.getCohortAverages(this.filteredData);
        const rotations = Object.keys(averages.byRotation).sort((a, b) => a - b);
        const data = rotations.map(rotation => averages.byRotation[rotation]);

        this.charts.rotation = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: rotations.map(r => `Rotation ${r}`),
                datasets: [{
                    label: 'Average Score',
                    data: data,
                    backgroundColor: '#0062AD',
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const rotation = rotations[index];
                        this.filterByRotation(rotation);
                    }
                }
            }
        });
    }

    createHeatmapChart() {
        const ctx = document.getElementById('heatmapChart');
        if (!ctx) return;

        const functions = [...new Set(this.filteredData.map(item => item.functionName))].sort();
        const datasets = this.assessmentAreas.map((area, index) => ({
            label: area,
            data: functions.map(func => {
                const funcData = this.filteredData.filter(item => item.functionName === func);
                const scores = funcData.map(item => item.scores[area]).filter(score => score !== undefined);
                return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
            }),
            backgroundColor: ['#0062AD', '#00358E', '#35C4EC', '#42DFE0'][index % 4],
        }));

        this.charts.heatmap = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: functions,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    createTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        const mdpData = this.filteredData.filter(item => item.mdpName === this.selectedIndividualMdp);
        const sortedData = mdpData.sort((a, b) => a.rotation - b.rotation);

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedData.map(item => `Rotation ${item.rotation}`),
                datasets: [{
                    label: 'Overall Score',
                    data: sortedData.map(item => item.overall),
                    borderColor: '#0062AD',
                    backgroundColor: 'rgba(0, 98, 173, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    createRadarChart() {
        const ctx = document.getElementById('radarChart');
        if (!ctx) return;

        const mdpData = this.filteredData.filter(item => item.mdpName === this.selectedIndividualMdp);
        if (mdpData.length === 0) return;

        const latest = mdpData[mdpData.length - 1];
        const scores = this.assessmentAreas.map(area => latest.scores[area] || 0);

        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: this.assessmentAreas,
                datasets: [{
                    label: this.selectedIndividualMdp,
                    data: scores,
                    borderColor: '#0062AD',
                    backgroundColor: 'rgba(0, 98, 173, 0.2)',
                    pointBackgroundColor: '#0062AD'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    createCohortCompareChart() {
        const ctx = document.getElementById('cohortCompareChart');
        if (!ctx) return;

        const mdpData = this.filteredData.filter(item => item.mdpName === this.selectedIndividualMdp);
        if (mdpData.length === 0) return;

        const latest = mdpData[mdpData.length - 1];
        const cohortAverages = this.getCohortAverages(this.filteredData);

        const mdpScores = this.assessmentAreas.map(area => latest.scores[area] || 0);
        const cohortScores = this.assessmentAreas.map(area => cohortAverages.byArea[area] || 0);

        this.charts.cohortCompare = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.assessmentAreas,
                datasets: [
                    {
                        label: this.selectedIndividualMdp,
                        data: mdpScores,
                        backgroundColor: '#0062AD'
                    },
                    {
                        label: 'Cohort Average',
                        data: cohortScores,
                        backgroundColor: '#35C4EC'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    createCompareTrendChart() {
        const ctx = document.getElementById('compareTrendChart');
        if (!ctx) return;

        const mdpAData = this.filteredData.filter(item => item.mdpName === this.selectedMdpA).sort((a, b) => a.rotation - b.rotation);
        const mdpBData = this.filteredData.filter(item => item.mdpName === this.selectedMdpB).sort((a, b) => a.rotation - b.rotation);

        const maxRotations = Math.max(mdpAData.length, mdpBData.length);
        const labels = Array.from({length: maxRotations}, (_, i) => `Rotation ${i + 1}`);

        this.charts.compareTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: this.selectedMdpA,
                        data: mdpAData.map(item => item.overall),
                        borderColor: '#0062AD',
                        backgroundColor: 'rgba(0, 98, 173, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: this.selectedMdpB,
                        data: mdpBData.map(item => item.overall),
                        borderColor: '#35C4EC',
                        backgroundColor: 'rgba(53, 196, 236, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    createCompareRadarChart() {
        const ctx = document.getElementById('compareRadarChart');
        if (!ctx) return;

        const mdpAData = this.filteredData.filter(item => item.mdpName === this.selectedMdpA);
        const mdpBData = this.filteredData.filter(item => item.mdpName === this.selectedMdpB);

        if (mdpAData.length === 0 || mdpBData.length === 0) return;

        const latestA = mdpAData[mdpAData.length - 1];
        const latestB = mdpBData[mdpBData.length - 1];

        const scoresA = this.assessmentAreas.map(area => latestA.scores[area] || 0);
        const scoresB = this.assessmentAreas.map(area => latestB.scores[area] || 0);

        this.charts.compareRadar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: this.assessmentAreas,
                datasets: [
                    {
                        label: this.selectedMdpA,
                        data: scoresA,
                        borderColor: '#0062AD',
                        backgroundColor: 'rgba(0, 98, 173, 0.2)',
                        pointBackgroundColor: '#0062AD'
                    },
                    {
                        label: this.selectedMdpB,
                        data: scoresB,
                        borderColor: '#35C4EC',
                        backgroundColor: 'rgba(53, 196, 236, 0.2)',
                        pointBackgroundColor: '#35C4EC'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    createCompareBarChart() {
        const ctx = document.getElementById('compareBarChart');
        if (!ctx) return;

        const comparison = this.compareMdps(this.filteredData, this.selectedMdpA, this.selectedMdpB);
        
        const scoresA = this.assessmentAreas.map(area => comparison.byArea[area]?.a || 0);
        const scoresB = this.assessmentAreas.map(area => comparison.byArea[area]?.b || 0);
        const cohortScores = this.assessmentAreas.map(area => comparison.byArea[area]?.cohort || 0);

        this.charts.compareBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.assessmentAreas,
                datasets: [
                    {
                        label: this.selectedMdpA,
                        data: scoresA,
                        backgroundColor: '#0062AD'
                    },
                    {
                        label: this.selectedMdpB,
                        data: scoresB,
                        backgroundColor: '#35C4EC'
                    },
                    {
                        label: 'Cohort Avg',
                        data: cohortScores,
                        backgroundColor: '#97EAFF'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    renderTable() {
        const tableTitle = document.getElementById('tableTitle');
        const tableHead = document.getElementById('tableHead');
        const tableBody = document.getElementById('tableBody');

        switch (this.viewMode) {
            case 'cohort':
                tableTitle.textContent = 'Cohort Performance Overview';
                tableHead.innerHTML = this.getCohortTableHeaders();
                tableBody.innerHTML = this.getCohortTableRows();
                break;
            case 'compare':
                tableTitle.textContent = `Comparison: ${this.selectedMdpA} vs ${this.selectedMdpB}`;
                tableHead.innerHTML = this.getCompareTableHeaders();
                tableBody.innerHTML = this.getCompareTableRows();
                break;
            case 'individual':
                tableTitle.textContent = `Rotation × Assessment Breakdown — ${this.selectedIndividualMdp}`;
                tableHead.innerHTML = this.getIndividualTableHeaders();
                tableBody.innerHTML = this.getIndividualTableRows();
                break;
        }
    }

    getCohortTableHeaders() {
        return `
            <tr>
                <th onclick="dashboard.sortTable('mdpName')">MDP Name</th>
                <th onclick="dashboard.sortTable('rotationCount')">Rotations</th>
                <th onclick="dashboard.sortTable('avgScore')">Avg Score</th>
                <th onclick="dashboard.sortTable('standing')">Standing</th>
                <th onclick="dashboard.sortTable('lastSubmitted')">Last Submitted</th>
            </tr>
        `;
    }

    getCohortTableRows() {
        // Group by MDP and aggregate their data
        const mdpGroups = {};
        this.filteredData.forEach(item => {
            const key = item.mdpName;
            if (!mdpGroups[key]) {
                mdpGroups[key] = {
                    mdpName: item.mdpName,
                    rotations: [],
                    functions: new Set()
                };
            }
            mdpGroups[key].rotations.push(item);
            mdpGroups[key].functions.add(item.functionName);
        });

        // Calculate aggregated metrics for each MDP
        const mdpSummaries = Object.values(mdpGroups).map(group => {
            const sortedRotations = group.rotations.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
            const avgScore = group.rotations.reduce((sum, r) => sum + r.overall, 0) / group.rotations.length;
            const functionsText = Array.from(group.functions).join(', ');
            const rotationCount = group.rotations.length;
            const lastSubmitted = new Date(Math.max(...group.rotations.map(r => new Date(r.submittedAt))));
            
            return {
                mdpName: group.mdpName,
                functionsText,
                rotationCount,
                avgScore,
                lastSubmitted,
                rotations: sortedRotations
            };
        });

        // Sort by average score
        mdpSummaries.sort((a, b) => b.avgScore - a.avgScore);

        return mdpSummaries.map((summary, index) => `
            <tr class="expandable-row" onclick="dashboard.expandRow('${summary.mdpName}', this)">
                <td>
                    <strong>${this.formatNameForPrivacy(summary.mdpName)}</strong>
                    <br><small style="color: #666; font-size: 0.85em;">${summary.functionsText}</small>
                </td>
                <td>${summary.rotationCount}</td>
                <td><span class="score-badge ${this.getScoreClass(summary.avgScore)}">${summary.avgScore.toFixed(2)}</span></td>
                <td>#${index + 1}</td>
                <td>${summary.lastSubmitted.toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    getIndividualTableHeaders() {
        return `
            <tr>
                <th>Rotation & Function</th>
                <th>Manager</th>
                <th>Job Knowledge</th>
                <th>Quality of Work</th>
                <th>Communication</th>
                <th>Initiative</th>
                <th>Overall</th>
                <th>Submitted</th>
            </tr>
        `;
    }

    getIndividualTableRows() {
        const mdpData = this.filteredData.filter(item => item.mdpName === this.selectedIndividualMdp);
        
        // Sort by rotation number to show chronological order
        mdpData.sort((a, b) => a.rotation - b.rotation);
        
        // Find top rotation for highlighting
        const topRotation = mdpData.reduce((best, current) => 
            current.overall > best.overall ? current : best
        );

        return mdpData.map(item => {
            const isTopRotation = item.rotation === topRotation.rotation;
            const rowClass = isTopRotation ? 'style="background-color: #f0f8ff;"' : '';
            
            return `
                <tr ${rowClass}>
                    <td>
                        <strong>Rotation ${item.rotation}</strong>
                        <br><small style="color: #666; font-size: 0.85em;">${item.functionName}</small>
                        ${isTopRotation ? ' 🏆' : ''}
                    </td>
                    <td>${item.manager}</td>
                    <td><span class="score-badge ${this.getScoreClass(item.scores['Job Knowledge'])}">${item.scores['Job Knowledge'].toFixed(1)}</span></td>
                    <td><span class="score-badge ${this.getScoreClass(item.scores['Quality of Work'])}">${item.scores['Quality of Work'].toFixed(1)}</span></td>
                    <td><span class="score-badge ${this.getScoreClass(item.scores['Communication Skills & Teamwork'])}">${item.scores['Communication Skills & Teamwork'].toFixed(1)}</span></td>
                    <td><span class="score-badge ${this.getScoreClass(item.scores['Initiative & Productivity'])}">${item.scores['Initiative & Productivity'].toFixed(1)}</span></td>
                    <td><strong><span class="score-badge ${this.getScoreClass(item.overall)}">${item.overall.toFixed(2)}</span></strong></td>
                    <td>${new Date(item.submittedAt).toLocaleDateString()}</td>
                </tr>
            `;
        }).join('');
    }

    getCompareTableHeaders() {
        return `
            <tr>
                <th>Assessment Area</th>
                <th>${this.selectedMdpA || 'First Associate'}</th>
                <th>${this.selectedMdpB || 'Second Associate'}</th>
                <th>Δ Difference</th>
                <th>Cohort Avg</th>
            </tr>
        `;
    }

    getCompareTableRows() {
        if (!this.selectedMdpA || !this.selectedMdpB) {
            return '<tr><td colspan="5" class="text-center">Select both associates to view comparison</td></tr>';
        }

        const comparison = this.compareMdps(this.filteredData, this.selectedMdpA, this.selectedMdpB);
        const showSignificantOnly = document.getElementById('significantDelta').checked;

        // Overall row
        let rows = [`
            <tr>
                <td><strong>Overall (weighted)</strong></td>
                <td><span class="score-badge ${this.getScoreClass(comparison.overall.a)}">${comparison.overall.a.toFixed(2)}</span></td>
                <td><span class="score-badge ${this.getScoreClass(comparison.overall.b)}">${comparison.overall.b.toFixed(2)}</span></td>
                <td><span class="score-badge ${Math.abs(comparison.overall.delta) >= 0.30 ? (comparison.overall.delta >= 0 ? 'score-high' : 'score-low') : 'score-medium'}">
                    ${comparison.overall.delta >= 0 ? '+' : ''}${comparison.overall.delta.toFixed(2)}
                </span></td>
                <td>--</td>
            </tr>
        `];

        // By Area rows
        this.assessmentAreas.forEach(area => {
            const data = comparison.byArea[area];
            const isSignificant = Math.abs(data.delta) >= 0.30;
            
            if (showSignificantOnly && !isSignificant) return;
            
            const rowClass = showSignificantOnly || isSignificant ? '' : 'style="opacity: 0.5;"';
            
            rows.push(`
                <tr ${rowClass}>
                    <td><strong>${area}</strong></td>
                    <td><span class="score-badge ${this.getScoreClass(data.a)}">${data.a.toFixed(2)}</span></td>
                    <td><span class="score-badge ${this.getScoreClass(data.b)}">${data.b.toFixed(2)}</span></td>
                    <td><span class="score-badge ${isSignificant ? (data.delta >= 0 ? 'score-high' : 'score-low') : 'score-medium'}">
                        ${data.delta >= 0 ? '+' : ''}${data.delta.toFixed(2)}
                    </span></td>
                    <td>${data.cohort.toFixed(2)}</td>
                </tr>
            `);
        });

        return rows.join('');
    }

    // Interactive Methods
    filterByRotation(rotation) {
        document.getElementById('rotationFilter').value = rotation.toString();
        this.filters.rotation = rotation.toString();
        this.applyFilters();
    }

    filterByMdp(mdpName) {
        const modeSelect = document.getElementById('modeSelect');
        modeSelect.value = mdpName;
        this.handleModeChange(mdpName);
    }

    filterByArea(area) {
        // For now, just log - could implement area-specific filtering
        console.log('Filter by area:', area);
    }

    filterByOverall() {
        // Sort by overall score
        this.sortTable('overall');
    }

    expandRow(mdpName, rowElement) {
        // Toggle expanded content showing rotation breakdown
        const existingExpanded = rowElement.nextElementSibling;
        if (existingExpanded && existingExpanded.classList.contains('expanded-content')) {
            existingExpanded.remove();
            return;
        }

        const mdpData = this.data.filter(item => item.mdpName === mdpName);
        const expandedRow = document.createElement('tr');
        expandedRow.className = 'expanded-content';
        expandedRow.innerHTML = `
            <td colspan="5">
                <div style="padding: 1rem;">
                    <h4>Rotation Breakdown for ${this.formatNameForPrivacy(mdpName)}</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                        ${mdpData.map(item => `
                            <div style="background: #f8f9fa; padding: 1rem; border-radius: 0.5rem;">
                                <strong>Rotation ${item.rotation} - ${item.functionName}</strong><br>
                                ${this.assessmentAreas.map(area => 
                                    `${area}: <span class="score-badge ${this.getScoreClass(item.scores[area])}">${item.scores[area].toFixed(1)}</span>`
                                ).join('<br>')}
                                <br><strong>Overall: <span class="score-badge ${this.getScoreClass(item.overall)}">${item.overall.toFixed(2)}</span></strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </td>
        `;
        
        rowElement.parentNode.insertBefore(expandedRow, rowElement.nextSibling);
    }

    sortTable(column) {
        // Simple sorting implementation
        console.log('Sort by:', column);
        // Implementation would depend on current view mode
    }

    // Utility Methods
    getScoreClass(score) {
        if (score >= 4.0) return 'score-high';
        if (score >= 3.0) return 'score-medium';
        return 'score-low';
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

    updateLastUpdated() {
        const now = new Date();
        document.getElementById('lastUpdated').textContent = 
            `Last updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    }

    saveUserPreferences() {
        const preferences = {
            viewMode: this.viewMode,
            selectedIndividualMdp: this.selectedIndividualMdp,
            selectedMdpA: this.selectedMdpA,
            selectedMdpB: this.selectedMdpB,
            filters: this.filters
        };
        localStorage.setItem('mdpDashboardPreferences', JSON.stringify(preferences));
    }

    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('mdpDashboardPreferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                // Restore filters
                if (preferences.filters) {
                    Object.keys(preferences.filters).forEach(key => {
                        this.filters[key] = preferences.filters[key];
                        const element = document.getElementById(key + 'Filter');
                        if (element) element.value = preferences.filters[key];
                    });
                }
                
                // Restore view mode
                if (preferences.viewMode) {
                    this.viewMode = preferences.viewMode;
                    
                    if (preferences.viewMode === 'individual' && preferences.selectedIndividualMdp) {
                        this.selectedIndividualMdp = preferences.selectedIndividualMdp;
                        document.getElementById('modeSelect').value = preferences.selectedIndividualMdp;
                    } else if (preferences.viewMode === 'compare') {
                        document.getElementById('modeSelect').value = 'compare';
                        if (preferences.selectedMdpA) {
                            this.selectedMdpA = preferences.selectedMdpA;
                            document.getElementById('mdpA').value = preferences.selectedMdpA;
                        }
                        if (preferences.selectedMdpB) {
                            this.selectedMdpB = preferences.selectedMdpB;
                            document.getElementById('mdpB').value = preferences.selectedMdpB;
                        }
                    }
                }
                
                this.updateModeBadge();
                this.showHideComparisonPicker();
                this.applyFilters();
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }

    // Public Methods
    async refresh() {
        await this.loadData();
        this.populateFilters();
        this.updateLastUpdated();
        this.applyFilters();
    }

    swapMdps() {
        const temp = this.selectedMdpA;
        this.selectedMdpA = this.selectedMdpB;
        this.selectedMdpB = temp;
        
        document.getElementById('mdpA').value = this.selectedMdpA;
        document.getElementById('mdpB').value = this.selectedMdpB;
        
        this.render();
        this.saveUserPreferences();
    }

    clearComparison() {
        this.selectedMdpA = '';
        this.selectedMdpB = '';
        
        document.getElementById('mdpA').value = '';
        document.getElementById('mdpB').value = '';
        
        this.render();
        this.saveUserPreferences();
    }

    clearFilters() {
        // Reset all filters to their default state
        this.filters = {
            function: '',
            manager: '',
            rotation: '',
            search: ''
        };
        
        // Reset the UI elements
        document.getElementById('functionFilter').value = '';
        document.getElementById('managerFilter').value = '';
        document.getElementById('rotationFilter').value = '';
        document.getElementById('searchFilter').value = '';
        
        // Re-render the dashboard with cleared filters
        this.render();
        this.saveUserPreferences();
    }

    // Export functionality
    exportCSV() {
        try {
            let csvData = [];
            let filename = '';
            
            switch (this.viewMode) {
                case 'cohort':
                    filename = 'MDP_Cohort_Performance.csv';
                    csvData = this.generateCohortCSV();
                    break;
                case 'compare':
                    filename = `MDP_Comparison_${this.selectedMdpA}_vs_${this.selectedMdpB}.csv`;
                    csvData = this.generateComparisonCSV();
                    break;
                case 'individual':
                    filename = `MDP_Individual_${this.selectedIndividualMdp}.csv`;
                    csvData = this.generateIndividualCSV();
                    break;
            }

            this.downloadCSV(csvData, filename);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Error exporting CSV. Please try again.');
        }
    }

    generateCohortCSV() {
        // Group by MDP and aggregate their data (same logic as cohort view)
        const mdpGroups = {};
        this.filteredData.forEach(item => {
            const key = item.mdpName;
            if (!mdpGroups[key]) {
                mdpGroups[key] = {
                    mdpName: item.mdpName,
                    rotations: [],
                    functions: new Set()
                };
            }
            mdpGroups[key].rotations.push(item);
            mdpGroups[key].functions.add(item.functionName);
        });

        const csvData = [
            ['MDP Name', 'Functions', 'Rotation Count', 'Average Score', 'Last Submitted', 'Standing']
        ];

        const mdpSummaries = Object.values(mdpGroups).map(group => {
            const avgScore = group.rotations.reduce((sum, r) => sum + r.overall, 0) / group.rotations.length;
            const functionsText = Array.from(group.functions).join('; ');
            const rotationCount = group.rotations.length;
            const lastSubmitted = new Date(Math.max(...group.rotations.map(r => new Date(r.submittedAt))));
            
            return {
                mdpName: group.mdpName,
                functionsText,
                rotationCount,
                avgScore,
                lastSubmitted
            };
        });

        mdpSummaries.sort((a, b) => b.avgScore - a.avgScore);

        mdpSummaries.forEach((summary, index) => {
            csvData.push([
                this.formatNameForPrivacy(summary.mdpName),
                summary.functionsText,
                summary.rotationCount,
                summary.avgScore.toFixed(2),
                summary.lastSubmitted.toLocaleDateString(),
                `#${index + 1}`
            ]);
        });

        return csvData;
    }

    generateComparisonCSV() {
        const mdpAData = this.filteredData.filter(item => item.mdpName === this.selectedMdpA);
        const mdpBData = this.filteredData.filter(item => item.mdpName === this.selectedMdpB);

        const csvData = [
            ['Metric', this.formatNameForPrivacy(this.selectedMdpA), this.formatNameForPrivacy(this.selectedMdpB), 'Difference']
        ];

        // Add overall comparison
        const avgA = mdpAData.reduce((sum, item) => sum + item.overall, 0) / mdpAData.length;
        const avgB = mdpBData.reduce((sum, item) => sum + item.overall, 0) / mdpBData.length;
        
        csvData.push(['Overall Average', avgA.toFixed(2), avgB.toFixed(2), (avgA - avgB).toFixed(2)]);
        csvData.push(['Rotation Count', mdpAData.length, mdpBData.length, mdpAData.length - mdpBData.length]);

        // Add assessment area comparisons
        this.assessmentAreas.forEach(area => {
            const areaA = mdpAData.reduce((sum, item) => sum + item.scores[area], 0) / mdpAData.length;
            const areaB = mdpBData.reduce((sum, item) => sum + item.scores[area], 0) / mdpBData.length;
            csvData.push([area, areaA.toFixed(2), areaB.toFixed(2), (areaA - areaB).toFixed(2)]);
        });

        return csvData;
    }

    generateIndividualCSV() {
        const mdpData = this.filteredData.filter(item => item.mdpName === this.selectedIndividualMdp);
        
        const csvData = [
            ['Rotation', 'Function', 'Job Knowledge', 'Quality of Work', 'Communication', 'Initiative', 'Overall', 'Manager', 'Submitted']
        ];

        mdpData.forEach(item => {
            csvData.push([
                `Rotation ${item.rotation}`,
                item.functionName,
                item.scores['Job Knowledge'].toFixed(1),
                item.scores['Quality of Work'].toFixed(1),
                item.scores['Communication Skills & Teamwork'].toFixed(1),
                item.scores['Initiative & Productivity'].toFixed(1),
                item.overall.toFixed(2),
                item.manager,
                new Date(item.submittedAt).toLocaleDateString()
            ]);
        });

        return csvData;
    }

    downloadCSV(csvData, filename) {
        const csvContent = csvData.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

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

    exportPDF() {
        // Enhanced PDF export that captures the entire dashboard view
        const printWindow = window.open('', '_blank');
        const currentDate = new Date().toLocaleDateString();
        
        // Get current dashboard content
        const dashboardContent = this.generateFullDashboardContent();
        let title = '';
        
        switch (this.viewMode) {
            case 'cohort':
                title = 'MDP Cohort Performance Overview';
                break;
            case 'compare':
                title = `MDP Comparison: ${this.selectedMdpA} vs ${this.selectedMdpB}`;
                break;
            case 'individual':
                title = `MDP Individual Report: ${this.selectedIndividualMdp}`;
                break;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 0;
                        color: #333; 
                        background: white;
                        font-size: 12px;
                        line-height: 1.4;
                    }
                    
                    .print-header { 
                        text-align: center; 
                        margin-bottom: 30px; 
                        border-bottom: 3px solid #004990; 
                        padding-bottom: 20px;
                        background: linear-gradient(135deg, #11224B 0%, #004990 100%);
                        color: white;
                        padding: 30px 20px 20px 20px;
                    }
                    
                    .print-header h1 { 
                        font-size: 28px;
                        margin-bottom: 10px; 
                        font-weight: 700;
                    }
                    
                    .print-header p { 
                        margin: 5px 0; 
                        font-size: 14px;
                        opacity: 0.9;
                    }
                    
                    .dashboard-summary {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin: 30px 20px;
                        page-break-inside: avoid;
                    }
                    
                    .summary-tile {
                        background: #f8f9fa;
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                        border-left: 4px solid #004990;
                    }
                    
                    .summary-tile h3 {
                        color: #004990;
                        font-size: 14px;
                        margin-bottom: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    
                    .summary-tile .value {
                        font-size: 24px;
                        font-weight: 700;
                        color: #11224B;
                        margin-bottom: 5px;
                    }
                    
                    .summary-tile .subtitle {
                        font-size: 11px;
                        color: #666;
                    }
                    
                    .data-section {
                        margin: 30px 20px;
                        page-break-inside: avoid;
                    }
                    
                    .section-title {
                        font-size: 18px;
                        font-weight: 700;
                        color: #11224B;
                        margin-bottom: 15px;
                        padding-bottom: 8px;
                        border-bottom: 2px solid #004990;
                    }
                    
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 20px 0;
                        font-size: 11px;
                    }
                    
                    th, td { 
                        border: 1px solid #ddd; 
                        padding: 8px 12px; 
                        text-align: left; 
                        vertical-align: top;
                    }
                    
                    th { 
                        background-color: #004990; 
                        color: white; 
                        font-weight: 600;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                    }
                    
                    tr:nth-child(even) { 
                        background-color: #f9f9f9; 
                    }
                    
                    .score-badge {
                        padding: 2px 6px;
                        border-radius: 10px;
                        font-size: 9px;
                        font-weight: 600;
                        color: white;
                    }
                    
                    .score-high { background: #28a745; }
                    .score-medium { background: #ffc107; color: #333; }
                    .score-low { background: #dc3545; }
                    
                    .filters-info {
                        background: #e3f2fd;
                        padding: 15px 20px;
                        margin: 20px;
                        border-radius: 8px;
                        border-left: 4px solid #35C4EC;
                    }
                    
                    .filters-info h4 {
                        color: #004990;
                        margin-bottom: 8px;
                        font-size: 14px;
                    }
                    
                    .filters-info p {
                        margin: 2px 0;
                        font-size: 11px;
                        color: #555;
                    }
                    
                    .footer { 
                        margin-top: 40px; 
                        text-align: center; 
                        font-size: 10px; 
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                        background: #f8f9fa;
                        padding: 20px;
                    }
                    
                    .footer strong {
                        color: #004990;
                    }
                    
                    @media print { 
                        body { margin: 0; }
                        .print-header { 
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        .summary-tile {
                            break-inside: avoid;
                        }
                        .data-section {
                            break-inside: avoid;
                        }
                        table {
                            break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>${title}</h1>
                    <p>Sam's Club Merchandising Development Program</p>
                    <p>Generated on ${currentDate}</p>
                </div>
                ${dashboardContent}
                <div class="footer">
                    <p><strong>© Sam's Club - MDP Performance Dashboard</strong></p>
                    <p>Merchandising Development Program Analytics • Generated ${currentDate}</p>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        // Small delay to ensure content is loaded before printing
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }

    generateFullDashboardContent() {
        // Get current filter information
        const activeFilters = this.getActiveFiltersText();
        
        // Get dashboard summary stats
        const summaryStats = this.generateSummaryStats();
        
        // Get current table content
        const tableHTML = document.querySelector('.data-table').outerHTML;
        
        return `
            ${activeFilters}
            ${summaryStats}
            <div class="data-section">
                <h2 class="section-title">${this.getCurrentSectionTitle()}</h2>
                ${tableHTML}
            </div>
        `;
    }

    getActiveFiltersText() {
        const activeFilters = [];
        if (this.filters.function) activeFilters.push(`Function: ${this.filters.function}`);
        if (this.filters.manager) activeFilters.push(`Manager: ${this.filters.manager}`);
        if (this.filters.rotation) activeFilters.push(`Rotation: ${this.filters.rotation}`);
        if (this.filters.search) activeFilters.push(`Search: "${this.filters.search}"`);
        
        if (activeFilters.length === 0) {
            return `
                <div class="filters-info">
                    <h4>Current View</h4>
                    <p>Showing all available data</p>
                </div>
            `;
        } else {
            return `
                <div class="filters-info">
                    <h4>Active Filters</h4>
                    ${activeFilters.map(filter => `<p>• ${filter}</p>`).join('')}
                </div>
            `;
        }
    }

    generateSummaryStats() {
        const totalResponses = this.filteredData.length;
        const uniqueMDPs = [...new Set(this.filteredData.map(item => item.mdpName))].length;
        const avgScore = totalResponses > 0 ? 
            (this.filteredData.reduce((sum, item) => sum + item.overall, 0) / totalResponses).toFixed(2) : '0';
        const uniqueFunctions = [...new Set(this.filteredData.map(item => item.functionName))].length;
        
        return `
            <div class="dashboard-summary">
                <div class="summary-tile">
                    <h3>Total Responses</h3>
                    <div class="value">${totalResponses}</div>
                    <div class="subtitle">Survey submissions</div>
                </div>
                <div class="summary-tile">
                    <h3>Active MDPs</h3>
                    <div class="value">${uniqueMDPs}</div>
                    <div class="subtitle">Merchandising development participants</div>
                </div>
                <div class="summary-tile">
                    <h3>Average Score</h3>
                    <div class="value">${avgScore}</div>
                    <div class="subtitle">Overall performance rating</div>
                </div>
                <div class="summary-tile">
                    <h3>Functions</h3>
                    <div class="value">${uniqueFunctions}</div>
                    <div class="subtitle">Business areas covered</div>
                </div>
            </div>
        `;
    }

    getCurrentSectionTitle() {
        switch (this.viewMode) {
            case 'cohort':
                return 'Cohort Performance Overview';
            case 'compare':
                return `Detailed Comparison: ${this.selectedMdpA} vs ${this.selectedMdpB}`;
            case 'individual':
                return `Rotation Performance History: ${this.selectedIndividualMdp}`;
            default:
                return 'Performance Data';
        }
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new MDPDashboard();
});