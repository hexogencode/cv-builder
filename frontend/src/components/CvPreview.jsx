// Renders the CV JSON. Pure presentation: no AI, no data changes.

const range = (start, end) => [start, end].filter(Boolean).join(' – ');

function Section({ title, children, show = true }) {
  if (!show) return null;
  return (
    <section className="cv-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Entry({ title, subtitle, meta, bullets }) {
  return (
    <div className="cv-entry">
      <div className="cv-entry-head">
        <div>
          <strong>{title}</strong>
          {subtitle && <span className="cv-sub"> · {subtitle}</span>}
        </div>
        {meta && <span className="cv-meta">{meta}</span>}
      </div>
      {bullets?.length > 0 && (
        <ul>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      )}
    </div>
  );
}

export default function CvPreview({ cv }) {
  const p = cv.personal ?? {};
  const isEmpty = !Object.keys(cv).length;

  if (isEmpty) {
    return (
      <div className="cv-paper empty">
        <p>Your CV will appear here as you answer.</p>
      </div>
    );
  }

  const contact = [p.email, p.phone, p.location].filter(Boolean);

  return (
    <article className="cv-paper" lang={cv.meta?.cv_language ?? 'en'}>
      <header className="cv-header">
        <h1>{p.full_name || 'Your Name'}</h1>
        {p.headline && <p className="cv-headline">{p.headline}</p>}
        {(contact.length > 0 || p.links?.length > 0) && (
          <p className="cv-contact">
            {contact.join(' · ')}
            {p.links?.map((l, i) => (
              <span key={i}>
                {(contact.length > 0 || i > 0) && ' · '}
                <a href={l.url}>{l.label}</a>
              </span>
            ))}
          </p>
        )}
      </header>

      <Section title="Profile" show={Boolean(p.summary)}>
        <p>{p.summary}</p>
      </Section>

      <Section title="Experience" show={cv.experience?.length > 0}>
        {cv.experience?.map((e, i) => (
          <Entry key={i} title={e.title} subtitle={[e.company, e.location].filter(Boolean).join(', ')}
            meta={range(e.start, e.end)} bullets={e.bullets} />
        ))}
      </Section>

      <Section title="Education" show={cv.education?.length > 0}>
        {cv.education?.map((e, i) => (
          <Entry key={i}
            title={[e.degree, e.field].filter(Boolean).join(' ') || e.institution}
            subtitle={[e.degree || e.field ? e.institution : null, e.location].filter(Boolean).join(', ')}
            meta={range(e.start, e.end)}
            bullets={[...(e.grade ? [`Grade: ${e.grade}`] : []), ...(e.details ?? [])]} />
        ))}
      </Section>

      <Section title="Projects" show={cv.projects?.length > 0}>
        {cv.projects?.map((pr, i) => (
          <Entry key={i} title={pr.link ? <a href={pr.link}>{pr.name}</a> : pr.name}
            subtitle={[pr.role, pr.tech?.join(', ')].filter(Boolean).join(' · ')} bullets={pr.bullets} />
        ))}
      </Section>

      <Section title="Skills" show={cv.skills?.length > 0}>
        <dl className="cv-skills">
          {cv.skills?.map((s, i) => (
            <div key={i}><dt>{s.category}</dt><dd>{s.items?.join(', ')}</dd></div>
          ))}
        </dl>
      </Section>

      <Section title="Languages" show={cv.languages?.length > 0}>
        <p>{cv.languages?.map((l) => [l.language, l.level].filter(Boolean).join(' (') + (l.level ? ')' : '')).join(' · ')}</p>
      </Section>
    </article>
  );
}
