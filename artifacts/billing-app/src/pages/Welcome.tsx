import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Download,
  LockKeyhole,
  Menu,
  PackageCheck,
  Receipt,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  UsersRound,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const PUBLIC_ANALYTICS_CONSENT_KEY = "mobilinq_public_analytics_consent";

const workflow = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Take it in clearly",
    body: "Capture the device, issue, accessories and customer notes at the counter. A repair intake that sounds like your team.",
    accent: "cyan",
  },
  {
    number: "02",
    icon: Wrench,
    title: "Keep the job moving",
    body: "Track status, parts and ownership from intake to bench. Everyone sees the next useful action, not a maze of tabs.",
    accent: "red",
  },
  {
    number: "03",
    icon: Receipt,
    title: "Invoice without re-keying",
    body: "Bring repairs, products and adjustments together in one sale. Keep the handoff from quote to payment tidy.",
    accent: "yellow",
  },
  {
    number: "04",
    icon: PackageCheck,
    title: "Close the loop",
    body: "Mark the work ready, hand it back with confidence and leave a clean record for the next visit.",
    accent: "cyan",
  },
];

const capabilityGroups = [
  {
    eyebrow: "At the counter",
    title: "Sales that keep pace with the queue.",
    body: "Ring up phones, accessories, services and repair work in the same practical workspace. Search the catalogue, keep the basket legible and get back to the customer.",
    icon: ShoppingBag,
    items: ["Products and services together", "Quotes that can become sales", "Receipts and customer history"],
    visual: "sale",
  },
  {
    eyebrow: "On the bench",
    title: "Repairs with fewer loose ends.",
    body: "Intake details stay attached to the job. Staff can see what came in, what is waiting, what changed and what is ready to leave.",
    icon: Wrench,
    items: ["Device and issue details", "Statuses your team can understand", "A record customers can trust"],
    visual: "repair",
  },
  {
    eyebrow: "Behind the scenes",
    title: "Stock that tells the truth.",
    body: "Make inventory useful at the point of sale. See products, quantities and store context before a missing case becomes a missed sale.",
    icon: Boxes,
    items: ["Products and variants", "Stock-aware operations", "Reports for better decisions"],
    visual: "stock",
  },
];

const benefits = [
  {
    icon: Building2,
    title: "Multi-store, one view",
    body: "Give each location room to work while keeping the business legible to the people responsible for it.",
    color: "cyan",
  },
  {
    icon: WifiOff,
    title: "Ready for real-world internet",
    body: "A repair counter should not stop being a repair counter when the connection gets temperamental. Mobilinq is built with offline-friendly work in mind.",
    color: "red",
  },
  {
    icon: BarChart3,
    title: "Reports that answer questions",
    body: "Look across sales, repairs, products and operations without turning the close of day into a spreadsheet ritual.",
    color: "yellow",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-conscious by default",
    body: "Keep staff workflows focused. Use roles, customer access boundaries and an audit trail where accountability matters.",
    color: "cyan",
  },
];

const faqs = [
  {
    question: "Who is Mobilinq for?",
    answer: "Mobilinq is for phone repair shops, mobile-accessories retailers and operators running one or more locations. It is designed around the mix of sales, repairs, stock and customer handoffs that happen in these businesses every day.",
  },
  {
    question: "Is Mobilinq only for repair shops?",
    answer: "No. Repairs are a core workflow, but Mobilinq also supports product sales, accessories, quotations, customers, inventory, reporting and multi-store operations. You can use the pieces that match your counter.",
  },
  {
    question: "What happens when the internet is unreliable?",
    answer: "Mobilinq is designed with offline-friendly work and progressive web app support in mind, so the workspace can remain useful in the moments a connection is not perfect. Exact behavior depends on the device and workflow.",
  },
  {
    question: "How does Mobilinq handle staff privacy?",
    answer: "The workspace includes role-aware access patterns, customer access boundaries and audit logs for accountable operations. Keep staff focused on the information their job requires.",
  },
  {
    question: "Can I see the product without sending a long brief?",
    answer: "Yes. Start with the workspace using the primary button, or use the contact link below to open an email with a simple subject line. We do not need a long form or a collection of unnecessary personal details.",
  },
];

