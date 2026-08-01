import React from "react";

export type InvoiceDocumentLine = {
  description: string;
  quantity: string | null;
  unitRate: string | null;
  amount: string;
  projectCode: string | null;
};

export type InvoiceDocumentData = {
  org: {
    displayName: string;
    legalName: string;
    addressLines: string[];
    email: string | null;
    businessNumber: string | null;
    hstNumber: string | null;
    paymentInstructions: string | null;
    invoiceFooter: string | null;
    logoDataUri: string | null;
  };
  client: {
    name: string;
    addressLines: string[];
    phone: string | null;
    email: string | null;
  };
  invoice: {
    number: string;
    date: string;
    dueDate: string;
    currency: string;
    clientReference: string | null;
    servicePeriod: string | null;
    projectName: string | null;
    termsLine: string | null;
    notes: string | null;
  };
  lines: InvoiceDocumentLine[];
  showProjectColumn: boolean;
  showQuantityColumns: boolean;
  totals: {
    subtotal: string;
    taxLabel: string | null;
    taxTotal: string | null;
    total: string;
  };
};

const CSS = `
@page { size: A4; margin: 12mm 15mm 15mm 15mm; }
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 10pt; line-height: 1.5; color: #2d3748; margin: 0; padding: 0; background: #fff;
}
.invoice-container { max-width: 800px; margin: 0 auto; padding: 20px; }
.header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
.header-table td { vertical-align: top; padding: 0; }
.logo-container { width: 120px; }
.logo-img { width: 110px; height: auto; display: block; }
.company-details { padding-left: 15px; }
.company-name { font-size: 17pt; font-weight: 700; color: #1e3a8a; margin: 0 0 4px 0; letter-spacing: -0.3px; }
.company-info { font-size: 9pt; color: #475569; line-height: 1.4; }
.invoice-title-cell { text-align: right; }
.invoice-title { font-size: 24pt; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; }
.invoice-meta-table { margin-left: auto; border-collapse: collapse; font-size: 9pt; }
.invoice-meta-table td { padding: 3px 8px; }
.meta-label { font-weight: 600; color: #64748b; text-align: right; }
.meta-value { font-weight: 700; color: #0f172a; text-align: right; }
.accent-bar { height: 3px; background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%); border-radius: 2px; margin-bottom: 25px; }
.info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
.info-table td { width: 50%; vertical-align: top; padding: 0; }
.info-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; margin-right: 10px; min-height: 110px; }
.info-block.right-block { margin-right: 0; margin-left: 10px; }
.block-heading { font-size: 9pt; font-weight: 700; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
.client-name { font-size: 11pt; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
.info-text { font-size: 9pt; color: #334155; line-height: 1.45; }
.project-details-grid { font-size: 9pt; width: 100%; border-collapse: collapse; }
.project-details-grid td { padding: 2px 0; }
.p-label { color: #64748b; font-weight: 600; width: 45%; }
.p-value { color: #0f172a; font-weight: 600; width: 55%; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.items-table th { background: #1e3a8a; color: #fff; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; text-align: left; }
.items-table th.num-col { text-align: right; }
.items-table th.center-col { text-align: center; }
.items-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 9.5pt; color: #334155; vertical-align: top; }
.items-table tbody tr:nth-child(even) { background: #f8fafc; }
.item-description { font-weight: 500; color: #0f172a; }
.num-col { text-align: right; font-variant-numeric: tabular-nums; }
.center-col { text-align: center; }
.summary-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
.summary-table td { vertical-align: top; }
.notes-cell { width: 55%; padding-right: 20px; }
.totals-cell { width: 45%; }
.totals-table { width: 100%; border-collapse: collapse; }
.totals-table td { padding: 6px 12px; font-size: 9.5pt; }
.totals-label { text-align: right; color: #475569; font-weight: 600; }
.totals-value { text-align: right; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; width: 120px; }
.grand-total-row td { background: #1e3a8a; color: #fff; font-size: 11pt; font-weight: 700; padding: 10px 12px; }
.grand-total-row .totals-label, .grand-total-row .totals-value { color: #fff; }
.payment-box { background: #f1f5f9; border-left: 4px solid #1e3a8a; padding: 12px 15px; border-radius: 0 6px 6px 0; font-size: 8.5pt; }
.payment-title { font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-size: 9pt; }
.payment-text { color: #334155; line-height: 1.5; white-space: pre-line; }
.notes-block { margin-top: 12px; font-size: 8.5pt; color: #475569; white-space: pre-line; }
.footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8pt; color: #64748b; }
`;

