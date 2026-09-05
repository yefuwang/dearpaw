import { useMemo, useState } from "react";
import { productOptions } from "../data/site";

export function OrderConfigurator() {
  const [sizeId, setSizeId] = useState(productOptions.sizes[1].id);
  const [wood, setWood] = useState(productOptions.woods[0]);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "created" | "error">("idle");
  const [orderId, setOrderId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [uploadName, setUploadName] = useState("");

  const selectedSize = useMemo(
    () => productOptions.sizes.find((size) => size.id === sizeId) ?? productOptions.sizes[1],
    [sizeId],
  );

  async function submitDraft() {
    setStatus("submitting");
    setOrderId("");

    const response = await fetch("/api/order-drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerName,
        email,
        petName,
        species,
        sizeId,
        wood,
      }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const result = (await response.json()) as { orderId: string };
    setOrderId(result.orderId);
    setStatus("created");
  }

  async function uploadPhoto() {
    if (!orderId || !photo) {
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");

    const form = new FormData();
    form.set("photo", photo);

    const response = await fetch(`/api/order-drafts/${orderId}/uploads`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      setUploadStatus("error");
      return;
    }

    const result = (await response.json()) as { filename: string };
    setUploadName(result.filename);
    setUploadStatus("uploaded");
  }

  return (
    <div className="configurator">
      <section aria-labelledby="customer-heading">
        <h3 id="customer-heading">Your details</h3>
        <div className="field-pair">
          <label>
            Name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="size-heading">
        <h3 id="size-heading">Choose a size</h3>
        <div className="choice-grid">
          {productOptions.sizes.map((size) => (
            <button
              className="choice-button"
              key={size.id}
              type="button"
              aria-pressed={size.id === sizeId}
              onClick={() => setSizeId(size.id)}
            >
              <span className="choice-title">{size.name}</span>
              <span className="choice-detail">{size.detail}</span>
              <span className="choice-detail">${size.price}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="wood-heading">
        <h3 id="wood-heading">Choose wood</h3>
        <div className="choice-grid">
          {productOptions.woods.map((option) => (
            <button
              className="choice-button"
              key={option}
              type="button"
              aria-pressed={option === wood}
              onClick={() => setWood(option)}
            >
              <span className="choice-title">{option}</span>
              <span className="choice-detail">Final species and finish details are pending.</span>
            </button>
          ))}
        </div>
      </section>

      <label>
        Pet name
        <input
          value={petName}
          onChange={(event) => setPetName(event.target.value)}
          placeholder="Amber"
          autoComplete="off"
        />
      </label>

      <label>
        Pet type
        <select value={species} onChange={(event) => setSpecies(event.target.value)}>
          <option value="">Not set</option>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
          <option value="other">Other</option>
        </select>
      </label>

      <div className="summary-box" aria-live="polite">
        <div className="summary-row">
          <span>Memorial</span>
          <strong>The Portrait Urn</strong>
        </div>
        <div className="summary-row">
          <span>Size</span>
          <strong>{selectedSize.name}</strong>
        </div>
        <div className="summary-row">
          <span>Wood</span>
          <strong>{wood}</strong>
        </div>
        <div className="summary-row">
          <span>Name</span>
          <strong>{petName.trim() || "Not set"}</strong>
        </div>
        <p className="price">${selectedSize.price}</p>
        <p>Placeholder pricing. Final dimensions, capacities, and production timing still need business confirmation.</p>
        <button className="button" type="button" onClick={submitDraft} disabled={status === "submitting"}>
          {status === "submitting" ? "Saving..." : "Save draft"}
        </button>
        {status === "created" && (
          <div className="form-status success">
            <span>Draft saved.</span>
            <strong>Reference: {orderId}</strong>
            <a href={`/track?orderId=${encodeURIComponent(orderId)}`}>Track this draft</a>
          </div>
        )}
        {status === "error" && <p className="form-status error">Enter your name, email, pet name, size, and wood.</p>}
      </div>

      {status === "created" && (
        <section className="upload-panel" aria-labelledby="photo-heading">
          <h3 id="photo-heading">Add a photo</h3>
          <label>
            Pet photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(event) => {
                setPhoto(event.target.files?.[0] ?? null);
                setUploadStatus("idle");
              }}
            />
          </label>
          <button className="button secondary" type="button" onClick={uploadPhoto} disabled={!photo || uploadStatus === "uploading"}>
            {uploadStatus === "uploading" ? "Uploading..." : "Upload photo"}
          </button>
          {uploadStatus === "uploaded" && <p className="form-status success">Uploaded: {uploadName}</p>}
          {uploadStatus === "error" && <p className="form-status error">Choose a JPEG, PNG, WEBP, HEIC, or HEIF under 10 MB.</p>}
        </section>
      )}
    </div>
  );
}
