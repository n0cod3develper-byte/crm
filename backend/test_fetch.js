async function test() {
  try {
    const res = await fetch('http://localhost:4000/api/v1/servicios/beda58c4-fc9a-47f1-97a2-8b0fa1d4b3ab', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'PENDIENTE' })
    });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text);
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}
test();
