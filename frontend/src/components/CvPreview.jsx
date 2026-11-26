// Renders the CV JSON. Pure presentation: no AI. In edit mode, text can be fixed by hand
// (click → type → click away); the change goes back up via onChange(newCv).
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_ORDER, designStyle } from './DesignBar.jsx';

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

const TITLES = {
  en: { profile: 'Profile', experience: 'Experience', education: 'Education', projects: 'Projects', skills: 'Skills', languages: 'Languages', grade: 'Grade' },
  de: { profile: 'Profil', experience: 'Berufserfahrung', education: 'Ausbildung', projects: 'Projekte', skills: 'Kenntnisse', languages: 'Sprachen', grade: 'Note' },
};

// A CV section. In edit mode it can be dragged (by the ⠿ handle) or moved with ↑/↓.
function Section({ id, title, children, show = true, flash, edit, dnd, onMove }) {
  const [armed, setArmed] = useState(false);
  if (!show) return null;
  const cls = ['cv-section', flash && 'flash', edit && 'is-editing', dnd.over === id && dnd.dragging !== id && 'drop-target',
    dnd.dragging === id && 'dragging'].filter(Boolean).join(' ');
  return (
    <section className={cls}
      draggable={edit && armed}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); dnd.set({ dragging: id, over: null }); }}
      onDragEnd={() => { setArmed(false); dnd.set({ dragging: null, over: null }); }}
      onDragOver={(e) => { if (dnd.dragging) { e.preventDefault(); if (dnd.over !== id) dnd.set({ dragging: dnd.dragging, over: id }); } }}
      onDrop={(e) => { e.preventDefault(); onMove(e.dataTransfer.getData('text/plain'), id); dnd.set({ dragging: null, over: null }); }}>
      <h2>
        {edit && (
          <span className="sec-tools">
            <span className="handle" title="Drag to move section" onMouseDown={() => setArmed(true)} onMouseUp={() => setArmed(false)}>⠿</span>
            <button className="mini" onClick={() => onMove(id, -1)} title="Move section up">↑</button>
            <button className="mini" onClick={() => onMove(id, +1)} title="Move section down">↓</button>
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Entry({ title, subtitle, meta, bullets, i = 0, tools }) {
  return (
    <div className="cv-entry" style={{ '--i': i }}>
      {tools}
      <div className="cv-entry-head">
        <div>
          <strong>{title}</strong>
          {subtitle?.length > 0 && <span className="cv-sub"> · {subtitle}</span>}
        </div>
        {meta?.length > 0 && <span className="cv-meta">{meta}</span>}
      </div>
      {bullets}
    </div>
  );
}

const join = (parts, sep) =>
  parts.filter(Boolean).reduce((acc, p, i) => (i ? [...acc, sep, p] : [p]), []);

export default function CvPreview({ cv, photo, edit = false, onChange, design, onDesign }) {
  const p = cv.personal ?? {};
  const isEmpty = !Object.keys(cv).length;
  const { keys, tick, prev } = useChangedSections(cv);
  const kk = (k) => (keys.has(k) ? `${k}-${tick}` : k);
  const [dndState, setDnd] = useState({ dragging: null, over: null });
  const dnd = { ...dndState, set: setDnd };
  const lang = cv.meta?.cv_language === 'de' ? 'de' : 'en';
  const T = TITLES[lang];

  // Every manual change goes through here. Marked as "already seen" so it doesn't flash like a Gemini change.
  function commit(next) {
    prev.current = next;
    onChange?.(next);
  }

  function onEdit(path, value) {
    const [section, idx, field] = path;
    if (field === 'bullets' || field === 'details') {
      // Emptying a bullet deletes it.
      const list = [...(cv[section][idx][field] ?? [])];
      if (value) list[path[3]] = value; else list.splice(path[3], 1);
      commit(setIn(cv, [section, idx, field], list));
    } else if (section === 'skills' && field === 'items') {
      commit(setIn(cv, path, value.split(',').map((x) => x.trim()).filter(Boolean)));
    } else {
      commit(setIn(cv, path, value));
    }
  }

  function moveEntry(section, i, dir) {
    const list = [...cv[section]];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit({ ...cv, [section]: list });
  }

  function deleteEntry(section, i) {
    commit({ ...cv, [section]: cv[section].filter((_, k) => k !== i) });
  }

  // Section order lives in the design (frontend-only). dir = ±1, or the id of the section dropped onto.
  const order = [...new Set([...(design?.order ?? []), ...DEFAULT_ORDER])].filter((k) => DEFAULT_ORDER.includes(k));
  function moveSection(id, target) {
    const list = order.filter((k) => k !== id);
    let at;
    if (typeof target === 'number') {
      const visible = order.filter((k) => shown[k]);
      const vi = visible.indexOf(id) + target;
      if (vi < 0 || vi >= visible.length) return;
      at = list.indexOf(visible[vi]) + (target > 0 ? 1 : 0);
    } else {
      if (!target || target === id) return;
      at = list.indexOf(target) + (order.indexOf(id) < order.indexOf(target) ? 1 : 0);
    }
    list.splice(at, 0, id);
    onDesign?.({ order: list });
  }

  const ed = { edit, onEdit };
  const tools = (section, i, count) => edit && (
    <span className="entry-tools">
      <button className="mini" onClick={() => moveEntry(section, i, -1)} disabled={i === 0} title="Move up">↑</button>
      <button className="mini" onClick={() => moveEntry(section, i, +1)} disabled={i === count - 1} title="Move down">↓</button>
      <button className="mini danger" onClick={() => deleteEntry(section, i)} title="Remove entry">✕</button>
    </span>
  );
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

  const shown = {
    profile: Boolean(p.summary),
    experience: cv.experience?.length > 0,
    education: cv.education?.length > 0,
    projects: cv.projects?.length > 0,
    skills: cv.skills?.length > 0,
    languages: cv.languages?.length > 0,
  };

  const bodies = {
    profile: () => <p><E path={['personal', 'summary']} value={p.summary} multiline {...ed} /></p>,

    experience: () => cv.experience.map((e, i) => (
      <Entry key={i} i={i} tools={tools('experience', i, cv.experience.length)}
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
    )),

    education: () => cv.education.map((e, i) => (
      <Entry key={i} i={i} tools={tools('education', i, cv.education.length)}
        title={e.degree || e.field
          ? join([
            e.degree && <E key="d" path={['education', i, 'degree']} value={e.degree} {...ed} />,
            e.field && <E key="f" path={['education', i, 'field']} value={e.field} {...ed} />,
          ], ' ')
          : <E path={['education', i, 'institution']} value={e.institution} {...ed} />}
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
            {e.grade && <li>{T.grade}: <E path={['education', i, 'grade']} value={e.grade} {...ed} /></li>}
            {e.details?.map((d, j) => (
              <li key={j}><E path={['education', i, 'details', j]} value={d} multiline {...ed} /></li>
            ))}
          </ul>
        )} />
    )),

    projects: () => cv.projects.map((pr, i) => {
      const name = <E path={['projects', i, 'name']} value={pr.name} {...ed} />;
      return (
        <Entry key={i} i={i} tools={tools('projects', i, cv.projects.length)}
          title={pr.link && !edit ? <a href={pr.link}>{name}</a> : name}
          subtitle={join([
            pr.role && <E key="r" path={['projects', i, 'role']} value={pr.role} {...ed} />,
            pr.tech?.join(', '),
          ], ' · ')}
          bullets={bulletList('projects', i, 'bullets', pr.bullets)} />
      );
    }),

    skills: () => (
      <dl className="cv-skills">
        {cv.skills.map((sk, i) => (
          <div key={i} className="skill-row">
            {tools('skills', i, cv.skills.length)}
            <dt><E path={['skills', i, 'category']} value={sk.category} {...ed} /></dt>
            <dd><E path={['skills', i, 'items']} value={sk.items?.join(', ')} {...ed} /></dd>
          </div>
        ))}
      </dl>
    ),

    languages: () => (
      <p>
        {join(cv.languages.map((l, i) => (
          <span key={i} className="lang-item">
            <E path={['languages', i, 'language']} value={l.language} {...ed} />
            {(l.level || edit) && <> (<E path={['languages', i, 'level']} value={l.level} placeholder="level" {...ed} />)</>}
            {edit && <button className="mini danger" onClick={() => deleteEntry('languages', i)} title="Remove language">✕</button>}
          </span>
        )), ' · ')}
      </p>
    ),
  };

  // Which CV key each section's "Gemini changed this" flash listens to.
  const flashKey = { profile: 'personal' };

  return (
    <article className={edit ? 'cv-paper editing' : 'cv-paper'} lang={lang} style={design ? designStyle(design) : undefined}>
      <header className={[photo && 'has-photo', photo && design?.photoSide === 'left' && 'photo-left',
        keys.has('personal') && 'cv-section flash', 'cv-header'].filter(Boolean).join(' ')}
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

      {order.map((id) => {
        const fk = flashKey[id] ?? id;
        return (
          <Section key={`${id}-${kk(fk)}`} id={id} title={T[id]} show={shown[id]} flash={keys.has(fk)}
            edit={edit} dnd={dnd} onMove={moveSection}>
            {shown[id] && bodies[id]()}
          </Section>
        );
      })}
    </article>
  );
}