export function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const { org, client, invoice, lines, totals, showProjectColumn, showQuantityColumns } = data;

  const descriptionWidth = showProjectColumn
    ? showQuantityColumns
      ? "38%"
      : "62%"
    : showQuantityColumns
      ? "50%"
      : "80%";

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>{`Invoice ${invoice.number} - ${org.displayName}`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div className="invoice-container">
          <table className="header-table">
            <tbody>
              <tr>
                {org.logoDataUri ? (
                  <td className="logo-container">
                    <img src={org.logoDataUri} alt="" className="logo-img" />
                  </td>
                ) : null}
                <td className="company-details">
                  <h1 className="company-name">{org.displayName}</h1>
                  <div className="company-info">
                    {org.displayName !== org.legalName ? (
                      <React.Fragment>
                        {org.legalName}
                        <br />
                      </React.Fragment>
                    ) : null}
                    {org.addressLines.map((line) => (
                      <React.Fragment key={line}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))}
                    {org.email ? (
                      <React.Fragment>
                        {org.email}
                        <br />
                      </React.Fragment>
                    ) : null}
                    {org.businessNumber ? (
                      <React.Fragment>
                        {`Business No: ${org.businessNumber}`}
                        <br />
                      </React.Fragment>
                    ) : null}
                    {org.hstNumber ? `HST Registration No: ${org.hstNumber}` : null}
                  </div>
                </td>
                <td className="invoice-title-cell">
                  <div className="invoice-title">Invoice</div>
                  <table className="invoice-meta-table">
                    <tbody>
                      <tr>
                        <td className="meta-label">Invoice No:</td>
                        <td className="meta-value">{invoice.number}</td>
                      </tr>
                      <tr>
                        <td className="meta-label">Invoice Date:</td>
                        <td className="meta-value">{invoice.date}</td>
                      </tr>
                      <tr>
                        <td className="meta-label">Due Date:</td>
                        <td className="meta-value">{invoice.dueDate}</td>
                      </tr>
                      <tr>
                        <td className="meta-label">Currency:</td>
                        <td className="meta-value">{invoice.currency}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="accent-bar" />

          <table className="info-table">
            <tbody>
              <tr>
                <td>
                  <div className="info-block">
                    <div className="block-heading">Billed To</div>
                    <div className="client-name">{client.name}</div>
                    <div className="info-text">
                      {client.addressLines.map((line) => (
                        <React.Fragment key={line}>
                          {line}
                          <br />
                        </React.Fragment>
                      ))}
                      {client.phone ? (
                        <React.Fragment>
                          {`Phone: ${client.phone}`}
                          <br />
                        </React.Fragment>
                      ) : null}
                      {client.email ? `Email: ${client.email}` : null}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="info-block right-block">
                    <div className="block-heading">Project &amp; Reference</div>
                    <table className="project-details-grid">
                      <tbody>
                        {invoice.projectName ? (
                          <tr>
                            <td className="p-label">Project:</td>
                            <td className="p-value">{invoice.projectName}</td>
                          </tr>
                        ) : null}
                        {invoice.servicePeriod ? (
                          <tr>
                            <td className="p-label">Period Executed:</td>
                            <td className="p-value">{invoice.servicePeriod}</td>
                          </tr>
                        ) : null}
                        {invoice.clientReference ? (
                          <tr>
                            <td className="p-label">PO / Reference:</td>
                            <td className="p-value">{invoice.clientReference}</td>
                          </tr>
                        ) : null}
                        {invoice.termsLine ? (
                          <tr>
                            <td className="p-label">Terms:</td>
                            <td className="p-value">{invoice.termsLine}</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: descriptionWidth }}>Description</th>
                {showProjectColumn ? <th style={{ width: "16%" }}>Project</th> : null}
                {showQuantityColumns ? (
                  <React.Fragment>
                    <th className="center-col" style={{ width: "10%" }}>
                      Qty / Hrs
                    </th>
                    <th className="num-col" style={{ width: "16%" }}>
                      Unit Rate
                    </th>
                  </React.Fragment>
                ) : null}
                <th className="num-col" style={{ width: "20%" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td className="item-description">{line.description}</td>
                  {showProjectColumn ? <td>{line.projectCode ?? ""}</td> : null}
                  {showQuantityColumns ? (
                    <React.Fragment>
                      <td className="center-col">{line.quantity ?? ""}</td>
                      <td className="num-col">{line.unitRate ?? ""}</td>
                    </React.Fragment>
                  ) : null}
                  <td className="num-col">{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="summary-table">
            <tbody>
              <tr>
                <td className="notes-cell">
                  {org.paymentInstructions ? (
                    <div className="payment-box">
                      <div className="payment-title">Payment Instructions</div>
                      <div className="payment-text">{org.paymentInstructions}</div>
                    </div>
                  ) : null}
                  {invoice.notes ? <div className="notes-block">{invoice.notes}</div> : null}
                </td>
                <td className="totals-cell">
                  <table className="totals-table">
                    <tbody>
                      <tr>
                        <td className="totals-label">Subtotal:</td>
                        <td className="totals-value">{totals.subtotal}</td>
                      </tr>
                      {totals.taxLabel && totals.taxTotal ? (
                        <tr>
                          <td className="totals-label">{totals.taxLabel}</td>
                          <td className="totals-value">{totals.taxTotal}</td>
                        </tr>
                      ) : null}
                      <tr className="grand-total-row">
                        <td className="totals-label">{`Total Due (${invoice.currency}):`}</td>
                        <td className="totals-value">{totals.total}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="footer">
            {org.invoiceFooter ?? `Thank you for your business. ${org.displayName}`}
          </div>
        </div>
      </body>
    </html>
  );
}
