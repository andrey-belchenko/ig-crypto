# Data Flows

This document describes the critical data flows through the marketplace platform. Each flow includes a sequence diagram, a summary of stores touched, sync/async boundaries, and failure handling.

---

## 1. Product Browsing Flow

A buyer opens a product listing page (e.g., from search results or a direct link).

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Browser
    participant CDN
    participant LB as L7 Load Balancer
    participant GW as API Gateway
    participant Cache as Cache Cluster
    participant CatSvc as Catalog Service
    participant DocStore as Document Store
    participant InvSvc as Inventory Service
    participant RecSvc as Recommendation Service
    participant GraphDB as Graph Store

    Browser->>CDN: GET /products/{slug}
    CDN->>CDN: Check edge cache

    alt Cache HIT (page cached at CDN)
        CDN-->>Browser: 200 OK (cached page)
    else Cache MISS
        CDN->>LB: Forward request
        LB->>GW: Route to Catalog Service
        GW->>Cache: GET product:{product_id}

        alt L2 Cache HIT
            Cache-->>GW: Product JSON
        else L2 Cache MISS
            GW->>CatSvc: GetProduct(product_id)
            CatSvc->>DocStore: find({ _id: product_id })
            DocStore-->>CatSvc: Product document
            CatSvc->>Cache: SET product:{product_id} (TTL 5m)
            CatSvc-->>GW: Product response
        end

        par Parallel enrichment
            GW->>InvSvc: GetStock(product_id, variant_ids)
            InvSvc->>Cache: GET stock:{product_id}:{variant_id}
            Cache-->>InvSvc: Stock level (or miss -> DB)
            InvSvc-->>GW: Stock levels
        and
            GW->>RecSvc: GetRecommendations(product_id, user_id)
            RecSvc->>GraphDB: Traverse PURCHASED edges
            GraphDB-->>RecSvc: Related products
            RecSvc-->>GW: Recommendation list
        end

        GW->>GW: Assemble full response
        GW-->>CDN: 200 OK + Cache-Control headers
        CDN->>CDN: Store in edge cache (TTL 30-60s)
        CDN-->>Browser: 200 OK
    end
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| CDN edge cache | Read | Eventual (TTL-based) |
| Cache Cluster (L2) | Read/Write | Eventual (TTL 5 min) |
| Document Store | Read | Strong (primary read) |
| Cache Cluster (stock) | Read | Eventual (TTL 60s) |
| Graph Store | Read | Eventual (batch-updated) |

### Sync vs Async

- Entire flow is **synchronous** from the buyer's perspective.
- Recommendation and inventory lookups are parallelized at the API Gateway to reduce latency.

### Failure Handling

- **CDN failure**: L7 LB routes directly to API Gateway (bypass CDN).
- **Cache miss**: graceful fallback to origin (Document Store).
- **Recommendation service down**: return empty recommendations; product page still renders.
- **Inventory service down**: show "check availability" instead of stock count; do not block page load.

---

## 2. Order Placement Flow

