import { trackLink } from "../../analytics";
import { SOCIAL_LINKS } from "../../data/socialLinks";

export function SocialLinks() {
  return (
    <div className="social-links">
      <a
        href={SOCIAL_LINKS.github}
        onClick={() => trackLink("GitHub", SOCIAL_LINKS.github)}
        rel="noreferrer"
        target="_blank"
      >
        GH
      </a>
      <a
        href={SOCIAL_LINKS.linkedin}
        onClick={() => trackLink("LinkedIn", SOCIAL_LINKS.linkedin)}
        rel="noreferrer"
        target="_blank"
      >
        LI
      </a>
      <a
        href={SOCIAL_LINKS.email}
        onClick={() => trackLink("Email", SOCIAL_LINKS.email)}
      >
        MAIL
      </a>
      <a
        href={SOCIAL_LINKS.resume}
        onClick={() => trackLink("Resume", SOCIAL_LINKS.resume)}
        rel="noreferrer"
        target="_blank"
      >
        CV
      </a>
    </div>
  );
}
