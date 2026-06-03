const gasUrl = "https://script.google.com/macros/s/AKfycbw7aZM1ruYmylYuja1erMXFys8r4gOxSHkSSWYJdmRC2F1iLrQa0CKbJB45fEA4hi1a/exec";

async function run() {
  try {
    console.log("Fetching from GAS:", gasUrl);
    const res = await fetch(gasUrl);
    const text = await res.json();
    console.log("Total rows returned:", text.length);
    if (text.length > 0) {
      console.log("Headers:", text[0]);
      // Print count by category
      const categoriesCount = {};
      // Headers index of Main Category: row[3] is Main Category
      const mainCatIdx = text[0].indexOf("Main Category");
      const subCatIdx = text[0].indexOf("Sub Category");
      const assetNameIdx = text[0].indexOf("Asset Name");
      const idIdx = text[0].indexOf("Asset ID");
      console.log("Main Category index:", mainCatIdx);
      console.log("Sub Category index:", subCatIdx);
      console.log("Asset Name index:", assetNameIdx);
      console.log("Asset ID index:", idIdx);

      text.slice(1).forEach(row => {
        const cat = row[mainCatIdx] || "UNDEFINED";
        const sub = row[subCatIdx] || "UNDEFINED";
        const id = row[idIdx] || "UNDEFINED";
        categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
        if (cat === "Office Assets" || cat === "Electrical Assets") {
          console.log(`- Asset ID: ${id}, Cat: ${cat}, Sub: ${sub}, Name: ${row[assetNameIdx]}`);
        }
      });
      console.log("Counts by category:", categoriesCount);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
