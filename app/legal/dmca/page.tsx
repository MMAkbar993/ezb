import LegalDocument from '@/components/legal/LegalDocument'

export default function DmcaPage() {
  return (
    <LegalDocument title="DMCA Notice &amp; Takedown Policy" updated="July 31, 2026">
      <p>
        Concord Deal Platform (&quot;we,&quot; &quot;us&quot;) respects the intellectual property rights of others
        and complies with the Digital Millennium Copyright Act (17 U.S.C. § 512). This policy
        explains how to report alleged copyright infringement and how we respond.
      </p>

      <h2>1. Filing a DMCA Takedown Notice</h2>
      <p>
        If you believe content on the Platform infringes your copyright, you may submit a written
        notice containing the following information:
      </p>
      <ul>
        <li>Your physical or electronic signature (or that of an authorized agent);</li>
        <li>Identification of the copyrighted work claimed to be infringed;</li>
        <li>
          Identification of the material that is claimed to be infringing and information
          reasonably sufficient to locate it on the Platform;
        </li>
        <li>Your contact information (address, telephone number, and email address);</li>
        <li>
          A statement that you have a good-faith belief that the use is not authorized by the
          copyright owner, its agent, or the law; and
        </li>
        <li>
          A statement, under penalty of perjury, that the information in your notice is accurate
          and that you are authorized to act on behalf of the owner of an exclusive right.
        </li>
      </ul>

      <h2>2. Where to Send Notices</h2>
      <p>
        Designated agent for copyright claims:
      </p>
      <p style={{ marginLeft: 16 }}>
        Copyright Agent<br />
        Concord Deal Platform<br />
        Email:{' '}
        <a href="mailto:dmca@concordplatform.com" style={{ color: 'var(--gold-dark)' }}>
          dmca@concordplatform.com
        </a>
      </p>

      <h2>3. Our Response</h2>
      <p>
        Upon receipt of a complete and valid notice, we will promptly remove or disable access to
        the identified material and take reasonable steps to notify the alleged infringer. Repeat
        infringers may have their access terminated under appropriate circumstances.
      </p>

      <h2>4. Counter-Notification</h2>
      <p>
        If you believe material was removed by mistake or misidentification, you may submit a
        counter-notification that includes:
      </p>
      <ul>
        <li>Your physical or electronic signature;</li>
        <li>Identification of the removed material and its prior location;</li>
        <li>
          A statement under penalty of perjury that you have a good-faith belief the material was
          removed by mistake or misidentification; and
        </li>
        <li>Your name, address, telephone number, and consent to the jurisdiction of the relevant court.</li>
      </ul>
      <p>
        We will forward valid counter-notifications to the original complainant. If they do not
        file a court action within the statutory period, we may restore the removed material.
      </p>

      <h2>5. Confidential &amp; Deal Data</h2>
      <p>
        Note that seller listings, CIMs, BOVs, and financial documents are confidential business
        information, not published copyright works. If you have a confidentiality or consent
        concern regarding such materials, please contact us directly rather than filing a DMCA
        notice.
      </p>

      <h2>6. Bad-Faith Notices</h2>
      <p>
        Knowingly submitting a false or misleading DMCA notice may subject you to liability for
        damages, including costs and attorney&apos;s fees, under 17 U.S.C. § 512(f).
      </p>
    </LegalDocument>
  )
}
