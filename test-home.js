
async function test() {
    try {
        const res = await fetch('http://localhost:5174/');
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body length:", text.length);
        console.log("Body start:", text.substring(0, 100));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();