A buyer submits an order from their cart.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Browser
    participant GW as API Gateway
    participant CartSvc as Cart Service
    participant Cache as Cache Cluster
    participant OrderSvc as Order Service
    participant InvSvc as Inventory Service
    participant RelDB as Relational DB
    participant PaySvc as Payment Service
    participant Broker as Message Broker
    participant NotifSvc as Notification Service

    Browser->>GW: POST /orders { cart_id, address_id, payment_method }
    GW->>CartSvc: GetCart(user_id)
    CartSvc->>Cache: GET cart:{user_id}
    Cache-->>CartSvc: Cart items + totals
    CartSvc-->>GW: Cart snapshot

    GW->>OrderSvc: PlaceOrder(cart_snapshot, address, payment_method)

    OrderSvc->>InvSvc: ReserveStock(items[])
    InvSvc->>RelDB: BEGIN TX
    Note over InvSvc,RelDB: SELECT ... FOR UPDATE (pessimistic lock)
    InvSvc->>RelDB: UPDATE stock_levels SET reserved += qty WHERE available >= qty
    RelDB-->>InvSvc: Rows updated

    alt Insufficient stock
        InvSvc->>RelDB: ROLLBACK
        InvSvc-->>OrderSvc: StockError(items_unavailable)
        OrderSvc-->>GW: 409 Conflict (stock unavailable)
        GW-->>Browser: Error: items out of stock
    else Stock reserved
        InvSvc->>RelDB: COMMIT
        InvSvc-->>OrderSvc: ReservationConfirmed(reservation_id)

        OrderSvc->>RelDB: INSERT order (status=pending_payment)
        OrderSvc->>RelDB: INSERT order_items
        OrderSvc->>RelDB: INSERT order_status_log
        RelDB-->>OrderSvc: Order created (order_id)

        OrderSvc->>PaySvc: InitiatePayment(order_id, amount, method)
        PaySvc->>RelDB: INSERT transaction (status=initiated, idempotency_key)
        PaySvc-->>OrderSvc: PaymentInitiated(redirect_url or client_secret)

        OrderSvc->>Broker: Publish order-events (order.created)
        OrderSvc->>CartSvc: ClearCart(user_id)
        CartSvc->>Cache: DEL cart:{user_id}

        OrderSvc-->>GW: 201 Created { order_id, payment_redirect }
        GW-->>Browser: Order confirmation + payment redirect

        Note over Broker,NotifSvc: Async from here
        Broker-->>NotifSvc: Consume order.created
        NotifSvc->>NotifSvc: Send order confirmation email/push
    end
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| Cache Cluster (cart) | Read, Delete | Strong (primary data for cart) |
| Relational DB (inventory) | Read + Write (pessimistic lock) | Strong (serializable for stock) |
| Relational DB (orders) | Write | Strong (ACID) |
| Relational DB (payments) | Write | Strong (ACID) |
| Message Broker | Write (publish) | Durable (ack after replication) |

### Sync vs Async Boundary

- **Synchronous**: everything up to returning 201 to the browser (cart read, stock reservation, order write, payment initiation, cart clear).
- **Asynchronous**: notification dispatch, analytics event processing, search reindex (if stock changed).

### Failure Handling

- **Stock reservation fails**: transaction rolls back, buyer sees specific items that are unavailable.
- **Order DB write fails**: stock reservation is released via compensating transaction.
- **Payment initiation fails**: order marked as `payment_failed`, stock released after configurable timeout (15 min).
- **Broker publish fails**: order is still committed; a recovery worker scans for orders missing events and re-publishes (outbox pattern).
- **Idempotency**: `POST /orders` includes an idempotency key in the request header. Duplicate submissions return the existing order.

---

## 3. Payment Processing Flow

Payment gateway sends a callback after the buyer completes payment.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant PayGW as Payment Gateway
    participant LB as L7 Load Balancer
    participant PaySvc as Payment Service
    participant RelDB as Relational DB
    participant OrderSvc as Order Service
    participant SellerSvc as Seller Service
    participant Broker as Message Broker
    participant NotifSvc as Notification Service
    participant AnalyticsSvc as Analytics

    PayGW->>LB: POST /webhooks/payment { tx_ref, status, signature }
    LB->>PaySvc: Forward callback

    PaySvc->>PaySvc: Verify callback signature
    PaySvc->>RelDB: SELECT transaction WHERE gateway_ref = tx_ref

    alt Already processed (idempotency check)
        PaySvc-->>PayGW: 200 OK (already handled)
    else New callback
        PaySvc->>RelDB: BEGIN TX
        PaySvc->>RelDB: UPDATE transaction SET status = 'completed'
        PaySvc->>RelDB: COMMIT
        PaySvc-->>PayGW: 200 OK

        PaySvc->>Broker: Publish payment-events (payment.completed)

        par Async consumers
            Broker-->>OrderSvc: Consume payment.completed
            OrderSvc->>RelDB: UPDATE order SET status = 'paid'
            OrderSvc->>RelDB: INSERT order_status_log
            OrderSvc->>Broker: Publish order-events (order.paid)
        and
            Broker-->>SellerSvc: Consume payment.completed
            SellerSvc->>RelDB: BEGIN TX
            SellerSvc->>RelDB: UPDATE seller_balances SET pending_balance += amount
            SellerSvc->>RelDB: INSERT payout_ledger (credit)
            SellerSvc->>RelDB: COMMIT
        and
            Broker-->>NotifSvc: Consume payment.completed
            NotifSvc->>NotifSvc: Send payment confirmation to buyer
            NotifSvc->>NotifSvc: Send new order alert to seller
        and
            Broker-->>AnalyticsSvc: Consume payment.completed
            AnalyticsSvc->>AnalyticsSvc: Update real-time GMV dashboard
        end
    end
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| Relational DB (transactions) | Read + Write | Strong (ACID, idempotent) |
| Relational DB (orders) | Write (status update) | Strong (ACID) |
| Relational DB (seller_balances) | Write (balance credit) | Strong (serializable) |
| Relational DB (payout_ledger) | Write (append) | Strong (ACID) |
| Message Broker | Write (publish) + Read (consume) | Durable |
| Time-Series DB | Write (metrics) | Eventual |