function ProductFrame() {
  return (
    <div className="welcome-product-frame" data-testid="visual-product-frame" aria-label="Mobilinq workspace preview">
      <div className="product-frame-topbar">
        <div className="product-frame-brand">
          <span className="product-frame-mark">m</span>
          <span>mobilinq <small>OPS / LIVE</small></span>
        </div>
        <div className="product-frame-date">THU 14 MAR <span className="frame-dot" /></div>
      </div>
      <div className="product-frame-body">
        <aside className="product-frame-nav" aria-hidden="true">
          <span className="active"><Store size={13} /> Overview</span>
          <span><ShoppingBag size={13} /> Sales</span>
          <span><Wrench size={13} /> Repairs</span>
          <span><Boxes size={13} /> Products</span>
          <span><BarChart3 size={13} /> Reports</span>
        </aside>
        <div className="product-frame-content">
          <div className="product-frame-heading">
            <div>
              <span className="frame-kicker">MORNING SHIFT / NORTHSIDE</span>
               <h3>Good morning, team.</h3>
            </div>
            <span className="frame-status"><span className="frame-dot" /> all systems ready</span>
          </div>
          <div className="frame-metrics">
             <div><span>Open repairs</span><strong>08</strong><em className="up">+2 today</em></div>
            <div><span>Ready for pickup</span><strong>04</strong><em>waiting</em></div>
            <div><span>Low stock watch</span><strong>06</strong><em className="warn">check list</em></div>
          </div>
          <div className="frame-lower">
            <div className="frame-panel queue-panel">
              <div className="panel-heading"><span>Counter queue</span><span className="panel-action">view all <ArrowUpRight size={11} /></span></div>
              <div className="queue-row"><span className="queue-icon cyan-icon"><Smartphone size={13} /></span><div><strong>iPhone 13 mini</strong><small>Screen replacement · R-2048</small></div><b className="queue-tag cyan-tag">IN PROGRESS</b></div>
             <div className="queue-row"><span className="queue-icon red-icon"><Receipt size={13} /></span><div><strong>USB-C braided cable</strong><small>Sale · S-8710</small></div><b className="queue-tag neutral-tag">PAID</b></div>
              <div className="queue-row"><span className="queue-icon yellow-icon"><Clock3 size={13} /></span><div><strong>Pixel 7a</strong><small>Ready for pickup · R-2041</small></div><b className="queue-tag yellow-tag">READY</b></div>
            </div>
            <div className="frame-panel mini-panel">
              <div className="panel-heading"><span>Today by type</span><BarChart3 size={14} /></div>
              <div className="bar-chart" aria-hidden="true"><i style={{ height: "44%" }} /><i style={{ height: "65%" }} /><i style={{ height: "51%" }} /><i style={{ height: "78%" }} /><i style={{ height: "61%" }} /><i style={{ height: "90%" }} /><i style={{ height: "73%" }} /></div>
              <div className="chart-legend"><span><i className="legend-cyan" /> sales</span><span><i className="legend-red" /> repairs</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="product-frame-note"><span className="note-line" /> Built for the counter, not the boardroom.</div>
    </div>
  );
}

