const legalContent = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains how Simba Grand Tours uses the information you provide when you browse our website, contact us, subscribe to updates, or request a safari booking.',
    sections: [
      {
        title: 'Information we collect',
        paragraphs: [
          'Depending on how you use the website, we may collect your name, email address, phone number, enquiry message, chosen trip or departure, number of travelers, passenger names and contact details, emergency contacts, and M-Pesa payment phone number.',
          'Newsletter subscribers provide an email address and may optionally provide a phone number. We record SMS consent when you choose to opt in. If you submit a testimonial, we may use booking details to verify it before publication.',
        ],
      },
      {
        title: 'How we use information',
        paragraphs: [
          'We use this information to answer enquiries, arrange and administer bookings, confirm payments, communicate about trips, manage waitlists, verify testimonials, and operate and protect our services.',
          'We send SMS updates only to subscribers who have opted in. You can ask us to stop email or SMS updates by contacting us using the details below.',
        ],
      },
      {
        title: 'When information is shared',
        paragraphs: [
          'We share information only as needed to provide the service you request, such as with payment, email, SMS, hosting, or trip-service providers. Those providers handle information under their own privacy and security practices.',
          'Public testimonials may show the name and trip details you submitted, but we do not publish your email address or booking reference as part of the testimonial.',
        ],
      },
      {
        title: 'Retention and your choices',
        paragraphs: [
          'We keep information for as long as it is needed to respond to you, administer a booking, meet applicable record-keeping obligations, or resolve a dispute. You may contact us to request access to, correction of, or deletion of your information, or to withdraw marketing consent. Some booking records may need to be retained where required for legitimate business or legal purposes.',
        ],
      },
      {
        title: 'Contact us',
        paragraphs: [
          'For privacy questions or requests, contact Simba Grand Tours at the email address shown below.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: 'These terms apply when you use the Simba Grand Tours website or request a trip. A safari may also have booking terms specific to that trip; those terms are shown with the package or provided with your booking.',
    sections: [
      {
        title: 'Website information and availability',
        paragraphs: [
          'We work to keep trip descriptions, photos, prices, and availability current. They may change as itineraries, suppliers, and departure availability change. A booking is subject to confirmation by Simba Grand Tours.',
        ],
      },
      {
        title: 'Bookings and payments',
        paragraphs: [
          'When requesting a booking, provide accurate contact and traveler information. The booking page displays the applicable trip price, booking fee, balance, and any trip-specific terms. An M-Pesa payment request must be completed and verified before a booking is confirmed.',
          'If a booking or payment remains pending, or you do not receive confirmation, contact us before making another payment.',
        ],
      },
      {
        title: 'Changes, cancellations, and refunds',
        paragraphs: [
          'Change, cancellation, refund, and balance-payment arrangements depend on the written terms for the selected trip and the booking confirmation. Please contact us before paying if those terms are not shown or you need clarification.',
        ],
      },
      {
        title: 'Traveler information and trip services',
        paragraphs: [
          'You are responsible for providing complete and accurate details for yourself and the other travelers in your booking. Where a trip includes services provided by third parties, those services may also be subject to the provider’s requirements and conditions.',
        ],
      },
      {
        title: 'Contact us',
        paragraphs: [
          'For questions about these terms or a specific trip, contact Simba Grand Tours using the details below.',
        ],
      },
    ],
  },
};

function parseLegalDocument(text) {
  const sections = [];
  let section = { title: null, paragraphs: [] };

  for (const block of text.trim().split(/\n\s*\n/).filter(Boolean)) {
    if (block.startsWith('## ')) {
      if (section.title || section.paragraphs.length) sections.push(section);
      section = { title: block.slice(3).trim(), paragraphs: [] };
    } else {
      section.paragraphs.push(block);
    }
  }

  if (section.title || section.paragraphs.length) sections.push(section);
  return sections;
}

export default function LegalPage({ type, settings, onNavigate }) {
  const content = legalContent[type];
  const siteName = settings?.siteName || 'Simba Grand Tours';
  const email = settings?.siteEmail || 'simbagrandtours@gmail.com';
  const documentText = type === 'privacy' ? settings?.privacyPolicy : settings?.termsConditions;
  const customBlocks = typeof documentText === 'string' && documentText.trim()
    ? parseLegalDocument(documentText)
    : null;

  return (
    <main className="legal-page container fade-in">
      <p className="gold-text">{siteName}</p>
      <h1>{content.title}</h1>
      <div className="legal-sections">
        {customBlocks
          ? customBlocks.map((section, index) => (
            <section key={`${section.title || 'intro'}-${index}`}>
              {section.title && <h2>{section.title}</h2>}
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={`${paragraphIndex}-${paragraph}`}
                  className={index === 0 && paragraphIndex === 0 && !section.title ? 'legal-intro' : undefined}
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))
          : <>
            <p className="legal-intro">{content.intro}</p>
            {content.sections.map(section => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </>}
      </div>
      <p className="legal-contact">
        <a href={`mailto:${email}`}>{email}</a>
        {settings?.sitePhone && <> · <a href={`tel:${settings.sitePhone.replace(/\s+/g, '')}`}>{settings.sitePhone}</a></>}
      </p>
      <button type="button" className="btn-gold" onClick={() => onNavigate('home')}>Back to home</button>
    </main>
  );
}
