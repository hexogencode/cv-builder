// Renders the CV JSON. Pure presentation: no AI. In edit mode, text can be fixed by hand
// (click → type → click away); the change goes back up via onChange(newCv).
import { useEffect, useRef, useState } from 'react';

const SECTION_KEYS = ['personal', 'experience', 'education', 'projects', 'skills', 'languages'];

// Which top-level sections changed since the last render → they get a highlight flash.
function useChangedSections(cv) {
  const prev = useRef({});
  const [changed, setChanged] = useState({ keys: new Set(), tick: 0 });
  useEffect(() => {
    const keys = new Set(
      SECTION_KEYS.filter((k) => JSON.stringify(cv[k]) !== JSON.stringify(prev.current[k])),
    );
    prev.current = cv;
    if (keys.size) setChanged((c) => ({ keys, tick: c.tick + 1 }));
  }, [cv]);
  return { ...changed, prev };
}

// Immutable set at a path like ['experience', 0, 'bullets', 2].
function setIn(obj, [key, ...rest], value) {
  const base = obj ?? (typeof key === 'number' ? [] : {});
  const copy = Array.isArray(base) ? [...base] : { ...base };
  copy[key] = rest.length ? setIn(base[key], rest, value) : value;
  return copy;
}

// Inline editable text. Outside edit mode it's a plain span.
function E({ path, value, edit, onEdit, placeholder = '…', multiline = false }) {
  if (!edit) return value ? <>{value}</> : null;
  return (
    <span
      className="editable"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.currentTarget.textContent = value ?? ''; e.currentTarget.blur(); }
      }}
      onBlur={(e) => {
        const text = e.currentTarget.textContent.replace(/\s+/g, ' ').trim();
        if (text !== (value ?? '')) onEdit(path, text);
      }}
    >
      {value ?? ''}
    </span>
  );
}

