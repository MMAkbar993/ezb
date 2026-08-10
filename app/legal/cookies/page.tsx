import LegalDocument from '@/components/legal/LegalDocument'

export default function CookiesPage() {
  return (
    <LegalDocument title="Cookie Policy" updated="July 31, 2026">
      <p>
        This Cookie Policy explains how Concord Deal Platform (&quot;we,&quot; &quot;us&quot;,&quot;our&quot;) uses cookies
        and similar technologies when you use the Concord Deal Platform (the &quot;Platform&quot;).
        It works together with our Privacy Policy.
      </p>

      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files placed on your device by your web browser. They help websites
        function properly, remember preferences, and understand how visitors use the site.
      </p>

      <h2>2. Cookies We Use</h2>
      <h3>Strictly necessary cookies</h3>
      <p>
        These are required for the Platform to operate, including maintaining your authenticated
        session and security controls. Without them, core features would not work.
      </p>
      <h3>Functional cookies</h3>
      <p>
        These remember choices you make (such as agency/subdomain preferences) to improve your
        experience.
      </p>
      <h3>Analytics cookies</h3>
      <p>
        These help us understand how the Platform is used, which pages are visited, and where
        issues occur, so we can improve performance — for example, session and traffic statistics.
      </p>

      <h2>3. How Long Cookies Persist</h2>
      <ul>
        <li>
          <strong>Session cookies</strong> — deleted when you close your browser.
        </li>
        <li>
          <strong>Persistent cookies</strong> — remain on your device until they expire or you
          delete them.
        </li>
      </ul>

      <h2>4. Third-Party Technologies</h2>
      <p>
        We rely on authorized service providers for hosting, authentication, and secure, encrypted
        connections. These providers may set strictly-necessary cookies to enable the service but
        do not use your data for independent advertising on the Platform.
      </p>

      <h2>5. Managing Cookies</h2>
      <p>
        You can control and delete cookies through your browser settings. Most browsers let you
        block all cookies or alert you before a cookie is set. Disabling strictly necessary
        cookies may prevent you from logging in or using core functionality. For more detail, see
        your browser&apos;s help section.
      </p>

      <h2>6. Do We Use Cookie Banners?</h2>
      <p>
        We aim to set only strictly necessary cookies until you provide consent for non-essential
        (analytics) cookies where required by law. We may present a consent manager in relevant
        jurisdictions.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions about this Cookie Policy may be directed to:{' '}
        <a href="mailto:privacy@concordplatform.com" style={{ color: 'var(--gold-dark)' }}>
          privacy@concordplatform.com
        </a>
        .
      </p>
    </LegalDocument>
  )
}
