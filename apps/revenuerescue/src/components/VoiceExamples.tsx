"use client";

import { useState } from "react";
import type { VoiceExample } from "../domain/demo-types";
import { voiceExamples } from "../demo/voice-examples";
import styles from "./DemoTools.module.css";

export interface VoiceExamplesProps {
  onAddInquiry: (example: VoiceExample) => void;
}

export function VoiceExamples({ onAddInquiry }: VoiceExamplesProps) {
  const [selectedId, setSelectedId] = useState(voiceExamples[0].id);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const selected = voiceExamples.find((example) => example.id === selectedId)!;
  const added = addedIds.includes(selected.id);

  function addExample() {
    if (added) return;
    onAddInquiry(selected);
    setAddedIds((ids) => [...ids, selected.id]);
  }

  return (
    <section
      className={styles.voice}
      data-tour="voice"
      aria-labelledby="voice-title"
    >
      <div className={styles.voiceHeading}>
        <h2 id="voice-title">A clearer request, in their own words.</h2>
        <p>
          Explore three prepared salon examples. No audio is recorded or
          processed here.
        </p>
      </div>

      <fieldset className={styles.examplePicker}>
        <legend className={styles.visuallyHidden}>
          Choose a voice example
        </legend>
        {voiceExamples.map((example) => (
          <label key={example.id} className={styles.exampleOption}>
            <input
              type="radio"
              name="voice-example"
              value={example.id}
              checked={selectedId === example.id}
              onChange={() => setSelectedId(example.id)}
            />
            <span>{example.title}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.voiceColumns}>
        <div className={styles.transcript}>
          <h3>Example transcript</h3>
          <blockquote>{selected.transcript}</blockquote>
          <p className={styles.explanation}>{selected.explanation}</p>
        </div>
        <div className={styles.interpretation}>
          <h3>Illustrative interpretation</h3>
          <p className={styles.interpretationNote}>
            Prepared for this demo; no AI analysis is running.
          </p>
          <dl className={styles.fields}>
            <div>
              <dt>Customer</dt>
              <dd>{selected.customerName}</dd>
            </div>
            <div>
              <dt>Request</dt>
              <dd>{selected.intent}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{selected.service}</dd>
            </div>
            <div>
              <dt>Requested time</dt>
              <dd>{selected.requestedTime}</dd>
            </div>
          </dl>
          <div className={styles.confirmationNotes}>
            <h4>Still needs confirmation</h4>
            <ul>
              {selected.uncertainty.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.voiceFooter}>
        <p>
          Add this example as an unconfirmed inquiry. No appointment is booked
          and no message is sent.
        </p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={addExample}
          disabled={added}
        >
          {added ? "Example added" : "Add example inquiry"}
        </button>
      </div>
      <p className={styles.status} role="status">
        {added
          ? `${selected.customerName}'s example inquiry is ready for staff review.`
          : ""}
      </p>
    </section>
  );
}

export default VoiceExamples;