function Section({ title, children, show = true, flash }) {
  if (!show) return null;
  return (
    <section className={flash ? 'cv-section flash' : 'cv-section'}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Entry({ title, subtitle, meta, bullets, i = 0 }) {
  return (
    <div className="cv-entry" style={{ '--i': i }}>
      <div className="cv-entry-head">
        <div>
          <strong>{title}</strong>
          {subtitle && <span className="cv-sub"> · {subtitle}</span>}
        </div>
        {meta && <span className="cv-meta">{meta}</span>}
      </div>
      {bullets}
    </div>
  );
}

const join = (parts, sep) =>
  parts.filter(Boolean).reduce((acc, p, i) => (i ? [...acc, sep, p] : [p]), []);

export default function CvPreview({ cv, photo, edit = false, onChange }) {
  const p = cv.personal ?? {};
  const isEmpty = !Object.keys(cv).length;
  const { keys, tick, prev } = useChangedSections(cv);
  const kk = (k) => (keys.has(k) ? `${k}-${tick}` : k);

  // Manual edits shouldn't trigger the "Gemini changed this" flash: mark them as already seen.
  function onEdit(path, value) {
    let next;
    const [section, idx, field] = path;
    if (field === 'bullets' || field === 'details') {
      // Emptying a bullet deletes it.
      const list = [...(cv[section][idx][field] ?? [])];
      if (value) list[path[3]] = value; else list.splice(path[3], 1);
      next = setIn(cv, [section, idx, field], list);
    } else if (section === 'skills' && field === 'items') {
      next = setIn(cv, path, value.split(',').map((s) => s.trim()).filter(Boolean));
    } else {
      next = setIn(cv, path, value);
    }
    prev.current = next;
    onChange?.(next);
  }

  const ed = { edit, onEdit };
  const bulletList = (section, i, field, items) =>
    items?.length > 0 && (
      <ul>
        {items.map((b, j) => (
          <li key={j}><E path={[section, i, field, j]} value={b} multiline {...ed} /></li>
        ))}
      </ul>
    );

  if (isEmpty) {
    return (
      <div className="cv-paper empty">
        <div className="skeleton"><div /><div /><div /><div /></div>
        <p>Your CV will appear here as you answer.</p>
      </div>
    );
  }

  const contact = [
    p.email && <E key="email" path={['personal', 'email']} value={p.email} {...ed} />,
    p.phone && <E key="phone" path={['personal', 'phone']} value={p.phone} {...ed} />,
    p.location && <E key="loc" path={['personal', 'location']} value={p.location} {...ed} />,
    ...(p.links ?? []).map((l, i) => <a key={`l${i}`} href={l.url}>{l.label}</a>),
  ].filter(Boolean);

  return (
    <article className={edit ? 'cv-paper editing' : 'cv-paper'} lang={cv.meta?.cv_language ?? 'en'}>
      <header className={[photo && 'has-photo', keys.has('personal') && 'cv-section flash', 'cv-header'].filter(Boolean).join(' ')}
        key={kk('personal')}>
        <div className="cv-header-text">
          <h1><E path={['personal', 'full_name']} value={p.full_name || (edit ? '' : 'Your Name')} placeholder="Your Name" {...ed} /></h1>
          {(p.headline || edit) && (
            <p className="cv-headline"><E path={['personal', 'headline']} value={p.headline} placeholder="Headline" {...ed} /></p>
          )}
          {contact.length > 0 && <p className="cv-contact">{join(contact, ' · ')}</p>}
        </div>
        {photo && <img className="cv-photo" src={photo} alt="" />}
      </header>

      <Section title="Profile" show={Boolean(p.summary)} key={'profile-' + kk('personal')} flash={keys.has('personal')}>
        <p><E path={['personal', 'summary']} value={p.summary} multiline {...ed} /></p>
      </Section>

      <Section title="Experience" show={cv.experience?.length > 0} key={kk('experience')} flash={keys.has('experience')}>
        {cv.experience?.map((e, i) => (
          <Entry key={i} i={i}
            title={<E path={['experience', i, 'title']} value={e.title} {...ed} />}
            subtitle={join([
              e.company && <E key="c" path={['experience', i, 'company']} value={e.company} {...ed} />,
              e.location && <E key="l" path={['experience', i, 'location']} value={e.location} {...ed} />,
            ], ', ')}
            meta={join([
              e.start && <E key="s" path={['experience', i, 'start']} value={e.start} {...ed} />,
              e.end && <E key="e" path={['experience', i, 'end']} value={e.end} {...ed} />,
            ], ' – ')}
            bullets={bulletList('experience', i, 'bullets', e.bullets)} />
        ))}
      </Section>

      <Section title="Education" show={cv.education?.length > 0} key={kk('education')} flash={keys.has('education')}>
        {cv.education?.map((e, i) => (
          <Entry key={i} i={i}
            title={join([
              e.degree && <E key="d" path={['education', i, 'degree']} value={e.degree} {...ed} />,
              e.field && <E key="f" path={['education', i, 'field']} value={e.field} {...ed} />,
            ], ' ').concat(e.degree || e.field ? [] : [<E key="in" path={['education', i, 'institution']} value={e.institution} {...ed} />])}
            subtitle={join([
              (e.degree || e.field) && <E key="in" path={['education', i, 'institution']} value={e.institution} {...ed} />,
              e.location && <E key="l" path={['education', i, 'location']} value={e.location} {...ed} />,
            ], ', ')}
            meta={join([
              e.start && <E key="s" path={['education', i, 'start']} value={e.start} {...ed} />,
              e.end && <E key="e" path={['education', i, 'end']} value={e.end} {...ed} />,
            ], ' – ')}
            bullets={(e.grade || e.details?.length > 0) && (
              <ul>
                {e.grade && <li>Grade: <E path={['education', i, 'grade']} value={e.grade} {...ed} /></li>}
                {e.details?.map((d, j) => (
                  <li key={j}><E path={['education', i, 'details', j]} value={d} multiline {...ed} /></li>
                ))}
              </ul>
            )} />
        ))}
      </Section>

      <Section title="Projects" show={cv.projects?.length > 0} key={kk('projects')} flash={keys.has('projects')}>
        {cv.projects?.map((pr, i) => {
          const name = <E path={['projects', i, 'name']} value={pr.name} {...ed} />;
          return (
            <Entry key={i} i={i}
              title={pr.link && !edit ? <a href={pr.link}>{name}</a> : name}
              subtitle={join([
                pr.role && <E key="r" path={['projects', i, 'role']} value={pr.role} {...ed} />,
                pr.tech?.join(', '),
              ], ' · ')}
              bullets={bulletList('projects', i, 'bullets', pr.bullets)} />
          );
        })}
      </Section>

      <Section title="Skills" show={cv.skills?.length > 0} key={kk('skills')} flash={keys.has('skills')}>
        <dl className="cv-skills">
          {cv.skills?.map((s, i) => (
            <div key={i}>
              <dt><E path={['skills', i, 'category']} value={s.category} {...ed} /></dt>
              <dd><E path={['skills', i, 'items']} value={s.items?.join(', ')} {...ed} /></dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Languages" show={cv.languages?.length > 0} key={kk('languages')} flash={keys.has('languages')}>
        <p>
          {join(cv.languages?.map((l, i) => (
            <span key={i}>
              <E path={['languages', i, 'language']} value={l.language} {...ed} />
              {(l.level || edit) && <> (<E path={['languages', i, 'level']} value={l.level} placeholder="level" {...ed} />)</>}
            </span>
          )) ?? [], ' · ')}
        </p>
      </Section>
    </article>
  );
}
