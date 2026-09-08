import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
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
  const [errorMessage, setErrorMessage] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [photoPreviews, setPhotoPreviews] = useState<{ photo: File; url: string }[]>([]);

  useEffect(() => {
    const previews = photos.map((photo) => ({ photo, url: URL.createObjectURL(photo) }));
    setPhotoPreviews(previews);

    return () => {
      previews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const selectedSize = useMemo(
    () => productOptions.sizes.find((size) => size.id === sizeId) ?? productOptions.sizes[1],
    [sizeId],
  );

  async function submitDraft(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setOrderId("");
    setErrorMessage("");

    let response: Response;

    try {
      response = await fetch("/api/order-drafts", {
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
    } catch {
      setErrorMessage("We could not reach the order service. Please try again.");
      setStatus("error");
      return;
    }

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(result?.error ?? "We could not save this draft. Please try again.");
      setStatus("error");
      return;
    }

    const result = (await response.json().catch(() => null)) as { orderId?: string } | null;

    if (!result?.orderId) {
      setErrorMessage("The order service returned an unexpected response. Please try again.");
      setStatus("error");
      return;
    }

    setOrderId(result.orderId);
    setStatus("created");
  }

  async function uploadPhotos() {
    if (!orderId || photos.length === 0) {
      setUploadError("Choose at least one photo to upload.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setUploadError("");
    setUploadProgress({ completed: 0, total: photos.length });
    const names: string[] = [];

    for (const [index, photo] of photos.entries()) {
      const form = new FormData();
      form.set("photo", photo);

      let response: Response;

      try {
        response = await fetch(`/api/order-drafts/${orderId}/uploads`, {
          method: "POST",
          body: form,
        });
      } catch {
        setUploadedNames(names);
        setPhotos(photos.slice(index));
        setUploadError(`We could not upload ${photo.name} because the upload service could not be reached.`);
        setUploadStatus("error");
        return;
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setUploadedNames(names);
        setPhotos(photos.slice(index));
        setUploadError(result?.error ?? `We could not upload ${photo.name}. Please try again.`);
        setUploadStatus("error");
        return;
      }

      const result = (await response.json().catch(() => null)) as { filename?: string } | null;

      if (!result?.filename) {
        setUploadedNames(names);
        setPhotos(photos.slice(index));
        setUploadError("The upload service returned an unexpected response. Please try again.");
        setUploadStatus("error");
        return;
      }

      names.push(result.filename);
      setUploadedNames([...names]);
      setUploadProgress({ completed: index + 1, total: photos.length });
    }

    setPhotos([]);
    setUploadStatus("uploaded");
  }

  return (
    <form className="configurator" onSubmit={submitDraft}>
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
          required
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
        <button className="button" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Saving..." : "Save draft"}
        </button>
        {status === "created" && (
          <div className="form-status success">
            <span>Draft saved.</span>
            <strong>Reference: {orderId}</strong>
            <a href={`/track?orderId=${encodeURIComponent(orderId)}`}>Track this draft</a>
          </div>
        )}
        {status === "error" && <p className="form-status error">{errorMessage}</p>}
      </div>

      {status === "created" && (
        <section className="upload-panel" aria-labelledby="photo-heading">
          <h3 id="photo-heading">Add pet photos</h3>
          <label>
            Pet photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={(event) => {
                setPhotos(Array.from(event.target.files ?? []));
                setUploadedNames([]);
                setUploadError("");
                setUploadProgress({ completed: 0, total: event.target.files?.length ?? 0 });
                setUploadStatus("idle");
              }}
            />
          </label>
          {photos.length > 0 && (
            <ul className="upload-list">
              {photoPreviews.map(({ photo, url }, index) => (
                <li key={`${photo.name}-${photo.size}-${photo.lastModified}`}>
                  <img src={url} alt="" />
                  <span>{photo.name}</span>
                  <small>{Math.ceil(photo.size / 1024)} KB</small>
                  <button
                    type="button"
                    className="upload-remove"
                    onClick={() => {
                      setPhotos(photos.filter((_, photoIndex) => photoIndex !== index));
                      setUploadStatus("idle");
                      setUploadError("");
                    }}
                    aria-label={`Remove ${photo.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="button secondary" type="button" onClick={uploadPhotos} disabled={photos.length === 0 || uploadStatus === "uploading"}>
            {uploadStatus === "uploading"
              ? `Uploading ${uploadProgress.completed + 1} of ${uploadProgress.total}...`
              : `Upload ${photos.length || "selected"} photo${photos.length === 1 ? "" : "s"}`}
          </button>
          {uploadStatus === "uploaded" && <p className="form-status success">Uploaded {uploadedNames.length} photo{uploadedNames.length === 1 ? "" : "s"}.</p>}
          {uploadStatus === "error" && <p className="form-status error">{uploadError}</p>}
        </section>
      )}
    </form>
  );
}
