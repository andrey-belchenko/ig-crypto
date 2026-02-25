import axios from "axios";

import { API_BASE_URL } from "../api/api";

const esUrl = "http://localhost:9200";
const indexName = "documents";

const testData = [
  {
    type: "ЗИС",
    author: "Корсуновский С. А. (тест)",
    internalId: "4321",
    assignedTo: "Иванов",
    comment: "Комментарий",
    browserCreatedAt: new Date("2026-02-20T11:55:39.145Z"),
  },
  {
    type: "СЗИ",
    author: "Петров П. П.",
    internalId: "4322",
    assignedTo: "Сидоров",
    comment: "Проверка данных",
    browserCreatedAt: new Date("2026-02-21T12:10:22.000Z"),
  },
  {
    type: "ЗИС",
    author: "Смирнова Е. В.",
    internalId: "4323",
    assignedTo: "Кузнецов",
    comment: "Тестовый документ",
    browserCreatedAt: new Date("2026-02-22T12:25:15.500Z"),
  },
  {
    type: "КС",
    author: "Волкова О. С.",
    internalId: "4324",
    assignedTo: "Новиков",
    comment: "Дополнительная информация",
    browserCreatedAt: new Date("2026-02-23T12:40:08.200Z"),
  },
  {
    type: "СЗИ",
    author: "Соколов А. Н.",
    internalId: "4325",
    assignedTo: "Попов",
    comment: "Финальная проверка",
    browserCreatedAt: new Date("2026-02-24T12:55:33.800Z"),
  },
];

// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html
const query = {
  query: {
    bool: {
      filter: [{ terms: { "type.keyword": ["СЗИ", "КС"] } }],
    },
  },
  sort: [{ browserCreatedAt: "desc" }],
};

async function resetIndex() {
  await axios.delete(`${esUrl}/${indexName}`).catch(() => {});
  await axios.put(`${esUrl}/${indexName}`);
}

async function generateTestData() {
  await resetIndex();
  for (const doc of testData) {
    await axios.post(`${esUrl}/${indexName}/_doc`, doc);
  }
}

async function queryTestData() {
  const response = await axios.post(`${API_BASE_URL}/documents/search`, query, {
    headers: { "Content-Type": "application/json" },
  });
  console.log(response.data);
}

function SimpleTestPage() {
  return (
    <div style={{ padding: 16 }}>
      <button onClick={generateTestData}>Generate test data</button>
      <button onClick={queryTestData}>Query test data</button>
    </div>
  );
}

export default SimpleTestPage;
