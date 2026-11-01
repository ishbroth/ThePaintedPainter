const Privacy = () => (
  <div className="page-container" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 70px' }}>
    <h1 style={{ marginBottom: 4 }}>Privacy Policy</h1>
    <p style={{ opacity: 0.7, marginTop: 0 }}>The Painted Painter. Last updated 31 October 2026.</p>

    <h2>What we collect</h2>
    <ul>
      <li><b>Your contact details</b>: name, email address and phone number, when you create an account, ask for a price, or book a painter.</li>
      <li><b>Your project</b>: the answers you give the estimator, the address or ZIP code of the job, and any photos you add. These are used to work out your price and to show the painter you choose what the job is.</li>
      <li><b>If you are a painter</b>: your business details, license and insurance information, portfolio photos, service area, prices and availability, and the reviews you receive.</li>
      <li><b>Payments</b>: the deposit for a booking is paid through Stripe. Your card details go to Stripe and are never seen or stored by us; we keep a record that a payment was made.</li>
      <li><b>Photos from your phone</b>: only the ones you choose to upload, or take with the camera when you tap to add a photo.</li>
    </ul>

    <h2>How it is used</h2>
    <p>To give you a price, match you with painters, take a booking, arrange dates, send you the emails and reminders about your job, handle reviews, and keep the service safe. Painters see your contact details and job details only after you choose them or accept their offer.</p>

    <h2>Who else handles your data</h2>
    <ul>
      <li><b>Supabase</b> stores accounts, jobs and uploaded photos.</li>
      <li><b>Stripe</b> processes deposits.</li>
      <li><b>Google</b> provides maps and address lookup.</li>
      <li><b>An AI service</b> reads your estimator answers (and photos you send for analysis) to understand your project and produce your price.</li>
      <li><b>An email service</b> sends the messages about your job.</li>
    </ul>
    <p>We do not sell your personal information, and we do not use advertising or tracking cookies.</p>

    <h2>Deleting your data</h2>
    <p>You can delete your account at any time from Settings. This removes your account and the personal information tied to it. Records we are required to keep for completed jobs and payments may be kept in a form that is not linked to your account.</p>

    <h2>Children</h2>
    <p>The Painted Painter is for adults who own or manage property. It is not directed at children under 13.</p>

    <h2>Contact</h2>
    <p>Questions or requests about your data: <a href="mailto:contact@thepaintedpainter.com">contact@thepaintedpainter.com</a>.</p>
  </div>
);

export default Privacy;
