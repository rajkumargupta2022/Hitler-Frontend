// Project logo images (served from /public). The light-theme and dark-theme artwork are both rendered;
// CSS (.theme-dark / .theme-light in styles.css) shows the one that matches the active theme.
// LogoMark = icon only; Logo = icon + "API Tester" text; LogoFull = large version for the login page.
export function LogoMark({ size = 28 }) {
  return (
    <>
      <img className="logo-mark theme-light" src="/logo-mark-light.png" width={size} height={size} alt="" />
      <img className="logo-mark theme-dark" src="/logo-mark.png" width={size} height={size} alt="" />
    </>
  );
}

export function LogoFull({ width = 200 }) {
  return (
    <>
      <img className="logo-full theme-dark" src="/logo-full.png" width={width} alt="API Tester" />
      <span className="logo-full-light theme-light" role="img" aria-label="API Tester">
        <img className="logo-mark" src="/logo-mark-light.png" width={96} height={96} alt="" />
        <span className="logo-wordmark">API-<span>tester</span></span>
      </span>
    </>
  );
}

export default function Logo({ size = 28, text = true }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {text && <span className="logo-text">API Tester</span>}
    </span>
  );
}
