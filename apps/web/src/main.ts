import { compare, DEMO, type ComparisonInput } from "@enertally/core";
const form = document.querySelector<HTMLFormElement>("#form")!;
const fields = document.querySelector<HTMLDivElement>("#fields")!;
const error = document.querySelector<HTMLParagraphElement>("#error")!;
const results = document.querySelector<HTMLElement>("#results")!;
const exportButton = document.querySelector<HTMLButtonElement>("#export")!;
let exported: object | undefined;
let dataSource = "synthetic-demo";
const definitions = [
  ["quantityMMBtu", "Quantity (MMBtu)", "any"],
  ["fixedShare", "Fixed-price share (0–1)", "any"],
  ["fixedPriceUSDPerMMBtu", "Fixed price (USD/MMBtu)", "any"],
  ["floatingPriceUSDPerMMBtu", "Floating price (USD/MMBtu)", "any"],
] as const;
for (const side of ["baseline", "scenario"] as const) {
  const group = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = side === "baseline" ? "Baseline" : "Scenario";
  group.append(legend);
  for (const [key, title, step] of definitions) {
    const label = document.createElement("label");
    label.textContent = title;
    const input = document.createElement("input");
    input.type = "number"; input.name = `${side}.${key}`; input.id = input.name;
    input.min = "0"; input.step = step; input.required = true;
    if (key === "fixedShare") input.max = "1";
    input.value = String(DEMO[side][key]); label.append(input); group.append(label);
  }
  fields.append(group);
}
function calculate() {
  error.textContent = ""; exported = undefined; exportButton.disabled = true;
  try {
    const input = {} as ComparisonInput;
    for (const side of ["baseline", "scenario"] as const) {
      input[side] = Object.fromEntries(definitions.map(([key]) => {
        const element = form.elements.namedItem(`${side}.${key}`) as HTMLInputElement;
        return [key, element.value.trim() === "" ? NaN : element.valueAsNumber];
      })) as unknown as ComparisonInput[typeof side];
    }
    const result = compare(input);
    exported = { dataSource, ...result };
    const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    results.replaceChildren();
    const caption = document.createElement("p"); caption.textContent = dataSource === "synthetic-demo" ? "Synthetic demo — not market data" : "User-adjusted assumptions — review every input"; results.append(caption);
    for (const [label, value] of [["Baseline cost", result.baselineCostUSD], ["Scenario cost", result.scenarioCostUSD], ["Cost change (scenario − baseline)", result.changeUSD]] as const) {
      const row = document.createElement("p"); row.className = "result-row";
      const name = document.createElement("span"); name.textContent = label;
      const amount = document.createElement("strong"); amount.textContent = money.format(value);
      row.append(name, amount); results.append(row);
    }
    exportButton.disabled = false;
  } catch (cause) {
    results.replaceChildren(); error.textContent = cause instanceof Error ? cause.message : "Invalid inputs";
  }
}
form.addEventListener("submit", event => { event.preventDefault(); calculate(); });
form.addEventListener("input", () => { dataSource = "user-adjusted"; exported = undefined; exportButton.disabled = true; results.textContent = "Inputs changed. Compare costs to update results."; error.textContent = ""; });
document.querySelector("#demo")!.addEventListener("click", () => {
  for (const side of ["baseline", "scenario"] as const) for (const [key] of definitions) (form.elements.namedItem(`${side}.${key}`) as HTMLInputElement).value = String(DEMO[side][key]);
  dataSource = "synthetic-demo"; calculate();
  document.querySelector("#calculator")!.scrollIntoView({ behavior: "smooth" });
});
exportButton.addEventListener("click", () => {
  if (!exported) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2) + "\n"], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "enertally-result.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
calculate();
