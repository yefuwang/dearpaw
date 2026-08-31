import { useMemo, useState } from "react";
import { productOptions } from "../data/site";

export function OrderConfigurator() {
  const [sizeId, setSizeId] = useState(productOptions.sizes[1].id);
  const [wood, setWood] = useState(productOptions.woods[0]);
  const [petName, setPetName] = useState("");

  const selectedSize = useMemo(
    () => productOptions.sizes.find((size) => size.id === sizeId) ?? productOptions.sizes[1],
    [sizeId],
  );

  return (
    <div className="configurator">
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
        <a className="button" href="/order">Continue</a>
      </div>
    </div>
  );
}

