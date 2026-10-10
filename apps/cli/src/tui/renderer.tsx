import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Component, type ReactNode } from "react";
import { safeText } from "../io/json-files";
import { App } from "./app";
class Boundary extends Component<{ children: ReactNode; fail: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.fail(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
export async function start() {
  const renderer = await createCliRenderer({ exitOnCtrlC: false });
  let root: ReturnType<typeof createRoot> | undefined;
  let closed = false;
  const close = (failed = false) => {
    if (closed) return;
    closed = true;
    process.off("SIGTERM", terminate);
    process.off("uncaughtException", failure);
    process.off("unhandledRejection", failure);
    process.exitCode = failed ? 1 : 0;
    try { root?.unmount(); } finally { renderer.destroy(); }
  };
  const terminate = () => close(true);
  const failure = (error: unknown) => { close(true); console.error(safeText(error instanceof Error ? error.message : "Terminal failure")); };
  process.on("SIGTERM", terminate);
  process.on("uncaughtException", failure);
  process.on("unhandledRejection", failure);
  try { root = createRoot(renderer); root.render(<Boundary fail={error => queueMicrotask(() => failure(error))}><App close={() => close()} /></Boundary>); }
  catch (error) { close(true); throw error; }
}
