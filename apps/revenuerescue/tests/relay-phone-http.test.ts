import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStore } from "../src/relay/server/store";
import { handleRelayRequest } from "../src/relay/server/http";
vi.mock("../src/relay/voice/dispatch", () => ({
  wakeVoiceWorker: vi.fn().mockResolvedValue("queued"),
}));
import { wakeVoiceWorker } from "../src/relay/voice/dispatch";
const dir = mkdtempSync(join(tmpdir(), "relay-phone-http-"));
const code = "fictional-presenter-code";
beforeAll(() => {
  process.env.RELAY_DB_PATH = join(dir, "test.sqlite");
  process.env.RELAY_PHONE_CONTROL_CODE = code;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const key of [
    "RELAY_DB_PATH",
    "RELAY_PHONE_CONTROL_CODE",
    "VOICE_ALLOWED_PHONES",
    "RELAY_PUBLIC_TEST_TENANT",
    "VOICE_SERVICE_READY",
    "VOICE_FUNCTION_NAME",
  ])
    delete process.env[key];
});
const post = (body: unknown) =>
  handleRelayRequest(
    new Request("http://localhost:3008/api/relay/command", {
      method: "POST",
      headers: {
        origin: "http://localhost:3008",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
it("requires the presenter code and explicit call authorization; writes remain scheduled until AWS runs", async () => {
  const fresh = await getStore().createSession();
  const tenant = fresh.session.tenantId;
  let s = await getStore().mutate(tenant, undefined, undefined, (s) => ({
    ...s,
    paused: true,
    phoneTest: {
      mode: "outbound",
      stage: "stopped",
      detail: "Test",
      updatedAt: new Date().toISOString(),
      events: [],
    },
  }));
  process.env.RELAY_PUBLIC_TEST_TENANT = tenant;
  process.env.VOICE_ALLOWED_PHONES = JSON.stringify(
    s.volunteers.map((v) => v.phone),
  );
  const people = s.volunteers.filter((v) => v.id !== s.managerVolunteerId);
  const setup = {
    originalId: people[1].id,
    replacementId: people[0].id,
    start: new Date(Date.now() + 20 * 60_000).toISOString(),
    end: new Date(Date.now() + 80 * 60_000).toISOString(),
  };
  expect(
    (await post({ phoneTestAction: "prepare", code: "wrong", setup })).status,
  ).toBe(403);
  expect((await post({ phoneTestAction: "prepare", code, setup })).status).toBe(
    200,
  );
  const schedule = {
    phoneTestAction: "schedule",
    code,
    scheduledFor: new Date(Date.now() + 120_000).toISOString(),
  };
  expect((await post(schedule)).status).toBe(400);
  expect((await post({ ...schedule, authorizeCalls: true })).status).toBe(503);
  process.env.VOICE_SERVICE_READY = "true";
  expect((await post({ ...schedule, authorizeCalls: true })).status).toBe(200);
  s = await getStore().read(tenant);
  expect(s.phoneTest?.scheduledFor).toBe(schedule.scheduledFor);
  expect(s.phoneTest?.runsScheduled).toBe(1);
  expect(s.calls).toEqual([]);
  expect((await post({ ...schedule, authorizeCalls: true })).status).toBe(409);
  expect((await post({ phoneTestAction: "stop", code })).status).toBe(200);
  expect((await getStore().read(tenant)).paused).toBe(true);
});
it("immediate starts require authorization and dispatch only once after saving the run", async () => {
  const tenant = process.env.RELAY_PUBLIC_TEST_TENANT!;
  const state = await getStore().read(tenant);
  const people = state.volunteers.filter(
    (v) => v.id !== state.managerVolunteerId,
  );
  const setup = {
    originalId: people[1].id,
    replacementId: people[0].id,
    start: new Date(Date.now() + 20 * 60_000).toISOString(),
    end: new Date(Date.now() + 80 * 60_000).toISOString(),
  };
  await post({ phoneTestAction: "prepare", code, setup });
  const command = { phoneTestAction: "start_now", code, authorizeCalls: true };
  expect((await post({ ...command, code: "wrong" })).status).toBe(403);
  expect((await post({ ...command, authorizeCalls: false })).status).toBe(400);
  expect((await post(command)).status).toBe(503);
  process.env.VOICE_FUNCTION_NAME = "fictional-voice-worker";
  vi.mocked(wakeVoiceWorker).mockImplementationOnce(async () => {
    expect((await getStore().read(tenant)).phoneTest?.armedAt).toBeTruthy();
    return "scheduled_retry";
  });
  const response = await post(command);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    dispatch: "scheduled_retry",
  });
  expect((await post(command)).status).toBe(409);
  expect(wakeVoiceWorker).toHaveBeenCalledTimes(1);
  expect((await getStore().read(tenant)).calls).toEqual([]);
  await post({ phoneTestAction: "stop", code });
});
it("does not publish current or historic transcripts or AWS claim identifiers", async () => {
  const tenant = process.env.RELAY_PUBLIC_TEST_TENANT!;
  await getStore().mutate(tenant, undefined, undefined, (s) => ({
    ...s,
    phoneTest: {
      ...s.phoneTest!,
      allocationNumber: "+12025550101",
      allocationToken: "secret-token",
      phoneNumberId: "private-phone-id",
      history: [
        {
          endedAt: new Date().toISOString(),
          shift: s.shifts[0],
          assignmentNames: [],
          calls: [
            {
              id: "old",
              transcript: "private speech",
              contactId: "private-contact",
            } as (typeof s.calls)[number],
          ],
        },
      ],
    },
  }));
  const response = await handleRelayRequest(
    new Request("http://localhost:3008/api/relay/state?phone-test=1"),
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  for (const value of [
    "private speech",
    "private-contact",
    "secret-token",
    "private-phone-id",
    "+12025550101",
  ])
    expect(text).not.toContain(value);
  expect(JSON.parse(text).state.phoneTest.history[0].calls[0].id).toBe("old");
});
