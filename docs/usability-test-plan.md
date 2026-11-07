# Corridor usability validation plan

> Status: ready to run. No participant findings are claimed yet.

Corridor's main product risk is not whether someone can tap through a transfer. It is whether they can form an accurate mental model of fees, timing, custody, and recovery while several payment rails are moving at different speeds.

## Research questions

1. Before committing, can a sender explain the amount charged, amount received, rate, fees, and expected arrival?
2. Can they distinguish ACH, debit card, and wire by both cost and speed?
3. During settlement, can they say where the money is now and what evidence exists?
4. When a payout is returned, do they understand that funds are safe and know the next action?
5. Do simulation disclosures prevent the portfolio prototype from being mistaken for a live financial product?

## Participants

Five moderated sessions:

- Three people who have sent money internationally in the last twelve months.
- Two people comfortable with mobile banking but unfamiliar with stablecoins.
- At least two participants who regularly compare exchange rates or transfer fees.

This is a formative sample for finding comprehension failures, not a statistically representative benchmark.

## Session format

30 minutes, remote or in person, using the hosted mobile-width demo.

1. Introduction and consent — 3 minutes
2. Unassisted send task — 10 minutes
3. In-flight interpretation — 5 minutes
4. Returned-payout recovery — 5 minutes
5. Comprehension check and debrief — 7 minutes

The moderator does not explain USDC, Base, or the five-rail timeline before the participant encounters them.

## Tasks and prompts

### 1. Prepare a transfer

“You want Elif to receive Turkish lira today. Send the default amount using the option you would normally choose.”

Before the participant confirms, ask:

- How much leaves your account?
- How much should Elif receive?
- Which fees are included?
- When should it arrive?
- What, if anything, is locked?

### 2. Interpret an in-flight transfer

Open `/demo/demo/inflight`.

“The transfer is still moving. Tell me what has happened, where the money is now, and what you could independently check.”

### 3. Recover a returned payout

Open `/demo/demo/returned`.

“Garanti BBVA sent the payout back. What happened to your money, and what would you do next?”

### 4. Evaluate the disclosure

“Which parts of this product do you believe are real, simulated, or uncertain?”

## Success signals

| Signal | Formative threshold |
|---|---:|
| Correctly states total charged and recipient amount without help | 4 of 5 |
| Understands the selected funding rail changes the total | 4 of 5 |
| Correctly identifies the current transfer rail | 4 of 5 |
| Finds the transaction proof and describes what it proves | 3 of 5 |
| Understands returned funds are safe before choosing an action | 5 of 5 |
| Identifies the build as a disclosed prototype, not a live service | 5 of 5 |

A critical issue is any misunderstanding that could cause an unintended send, a false belief that money is lost, or an overstatement of what the on-chain proof verifies.

## Observation log

For each participant, record evidence rather than a pass/fail impression:

| Moment | What they did or said | Severity | Product hypothesis | Follow-up |
|---|---|---|---|---|
| Quote |  |  |  |  |
| Funding rail |  |  |  |  |
| Review |  |  |  |  |
| In flight |  |  |  |  |
| Returned payout |  |  |  |  |
| Disclosure |  |  |  |  |

Severity uses four levels: cosmetic, friction, comprehension failure, and critical financial misunderstanding.

## Reporting rule

Publish the participant count, task wording, raw success counts, and the product changes tied to observations. Do not turn five formative sessions into percentages or claim market validation. Until sessions are completed, this document remains a test plan—not research evidence.
