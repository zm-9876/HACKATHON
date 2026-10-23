import { date, money, requestLabels } from "./constants";

export function Panel({ eyebrow, title, children, action }) {
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>{children}</section>;
}

export function Metric({ label, value, note, tone = "blue" }) {
  return <article className={`metric-card metric-card--${tone}`}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Empty({ text }) {
  return <p className="empty-state">{text}</p>;
}

export function Status({ value }) {
  const label = value === "manager-review" ? "Manager review" : value;
  return <span className={`status status--${value}`}>{label}</span>;
}

export function RequestTable({ requests, role, onProcess, hideAmounts = false }) {
  if (!requests.length) return <Empty text="No requests to show right now." />;
  return <div className="data-list">{[...requests].sort((a, b) => b.createdAt - a.createdAt).map((item) => {
    const canProcess = role !== "customer" && (role === "manager" || item.status === "pending");
    const highValue = role === "employee" && item.amount > 1000000;
    const symbol = item.type === "deposit" || item.type === "loan" ? "↑" : item.type === "withdrawal" ? "↓" : "•";
    return <article className="request-row" key={item.id}><span className={`request-symbol request-symbol--${item.type}`}>{symbol}</span><div className="request-main"><strong>{requestLabels[item.type]}</strong><span>{item.customerName || "You"} · {date.format(new Date(item.createdAt))}</span>{item.purpose && <small>{item.purpose}{item.duration ? ` · ${item.duration} months` : ""}</small>}{item.note && <small>{item.note}</small>}</div>{!hideAmounts && <div className="request-value">{money.format(item.amount)}</div>}<Status value={item.status} />{canProcess && <div className="request-actions"><button className="approve" onClick={() => onProcess(item, "approved")}>{highValue ? "Forward" : "Approve"}</button><button className="reject" onClick={() => onProcess(item, "rejected")}>Reject</button></div>}</article>;
  })}</div>;
}

export function TransactionTable({ transactions, hideAmounts = false }) {
  if (!transactions.length) return <Empty text="Approved transactions will appear here." />;
  return <div className="data-list">{[...transactions].sort((a, b) => b.processedAt - a.processedAt).map((item) => <article className="request-row" key={item.id}><span className={`request-symbol request-symbol--${item.type}`}>{["deposit", "loan"].includes(item.type) ? "↑" : "↓"}</span><div className="request-main"><strong>{requestLabels[item.type] || item.type}</strong><span>{item.customerName ? `${item.customerName} · ` : ""}{date.format(new Date(item.processedAt))} · Approved banking activity</span></div>{!hideAmounts && <div className="request-value">{money.format(item.amount)}</div>}<Status value={item.status || "approved"} /></article>)}</div>;
}

export function NotificationsPanel({ notifications }) {
  return <Panel eyebrow="Secure updates" title="Notifications"><div className="data-list">{notifications.length ? notifications.map((item) => <article className="request-row" key={item.id}><span className="request-symbol">{item.type === "large-transaction" ? "!" : "•"}</span><div className="request-main"><strong>{item.title}</strong><span>{item.message}</span><small>{date.format(new Date(item.createdAt))}</small></div><Status value={item.type === "large-transaction" ? "manager-review" : "approved"} /></article>) : <Empty text="You have no new notifications." />}</div></Panel>;
}
