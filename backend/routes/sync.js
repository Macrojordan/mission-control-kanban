const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Store last sync time in memory (will reset on server restart)
// In production, this could be stored in the database
let lastSyncTime = null;
let isSyncing = false;

/**
 * GET /api/sync/status
 * Get the current sync status
 */
router.get('/status', (req, res) => {
  res.json({
    lastSync: lastSyncTime,
    isSyncing: isSyncing,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/sync
 * Trigger a sync with Randy via OpenClaw gateway
 */
router.post('/', async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({
      error: 'Sync already in progress',
      isSyncing: true,
      lastSync: lastSyncTime
    });
  }

  isSyncing = true;

  try {
    // Try to trigger sync via OpenClaw CLI
    let syncTriggered = false;
    let errorMessage = '';

    try {
      // Try using the openclaw CLI command
      const { stdout, stderr } = await execPromise(
        'openclaw gateway wake --text "sync mission control" --mode now',
        { timeout: 10000 }
      );
      
      if (stderr && !stderr.includes('warning')) {
        console.log('OpenClaw stderr:', stderr);
      }
      
      console.log('OpenClaw stdout:', stdout);
      syncTriggered = true;
    } catch (cliError) {
      console.log('OpenClaw CLI not available or failed:', cliError.message);
      errorMessage = cliError.message;
      
      // Fallback: Try HTTP request to OpenClaw gateway if it exposes an HTTP endpoint
      try {
        const response = await fetch('http://localhost:8080/api/wake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'sync mission control',
            mode: 'now'
          })
        });
        
        if (response.ok) {
          syncTriggered = true;
        } else {
          errorMessage += ` | HTTP fallback failed: ${response.status}`;
        }
      } catch (httpError) {
        errorMessage += ` | HTTP fallback failed: ${httpError.message}`;
      }
    }

    if (syncTriggered) {
      lastSyncTime = new Date().toISOString();
      isSyncing = false;
      
      res.json({
        success: true,
        message: 'Sync triggered successfully',
        lastSync: lastSyncTime,
        timestamp: lastSyncTime
      });
    } else {
      isSyncing = false;
      res.status(503).json({
        error: 'Failed to trigger sync',
        message: errorMessage,
        lastSync: lastSyncTime,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    isSyncing = false;
    console.error('Sync error:', error);
    
    res.status(500).json({
      error: 'Internal server error during sync',
      message: error.message,
      lastSync: lastSyncTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sync/complete
 * Called by Randy to mark sync as complete
 */
router.post('/complete', (req, res) => {
  lastSyncTime = new Date().toISOString();
  isSyncing = false;
  
  res.json({
    success: true,
    message: 'Sync marked as complete',
    lastSync: lastSyncTime,
    timestamp: lastSyncTime
  });
});

module.exports = router;
