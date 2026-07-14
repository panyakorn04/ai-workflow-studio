"use client";
import { useEffect, useRef, useState } from "react";
import { type ExecutionSnapshot, parseExecutionSnapshot, reconnectDelay } from "@/lib/execution-stream";

export function useExecutionStream(executionId: string, fallback: ExecutionSnapshot) {
  const [snapshot, setSnapshot] = useState(fallback);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting" | "fallback">("connecting");
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  useEffect(() => {
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempts = 0;
    const connect = () => {
      if (stopped || !executionId) return;
      source = new EventSource(`/api/studio/executions/${encodeURIComponent(executionId)}/events`);
      source.addEventListener("snapshot", (event) => {
        try {
          setSnapshot(parseExecutionSnapshot(JSON.parse((event as MessageEvent).data)));
          attempts = 0;
          setConnection("live");
        } catch {
          setConnection("fallback");
        }
      });
      source.addEventListener("reconnect", () => {
        source?.close();
        if (!stopped) {
          setConnection("reconnecting");
          timer = setTimeout(connect, reconnectDelay(attempts++));
        }
      });
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        setConnection(attempts > 2 ? "fallback" : "reconnecting");
        timer = setTimeout(connect, reconnectDelay(attempts++));
      };
    };
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (timer) clearTimeout(timer);
    };
  }, [executionId]);

  return {
    snapshot: snapshot.execution.id === executionId ? snapshot : fallbackRef.current,
    connection: snapshot.execution.id === executionId ? connection : "connecting",
  };
}
