const url = "https://script.google.com/macros/s/AKfycbzx9evR9-SKfaL1yikQQETzKG0q3maVM1todnXYHYfnuqq_v2yj9SKo1IU4xX4Ss4Q/exec";

async function run() {
  try {
    const res = await fetch(url + "?action=list_users");
    const text = await res.text();
    console.log("GET response:", text.substring(0, 1000));

    const postRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_users" })
    });
    const postText = await postRes.text();
    console.log("POST response:", postText.substring(0, 1000));
  } catch (err) {
    console.error("Error fetching:", err);
  }
}

run();
