import axios from "axios";

const ES = import.meta.env.DEV ? "/es" : "http://localhost:9200";
const INDEX = "simple_test";

async function resetIndex() {
  await axios.delete(`${ES}/${INDEX}`).catch(() => {});
  await axios.put(`${ES}/${INDEX}`);
}

async function generateTestData() {
  await resetIndex();
  for (let i = 0; i < 10; i++) {
    const doc = { id: i, name: `item ${i}` };
    await axios.post(`${ES}/${INDEX}/_doc`, doc);
  }
}

function SimpleTestPage() {
  return (
    <div style={{ padding: 16 }}>
      <button onClick={generateTestData}>Generate test data</button>
      <button onClick={generateTestData}>Query test data</button>
    </div>
  );
}

export default SimpleTestPage;
