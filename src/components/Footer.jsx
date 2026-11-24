// Small credit line shown at the bottom of the login, projects and admin pages.
export default function Footer({ className = '' }) {
  return (
    <footer className={`app-footer ${className}`.trim()}>
      Developed by <span className="footer-heart" role="img" aria-label="love">❤</span> R K Gupta
    </footer>
  );
}
