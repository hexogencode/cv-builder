// Merge Gemini's cv_updates into the current CV + compute missing required fields.
// Rule: objects (meta, personal) shallow-merge; arrays replace the whole section.

const OBJECT_SECTIONS = ['meta', 'personal'];
const ARRAY_SECTIONS = ['education', 'experience', 'projects', 'skills', 'languages'];

const isFilled = (v) => typeof v === 'string' && v.trim() !== '';

// Drop null/undefined/empty strings so Gemini "unknown" placeholders don't overwrite real values.
function cleanValue(v) {
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return cleanObject(item);
        return item;
      })
      .filter((item) => {
        if (item === null || item === undefined || item === '') return false;
        if (typeof item === 'object' && !Array.isArray(item)) return Object.keys(item).length > 0;
        return true;
      });
  }
  return v;
}

function cleanObject(obj) {
  const out = {};
  for (const [k, raw] of Object.entries(obj ?? {})) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string' && raw.trim() === '') continue;
    out[k] = cleanValue(raw);
  }
  return out;
}

export function mergeCv(cv, updates) {
  const base = cv && typeof cv === 'object' && !Array.isArray(cv) ? cv : {};
  const patch = updates && typeof updates === 'object' && !Array.isArray(updates) ? updates : {};
  const next = structuredClone(base);

  for (const key of OBJECT_SECTIONS) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      const cleaned = cleanObject(patch[key]);
      if (Object.keys(cleaned).length > 0) {
        next[key] = { ...(next[key] ?? {}), ...cleaned };
      }
    }
  }

  for (const key of ARRAY_SECTIONS) {
    if (Array.isArray(patch[key])) {
      next[key] = patch[key]
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map(cleanObject)
        .filter((item) => Object.keys(item).length > 0);
    }
  }

  return next;
}

// Keep in sync with "Required fields" in shared/api.md.
export function missingFields(cv) {
  const safe = cv && typeof cv === 'object' ? cv : {};
  const missing = [];
  if (!isFilled(safe.personal?.full_name)) missing.push('personal.full_name');
  if (!isFilled(safe.personal?.email)) missing.push('personal.email');
  if (!(safe.education?.length || safe.experience?.length)) missing.push('education|experience');
  if (!safe.skills?.some((s) => Array.isArray(s?.items) && s.items.some(isFilled))) {
    missing.push('skills');
  }
  return missing;
}