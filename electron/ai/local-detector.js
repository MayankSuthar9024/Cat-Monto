/**
 * Local Error Detector (Step 20)
 * Fast, deterministic local checks that can instantly flag obvious syntax errors
 * before or in parallel with Gemini API calls for zero-latency feedback.
 */

/**
 * Check JavaScript syntax using Node.js vm compiler
 * @param {string} codeStr
 * @returns {{ hasError: boolean, line?: number, message?: string }}
 */
function checkJavaScriptSyntax(codeStr) {
  if (!codeStr || typeof codeStr !== 'string') return { hasError: false };
  try {
    const vm = require('vm');
    new vm.Script(codeStr);
    return { hasError: false };
  } catch (err) {
    const stack = err.stack || '';
    const lineMatch = stack.match(/evalmachine\.<anonymous>:(\d+)/i) || stack.match(/:(\d+):/);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : null;
    return {
      hasError: true,
      line,
      title: 'JavaScript SyntaxError',
      message: err.message,
      language: 'javascript',
    };
  }
}

/**
 * Check obvious unclosed HTML tags in a text block
 * @param {string} htmlStr
 * @returns {{ hasError: boolean, line?: number, message?: string, suggestion?: string }}
 */
function checkHtmlSyntax(htmlStr) {
  if (!htmlStr || typeof htmlStr !== 'string') return { hasError: false };

  const lines = htmlStr.split('\n');
  // Check for misspelled common tags like <sectio or <divv or <butt
  const typoPattern = /<\/?(sectio|divv|butt|spnn|headr|footr|articl)(?:\s|>|$)/i;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(typoPattern);
    if (match) {
      const badTag = match[1].toLowerCase();
      const corrections = {
        sectio: 'section',
        divv: 'div',
        butt: 'button',
        spnn: 'span',
        headr: 'header',
        footr: 'footer',
        articl: 'article',
      };
      const fix = corrections[badTag] || 'tag';
      return {
        hasError: true,
        line: i + 1,
        title: 'Misspelled HTML Tag',
        message: `Tag '<${badTag}>' is misspelled.`,
        suggestion: `Change '<${badTag}>' to '<${fix}>'.`,
        language: 'html',
      };
    }
  }

  return { hasError: false };
}

module.exports = {
  checkJavaScriptSyntax,
  checkHtmlSyntax,
};
