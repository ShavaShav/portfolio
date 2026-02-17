import { getPlanetById } from "../data/planets";
import { getPlanetContent } from "../data/planetContent";
import "./PlanetDetail.css";

type PlanetDetailProps = {
  planetId: string;
  onStartMission?: () => void;
};

export function PlanetDetail({ planetId, onStartMission }: PlanetDetailProps) {
  const planet = getPlanetById(planetId);
  const content = getPlanetContent(planetId);

  if (!planet || !content) {
    return (
      <section className="planet-detail">
        <header className="planet-detail__header">
          <h2>Unknown Planet</h2>
        </header>
        <p>Content not found for planet id: {planetId}</p>
      </section>
    );
  }

  return (
    <section className="planet-detail">
      <header className="planet-detail__header">
        <h2>{content.title}</h2>
        <p className="planet-detail__meta">
          {content.role} - {content.period}
        </p>
        {content.location ? (
          <p className="planet-detail__location">{content.location}</p>
        ) : null}
      </header>

      <p className="planet-detail__summary">{content.summary}</p>

      <div className="planet-detail__block">
        <h3>Key Achievements</h3>
        <ul>
          {content.achievements.map((achievement) => (
            <li key={achievement}>{achievement}</li>
          ))}
        </ul>
      </div>

      <div className="planet-detail__block">
        <h3>Tech Stack</h3>
        <div className="planet-detail__chips">
          {content.tech.map((item) => (
            <span className="planet-detail__chip" key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {content.links ? (
        <div className="planet-detail__block">
          <h3>Links</h3>
          <div className="planet-detail__links">
            {content.links.map((link) => (
              <a
                href={link.href}
                key={link.href}
                rel="noreferrer"
                target="_blank"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {content.extra ? (
        <div className="planet-detail__block">
          <h3>Project Grid</h3>
          {content.extra}
        </div>
      ) : null}

      {planet.hasMission && onStartMission ? (
        <button
          className="planet-detail__mission-btn"
          onClick={onStartMission}
          type="button"
        >
          Start Mission {"->"}
        </button>
      ) : null}
    </section>
  );
}
