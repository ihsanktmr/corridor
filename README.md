# Corridor

Stablecoin remittance case study — **USD → USDC → TRY payout**, built to demonstrate product design and integration architecture for consumer fintech.

One corridor, one flow: on-ramp → KYC gate → USDC send → Turkish lira payout. Turkey was chosen deliberately rather than as a generic demo pair — it is a genuine high-inflation, high-stablecoin-adoption market, which is what makes the corridor worth designing.

**No money moves here.** See [What's real](#whats-real) before reading anything else.

---

## The documents

| | |
|---|---|
| [**Brand identity**](https://ihsanktmr.github.io/corridor/corridor-identity.html) | Palette, type, tokens, motion signature |
| [**UI/UX screens**](https://ihsanktmr.github.io/corridor/corridor-screens.html) | 11 screens at 1:1, component library, per-screen design and architecture notes |
| [**Integration architecture**](https://ihsanktmr.github.io/corridor/corridor-architecture.html) | Provider audit, trust boundary, contracts, transfer state machine |
| [**Architecture diagram**](https://ihsanktmr.github.io/corridor/corridor-diagram.html) | System and settlement timeline, one page |
| [**Failure modes**](https://ihsanktmr.github.io/corridor/corridor-failure-modes.html) | Full failure register, settlement-risk analysis, known gaps |

If you only read one, read the failure modes.

---

## What's real

Four of the five rails are simulated, and every one is disclosed **on-screen** at the moment it matters — the badge text is read from the provider registry rather than written into the screens, so a screen cannot claim a leg is real while a fixture is bound.

| Rail | Status | Why |
|---|---|---|
| Domain logic — money, rates, IBAN, state | **Real** | `bigint` minor units, rational rates, ISO 7064 mod-97. 42 tests. |
| Design system | **Real** | Ported from the identity spec, unchanged |
| Wallet | Simulated | `@privy-io/expo` needs native modules → a dev build → you couldn't `npx expo start` this |
| USD on-ramp | Simulated | Real Bridge product, but sandbox keys are **not self-serve** |
| TRY payout | Simulated | **Bridge has no TRY route in either direction.** Not a gate — the product isn't sold |
| Identity verification | Real flow, fixture verdict | Sequencing and retry are production-shaped; no documents are captured |

### The honest caveat

The case study's stated proof artifact is one real Base Sepolia USDC transfer with a verifiable hash. **That transfer has not been made yet.** `SimulatedWallet.sendUsdc` returns a fixed hash — it is not on chain and BaseScan will not resolve it. Circle's faucet issues 20 USDC per address per 2 hours against a 500.00 USDC demo figure, so a matching transfer needs about two days of accumulation; sending a smaller amount would make the hash disagree with the receipt and destroy its value as evidence.

It is listed as an open gap rather than quietly omitted, which is the same rule the rest of the project runs on.

---

## Running it

```bash
npm install
npm start          # then press i for the iOS simulator
```

Runs in Expo Go — no dev build, no native compilation, no credentials. Every rail is simulated by default, so it works offline.

```bash
npm test           # 42 domain tests
npm run typecheck  # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
```

**iOS and Android only.** Privy's Expo SDK has no web target, so there is no browser build.

---

## Layout

```
domain/       money · rate · iban · quote · transfer   ← the part worth reading
providers/    contracts · registry · simulated adapters
services/     corridor (the in-process API) · signing
theme/        tokens ported from the identity spec
components/   primitives from the phase 2 library
app/          expo-router file routes — the 11 screens
```

### Three decisions that shaped the rest

**Money is never a number.** Minor units as `bigint`, currency-tagged, rates as rationals. The dangerous boundary is USD→USDC — 2 decimals against 6, a factor of 10⁴ — and `rescale()` refuses to scale down lossily rather than truncating, because silently dropping sub-cent remainders is how a ledger stops balancing.

**Payout is a binding, not a call.** `USD:TRY` and `USD:MXN` differ by one row in `ROUTES`. Bridge covers MXN via SPEI and does not cover TRY at all — discovering that during integration is exactly what the seam is for. `bridge.mxn.spei` is implemented and never called so the abstraction can be seen to be real rather than retrofitted.

**State is a fold over an append-only log.** Three providers with three clocks deliver events late, twice, and out of order. `seq` is assigned on ingress, duplicates are dropped, and steps are monotonic — a late webhook can never walk a completed step backwards on screen. Covered by tests.

---

## Status

Phases 1–5 complete: identity → design system → integration architecture → build → packaging.

Typecheck clean, 42/42 tests, iOS bundle succeeds. Screens 01, 03, 05 and 07 verified on an iPhone 16 Pro simulator; 04, 06, 08–11 are built and typechecked but not yet visually confirmed.

## Licence

MIT — see [LICENSE](LICENSE).
