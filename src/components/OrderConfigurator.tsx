import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { productOptions } from "../data/site";

export function OrderConfigurator() {
  const [sizeId, setSizeId] = useState(productOptions.sizes[1].id);
  const [wood, setWood] = useState(productOptions.woods[0]);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [passingYear, setPassingYear] = useState("");
  const [inscription, setInscription] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "created" | "error">("idle");
  const [orderId, setOrderId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "starting">("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const photoInputRef = useRef<HTMLInputElement>(null);
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
    setCheckoutError("");

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
          birthYear,
          passingYear,
          inscription,
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
    const names = [...uploadedNames];

    for (const [index, photo] of photos.entries()) {
      const form = new FormData();
      form.set("photo", photo);
      form.set("uploadId", uploadIds[index]);

      let response: Response;

      try {
        response = await fetch(`/api/order-drafts/${orderId}/uploads`, {
          method: "POST",
          body: form,
        });
      } catch {
        setUploadedNames(names);
        setPhotos(photos.slice(index));
        setUploadIds(uploadIds.slice(index));
        setUploadError(`We could not upload ${photo.name} because the upload service could not be reached.`);
        setUploadStatus("error");
        return;
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setUploadedNames(names);
        setPhotos(photos.slice(index));
        setUploadIds(uploadIds.slice(index));
        setUploadError(result?.error ?? `We could not upload ${photo.name}. Please try again.`);
        setUploadStatus("error");
        return;
      }

      const result = (await response.json().catch(() => null)) as { filename?: string } | null;

      if (!result?.filename) {
        setUploadedNames(names);
        setPhotos(photos.slice(index));
        setUploadIds(uploadIds.slice(index));
        setUploadError("The upload service returned an unexpected response. Please try again.");
        setUploadStatus("error");
        return;
      }

      names.push(result.filename);
      setUploadedNames([...names]);
      setUploadProgress({ completed: index + 1, total: photos.length });
    }

    setPhotos([]);
    setUploadIds([]);
    setUploadStatus("uploaded");
  }

  async function startCheckout() {
    if (!orderId || !email) return;
    setCheckoutStatus("starting");
    setErrorMessage("");
    let response: Response;
    try {
      response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, email }),
      });
    } catch {
      setCheckoutError("We could not reach checkout. Please try again.");
      setCheckoutStatus("idle");
      return;
    }
    const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !body?.url) {
      setCheckoutError(body?.error ?? "Checkout could not be started.");
      setCheckoutStatus("idle");
      return;
    }
    window.location.assign(body.url);
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

      <div className="field-pair">
        <label>
          Birth year <span className="optional">Optional</span>
          <input
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="2012"
          />
        </label>
        <label>
          Passing year <span className="optional">Optional</span>
          <input
            value={passingYear}
            onChange={(event) => setPassingYear(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="2026"
          />
        </label>
      </div>

      <label>
        Short inscription <span className="optional">Optional</span>
        <input
          value={inscription}
          onChange={(event) => setInscription(event.target.value)}
          maxLength={160}
          placeholder="Always in our hearts"
        />
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
            <button className="button secondary" type="button" onClick={() => void startCheckout()} disabled={checkoutStatus === "starting" || uploadedNames.length < 3}>
              {checkoutStatus === "starting" ? "Opening checkout..." : "Continue to payment"}
            </button>
            {uploadedNames.length < 3 && <small>Upload at least 3 photos before payment.</small>}
          </div>
        )}
        {checkoutError && <p className="form-status error">{checkoutError}</p>}
        {status === "error" && <p className="form-status error">{errorMessage}</p>}
      </div>

      {status === "created" && (
        <section className="upload-panel" aria-labelledby="photo-heading">
          <h3 id="photo-heading">Add pet photos</h3>
          <label>
            Pet photos
            <input
              type="file"
              ref={photoInputRef}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              disabled={uploadStatus === "uploading"}
              onChange={(event) => {
                const selectedPhotos = Array.from(event.target.files ?? []);
                setPhotos(selectedPhotos);
                setUploadIds(selectedPhotos.map(() => crypto.randomUUID()));
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
                      if (uploadStatus === "uploading") {
                        return;
                      }
                      setPhotos(photos.filter((_, photoIndex) => photoIndex !== index));
                      setUploadIds(uploadIds.filter((_, photoIndex) => photoIndex !== index));
                      setUploadStatus("idle");
                      setUploadError("");
                      if (photos.length === 1 && photoInputRef.current) {
                        photoInputRef.current.value = "";
                      }
                    }}
                    aria-label={`Remove ${photo.name}`}
                    disabled={uploadStatus === "uploading"}
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
          {uploadStatus === "uploaded" && <p className="form-status success">Uploaded {uploadedNames.length} photo{uploadedNames.length === 1 ? "" : "s"}. {uploadedNames.length >= 3 ? "Your photos are ready for the next step." : "Add at least 3 photos to continue."}</p>}
          {uploadStatus === "error" && <p className="form-status error">{uploadError}</p>}
        </section>
      )}
    </form>
  );
}
