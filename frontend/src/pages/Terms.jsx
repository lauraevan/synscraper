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

export default function Terms() {
  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-20 pt-28 md:px-8 md:pt-32" data-testid="terms-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/65"><span className="h-px w-6 bg-[#ffd400]/60" /> Legal</div>
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white md:text-6xl">Terms of Service</h1>
          <p className="mt-5 text-sm leading-7 text-white/48 md:text-[15px]">Effective September 5, 2026. These Terms govern access to and use of SynFlix, including its discovery interface, metadata, previews, watchlist tools, player, and related web functionality.</p>
        </div>

        <div className="rounded-[24px] border border-[#ffd400]/10 bg-white/[0.02] px-5 py-8 md:px-8 md:py-10">
          <Section number="01" title="Agreement to these Terms">
            <p>By accessing or using SynFlix, you agree to be bound by these Terms of Service and the Privacy Policy. If you do not agree, do not use the service. If you are using SynFlix on behalf of an organization, you represent that you have authority to bind that organization to these Terms.</p>
            <p>These Terms form the entire general agreement concerning use of the SynFlix service unless a separate written agreement expressly states that it overrides a particular provision.</p>
          </Section>

          <Section number="02" title="Description of the service">
            <p>SynFlix provides a web interface for discovering movies and television programs, viewing metadata and artwork, watching trailers or previews, saving titles locally, remembering playback progress, and requesting playback through available sources. Features may be added, removed, modified, limited, suspended, or discontinued at any time.</p>
            <p>SynFlix may rely on third-party metadata providers, video platforms, hosting services, content delivery networks, APIs, and playback sources. Availability of any title, trailer, image, source, quality level, subtitle, or other feature is not guaranteed.</p>
          </Section>

          <Section number="03" title="Eligibility and responsible use">
            <p>You may use SynFlix only if you are legally permitted to enter into these Terms and to access the service in your location. If you are under the age at which you can independently agree to online terms in your jurisdiction, you may use the service only with appropriate involvement of a parent or legal guardian.</p>
            <p>You are responsible for the device, internet connection, software, permissions, and legal authority required to use the service. You are also responsible for ensuring that your use of any media, stream, preview, download, or third-party source complies with laws and rights applicable to you.</p>
          </Section>

          <Section number="04" title="Permitted use">
            <p>Subject to these Terms, SynFlix grants you a limited, non-exclusive, revocable, non-transferable permission to access the service for personal, lawful use. This permission does not transfer ownership of SynFlix software, branding, source code, design assets, third-party metadata, or media content.</p>
            <p>You may use normal browser functions and features intentionally exposed by SynFlix. Any broader reuse, redistribution, commercial exploitation, automated extraction, or public republication may require separate permission from the applicable rights holder.</p>
          </Section>

          <Section number="05" title="Prohibited conduct">
            <p>You must not use SynFlix to violate applicable law or another person's rights; interfere with or disrupt the service; bypass reasonable access controls or rate limits; distribute malware; probe systems without authorization; impersonate another person or entity; misuse contact channels; submit fraudulent requests; or intentionally overload infrastructure.</p>
            <p>You must not use automated tools in a manner that materially degrades service for others, attempts to defeat technical safeguards, or places an unreasonable load on SynFlix or its vendors. Security testing must be conducted only where you have authorization and in a manner that avoids harm, data exposure, or service interruption.</p>
          </Section>

          <Section number="06" title="Third-party content and services">
            <p>SynFlix may display or interact with information, artwork, logos, trailers, videos, streams, captions, ratings, recommendations, or other material provided by third parties. SynFlix does not necessarily own, control, endorse, sponsor, or verify third-party material merely because it is displayed through the interface.</p>
            <p>Third-party websites and services may impose their own terms, privacy policies, technical restrictions, regional restrictions, licensing rules, or age requirements. Your dealings with those services are between you and the applicable third party.</p>
          </Section>

          <Section number="07" title="Media availability and rights">
            <p>Availability of a title in metadata or search results does not mean that SynFlix owns distribution rights to that title or guarantees that a lawful playback source is available to you. You are responsible for using content only where you have a lawful basis to access it.</p>
            <p>SynFlix may remove, disable, deprioritize, or stop supporting a source, title, preview, or integration at any time, including in response to technical failures, abuse concerns, rights complaints, provider changes, legal requirements, or operational decisions.</p>
          </Section>

          <Section number="08" title="Intellectual property">
            <p>The SynFlix name, interface code, original design elements, site-specific graphics, and original software are protected by applicable intellectual-property laws except to the extent otherwise stated. Third-party movie and television titles, trademarks, artwork, logos, trailers, metadata, and other materials remain the property of their respective owners.</p>
            <p>No provision of these Terms grants you ownership of third-party content or permission to use a third party's trademarks, copyrighted works, or other proprietary material outside the functionality provided by SynFlix.</p>
          </Section>

          <Section number="09" title="Feedback and submissions">
            <p>If you voluntarily provide suggestions, bug reports, ideas, interface feedback, or other non-confidential feedback about SynFlix, you grant the project permission to use that feedback to improve, maintain, or develop the service without an obligation to compensate you.</p>
            <p>Do not submit confidential business information, passwords, private keys, payment credentials, or other sensitive information through public project channels. You are responsible for ensuring that anything you submit is information you are permitted to share.</p>
          </Section>

          <Section number="10" title="Local data and watchlist features">
            <p>Features such as My List, playback position, and certain preferences may be stored locally in your browser. SynFlix does not promise that locally stored information will be backed up, synchronized, or recoverable. Browser updates, storage clearing, private mode, device changes, or software failures may cause local information to disappear.</p>
            <p>You should not rely on SynFlix local storage as the sole record of information that is important to you.</p>
          </Section>

          <Section number="11" title="Service changes, outages, and maintenance">
            <p>SynFlix may be unavailable from time to time because of maintenance, provider outages, network failures, API limits, infrastructure changes, bugs, security events, or circumstances outside the project's control. No uptime, latency, quality, stream availability, or continuity commitment is made unless separately agreed in writing.</p>
            <p>SynFlix may change source priority, video quality behavior, metadata providers, user-interface design, supported browsers, hosting arrangements, or technical architecture without prior notice.</p>
          </Section>

          <Section number="12" title="No professional or licensing advice">
            <p>Information shown on SynFlix is provided for entertainment, discovery, and technical functionality. It is not legal advice, licensing advice, financial advice, or a representation that any particular use of third-party media is authorized in your jurisdiction.</p>
            <p>If you need advice about copyright, licensing, privacy, consumer law, or other legal rights, you should consult a qualified professional familiar with your circumstances and location.</p>
          </Section>

          <Section number="13" title="Disclaimer of warranties">
            <p>To the maximum extent permitted by law, SynFlix is provided on an "as is" and "as available" basis. No warranty is made that the service will be uninterrupted, secure, error-free, accurate, complete, compatible with every device, or suitable for a particular purpose.</p>
            <p>No warranty is made concerning the quality, legality, reliability, safety, accuracy, availability, synchronization, subtitle timing, stream resolution, or continued existence of third-party content or services. Some jurisdictions do not allow certain warranty exclusions, so parts of this section may not apply to you.</p>
          </Section>

          <Section number="14" title="Limitation of liability">
            <p>To the maximum extent permitted by applicable law, SynFlix and its operators, contributors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, profits, goodwill, business opportunity, or service availability arising from or related to your use of or inability to use the service.</p>
            <p>Where liability cannot lawfully be excluded, liability will be limited to the greatest extent permitted by law. Some jurisdictions provide mandatory consumer rights that cannot be waived by contract; nothing in these Terms is intended to eliminate those rights.</p>
          </Section>

          <Section number="15" title="Indemnification">
            <p>To the extent permitted by law, you agree to defend, indemnify, and hold harmless SynFlix and its operators from claims, damages, losses, liabilities, and reasonable expenses arising out of your unlawful use of the service, your violation of these Terms, or your infringement of another person's rights.</p>
            <p>This section does not require indemnification where prohibited by applicable consumer law.</p>
          </Section>

          <Section number="16" title="Suspension and termination">
            <p>Access to SynFlix may be limited, suspended, or terminated when reasonably necessary to protect the service, users, infrastructure, providers, or third parties; respond to suspected abuse; comply with legal obligations; address repeated violations; or discontinue a feature or the service entirely.</p>
            <p>Provisions that by their nature should survive termination, including intellectual-property provisions, disclaimers, limitations of liability, and dispute-related provisions, will continue to apply after access ends.</p>
          </Section>

          <Section number="17" title="Copyright and rights concerns">
            <p>Rights holders who believe material displayed or linked through SynFlix infringes their rights may submit a notice through the contact method published by the project. A useful notice should identify the work at issue, the specific material or location, the basis of the claim, and reliable contact information.</p>
            <p>SynFlix may remove or disable material, integrations, or source references while a complaint is reviewed and may request additional information where necessary to evaluate a claim.</p>
          </Section>

          <Section number="18" title="Privacy">
            <p>Use of SynFlix is also subject to the <Link to="/privacy" className="font-medium text-[#ffd400] hover:text-[#ffe45e]">Privacy Policy</Link>, which explains how browser storage, technical information, third-party embeds, infrastructure logs, and related information may be handled.</p>
          </Section>

          <Section number="19" title="Changes to these Terms">
            <p>These Terms may be revised when SynFlix features, providers, business arrangements, technical architecture, or legal obligations change. The effective date at the top of this page indicates the current version.</p>
            <p>If a change is material, SynFlix may provide additional notice where reasonable. Continued use after revised Terms become effective constitutes acceptance of the revised Terms to the extent permitted by law.</p>
          </Section>

          <Section number="20" title="Governing principles and severability">
            <p>These Terms should be interpreted consistently with applicable law and mandatory consumer protections. If a provision is found unenforceable, it will be limited or removed only to the minimum extent necessary, and the remaining provisions will continue in effect.</p>
            <p>A failure to enforce a provision immediately does not waive the right to enforce it later. Headings are provided for readability and do not limit the meaning of the provisions.</p>
          </Section>

          <Section number="21" title="Contact">
            <p>Questions about these Terms, rights concerns, or service-related legal notices may be submitted using the contact method made available on the SynFlix site or project repository. Please provide enough detail to identify the issue while avoiding unnecessary sensitive information.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}
