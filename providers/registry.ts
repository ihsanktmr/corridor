/**
 * Provider registry and route table.
 *
 * This is the only file that knows whether a leg is real or simulated. It decides
 * once, at module load. There is no `isMock` branch anywhere above this line: not
 * in the orchestrator, not in a service, not in a screen.
 *
 * Adding a corridor is a row in `ROUTES` plus an adapter. Not a release.
 */

import type { CorridorId } from '../domain/quote.ts';
import type {
  KycProvider,
  OnrampProvider,
  PayoutProvider,
  ProviderId,
  ProviderMeta,
  WalletProvider,
} from './contracts.ts';
import {
  SimulatedBridgePayout,
  SimulatedKyc,
  SimulatedOnramp,
  SimulatedTurkiyePayout,
  SimulatedWallet,
} from './simulated.ts';

export interface RouteBinding {
  readonly onramp: ProviderId;
  readonly settlement: 'base' | 'base-sepolia';
  readonly payout: ProviderId;
}

/**
 * Two corridors, differing by one binding.
 *
 * `USD:MXN` is a genuinely Bridge-native route; SPEI is on Bridge's supported
 * list. `USD:TRY` is not: Bridge publishes USD, EUR, MXN, BRL, GBP and COP, with
 * no TRY in either direction. That asymmetry is why `payout` is a binding rather
 * than a hard-coded vendor call.
 */
export const ROUTES: Record<CorridorId, RouteBinding> = {
  'USD:TRY': {
    onramp: 'bridge.usd.ach',
    settlement: 'base-sepolia',
    payout: 'turkiye.try.bank',
  },
  'USD:MXN': {
    onramp: 'bridge.usd.ach',
    settlement: 'base-sepolia',
    payout: 'bridge.mxn.spei',
  },
};

/** The corridor this build ships. */
export const ACTIVE_CORRIDOR: CorridorId = 'USD:TRY';

/**
 * Every slot is bound to a simulated adapter, because no real one exists yet: each
 * is waiting on a credential this build cannot get (see the disclosures). When one
 * arrives, its adapter replaces the simulated one in its slot here, chosen by
 * whether the key is present, and nothing outside this function changes.
 */
function selectProviders() {
  return {
    onramp: new SimulatedOnramp() as OnrampProvider,
    payouts: {
      'turkiye.try.bank': new SimulatedTurkiyePayout() as PayoutProvider,
      'bridge.mxn.spei': new SimulatedBridgePayout() as PayoutProvider,
    },
    kyc: new SimulatedKyc() as KycProvider,
    wallet: new SimulatedWallet() as WalletProvider,
  };
}

export const providers = selectProviders();

export function payoutFor(corridor: CorridorId): PayoutProvider {
  const binding = ROUTES[corridor];
  const provider = providers.payouts[binding.payout as 'turkiye.try.bank' | 'bridge.mxn.spei'];
  if (!provider.supports(corridor)) {
    throw new Error(`${binding.payout} does not support ${corridor}`);
  }
  return provider;
}

export function onrampFor(_corridor: CorridorId): OnrampProvider {
  return providers.onramp;
}

/**
 * Every provider currently bound, for the disclosure surfaces.
 *
 * Screens read this rather than carrying their own copy, which is what makes the
 * honesty rule structural: a screen cannot claim a leg is real while the registry
 * is running a fixture, because the badge and the adapter are the same source.
 */
export function activeProviders(): readonly ProviderMeta[] {
  return [
    providers.wallet.meta,
    providers.onramp.meta,
    payoutFor(ACTIVE_CORRIDOR).meta,
    providers.kyc.meta,
  ];
}

export function disclosuresFor(ids: readonly ProviderId[]): readonly ProviderMeta[] {
  return activeProviders().filter((m) => ids.includes(m.id) && m.disclosure !== null);
}

export function anySimulated(): boolean {
  return activeProviders().some((m) => m.fidelity !== 'real');
}

/** The persistent strip on screen 02. Derived, never authored. */
export function demoStripLabel(): string {
  const chain = ROUTES[ACTIVE_CORRIDOR].settlement === 'base-sepolia' ? 'Base Sepolia' : 'Base';
  return anySimulated()
    ? `Demo build · ${chain} · fiat rails simulated`
    : `Live · ${chain}`;
}
