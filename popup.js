document.addEventListener("DOMContentLoaded", () => {
    const otherCheck = document.getElementById("otherCheck");
    const otherInput = document.getElementById("otherInput");
  
    if (otherCheck && otherInput) {
      otherCheck.addEventListener("change", () => {
        otherInput.disabled = !otherCheck.checked;
        if (!otherCheck.checked) {
          otherInput.value = "";
        }
      });
    }
  
    document.getElementById("export-form").addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const formData = new FormData(e.target);
      const resalePercents = formData.getAll("resale").filter(val => val !== "other").map(val => parseFloat(val));
  
      if (formData.getAll("resale").includes("other")) {
        const custom = parseFloat(document.getElementById("otherInput").value);
        if (!isNaN(custom) && custom > 0 && custom < 100) {
          resalePercents.push(custom);
        }
      }
  
      let filenameInput = formData.get("filename")?.trim() || "";
      if (!filenameInput) filenameInput = "collectr_portfolio";
      filenameInput = filenameInput.replace(/[^a-zA-Z0-9-_ ]/g, "");
      if (!filenameInput.toLowerCase().endsWith(".csv")) filenameInput += ".csv";
  
      const options = {
        name: formData.has("name"),
        price: formData.has("price"),
        quantity: formData.has("quantity"),
        total: formData.has("total"),
        resalePercents,
        filename: filenameInput,
        round: formData.has("round")
      };
  
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [options],
        func: extractAndDownloadCSV
      });
    });
  });
  
  function extractAndDownloadCSV(options) {
    const formatMoney = (val) => options.round ? `$${Math.round(val)}` : `$${val.toFixed(2)}`;
  
    const cards = [...document.querySelectorAll("div.pb-5")];
    const data = [];
    let totalValue = 0;
  
    for (const card of cards) {
      const name = card.querySelector("h3")?.innerText?.trim() || "Unknown";
      const priceText = card.innerText.match(/\$[\d,.]+/)?.[0] || "$0";
      const quantityText = card.innerText.match(/Qty[:\s]*([0-9]+)/i)?.[1] || "1";
  
      const price = parseFloat(priceText.replace(/[$,]/g, ""));
      const quantity = parseInt(quantityText);
      const total = price * quantity;
      totalValue += total;
  
      const resaleValues = {};
      const marketResaleValues = {};
      for (const p of options.resalePercents) {
        resaleValues[p] = total * (p / 100);
        marketResaleValues[p] = price * (p / 100);
      }
  
      data.push({ name, price, quantity, total, resaleValues, marketResaleValues });
    }
  
    const headers = [];
    if (options.name) headers.push("Item Name");
    if (options.price) headers.push("Market Value");
    if (options.quantity) headers.push("Quantity");
    if (options.total) headers.push("Total Value");
    options.resalePercents.forEach(p => {
      headers.push(`${p}% of Market Value`);
      headers.push(`${p}% of Total Value`);
    });
  
    let csv = headers.join(",") + "\n";
  
    data.forEach(item => {
      const row = [];
      if (options.name) row.push(`"${item.name}"`);
      if (options.price) row.push(formatMoney(item.price));
      if (options.quantity) row.push(item.quantity);
      if (options.total) row.push(formatMoney(item.total));
      options.resalePercents.forEach(p => {
        row.push(formatMoney(item.marketResaleValues[p]));
        row.push(formatMoney(item.resaleValues[p]));
      });
      csv += row.join(",") + "\n";
    });
  
    const totalRow = [];
    if (options.name) totalRow.push('"Total:"');
    if (options.price) totalRow.push("");
    if (options.quantity) totalRow.push("");
    if (options.total) totalRow.push(formatMoney(totalValue));
    options.resalePercents.forEach(p => {
      totalRow.push("");
      const resaleSum = data.reduce((sum, item) => sum + item.resaleValues[p], 0);
      totalRow.push(formatMoney(resaleSum));
    });
    csv += totalRow.join(",") + "\n";
  
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = options.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  