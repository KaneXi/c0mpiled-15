import { describe, expect, it, vi } from "vitest";
import type { ConnectClient } from "@aws-sdk/client-connect";
import type { RelayStore } from "../src/relay/server/store";
import { createRelayState } from "../src/relay/seed";
import {
  prepareCaller,
  provisionCaller,
  releaseCaller,
} from "../src/relay/voice/number";
function fixture() {
  let state = createRelayState("test", "2026-10-11T21:00:00Z");
  state.paused = false;
  state.phoneTest = {
    mode: "outbound",
    runId: "run-1",
    armedAt: "2026-10-11T21:00:00Z",
    stage: "waiting",
    detail: "Test",
    updatedAt: "2026-10-11T21:00:00Z",
    events: [],
  };
  const db = {
    mutate: vi.fn(async (_t, _r, _receipt, change) => {
      state = change(state);
      return state;
    }),
  } as unknown as RelayStore;
  const send = vi.fn(async (command: { constructor: { name: string } }) =>
    command.constructor.name === "SearchAvailablePhoneNumbersCommand"
      ? { AvailableNumbersList: [{ PhoneNumber: "+12025550123" }] }
      : { PhoneNumberId: "phone-1" },
  );
  return {
    read: () => state,
    db,
    send,
    connect: { send } as unknown as ConnectClient,
  };
}
describe("AWS caller lifecycle without real calls", () => {
  it("does not reserve a fresh number while paused or unarmed", async () => {
    const f = fixture();
    f.read().paused = true;
    await provisionCaller(f.connect, f.db, "test", f.read());
    f.read().paused = false;
    delete f.read().phoneTest!.armedAt;
    await provisionCaller(f.connect, f.db, "test", f.read());
    expect(f.send).not.toHaveBeenCalled();
  });
  it("persists one claim token and does not repeat a successful claim", async () => {
    const f = fixture();
    await provisionCaller(f.connect, f.db, "test", f.read());
    const token = f.read().phoneTest!.allocationToken;
    expect(token).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    );
    const claim = f.send.mock.calls[1][0] as unknown as {
      input: { ClientToken: string };
    };
    expect(claim.input.ClientToken).toBe(token);
    await provisionCaller(f.connect, f.db, "test", f.read());
    expect(f.send).toHaveBeenCalledTimes(2);
    expect(f.read().phoneTest!.phoneNumberId).toBe("phone-1");
  });
  it("recovers the same uncertain claim after cancellation, then releases it", async () => {
    const f = fixture();
    f.send
      .mockImplementationOnce(async () => ({
        AvailableNumbersList: [{ PhoneNumber: "+12025550123" }],
      }))
      .mockRejectedValueOnce(new Error("Timeout"));
    expect(
      await prepareCaller(f.connect, f.db, "test", f.read()),
    ).toBeUndefined();
    const token = f.read().phoneTest!.allocationToken;
    f.read().paused = true;
    await prepareCaller(f.connect, f.db, "test", f.read());
    expect(f.read().phoneTest!.allocationToken).toBe(token);
    expect(f.send.mock.calls.map((args) => args[0].constructor.name)).toEqual([
      "SearchAvailablePhoneNumbersCommand",
      "ClaimPhoneNumberCommand",
      "ClaimPhoneNumberCommand",
    ]);
    await releaseCaller(f.connect, f.db, "test", f.read());
    expect(f.read().phoneTest!.phoneNumberId).toBeUndefined();
    expect(f.read().phoneTest!.allocationNumber).toBeUndefined();
    expect(f.read().paused).toBe(true);
  });
  it("ends without dialing when AWS definitively refuses the claim", async () => {
    const f = fixture();
    f.send.mockRejectedValueOnce(
      Object.assign(new Error("Denied"), { name: "AccessDeniedException" }),
    );
    await prepareCaller(f.connect, f.db, "test", f.read());
    expect(f.read().paused).toBe(true);
    expect(f.read().phoneTest!.stage).toBe("failed");
    expect(f.read().calls).toHaveLength(0);
  });
});
