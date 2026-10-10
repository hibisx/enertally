document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach(button => {
  button.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(button.nextElementSibling?.textContent ?? ""); button.textContent = "Copied"; }
    catch { button.textContent = "Select the code and copy manually"; }
  });
});