### Sync vs Async Boundary

- **Synchronous**: callback receipt -> idempotency check -> transaction status update -> ack to gateway.
- **Asynchronous**: all downstream effects (order status, seller balance, notifications, analytics).

### Failure Handling

- **Duplicate callback**: idempotency check on `gateway_ref` returns 200 without reprocessing.
- **Transaction update fails**: return 500 to gateway; gateway will retry (callbacks are idempotent).
- **Consumer failures**: message stays on broker; consumer retries with exponential backoff. After N failures, routed to dead-letter topic.
- **Seller balance update fails**: isolated from payment acknowledgment. Retry from broker. Ledger reconciliation job runs hourly to detect and fix discrepancies.

---

## 4. Product Listing by Seller

A seller creates or updates a product in their catalog.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant SellerUI as Seller Portal
    participant GW as API Gateway
    participant CatSvc as Catalog Service
    participant DocStore as Document Store
    participant MediaSvc as Media Service
    participant ObjStore as Object Storage
    participant Broker as Message Broker
    participant Indexer as Search Indexer
    participant SearchIdx as Search Index
    participant Cache as Cache Cluster

    SellerUI->>GW: POST /products { title, description, images[], attributes, pricing }
    GW->>CatSvc: CreateProduct(seller_id, product_data)

    CatSvc->>CatSvc: Validate product data (schema, category, pricing rules)
    CatSvc->>DocStore: insertOne(product_document)
    DocStore-->>CatSvc: Inserted { product_id }

    par Image upload (async from product creation)
        CatSvc->>MediaSvc: UploadImages(product_id, images[])
        loop Each image
            MediaSvc->>ObjStore: PUT product-images/{product_id}/original/{filename}
            ObjStore-->>MediaSvc: Stored
            MediaSvc->>Broker: Publish image-processing (resize job)
        end
        MediaSvc-->>CatSvc: Upload acknowledged
    end

    CatSvc->>Broker: Publish catalog-changes (product.created)
    CatSvc-->>GW: 201 Created { product_id }
    GW-->>SellerUI: Product created

    Note over Broker,SearchIdx: Async indexing pipeline
    Broker-->>Indexer: Consume catalog-changes (product.created)
    Indexer->>DocStore: find({ _id: product_id })
    DocStore-->>Indexer: Full product document
    Indexer->>Indexer: Transform to search document
    Indexer->>SearchIdx: Index document (upsert)
    SearchIdx-->>Indexer: Indexed

    Broker-->>Cache: Consume catalog-changes
    Cache->>Cache: DEL product:{product_id}
    Cache->>Cache: DEL catalog:page:* (related pages)
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| Document Store | Write (insert) | Strong (w:majority) |
| Object Storage | Write (PUT) | Durable after ack |
| Message Broker | Write (publish) | Durable |
| Search Index | Write (upsert) | Eventual (1-3s lag) |
| Cache Cluster | Delete (invalidation) | Eventual |

### Sync vs Async Boundary

- **Synchronous**: validation, document store write, return product_id to seller.
- **Asynchronous**: image processing (resize/optimize), search indexing, cache invalidation.

### Failure Handling

- **Validation failure**: 400 error returned to seller with specific field errors.
- **Document store write fails**: 500 error; seller retries. Idempotency key prevents duplicate products.
- **Image upload fails**: product is created without images; seller can retry image upload separately.
- **Search indexing fails**: product is in the catalog but not searchable until indexer retries. Alert fires if indexing lag exceeds 30 seconds.
- **Cache invalidation fails**: stale cache entry expires via TTL (5 min max staleness).

---

## 5. Search Indexing Pipeline

