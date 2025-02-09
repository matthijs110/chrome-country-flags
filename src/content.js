// Source: https://github.com/talkjs/country-flag-emoji-polyfill
const replacementFontName = "Twemoji Country Flags";

// The id the element containing all overwritten font families.
const extentionStyleTagId = "country-flag-fixer-ext";

// Logging settings
const logsEnabled = true;
const logPrefix = "[FLAG-FIXER]";
let runCount = 0;

// Keeping track of the CSS files that have been requested to avoid duplicates
const requestedCssFiles = new Set();


// ---------------------------- Logging functions ---------------------------- //
const log = (message, subTaskCount=null, totalSubTasks=null, subPrefix='S') => {
  if (!logsEnabled)
    return;

  let msg = `${logPrefix} [R:${runCount}`;
  if (subTaskCount != null)
    msg += ` ${subPrefix}:${subTaskCount}`;
  if (totalSubTasks != null)
    msg += `/${totalSubTasks}`;
  msg += `] ${message}`;

  console.log(msg);
}

const logError = (message, error, subTaskCount=null, totalSubTasks=null, subPrefix='S') => {
  if (!logsEnabled)
    return;

  let msg = `${logPrefix} [R:${runCount}`;
  if (subTaskCount != null)
    msg += ` ${subPrefix}:${subTaskCount}`;
  if (totalSubTasks != null)
    msg += `/${totalSubTasks}`;
  msg += `] ${message}`;

  console.error(msg, error);
}


// ----------------------------- Main functions ----------------------------- //
const fetchCSSRulesFromUrl = async (styleHref) => {
  log(`Fetching CSS rules from: ${styleHref}`);

  const preloadLink = document.querySelector(`link[href="${styleHref}"]`);
  if (!preloadLink) {
      logError(`Preload link not found for URL: ${styleHref}`);
      return [];
  }

  try {
    const response = await fetch(styleHref);
    const cssText = await response.text();
    
    // Create a temporary style element
    const style = document.createElement(`style`);
    style.textContent = cssText;
    const id = Math.random().toString(36).substring(7);
    style.id = id;
    document.head.appendChild(style);
    
    // Get rules from the temporary stylesheet
    const rules = Array.from(style.sheet.cssRules);
    
    // Clean up
    document.head.removeChild(style);
    
    return rules;
  } catch (error) {
      logError(`Error fetching CSS:`, error);
      return [];
  }
}

const updateFontFamilyRules = async () =>
{
  let sheetCount = 0;

  for (const sheet of document.styleSheets) {
    const fontFamilyRules = [];
    log("Processing sheet", ++sheetCount, document.styleSheets.length);

    // Ignore the styles set by this extention.
    if (sheet.ownerNode.id == extentionStyleTagId) 
      continue;

    // Ignore any non-screen stylesheets.
    const sheetMediaBlacklist = ['print', 'speech', 'aural', 'braille', 'handheld', 'projection', 'tty'];
    if (sheetMediaBlacklist.includes(sheet.media.mediaText))
      continue;

    try {

      // 1. Retreive the CCS rules - either directly from the stylesheet or fetched from URL
      let cssRules = [];
      try {
        cssRules = sheet.cssRules;
      } catch (error) {
        if (!sheet.href || sheet.ownerNode.rel !== "stylesheet" || requestedCssFiles.has(sheet.href)) 
          continue;

        cssRules = await fetchCSSRulesFromUrl(sheet.href);
        requestedCssFiles.add(sheet.href);
        log(`✅ Fetched CSS! - ${cssRules.length} rules`, sheetCount, document.styleSheets.length);
      }
      
      // 2. Loop through every CSS selector in the stylesheet
      for (const rule of cssRules) {

        if (!rule.style || !rule.style?.fontFamily || !rule.selectorText) 
          continue;

        const selectorText = rule.selectorText;
        const fontFamily = rule.style.fontFamily;

        // The 'inherit' value cannot be combined with other fonts; ignore it.
        if (fontFamily == 'inherit')
          continue;

        // Already modified CSS selectors may be ignored.
        if (fontFamily.toLowerCase().includes(replacementFontName.toLowerCase()))
          continue;

        log(`Added rule for: ${selectorText}`, fontFamilyRules.length, subPrefix='F');
        fontFamilyRules.push({ selectorText, fontFamily });
      }

      // 3. Update the style tag with the new rules
      updateStyleTag(fontFamilyRules);

    } catch (error) {
      // Some stylesheets might not be accessible due to CORS restrictions; log the error and continue.
      logError(`Error retrieving font-family rules`, error, sheetCount, document.styleSheets.length);
    }
  }

  log(`💯 Finished looping through ${document.styleSheets.length} CSS rules`);
};

