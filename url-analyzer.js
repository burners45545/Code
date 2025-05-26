// URL Analyzer Module
const URLAnalyzer = (() => {
    // Cache DOM elements
    const elements = {
        input: document.getElementById('inputText'),
        archiveOnly: document.getElementById('archiveOnly'),
        countButton: document.getElementById('countButton'),
        loading: document.getElementById('loading'),
        output: document.getElementById('output'),
        archiveChart: document.getElementById('archiveChart'),
        tweetChart: document.getElementById('tweetChart'),
        urlInput: document.getElementById('urlInput'),
        processButton: document.getElementById('processButton'),
        clearButton: document.getElementById('clearButton'),
        urlList: document.getElementById('urlList'),
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        errorContainer: document.getElementById('errorContainer'),
        copyArchivedButton: document.getElementById('copyArchivedButton'),
        copyNonArchivedButton: document.getElementById('copyNonArchivedButton'),
        archivedUrlsList: document.getElementById('archivedUrlsList'),
        nonArchivedUrlsList: document.getElementById('nonArchivedUrlsList'),
    };

    // Configuration
    const config = {
        apiBaseUrl: 'http://localhost:5000',
        urlRegex: new RegExp(
            '(?:(?:https?|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?!(?:10|127)(?:\\.\\d{1,3}){3})(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))\\.?)(?::\\d{2,5})?(?:[/?#]\\S*)?',
            'gi'
        ),
        dateRegex: /Tweet Date: ([^\n]+)/g,
        archiveUrlPattern: /^https?:\/\/archive\.(?:ph|is|today)\/([a-zA-Z0-9]+)$/,
        twitterStatusPattern: /^https?:\/\/(?:twitter|x)\.com\/(?:[^\/]+\/status|i\/status)\/(\d+)/,
        categories: {
            'Archived URLs': [],
            'Unarchived URLs': [],
            'Social Media': ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'threads.net'],
            'News': ['nytimes.com', 'washingtonpost.com', 'cnn.com', 'bbc.com', 'reuters.com', 'apnews.com'],
            'Other': []
        },
        analytics: {
            timeRanges: ['day', 'week', 'month', 'year'],
            metrics: ['count', 'average', 'median', 'percentile'],
            patterns: {
                rapidIncrease: (values) => {
                    const threshold = 2;
                    for (let i = 1; i < values.length; i++) {
                        if (values[i] / values[i-1] > threshold) {
                            return true;
                        }
                    }
                    return false;
                },
                seasonality: (values, period = 7) => {
                    if (values.length < period * 2) return false;
                    const correlations = [];
                    for (let i = 0; i < values.length - period; i++) {
                        const slice1 = values.slice(i, i + period);
                        const slice2 = values.slice(i + period, i + period * 2);
                        const correlation = utils.calculateCorrelation(slice1, slice2);
                        correlations.push(correlation);
                    }
                    return correlations.some(c => c > 0.7);
                }
            }
        },
        chartOptions: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#333',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} URLs`;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#e0e0e0',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: '#333',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Number of URLs',
                        color: '#e0e0e0',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    ticks: {
                        color: '#e0e0e0',
                        font: {
                            size: 12
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: '#333',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#e0e0e0',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        },
        batchSize: 50,
        maxConcurrentRequests: 20,
        retryAttempts: 3,
        retryDelay: 1000,
    };

    // State management
    let state = {
        urls: new Set(),
        archivedUrls: new Map(),
        nonArchivedUrls: new Set(),
        processingQueue: new Set(),
        results: new Map(),
        errors: new Set(),
        charts: {
            archiveChart: null,
            tweetChart: null
        }
    };

    // Utility functions
    const utils = {
        parseDate: (dateStr) => {
            try {
                const formats = [
                    'd MMM yyyy',    // 9 Jan 2022
                    'yyyy-MM-dd',    // 2022-01-09
                    'MM/dd/yyyy',    // 01/09/2022
                    'd MMMM yyyy',   // 9 January 2022
                    'MMMM d, yyyy',  // January 9, 2022
                    'dd MMM yyyy'    // 09 Jan 2022
                ];
                
                const parsed = dateFns.parse(dateStr, formats, new Date());
                return isNaN(parsed) ? null : dateFns.format(parsed, 'MMM yyyy');
            } catch (e) {
                return null;
            }
        },

        validateURL: (url) => {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },

        extractArchiveInfo: (url) => {
            // Remove /wip/ from URL if present
            url = url.replace('/wip/', '/');
            
            const match = url.match(config.archiveUrlPattern);
            if (!match) return null;

            const archiveId = match[1];
            const isOriginalUrl = url.includes('/o/');
            
            return {
                archiveId,
                isOriginalUrl,
                originalUrl: url // Store the cleaned URL
            };
        },

        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        calculateStats: (data) => {
            const values = Object.values(data);
            const sorted = [...values].sort((a, b) => a - b);
            return {
                min: sorted[0],
                max: sorted[sorted.length - 1],
                median: sorted[Math.floor(sorted.length / 2)],
                mean: values.reduce((a, b) => a + b, 0) / values.length,
                percentile95: sorted[Math.floor(sorted.length * 0.95)],
                variance: values.reduce((acc, val) => {
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    return acc + Math.pow(val - mean, 2);
                }, 0) / values.length
            };
        },

        calculateCorrelation: (array1, array2) => {
            const mean1 = array1.reduce((a, b) => a + b, 0) / array1.length;
            const mean2 = array2.reduce((a, b) => a + b, 0) / array2.length;
            const variance1 = array1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0);
            const variance2 = array2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0);
            const covariance = array1.reduce((acc, val, i) => 
                acc + (val - mean1) * (array2[i] - mean2), 0);
            return covariance / Math.sqrt(variance1 * variance2);
        },

        detectAnomalies: (data) => {
            const values = Object.values(data);
            const stats = utils.calculateStats(data);
            const threshold = stats.mean + 2 * Math.sqrt(stats.variance);
            return Object.entries(data).reduce((acc, [date, value]) => {
                if (value > threshold) {
                    acc[date] = value;
                }
                return acc;
            }, {});
        },

        predictTrend: (data) => {
            const values = Object.values(data);
            const xValues = Array.from({length: values.length}, (_, i) => i);
            const sumX = xValues.reduce((a, b) => a + b, 0);
            const sumY = values.reduce((a, b) => a + b, 0);
            const sumXY = xValues.reduce((acc, x, i) => acc + x * values[i], 0);
            const sumXX = xValues.reduce((acc, x) => acc + x * x, 0);
            const n = values.length;
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            
            return {
                slope,
                intercept,
                prediction: (x) => slope * x + intercept
            };
        },

        processArchiveUrl: async (url) => {
            try {
                const match = url.match(config.archiveUrlPattern);
                if (!match) return null;

                const archiveId = match[1];
                const response = await fetch(`${config.apiBaseUrl}/archive-metadata/${archiveId}`);
                if (!response.ok) throw new Error('Failed to fetch archive metadata');

                const data = await response.json();
                return {
                    archiveUrl: url,
                    originalUrl: data.original_url,
                    archiveDate: data.archive_date,
                    contentDate: data.content_date
                };
            } catch (error) {
                console.error('Error processing archive URL:', error);
                return null;
            }
        },

        isArchivedUrl: (url) => {
            return config.archiveUrlPattern.test(url);
        },

        processUrls: async (urls) => {
            const archiveUrls = [];
            const nonArchiveUrls = [];
            const dates = new Set();
            const unarchived = [];
            const archiveDates = {};

            // Split URLs into archive and non-archive
            urls.forEach(url => {
                if (utils.isArchivedUrl(url)) {
                    archiveUrls.push(url);
                } else {
                    if (config.twitterStatusPattern.test(url)) {
                        unarchived.push(url);
                    } else {
                        nonArchiveUrls.push(url);
                    }
                }
            });

            // Process archive URLs in batches
            const archiveResults = [];
            for (let i = 0; i < archiveUrls.length; i += config.batchSize) {
                const batch = archiveUrls.slice(i, i + config.batchSize);
                try {
                    const response = await fetch(`${config.apiBaseUrl}/batch-metadata`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ urls: batch })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to fetch metadata');
                    }

                    const data = await response.json();
                    data.archived_urls.forEach(result => {
                        if (result.archive_url && result.archive_date) {
                            archiveDates[result.archive_url] = result.archive_date;
                            dates.add(result.archive_date);
                        }
                        archiveResults.push(result);
                    });
                } catch (error) {
                    console.error('Error processing batch:', error);
                }
            }

            return {
                archivedUrls: archiveResults,
                nonArchivedUrls: nonArchiveUrls,
                unarchivedUrls: unarchived,
                dates: Array.from(dates).sort(),
                archiveDates: archiveDates
            };
        },

        // Add function to check if URL can be archived
        canBeArchived: (url) => {
            // Check if URL is not already an archive URL
            if (utils.isArchivedUrl(url)) return false;
            
            // Check if URL is valid and has http/https protocol
            try {
                const parsedUrl = new URL(url);
                return ['http:', 'https:'].includes(parsedUrl.protocol);
            } catch {
                return false;
            }
        },

        // Add function to create archive.is URL
        createArchiveUrl: async (url) => {
            try {
                const response = await fetch(`${config.apiBaseUrl}/create-archive`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url })
                });

                if (!response.ok) {
                    throw new Error('Failed to create archive');
                }

                const data = await response.json();
                return data.archiveUrl;
            } catch (error) {
                console.error('Error creating archive:', error);
                return null;
            }
        },
    };

    // Add this near the top of the file, after the config object
    const popupUtils = {
        async checkPopupPermission() {
            try {
                // Try to open a tiny test popup
                const test = window.open('about:blank', '_blank', 'width=1,height=1');
                if (!test) {
                    return false;
                }
                test.close();
                return true;
            } catch (e) {
                return false;
            }
        },

        showPopupPrompt() {
            const prompt = document.createElement('div');
            prompt.className = 'popup-prompt';
            prompt.innerHTML = `
                <div class="popup-content">
                    <h3>Enable Popups</h3>
                    <p>Please allow popups for this site to enable automatic archiving.</p>
                    <p>Look for the popup blocker icon in your browser's address bar and click "Allow popups".</p>
                    <button onclick="this.parentElement.parentElement.remove()">OK</button>
                </div>
            `;
            document.body.appendChild(prompt);
        }
    };

    // Add this to the style element creation
    const popupStyles = `
        .popup-prompt {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        .popup-content {
            background: #2c2c2c;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            text-align: center;
        }
        .popup-content h3 {
            margin-top: 0;
            color: #e0e0e0;
        }
        .popup-content p {
            color: #ccc;
            margin: 10px 0;
        }
        .popup-content button {
            background: #2ecc71;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }
        .popup-content button:hover {
            background: #27ae60;
        }
    `;

    // UI functions
    const ui = {
        showLoading: (show) => {
            elements.countButton.disabled = show;
            elements.loading.style.display = show ? 'flex' : 'none';
        },

        hideLoading: () => {
            elements.countButton.disabled = false;
            elements.loading.style.display = 'none';
        },

        updateOutput: (data) => {
            const { metrics, categorizedDetails, errors } = data;
            let output = `
                <div class="metrics">
                    <table>
                        <tr><th>Metric</th><th>Value</th></tr>
                        ${Object.entries(metrics).map(([key, value]) => 
                            `<tr><td>${key}</td><td>${value}</td></tr>`
                        ).join('')}
                    </table>
                </div>
            `;

            if (Object.keys(categorizedDetails).length > 0) {
                output += '<p>Unique URLs by Category:</p>';
                for (const [category, details] of Object.entries(categorizedDetails)) {
                    output += `
                        <div class="category">
                            <h3>${category} (${details.length})</h3>
                            <ul id="urlList">
                                ${details.map(detail => `
                                    <li>
                                        <div class="url-entry">
                                            <a href="${detail.url}" target="_blank" rel="noopener noreferrer">${detail.url}</a>
                                            ${detail.archiveDate ? `
                                                <div class="date-info">
                                                    <span class="archive-date">Archived: ${detail.archiveDate}</span>
                                                </div>
                                            ` : ''}
                                            ${detail.tweetDate ? `
                                                <div class="date-info">
                                                    <span class="tweet-date">Tweet: ${detail.tweetDate}</span>
                                                </div>
                                            ` : ''}
                                            ${detail.isArchive ? `
                                                <div class="related-url">
                                                    <span>Original URL:</span>
                                                    <a href="${detail.originalUrl}" target="_blank" rel="noopener noreferrer">${detail.originalUrl}</a>
                                                </div>
                                            ` : ''}
                                            ${detail.isOriginal ? `
                                                <div class="related-url">
                                                    <span>Archive URL:</span>
                                                    <a href="${detail.archiveUrl}" target="_blank" rel="noopener noreferrer">${detail.archiveUrl}</a>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }
            } else {
                output += '<p>No URLs found matching the current filter.</p>';
            }

            if (errors.length > 0) {
                output += `
                    <div class="errors">
                        <p><strong>Errors:</strong></p>
                        <ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>
                    </div>
                `;
            }

            elements.output.innerHTML = output;
        },

        updateAnalytics: (analytics) => {
            // Check if analytics data exists
            if (!analytics || !analytics.archive || !analytics.tweet) {
                console.log('No analytics data available');
                return;
            }

            const formatNumber = (num) => {
                if (num === undefined || num === null) return 'N/A';
                return Number.isInteger(num) ? num : num.toFixed(2);
            };
            
            const createStatCard = (label, value) => `
                <div class="stat-card">
                    <div class="stat-label">${label}</div>
                    <div class="stat-value">${formatNumber(value)}</div>
                </div>
            `;

            const createPatternIndicator = (label, detected) => `
                <div class="pattern-indicator ${detected ? 'detected' : ''}">
                    <span class="pattern-label">${label}</span>
                    <span class="pattern-status">${detected ? '✓ Detected' : '✗ Not Detected'}</span>
                </div>
            `;

            const renderAnalytics = (type, data) => {
                if (!data || !data.stats || !data.trend) {
                    console.log(`No ${type} analytics data available`);
                    return;
                }

                const container = document.getElementById(`${type}Analytics`);
                if (!container) {
                    console.log(`Container for ${type} analytics not found`);
                    return;
                }

                const stats = data.stats;
                const trend = data.trend;
                
                let html = `
                    <div class="stats-grid">
                        ${createStatCard('Average URLs per period', stats.mean)}
                        ${createStatCard('Median', stats.median)}
                        ${createStatCard('Maximum', stats.max)}
                        ${createStatCard('95th Percentile', stats.percentile95)}
                        ${createStatCard('Variance', stats.variance)}
                    </div>
                    <div class="trend-info">
                        <div class="stat-label">Trend Analysis</div>
                        <div>Slope: ${formatNumber(trend.slope)} URLs/period</div>
                        <div>Overall trend: ${trend.slope > 0 ? 'Increasing' : 'Decreasing'}</div>
                    </div>
                `;

                if (data.anomalies && Object.keys(data.anomalies).length > 0) {
                    html += `
                        <div class="anomaly-section">
                            <div class="stat-label">Anomalies Detected</div>
                            <div class="anomaly-list">
                                ${Object.entries(data.anomalies).map(([date, value]) => `
                                    <div class="anomaly-item">
                                        <span>${date}</span>
                                        <span>${formatNumber(value)} URLs</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                container.innerHTML = html;
            };

            const renderPatterns = () => {
                const container = document.getElementById('patternAnalytics');
                if (!container) {
                    console.log('Pattern analytics container not found');
                    return;
                }

                const archivePatterns = analytics.archive.patterns || {};
                const tweetPatterns = analytics.tweet.patterns || {};

                container.innerHTML = `
                    <div class="patterns-grid">
                        <div class="pattern-section">
                            <div class="stat-label">Archive URL Patterns</div>
                            ${createPatternIndicator('Rapid Increase', archivePatterns.rapidIncrease)}
                            ${createPatternIndicator('Seasonality', archivePatterns.seasonality)}
                        </div>
                        <div class="pattern-section">
                            <div class="stat-label">Tweet URL Patterns</div>
                            ${createPatternIndicator('Rapid Increase', tweetPatterns.rapidIncrease)}
                            ${createPatternIndicator('Seasonality', tweetPatterns.seasonality)}
                        </div>
                    </div>
                `;
            };

            try {
                renderAnalytics('archive', analytics.archive);
                renderAnalytics('tweet', analytics.tweet);
                renderPatterns();
            } catch (error) {
                console.error('Error updating analytics:', error);
            }
        },

        toggleAnalyticsPanel() {
            const content = document.getElementById('analyticsContent');
            const icon = document.querySelector('.toggle-analytics .icon');
            
            if (content.style.display === 'none') {
                content.style.display = 'grid';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        },

        resetUI() {
            elements.output.innerHTML = '';
            elements.loading.style.display = 'none';
            elements.countButton.disabled = false;
        },

        updateProgress(progress) {
            const progressBar = document.querySelector('.progress-bar');
            const progressFill = progressBar.querySelector('.progress-fill');
            const progressText = progressBar.querySelector('.progress-text');
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        },

        showError(message) {
            const output = elements.output;
            output.innerHTML = `
                <div class="errors">
                    <h3>Error</h3>
                    <p>${message}</p>
                    ${URLAnalyzer.state.errors.length > 0 ? `
                        <h4>Failed URLs:</h4>
                        <ul>
                            ${URLAnalyzer.state.errors.map(err => `
                                <li>${err.url}: ${err.error}</li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        },

        hideError() {
            const errors = document.querySelector('.errors');
            if (errors) errors.remove();
        },

        updateResults(results) {
            const output = elements.output;
            output.innerHTML = ui.generateResultsHTML(results);
        },

        generateResultsHTML(results) {
            const archivedUrls = results.urls.filter(url => config.archiveUrlPattern.test(url));
            const unarchivedUrls = results.urls.filter(url => !config.archiveUrlPattern.test(url));
            
            // Store for export functionality
            state.urlDetailsForExport = {
                archived: archivedUrls.map(url => ({
                    url,
                    date: results.dates[url] || 'Unknown'
                })),
                unarchived: unarchivedUrls
            };

            return `
                <div class="metrics">
                    <h2>Analysis Results</h2>
                    <div class="results-actions">
                        <button onclick="URLAnalyzer.ui.copyArchivedUrls()" class="copy-btn">
                            Copy Archived URLs with Dates
                        </button>
                        <button onclick="URLAnalyzer.ui.copyUnarchivedUrls()" class="copy-btn">
                            Copy Unarchived URLs
                        </button>
                    </div>
                    <table>
                        <tr>
                            <th>Category</th>
                            <th>Count</th>
                        </tr>
                        <tr>
                            <td>Archived URLs</td>
                            <td>${archivedUrls.length}</td>
                        </tr>
                        <tr>
                            <td>Unarchived URLs</td>
                            <td>${unarchivedUrls.length}</td>
                        </tr>
                    </table>
                </div>

                <div class="url-lists">
                    <div class="url-section">
                        <h3>Archived URLs</h3>
                        <div class="url-list">
                            ${archivedUrls.map(url => `
                                <div class="url-item">
                                    <div class="url-info">
                                        <a href="${url}" target="_blank">${url}</a>
                                        <span class="archive-date">${results.dates[url] ? 'Archived: ' + results.dates[url] : 'Date pending...'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="url-section">
                        <h3>Unarchived URLs</h3>
                        <div class="url-list">
                            ${unarchivedUrls.map(url => `
                                <div class="url-item">
                                    <div class="url-info">
                                        <a href="${url}" target="_blank">${url}</a>
                                    </div>
                                    <div class="action-buttons">
                                        <button onclick="URLAnalyzer.createArchive('${url}')" class="archive-btn">
                                            Create Archive
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        },

        copyArchivedUrls: function() {
            if (!state.urlDetailsForExport || !state.urlDetailsForExport.archived) {
                console.error('No archived URLs to copy');
                return;
            }
            const urlsWithDates = state.urlDetailsForExport.archived
                .map(({url, date}) => `${url} (Archived: ${date})`)
                .join('\n');
            navigator.clipboard.writeText(urlsWithDates)
                .then(() => alert('Archived URLs with dates copied to clipboard!'))
                .catch(err => console.error('Failed to copy URLs:', err));
        },

        copyUnarchivedUrls: function() {
            if (!state.urlDetailsForExport || !state.urlDetailsForExport.unarchived) {
                console.error('No unarchived URLs to copy');
                return;
            }
            const urls = state.urlDetailsForExport.unarchived.join('\n');
            navigator.clipboard.writeText(urls)
                .then(() => alert('Unarchived URLs copied to clipboard!'))
                .catch(err => console.error('Failed to copy URLs:', err));
        },

        async createArchive(url) {
            try {
                // Show loading state
                const archiveBtn = document.querySelector(`button[onclick="URLAnalyzer.createArchive('${url}')"]`);
                if (archiveBtn) {
                    archiveBtn.disabled = true;
                    archiveBtn.textContent = 'Archiving...';
                }

                // Check popup permission first
                const hasPermission = await popupUtils.checkPopupPermission();
                if (!hasPermission) {
                    popupUtils.showPopupPrompt();
                    throw new Error('Popups are blocked. Please allow popups and try again.');
                }

                // Clean up the URL - remove @ if present
                url = url.replace(/^@/, '');

                // Create archive by opening archive.ph in a new window
                const archiveWindow = window.open('about:blank', '_blank');
                if (!archiveWindow) {
                    throw new Error('Failed to open archive window. Please allow popups for this site.');
                }

                // Set up the archive window
                archiveWindow.document.write(`
                    <html>
                        <head><title>Archiving...</title></head>
                        <body>
                            <h2>Archiving URL...</h2>
                            <p>Please wait while we archive: ${url}</p>
                            <script>
                                window.location.href = 'https://archive.ph/submit/';
                            </script>
                        </body>
                    </html>
                `);
                
                // Create a promise that will resolve when we get the archived URL
                const getArchivedUrl = new Promise((resolve, reject) => {
                    let checkCount = 0;
                    const maxChecks = 60; // Check for 1 minute max
                    
                    const checkArchiveStatus = () => {
                        checkCount++;
                        if (checkCount > maxChecks) {
                            reject(new Error('Archive creation timed out'));
                            return;
                        }

                        // Check if the archive window is still open
                        if (!archiveWindow || archiveWindow.closed) {
                            reject(new Error('Archive window was closed'));
                            return;
                        }

                        try {
                            // Try to get the final URL from the archive window
                            const finalUrl = archiveWindow.location.href;
                            if (finalUrl && finalUrl.includes('archive.ph/') && !finalUrl.includes('submit')) {
                                archiveWindow.close();
                                resolve(finalUrl);
                                return;
                            }
                        } catch (e) {
                            // Cross-origin error, which means we're still waiting for the archive
                        }

                        // Check again in 1 second
                        setTimeout(checkArchiveStatus, 1000);
                    };

                    // Start checking after a short delay to allow the window to load
                    setTimeout(checkArchiveStatus, 1000);

                    // Also set up a message listener for when archive.ph sends back the result
                    window.addEventListener('message', (event) => {
                        if (event.origin === 'https://archive.ph' && event.data.archiveUrl) {
                            archiveWindow.close();
                            resolve(event.data.archiveUrl);
                        }
                    }, { once: true });
                });

                // Wait for the archive to be created
                const archiveUrl = await getArchivedUrl;

                // Update the UI with the new archive URL
                if (archiveBtn && archiveBtn.parentElement && archiveBtn.parentElement.parentElement) {
                    const urlItem = archiveBtn.parentElement.parentElement;
                    const urlInfo = urlItem.querySelector('.url-info');
                    if (urlInfo) {
                        urlInfo.innerHTML = `
                            <a href="${archiveUrl}" target="_blank">${archiveUrl}</a>
                            <span class="archive-date">Archived: ${new Date().toLocaleDateString()}</span>
                        `;
                    }
                    // Remove the archive button since we don't need it anymore
                    archiveBtn.parentElement.remove();
                }

                // Refresh the analysis to show the new archive
                await this.analyze();

            } catch (error) {
                console.error('Error creating archive:', error);
                // Reset button state
                if (archiveBtn) {
                    archiveBtn.disabled = false;
                    archiveBtn.textContent = 'Create Archive';
                }
                alert(error.message || 'Failed to create archive. Please try again.');
            }
        },

        async analyzeContent(url) {
            try {
                const response = await fetch(`${config.apiBaseUrl}/analyze-content`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url })
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze content');
                }

                return await response.json();
            } catch (error) {
                console.error('Error analyzing content:', error);
                return null;
            }
        },

        async getArchiveImportance(url) {
            try {
                const response = await fetch(`${config.apiBaseUrl}/archive-importance`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url })
                });

                if (!response.ok) {
                    throw new Error('Failed to get archive importance');
                }

                return await response.json();
            } catch (error) {
                console.error('Error getting archive importance:', error);
                return null;
            }
        },

        async showContentAnalysis(url) {
            const elementId = `analysis-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const element = document.getElementById(elementId);
            
            element.innerHTML = '<div class="loading">Analyzing...</div>';
            
            try {
                const analysis = await this.analyzeContent(url);
                if (!analysis) throw new Error('Analysis failed');
                
                element.innerHTML = `
                    <div class="content-analysis-results">
                        <h4>Content Analysis</h4>
                        <div class="analysis-section">
                            <h5>Topics</h5>
                            <ul>
                                ${analysis.analysis.topics.map(topic => `
                                    <li>${topic}</li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="analysis-section">
                            <h5>Sentiment</h5>
                            <div class="sentiment-score">
                                Score: ${analysis.analysis.sentiment.score || 'N/A'}
                            </div>
                        </div>
                        <div class="analysis-section">
                            <h5>Category</h5>
                            <div class="category-label">
                                ${analysis.analysis.category || 'Unknown'}
                            </div>
                        </div>
                        ${analysis.analysis.summary ? `
                            <div class="analysis-section">
                                <h5>Summary</h5>
                                <p>${analysis.analysis.summary}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (error) {
                element.innerHTML = `
                    <div class="error-message">
                        Failed to analyze content. Please try again.
                    </div>
                `;
            }
        },

        async analyzeAllContent() {
            const urls = [...state.urlDetailsForExport.archived.map(item => item.url), ...state.urlDetailsForExport.unarchived];
            
            try {
                const response = await fetch(`${config.apiBaseUrl}/batch-analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ urls })
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze content');
                }

                const results = await response.json();
                
                // Update UI with batch analysis results
                results.forEach(result => {
                    const elementId = `analysis-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    const element = document.getElementById(elementId);
                    
                    if (element) {
                        if (result.error) {
                            element.innerHTML = `
                                <div class="error-message">
                                    Analysis failed: ${result.error}
                                </div>
                            `;
                        } else {
                            element.innerHTML = `
                                <div class="content-analysis-results">
                                    <h4>Content Analysis</h4>
                                    <div class="analysis-section">
                                        <h5>Topics</h5>
                                        <ul>
                                            ${result.analysis.topics.map(topic => `
                                                <li>${topic}</li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                    <div class="analysis-section">
                                        <h5>Sentiment</h5>
                                        <div class="sentiment-score">
                                            Score: ${result.analysis.sentiment.score || 'N/A'}
                                        </div>
                                    </div>
                                    <div class="analysis-section">
                                        <h5>Category</h5>
                                        <div class="category-label">
                                            ${result.analysis.category || 'Unknown'}
                                        </div>
                                    </div>
                                    ${result.analysis.summary ? `
                                        <div class="analysis-section">
                                            <h5>Summary</h5>
                                            <p>${result.analysis.summary}</p>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }
                    }
                });
            } catch (error) {
                console.error('Error in batch analysis:', error);
                alert('Failed to analyze content. Please try again.');
            }
        },
    };

    // Initialize event listeners
    document.getElementById('inputText').addEventListener('input', 
        utils.debounce(() => {
            if (document.getElementById('inputText').value.trim()) {
                document.getElementById('countButton').disabled = false;
            } else {
                document.getElementById('countButton').disabled = true;
            }
        }, 300)
    );

    // Add input preprocessing
    elements.input.addEventListener('input', (e) => {
        // Clean up WIP URLs as they're pasted
        const input = e.target.value;
        const cleanedInput = input.replace(/archive\.ph\/wip\//g, 'archive.ph/');
        if (input !== cleanedInput) {
            e.target.value = cleanedInput;
        }
    });

    // API functions
    const api = {
        async fetchArchiveMetadata(archiveId) {
            try {
                const response = await fetch(`${config.apiBaseUrl}/archive-metadata/${archiveId}`);
                const data = await response.json();
                
                if (data.error) {
                    // Move failed URLs to Not Archived category
                    return {
                        error: true,
                        category: 'Not Archived',
                        originalUrl: data.originalUrl || null,
                        message: data.error
                    };
                }
                
                return data;
            } catch (error) {
                return {
                    error: true,
                    category: 'Not Archived',
                    message: 'Failed to fetch archive metadata'
                };
            }
        },

        async fetchArchiveDates(urls) {
            try {
                const batchSize = config.batchSize;
                const results = {};
                let processedUrls = 0;
                const totalUrls = urls.length;

                // Show progress bar
                const progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                progressBar.innerHTML = `
                    <div class="progress-fill"></div>
                    <div class="progress-text">Processing URLs: 0/${totalUrls}</div>
                `;
                elements.loading.appendChild(progressBar);

                // Process URLs in batches
                for (let i = 0; i < urls.length; i += batchSize) {
                    const batch = urls.slice(i, i + batchSize);
                    try {
                        const response = await fetch(`${config.apiBaseUrl}/batch-metadata`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ urls: batch })
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const data = await response.json();
                        Object.assign(results, data.results);

                        // Update progress
                        processedUrls += batch.length;
                        const progress = (processedUrls / totalUrls) * 100;
                        progressBar.querySelector('.progress-fill').style.width = `${progress}%`;
                        progressBar.querySelector('.progress-text').textContent = 
                            `Processing URLs: ${processedUrls}/${totalUrls}`;

                    } catch (error) {
                        console.error('Batch processing error:', error);
                        // Continue with next batch despite errors
                    }
                }

                // Remove progress bar
                progressBar.remove();
                return results;

            } catch (e) {
                console.error('Archive dates fetch error:', e);
                return {};
            }
        }
    };

    // Chart functions
    const charts = {
        updateCharts: (data) => {
            // Ensure data exists and has required properties
            if (!data || !data.dates) {
                console.log('No chart data available');
                return;
            }

            const archiveDates = data.dates || {};
            const tweetDates = {};  // We'll add this feature later
            
            // Sort dates and prepare data
            const sortDates = (dates) => {
                if (!dates || typeof dates !== 'object') {
                    return {};
                }
                return Object.entries(dates)
                    .sort(([a], [b]) => new Date(a) - new Date(b))
                    .reduce((obj, [key, value]) => {
                        obj[key] = value;
                        return obj;
                    }, {});
            };

            const sortedArchiveDates = sortDates(archiveDates);
            const sortedTweetDates = sortDates(tweetDates);

            // Calculate moving averages
            const calculateMovingAverage = (data, window = 3) => {
                if (!data || !Object.values(data).length) {
                    return [];
                }
                const values = Object.values(data);
                return values.map((_, idx) => {
                    const start = Math.max(0, idx - Math.floor(window / 2));
                    const end = Math.min(values.length, start + window);
                    const sum = values.slice(start, end).reduce((a, b) => a + b, 0);
                    return sum / (end - start);
                });
            };

            const chartConfigs = [
                {
                    id: 'archiveChart',
                    data: sortedArchiveDates,
                    label: 'Archive Dates by Month',
                    color: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    trendColor: 'rgba(255, 159, 64, 1)'
                },
                {
                    id: 'tweetChart',
                    data: sortedTweetDates,
                    label: 'Tweet Creation Dates by Month',
                    color: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    trendColor: 'rgba(54, 162, 235, 1)'
                }
            ];

            chartConfigs.forEach(({ id, data, label, color, borderColor, trendColor }) => {
                const canvas = document.getElementById(id);
                if (!canvas) {
                    console.log(`Canvas element ${id} not found`);
                    return;
                }
                const ctx = canvas.getContext('2d');
                const labels = Object.keys(data);
                const values = Object.values(data);
                const movingAverage = calculateMovingAverage(data);

                if (state.charts[id]) {
                    state.charts[id].destroy();
                }

                if (labels.length) {
                    canvas.style.display = 'block';
                    
                    // Calculate cumulative values
                    const cumulative = values.reduce((acc, val) => {
                        const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
                        acc.push(prev + val);
                        return acc;
                    }, []);

                    state.charts[id] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels,
                            datasets: [
                                {
                                    label: `${label} (Count)`,
                                    data: values,
                                    backgroundColor: color,
                                    borderColor: borderColor,
                                    borderWidth: 1,
                                    order: 2
                                },
                                {
                                    label: `${label} (Trend)`,
                                    data: movingAverage,
                                    type: 'line',
                                    borderColor: trendColor,
                                    borderWidth: 2,
                                    fill: false,
                                    pointRadius: 0,
                                    order: 1
                                },
                                {
                                    label: `${label} (Cumulative)`,
                                    data: cumulative,
                                    type: 'line',
                                    borderColor: 'rgba(153, 102, 255, 1)',
                                    borderWidth: 2,
                                    fill: false,
                                    pointRadius: 0,
                                    order: 0,
                                    hidden: true
                                }
                            ]
                        },
                        options: {
                            ...config.chartOptions,
                            plugins: {
                                ...config.chartOptions.plugins,
                                annotation: {
                                    annotations: {
                                        average: {
                                            type: 'line',
                                            yMin: values.reduce((a, b) => a + b, 0) / values.length,
                                            yMax: values.reduce((a, b) => a + b, 0) / values.length,
                                            borderColor: 'rgba(255, 255, 255, 0.5)',
                                            borderWidth: 1,
                                            borderDash: [6, 6],
                                            label: {
                                                content: 'Average',
                                                enabled: true,
                                                position: 'end'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                } else {
                    canvas.style.display = 'none';
                }
            });
        },

        updateChartType: () => {
            const chartType = document.getElementById('chartType').value;
            Object.values(state.charts).forEach(chart => {
                if (!chart) return;
                
                const datasets = chart.data.datasets;
                datasets.forEach(dataset => {
                    if (dataset.type !== 'line' || dataset.order === 1) {
                        dataset.type = chartType;
                    }
                });
                chart.update();
            });
        },

        toggleDataset: (datasetType) => {
            Object.values(state.charts).forEach(chart => {
                if (!chart) return;
                
                chart.data.datasets.forEach(dataset => {
                    if (datasetType === 'trend' && dataset.order === 1) {
                        dataset.hidden = !document.getElementById('showTrend').checked;
                    } else if (datasetType === 'cumulative' && dataset.order === 0) {
                        dataset.hidden = !document.getElementById('showCumulative').checked;
                    }
                });
                chart.update();
            });
        },

        toggleAnnotation: (annotationType) => {
            Object.values(state.charts).forEach(chart => {
                if (!chart) return;
                
                const show = document.getElementById(`show${annotationType.charAt(0).toUpperCase() + annotationType.slice(1)}`).checked;
                if (chart.options.plugins.annotation?.annotations?.[annotationType]) {
                    chart.options.plugins.annotation.annotations[annotationType].display = show;
                    chart.update();
                }
            });
        },

        resetZoom: () => {
            Object.values(state.charts).forEach(chart => {
                if (!chart) return;
                chart.resetZoom();
            });
        },

        init() {
            // Add paste event listener
            document.getElementById('inputText').addEventListener('paste', (e) => {
                if (document.getElementById('autoProcess').checked) {
                    setTimeout(() => URLAnalyzer.analyze(), 100);
                }
            });

            // Add input event listener for enabling/disabling count button
            document.getElementById('inputText').addEventListener('input', 
                utils.debounce(() => {
                    const button = document.getElementById('countButton');
                    if (button) {
                        button.disabled = !document.getElementById('inputText').value.trim();
                    }
                }, 300)
            );

            // Add click event for Process URLs button
            document.getElementById('countButton').addEventListener('click', () => {
                URLAnalyzer.analyze();
            });

            // Add click event for Clear button
            document.getElementById('clearButton').addEventListener('click', () => {
                URLAnalyzer.clear();
            });

            // Initialize state
            state.charts = {
                archiveChart: null,
                tweetChart: null
            };

            // Initialize charts
            this.charts.init();

            console.log('URL Analyzer initialized');
        },

        resetCharts() {
            // Implementation for resetting charts
        }
    };

    // Core analysis function
    async function analyzeURLs(input, archiveOnly) {
        console.log('analyzeURLs called with:', { input, archiveOnly });
        const urls = input.match(config.urlRegex) || [];
        console.log('Found URLs:', urls);
        if (!urls.length) return null;

        console.log('Processing URLs...');
        
        // Process URLs in batches of 50
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < urls.length; i += batchSize) {
            batches.push(urls.slice(i, i + batchSize));
        }

        const results = {
            archivedUrls: [],
            nonArchivedUrls: [],
            archiveDates: {}
        };

        let processedCount = 0;
        const totalUrls = urls.length;

        // Process each batch
        for (const batch of batches) {
            try {
                const batchResults = await utils.processUrls(batch);
                
                // Merge results
                results.archivedUrls.push(...(batchResults.archivedUrls || []));
                results.nonArchivedUrls.push(...(batchResults.nonArchivedUrls || []));
                Object.assign(results.archiveDates, batchResults.archiveDates || {});

                // Update progress
                processedCount += batch.length;
                const progress = (processedCount / totalUrls) * 100;
                ui.updateProgress(progress);

            } catch (error) {
                console.error('Batch processing error:', error);
                // Continue with next batch despite errors
            }
        }

        return {
            urls: urls,
            dates: results.archiveDates,
            metrics: {
                total: urls.length,
                archived: results.archivedUrls.length,
                nonArchived: results.nonArchivedUrls.length
            },
            details: {
                archivedUrls: results.archivedUrls,
                nonArchivedUrls: results.nonArchivedUrls
            },
            analytics: {
                archive: {
                    stats: utils.calculateStats(results.archiveDates),
                    anomalies: utils.detectAnomalies(results.archiveDates),
                    trend: utils.predictTrend(results.archiveDates),
                    patterns: {
                        rapidIncrease: config.analytics.patterns.rapidIncrease(Object.values(results.archiveDates)),
                        seasonality: config.analytics.patterns.seasonality(Object.values(results.archiveDates))
                    }
                },
                tweet: {
                    stats: {
                        mean: 0,
                        median: 0,
                        max: 0,
                        percentile95: 0,
                        variance: 0
                    },
                    anomalies: {},
                    trend: {
                        slope: 0,
                        intercept: 0
                    },
                    patterns: {
                        rapidIncrease: false,
                        seasonality: false
                    }
                }
            }
        };
    }

    // Public methods
    return {
        state,
        utils,
        config,
        ui,
        charts,
        api,
        
        async analyze() {
            ui.showLoading(true);
            const input = elements.input.value;
            const archiveOnly = elements.archiveOnly.checked;

            try {
                // Validate input
                if (!input || !input.trim()) {
                    throw new Error('No input provided');
                }

                const results = await analyzeURLs(input, archiveOnly);
                
                // Validate results
                if (!results || typeof results !== 'object') {
                    throw new Error('Invalid analysis results');
                }

                // Ensure metrics exist and have valid values
                if (!results.metrics) {
                    results.metrics = {};
                }

                // Ensure all metrics have valid numbers
                Object.entries(results.metrics).forEach(([key, value]) => {
                    if (typeof value !== 'number' || isNaN(value)) {
                        results.metrics[key] = 0;
                    }
                });

                // Ensure categorizedDetails exists
                if (!results.categorizedDetails) {
                    results.categorizedDetails = {};
                }

                // Ensure dates exist
                if (!results.dates) results.dates = {};

                // Ensure errors array exists
                if (!Array.isArray(results.errors)) {
                    results.errors = [];
                }

                state.urlDetailsForExport = Object.values(results.categorizedDetails).flat();
                
                // Enhanced analytics with validation
                const archiveStats = utils.calculateStats(results.dates.archiveDates || {});
                const tweetStats = utils.calculateStats(results.dates.tweetDates || {});
                
                const archiveAnomalies = utils.detectAnomalies(results.dates.archiveDates || {});
                const tweetAnomalies = utils.detectAnomalies(results.dates.tweetDates || {});
                
                const archiveTrend = utils.predictTrend(results.dates.archiveDates || {});
                const tweetTrend = utils.predictTrend(results.dates.tweetDates || {});

                results.analytics = {
                    archive: {
                        stats: archiveStats,
                        anomalies: archiveAnomalies,
                        trend: archiveTrend,
                        patterns: {
                            rapidIncrease: config.analytics.patterns.rapidIncrease(Object.values(results.dates.archiveDates || {})),
                            seasonality: config.analytics.patterns.seasonality(Object.values(results.dates.archiveDates || {}))
                        }
                    },
                    tweet: {
                        stats: tweetStats,
                        anomalies: tweetAnomalies,
                        trend: tweetTrend,
                        patterns: {
                            rapidIncrease: config.analytics.patterns.rapidIncrease(Object.values(results.dates.tweetDates || {})),
                            seasonality: config.analytics.patterns.seasonality(Object.values(results.dates.tweetDates || {}))
                        }
                    }
                };

                ui.updateResults(results);
                charts.updateCharts(results);
                ui.updateAnalytics(results.analytics);
            } catch (error) {
                console.error('Analysis error:', error);
                elements.output.innerHTML = `
                    <div class="errors">
                        <p><strong>Error:</strong> ${error.message || 'Failed to analyze URLs. Please try again.'}</p>
                        ${error.stack ? `<pre class="error-stack">${error.stack}</pre>` : ''}
                    </div>
                `;
            } finally {
                ui.showLoading(false);
            }
        },

        clear() {
            elements.input.value = '';
            elements.archiveOnly.checked = false;
            elements.output.innerHTML = '';
            state.urlDetailsForExport = [];
            
            Object.values(state.charts).forEach(chart => {
                if (chart) {
                    chart.destroy();
                }
            });
            state.charts = { archive: null, tweet: null };
            
            [elements.archiveChart, elements.tweetChart].forEach(canvas => {
                canvas.style.display = 'none';
            });
        },

        export() {
            if (state.urlDetailsForExport.length === 0) {
                alert('No data to export.');
                return;
            }

            const csv = ['Category,URL,Archive Date,Tweet Date'];
            state.urlDetailsForExport.forEach(detail => {
                const row = [
                    `"${detail.category}"`,
                    `"${detail.url}"`,
                    detail.archiveDate ? `"${detail.archiveDate}"` : '',
                    detail.tweetDate ? `"${detail.tweetDate}"` : ''
                ];
                csv.push(row.join(','));
            });

            const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'url_analysis.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        },

        exportNonArchivedUrls() {
            const urls = state.urlDetailsForExport
                .filter(detail => detail.originalUrl)
                .map(detail => detail.originalUrl);
            
            if (!urls.length) {
                utils.showError('No non-archived URLs found to export');
                return;
            }

            const blob = new Blob([urls.join('\n')], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'non-archived-urls.txt';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        },

        init() {
            try {
                // Initialize DOM elements
                Object.keys(elements).forEach(key => {
                    if (!elements[key] && key !== 'archiveOnly') {  // archiveOnly is optional
                        console.warn(`Element ${key} not found in DOM`);
                    }
                });

                // Add paste event listener if input element exists
                if (elements.input) {
                    elements.input.addEventListener('paste', (e) => {
                        if (document.getElementById('autoProcess').checked) {
                            setTimeout(() => URLAnalyzer.analyze(), 100);
                        }
                    });

                    // Add input event listener for enabling/disabling count button
                    elements.input.addEventListener('input', utils.debounce(() => {
                        if (elements.countButton) {
                            elements.countButton.disabled = !elements.input.value.trim();
                        }
                    }, 300));
                }

                // Add click event for Process URLs button
                if (elements.countButton) {
                    elements.countButton.addEventListener('click', () => {
                        URLAnalyzer.analyze();
                    });
                }

                // Add click event for Clear button
                if (elements.clearButton) {
                    elements.clearButton.addEventListener('click', () => {
                        URLAnalyzer.clear();
                    });
                }

                // Initialize charts
                this.charts.init();

                console.log('URL Analyzer initialized');
                return true;
            } catch (error) {
                console.error('Error initializing URL Analyzer:', error);
                return false;
            }
        }
    };
})();

// Export the module
window.URLAnalyzer = URLAnalyzer;

// Add CSS for progress bar
const style = document.createElement('style');
style.textContent = `
    .progress-bar {
        width: 100%;
        height: 20px;
        background-color: var(--background-darker);
        border-radius: 10px;
        overflow: hidden;
        margin-top: 10px;
        position: relative;
    }

    .progress-fill {
        height: 100%;
        background-color: var(--primary-color);
        width: 0;
        transition: width 0.3s ease-in-out;
    }

    .progress-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: var(--text-color);
        font-size: 12px;
        text-align: center;
        width: 100%;
    }
    ${popupStyles}
`;
document.head.appendChild(style);

// Initialize the analyzer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => URLAnalyzer.init());

// Server Control Module
const ServerControl = (() => {
    const elements = {
        startButton: document.getElementById('startServerBtn'),
        statusIndicator: document.getElementById('serverStatus')
    };

    const config = {
        apiBaseUrl: 'http://localhost:5000'
    };

    const startServer = async () => {
        try {
            elements.startButton.disabled = true;
            elements.statusIndicator.textContent = 'Server Status: Starting...';
            
            // Show instructions to run the batch file
            elements.statusIndicator.textContent = 'Server Status: Please run start_server.bat to start the server';
            elements.startButton.disabled = false;
        } catch (error) {
            elements.statusIndicator.textContent = 'Server Status: Please run start_server.bat to start the server';
            elements.startButton.disabled = false;
        }
    };

    const checkServerStatus = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/health`);
            updateStatus(response.ok);
        } catch (error) {
            updateStatus(false);
        }
    };

    const updateStatus = (isRunning) => {
        elements.statusIndicator.textContent = `Server Status: ${isRunning ? 'Running' : 'Stopped'}`;
        elements.startButton.disabled = isRunning;
    };

    // Initialize
    const init = () => {
        if (elements.startButton) {
            elements.startButton.addEventListener('click', startServer);
            // Check status immediately and then every 5 seconds
            checkServerStatus();
            setInterval(checkServerStatus, 5000);
        }
    };

    return { init };
})();

// Initialize all modules
document.addEventListener('DOMContentLoaded', () => {
    URLAnalyzer.init();
    ServerControl.init();
}); 