async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/assets");
    const data = await res.json();
    console.log("Assets returned by server:", data.length);
    if (data.length > 0) {
      const counts = {};
      data.forEach(item => {
        const cat = item["Main Category"] || item["mainCategory"] || "UNDEFINED";
        counts[cat] = (counts[cat] || 0) + 1;
        console.log(`- ID: ${item["Asset ID"] || item["id"]}, Name: ${item["Asset Name"] || item["assetName"]}, Cat: ${cat}`);
      });
      console.log("Server counts by category:", counts);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