function CapabilityVisual({ type }: { type: string }) {
  if (type === "sale") {
    return (
      <div className="capability-visual visual-sale" aria-hidden="true">
        <div className="visual-window-bar"><span /><span /><span /></div>
        <div className="sale-search"><ScanLine size={14} /> Search products, repairs, customers <b>⌘ K</b></div>
        <div className="sale-columns"><div><div className="visual-label">CATALOGUE</div><div className="catalog-item selected"><span className="tiny-product cyan-product" /> MagSafe case <b>$29.00</b></div><div className="catalog-item"><span className="tiny-product red-product" /> USB-C cable <b>$18.00</b></div><div className="catalog-item"><span className="tiny-product yellow-product" /> Screen protector <b>$12.00</b></div></div><div className="sale-basket"><div className="visual-label">CURRENT SALE</div><p>MagSafe case <b>$29.00</b></p><p>Screen protector <b>$12.00</b></p><hr /><strong>Total <span>$41.00</span></strong><button type="button">Review sale <ArrowRight size={12} /></button></div></div>
      </div>
    );
  }
  if (type === "repair") {
    return (
      <div className="capability-visual visual-repair" aria-hidden="true">
        <div className="repair-card-top"><span className="repair-id">REPAIR R-2048</span><span className="repair-ready"><span /> IN PROGRESS</span></div>
        <div className="repair-device"><div className="device-speaker" /><div className="device-screen"><Smartphone size={30} /><span>iPhone 13 mini</span></div></div>
         <div className="repair-details"><div><small>ISSUE</small><strong>Screen replacement</strong></div><div><small>OWNER</small><strong>Assigned tech</strong></div><div><small>PART</small><strong>In stock · 01</strong></div></div>
        <div className="repair-track"><span className="done"><Check size={11} /></span><i className="done-line" /><span className="done"><Check size={11} /></span><i /><span className="current">3</span><i /><span>4</span></div>
        <div className="repair-track-labels"><span>Intake</span><span>Diagnose</span><span>Repair</span><span>Pickup</span></div>
      </div>
    );
  }
  return (
    <div className="capability-visual visual-stock" aria-hidden="true">
      <div className="stock-head"><div><span className="visual-label">PRODUCTS / NORTHSIDE</span><strong>Stock watch</strong></div><button type="button"><Download size={13} /> Export</button></div>
      <div className="stock-row stock-row-head"><span>ITEM</span><span>ON HAND</span><span>STATUS</span></div>
      <div className="stock-row"><span><i className="stock-square cyan-square" /> iPhone 14 case</span><b>24</b><em className="stock-good">Healthy</em></div>
      <div className="stock-row"><span><i className="stock-square red-square" /> 20W USB-C adapter</span><b>06</b><em className="stock-low">Reorder soon</em></div>
      <div className="stock-row"><span><i className="stock-square yellow-square" /> Privacy screen · 13</span><b>02</b><em className="stock-low">Low stock</em></div>
      <div className="stock-footer"><span><span className="frame-dot" /> 3 locations synced</span><span>last checked just now</span></div>
    </div>
  );
}

