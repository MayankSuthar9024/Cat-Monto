const { desktopCapturer, screen } = require('electron');
const { exec } = require('child_process');

/**
 * Helper to query active application windows in the interactive console session on Windows.
 */
function getConsoleWindows() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);

    exec('tasklist /v /fi "SESSIONNAME eq Console" /fo csv', { timeout: 3500 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      try {
        const lines = stdout.split('\r\n').filter((l) => l.trim().length > 0);
        const windows = [];
        for (let i = 1; i < lines.length; i++) {
          const match = lines[i].match(
            /^"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","(.*)"$/
          );
          if (match) {
            const [, imgName, pid, , , , , , , title] = match;
            const cleanTitle = (title || '').trim();
            if (
              cleanTitle &&
              cleanTitle !== 'N/A' &&
              cleanTitle !== 'OleMainThreadWndName' &&
              cleanTitle !== 'DWM Notification Window' &&
              cleanTitle !== 'OLEChannelWnd' &&
              cleanTitle !== 'Default IME' &&
              cleanTitle !== 'MSCTFIME UI' &&
              cleanTitle !== 'DesktopWindowXamlSource' &&
              cleanTitle !== 'New notification' &&
              cleanTitle !== 'Quick Settings' &&
              !cleanTitle.startsWith('Catmonto')
            ) {
              windows.push({
                id: `win:${pid}`,
                name: cleanTitle,
                appName: imgName.replace('.exe', ''),
                type: 'window',
              });
            }
          }
        }
        resolve(windows);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

/**
 * Screen Capturer & Intelligent Change Detector
 * Supports capturing Entire Display or Specific Application Windows.
 * Prevents redundant AI calls by computing quick thumbnail downscaled pixel differences.
 */
class ScreenCapturer {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.006; // 0.6% difference (sensitive enough to detect code editor edits and red error highlights)
    this.lastThumbnail = null;
    this.thumbnailSize = { width: 128, height: 72 }; // 128x72 micro-grid for reliable change detection
  }

  /**
   * Get list of all capture sources (Screens + Open Windows)
   */
  async getAvailableSources() {
    let rawSources = [];

    // Attempt standard desktopCapturer first
    try {
      rawSources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 240, height: 135 },
        fetchWindowIcons: false,
      });
    } catch (err) {
      console.warn('[ScreenCapturer] desktopCapturer with thumbnails failed, retrying without:', err.message);
      try {
        rawSources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 0, height: 0 },
        });
      } catch (e) {
        console.error('[ScreenCapturer] desktopCapturer fallback error:', e.message);
      }
    }

    let formatted = (rawSources || [])
      .filter((s) => s.name && !s.name.includes('Taskbar') && !s.name.startsWith('Catmonto'))
      .map((s) => ({
        id: s.id,
        name: s.name,
        type: s.id.startsWith('window') ? 'window' : 'screen',
        thumbnail: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : null,
      }));

    // If desktopCapturer returned no window sources (known Windows 11 WGC quirk), augment with console process windows
    const hasWindows = formatted.some((s) => s.type === 'window');
    if (!hasWindows && process.platform === 'win32') {
      const consoleWins = await getConsoleWindows();
      for (const cw of consoleWins) {
        if (!formatted.some((s) => s.name.toLowerCase() === cw.name.toLowerCase())) {
          formatted.push({
            id: cw.id,
            name: cw.name,
            appName: cw.appName,
            type: 'window',
            thumbnail: null,
          });
        }
      }
    }

    return formatted;
  }

  /**
   * Capture active screen display or specific window using Electron desktopCapturer.
   * Returns full-res JPEG base64 and micro-thumbnail.
   */
  async captureScreen(targetSourceId = null) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const isTargetSpecific = Boolean(targetSourceId && targetSourceId !== 'entire-screen');

    let sources = [];
    try {
      sources = await desktopCapturer.getSources({
        types: isTargetSpecific ? ['window', 'screen'] : ['screen', 'window'],
        thumbnailSize: { width: Math.min(width, 1920), height: Math.min(height, 1080) },
        fetchWindowIcons: false,
      });
    } catch (err) {
      console.warn('[ScreenCapturer] getSources failed, falling back to screen only:', err.message);
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.min(width, 1920), height: Math.min(height, 1080) },
      });
    }

    if (!sources || sources.length === 0) {
      throw new Error('No screen or window sources found');
    }

    let source = sources[0];
    if (isTargetSpecific) {
      const matched = sources.find((s) => {
        if (s.id === targetSourceId) return true;
        const targetPid = targetSourceId.replace(/^(win:|window:)/, '').split(':')[0];
        const sPid = s.id.replace(/^(win:|window:)/, '').split(':')[0];
        return Boolean(targetPid && sPid && targetPid === sPid);
      });
      if (matched) {
        source = matched;
      }
    }

    let image = source.thumbnail;
    // If target window image is empty (e.g. minimized), fall back to primary screen display
    if (!image || image.isEmpty()) {
      const screenSource = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
      if (screenSource && screenSource.thumbnail && !screenSource.thumbnail.isEmpty()) {
        source = screenSource;
        image = screenSource.thumbnail;
      }
    }

    if (!image || image.isEmpty()) {
      throw new Error('Screen capture image buffer is empty. Please ensure your desktop display is visible.');
    }

    // Generate downsampled thumbnail for lightning fast diffing
    const microThumb = image.resize({
      width: this.thumbnailSize.width,
      height: this.thumbnailSize.height,
      quality: 'fast',
    });

    const microBitmap = microThumb.toBitmap();
    const hasMeaningfulChange = this.detectChange(microBitmap);

    // Save current as last
    this.lastThumbnail = microBitmap;

    // Return JPEG base64 buffer for LLM (crisp, lightweight compared to raw PNG)
    const jpegBuffer = image.toJPEG(88);
    const base64 = jpegBuffer.toString('base64');

    return {
      hasMeaningfulChange,
      base64,
      dataUrl: `data:image/jpeg;base64,${base64}`,
      width: image.getSize().width,
      height: image.getSize().height,
      name: source.name,
      sourceId: source.id,
    };
  }

  /**
   * Compare micro-bitmap buffer with previous frame.
   */
  detectChange(currentBitmap) {
    if (!this.lastThumbnail || this.lastThumbnail.length !== currentBitmap.length) {
      return true; // First run or size changed -> trigger
    }

    let diffPixels = 0;
    const totalPixels = currentBitmap.length / 4; // RGBA 4 bytes per pixel

    for (let i = 0; i < currentBitmap.length; i += 4) {
      const dr = Math.abs(currentBitmap[i] - this.lastThumbnail[i]);
      const dg = Math.abs(currentBitmap[i + 1] - this.lastThumbnail[i + 1]);
      const db = Math.abs(currentBitmap[i + 2] - this.lastThumbnail[i + 2]);

      // If RGB channel delta exceeds noise tolerance
      if (dr + dg + db > 40) {
        diffPixels++;
      }
    }

    const diffRatio = diffPixels / totalPixels;
    return diffRatio >= this.threshold;
  }

  reset() {
    this.lastThumbnail = null;
  }
}

module.exports = { ScreenCapturer };
