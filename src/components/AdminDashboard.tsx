import { useEffect, useMemo, useState } from "react";

type AdminOrder = {
  id: string;
  status: string;
  payment_status: string;
  product_name: string;
  size_name: string | null;
  wood: string | null;
  total_cents: number;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  pet_name: string;
  species: string | null;
  upload_count: number;
  proof_count: number;
  update_count: number;
};

type ContactRequest = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

type ProductionUpdate = {
  id: string;
  order_id: string;
  stage: string;
  note: string;
  visibility: string;
  media_type: string | null;
  created_at: string;
};

type DashboardData = {
  statuses: string[];
  orders: AdminOrder[];
  contacts: ContactRequest[];
  updates: ProductionUpdate[];
};

const productionStages = ["photos", "proof", "cnc", "painting", "finishing", "packing", "shipping", "general"];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [stage, setStage] = useState("general");
  const [visibility, setVisibility] = useState("customer");
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofStatus, setProofStatus] = useState<"idle" | "uploading">("idle");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUploadId, setMediaUploadId] = useState("");
  const [mediaStatus, setMediaStatus] = useState<"idle" | "uploading">("idle");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(true);

  const selectedOrder = useMemo(
    () => data?.orders.find((order) => order.id === selectedOrderId) ?? data?.orders[0] ?? null,
    [data, selectedOrderId],
  );

  async function loadDashboard(status = selectedStatus) {
    setLoading(true);
    setMessage("");

    const url = status ? `/api/admin/dashboard?status=${encodeURIComponent(status)}` : "/api/admin/dashboard";
    const response = await fetch(url);

    if (!response.ok) {
      setMessageKind("error");
      setMessage("Unable to load admin data.");
      setLoading(false);
      return;
    }

    const body = (await response.json()) as DashboardData;
    setData(body);
    setSelectedOrderId((current) => (current && body.orders.some((order) => order.id === current) ? current : body.orders[0]?.id ?? ""));
    setNextStatus((current) => current || body.orders[0]?.status || "draft");
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard("");
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      setNextStatus(selectedOrder.status);
    }
  }, [selectedOrder]);

  async function updateStatus() {
    if (!selectedOrder || !nextStatus) {
      return;
    }

    const response = await fetch(`/api/admin/orders/${selectedOrder.id}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!response.ok) {
      setMessageKind("error");
      setMessage("Status update failed.");
      return;
    }

    setMessageKind("success");
    setMessage("Status updated.");
    await loadDashboard(selectedStatus);
  }

  async function addUpdate() {
    if (!selectedOrder || !note.trim()) {
      setMessageKind("error");
      setMessage("Choose an order and enter a production note.");
      return;
    }

    const response = await fetch(`/api/admin/orders/${selectedOrder.id}/production-updates`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ stage, note, visibility }),
    });

    if (!response.ok) {
      setMessageKind("error");
      setMessage("Production update failed.");
      return;
    }

    setNote("");
    setMessageKind("success");
    setMessage("Production update added.");
    await loadDashboard(selectedStatus);
  }

  async function uploadProof() {
    if (!selectedOrder || !proofFile) {
      setMessageKind("error");
      setMessage("Choose a proof file first.");
      return;
    }

    setProofStatus("uploading");
    const form = new FormData();
    form.set("proof", proofFile);
    let response: Response;

    try {
      response = await fetch(`/api/admin/orders/${selectedOrder.id}/proofs`, { method: "POST", body: form });
    } catch {
      setMessageKind("error");
      setMessage("Proof upload could not reach the server.");
      setProofStatus("idle");
      return;
    }

    if (!response.ok) {
      setMessageKind("error");
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "Proof upload failed.");
      setProofStatus("idle");
      return;
    }

    setProofFile(null);
    setProofStatus("idle");
    setMessageKind("success");
    setMessage("Proof uploaded.");
    await loadDashboard(selectedStatus);
  }

  async function uploadProductionMedia() {
    if (!selectedOrder || !mediaFile || !stage || !note.trim()) {
      setMessageKind("error");
      setMessage("Choose media and enter a production note first.");
      return;
    }

    setMediaStatus("uploading");
    const form = new FormData();
    form.set("media", mediaFile);
    form.set("uploadId", mediaUploadId);
    form.set("stage", stage);
    form.set("note", note);
    form.set("visibility", visibility);
    let response: Response;

    try {
      response = await fetch(`/api/admin/orders/${selectedOrder.id}/production-media`, { method: "POST", body: form });
    } catch {
      setMessageKind("error");
      setMessage("Production media upload could not reach the server.");
      setMediaStatus("idle");
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessageKind("error");
      setMessage(body?.error ?? "Production media upload failed.");
      setMediaStatus("idle");
      return;
    }

    setMediaFile(null);
    setMediaUploadId("");
    setNote("");
    setMediaStatus("idle");
    setMessageKind("success");
    setMessage("Production media added.");
    await loadDashboard(selectedStatus);
  }

  return (
    <div className="admin-shell">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Back office</h1>
        </div>
        <label>
          Status
          <select
            value={selectedStatus}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedStatus(value);
              void loadDashboard(value);
            }}
          >
            <option value="">All orders</option>
            {data?.statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </section>

      {message && <p className={`form-status ${messageKind}`}>{message}</p>}
      {loading && <p className="panel">Loading admin data...</p>}

      {data && !loading && (
        <div className="admin-grid">
          <section className="admin-card">
            <h2>Orders</h2>
            <div className="admin-list">
              {data.orders.map((order) => (
                <button
                  className="admin-row"
                  key={order.id}
                  type="button"
                  aria-pressed={order.id === selectedOrder?.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  disabled={mediaStatus === "uploading"}
                >
                  <span>
                    <strong>{order.pet_name}</strong>
                    <small>{order.customer_name} · {shortId(order.id)}</small>
                  </span>
                  <span className="status-pill">{order.status}</span>
                </button>
              ))}
              {!data.orders.length && <p>No orders found.</p>}
            </div>
          </section>

          <section className="admin-card">
            <h2>Selected Order</h2>
            {selectedOrder ? (
              <div className="admin-detail">
                <div className="summary-grid">
                  <div>
                    <span>Reference</span>
                    <strong>{selectedOrder.id}</strong>
                  </div>
                  <div>
                    <span>Customer</span>
                    <strong>{selectedOrder.customer_name}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{selectedOrder.customer_email}</strong>
                  </div>
                  <div>
                    <span>Pet</span>
                    <strong>{selectedOrder.pet_name}</strong>
                  </div>
                  <div>
                    <span>Product</span>
                    <strong>{selectedOrder.product_name}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{formatMoney(selectedOrder.total_cents)}</strong>
                  </div>
                  <div>
                    <span>Uploads</span>
                    <strong>{selectedOrder.upload_count}</strong>
                  </div>
                  <div>
                    <span>Updates</span>
                    <strong>{selectedOrder.update_count}</strong>
                  </div>
                </div>

                <div className="admin-actions">
                  <label>
                    Order status
                    <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={mediaStatus === "uploading"}>
                      {data.statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <button className="button" type="button" onClick={updateStatus}>Save status</button>
                </div>

                <div className="admin-actions">
                  <label>
                    Stage
                    <select value={stage} onChange={(event) => setStage(event.target.value)} disabled={mediaStatus === "uploading"}>
                      {productionStages.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Production note
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={mediaStatus === "uploading"} />
                  </label>
                  <label>
                    Visibility
                    <select value={visibility} onChange={(event) => setVisibility(event.target.value)} disabled={mediaStatus === "uploading"}>
                      <option value="customer">Customer</option>
                      <option value="internal">Internal</option>
                    </select>
                  </label>
                  <button className="button secondary" type="button" onClick={addUpdate}>Add update</button>
                </div>

                <div className="admin-actions">
                  <label>
                    Production photo or video
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                      disabled={mediaStatus === "uploading"}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setMediaFile(file);
                        setMediaUploadId(file ? crypto.randomUUID() : "");
                      }}
                    />
                  </label>
                  <button className="button secondary" type="button" onClick={uploadProductionMedia} disabled={!mediaFile || !note.trim() || mediaStatus === "uploading"}>
                    {mediaStatus === "uploading" ? "Uploading..." : "Add media update"}
                  </button>
                </div>

                <div className="admin-actions">
                  <label>
                    Proof file
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      disabled={proofStatus === "uploading"}
                      onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button className="button secondary" type="button" onClick={uploadProof} disabled={!proofFile || proofStatus === "uploading"}>
                    {proofStatus === "uploading" ? "Uploading..." : "Upload proof"}
                  </button>
                </div>
              </div>
            ) : (
              <p>No order selected.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>Contact Requests</h2>
            <div className="admin-list">
              {data.contacts.map((contact) => (
                <article className="admin-note" key={contact.id}>
                  <strong>{contact.name}</strong>
                  <small>{contact.email} · {contact.status}</small>
                  <p>{contact.message}</p>
                </article>
              ))}
              {!data.contacts.length && <p>No contact requests found.</p>}
            </div>
          </section>

          <section className="admin-card">
            <h2>Production Updates</h2>
            <div className="admin-list">
              {data.updates.map((update) => (
                <article className="admin-note" key={update.id}>
                  <strong>{update.stage}</strong>
                  <small>{shortId(update.order_id)} · {update.visibility}</small>
                  <p>{update.note}</p>
                </article>
              ))}
              {!data.updates.length && <p>No production updates yet.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
