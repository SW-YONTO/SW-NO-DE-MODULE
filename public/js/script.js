class NodeModulesCleaner {
    constructor() {
        this.selectedDirectories = new Set();
        this.allDirectories = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Scan button
        document.getElementById('scanBtn').addEventListener('click', () => {
            this.startScan();
        });

        // Test button
        document.getElementById('testBtn').addEventListener('click', () => {
            this.testScan();
        });

        // Select all button
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.toggleSelectAll();
        });

        // Delete selected button
        document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
            this.deleteSelected();
        });

        // Enter key in scan path input
        document.getElementById('scanPath').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startScan();
            }
        });
    }

    async testScan() {
        this.showLoading(true);
        this.updateLoadingMessage('Testing scan on current directory...');
        
        try {
            const response = await fetch('/test-scan');
            const data = await response.json();
            
            if (data.error) {
                alert(`Test failed: ${data.error}`);
            } else {
                let message = `Test Results:\n`;
                message += `Directory: ${data.testPath}\n`;
                message += `Total items: ${data.totalItems}\n`;
                message += `Node modules exists: ${data.nodeModulesExists}\n`;
                if (data.nodeModulesSize) {
                    message += `Node modules size: ${data.nodeModulesSize}\n`;
                }
                message += `First 10 items: ${data.items.join(', ')}`;
                
                alert(message);
            }
        } catch (error) {
            alert(`Test failed: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async startScan() {
        const scanPath = document.getElementById('scanPath').value.trim();
        if (!scanPath) {
            alert('Please enter a path to scan');
            return;
        }

        this.showLoading(true);
        this.hideResults();
        this.updateLoadingMessage('Starting scan...');

        try {
            const response = await fetch('/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ scanPath })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.allDirectories = data.directories;
                this.displayResults(data);
                this.updateLoadingMessage(`Scan completed! Found ${data.count} directories in ${data.scannedPath}`);
            } else {
                alert(`Scan failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Scan error:', error);
            alert(`Scan failed: ${error.message}`);
        } finally {
            setTimeout(() => {
                this.showLoading(false);
            }, 1000);
        }
    }

    startProgressMonitoring(sessionId) {
        const eventSource = new EventSource(`/scan-progress/${sessionId}`);
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'start':
                        this.updateLoadingMessage('Initializing scan...');
                        break;
                    case 'progress':
                        this.updateLoadingMessage(data.message);
                        break;
                    case 'complete':
                        this.updateLoadingMessage(`Scan completed! Found ${data.count} node_modules directories`);
                        eventSource.close();
                        break;
                }
            } catch (err) {
                console.error('Progress parsing error:', err);
            }
        };

        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            eventSource.close();
        };

        // Auto-close after 5 minutes to prevent hanging connections
        setTimeout(() => {
            if (eventSource.readyState !== EventSource.CLOSED) {
                eventSource.close();
            }
        }, 300000);
    }

    updateLoadingMessage(message) {
        const loadingText = document.querySelector('.loading p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    displayResults(data) {
        // Update summary
        document.getElementById('resultsCount').textContent = `Found ${data.count} directories`;
        document.getElementById('totalSize').textContent = `Total size: ${data.totalSize}`;

        // Clear and populate directory list
        const directoryList = document.getElementById('directoryList');
        directoryList.innerHTML = '';

        if (data.directories.length === 0) {
            directoryList.innerHTML = '<div class="directory-item"><p>No node_modules directories found!</p></div>';
        } else {
            data.directories.forEach((dir, index) => {
                const dirItem = this.createDirectoryItem(dir, index);
                directoryList.appendChild(dirItem);
            });
        }

        // Show results section
        document.getElementById('resultsSection').classList.remove('hidden');
        
        // Reset selection
        this.selectedDirectories.clear();
        this.updateDeleteButton();
        this.updateSelectAllButton();
    }

    createDirectoryItem(directory, index) {
        const dirItem = document.createElement('div');
        dirItem.className = 'directory-item';
        
        dirItem.innerHTML = `
            <input type="checkbox" id="dir-${index}" data-path="${directory.path}">
            <div class="directory-info">
                <div class="directory-path">${directory.path}</div>
                <div class="directory-details">
                    <span><i class="fas fa-folder"></i> ${directory.parentProject}</span>
                    <span><i class="fas fa-hdd"></i> ${directory.sizeFormatted}</span>
                </div>
            </div>
            <div class="directory-size">${directory.sizeFormatted}</div>
        `;

        // Add checkbox event listener
        const checkbox = dirItem.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.selectedDirectories.add(directory.path);
            } else {
                this.selectedDirectories.delete(directory.path);
            }
            this.updateDeleteButton();
            this.updateSelectAllButton();
        });

        return dirItem;
    }

    toggleSelectAll() {
        const selectAllBtn = document.getElementById('selectAllBtn');
        const checkboxes = document.querySelectorAll('#directoryList input[type="checkbox"]');
        
        const allSelected = this.selectedDirectories.size === this.allDirectories.length;

        checkboxes.forEach(checkbox => {
            if (allSelected) {
                checkbox.checked = false;
                this.selectedDirectories.delete(checkbox.dataset.path);
            } else {
                checkbox.checked = true;
                this.selectedDirectories.add(checkbox.dataset.path);
            }
        });

        this.updateDeleteButton();
        this.updateSelectAllButton();
    }

    updateSelectAllButton() {
        const selectAllBtn = document.getElementById('selectAllBtn');
        const allSelected = this.selectedDirectories.size === this.allDirectories.length;
        
        if (allSelected && this.allDirectories.length > 0) {
            selectAllBtn.innerHTML = '<i class="fas fa-square"></i> Deselect All';
        } else {
            selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> Select All';
        }
    }

    updateDeleteButton() {
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        const count = this.selectedDirectories.size;
        
        if (count > 0) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Delete Selected (${count})`;
        } else {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Selected';
        }
    }

    async deleteSelected() {
        if (this.selectedDirectories.size === 0) {
            alert('No directories selected');
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete ${this.selectedDirectories.size} node_modules directories? This action cannot be undone.`);
        if (!confirmed) return;

        this.showDeleteProgress(true);
        
        try {
            const pathsArray = Array.from(this.selectedDirectories);
            const response = await fetch('/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paths: pathsArray })
            });

            const data = await response.json();

            if (data.success) {
                this.displayDeleteResults(data.results);
                // Remove successfully deleted directories from the list
                this.removeDeletedDirectories(data.results);
            } else {
                alert(`Deletion failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert(`Deletion failed: ${error.message}`);
        } finally {
            this.showDeleteProgress(false);
        }
    }

    removeDeletedDirectories(results) {
        const successfulDeletes = results.filter(r => r.success).map(r => r.path);
        
        // Remove from selected directories
        successfulDeletes.forEach(path => {
            this.selectedDirectories.delete(path);
        });

        // Remove from all directories
        this.allDirectories = this.allDirectories.filter(dir => 
            !successfulDeletes.includes(dir.path)
        );

        // Update display
        this.displayResults({
            directories: this.allDirectories,
            count: this.allDirectories.length,
            totalSize: this.calculateTotalSize()
        });
    }

    calculateTotalSize() {
        const totalBytes = this.allDirectories.reduce((sum, dir) => sum + dir.size, 0);
        return this.formatBytes(totalBytes);
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    displayDeleteResults(results) {
        const deleteResultsList = document.getElementById('deleteResultsList');
        deleteResultsList.innerHTML = '';

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = `delete-result ${result.success ? 'success' : 'error'}`;
            
            const icon = result.success ? 'fa-check-circle' : 'fa-exclamation-triangle';
            
            resultItem.innerHTML = `
                <i class="fas ${icon}"></i>
                <div>
                    <strong>${result.path}</strong><br>
                    <small>${result.message}</small>
                </div>
            `;
            
            deleteResultsList.appendChild(resultItem);
        });

        document.getElementById('deleteResults').classList.remove('hidden');
    }

    showLoading(show) {
        const loadingDiv = document.getElementById('loadingDiv');
        if (show) {
            loadingDiv.classList.remove('hidden');
        } else {
            loadingDiv.classList.add('hidden');
        }
    }

    hideResults() {
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('deleteResults').classList.add('hidden');
    }

    showDeleteProgress(show) {
        const progressDiv = document.getElementById('deleteProgress');
        if (show) {
            progressDiv.classList.remove('hidden');
            this.animateProgress();
        } else {
            progressDiv.classList.add('hidden');
        }
    }

    animateProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
                progressText.textContent = 'Finalizing deletion...';
            }
            progressFill.style.width = progress + '%';
        }, 100);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NodeModulesCleaner();
});
