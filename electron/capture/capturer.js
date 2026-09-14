const { desktopCapturer, screen } = require('electron');

/**
 * Screen Capturer & Intelligent Change Detector
 * Prevents redundant AI calls by computing quick thumbnail downscaled pixel differences.
 */
class ScreenCapturer {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.04; // 4% difference required to count as meaningful change
    this.lastThumbnail = null;
    this.thumbnailSize = { width: 64, height: 36 }; // 16:9 micro-grid for ultra-fast diffing
  }

  /**
   * Capture active screen display using Electron desktopCapturer.
   * Returns full-res JPEG base64 and micro-thumbnail.
   */
  async captureScreen() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    // Electron desktopCapturer sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.min(width, 1600), height: Math.min(height, 900) },
      fetchWindowIcons: false,
    });

    if (!sources || sources.length === 0) {
      throw new Error('No screen sources found');
    }

    const primarySource = sources[0];
    const image = primarySource.thumbnail;

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

    // Return JPEG base64 buffer for LLM (fast, lightweight compared to raw PNG)
    const jpegBuffer = image.toJPEG(75);
    const base64 = jpegBuffer.toString('base64');

    return {
      hasMeaningfulChange,
      base64,
      dataUrl: `data:image/jpeg;base64,${base64}`,
      width: image.getSize().width,
      height: image.getSize().height,
      name: primarySource.name,
    };
  }

  /**
   * Compare micro-bitmap buffer with previous frame.
   * @param {Buffer} currentBitmap
   * @returns {boolean}
   */
  detectChange(currentBitmap) {
    if (!this.lastThumbnail || this.lastThumbnail.length !== currentBitmap.length) {
      return true; // First run or size changed -> trigger
    }

    let diffPixels = 0;
    const totalPixels = currentBitmap.length / 4; // RGBA 4 bytes per pixel

    for (let i = 0; i < currentBitmap.length; i += 4) {
      // Calculate perceptual luminance or channel delta
      const dr = Math.abs(currentBitmap[i] - this.lastThumbnail[i]);
      const dg = Math.abs(currentBitmap[i + 1] - this.lastThumbnail[i + 1]);
      const db = Math.abs(currentBitmap[i + 2] - this.lastThumbnail[i + 2]);

      // If RGB channel delta exceeds noise tolerance
      if (dr + dg + db > 40) {
        diffPixels++;
      }
    }

    const diffRatio = diffPixels / totalPixels;
    // Meaningful change: significant enough to analyze, but not minor cursor flicker
    return diffRatio >= this.threshold;
  }

  reset() {
    this.lastThumbnail = null;
  }
}

module.exports = { ScreenCapturer };
