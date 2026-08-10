import LegalDocument from '@/components/legal/LegalDocument'

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="July 31, 2026">
      <p>
        This Privacy Policy explains how Concord Deal Platform (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;)
        collects, uses, and protects your personal information when you use the Concord Deal
        Platform (the &quot;Platform&quot;). We are committed to safeguarding your data, including the
        confidential financial information we handle on your behalf.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>Account details: name, email address, broker profile, and authentication data.</li>
        <li>
          Deal-related data: listings, buyer and seller leads, financial statements, recast
          projects, CIMs, BOVs, due-diligence items, and uploaded documents.
        </li>
        <li>Billing details: subscription and invoice records (payment processing is handled by a third-party processor).</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Usage data: pages visited, features used, and interaction logs.</li>
        <li>Device data: browser type, operating system, IP address, and approximate location.</li>
        <li>Cookies and similar technologies — see our Cookie Policy.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To operate, maintain, and improve the Platform and its tools.</li>
        <li>To enable brokerage services, deal management, and document workflows.</li>
        <li>To provide support, security monitoring, and fraud prevention.</li>
        <li>To communicate with you about your account, services, and legal notices.</li>
        <li>To comply with legal obligations and enforce our Terms of Service.</li>
      </ul>

      <h2>3. Confidentiality of Deal &amp; Financial Data</h2>
      <p>
        <strong>
          Financial and deal-related information you enter into the Platform is treated as strictly
          confidential. We do not sell, rent, or trade your personal or deal data. We do not disclose
          your financial information to third parties except as required to operate the Platform (for
          example, cloud hosting and storage providers), to comply with law, or with your explicit
          direction for a specific transaction.
        </strong>
      </p>

      <h2>4. Legal Bases for Processing</h2>
      <p>
        We process personal information based on one or more of the following: your consent;
        performance of a contract with you; our legitimate interests in operating and securing the
        Platform; and compliance with legal obligations.
      </p>

      <h2>5. Sharing &amp; Disclosure</h2>
      <p>We may share your information with:</p>
      <ul>
        <li>Service providers who help operate the Platform (hosting, storage, authentication, email, analytics).</li>
        <li>Licensed brokers and agents participating in a particular deal, when appropriate.</li>
        <li>Law enforcement or regulators when required by law or in response to valid legal process.</li>
      </ul>
      <p>
        We require service providers to agree to confidentiality and data-protection obligations
        consistent with this policy.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your information only as long as necessary for the purposes described in this
        policy and to comply with legal, accounting, or reporting requirements. Deal and financial
        records may be retained for a longer period where required by applicable professional
        record-keeping rules, then securely deleted.
      </p>

      <h2>7. Security</h2>
      <p>
        We apply industry-standard safeguards, including encryption in transit (TLS), role-level
        security (RLS) on our database, secure authentication, and access controls. No method of
        transmission or storage is 100% secure, and we cannot guarantee absolute security.
      </p>

      <h2>8. Your Rights</h2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct, delete, restrict,
        or port your personal information, and to withdraw consent. To exercise these rights,
        contact us using the details below.
      </p>

      <h2>9. Children&apos;s Privacy</h2>
      <p>
        The Platform is not directed to individuals under 18, and we do not knowingly collect their
        personal information.
      </p>

      <h2>10. International Transfers</h2>
      <p>
        Your information may be transferred to and processed in the United States or other
        jurisdictions where our service providers operate. By using the Platform, you consent to
        such transfers.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy periodically. Material changes will be posted here with
        an updated &quot;last updated&quot; date.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        For privacy questions or to exercise your rights, contact us at:{' '}
        <a href="mailto:privacy@concordplatform.com" style={{ color: 'var(--gold-dark)' }}>
          privacy@concordplatform.com
        </a>
        .
      </p>
    </LegalDocument>
  )
}
