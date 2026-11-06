export const sectors = ['Academic & Research', 'Professional & Corporate', 'Entrepreneurship & Startups', 'Social Impact & Community', 'Personal Milestones'];
export function institutionalEmail(email) { return /^[^\s@]+@(?:[a-z0-9-]+\.)*du\.ac\.bd$/i.test(email.trim()); }
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function validateStory(s) {
  if (s.headline.trim().length < 10 || s.headline.trim().length > 120) return 'Use a headline between 10 and 120 characters.';
  if (s.summary.trim().length < 30 || s.summary.trim().length > 600) return 'Use a summary between 30 and 600 characters.';
  if (s.narrative.trim().length < 80 || s.narrative.length > 20000) return 'Tell your story in 80–20,000 characters.';
  if (!sectors.includes(s.sector)) return 'Choose an achievement sector.';
  if (!s.achievement_date || s.achievement_date > new Date().toISOString().slice(0,10)) return 'Choose an achievement date up to today.';
  if (s.evidence_url && !safeUrl(s.evidence_url)) return 'Use an http or https evidence link.';
  return null;
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
