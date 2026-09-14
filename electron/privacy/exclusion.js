/**
 * Privacy and Window Exclusion Module
 * Ensures Catmonto never captures or analyzes sensitive windows/apps.
 */
class PrivacyFilter {
  constructor(excludedKeywords = []) {
    this.excludedKeywords = excludedKeywords.map((k) => k.toLowerCase());
  }

  setExclusions(keywords) {
    this.excludedKeywords = (keywords || []).map((k) => k.toLowerCase());
  }

  /**
   * Check if a given window title or application name matches exclusion keywords.
   * @param {string} windowTitle
   * @param {string} appName
   * @returns {boolean} true if excluded/sensitive, false if safe to observe
   */
  isExcluded(windowTitle = '', appName = '') {
    const combined = `${windowTitle} ${appName}`.toLowerCase();
    for (const keyword of this.excludedKeywords) {
      if (keyword && combined.includes(keyword)) {
        return true;
      }
    }
    return false;
  }
}

module.exports = { PrivacyFilter };
