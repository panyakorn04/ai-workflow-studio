import { describe, expect, test } from "bun:test";
import {
  defaultWorkflowDefinition,
  describeSchedule,
  isValidCronExpression,
  legacyLabelsToDefinition,
  parseWorkflowDefinition,
  validateScheduleConfig,
  workflowLabels,
} from "./workflow-definition";

describe("workflow definition", () => {
  test("creates an n8n-style default with independent schedule and manual roots", () => {
    const definition = defaultWorkflowDefinition();
    expect(definition.nodes.map((node) => node.label)).toEqual([
      "Schedule",
      "Manual Trigger",
      "Read Source",
      "Transform",
      "Publish",
    ]);
    expect(definition.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      "schedule-trigger->read-source",
      "manual-trigger->read-source",
      "read-source->transform",
      "transform->publish",
    ]);
    expect(definition.nodes[0].config).toMatchObject({
      mode: "cron",
      timezone: "Asia/Bangkok",
      cronExpression: "0 12,20 * * *",
    });
  });

  test("migrates legacy labels with a configured schedule trigger", () => {
    const definition = legacyLabelsToDefinition(["Schedule", "Search", "Publish"]);
    expect(definition.version).toBe(1);
    expect(definition.nodes[0]).toMatchObject({ type: "schedule", kind: "trigger", position: { x: 0, y: 0 } });
    expect(definition.nodes[0].config).toMatchObject({ mode: "daily", timezone: "Asia/Bangkok", time: "09:00" });
    expect(definition.edges).toHaveLength(2);
    expect(workflowLabels(definition)).toEqual(["Schedule", "Search", "Publish"]);
  });

  test("rejects duplicate ids and dangling edges", () => {
    const duplicate = legacyLabelsToDefinition(["Schedule", "Search"]);
    duplicate.nodes[1].id = duplicate.nodes[0].id;
    expect(() => parseWorkflowDefinition(duplicate)).toThrow("duplicate node id");

    const dangling = legacyLabelsToDefinition(["Schedule"]);
    dangling.edges.push({ id: "bad", source: "node-0", target: "missing" });
    expect(() => parseWorkflowDefinition(dangling)).toThrow("unknown node");
  });
});

describe("schedule trigger", () => {
  test("validates daily schedule and describes it", () => {
    const config = { enabled: true, mode: "daily", timezone: "Asia/Bangkok", time: "09:00", misfirePolicy: "skip" };
    expect(validateScheduleConfig(config)).toEqual([]);
    expect(describeSchedule(config)).toBe("Every day at 09:00 (Asia/Bangkok)");
    expect(describeSchedule({ ...config, mode: "weekly", daysOfWeek: [1, 2] })).toBe(
      "Weekly on Mon, Tue at 09:00 (Asia/Bangkok)",
    );
  });

  test("validates numeric 5-field cron syntax and ranges", () => {
    expect(isValidCronExpression("0 9 * * *")).toBe(true);
    expect(isValidCronExpression("*/15 8-17 * * 1-5")).toBe(true);
    for (const invalid of [
      "foo bar baz qux quux",
      "60 9 * * *",
      "0 24 * * *",
      "0 9 * 13 *",
      "0 9 * * 7",
      "*/0 * * * *",
    ]) {
      expect(isValidCronExpression(invalid)).toBe(false);
    }
  });

  test("rejects invalid mode-specific parameters", () => {
    expect(
      validateScheduleConfig({
        enabled: true,
        mode: "interval",
        timezone: "Asia/Bangkok",
        intervalMinutes: 0,
        misfirePolicy: "skip",
      }),
    ).toContain("Interval must be between 1 and 43,200 minutes.");
    expect(
      validateScheduleConfig({
        enabled: true,
        mode: "weekly",
        timezone: "Asia/Bangkok",
        time: "09:00",
        daysOfWeek: [],
        misfirePolicy: "skip",
      }),
    ).toContain("Select at least one day.");
    expect(
      validateScheduleConfig({
        enabled: true,
        mode: "daily",
        timezone: "Bad Zone",
        time: "25:00",
        misfirePolicy: "skip",
      }).length,
    ).toBeGreaterThan(0);
  });
});
