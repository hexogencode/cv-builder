// Response schema Gemini must follow on every /api/turn call.
// Mirrors shared/cv.schema.json; keep the two in sync.
import { Type } from '@google/genai';

const str = (description) => ({ type: Type.STRING, ...(description && { description }) });
const strArr = (description) => ({ type: Type.ARRAY, items: { type: Type.STRING }, ...(description && { description }) });
const arrOf = (properties, required = []) => ({
  type: Type.ARRAY,
  items: { type: Type.OBJECT, properties, required },
});

const cvUpdates = {
  type: Type.OBJECT,
  description:
    'ONLY the sections that changed this turn. Objects (meta, personal) may be partial. ' +
    'Arrays (education, experience, projects, skills, languages) must be the COMPLETE new array for that section.',
  properties: {
    meta: {
      type: Type.OBJECT,
      properties: { target_role: str(), cv_language: { type: Type.STRING, enum: ['en', 'de'] } },
    },
    personal: {
      type: Type.OBJECT,
      properties: {
        full_name: str(),
        headline: str(),
        email: str(),
        phone: str(),
        location: str(),
        links: arrOf({ label: str(), url: str() }, ['label', 'url']),
        summary: str(),
      },
    },
    education: arrOf(
      {
        institution: str(), degree: str(), field: str(), location: str(),
        start: str(), end: str(), grade: str(), details: strArr(),
      },
      ['institution'],
    ),
    experience: arrOf(
      { title: str(), company: str(), location: str(), start: str(), end: str(), bullets: strArr() },
      ['title', 'company'],
    ),
    projects: arrOf(
      { name: str(), role: str(), link: str(), tech: strArr(), bullets: strArr() },
      ['name'],
    ),
    skills: arrOf({ category: str(), items: strArr() }, ['category', 'items']),
    languages: arrOf({ language: str(), level: str('CEFR A1-C2 or native') }, ['language']),
  },
};

export const turnResponseSchema = {
  type: Type.OBJECT,
  properties: {
    cv_updates: cvUpdates,
    reply: str('Message shown to the user. Short acknowledgement + exactly one next question (or a wrap-up if ready).'),
    ready: { type: Type.BOOLEAN, description: 'True only if required fields are filled AND the CV content is solid.' },
  },
  required: ['cv_updates', 'reply', 'ready'],
  propertyOrdering: ['cv_updates', 'reply', 'ready'],
};
