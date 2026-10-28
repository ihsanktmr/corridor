# Corridor

A stablecoin remittance case study: **USD → USDC → TRY payout**, built to demonstrate product design and integration architecture for consumer fintech.

<p align="center">
  <img src="docs/screens/01-welcome.png" width="150" alt="Welcome: email or passkey, no seed phrase">
  <img src="docs/screens/03-amount.png" width="150" alt="Amount: mid-market rate, rate lock, fee breakdown">
  <img src="docs/screens/04-add-usd.png" width="150" alt="Add USD: speed vs cost, a date not a duration">
  <img src="docs/screens/05-kyc-gate.png" width="150" alt="KYC gate: explain before demanding">
  <img src="docs/screens/07-recipient.png" width="150" alt="Recipient: local IBAN validation, name-match warning">
</p>
<p align="center">
  <img src="docs/screens/08-review.png" width="150" alt="Review: everything open, slide to send">
  <img src="docs/screens/09-in-flight.png" width="150" alt="In flight: five rails, live tx hash">
  <img src="docs/screens/10-receipt.png" width="150" alt="Receipt: verifiable on-chain proof">
  <img src="docs/screens/11a-rate-expired.png" width="150" alt="Rate expired: nothing was sent">
  <img src="docs/screens/11c-payout-returned.png" width="150" alt="Payout returned: your money is safe">
</p>

<p align="center">
  <sub>Welcome · Amount · Add USD · KYC gate · Recipient, then Review · In flight · Receipt · Rate expired · Payout returned<br>
  iPhone 16 Pro, Expo Go. Every figure on screen is computed by the domain layer, not mocked into the view.</sub>
</p>

One corridor, one flow: on-ramp → KYC gate → USDC send → Turkish lira payout. Türkiye wasn't picked as a generic demo pair. It's a genuine high-inflation, high-stablecoin-adoption market, which is what makes the corridor worth designing.

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

Four of the five rails are simulated, and every one is disclosed **on-screen** at the moment it matters. The badge text is read from the provider registry rather than written into the screens, so a screen can't claim a leg is real while a fixture is bound.

| Rail | Status | Why |
|---|---|---|
| Domain logic (money, rates, IBAN, state) | **Real** | `bigint` minor units, rational rates, ISO 7064 mod-97. 49 tests. |
| Design system | **Real** | Ported from the identity spec, unchanged |
| Wallet | Simulated | `@privy-io/expo` needs native modules → a dev build → you couldn't `npx expo start` this |
| USD on-ramp | Simulated | Real Bridge product, but sandbox keys are **not self-serve** |
| TRY payout | Simulated | **Bridge has no TRY route in either direction.** Not a gate, the product isn't sold |
| Identity verification | Real flow, fixture verdict | Sequencing and retry are production-shaped; no documents are captured |

### The proof artifact

The case study's central evidentiary claim is that the settlement leg is real. `scripts/proof.mts` discharges it: a genuine ERC-20 transfer on Base Sepolia, signed locally with `viem`, verifiable by anyone on BaseScan without taking this repo's word for anything.

```bash
npm run proof              # status + funding needed
npm run proof -- --send    # sign and broadcast
```

The chain is hard-coded and there is no flag to change it. Keys are generated into `.env` (gitignored) and never printed. A successful run writes `proof-artifact.json` with the hash, block number and explorer link.

### ✓ Broadcast and verifiable

```
0x551c67045ddfe8e8fb94fdad1ca0b5ffd078d3ca50f167531f0680722a55ba10
```

**[Verify it on BaseScan →](https://sepolia.basescan.org/tx/0x551c67045ddfe8e8fb94fdad1ca0b5ffd078d3ca50f167531f0680722a55ba10)**

| | |
|---|---|
| Status | `success`, block 45038683 |
| Contract | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle's canonical Base Sepolia USDC) |
| Transfer | 1.00 USDC → treasury, 57,359 gas |

Full record in [`proof-artifact.json`](proof-artifact.json). The hash is wired into the receipt screen, which links out to BaseScan.

**On the amount.** The demo figures throughout the app are 500.00 USDC; the on-chain transaction is **1.00 USDC**, capped by Circle's testnet faucet. Same contract, same decimals, same signing path, just a different amount. The receipt screen says so on the screen itself, not just here. A receipt implying a 500.00 settlement over a 1.00 transaction would be exactly the kind of thing this project exists to argue against.

---

## Running it

```bash
npm install
npm start          # then press i for the iOS simulator
```

Runs in Expo Go, no dev build, no native compilation, no credentials. Every rail is simulated by default, so it works offline.

**Jump straight to a screen.** The interesting states sit three or four steps into a flow that takes real time to walk, so each has a deep link:

```
corridor://demo/review      corridor://demo/inflight    corridor://demo/receipt
corridor://demo/expired     corridor://demo/returned    corridor://demo/kyc-resubmit
```

These build the same event log the real timeline produces. No screen special-cases them.

```bash
npm test           # 49 tests: domain, plus the full flow end to end
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
app/          expo-router file routes, the 11 screens
```

### Three decisions that shaped the rest

**Money is never a number.** Minor units as `bigint`, currency-tagged, rates as rationals. The dangerous boundary is USD→USDC (2 decimals against 6, a factor of 10⁴), and `rescale()` refuses to scale down lossily rather than truncating, because silently dropping sub-cent remainders is how a ledger stops balancing.

**Payout is a binding, not a call.** `USD:TRY` and `USD:MXN` differ by one row in `ROUTES`. Bridge covers MXN via SPEI and doesn't cover TRY at all. Discovering that during integration is exactly what the seam is for. `bridge.mxn.spei` is implemented and never called so the abstraction can be seen to be real rather than retrofitted.

**State is a fold over an append-only log.** Three providers with three clocks deliver events late, twice, and out of order. `seq` is assigned on ingress and duplicates are dropped by event identity, not by `seq`, since a vendor retry arrives with a fresh one. Both the state and each step only move forward, so a late webhook can never walk a delivered transfer backwards on screen. Covered by tests.

---

## Status

Phases 1-5 complete: identity → design system → integration architecture → build → packaging.

Typecheck clean, 49/49 tests, iOS bundle succeeds.

Brand faces (Bricolage Grotesque, Inter, IBM Plex Mono) are bundled via `expo-font` and held behind the splash until loaded.

**All eleven screens are verified on an iPhone 16 Pro simulator.** Every image above is that build, and the two not shown (ID capture, KYC resubmit) are in [`docs/screens/`](docs/screens).

## Licence

MIT, see [LICENSE](LICENSE).
