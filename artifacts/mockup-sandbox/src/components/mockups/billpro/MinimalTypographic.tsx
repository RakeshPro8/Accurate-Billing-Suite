export function MinimalTypographic() {
  const tabs = ["Dashboard", "Sales", "Quotations", "Customers", "Products & Services", "Reports", "Settings"];

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f9", fontFamily: "'Inter', system-ui, sans-serif", color: "#111" }}>
      {/* Top nav — no sidebar */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", color: "#111" }}>
            Bill<span style={{ color: "#4f46e5" }}>Pro</span>
          </div>
          <nav style={{ display: "flex", gap: 0 }}>
            {tabs.map(tab => (
              <div key={tab} style={{
                padding: "0 14px",
                height: 56,
                display: "flex",
                alignItems: "center",
                fontSize: 13,
                fontWeight: tab === "Settings" ? 600 : 400,
                color: tab === "Settings" ? "#111" : "#888",
                borderBottom: tab === "Settings" ? "2px solid #111" : "2px solid transparent",
                cursor: "pointer",
                letterSpacing: tab === "Settings" ? "-0.01em" : "0",
              }}>{tab}</div>
            ))}
          </nav>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#fff" }}>A</div>
      </header>

      {/* Page */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
        {/* Page title */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", margin: 0, color: "#111" }}>Settings</h1>
          <p style={{ color: "#888", fontSize: 14, marginTop: 6 }}>Configure your business profile and billing preferences</p>
        </div>

        {/* Logo */}
        <Section title="Business Logo" n="01">
          <p style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>Logo appears on invoices, quotations, and printed receipts. PNG or JPG under 500 KB recommended.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 88, height: 72, border: "1px solid #e5e5e5", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#ccc", gap: 4, background: "#fafafa" }}>
              <span style={{ fontSize: 20 }}>⊡</span>
              <span style={{ fontSize: 10 }}>No logo</span>
            </div>
            <div>
              <button style={{ padding: "8px 18px", background: "#111", border: "none", color: "#fff", borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em" }}>Upload Logo</button>
              <p style={{ fontSize: 11, color: "#bbb", marginTop: 7 }}>PNG, JPG, SVG · max 500 KB</p>
            </div>
          </div>
        </Section>

        <Divider />

        {/* Business Info */}
        <Section title="Business Information" n="02">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <MinField label="Business Name" value="PhoneFix Pro" full />
            <MinField label="Address" value="123 Tech Street, Silicon City, CA 94105" full isTextarea />
            <MinField label="Phone" value="+1 (555) 123-4567" />
            <MinField label="Email" value="billing@phonefixpro.com" />
          </div>
        </Section>

        <Divider />

        {/* Billing */}
        <Section title="Billing Settings" n="03">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <MinField label="Currency" value="USD" />
            <MinField label="Default Tax Rate (%)" value="8.25" />
            <MinField label="GST Rate (%)" value="5.000" hint="e.g. 5 for Canada federal" />
            <MinField label="QST Rate (%)" value="9.9750" hint="e.g. 9.975 for Quebec" />
            <MinField label="Invoice Prefix" value="INV-" />
            <MinField label="Quote Prefix" value="QUO-" />
            <MinField label="Invoice Footer Text" value="Thank you for your business!" full isTextarea />
            <MinField label="Thank You Message" value="We appreciate your business!" full />
          </div>
        </Section>

        <Divider />

        {/* SMTP */}
        <Section title="Email (SMTP)" n="04">
          <p style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>Configure your SMTP server to send invoices by email.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <MinField label="SMTP Host" value="smtp.gmail.com" />
            <MinField label="SMTP Port" value="587" />
            <MinField label="Username" value="user@gmail.com" />
            <MinField label="Password" value="••••••••" />
          </div>
        </Section>

        <div style={{ marginTop: 40 }}>
          <button style={{ padding: "12px 28px", background: "#111", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", letterSpacing: "-0.01em" }}>
            Save Settings
          </button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, n, children }: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 32, padding: "32px 0" }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#ccc", marginBottom: 6 }}>{n}</div>
        <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: "#111" }}>{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#e5e5e5" }} />;
}

function MinField({ label, value, hint, full = false, isTextarea = false }: any) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, letterSpacing: "-0.01em" }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: "#bbb", marginBottom: 4, marginTop: -2 }}>{hint}</p>}
      {isTextarea ? (
        <textarea defaultValue={value} rows={2} style={{ width: "100%", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 5, padding: "9px 12px", color: "#333", fontSize: 13.5, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
      ) : (
        <input defaultValue={value} style={{ width: "100%", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 5, padding: "9px 12px", color: "#333", fontSize: 13.5, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
      )}
    </div>
  );
}