Near-real-time pipeline that keeps the search index in sync with the document store.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant CatSvc as Catalog Service
    participant DocStore as Document Store
    participant CDC as CDC Connector
    participant Broker as Message Broker
    participant Indexer as Search Indexer
    participant SearchIdx as Search Index
    participant Monitor as Index Lag Monitor

    Note over CatSvc,DocStore: Any catalog write triggers CDC
    CatSvc->>DocStore: Write (insert/update/delete)
    DocStore->>CDC: Oplog / Change Stream event

    CDC->>CDC: Transform change event to reindex message
    CDC->>Broker: Publish search-reindex { op, product_id, timestamp }

    Broker-->>Indexer: Consume search-reindex

    alt op = insert or update
        Indexer->>DocStore: find({ _id: product_id })
        DocStore-->>Indexer: Current document
        Indexer->>Indexer: Build search document
        Note over Indexer: Flatten nested attributes,<br/>compute suggest field,<br/>resolve stock status
        Indexer->>SearchIdx: PUT /products/_doc/{product_id}
        SearchIdx-->>Indexer: 200 OK (indexed)
    else op = delete
        Indexer->>SearchIdx: DELETE /products/_doc/{product_id}
        SearchIdx-->>Indexer: 200 OK (deleted)
    end

    Indexer->>Indexer: Commit consumer offset

    Monitor->>Broker: Check consumer lag (search-reindex topic)
    Monitor->>SearchIdx: Check doc count vs Document Store count
    Note over Monitor: Alert if lag > 30s or count drift > 0.1%
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| Document Store (oplog) | Read (CDC stream) | Real-time change stream |
| Message Broker | Write + Read | Durable, ordered per partition |
| Document Store | Read (full document fetch) | Strong (read from primary) |
| Search Index | Write (upsert/delete) | Eventual (refresh interval 1s) |

### Sync vs Async

- Entire pipeline is **asynchronous**. No part of this flow blocks the catalog write.

### Failure Handling

- **CDC connector fails**: connector restarts from last committed oplog position. No data loss.
- **Broker unavailable**: CDC buffers locally; retries. Catalog writes are unaffected.
- **Indexer fails on single document**: retry 3 times with backoff. After 3 failures, send to dead-letter topic. Other documents continue indexing.
- **Search cluster unavailable**: indexer pauses consumption. Messages accumulate in broker (retention: 1 day). Resume when cluster recovers.
- **Index drift detection**: hourly reconciliation job compares document counts and samples random documents for consistency.

---

## 6. Analytics Pipeline

Transforms raw event streams into aggregated metrics and warehouse tables.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Services as All Services
    participant Broker as Message Broker
    participant StreamProc as Stream Processor
    participant TSDB as Time-Series DB
    participant DWLoader as Data Warehouse Loader
    participant DW as Data Warehouse
    participant ObjStore as Object Storage
    participant Dashboard as Dashboards

    Services->>Broker: Publish to analytics-stream<br/>(clickstream, business events)

    par Real-time aggregation
        Broker-->>StreamProc: Consume analytics-stream
        StreamProc->>StreamProc: Tumbling window aggregation<br/>(1m, 5m, 1h windows)
        Note over StreamProc: Aggregate: orders/min, GMV/hour,<br/>active users, conversion rate,<br/>avg order value, top categories
        StreamProc->>TSDB: Write aggregated metrics
        TSDB-->>Dashboard: Query (PromQL)
        Dashboard->>Dashboard: Real-time KPI display
    and Batch warehouse load
        Broker-->>DWLoader: Consume analytics-stream
        DWLoader->>DWLoader: Micro-batch (5 min windows)
        DWLoader->>ObjStore: Write Parquet files to staging/
        DWLoader->>DW: COPY INTO from staging/
        Note over DW: Fact tables: orders, payments,<br/>page_views, searches<br/>Dimension tables: products,<br/>users, sellers, time
    end
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| Message Broker (analytics-stream) | Read (consume) | At-least-once |
| Time-Series DB | Write (aggregated metrics) | Eventual |
| Object Storage (staging) | Write (Parquet files) | Durable |
| Data Warehouse | Write (COPY INTO) | Eventual (5 min lag) |

### Sync vs Async

- Entire pipeline is **asynchronous**. No impact on user-facing latency.

### Failure Handling

- **Stream processor crash**: restarts from last checkpoint. Tumbling windows may produce slightly inaccurate counts for the affected window.
- **TSDB write fails**: stream processor retries with backoff. Dashboard shows gap in metrics.
- **DW loader fails**: micro-batch retried from broker offset. Parquet files are idempotent (overwrite on re-run).
- **Backpressure**: if consumers fall behind, broker retains messages (14-day retention on analytics-stream). Consumers catch up when capacity is available.

