import { Link } from "react-router-dom";

const Section = ({ number, title, children }) => (
  <section className="border-t border-white/[0.07] py-8 first:border-t-0 first:pt-0">
    <div className="grid gap-4 md:grid-cols-[72px_1fr] md:gap-8">
      <div className="text-sm font-semibold tracking-[0.16em] text-[#ffd400]/70">{number}</div>
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">{title}</h2>
        <div className="mt-4 space-y-4 text-[14px] leading-7 text-white/58 md:text-[15px]">{children}</div>
      </div>
    </div>
  </section>
);

export default function Privacy() {
  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-20 pt-28 md:px-8 md:pt-32" data-testid="privacy-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/65"><span className="h-px w-6 bg-[#ffd400]/60" /> Legal</div>
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white md:text-6xl">Privacy Policy</h1>
          <p className="mt-5 text-sm leading-7 text-white/48 md:text-[15px]">Effective September 5, 2026. This Privacy Policy explains how SynFlix handles information when you browse the site, save titles, watch content through available sources, or interact with previews and related features.</p>
        </div>

        <div className="rounded-[24px] border border-[#ffd400]/10 bg-white/[0.02] px-5 py-8 md:px-8 md:py-10">
          <Section number="01" title="Scope and overview">
            <p>This Policy applies to the SynFlix website, its browsing and discovery interface, title detail pages, watchlist features, playback interface, and related web functionality that links to this Policy. It does not govern websites, video platforms, content providers, hosting companies, or other third parties that you may reach through SynFlix.</p>
            <p>SynFlix is designed primarily as a client-side media discovery and playback interface. The service may retrieve metadata, artwork, trailers, and availability information from third-party services and may connect you to separate content or streaming sources. Those third parties operate under their own privacy practices.</p>
          </Section>

          <Section number="02" title="Information you provide directly">
            <p>SynFlix currently does not require a traditional user account for its core browsing experience. As a result, the service does not intentionally request your legal name, home address, payment-card details, government identification number, or password as a condition of using the main site.</p>
            <p>If you voluntarily contact the project, submit feedback, report an issue, or otherwise communicate with the operators, the information contained in that communication may be processed for the purpose of responding, troubleshooting, preventing abuse, improving the service, and keeping appropriate records of the request.</p>
          </Section>

          <Section number="03" title="Information stored on your device">
            <p>SynFlix uses browser storage for convenience features such as your saved list, playback progress, recently selected preferences, and similar local settings. This information is generally stored in your browser on your device rather than in a SynFlix user account.</p>
            <p>Clearing browser storage, using private browsing, changing browsers, or moving to another device may remove or reset this information. Unless a future feature explicitly says otherwise, local watchlist and playback state should not be treated as cloud-synchronized or permanently recoverable data.</p>
          </Section>

          <Section number="04" title="Technical and usage information">
            <p>When you access a website, technical information is necessarily transmitted as part of normal internet communication. SynFlix, its hosting provider, reverse proxies, infrastructure vendors, or security systems may receive information such as your IP address, approximate region derived from IP, browser type, device type, operating system, requested URL, referring page, request time, response status, and diagnostic information.</p>
            <p>This information may be used to deliver the site, keep the service reliable, diagnose errors, defend against abuse, enforce rate limits, investigate security events, and understand aggregate performance. SynFlix does not represent that infrastructure-level logs are never created, because hosting and network providers may generate them automatically.</p>
          </Section>

          <Section number="05" title="Movie and television metadata">
            <p>SynFlix uses external metadata services to display titles, posters, backdrops, cast information, genres, release dates, ratings, recommendations, trailers, logos, and related information. Requests made through SynFlix may include a title identifier, media type, season number, episode number, search phrase, or other information needed to retrieve the requested metadata.</p>
            <p>Movie and television discovery requests may therefore reveal to infrastructure or metadata providers which titles or categories are being requested at a technical level. SynFlix may cache metadata responses temporarily to improve speed and reduce unnecessary duplicate requests.</p>
          </Section>

          <Section number="06" title="Trailers, embedded video, and third-party players">
            <p>SynFlix may display trailers, teasers, featurettes, or clips through embedded third-party video players such as YouTube or Vimeo. When an embedded player loads, the third-party video provider may receive technical information about your device, browser, IP address, the page containing the embed, and your interaction with the video. Those providers may use cookies, local storage, device identifiers, or other technologies under their own policies.</p>
            <p>Where practical, SynFlix uses privacy-conscious embed options, muted autoplay, and delayed loading for background previews, but embedding a third-party player does not make that third party part of SynFlix or place its data practices under SynFlix's control.</p>
          </Section>

          <Section number="07" title="Playback and external content sources">
            <p>The player may request stream information from one or more available sources and may proxy or relay certain media requests for technical compatibility. Stream-related requests can include the selected media identifier, season, episode, requested quality, selected provider, and technical headers required for playback.</p>
            <p>Third-party content sources, CDNs, video hosts, or network providers involved in playback may separately receive technical information associated with the request. Their handling of information is governed by their own policies and infrastructure.</p>
          </Section>

          <Section number="08" title="Cookies and similar technologies">
            <p>SynFlix may use browser storage and similar technologies that are necessary for site functionality, saved preferences, playback state, security, or performance. Third-party embeds and infrastructure providers may also set or read cookies or equivalent identifiers.</p>
            <p>You can control cookies and site data through your browser settings. Blocking all storage or third-party content may prevent features such as saved lists, remembered progress, embedded trailers, or some playback functions from working correctly.</p>
          </Section>

          <Section number="09" title="How information is used">
            <p>Information processed in connection with SynFlix may be used to provide requested pages and media functionality; remember local preferences; deliver metadata and previews; troubleshoot playback; detect malicious or automated traffic; prevent fraud, abuse, or attacks; improve reliability and performance; respond to user requests; comply with applicable legal obligations; and protect the rights, safety, and integrity of the service and its users.</p>
            <p>SynFlix does not sell a user profile assembled from your local watchlist or playback history to advertisers. If advertising or materially different tracking features are introduced in the future, this Policy should be updated before or when those practices begin.</p>
          </Section>

          <Section number="10" title="Sharing and disclosure">
            <p>Information may be shared with service providers that perform hosting, content delivery, security, infrastructure, analytics, error monitoring, metadata retrieval, or other technical functions on behalf of the service. Those providers may process information only to the extent needed to provide their services or as otherwise permitted under their own agreements and legal obligations.</p>
            <p>Information may also be disclosed when reasonably necessary to comply with law, legal process, court orders, lawful requests, or regulatory obligations; to investigate suspected abuse, fraud, security incidents, or violations of the Terms; to protect users or the public; or in connection with a merger, acquisition, financing, reorganization, or transfer of the project or its assets.</p>
          </Section>

          <Section number="11" title="Data retention">
            <p>Locally stored watchlist and progress information generally remains on your device until you remove it, clear site data, or your browser removes it. Server and infrastructure logs, if created, may be retained for periods determined by operational, security, debugging, contractual, or legal needs.</p>
            <p>SynFlix aims to avoid retaining personal information longer than reasonably necessary for the purpose for which it was processed. Because infrastructure providers may maintain independent logs or backups, deletion from one system does not necessarily cause immediate deletion from every third-party system.</p>
          </Section>

          <Section number="12" title="Security">
            <p>Reasonable technical and organizational measures may be used to protect the service and information processed through it. These may include transport encryption, access controls, caching limits, request validation, security monitoring, and infrastructure protections.</p>
            <p>No internet service can guarantee perfect security. You should not submit highly sensitive personal information through SynFlix unless a feature specifically requires it and clearly explains why it is needed.</p>
          </Section>

          <Section number="13" title="Children and younger users">
            <p>SynFlix is not intended to knowingly collect sensitive personal information from children. Because the core service does not require a standard account profile, it generally does not ask users to provide a birth date or identity information before browsing.</p>
            <p>Parents and guardians should supervise use where appropriate, particularly because trailers, metadata, external sites, and content sources may contain material intended for older audiences and may have separate privacy practices.</p>
          </Section>

          <Section number="14" title="Your choices and rights">
            <p>You can clear SynFlix local storage through your browser, remove items from your saved list, disable cookies, block third-party embeds, or stop using the service. Depending on where you live, applicable law may also provide rights concerning access, deletion, correction, objection, restriction, or portability of certain personal information.</p>
            <p>Because much of SynFlix's preference data is stored locally rather than in a user account, the most direct way to delete that information is often to clear the site's storage in your browser. Requests concerning information actually held by the project can be submitted using the contact method published for SynFlix or its project repository.</p>
          </Section>

          <Section number="15" title="International processing">
            <p>Internet services and their vendors may operate infrastructure in multiple countries. As a result, technical information may be processed in jurisdictions different from the one in which you live. Those jurisdictions may have data-protection laws that differ from your local law.</p>
          </Section>

          <Section number="16" title="Changes to this Policy">
            <p>This Privacy Policy may be updated as SynFlix changes, new features are introduced, third-party services are replaced, or legal requirements evolve. Material changes may be reflected by updating the effective date, revising this page, or providing an additional notice where appropriate.</p>
            <p>Your continued use of the service after an updated Policy becomes effective means the updated Policy will govern information processed after that date, subject to any rights provided by applicable law.</p>
          </Section>

          <Section number="17" title="Contact and related terms">
            <p>Questions, privacy requests, or concerns can be submitted through the contact method made available on the SynFlix site or project repository. Please do not include passwords, payment data, government identifiers, or other unnecessary sensitive information in a support request.</p>
            <p>This Privacy Policy should be read together with the <Link to="/terms" className="font-medium text-[#ffd400] hover:text-[#ffe45e]">Terms of Service</Link>, which governs use of SynFlix generally.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}
