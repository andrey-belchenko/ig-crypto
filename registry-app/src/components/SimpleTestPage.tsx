const ES = "http://localhost:9200";
const INDEX = "simple_test";

async function createIndex() {
  await fetch(`${ES}/${INDEX}`, { method: "PUT" });
}

async function generateTestData() {
  createIndex();
  for (let i = 0; i < 10; i++) {
    const doc = { id: i, name: `item ${i}` };
    await fetch(`${ES}/${INDEX}/_doc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });
  }
}

function SimpleTestPage() {
  return (
    <div style={{ padding: 16 }}>
      <button onClick={generateTestData}>Generate test data</button>
      {/* <button onClick={generate}>Generate</button> */}
    </div>
  );
}

export default SimpleTestPage;
