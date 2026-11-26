// Response schema Gemini must follow on every /api/turn call.
// Mirrors shared/cv.schema.json; keep the two in sync.
import { Type } from '@google/genai';

const str = (description) => ({ type: Type.STRING, ...(description && { description }) });
const strArr = (description) => ({ type: Type.ARRAY, items: { type: Type.STRING }, ...(description && { description }) });
const arrOf = (properties, required = [], description) => ({
  type: Type.ARRAY,
  ...(description && { description }),
  items: { type: Type.OBJECT, properties, required },
});

const cvUpdates = {
  type: Type.OBJECT,
  description:
    'ONLY the sections that changed this turn. Return {} if nothing in the CV changed (e.g. review-only or greeting). ' +
    'Objects (meta, personal) may be partial. ' +
    'Arrays (education, experience, projects, skills, languages) must be the COMPLETE new array for that section.',
  properties: {
    meta: {
      type: Type.OBJECT,
      properties: {
        target_role: str(),
        cv_language: { type: Type.STRING, enum: ['en', 'de'] },
      },
    },
    personal: {
      type: Type.OBJECT,
      properties: {
        full_name: str(),
        headline: str('Short one-liner under the name, e.g. "Organic Chemistry BSc Student at JKU Linz". Fill early once known.'),
        email: str(),
        phone: str(),
        location: str('City and country, e.g. "Linz, Austria". Fill early once inferable.'),
        links: arrOf({ label: str(), url: str() }, ['label', 'url']),
        summary: str('2-3 sentence profile written once enough CV content exists.'),
      },
    },
    education: arrOf(
      {
        institution: str(),
        degree: str(),
        field: str(),
        location: str(),
        start: str(),
        end: str(),
        grade: str(),
        details: strArr(),
      },
      ['institution'],
      'Schools and universities. Add immediately when mentioned even if start/end dates are not known yet.',
    ),
    experience: arrOf(
      {
        title: str(),
        company: str(),
        location: str(),
        start: str(),
        end: str(),
        bullets: strArr(),
      },
      ['title', 'company'],
      'Jobs, internships, or assistantships. Add immediately when mentioned even if details are partial.',
    ),
    projects: arrOf(
      {
        name: str(),
        role: str(),
        link: str(),
        tech: strArr(),
        bullets: strArr(),
      },
      ['name'],
    ),
    skills: arrOf(
      { category: str(), items: strArr() },
      ['category', 'items'],
      'Concrete tools, languages, lab methods, or frameworks. Never put a university major/degree here alone.',
    ),
    languages: arrOf(
      { language: str(), level: str('CEFR A1-C2 or native') },
      ['language'],
    ),
  },
};

export const turnResponseSchema = {
  type: Type.OBJECT,
  properties: {
    cv_updates: cvUpdates,
    reply: str(
      'Message shown to the user: short acknowledgement + one next question during interview, ' +
      'up to 3 numbered hints for a review, or a brief summary of what changed during refinement.',
    ),
    ready: {
      type: Type.BOOLEAN,
      description:
        'True if required fields are filled AND the CV content is solid. ' +
        'Keep true on refinement/review turns once complete unless a required field became empty.',
    },
  },
  required: ['cv_updates', 'reply', 'ready'],
  propertyOrdering: ['cv_updates', 'reply', 'ready'],
};