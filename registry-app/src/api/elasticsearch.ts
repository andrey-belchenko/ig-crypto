import axios from "axios";

const ES_BASE_URL = import.meta.env.VITE_ES_BASE_URL || "http://localhost:9200";

const INDEX_NAME = "test_items";

export interface TestItem {
  name: string;
  category: string;
  price: number;
  quantity: number;
  createdAt: string;
}

export interface SearchHit<T> {
  _index: string;
  _id: string;
  _score: number;
  _source: T;
}

export interface SearchResponse<T> {
  took: number;
  hits: {
    total: { value: number };
    hits: SearchHit<T>[];
  };
}

/** Generate test data and bulk-index into Elasticsearch */
export async function createTestData(count: number): Promise<{ indexed: number; errors: string[] }> {
  const categories = ["electronics", "clothing", "books", "home", "sports"];
  const errors: string[] = [];
  let indexed = 0;

  for (let i = 0; i < count; i++) {
    const doc: TestItem = {
      name: `Test Item ${i + 1}`,
      category: categories[i % categories.length],
      price: Math.round((10 + Math.random() * 990) * 100) / 100,
      quantity: Math.floor(Math.random() * 100) + 1,
      createdAt: new Date().toISOString(),
    };

    try {
      await axios.post(`${ES_BASE_URL}/${INDEX_NAME}/_doc`, doc);
      indexed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Item ${i + 1}: ${msg}`);
    }
  }

  return { indexed, errors };
}

/** Search with filter and sorting */
export async function searchWithFilterAndSort(params: {
  categoryFilter?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price" | "quantity" | "createdAt" | "name";
  sortOrder?: "asc" | "desc";
  size?: number;
}): Promise<SearchResponse<TestItem>> {
  const { categoryFilter, minPrice, maxPrice, sortBy = "price", sortOrder = "asc", size = 20 } = params;

  const must: object[] = [];

  if (categoryFilter) {
    must.push({ term: { category: categoryFilter } });
  }
  if (minPrice != null) {
    must.push({ range: { price: { gte: minPrice } } });
  }
  if (maxPrice != null) {
    must.push({ range: { price: { lte: maxPrice } } });
  }

  const query = must.length > 0 ? { bool: { must } } : { match_all: {} };

  const sortField = sortBy === "name" ? "name.keyword" : sortBy;
  const body = {
    query,
    sort: [{ [sortField]: sortOrder }],
    size,
  };

  const response = await axios.post<SearchResponse<TestItem>>(
    `${ES_BASE_URL}/${INDEX_NAME}/_search`,
    body,
    { headers: { "Content-Type": "application/json" } }
  );
  return response.data;
}

/** Ensure index exists (create if not) */
export async function ensureIndex(): Promise<void> {
  try {
    await axios.head(`${ES_BASE_URL}/${INDEX_NAME}`);
  } catch {
    await axios.put(`${ES_BASE_URL}/${INDEX_NAME}`, {
      mappings: {
        properties: {
          name: { type: "text", fields: { keyword: { type: "keyword" } } },
          category: { type: "keyword" },
          price: { type: "float" },
          quantity: { type: "integer" },
          createdAt: { type: "date" },
        },
      },
    });
  }
}
