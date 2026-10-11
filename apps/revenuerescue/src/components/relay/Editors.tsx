"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  RelayCommand,
  Shift,
  Volunteer,
  VolunteerInput,
} from "@/relay/contracts";
import { browserZone, localInput } from "./format";
import s from "./Relay.module.css";

export type SendCommand = (
  command: RelayCommand,
  success: string,
) => Promise<boolean>;

export function VolunteerEditor({
  volunteer,
  send,
  busy,
  onClose,
  onSaveLive,
}: {
  volunteer?: Volunteer;
  send: SendCommand;
  busy: boolean;
  onClose: () => void;
  onSaveLive?: (volunteer: VolunteerInput, code: string) => Promise<boolean>;
}) {
  const [windows, setWindows] = useState(
    volunteer?.availability.map((v) => ({
      start: localInput(v.start),
      end: localInput(v.end),
    })) ?? [],
  );
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const values = (key: string) =>
        String(data.get(key) ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      const input: VolunteerInput = {
        name: String(data.get("name")),
        phone: String(data.get("phone")),
        roles: values("roles"),
        preferredRoles: values("preferredRoles"),
        availability: windows.map((w) => ({
          start: new Date(w.start).toISOString(),
          end: new Date(w.end).toISOString(),
        })),
        timezone: String(data.get("timezone")),
        quietHours: {
          start: Number(data.get("quietStart")),
          end: Number(data.get("quietEnd")),
        },
        callingConsent: data.has("callingConsent"),
        recordingConsent: data.has("recordingConsent"),
        optedOut: data.has("optedOut"),
        active: data.has("active"),
      };
      const saved = onSaveLive
        ? await onSaveLive(input, String(data.get("managerCode") ?? "").trim())
        : await send(
            {
              type: "SAVE_VOLUNTEER",
              ...(volunteer ? { id: volunteer.id } : {}),
              volunteer: input,
            },
            "Volunteer saved.",
          );
      if (saved) onClose();
    } catch {
      setError("Check each availability date and time, then save again.");
    }
  }
  return (
    <section className={s.editor} aria-labelledby="volunteer-editor-title">
      <div className={s.sectionHeading}>
        <h2 id="volunteer-editor-title">
          {volunteer ? "Edit volunteer" : "Add volunteer"}
        </h2>
        <button className={s.textButton} onClick={onClose}>
          Cancel
        </button>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className={s.fields}>
          {onSaveLive && (
            <>
              <p className={s.hint}>
                Add a real volunteer to your shared roster. Saving does not
                start a call. You can then choose them when creating a task.
              </p>
              <label>
                Manager access code
                <input
                  name="managerCode"
                  type="password"
                  required
                  autoComplete="off"
                />
              </label>
            </>
          )}
          <div className={s.formGrid}>
            <label>
              Full name
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={volunteer?.name}
                autoComplete="off"
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                required
                defaultValue={volunteer?.phone}
                placeholder="+12025550101"
                autoComplete="off"
              />
              <span className={s.hint}>
                {onSaveLive
                  ? "Use a US phone number with country code +1."
                  : "Include country code. Use fictional data in this demo."}
              </span>
            </label>
            <label>
              Qualified roles
              <input
                name="roles"
                required
                defaultValue={
                  volunteer?.roles.join(", ") ?? (onSaveLive ? "welcome" : "")
                }
                placeholder="packing, welcome"
              />
              <span className={s.hint}>Separate roles with commas.</span>
            </label>
            <label>
              Preferred roles
              <input
                name="preferredRoles"
                defaultValue={volunteer?.preferredRoles.join(", ")}
                placeholder="Optional"
              />
            </label>
            <label>
              Calling time zone
              <input
                name="timezone"
                required
                defaultValue={
                  volunteer?.timezone ??
                  (onSaveLive ? "America/New_York" : browserZone())
                }
              />
            </label>
            <div className={s.formGrid}>
              <label>
                Quiet hours start
                <select
                  name="quietStart"
                  defaultValue={
                    volunteer?.quietHours.start ?? (onSaveLive ? 22 : 20)
                  }
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quiet hours end
                <select
                  name="quietEnd"
                  defaultValue={volunteer?.quietHours.end ?? 8}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className={s.checks}>
            <label>
              <input
                name="callingConsent"
                type="checkbox"
                defaultChecked={volunteer?.callingConsent ?? false}
              />{" "}
              {onSaveLive
                ? "This volunteer has agreed to receive real scheduling calls"
                : "Permission to call"}
            </label>
            {!onSaveLive && (
              <label>
                <input
                  name="recordingConsent"
                  type="checkbox"
                  defaultChecked={volunteer?.recordingConsent ?? false}
                />{" "}
                Permission to record
              </label>
            )}
            <label>
              <input
                name="optedOut"
                type="checkbox"
                defaultChecked={volunteer?.optedOut ?? false}
              />{" "}
              Opted out of calls
            </label>
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={volunteer?.active ?? true}
              />{" "}
              Active volunteer
            </label>
          </div>
          <div className={s.subheading}>
            <h3>Availability</h3>
            <span className={s.hint}>Enter times in {browserZone()}.</span>
          </div>
          {windows.map((window, index) => (
            <div className={s.windowRow} key={index}>
              <label>
                Available from
                <input
                  aria-label={`Availability ${index + 1} start`}
                  type="datetime-local"
                  required
                  value={window.start}
                  onChange={(e) =>
                    setWindows(
                      windows.map((w, i) =>
                        i === index ? { ...w, start: e.target.value } : w,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Available until
                <input
                  aria-label={`Availability ${index + 1} end`}
                  type="datetime-local"
                  required
                  value={window.end}
                  onChange={(e) =>
                    setWindows(
                      windows.map((w, i) =>
                        i === index ? { ...w, end: e.target.value } : w,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className={s.iconButton}
                aria-label={`Remove availability ${index + 1}`}
                onClick={() =>
                  setWindows(windows.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={s.secondary}
            disabled={windows.length >= 20}
            onClick={() => setWindows([...windows, { start: "", end: "" }])}
          >
            <Plus size={16} /> Add availability
          </button>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <div className={s.formFooter}>
            <p className={s.hint}>
              A phone number does not grant calling or recording permission.
            </p>
            <button type="submit" className={s.primary}>
              {busy ? "Saving…" : "Save volunteer"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export function ShiftEditor({
  shift,
  now,
  send,
  busy,
  onClose,
}: {
  shift?: Shift;
  now: string;
  send: SendCommand;
  busy: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (
        await send(
          {
            type: "SAVE_SHIFT",
            ...(shift ? { id: shift.id } : {}),
            shift: {
              title: String(data.get("title")),
              role: String(data.get("role")),
              required: Number(data.get("required")),
              start: new Date(String(data.get("start"))).toISOString(),
              end: new Date(String(data.get("end"))).toISOString(),
            },
          },
          "Draft shift saved. Assign volunteers, then publish when ready.",
        )
      )
        onClose();
    } catch {
      setError("Check the shift dates and times, then save again.");
    }
  }
  return (
    <section className={s.editor} aria-labelledby="shift-editor-title">
      <div className={s.sectionHeading}>
        <h2 id="shift-editor-title">
          {shift ? "Edit draft shift" : "Create draft shift"}
        </h2>
        <button className={s.textButton} onClick={onClose}>
          Cancel
        </button>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className={s.fields}>
          <div className={s.formGrid}>
            <label>
              Shift name
              <input
                name="title"
                required
                maxLength={100}
                defaultValue={shift?.title}
                placeholder="Afternoon food packing"
              />
            </label>
            <label>
              Required role
              <input
                name="role"
                required
                maxLength={60}
                defaultValue={shift?.role}
                placeholder="packing"
              />
            </label>
            <label>
              Starts
              <input
                name="start"
                type="datetime-local"
                required
                defaultValue={localInput(
                  shift?.start ??
                    new Date(Date.parse(now) + 3_600_000).toISOString(),
                )}
              />
            </label>
            <label>
              Ends
              <input
                name="end"
                type="datetime-local"
                required
                defaultValue={localInput(
                  shift?.end ??
                    new Date(Date.parse(now) + 10_800_000).toISOString(),
                )}
              />
            </label>
            <label>
              Volunteers needed
              <input
                name="required"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={shift?.required ?? 1}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <div className={s.formFooter}>
            <p className={s.hint}>
              Times are in {browserZone()}. Drafts do not trigger calls.
            </p>
            <button className={s.primary} type="submit">
              {busy ? "Saving…" : "Save draft"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
