import { useEffect, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { readInput, writeResult, safeText } from "../io/json-files";
import { Workspace, labels } from "./state/workspace";
import type { ScrollBoxRenderable } from "@opentui/core";
import { METHOD_VERSION } from "@enertally/core";
const commands = ["/demo", "/edit baseline", "/edit scenario", "/compare", "/import", "/export", "/method", "/status", "/help", "/quit"];
type Modal = "import" | "export" | "confirm" | "info" | undefined;
export function App({ close }: { close: () => void }) {
  const [workspace] = useState(() => new Workspace());
  const [, redraw] = useState(0);
  const [focus, setFocus] = useState(8);
  const [fieldKey, setFieldKey] = useState(0);
  const commandRef = useRef("");
  const [command, updateCommand] = useState("");
  const setCommand = (v: string) => { commandRef.current = v; updateCommand(v); };
  const [menu, setMenu] = useState(false);
  const [commandKey, setCommandKey] = useState(0);
  const [selection, setSelection] = useState(0);
  const [modal, setModal] = useState<Modal>();
  const pathRef = useRef("");
  const [path, updatePath] = useState("");
  const setPath = (v: string) => { pathRef.current = v; updatePath(v); };
  const [message, setMessage] = useState("Choose /demo or /import to begin. No files are read automatically.");
  const [info, setInfo] = useState("");
  const pending = useRef(false);
  const cancelled = useRef(false);
  const action = useRef<() => void>(() => {});
  const { width, height } = useTerminalDimensions();
  const scroll = useRef<ScrollBoxRenderable | null>(null);
  useEffect(() => { if (focus < 8) scroll.current?.scrollChildIntoView(`field-${focus}`); }, [focus, width, height, modal, menu]);
  const small = width < 60 || height < 18;
  const fieldStart = useRef<{ index: number; value: string } | undefined>(undefined);
  const choices = commands.filter(c => c.includes(command));
  function refresh() { redraw(v => v + 1); }
  function confirm(fn: () => void, text: string) { action.current = fn; setInfo(text + " Type DISCARD and press Enter, or Esc to cancel."); setPath(""); setModal("confirm"); }
  function execute(value: string) {
    setMenu(false); setCommand(""); setCommandKey(k => k + 1);
    try {
      if (value === "/quit") { if (workspace.dirty) confirm(close, "Unexported inputs will be lost."); else close(); }
      else if (value === "/demo") { const load = () => { workspace.demo(); refresh(); setMessage("SYNTHETIC demo loaded. Compare to calculate."); }; if (workspace.draft.length) confirm(load, "Replace current inputs?"); else load(); }
      else if (value === "/import") { const ask = () => { setPath(""); setModal("import"); }; if (workspace.draft.length) confirm(ask, "Replace current inputs after successful import?"); else ask(); }
      else if (value === "/export") { workspace.snapshot(); setPath(""); setModal("export"); }
      else if (value === "/compare") { workspace.calculate(); refresh(); setMessage("Compared current inputs. Scenario, not forecast."); }
      else if (value.startsWith("/edit ") && ["baseline", "scenario"].includes(value.slice(6))) { if (!workspace.draft.length) throw new Error("Load demo or import first"); const index = value.endsWith("baseline") ? 0 : 4; fieldStart.current = { index, value: workspace.draft[index]! }; setFocus(index); }
      else if (["/help", "/method", "/status"].includes(value)) {
        setInfo(value === "/method" ? `Cost = quantity * [share * fixed price + (1-share) * floating price]. ${METHOD_VERSION}. One month; USD/MMBtu. No tax, transport, FX or derivatives. Fixed procurement is not financial hedging.` : value === "/status" ? `Source: ${workspace.source}; revision ${workspace.revision}; result ${workspace.valid ? "valid" : "needs compare"}; exported revision ${workspace.exportedRevision}. ${METHOD_VERSION}` : commands.join(" | ") + ". Tab/Shift+Tab focus, Ctrl+K menu, Enter submit, Esc cancel, Ctrl+C exit. Export never overwrites."); setModal("info");
      } else throw new Error("Unknown command. Use /help.");
    } catch (error) { setMessage(safeText((error as Error).message)); }
  }
  async function submitPath() {
    if (pending.current) return;
    if (modal === "confirm") { if (pathRef.current === "DISCARD") { setModal(undefined); action.current(); } return; }
    if (modal !== "import" && modal !== "export") return;
    const kind = modal; pending.current = true; cancelled.current = false; refresh();
    try {
      if (kind === "import") { const value = await readInput(pathRef.current); if (!cancelled.current) { workspace.load(value); setMessage("Imported inputs; source declaration is not certification. Compare to calculate."); } else setMessage("Import cancelled; inputs preserved."); }
      else { const revision = workspace.revision; const snapshot = workspace.snapshot(); await writeResult(pathRef.current, snapshot); workspace.exportedRevision = revision; setMessage(`Export complete for revision ${revision}: ${safeText(pathRef.current)}`); }
      setModal(undefined);
    } catch (error) { setMessage(safeText((error as Error).message)); }
    finally { pending.current = false; refresh(); }
  }
  useKeyboard(key => {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      key.preventDefault();
      if (pending.current) { cancelled.current = true; setMessage("Finishing file operation safely..."); return; }
      if (modal) { setModal(undefined); return; }
      if (menu) { setMenu(false); return; }
      if (key.ctrl) execute("/quit");
      else if (fieldStart.current && focus < 8) { workspace.edit(fieldStart.current.index, fieldStart.current.value); setFieldKey(k => k + 1); refresh(); }
      return;
    }
    if (pending.current) { key.preventDefault(); return; }
    if (modal) { if (modal === "info" && key.name === "return") { key.preventDefault(); setModal(undefined); } return; }
    if (key.ctrl && key.name === "k") { key.preventDefault(); setMenu(true); setCommand(""); setSelection(0); return; }
    if (menu && ["up", "down"].includes(key.name)) { key.preventDefault(); setSelection(i => (i + (key.name === "down" ? 1 : -1) + Math.max(choices.length, 1)) % Math.max(choices.length, 1)); return; }
    if (["pageup", "pagedown"].includes(key.name)) { key.preventDefault(); scroll.current?.scrollBy(key.name === "pageup" ? -5 : 5); return; }
    if (key.name === "tab") { key.preventDefault(); const next = workspace.draft.length ? (focus + (key.shift ? 8 : 1)) % 9 : 8; if (next < 8) fieldStart.current = { index: next, value: workspace.draft[next]! }; setFocus(next); }
  });
  const result = workspace.valid ? workspace.result : undefined;
  return <box flexDirection="column" width="100%" height="100%" paddingLeft={1} paddingRight={1}>
    <text height={1} flexShrink={0} fg="#65d9ad">EnerTally | LOCAL | {workspace.draft.length ? workspace.source.toUpperCase() : "EMPTY"}</text>
    <text height={1} flexShrink={0}>Monthly natural gas | USD/MMBtu | scenario, not forecast</text>
    {small && <text height={2} flexShrink={0}>Resize to at least 60 columns x 18 rows. /help and /quit remain available.</text>}<scrollbox ref={scroll} flexGrow={1} minHeight={0} scrollbarOptions={{ visible: false }}>
      {!small && !modal && !menu && workspace.draft.length > 0 && <box flexDirection={width >= 100 ? "row" : "column"}>
        {[0, 1].map(side => <box key={side} flexDirection="column" width={width >= 100 ? "50%" : "100%"}>
          <text fg="#65d9ad">{side === 0 ? "BASELINE" : "SCENARIO"}</text>
          {labels.map((label, field) => { const index = side * 4 + field; return <box id={`field-${index}`} key={index} flexDirection="row" height={1}>
            <text width={27}>{focus === index ? "> " : "  "}{label}</text>
            <input key={`${index}-${fieldKey}`} width={25} value={workspace.draft[index]} focused={focus === index} onInput={v => { workspace.edit(index, safeText(v)); refresh(); }} onSubmit={() => { const next = (index + 1) % 9; if (next < 8) fieldStart.current = { index: next, value: workspace.draft[next]! }; setFocus(next); }} />
          </box>; })}
        </box>)}
      </box>}
      {result && <text>{`Baseline $${result.baselineCostUSD.toFixed(2)} | Scenario $${result.scenarioCostUSD.toFixed(2)} | Change ${result.changeUSD >= 0 ? "+" : ""}$${result.changeUSD.toFixed(2)}`}</text>}
      {workspace.draft.length > 0 && !result && <text>Result unavailable. Run /compare after edits.</text>}
      {modal && <box flexDirection="column"><text>{modal === "info" || modal === "confirm" ? info : `${modal.toUpperCase()} JSON path (existing directory, no symlinks; export never overwrites)`}</text>
        {modal !== "info" && <input key={modal} value={path} focused={!pending.current} onInput={v => setPath(safeText(v))} onSubmit={() => void submitPath()} />}</box>}
      {menu && <text>{choices.map((c, i) => `${i === selection ? ">" : " "} ${c}`).join("\n")}</text>}
    </scrollbox>
    <text height={2} flexShrink={0}>{message}</text>
    {!modal && <input key={commandKey} placeholder="/demo, /import or /help" value={command} focused={menu || focus === 8 || small} onInput={v => { setCommand(safeText(v)); setSelection(0); }} onSubmit={() => execute(menu ? commands.filter(c => c.includes(commandRef.current))[selection] ?? commandRef.current : commandRef.current)} />}
    <text height={1} flexShrink={0}>Tab focus | Ctrl+K commands | Esc cancel | Ctrl+C exit</text>
  </box>;
}
