export const metadata = {
  title: "Privacy Policy — Slam Washermenpet",
  description: "Privacy policy for Slam Washermenpet booking and communication services.",
};

export default function PrivacyPage() {
  const lastUpdated = "June 16, 2026";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", fontFamily: "sans-serif", color: "#111", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#555", marginBottom: 40 }}>Last updated: {lastUpdated}</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Who We Are</h2>
        <p>
          Slam Washermenpet ("we", "us", "our") operates gyms, salons, and restaurants across South India.
          This privacy policy explains how we collect, use, and protect your personal information when you
          interact with us — including through our website, WhatsApp messages, and AI-assisted phone calls.
        </p>
        <p style={{ marginTop: 8 }}>
          Contact: <a href="mailto:Creativetitan1@gmail.com" style={{ color: "#2563eb" }}>Creativetitan1@gmail.com</a>
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. Information We Collect</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Contact details:</strong> name, phone number, email address</li>
          <li><strong>Appointment information:</strong> service type, date, time, location, and booking history</li>
          <li><strong>Membership details:</strong> membership tier, expiry date, payment status</li>
          <li><strong>Communication records:</strong> WhatsApp message history, call transcripts, and interaction logs</li>
          <li><strong>Preferences:</strong> language preference (English, Hindi, Tamil), opt-in and opt-out status</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. How We Use Your Information</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Booking and managing appointments at our locations</li>
          <li>Sending appointment reminders and confirmations via WhatsApp or phone call</li>
          <li>Following up on membership renewals when your membership is nearing expiry</li>
          <li>Contacting you about relevant services or offers (only with your consent)</li>
          <li>Improving our services based on feedback and interaction history</li>
          <li>Complying with applicable laws and regulations (including TRAI guidelines for outbound calls)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. WhatsApp Messaging</h2>
        <p>
          We use the Meta WhatsApp Business Cloud API to send you messages. We only contact you via WhatsApp
          if you have provided your phone number and consented to receive communications from us.
          We use Meta-approved message templates for first contact and transactional messages.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>To opt out</strong> at any time, reply to any of our WhatsApp messages with the word{" "}
          <strong>STOP</strong>, <strong>not interested</strong>, <strong>band karo</strong>, or{" "}
          <strong>வேண்டாம்</strong>. We will immediately stop all outbound communications to your number.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. AI Voice Calls</h2>
        <p>
          We use an AI-assisted calling system (powered by Bolna AI) to handle appointment booking, reminders,
          and membership renewal follow-ups. Calls may be recorded for quality assurance. If the AI cannot
          assist you confidently, your call will be transferred to a human agent.
        </p>
        <p style={{ marginTop: 8 }}>
          We comply with TRAI (Telecom Regulatory Authority of India) regulations for outbound calls,
          including checking the Do Not Disturb (DND) registry before making any outbound calls.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Meta Platforms:</strong> for WhatsApp message delivery (subject to Meta's privacy policy)</li>
          <li><strong>Bolna AI:</strong> for AI-assisted voice call processing</li>
          <li><strong>Google:</strong> for calendar integration and appointment scheduling</li>
          <li><strong>Service providers:</strong> who help us operate our systems, under strict data processing agreements</li>
          <li><strong>Authorities:</strong> if required by law</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Data Retention</h2>
        <p>
          We retain your personal information for as long as necessary to provide our services and comply with
          legal obligations. Call transcripts and message logs are retained for a maximum of 2 years.
          You may request deletion of your data at any time by contacting us.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Your Rights</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Request access to the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Opt out of all marketing communications at any time</li>
          <li>Withdraw consent for data processing</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:Creativetitan1@gmail.com" style={{ color: "#2563eb" }}>Creativetitan1@gmail.com</a>.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>9. Security</h2>
        <p>
          We use industry-standard security measures to protect your personal information, including encrypted
          data storage, secure API communications, and access controls. No method of transmission over the
          internet is 100% secure, but we take all reasonable steps to protect your data.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>10. Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. The date at the top of this page reflects
          the most recent update. Continued use of our services after changes constitutes acceptance of
          the updated policy.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>11. Contact Us</h2>
        <p>
          If you have any questions about this privacy policy or how we handle your data, please contact us:
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Email: <a href="mailto:Creativetitan1@gmail.com" style={{ color: "#2563eb" }}>Creativetitan1@gmail.com</a></li>
          <li>Phone: +91 96262 53222</li>
        </ul>
      </section>
    </main>
  );
}
