import React from "react";

export type CreditNoteDocumentLine = {
  description: string;
  amount: string;
};

export type CreditNoteDocumentData = {
  org: {
    displayName: string;
    legalName: string;
    addressLines: string[];
    email: string | null;
    businessNumber: string | null;
    hstNumber: string | null;
    logoDataUri: string | null;
  };
  client: {
    name: string;
    addressLines: string[];
    email: string | null;
  };
  creditNote: {
    number: string;
    date: string;
    originalInvoiceNumber: string | null;
    reason: string;
    currency: string;
    notes: string | null;
  };
  lines: CreditNoteDocumentLine[];
  totals: {
    subtotal: string;
    taxTotal: string | null;
    total: string;
  };
};

function money(value: string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));
}

export function CreditNoteDocument({ data }: { data: CreditNoteDocumentData }) {
  const { org, client, creditNote: cn, lines, totals } = data;
  const cur = cn.currency;

  return (
    <html>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11px; color: #10162B; line-height: 1.5; padding: 48px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .logo { height: 48px; }
          .title { font-size: 22px; font-weight: 700; color: #1B3BE8; letter-spacing: -0.5px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
          .meta-block p { margin: 2px 0; }
          .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; font-weight: 600; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; font-weight: 600; padding: 8px 12px; border-bottom: 2px solid #E2E4ED; }
          th.right { text-align: right; }
          td { padding: 10px 12px; border-bottom: 1px solid #F0F0F4; font-size: 11px; }
          td.right { text-align: right; font-variant-numeric: tabular-nums; }
          .totals { width: 260px; margin-left: auto; }
          .totals tr td { border: none; padding: 4px 12px; }
          .totals .grand td { font-size: 14px; font-weight: 700; border-top: 2px solid #10162B; padding-top: 8px; }
          .reason { background: #F8F9FB; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
          .reason .label { margin-bottom: 2px; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E4ED; font-size: 10px; color: #6B7280; }
        `}} />
      </head>
      <body>
        <div className="header">
          <div>
            {org.logoDataUri ? <img src={org.logoDataUri} className="logo" /> : null}
            <div className="title" style={{ marginTop: org.logoDataUri ? 8 : 0 }}>Credit Note</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{org.displayName}</div>
            {org.addressLines.map((line, i) => <p key={i}>{line}</p>)}
            {org.email ? <p>{org.email}</p> : null}
            {org.businessNumber ? <p>BN: {org.businessNumber}</p> : null}
            {org.hstNumber ? <p>HST: {org.hstNumber}</p> : null}
          </div>
        </div>

        <div className="meta">
          <div className="meta-block">
            <div className="label">Issued to</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{client.name}</div>
            {client.addressLines.map((line, i) => <p key={i}>{line}</p>)}
            {client.email ? <p>{client.email}</p> : null}
          </div>
          <div className="meta-block" style={{ textAlign: "right" }}>
            <div className="label">Credit note</div>
            <p style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{cn.number}</p>
            <p>Date: {cn.date}</p>
            {cn.originalInvoiceNumber ? <p>Credits: {cn.originalInvoiceNumber}</p> : null}
          </div>
        </div>

        <div className="reason">
          <div className="label">Reason</div>
          <p>{cn.reason}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td>{line.description}</td>
                <td className="right">{money(line.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="totals">
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td className="right">{money(totals.subtotal, cur)}</td>
            </tr>
            {totals.taxTotal ? (
              <tr>
                <td>Tax</td>
                <td className="right">{money(totals.taxTotal, cur)}</td>
              </tr>
            ) : null}
            <tr className="grand">
              <td>Total credit</td>
              <td className="right">{money(totals.total, cur)}</td>
            </tr>
          </tbody>
        </table>

        {cn.notes ? (
          <div className="reason">
            <div className="label">Notes</div>
            <p>{cn.notes}</p>
          </div>
        ) : null}

        <div className="footer">
          <p>{org.legalName}</p>
        </div>
      </body>
    </html>
  );
}
