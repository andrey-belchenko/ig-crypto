import { useState } from "react";
import { Button, Card, InputNumber, Select, Table, Space, message, Spin } from "antd";
import {
  createTestData,
  searchWithFilterAndSort,
  ensureIndex,
  type TestItem,
  type SearchHit,
} from "../api/elasticsearch";

const CATEGORIES = ["electronics", "clothing", "books", "home", "sports"];

function TestPage() {
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [count, setCount] = useState(10);
  const [hits, setHits] = useState<SearchHit<TestItem>[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<"price" | "quantity" | "createdAt" | "name">("price");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleCreateTestData = async () => {
    setLoading(true);
    try {
      await ensureIndex();
      const { indexed, errors } = await createTestData(count);
      if (errors.length > 0) {
        message.warning(`Indexed ${indexed}, errors: ${errors.length}`);
      } else {
        message.success(`Created ${indexed} test documents`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setSearchLoading(true);
    try {
      const result = await searchWithFilterAndSort({
        categoryFilter,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        size: 50,
      });
      setHits(result.hits.hits);
      setTotal(result.hits.total.value);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSearchLoading(false);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "_id", key: "_id", width: 80, ellipsis: true },
    { title: "Name", dataIndex: ["_source", "name"], key: "name" },
    { title: "Category", dataIndex: ["_source", "category"], key: "category" },
    {
      title: "Price",
      dataIndex: ["_source", "price"],
      key: "price",
      render: (v: number) => v?.toFixed(2),
    },
    { title: "Quantity", dataIndex: ["_source", "quantity"], key: "quantity" },
    { title: "Created", dataIndex: ["_source", "createdAt"], key: "createdAt", ellipsis: true },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card title="1. Create test data in Elasticsearch">
          <Space>
            <InputNumber
              min={1}
              max={500}
              value={count}
              onChange={(v) => setCount(v ?? 10)}
              addonBefore="Count"
            />
            <Button type="primary" onClick={handleCreateTestData} loading={loading}>
              Generate test data (loop)
            </Button>
          </Space>
          <p style={{ marginTop: 8, color: "#666" }}>
            Creates documents in a loop with random category, price, quantity.
          </p>
        </Card>

        <Card title="2. Search with filter and sorting">
          <Space wrap>
            <Select
              placeholder="Filter by category"
              allowClear
              style={{ width: 140 }}
              onChange={setCategoryFilter}
              options={CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
            <InputNumber
              placeholder="Min price"
              min={0}
              style={{ width: 100 }}
              onChange={(v) => setMinPrice(v ?? undefined)}
            />
            <InputNumber
              placeholder="Max price"
              min={0}
              style={{ width: 100 }}
              onChange={(v) => setMaxPrice(v ?? undefined)}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 120 }}
              options={[
                { value: "price", label: "Price" },
                { value: "quantity", label: "Quantity" },
                { value: "createdAt", label: "Created" },
                { value: "name", label: "Name" },
              ]}
            />
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: 100 }}
              options={[
                { value: "asc", label: "Asc" },
                { value: "desc", label: "Desc" },
              ]}
            />
            <Button type="primary" onClick={handleSearch} loading={searchLoading}>
              Search
            </Button>
          </Space>
          <p style={{ marginTop: 8, color: "#666" }}>
            Uses Elasticsearch query with bool filter and sort.
          </p>

          <div style={{ marginTop: 16 }}>
            {searchLoading ? (
              <Spin />
            ) : (
              <>
                <p>
                  <strong>Total: {total}</strong>
                </p>
                <Table
                  dataSource={hits}
                  columns={columns}
                  rowKey="_id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              </>
            )}
          </div>
        </Card>
      </Space>
    </div>
  );
}

export default TestPage;