---

## 7. Inventory Sync Flow

Seller updates stock levels, triggering cache invalidation and search reindex.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant SellerUI as Seller Portal
    participant GW as API Gateway
    participant InvSvc as Inventory Service
    participant RelDB as Relational DB
    participant Broker as Message Broker
    participant CacheInv as Cache Invalidator
    participant Cache as Cache Cluster
    participant Indexer as Search Indexer
    participant SearchIdx as Search Index
    participant NotifSvc as Notification Service

    SellerUI->>GW: PUT /inventory/{product_id}/{variant_id} { available: 500 }
    GW->>InvSvc: UpdateStock(product_id, variant_id, new_level)

    InvSvc->>RelDB: BEGIN TX
    InvSvc->>RelDB: SELECT current FROM stock_levels WHERE product_id AND variant_id FOR UPDATE
    RelDB-->>InvSvc: Current: { available: 0, reserved: 5 }

    InvSvc->>RelDB: UPDATE stock_levels SET available = 500
    InvSvc->>RelDB: INSERT stock_movements { delta: +500, reason: 'seller_restock' }
    InvSvc->>RelDB: COMMIT
    RelDB-->>InvSvc: Committed

    InvSvc->>Broker: Publish inventory-updates { product_id, variant_id, old: 0, new: 500, in_stock: true }
    InvSvc-->>GW: 200 OK
    GW-->>SellerUI: Stock updated

    Note over Broker: Async consumers

    par Cache invalidation
        Broker-->>CacheInv: Consume inventory-updates
        CacheInv->>Cache: DEL stock:{product_id}:{variant_id}
        CacheInv->>Cache: DEL product:{product_id}
    and Search reindex
        Broker-->>Indexer: Consume inventory-updates
        Indexer->>SearchIdx: Update in_stock field for product
        Note over Indexer: If product went from<br/>out_of_stock -> in_stock,<br/>boost in search ranking
    and Low stock notification (conditional)
        Broker-->>NotifSvc: Consume inventory-updates
        Note over NotifSvc: Only triggers if stock<br/>falls below threshold
    end
```

### Stores Touched

| Store | Operation | Consistency |
|-------|-----------|-------------|
| Relational DB (stock_levels) | Read + Write (pessimistic lock) | Strong (serializable) |
| Relational DB (stock_movements) | Write (append) | Strong (ACID) |
| Message Broker | Write (publish) | Durable |
| Cache Cluster | Delete (invalidation) | Eventual |
| Search Index | Write (partial update) | Eventual (1-3s) |

### Sync vs Async Boundary

- **Synchronous**: stock level update in relational DB, ack to seller.
- **Asynchronous**: cache invalidation, search reindex, low-stock notifications.

### Failure Handling

- **DB write fails**: 500 error to seller; no side effects (transaction rolled back).
- **Broker publish fails**: stock is updated but event is lost. Outbox pattern (poll `stock_movements` table) recovers missed events.
- **Cache invalidation fails**: stale stock shown for up to 60s (TTL). Acceptable for display; actual stock check happens at order placement with pessimistic lock.
- **Search reindex fails**: product may show incorrect availability in search results. Self-heals when indexer retries or reconciliation job runs.

---

## 8. Data Flow Summary Matrix

| Flow | Sync Stores | Async Stores | Latency Budget | Consistency Model |
|------|-------------|-------------|----------------|-------------------|
| Product Browsing | Cache, Document Store, Graph Store | -- | < 150ms (cache hit), < 500ms (miss) | Eventual (cached) |
| Order Placement | Cache (cart), Relational DB (orders, inventory, payments) | Message Broker, Notification | < 1,000ms | Strong (ACID for writes) |
| Payment Processing | Relational DB (transactions) | Relational DB (orders, balances), Broker, Notification | < 500ms (webhook ack) | Strong + Eventual |
| Product Listing | Document Store | Object Storage, Search Index, Cache | < 2,000ms (with images) | Strong (write) + Eventual (index) |
| Search Indexing | -- | Document Store, Broker, Search Index | 1-3s end-to-end | Eventual |
| Analytics Pipeline | -- | Broker, Time-Series DB, Object Storage, Data Warehouse | Minutes (batch), Seconds (stream) | Eventual |
| Inventory Sync | Relational DB | Cache, Search Index, Broker | < 500ms (ack) | Strong (write) + Eventual (cache/search) |