function Welcome() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean | null>(() => {
    try {
      const stored = window.localStorage.getItem(PUBLIC_ANALYTICS_CONSENT_KEY);
      return stored === "granted" ? true : stored === "declined" ? false : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const previousTitle = document.title;
    const previousCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
    const previousSocialValues = new Map<string, string | null>();
    document.title = "Mobilinq — Operations for the modern repair counter";
    const description = document.querySelector('meta[name="description"]') ?? document.head.appendChild(document.createElement("meta"));
    description.setAttribute("name", "description");
    const pageDescription = "Mobilinq brings sales, repairs, inventory and multi-store operations into one practical workspace for phone repair shops and mobile retailers.";
    const previousDescription = description.getAttribute("content");
    description.setAttribute("content", pageDescription);
    const canonical = document.querySelector('link[rel="canonical"]') ?? document.head.appendChild(document.createElement("link"));
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", new URL(`${import.meta.env.BASE_URL.replace(/\/$/, "") || ""}/welcome`, window.location.origin).toString());
    const socialMetadata = [
      ["property", "og:title", "Mobilinq — Operations for the modern repair counter"],
      ["property", "og:description", pageDescription],
      ["property", "og:type", "website"],
      ["property", "og:url", canonical.getAttribute("href") ?? ""],
      ["property", "og:image", new URL(`${import.meta.env.BASE_URL}opengraph.jpg`, window.location.origin).toString()],
      ["property", "og:image:alt", "Mobilinq operations software for phone repair shops"],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:title", "Mobilinq — Operations for the modern repair counter"],
      ["name", "twitter:description", pageDescription],
      ["name", "twitter:image", new URL(`${import.meta.env.BASE_URL}opengraph.jpg`, window.location.origin).toString()],
    ];
    socialMetadata.forEach(([attribute, name, content]) => {
      const meta = document.querySelector(`meta[${attribute}="${name}"]`) ?? document.head.appendChild(document.createElement("meta"));
      previousSocialValues.set(`${attribute}:${name}`, meta.getAttribute("content"));
      meta.setAttribute(attribute, name);
      meta.setAttribute("content", content);
    });
    return () => {
      document.title = previousTitle;
      if (previousDescription) description?.setAttribute("content", previousDescription);
      if (previousCanonical) {
        canonical.setAttribute("href", previousCanonical);
      } else {
        canonical.remove();
      }
      socialMetadata.forEach(([attribute, name]) => {
        const meta = document.querySelector(`meta[${attribute}="${name}"]`);
        const previous = previousSocialValues.get(`${attribute}:${name}`);
        if (meta && previous) meta.setAttribute("content", previous);
        else meta?.remove();
      });
    };
  }, []);

  const closeMobileNav = () => setMobileNavOpen(false);
  const rememberAnalyticsChoice = (choice: "granted" | "declined") => {
    try {
      window.localStorage.setItem(PUBLIC_ANALYTICS_CONSENT_KEY, choice);
    } catch {
      // The page remains fully usable when storage is unavailable.
    }
    setAnalyticsConsent(choice === "granted");
    if (choice === "granted") {
      trackEvent("marketing_analytics_consent", { consent: "granted" });
    }
  };
  const trackWelcomeCta = (target: "workspace" | "contact") => {
    if (analyticsConsent) trackEvent("marketing_cta_click", { target });
  };

  return (
    <main className="welcome-page" data-testid="page-welcome">
      <div className="welcome-grid" aria-hidden="true" />
      <header className="welcome-header">
        <div className="welcome-container header-inner">
          <Link href="/welcome" className="welcome-logo" data-testid="link-brand-home" aria-label="Mobilinq home">
            <img src="/logo.jpg" alt="Mobilinq" />
            <span className="logo-rule" />
            <small>OPERATIONS / 01</small>
          </Link>
          <nav className={`welcome-nav ${mobileNavOpen ? "is-open" : ""}`} data-testid="nav-public">
            <a href="#workflow" data-testid="link-nav-workflow" onClick={closeMobileNav}>Workflow</a>
            <a href="#capabilities" data-testid="link-nav-capabilities" onClick={closeMobileNav}>What it covers</a>
            <a href="#faq" data-testid="link-nav-faq" onClick={closeMobileNav}>FAQ</a>
            <a className="nav-contact" href="#contact" data-testid="link-nav-contact" onClick={closeMobileNav}>Talk to us <ArrowUpRight size={14} /></a>
          </nav>
          <div className="header-actions">
             <Link href="/" className="header-sign-in" onClick={() => trackWelcomeCta("workspace")} data-testid="link-header-sign-in">Open workspace <ArrowRight size={14} /></Link>
            <button className="mobile-menu-button" type="button" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((value) => !value)} data-testid="button-mobile-menu">
              {mobileNavOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      <section className="welcome-hero">
        <div className="welcome-container hero-layout">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow"><span className="eyebrow-mark" /> OPERATIONS FOR PHONE REPAIR &amp; RETAIL</div>
            <h1>Keep the counter<br /><span>moving.</span></h1>
            <p className="hero-lede">Mobilinq gives repair shops and mobile-accessories retailers one precise place for sales, repairs, stock and the work between them.</p>
            <div className="hero-actions">
               <Link href="/" className="button button-primary" onClick={() => trackWelcomeCta("workspace")} data-testid="link-hero-workspace">Open the workspace <ArrowUpRight size={17} /></Link>
               <a href="#contact" className="button button-secondary" onClick={() => trackWelcomeCta("contact")} data-testid="link-hero-contact">See if it fits your counter <ArrowRight size={16} /></a>
            </div>
            <div className="hero-footnote"><span className="footnote-check"><Check size={12} /></span><span>Built around the details that make a good handoff.</span><span className="footnote-divider" /><span>Staff-first. Customer-aware.</span></div>
          </div>
          <div className="hero-visual-wrap">
            <div className="hero-orbit orbit-one" aria-hidden="true" />
            <div className="hero-orbit orbit-two" aria-hidden="true" />
            <div className="hero-signal signal-cyan" aria-hidden="true">01 / LIVE</div>
            <div className="hero-signal signal-red" aria-hidden="true">ON THE BENCH <Wrench size={13} /></div>
            <ProductFrame />
          </div>
        </div>
        <div className="welcome-container hero-bottomline"><span>THE WORKSPACE FOR THE WORK THAT HAPPENS BETWEEN “HELLO” AND “ALL DONE.”</span><span className="scroll-prompt"><span className="scroll-line" /> Scroll to see the flow</span></div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="welcome-container">
          <div className="section-intro workflow-intro"><div><span className="section-index">/ 01 — THE HANDOFF</span><h2>Every job has a shape.<br /><em>Keep yours visible.</em></h2></div><p>From the first description at the counter to the moment a customer walks out, Mobilinq keeps the next step close at hand.</p></div>
          <div className="workflow-rail">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return <article className={`workflow-card accent-${item.accent}`} key={item.number} data-testid={`card-workflow-${index + 1}`}><div className="workflow-card-head"><span>{item.number}</span><Icon size={21} strokeWidth={1.8} /></div><h3>{item.title}</h3><p>{item.body}</p>{index < workflow.length - 1 && <ArrowRight className="workflow-arrow" size={17} aria-hidden="true" />}</article>;
            })}
          </div>
        </div>
      </section>

      <section className="capabilities-section" id="capabilities">
        <div className="welcome-container">
          <div className="section-intro capabilities-intro"><div><span className="section-index">/ 02 — ONE COUNTER, ONE CONTEXT</span><h2>Less hunting.<br /><em>More doing.</em></h2></div><p>Mobilinq is intentionally shaped around the rhythm of a real shop: quick questions, physical handoffs, small decisions and work that cannot get lost.</p></div>
          <div className="capability-stack">
            {capabilityGroups.map((group, index) => {
              const Icon = group.icon;
              return <article className={`capability-row capability-${group.visual}`} key={group.title} data-testid={`card-capability-${group.visual}`}><div className="capability-copy"><div className="capability-heading"><span className={`capability-icon icon-${group.visual}`}><Icon size={18} /></span><span className="section-index">{group.eyebrow}</span></div><h3>{group.title}</h3><p>{group.body}</p><ul>{group.items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></div><CapabilityVisual type={group.visual} /><span className="capability-index">0{index + 1}</span></article>;
            })}
          </div>
        </div>
      </section>

      <section className="benefits-section">
        <div className="welcome-container">
          <div className="benefits-top"><span className="section-index">/ 03 — THE WIDER VIEW</span><h2>Built for the shop<br /><em>you are running.</em></h2><p>Not a generic back office. A calm, accountable layer for the busy parts of your business.</p></div>
          <div className="benefit-grid">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return <article className={`benefit-card benefit-${benefit.color}`} key={benefit.title} data-testid={`card-benefit-${index + 1}`}><div className="benefit-number">0{index + 1}</div><Icon className="benefit-icon" size={24} strokeWidth={1.7} /><h3>{benefit.title}</h3><p>{benefit.body}</p><span className="benefit-tick"><Check size={13} /></span></article>;
            })}
          </div>
          <div className="privacy-callout"><div className="privacy-signal"><LockKeyhole size={19} /><span>QUIETLY SERIOUS</span></div><div><h3>The right people see the right work.</h3><p>Roles, customer access boundaries and audit-friendly workflows help your team move quickly without treating privacy as an afterthought.</p></div><ArrowUpRight size={20} /></div>
        </div>
      </section>

      <section className="clarity-section">
        <div className="welcome-container clarity-layout">
          <div className="clarity-copy"><span className="section-index">/ 04 — OPERATOR NOTES</span><h2>Good systems feel<br /><em>like good habits.</em></h2><p>Mobilinq brings structure to the parts of the day your team already knows how to do: open the shop, receive the device, find the part, close the sale, make the handoff.</p><div className="clarity-list"><div><span>01</span><strong>Visible</strong><p>The state of a job is not hidden in someone’s memory.</p></div><div><span>02</span><strong>Practical</strong><p>The information is arranged for a person standing at the counter.</p></div><div><span>03</span><strong>Accountable</strong><p>Important changes leave a record your team can understand.</p></div></div></div>
          <div className="clarity-poster"><div className="poster-top"><span>FIELD NOTE / 001</span><span>MLQ—OPS</span></div><div className="poster-mark"><span className="poster-ring" /><span className="poster-cross" /><span className="poster-word">MOBILINQ</span></div><p>Make the next<br /><strong>right move.</strong></p><div className="poster-bottom"><span>SALES</span><span>REPAIRS</span><span>STOCK</span><span>PEOPLE</span></div></div>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="welcome-container faq-layout">
          <div className="faq-heading"><span className="section-index">/ 05 — GOOD QUESTIONS</span><h2>Before you put<br /><em>it to work.</em></h2><p>Short answers for operators who want to understand the shape of the tool before they open it.</p><a href="#contact" data-testid="link-faq-contact">Still have a question? Talk to us <ArrowUpRight size={14} /></a></div>
          <div className="faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return <div className={`faq-item ${isOpen ? "is-open" : ""}`} key={faq.question}><button type="button" className="faq-question" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? null : index)} data-testid={`button-faq-${index + 1}`}><span><small>0{index + 1}</small>{faq.question}</span><ChevronDown size={18} /></button>{isOpen && <div className="faq-answer" data-testid={`text-faq-answer-${index + 1}`}><p>{faq.answer}</p></div>}</div>;
            })}
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="welcome-container contact-card">
          <div className="contact-copy"><span className="section-index">/ READY WHEN YOU ARE</span><h2>Make the next<br /><em>right move.</em></h2><p>Open the workspace to see the product language in motion, or start a direct conversation without filling out a lead form.</p></div>
           <div className="contact-actions"><Link href="/" className="button button-primary button-large" onClick={() => trackWelcomeCta("workspace")} data-testid="link-final-workspace">Open Mobilinq <ArrowUpRight size={17} /></Link><a className="contact-mail" href="mailto:hello@mobilinq.com?subject=Mobilinq%20for%20my%20shop" onClick={() => trackWelcomeCta("contact")} data-testid="link-contact-email">Email the Mobilinq team <ArrowRight size={15} /></a><span className="contact-note">No long form. No sales theatre.</span></div>
        </div>
      </section>

      <footer className="welcome-footer">
         <div className="welcome-container footer-main"><Link href="/welcome" className="footer-logo" data-testid="link-footer-brand"><img src="/logo.jpg" alt="Mobilinq" /></Link><div className="footer-nav"><div><span className="footer-label">EXPLORE</span><a href="#workflow" data-testid="link-footer-workflow">Workflow</a><a href="#capabilities" data-testid="link-footer-capabilities">Capabilities</a><a href="#faq" data-testid="link-footer-faq">FAQ</a></div><div><span className="footer-label">OPEN</span><Link href="/" onClick={() => trackWelcomeCta("workspace")} data-testid="link-footer-workspace">Workspace <ArrowUpRight size={13} /></Link><a href="#contact" onClick={() => trackWelcomeCta("contact")} data-testid="link-footer-contact">Contact <ArrowUpRight size={13} /></a><a href="#privacy-note" data-testid="link-footer-privacy">Privacy note</a><a href="#terms-note" data-testid="link-footer-terms">Terms placeholder</a></div></div><div className="footer-stamp"><span>OPS / 01</span><strong>Practical software<br />for physical work.</strong></div></div>
         <div className="welcome-container footer-legal-notes"><p id="privacy-note"><strong>Privacy note.</strong> This page does not send customer or employee information to third-party analytics. Anonymous page events are only enabled after you choose analytics.</p><p id="terms-note"><strong>Terms placeholder.</strong> Workspace access and use are subject to your team’s setup and policies.</p></div>
         <div className="welcome-container footer-bottom"><span>© {new Date().getFullYear()} Mobilinq</span><span>Sales · Repairs · Inventory · Operations</span><span>Made for the people behind the counter.</span></div>
      </footer>
       {analyticsConsent === null && <aside className="analytics-consent" aria-label="Analytics preferences" data-testid="banner-analytics-consent"><div><strong>Choose your analytics preference</strong><p>Mobilinq does not run third-party analytics on this page unless you allow anonymous usage events. No customer or employee details are included.</p></div><div className="analytics-consent-actions"><button type="button" className="consent-button consent-allow" onClick={() => rememberAnalyticsChoice("granted")} data-testid="button-allow-analytics">Allow anonymous analytics</button><button type="button" className="consent-button consent-decline" onClick={() => rememberAnalyticsChoice("declined")} data-testid="button-decline-analytics">Continue without analytics</button></div></aside>}
    </main>
  );
}

export default Welcome;