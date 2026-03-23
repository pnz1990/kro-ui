import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__left">kro-ui</div>
      <nav className="footer__links" aria-label="External resources">
        <a href="https://kro.run" target="_blank" rel="noopener noreferrer">
          kro.run
        </a>
        <a
          href="https://github.com/kubernetes-sigs/kro"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <a
          href="https://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          License
        </a>
      </nav>
    </footer>
  )
}
