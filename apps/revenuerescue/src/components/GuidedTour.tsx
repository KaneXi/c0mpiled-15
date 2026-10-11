"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DemoMode } from "../domain/demo-types";
import { BUSINESS_TOUR_KEY, tourCompletionKey, tourSteps, type TourStepId, type WorkspaceScreen } from "../demo/variants";
export type { TourStepId } from "../demo/variants";
import styles from "./DemoTools.module.css";

export const GUEST_TOUR_COMPLETION_KEY = BUSINESS_TOUR_KEY;

export interface GuidedTourProps {
  open: boolean;
  mode?: DemoMode;
  onClose: (completed: boolean) => void;
  onNavigate: (screen: WorkspaceScreen) => void;
  onStepChange?: (step: TourStepId) => void;
}

interface Placement {
  card: CSSProperties;
  highlight: CSSProperties | null;
}

function rememberTour(completed: boolean, mode: DemoMode) {
  try {
    window.localStorage.setItem(
      tourCompletionKey(mode),
      completed ? "true" : "dismissed",
    );
  } catch {
    /* The tour still works when device storage is unavailable. */
  }
}

export function GuidedTour({
  open,
  mode = "business",
  onClose,
  onNavigate,
  onStepChange,
}: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement>({
    card: {},
    highlight: null,
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const callbacks = useRef({ onClose, onNavigate, onStepChange });
  const steps = tourSteps(mode);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(() => {
    callbacks.current = { onClose, onNavigate, onStepChange };
  }, [onClose, onNavigate, onStepChange]);

  function close(completed: boolean) {
    rememberTour(completed, mode);
    callbacks.current.onClose(completed);
  }

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      return;
    }
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        rememberTour(false, mode);
        callbacks.current.onClose(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    callbacks.current.onNavigate(step.screen);
    callbacks.current.onStepChange?.(step.id);
    let frame = 0;
    let observer: ResizeObserver | undefined;

    function measure() {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      const rect = target?.getBoundingClientRect();
      const width = Math.min(364, window.innerWidth - 32);
      const height = cardRef.current?.offsetHeight ?? 290;
      const maxTop = Math.max(16, window.innerHeight - height - 16);
      let left = window.innerWidth - width - 16;
      let top = maxTop;
      if (rect && window.innerWidth > 680) {
        if (rect.right + width + 32 <= window.innerWidth) {
          left = rect.right + 16;
          top = rect.top;
        } else if (rect.left - width - 16 >= 16) {
          left = rect.left - width - 16;
          top = rect.top;
        } else if (rect.bottom + height + 32 <= window.innerHeight) {
          top = rect.bottom + 16;
        } else if (rect.top - height - 16 >= 16) {
          top = rect.top - height - 16;
        }
      }
      const visible =
        rect &&
        rect.bottom > 4 &&
        rect.top < window.innerHeight - 4 &&
        rect.right > 4 &&
        rect.left < window.innerWidth - 4 &&
        rect.width > 0 &&
        rect.height > 0;
      setPlacement({
        card: {
          top: Math.min(maxTop, Math.max(16, top)),
          left: Math.max(16, left),
          width,
        },
        highlight: visible
          ? {
              top: Math.max(4, rect.top - 5),
              left: Math.max(4, rect.left - 5),
              width:
                Math.min(window.innerWidth - 8, rect.right + 5) -
                Math.max(4, rect.left - 5),
              height:
                Math.min(window.innerHeight - 4, rect.bottom + 5) -
                Math.max(4, rect.top - 5),
            }
          : null,
      });
    }

    function scheduleMeasure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      target?.scrollIntoView({ behavior: "instant", block: "nearest" });
      headingRef.current?.focus({ preventScroll: true });
      measure();
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(scheduleMeasure);
        if (target) observer.observe(target);
        if (cardRef.current) observer.observe(cardRef.current);
      }
    });
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [open, step]);

  if (!open) return null;

  return (
    <>
      {placement.highlight && (
        <div
          className={styles.tourHighlight}
          style={placement.highlight}
          aria-hidden="true"
        />
      )}
      <div
        ref={cardRef}
        className={styles.tour}
        style={placement.card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
      >
        <div className={styles.tourProgress}>
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={() => close(false)}
            className={styles.textButton}
            aria-label="Skip the guided tour"
          >
            Skip tour
          </button>
        </div>
        <h2 ref={headingRef} id="tour-title" tabIndex={-1}>
          {step.title}
        </h2>
        <p id="tour-description">{step.text}</p>
        <div className={styles.tourActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() =>
              stepIndex === steps.length - 1
                ? close(true)
                : setStepIndex((index) => index + 1)
            }
          >
            {stepIndex === steps.length - 1 ? "Finish tour" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export default GuidedTour;
