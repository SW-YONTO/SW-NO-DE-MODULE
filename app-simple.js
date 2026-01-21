const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Core system directories to exclude
const EXCLUDED_PATHS = [
    path.join(os.homedir(), '.vscode'),
    path.join(os.homedir(), 'AppData'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'),
    'C:\\Windows',
    'C:\\System32',
    path.join(os.homedir(), '.npm'),
    path.join(os.homedir(), '.node-gyp'),
    path.join(os.homedir(), '.cache')
];

// Function to check if a path should be excluded
function isExcludedPath(dirPath) {
    return EXCLUDED_PATHS.some(excluded => 
        dirPath.toLowerCase().includes(excluded.toLowerCase())
    );
}

// Function to get directory size
async function getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            
            try {
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    totalSize += await getDirectorySize(itemPath);
                } else {
                    totalSize += stats.size;
                }
            } catch (err) {
                // Skip files/dirs we can't access
                continue;
            }
        }
    } catch (err) {
        // Directory doesn't exist or can't be read
        return 0;
    }
    
    return totalSize;
}

// Function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Simple scanning function
async function scanForNodeModules(startPath, maxDepth = 3, currentDepth = 0) {
    const nodeModulesDirs = [];
    
    if (currentDepth > maxDepth || isExcludedPath(startPath)) {
        return nodeModulesDirs;
    }

    try {
        console.log(`Scanning depth ${currentDepth}: ${startPath}`);
        
        const stats = await fs.stat(startPath);
        if (!stats.isDirectory()) return nodeModulesDirs;

        const items = await fs.readdir(startPath);
        console.log(`Found ${items.length} items in ${startPath}`);
        
        for (const item of items) {
            const itemPath = path.join(startPath, item);
            
            try {
                const itemStats = await fs.stat(itemPath);
                
                if (itemStats.isDirectory()) {
                    if (item === 'node_modules' && !isExcludedPath(itemPath)) {
                        console.log(`Found node_modules: ${itemPath}`);
                        const size = await getDirectorySize(itemPath);
                        nodeModulesDirs.push({
                            path: itemPath,
                            size: size,
                            sizeFormatted: formatBytes(size),
                            parentProject: path.dirname(itemPath)
                        });
                    } else if (!item.startsWith('.') && 
                              item !== 'node_modules' && 
                              item !== 'System Volume Information' &&
                              item !== '$Recycle.Bin' &&
                              !item.toLowerCase().includes('windows') &&
                              !item.toLowerCase().includes('program files')) {
                        // Recursively scan subdirectories
                        const subDirs = await scanForNodeModules(itemPath, maxDepth, currentDepth + 1);
                        nodeModulesDirs.push(...subDirs);
                    }
                }
            } catch (err) {
                console.log(`Skipping ${itemPath}: ${err.message}`);
                continue;
            }
        }
    } catch (err) {
        console.log(`Skipping ${startPath}: ${err.message}`);
    }
    
    return nodeModulesDirs;
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Simple scan endpoint
app.post('/scan', async (req, res) => {
    try {
        const { scanPath } = req.body;
        let pathToScan = scanPath || path.resolve('./');
        
        console.log(`Starting scan from: ${pathToScan}`);
        
        // Check if path exists
        if (!(await fs.pathExists(pathToScan))) {
            return res.json({
                success: false,
                error: `Path does not exist: ${pathToScan}`
            });
        }
        
        const nodeModulesDirs = await scanForNodeModules(pathToScan);
        
        console.log(`Scan completed. Found ${nodeModulesDirs.length} node_modules directories`);
        
        const totalSize = nodeModulesDirs.reduce((sum, dir) => sum + dir.size, 0);
        
        res.json({
            success: true,
            directories: nodeModulesDirs,
            totalSize: formatBytes(totalSize),
            count: nodeModulesDirs.length,
            scannedPath: pathToScan
        });
    } catch (error) {
        console.error('Scan error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint
app.get('/test-scan', async (req, res) => {
    try {
        const testPath = path.resolve('./');
        console.log(`Testing scan on current directory: ${testPath}`);
        
        const items = await fs.readdir(testPath);
        const nodeModulesExists = items.includes('node_modules');
        
        let result = {
            success: true,
            testPath,
            items: items.slice(0, 10),
            nodeModulesExists,
            totalItems: items.length
        };
        
        if (nodeModulesExists) {
            const nodeModulesPath = path.join(testPath, 'node_modules');
            const size = await getDirectorySize(nodeModulesPath);
            result.nodeModulesSize = formatBytes(size);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Test error:', error);
        res.json({ 
            success: false,
            error: error.message 
        });
    }
});

// Delete endpoint
app.post('/delete', async (req, res) => {
    try {
        const { paths } = req.body;
        const results = [];
        
        for (const dirPath of paths) {
            try {
                if (await fs.pathExists(dirPath) && !isExcludedPath(dirPath)) {
                    await fs.remove(dirPath);
                    results.push({
                        path: dirPath,
                        success: true,
                        message: 'Deleted successfully'
                    });
                } else {
                    results.push({
                        path: dirPath,
                        success: false,
                        message: 'Path not found or excluded'
                    });
                }
            } catch (error) {
                results.push({
                    path: dirPath,
                    success: false,
                    message: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results: results
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Node Modules Cleaner running on http://localhost:${PORT}`);
    console.log('Ready to scan and clean node_modules directories!');
});
