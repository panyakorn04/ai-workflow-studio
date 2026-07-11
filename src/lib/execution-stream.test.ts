import { describe, expect, test } from "bun:test";
import { parseExecutionSnapshot, reconnectDelay } from "./execution-stream";

const snapshot={execution:{id:"run-1",workflow:"Flow",status:"running",started:"now",duration:"00:01",durationMs:1000,cost:.01},stages:[{executionId:"run-1",position:0,name:"Start",status:"running",detail:"",metadata:{safe:true},updatedAt:"now"}]};
describe("execution stream contract",()=>{
 test("validates a safe execution snapshot",()=>expect(parseExecutionSnapshot(snapshot).stages[0].name).toBe("Start"));
 test("rejects malformed and unknown stage state",()=>expect(()=>parseExecutionSnapshot({...snapshot,stages:[{...snapshot.stages[0],status:"secret"}]})).toThrow());
 test("bounds reconnect backoff",()=>{expect(reconnectDelay(0)).toBe(1000);expect(reconnectDelay(99)).toBe(30000)});
});
