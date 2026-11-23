/**
 * LoomLead Chrome Extension - Active Page Metadata Extractor
 * Strictly client-side: executes only when the user opens the popup.
 * No background scraping.
 */
(() => {
  const pageUrl = window.location.href;
  const pageTitle = document.title || '';
  const domain = window.location.hostname.replace(/^www\./, '');

  let extractedName = '';
  let extractedCompany = '';
  let extractedCategory = '';
  let extractedPhone = '';
  let extractedEmail = '';
  let extractedNotes = '';
  let sourceContext = domain;

  // 1. Check if viewing a LinkedIn Profile or Company
  if (domain.includes('linkedin.com')) {
    sourceContext = 'LinkedIn';

    // Person profile name
    const nameEl = document.querySelector('h1.text-heading-xlarge, h1.inline.t-24, h1.top-card-layout__title');
    if (nameEl) {
      extractedName = nameEl.innerText.trim();
    }

    // Headline / Current role
    const headlineEl = document.querySelector('.text-body-medium.break-words, .top-card-layout__headline');
    if (headlineEl) {
      const headline = headlineEl.innerText.trim();
      extractedNotes = `LinkedIn Headline: ${headline}`;

      // Often format is: Role at Company
      if (headline.includes(' at ')) {
        const parts = headline.split(' at ');
        extractedCompany = parts[1].split(/[|,\-]/)[0].trim();
      }
    }

    // Company page name
    if (!extractedName) {
      const companyEl = document.querySelector('.org-top-card-summary__title, h1[title]');
      if (companyEl) {
        extractedName = companyEl.innerText.trim();
        extractedCompany = extractedName;
      }
    }
  }

  // 2. Check if viewing Google Maps or Google Business listing
  else if (domain.includes('google.com') && (pageUrl.includes('/maps/') || pageUrl.includes('search'))) {
    sourceContext = 'Google';
    const mapsTitle = document.querySelector('h1.DUwDvf, .fontHeadlineLarge');
    if (mapsTitle) {
      extractedName = mapsTitle.innerText.trim();
      extractedCompany = extractedName;
    }
    const categoryEl = document.querySelector('button.DkEaL, .fontBodyMedium');
    if (categoryEl) {
      extractedCategory = categoryEl.innerText.trim();
    }
  }

  // 3. Generic Website extraction
  else {
    // If name not set, fallback to main heading or title
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.length < 80) {
      extractedName = h1.innerText.trim();
    } else {
      extractedName = pageTitle.split(/[-–|]/)[0].trim();
    }
    extractedCompany = pageTitle.split(/[-–|]/)[0].trim();
  }

  // 4. Scan visible text for Phone Number and Email patterns
  try {
    const bodyText = document.body.innerText || '';

    // Detect Email pattern
    const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !emailMatch[0].includes('example.com') && !emailMatch[0].includes('sentry.io')) {
      extractedEmail = emailMatch[0];
    }

    // Detect Phone pattern (Indian +91 or general format)
    const phoneMatch = bodyText.match(/(?:\+91[\s\-]?)?[6-9]\d{4}[\s\-]?\d{5}|\+?[1-9]\d{1,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}/);
    if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10) {
      extractedPhone = phoneMatch[0].trim();
    }

    // Meta description for context
    const metaDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc && metaDesc.content) {
      extractedNotes = extractedNotes ? `${extractedNotes}\n${metaDesc.content}` : metaDesc.content;
    }
  } catch (e) {
    // Graceful fallback
  }

  return {
    url: pageUrl,
    domain,
    title: pageTitle,
    source: sourceContext,
    name: extractedName,
    company: extractedCompany || extractedName,
    category: extractedCategory,
    phone: extractedPhone,
    email: extractedEmail,
    notes: extractedNotes ? extractedNotes.substring(0, 300) : ''
  };
})();
