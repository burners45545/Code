// URL Analyzer - Simple implementation for URL counting and duplicate handling
const URLAnalyzer = {
    // Initialize state
    state: {
        urls: new Set(),
        duplicates: new Map(),
        archiveDates: new Map(),
        tweetDates: new Map()
    },

    // Initialize the analyzer
    init() {
        const input = document.getElementById('inputText');
        const analyzeBtn = document.getElementById('countButton');
        const clearBtn = document.getElementById('clearButton');

        if (input) {
            input.addEventListener('paste', () => {
                if (document.getElementById('autoProcess')?.checked) {
                    setTimeout(() => this.analyze(), 100);
                }
            });
        }

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyze());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clear());
        }
    },

    // Clear all data
    clear() {
        const input = document.getElementById('inputText');
        if (input) {
            input.value = '';
        }
        this.state.urls.clear();
        this.state.duplicates.clear();
        this.state.archiveDates.clear();
        this.state.tweetDates.clear();
        this.updateResults();
    },

    // Extract archive.ph date from URL
    extractArchiveDate(url) {
        try {
            // Remove /wip/ from URL if present
            url = url.replace('/wip/', '/');
            
            const match = url.match(/archive\.ph\/(\d{14})/);
            if (!match) return null;

            const timestamp = match[1];
            if (!timestamp || timestamp.length !== 14) return null;

            // Parse YYYYMMDDhhmmss format
            const year = parseInt(timestamp.slice(0, 4));
            const month = parseInt(timestamp.slice(4, 6)) - 1;
            const day = parseInt(timestamp.slice(6, 8));
            const hour = parseInt(timestamp.slice(8, 10));
            const minute = parseInt(timestamp.slice(10, 12));
            const second = parseInt(timestamp.slice(12, 14));

            const date = new Date(year, month, day, hour, minute, second);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            console.error('Error extracting archive date:', error);
            return null;
        }
    },

    // Extract tweet date from archive.ph page content
    async extractTweetDate(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            // Look for tweet date patterns in the archived content
            const patterns = [
                // Standard Twitter date format
                /data-time="(\d{10})"/,
                // Twitter date text format
                /(\d{1,2}:\d{2} [AP]M · [A-Za-z]+ \d{1,2}, \d{4})/,
                // Alternative Twitter date format
                /datetime="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    if (pattern.toString().includes('data-time')) {
                        // Unix timestamp
                        return new Date(parseInt(match[1]) * 1000);
                    } else if (pattern.toString().includes('datetime')) {
                        // ISO format
                        return new Date(match[1]);
                    } else {
                        // Text format
                        return new Date(match[1]);
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error extracting tweet date:', error);
            return null;
        }
    },

    // Main analysis function
    async analyze() {
        try {
            const input = document.getElementById('inputText')?.value.trim();
            if (!input) {
                this.showError('Please enter some URLs to analyze.');
                return;
            }

            // Reset state
            this.state.urls.clear();
            this.state.duplicates.clear();
            this.state.archiveDates.clear();
            this.state.tweetDates.clear();

            // Extract URLs
            const lines = input.split(/\r?\n/);
            const urlPattern = /(https?:\/\/[^\s]+)/g;

            // Process each line
            for (const line of lines) {
                const matches = line.match(urlPattern);
                if (matches) {
                    for (const url of matches) {
                        if (this.state.urls.has(url)) {
                            const count = this.state.duplicates.get(url) || 1;
                            this.state.duplicates.set(url, count + 1);
                        } else {
                            this.state.urls.add(url);
                            
                            // If it's an archive.ph URL, extract dates
                            if (url.includes('archive.ph')) {
                                const archiveDate = this.extractArchiveDate(url);
                                if (archiveDate) {
                                    this.state.archiveDates.set(url, archiveDate);
                                    
                                    // Try to extract tweet date
                                    try {
                                        const tweetDate = await this.extractTweetDate(url);
                                        if (tweetDate) {
                                            this.state.tweetDates.set(url, tweetDate);
                                        }
                                    } catch (error) {
                                        console.error('Error extracting tweet date:', error);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            this.updateResults();

        } catch (error) {
            this.showError(error.message);
        }
    },

    // Format date for display
    formatDate(date) {
        if (!date) return 'Unknown';
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Update results in the UI
    updateResults() {
        const output = document.getElementById('output');
        if (!output) return;

        const totalUrls = Array.from(this.state.urls).length + 
            Array.from(this.state.duplicates.values()).reduce((sum, count) => sum + count, 0);
        const uniqueUrls = this.state.urls.size;
        const duplicateCount = this.state.duplicates.size;
        const archiveUrlCount = Array.from(this.state.urls).filter(url => url.includes('archive.ph')).length;

        let html = `
            <div class="metrics">
                <h2>Analysis Results</h2>
                <table>
                    <tr>
                        <th>Category</th>
                        <th>Count</th>
                    </tr>
                    <tr>
                        <td>Total URLs</td>
                        <td>${totalUrls}</td>
                    </tr>
                    <tr>
                        <td>Unique URLs</td>
                        <td>${uniqueUrls}</td>
                    </tr>
                    <tr>
                        <td>Archive.ph URLs</td>
                        <td>${archiveUrlCount}</td>
                    </tr>
                    <tr>
                        <td>Duplicate URLs</td>
                        <td>${duplicateCount}</td>
                    </tr>
                </table>
            </div>
        `;

        // Add archive.ph URLs analysis
        if (archiveUrlCount > 0) {
            html += `
                <div class="archive-analysis">
                    <h3>Archive.ph URLs Analysis</h3>
                    <table class="archive-table">
                        <tr>
                            <th>URL</th>
                            <th>Archive Date</th>
                            <th>Tweet Date</th>
                        </tr>
                        ${Array.from(this.state.urls)
                            .filter(url => url.includes('archive.ph'))
                            .map(url => `
                                <tr>
                                    <td class="url-cell">${url}</td>
                                    <td>${this.formatDate(this.state.archiveDates.get(url))}</td>
                                    <td>${this.formatDate(this.state.tweetDates.get(url))}</td>
                                </tr>
                            `).join('')}
                    </table>
                </div>
            `;
        }

        // Add unique URLs list with copy button
        html += `
            <div class="unique-urls">
                <h3>Unique URLs (${uniqueUrls})</h3>
                <button onclick="URLAnalyzer.copyUniqueUrls()">Copy Unique URLs</button>
                <textarea readonly>${Array.from(this.state.urls).join('\n')}</textarea>
            </div>
        `;

        // Add duplicates table if there are any
        if (duplicateCount > 0) {
            html += `
                <div class="duplicates-section">
                    <h3>Duplicate URLs Found (${duplicateCount})</h3>
                    <table class="duplicates-table">
                        <tr>
                            <th>URL</th>
                            <th>Count</th>
                        </tr>
                        ${Array.from(this.state.duplicates.entries())
                            .map(([url, count]) => `
                                <tr>
                                    <td class="url-cell">${url}</td>
                                    <td class="count-cell">${count + 1}</td>
                                </tr>
                            `).join('')}
                    </table>
                </div>
            `;
        }

        output.innerHTML = html;
    },

    // Copy unique URLs to clipboard
    copyUniqueUrls() {
        const uniqueUrls = Array.from(this.state.urls).join('\n');
        navigator.clipboard.writeText(uniqueUrls).then(() => {
            this.showNotification('Unique URLs copied to clipboard!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy URLs', 'error');
        });
    },

    // Show error message
    showError(message) {
        const output = document.getElementById('output');
        if (output) {
            output.innerHTML = `
                <div class="errors">
                    <h3>Error</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    },

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
};

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => URLAnalyzer.init()); 