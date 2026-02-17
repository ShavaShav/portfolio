import { SOCIAL_LINKS } from "../../data/socialLinks";

export function SocialLinks() {
  return (
    <div className="social-links">
      <a href={SOCIAL_LINKS.github} rel="noreferrer" target="_blank">
        GH
      </a>
      <a href={SOCIAL_LINKS.linkedin} rel="noreferrer" target="_blank">
        LI
      </a>
      <a href={SOCIAL_LINKS.email}>MAIL</a>
      <a href={SOCIAL_LINKS.resume} rel="noreferrer" target="_blank">
        CV
      </a>
    </div>
  );
}
