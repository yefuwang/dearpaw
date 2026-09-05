import { useEffect, useMemo, useState } from "react";

type OrderStatus = {
  order: {
    id: string;
    status: string;
    paymentStatus: string;
    productName: string;
    sizeName: string | null;
    wood: string | null;
    totalCents: number;
    createdAt: string;
    updatedAt: string;
  };
  customer: {
    name: string;
  };
  pet: {
    name: string;
    species: string | null;
  };
  uploads: Array<{
    id: string;
    filename: string;
    asset_type: string;
    created_at: string;
  }>;
  proofs: Array<{
    id: string;
    version: number;
    status: string;
    created_at: string;
  }>;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function OrderTracker() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<OrderStatus | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get("orderId") ?? "");
  }, []);

  const productionSteps = useMemo(
    () => [
      { key: "draft", label: "Draft", active: true },
      { key: "photos", label: "Photos", active: Boolean(result?.uploads.length) },
      { key: "proof", label: "Proof", active: Boolean(result?.proofs.length) },
      { key: "production", label: "Production", active: result?.order.status === "production" },
      { key: "shipped", label: "Shipped", active: result?.order.status === "shipped" },
    ],
    [result],
  );

  async function loadStatus(event: { preventDefault: () => void }) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    setResult(null);

    const response = await fetch("/api/order-status", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        email,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "We could not find that order.");
      setStatus("error");
      return;
    }

    setResult((await response.json()) as OrderStatus);
    setStatus("loaded");
  }

  return (
    <div className="tracker-shell">
      <form className="panel form-grid" onSubmit={loadStatus}>
        <label>
          Order reference
          <input value={orderId} onChange={(event) => setOrderId(event.target.value)} autoComplete="off" required />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
        <button className="button" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Checking..." : "Check status"}
        </button>
        {status === "error" && <p className="form-status error">{message}</p>}
      </form>

      {status === "loaded" && result && (
        <section className="status-panel" aria-live="polite">
          <div className="status-heading">
            <div>
              <p className="eyebrow">Order</p>
              <h2>{result.pet.name}</h2>
            </div>
            <span className="status-pill">{result.order.status}</span>
          </div>

          <div className="summary-grid">
            <div>
              <span>Reference</span>
              <strong>{result.order.id}</strong>
            </div>
            <div>
              <span>Memorial</span>
              <strong>{result.order.productName}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{result.order.sizeName ?? "Not set"}</strong>
            </div>
            <div>
              <span>Wood</span>
              <strong>{result.order.wood ?? "Not set"}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatMoney(result.order.totalCents)}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{formatDate(result.order.createdAt)}</strong>
            </div>
          </div>

          <ol className="status-steps">
            {productionSteps.map((step) => (
              <li key={step.key} className={step.active ? "active" : ""}>
                {step.label}
              </li>
            ))}
          </ol>

          <div className="status-lists">
            <section>
              <h3>Photos</h3>
              {result.uploads.length ? (
                <ul className="plain-list">
                  {result.uploads.map((upload) => (
                    <li key={upload.id}>{upload.filename}</li>
                  ))}
                </ul>
              ) : (
                <p>No photos uploaded yet.</p>
              )}
            </section>
            <section>
              <h3>Proofs</h3>
              {result.proofs.length ? (
                <ul className="plain-list">
                  {result.proofs.map((proof) => (
                    <li key={proof.id}>Version {proof.version}: {proof.status}</li>
                  ))}
                </ul>
              ) : (
                <p>No proof has been prepared yet.</p>
              )}
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
