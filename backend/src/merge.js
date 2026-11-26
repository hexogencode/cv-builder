// Merge Gemini's cv_updates into the current CV + compute missing required fields.
// Rule: objects (meta, personal) shallow-merge; arrays replace the whole section.

const OBJECT_SECTIONS = ['meta', 'personal'];
const ARRAY_SECTIONS = ['education', 'experience', 'projects', 'skills', 'languages'];

const isFilled = (v) => typeof v === 'string' && v.trim() !== '';

// Drop empty strings Gemini sometimes sends for "unknown", so they don't overwrite real values.
function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  );
}

export function mergeCv(cv = {}, updates = {}) {
  const next = structuredClone(cv);
  for (const key of OBJECT_SECTIONS) {
    if (updates[key] && typeof updates[key] === 'object') {
      next[key] = { ...(next[key] ?? {}), ...cleanObject(updates[key]) };
    }
  }
  for (const key of ARRAY_SECTIONS) {
    if (Array.isArray(updates[key])) next[key] = updates[key].map(cleanObject);
  }
  return next;
}

// Keep in sync with "Required fields" in shared/api.md.
export function missingFields(cv = {}) {
  const missing = [];
  if (!isFilled(cv.personal?.full_name)) missing.push('personal.full_name');
  if (!isFilled(cv.personal?.email)) missing.push('personal.email');
  if (!(cv.education?.length || cv.experience?.length)) missing.push('education|experience');
  if (!cv.skills?.some((s) => s.items?.length)) missing.push('skills');
  return missing;
}
