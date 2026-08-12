import { useLanguage } from '../i18n/useLanguage'
import { SONG_SOURCES } from '../utils/songSources'

export function SongSources() {
  const { t } = useLanguage()

  return (
    <section className="landing-sources">
      <h2 className="landing-section-heading">{t.sources.heading}</h2>
      <p className="landing-section-intro">{t.sources.intro}</p>

      <ul className="source-list">
        {SONG_SOURCES.map((source) => {
          const item = t.sources.items[source.id]
          return (
            <li key={source.id}>
              <a
                className="source-card"
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="source-card-head">
                  <span className="source-card-name">{item.name}</span>
                  <span className="source-card-tag">{t.sources.categories[source.category]}</span>
                </span>
                <span className="source-card-desc">{item.desc}</span>
                <span className="source-card-host">{new URL(source.url).host.replace(/^www\./, '')} ↗</span>
              </a>
            </li>
          )
        })}
      </ul>

      <p className="source-note">{t.sources.note}</p>
    </section>
  )
}
