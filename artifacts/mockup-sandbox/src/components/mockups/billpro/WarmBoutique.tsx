export function WarmBoutique() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf6f0", fontFamily: "'Georgia', 'Times New Roman', serif", color: "#2c1810" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#1e0f08", display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "0 22px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#d97706", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "Georgia, serif" }}>B</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#fef3c7", fontFamily: "Georgia, serif", letterSpacing: "0.01em" }}>BillPro</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "20px 0", flex: 1 }}>
          {[
            { icon: "◻", label: "Dashboard" },
            { icon: "◈", label: "Sales" },
            { icon: "◻", label: "Quotations" },
            { icon: "◎", label: "Customers" },
            { icon: "◈", label: "Products & Services" },
            { icon: "↗", label: "Reports" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", color: "#92694e", fontSize: 13.5, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
              <span style={{ fontSize: 12 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", color: "#fef3c7", fontSize: 13.5, background: "rgba(217,119,6,0.2)", borderLeft: "3px solid #d97706", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            <span style={{ fontSize: 12 }}>⚙</span>
            <span style={{ fontWeight: 600 }}>Settings</span>
          </div>
        </nav>

        <div style={{ padding: "16px 22px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>A</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#2c1810", margin: 0, fontFamily: "Georgia, serif" }}>Settings</h1>
          <p style={{ color: "#92694e", fontSize: 13.5, marginTop: 5, fontFamily: "system-ui, sans-serif" }}>Configure your business profile and billing preferences</p>
        </div>

        {/* Logo Card */}
        <WarmCard title="Business Logo" icon="⊡">
          <p style={{ fontSize: 13, color: "#92694e", marginBottom: 16, fontFamily: "system-ui, sans-serif" }}>Logo appears on invoices, quotations, and printed receipts. PNG or JPG under 500 KB recommended.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 96, height: 80, border: "2px dashed #d9c4b0", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#c4a882", gap: 6, background: "#fff" }}>
              <span style={{ fontSize: 22 }}>⊡</span>
              <span style={{ fontSize: 10, fontFamily: "system-ui, sans-serif" }}>No logo</span>
            </div>
            <div>
              <button style={{ padding: "9px 18px", background: "#d97706", border: "none", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>↑ Upload Logo</button>
              <p style={{ fontSize: 11, color: "#c4a882", marginTop: 7, fontFamily: "system-ui, sans-serif" }}>PNG, JPG, SVG · max 500 KB</p>
            </div>
          </div>
        </WarmCard>

        {/* Business Info */}
        <WarmCard title="Business Information" icon="⊞">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WarmField label="Business Name" value="PhoneFix Pro" full />
            <WarmField label="Address" value="123 Tech Street, Silicon City, CA 94105" full isTextarea />
            <WarmField label="Phone" value="+1 (555) 123-4567" />
            <WarmField label="Email" value="billing@phonefixpro.com" />
          </div>
        </WarmCard>

        {/* Billing */}
        <WarmCard title="Billing Settings" icon="◈">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WarmField label="Currency" value="USD" />
            <WarmField label="Default Tax Rate (%)" value="8.25" />
            <WarmField label="GST Rate (%)" value="5.000" hint="e.g. 5 for Canada federal" />
            <WarmField label="QST Rate (%)" value="9.9750" hint="e.g. 9.975 for Quebec" />
            <WarmField label="Invoice Prefix" value="INV-" />
            <WarmField label="Quote Prefix" value="QUO-" />
            <WarmField label="Invoice Footer Text" value="Thank you for your business!" full isTextarea />
            <WarmField label="Thank You Message (shown on receipts)" value="We appreciate your business!" full />
          </div>
        </WarmCard>

        <button style={{ padding: "12px 32px", background: "#d97706", border: "none", borderRadius: 9, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "system-ui, sans-serif", boxShadow: "0 4px 14px rgba(217,119,6,0.35)" }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

function WarmCard({ title, icon, children }: any) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8d9c8", borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: "0 2px 12px rgba(44,24,16,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #f0e4d4" }}>
        <span style={{ fontSize: 15, color: "#d97706" }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#2c1810", fontFamily: "Georgia, serif" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function WarmField({ label, value, hint, full = false, isTextarea = false }: any) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#5c3d2e", marginBottom: 6, fontFamily: "system-ui, sans-serif" }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: "#c4a882", marginBottom: 4, marginTop: -2, fontFamily: "system-ui, sans-serif" }}>{hint}</p>}
      {isTextarea ? (
        <textarea defaultValue={value} rows={2} style={{ width: "100%", background: "#fdf9f5", border: "1.5px solid #e8d9c8", borderRadius: 8, padding: "10px 13px", color: "#5c3d2e", fontSize: 13.5, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "system-ui, sans-serif" }} />
      ) : (
        <input defaultValue={value} style={{ width: "100%", background: "#fdf9f5", border: "1.5px solid #e8d9c8", borderRadius: 8, padding: "10px 13px", color: "#5c3d2e", fontSize: 13.5, boxSizing: "border-box", outline: "none", fontFamily: "system-ui, sans-serif" }} />
      )}
    </div>
  );
}
