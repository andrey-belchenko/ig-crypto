---
name: Highload Marketplace Architecture
overview: Create a set of architecture documents describing a highload on-premises marketplace system, with primary focus on data flows and storage layers.
todos:
  - id: overview
    content: Create 00-overview.md -- system overview with high-level component diagram
    status: completed
  - id: infrastructure
    content: Create 01-infrastructure.md -- on-prem infrastructure (compute, network, storage hardware, observability)
    status: completed
  - id: data-stores
    content: Create 02-data-stores.md -- all data store categories with schemas, sharding, replication details
    status: completed
  - id: data-flows
    content: Create 03-data-flows.md -- critical data flow paths with sequence diagrams
    status: completed
isProject: false
---

# Highload Marketplace Architecture Documentation

## Document Structure

Four markdown files in `arch/`, each with mermaid diagrams:

### 1. `00-overview.md` -- System Overview

- High-level component diagram (mermaid) showing all major subsystems and how they connect
- Marketplace domain breakdown: Buyers, Sellers, Operators
- Key non-functional requirements for a highload system (throughput targets, latency budgets, availability)
- Technology stack summary table (categories, not vendor-locked)

### 2. `01-infrastructure.md` -- On-Prem Infrastructure

- Physical/logical topology diagram (mermaid)
- **Compute layer**: bare-metal vs VMs, container orchestration (Kubernetes), node pools by workload type (stateless API, stateful workers, GPU for ML)
- **Network layer**: load balancers (L4/L7), internal service mesh, DNS, CDN/edge caching, inter-DC connectivity
- **Storage hardware**: SAN/NAS for block storage, NVMe tiers for hot data, HDD tiers for cold/archive, object storage (MinIO-style)
- **Observability**: metrics pipeline (Prometheus-pattern), log aggregation (ELK-pattern), distributed tracing
- Scaling strategy: horizontal pod autoscaling, cluster autoscaling, capacity planning approach

### 3. `02-data-stores.md` -- Data Stores (primary focus)

- Master diagram of all data stores and which services own/read them
- For each store category:
**Relational (PostgreSQL-pattern)**
  - Tables: users, orders, transactions, seller accounts, disputes
  - Sharding strategy (by user_id / seller_id), read replicas, connection pooling
  - Write-ahead log shipping for replication
  **Document Store (MongoDB-pattern)**
  - Collections: product catalog, product variants, reviews, seller storefronts
  - Why document model fits (flexible schemas, nested attributes)
  - Replica sets, sharding by category/seller
  **Search Index (Elasticsearch-pattern)**
  - Indices: products, sellers, orders (for ops)
  - Indexing pipeline from document store, near-real-time sync
  - Cluster topology, shard/replica layout
  **Cache Layers (Redis-pattern)**
  - L1: in-process cache (hot config, session)
  - L2: distributed cache cluster (product pages, search results, user carts)
  - Cache invalidation strategies (TTL, event-driven purge)
  - Redis data structures used: strings, hashes, sorted sets (leaderboards), streams
  **Message Broker (Kafka-pattern)**
  - Topics: order-events, payment-events, inventory-updates, notification-triggers, search-reindex, analytics-stream
  - Partitioning strategy, retention policies, consumer groups
  - Exactly-once vs at-least-once semantics per topic
  **Object/Blob Storage (MinIO-pattern)**
  - Buckets: product-images, seller-documents, invoices, exports
  - Tiering: hot (SSD-backed), warm, cold (tape/archive)
  **Time-Series DB (InfluxDB/VictoriaMetrics-pattern)**
  - Metrics: business KPIs, infrastructure metrics, SLIs
  - Retention and downsampling policies
  **Graph Store (Neo4j-pattern, optional)**
  - Recommendation relationships, fraud detection graphs

### 4. `03-data-flows.md` -- Data Flows (primary focus)

Detailed mermaid sequence/flow diagrams for each critical path:

- **Product Browsing Flow**: CDN -> API Gateway -> Cache -> Search Index -> Document Store -> response assembly
- **Order Placement Flow**: Cart (Redis) -> Order Service -> Inventory check (pessimistic lock) -> Payment initiation -> Event publish -> Order DB write -> Notification
- **Payment Processing Flow**: Payment gateway callback -> idempotency check -> transaction record -> order status update -> seller balance update -> event fan-out
- **Product Listing by Seller**: API -> validation -> Document Store write -> async search reindex event -> image upload to blob -> CDN purge
- **Search Indexing Pipeline**: Change Data Capture from Document Store -> Kafka -> Search Indexer consumer -> Elasticsearch upsert
- **Analytics Pipeline**: Kafka analytics-stream -> Stream processor (Flink-pattern) -> aggregation -> Time-Series DB + Data Warehouse
- **Inventory Sync Flow**: Seller inventory update -> Event -> Stock service -> Cache invalidation -> Search reindex (availability flag)

Each flow will include:

- Mermaid sequence diagram
- Stores touched (read/write)
- Sync vs async boundaries
- Failure/retry semantics

## Guiding Principles

- All diagrams use mermaid (rendered natively in markdown viewers)
- No reference to specific cloud providers (AWS, GCP, Azure)
- Technology choices described by pattern/category, not brand (e.g., "relational DB, PostgreSQL-pattern")
- Focus on data gravity: where data lives, how it moves, what transforms it

