export function DarkTerminal() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080810", fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#05050d", borderRight: "1px solid #1a1a2e", display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #00e5c8, #0066ff)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#000" }}>B</div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.02em", color: "#fff" }}>BillPro</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "16px 0", flex: 1 }}>
          {[
            { icon: "⊞", label: "Dashboard" },
            { icon: "≡", label: "Sales" },
            { icon: "◻", label: "Quotations" },
            { icon: "⊙", label: "Customers" },
            { icon: "◈", label: "Products & Services" },
            { icon: "↗", label: "Reports" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", color: "#64748b", fontSize: 13.5, cursor: "pointer" }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", color: "#00e5c8", fontSize: 13.5, background: "rgba(0,229,200,0.07)", borderLeft: "2px solid #00e5c8", cursor: "pointer" }}>
            <span style={{ fontSize: 14 }}>⚙</span>
            <span style={{ fontWeight: 600 }}>Settings</span>
          </div>
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a2e" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#00e5c8" }}>A</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Settings</h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Configure your business profile and billing preferences</p>
        </div>

        {/* Logo Card */}
        <Card title="Business Logo" icon="⊡">
          <p style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>Logo appears on invoices, quotations, and printed receipts.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 88, height: 72, border: "1px dashed #1e293b", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#334155", gap: 4 }}>
              <span style={{ fontSize: 20 }}>⊡</span>
              <span style={{ fontSize: 10 }}>No logo</span>
            </div>
            <div>
              <button style={{ padding: "8px 16px", background: "transparent", border: "1px solid #00e5c8", color: "#00e5c8", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}>↑ UPLOAD LOGO</button>
              <p style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>PNG, JPG, SVG · max 500 KB</p>
            </div>
          </div>
        </Card>

        {/* Business Info */}
        <Card title="Business Information" icon="⊞">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="BUSINESS NAME" value="PhoneFix Pro" full />
            <Field label="ADDRESS" value="123 Tech Street, Silicon City, CA 94105" full isTextarea />
            <Field label="PHONE" value="+1 (555) 123-4567" />
            <Field label="EMAIL" value="billing@phonefixpro.com" />
          </div>
        </Card>

        {/* Billing */}
        <Card title="Billing Settings" icon="◈">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="CURRENCY" value="USD" />
            <Field label="DEFAULT TAX RATE (%)" value="8.25" />
            <Field label="GST RATE (%)" value="5.000" hint="e.g. 5 for Canada federal" />
            <Field label="QST RATE (%)" value="9.9750" hint="e.g. 9.975 for Quebec" />
            <Field label="INVOICE PREFIX" value="INV-" />
            <Field label="QUOTE PREFIX" value="QUO-" />
            <Field label="INVOICE FOOTER TEXT" value="Thank you for your business!" full isTextarea />
            <Field label="THANK YOU MESSAGE" value="We appreciate your business!" full />
          </div>
        </Card>

        <button style={{ padding: "11px 28px", background: "linear-gradient(90deg, #00e5c8, #0066ff)", border: "none", borderRadius: 7, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: "0.05em" }}>
          ✓ SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: any) {
  return (
    <div style={{ background: "#0e0e1a", border: "1px solid #1a1a2e", borderRadius: 10, padding: 22, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #1a1a2e" }}>
        <span style={{ fontSize: 15, color: "#00e5c8" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 13.5, color: "#cbd5e1", letterSpacing: "0.03em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, hint, full = false, isTextarea = false }: any) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#334155", marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 10, color: "#1e3a5f", marginBottom: 5, marginTop: -2 }}>{hint}</p>}
      {isTextarea ? (
        <textarea defaultValue={value} rows={2} style={{ width: "100%", background: "#080810", border: "1px solid #1a1a2e", borderRadius: 6, padding: "9px 12px", color: "#94a3b8", fontSize: 13, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
      ) : (
        <input defaultValue={value} style={{ width: "100%", background: "#080810", border: "1px solid #1a1a2e", borderRadius: 6, padding: "9px 12px", color: "#94a3b8", fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
      )}
    </div>
  );
}