const createNewStyleTag = (fontFamilyRules, existingSheet = null) =>
{
  const style = document.createElement("style");
  style.setAttribute("type", "text/css");
  style.setAttribute("id", extentionStyleTagId);

  // Add old rules to new tag
  let oldRules = existingSheet ? Array.from(existingSheet.sheet.cssRules) ?? [] : [];
  oldRules.forEach((rule) => {
    style.textContent += rule.cssText + "\n";
  });

  // Ensure new rules 
  fontFamilyRules = fontFamilyRules.filter(rule => !oldRules.some(old => old.selectorText === rule.selectorText));

  fontFamilyRules.forEach((rule) => {
    // Set the Country Flags font as main property; set the original font(s) as 'fallback'
    style.textContent += `${rule.selectorText} { font-family: '${replacementFontName}', ${rule.fontFamily} !important; }\n`;
  });

  return style;
};

const updateStyleTag = (fontFamilyRules) =>
{
  const existingSheet = document.getElementById(extentionStyleTagId);

  const newStyleTag = createNewStyleTag(fontFamilyRules, existingSheet);

  log(`Updating style tag: ${newStyleTag.textContent.length} characters`);
  
  // Completely rewrite the overriden styles, if applicable.
  if (existingSheet) {
    existingSheet.parentNode.removeChild(existingSheet);
  }
  
  if (document.head == null) 
    return;

  document.head.appendChild(newStyleTag);
};

const preserveCustomFonts = (element) =>
{
  if (element == undefined)
    return;

  // Ignore elements without style attribute or any font-family property.
  const inlineStyle = element.getAttribute('style');
  if (!inlineStyle || !inlineStyle.includes('font-family'))
    return;

  // Font family regex matching the font (group 1) and the !important modifier (group 2).
  const fontFamilyRegex = /font-family\s*:\s*([^;]+?)(\s*!important)?\s*(;|$)/;
  const match = fontFamilyRegex.exec(inlineStyle);
    
  // Cancel if there is no match for any reason.
  if (!match)
    return;

  const hasIsImportant = match[2] && match[2].includes('!important');
  if (hasIsImportant)
    return;

  const currentFontFamily = match[1].trim();
  element.style.setProperty('font-family', currentFontFamily, 'important');
}

const lastStyleSheets = new Set(Array.from(document.styleSheets).map(sheet => sheet.href || sheet.ownerNode.textContent));
const styleSheetsChanged = (mutations) =>
{
  let stylesheetChanged = false;

  mutations.forEach(mutation =>
  {
    // Only focus on <link> and <style> elements.
    mutation.addedNodes.forEach(node =>
    {
      if (node.id === extentionStyleTagId)
        return;

      const isStylesheet = node.nodeName === 'LINK' && (node.rel === 'stylesheet' || node.as === 'style');
      const isStyleNode = node.nodeName === 'STYLE'
      if (!isStylesheet && !isStyleNode)
        return;

      const newStylesheetIdentifier = isStylesheet ? node.href : node.textContent;
      if (lastStyleSheets.has(newStylesheetIdentifier))
        return;

      stylesheetChanged = true;
      lastStyleSheets.add(newStylesheetIdentifier);
    });
  });

  return stylesheetChanged;
}


// Observe the document for dynamically added styles
const observer = new MutationObserver(async (mutations) => {
  if (styleSheetsChanged(mutations)) {
    log(`Running Country Flag Fixer`);
    await updateFontFamilyRules();
    runCount++;
  }

  // Preserve font families set using the style attribute on any HTML element.
  document.querySelectorAll('*').forEach(preserveCustomFonts);
});

// Observe the children of the document DOM-element and every newly added element
// This may be a <link> element in the head, or any <style> sheet in the document.
observer.observe(document, { childList: true, subtree: true });
