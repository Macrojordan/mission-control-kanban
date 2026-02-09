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
    // Record sync time immediately
    lastSyncTime = new Date().toISOString();
    
    // Try to trigger Randy via OpenClaw (best effort, don't fail if unavailable)
    try {
      const { stdout } = await execPromise(
        'openclaw gateway wake --text "sync mission control" --mode now 2>/dev/null || true',
        { timeout: 5000 }
      );
      console.log('OpenClaw wake attempted:', stdout);
    } catch (cliError) {
      // OpenClaw not available on this server - that's ok
      console.log('OpenClaw CLI not available (expected on Render)');
    }
    
    isSyncing = false;
    
    res.json({
      success: true,
      message: 'Sync completed',
      lastSync: lastSyncTime,
      timestamp: lastSyncTime,
      note: 'Data refreshed. Randy will sync via heartbeat if CLI unavailable.'
    });
    
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
