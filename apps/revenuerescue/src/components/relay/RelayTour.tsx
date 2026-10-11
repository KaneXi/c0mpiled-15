"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { tourLayout, tourSteps, type RelayTourTab } from "./tour-flow";
import s from "./Relay.module.css";

export function RelayTour({
  onNavigate,
  onClose,
  hasPlans,
  hasCalls,
  aiLabel,
}: {
  onNavigate: (tab: RelayTourTab) => void;
  onClose: (completed: boolean) => void;
  hasPlans: boolean;
  hasCalls: boolean;
  aiLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<ReturnType<typeof tourLayout> | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = tourSteps[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const previousScroll = window.scrollY;
    dialog?.showModal();
    return () => {
      dialog?.close();
      const focusTarget = previous?.isConnected
        ? previous
        : document.querySelector<HTMLElement>("[data-relay-help]");
      focusTarget?.focus({ preventScroll: true });
      window.scrollTo({ top: previousScroll, behavior: "instant" });
    };
  }, []);

  useEffect(() => {
    onNavigate(step.tab);
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const findTarget = () =>
      document.querySelector<HTMLElement>(
        `[data-relay-tour="${step.target}"]`,
      ) ??
      document.querySelector<HTMLElement>(
        `[data-relay-tour="${step.fallback}"]`,
      );
    const measure = () => {
      const target = findTarget();
      const rect = target?.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      };
      setLayout(
        tourLayout(
          rect
            ? {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }
            : null,
          viewport,
          cardRef.current?.offsetHeight ?? 340,
        ),
      );
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(() => {
      const target = findTarget();
      target?.scrollIntoView({ block: "start", behavior: "instant" });
      headingRef.current?.focus({ preventScroll: true });
      measure();
      observer = new ResizeObserver(scheduleMeasure);
      if (target) observer.observe(target);
      if (cardRef.current) observer.observe(cardRef.current);
    });
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
    };
  }, [step, onNavigate]);

  return (
    <dialog
      ref={dialogRef}
      className={s.tourOverlay}
      aria-labelledby="relay-tour-title"
      aria-describedby="relay-tour-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
    >
      {layout?.spotlight ? (
        <div
          aria-hidden="true"
          className={s.tourSpotlight}
          style={layout.spotlight}
        />
      ) : (
        <div aria-hidden="true" className={s.tourShade} />
      )}
      <section
        ref={cardRef}
        className={s.tourCard}
        style={
          layout ? { ...layout.card, right: "auto", bottom: "auto" } : undefined
        }
      >
        <div className={s.tourProgress}>
          <span>
            Quick tour · {index + 1} of {tourSteps.length}
          </span>
          <button
            type="button"
            className={s.iconButton}
            aria-label="Skip tour"
            onClick={() => onClose(false)}
          >
            <X size={18} />
          </button>
        </div>
        <h2 ref={headingRef} tabIndex={-1} id="relay-tour-title">
          {step.title}
        </h2>
        <p id="relay-tour-description">{step.description}</p>
        {step.id === "approval" && !hasPlans && (
          <p className={s.tourNote}>
            There is no replacement plan waiting right now. A real plan will
            appear in this attention area when Relay finds a gap.
          </p>
        )}
        {step.id === "calls" && (
          <p className={s.tourNote}>
            {hasCalls
              ? "The highlighted area shows your current calls."
              : "There are no active calls yet. This area fills when a published shift has a due check-in."}{" "}
            AI status: {aiLabel}.
          </p>
        )}
        {!layout?.spotlight && (
          <p className={s.hint}>
            This section is available in{" "}
            {step.tab === "schedule"
              ? "Schedule"
              : step.tab === "volunteers"
                ? "Volunteers"
                : "Calls"}
            . The guide still works when the section is empty or outside this
            small viewport.
          </p>
        )}
        <div className={s.tourButtons}>
          <button
            type="button"
            className={s.textButton}
            onClick={() => onClose(false)}
          >
            Skip tour
          </button>
          <div>
            <button
              type="button"
              className={s.secondary}
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              className={s.primary}
              onClick={() =>
                index === tourSteps.length - 1
                  ? onClose(true)
                  : setIndex(index + 1)
              }
            >
              {index === tourSteps.length - 1 ? "Done" : "Next"}
              {index < tourSteps.length - 1 && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
