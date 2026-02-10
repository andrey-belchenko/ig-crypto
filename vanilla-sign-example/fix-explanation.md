# Fix: SignHash Error 0x80070057 in app-async.js

## Problem

The async hash-based signing (`app-async.js`) failed with:

```
Ошибка подписания: The parameter is incorrect. (0x80070057)
```

The non-chunked version (`app.js`) using `SignCades` worked fine but couldn't handle large files because it loaded the entire file into memory.

## Root Cause

The `HashedData` object was created **without explicitly setting the hash algorithm** (`propset_Algorithm`). The `doc-async.txt` example omits this too, but it only works when the default hash algorithm happens to match the certificate's key algorithm.

When using `SignHash`, the hash algorithm of `HashedData` **must match** the certificate's public key algorithm. For example:

| Certificate Key Algorithm | Required Hash Algorithm |
|---|---|
| GOST R 34.10-2012 (256-bit) | GOST R 34.11-2012 (256-bit) |
| GOST R 34.10-2012 (512-bit) | GOST R 34.11-2012 (512-bit) |
| GOST R 34.10-2001 | GOST R 34.11-94 |
| RSA | SHA-256 |

If the default algorithm (e.g. GOST R 34.11-94) doesn't match the certificate (e.g. GOST R 34.10-2012), `SignHash` rejects the parameters with `E_INVALIDARG (0x80070057)`.

In contrast, `SignCades` (used by `app.js`) auto-detects the correct algorithm, which is why it worked without issues.

## What Was Fixed

### 1. Hash algorithm auto-detection from certificate

Added `getHashAlgorithmByOid()` that maps the certificate's public key OID to the correct hash algorithm constant:

```js
function getHashAlgorithmByOid(algorithmOid) {
    if (algorithmOid === "1.2.643.7.1.1.1.1")  // GOST 2012-256
        return cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256;
    if (algorithmOid === "1.2.643.7.1.1.1.2")  // GOST 2012-512
        return cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512;
    if (algorithmOid === "1.2.643.2.2.19")      // GOST 2001
        return cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411;
    return cadesplugin.CADESCOM_HASH_ALGORITHM_SHA_256;  // RSA / other
}
```

### 2. Restructured signing flow

The certificate is now looked up **before** creating `HashedData`, so the algorithm can be detected upfront:

```
Before: Create HashedData → Hash chunks → Find cert → SignHash ❌
After:  Find cert → Detect algorithm → Create HashedData(algorithm) → Hash chunks → SignHash ✅
```

The algorithm is read from the certificate via:
```js
const oPublicKey = yield oCertificate.PublicKey();
const oAlgorithm = yield oPublicKey.Algorithm;
const algorithmOid = yield oAlgorithm.Value;
```

Then set on `HashedData`:
```js
yield oHashedData.propset_Algorithm(hashAlgorithm);
```

### 3. Fixed unyielded async property setter

`propset_ContentEncoding` was called without `yield`. In the nmcades async API, all property setters return Promises. Without `yield`, the property may not be set before `SignHash` executes:

```js
// Before (fire-and-forget, may not complete in time):
oSignedData.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY);

// After (properly awaited):
yield oSignedData.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY);
```

### 4. Reused certificate object across signing steps

Instead of finding the certificate twice (once in outer scope, once in nested `async_spawn`), the `oCertificate` proxy object from the outer scope is reused directly. The cert store stays open until signing completes.
