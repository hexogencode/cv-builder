import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCv, missingFields } from '../src/merge.js';

test('personal is shallow-merged, empty strings ignored', () => {
  const cv = { personal: { full_name: 'Alex', email: 'a@x.com' } };
  const out = mergeCv(cv, { personal: { phone: '123', email: '' } });
  assert.deepEqual(out.personal, { full_name: 'Alex', email: 'a@x.com', phone: '123' });
});

test('arrays are replaced whole', () => {
  const cv = { skills: [{ category: 'A', items: ['x'] }] };
  const out = mergeCv(cv, { skills: [{ category: 'B', items: ['y'] }] });
  assert.deepEqual(out.skills, [{ category: 'B', items: ['y'] }]);
});

test('untouched sections survive, input not mutated', () => {
  const cv = { education: [{ institution: 'JKU' }] };
  const out = mergeCv(cv, { personal: { full_name: 'Alex' } });
  assert.deepEqual(out.education, [{ institution: 'JKU' }]);
  assert.equal(cv.personal, undefined);
});

test('empty updates or empty section objects do not mutate CV (review turn)', () => {
  const cv = { personal: { full_name: 'Alex', email: 'a@x.com' }, education: [{ institution: 'JKU' }] };
  assert.deepEqual(mergeCv(cv, {}), cv);
  assert.deepEqual(mergeCv(cv, { personal: {}, meta: {} }), cv);
  assert.deepEqual(mergeCv(cv, null), cv);
});

test('manual edits survive unrelated section updates', () => {
  const cv = {
    personal: { full_name: 'Manually Edited Name', email: 'a@x.com' },
    projects: [{ name: 'Old', bullets: ['did stuff'] }],
  };
  const out = mergeCv(cv, { projects: [{ name: 'Old', bullets: ['Built X with Node.js'] }] });
  assert.equal(out.personal.full_name, 'Manually Edited Name');
  assert.deepEqual(out.projects[0].bullets, ['Built X with Node.js']);
});

test('explicit empty array clears section when requested', () => {
  const cv = { projects: [{ name: 'Old' }] };
  const out = mergeCv(cv, { projects: [] });
  assert.deepEqual(out.projects, []);
});

test('missingFields', () => {
  assert.deepEqual(missingFields({}), ['personal.full_name', 'personal.email', 'education|experience', 'skills']);
  assert.deepEqual(
    missingFields({
      personal: { full_name: 'A', email: 'a@x.com' },
      experience: [{ title: 't', company: 'c' }],
      skills: [{ category: 'c', items: ['   '] }],
    }),
    ['skills'],
  );
  assert.deepEqual(
    missingFields({
      personal: { full_name: 'A', email: 'a@x.com' },
      experience: [{ title: 't', company: 'c' }],
      skills: [{ category: 'c', items: ['x'] }],
    }),
    [],
  );
});