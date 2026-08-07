/**
 * Produce the proof artifact: one real, verifiable USDC transfer on Base Sepolia.
 *
 * The case study's central evidentiary claim is that the corridor's settlement leg
 * is real. This script is how that claim gets discharged, reproducibly: anyone can
 * run it, and anyone can check the resulting hash on BaseScan without taking the
 * repo's word for anything.
 *
 *   npm run proof                    # status + what's needed
 *   npm run proof -- --send      # sign and broadcast
 *   npm run proof -- --send --amount 20.00
 *
 * Testnet only. The chain is hard-coded and there is no flag to change it.
 */

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/** Circle's canonical USDC on Base Sepolia: FiatTokenV2_2, 6 decimals. */
const USDC: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_DECIMALS = 6;

const ENV_PATH = resolve(process.cwd(), '.env');
const ARTIFACT_PATH = resolve(process.cwd(), 'proof-artifact.json');

const ERC20 = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Key handling
// ─────────────────────────────────────────────────────────────────────────────

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) out[match[1]] = match[2];
  }
  return out;
}

/**
 * Keys are generated locally, written to `.env`, and never printed or committed.
 * `.env` is gitignored. This is testnet value, but treating a key casually because
 * it is cheap is exactly the habit that later loses a real one.
 */
function ensureKeys(): { senderKey: Hex; treasury: Address } {
  const env = readEnv();
  let senderKey = env.CORRIDOR_SENDER_KEY as Hex | undefined;
  let treasury = env.CORRIDOR_TREASURY_ADDRESS as Address | undefined;
  const created: string[] = [];

  if (!senderKey) {
    senderKey = `0x${randomBytes(32).toString('hex')}` as Hex;
    created.push(`CORRIDOR_SENDER_KEY=${senderKey}`);
  }
  if (!treasury) {
    const treasuryKey = `0x${randomBytes(32).toString('hex')}` as Hex;
    treasury = privateKeyToAccount(treasuryKey).address;
    created.push(`CORRIDOR_TREASURY_KEY=${treasuryKey}`);
    created.push(`CORRIDOR_TREASURY_ADDRESS=${treasury}`);
  }

  if (created.length > 0) {
    const header = existsSync(ENV_PATH) ? '\n' : '# Corridor testnet keys: gitignored, never commit\n';
    appendFileSync(ENV_PATH, `${header}${created.join('\n')}\n`);
    console.log(`  generated ${created.length} value(s) → .env (gitignored)\n`);
  }

  return { senderKey, treasury };
}

// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const amountArg = args[args.indexOf('--amount') + 1];
/** One Circle faucet claim. Deliberately the default; see the note printed below. */
const amountDecimal = args.includes('--amount') && amountArg ? amountArg : '20.00';

async function main(): Promise<void> {
  console.log('\n  corridor · proof artifact');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  chain     Base Sepolia (${baseSepolia.id})`);
  console.log(`  asset     USDC ${USDC}\n`);

  const { senderKey, treasury } = ensureKeys();
  const account = privateKeyToAccount(senderKey);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

  const [gas, usdc] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: USDC,
      abi: ERC20,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  ]);

  const usdcHuman = formatUnits(usdc, USDC_DECIMALS);
  const gasHuman = formatUnits(gas, 18);

  console.log(`  sender    ${account.address}`);
  console.log(`  treasury  ${treasury}`);
  console.log(`  balance   ${usdcHuman} USDC · ${gasHuman} ETH\n`);

  const want = parseUnits(amountDecimal, USDC_DECIMALS);
  const needsUsdc = usdc < want;
  const needsGas = gas === 0n;

  if (needsUsdc || needsGas) {
    console.log('  ⚠  not fundable yet\n');
    if (needsGas) {
      console.log('     Base Sepolia ETH (gas), any of:');
      console.log('       https://www.alchemy.com/faucets/base-sepolia');
      console.log('       https://faucet.quicknode.com/base/sepolia\n');
    }
    if (needsUsdc) {
      console.log(`     Testnet USDC: need ${amountDecimal}, have ${usdcHuman}:`);
      console.log('       https://faucet.circle.com  (Base Sepolia, 20 USDC / 2h / address)\n');
    }
    console.log(`     Fund the sender address above, then:  npm run proof -- --send\n`);
    return;
  }

  if (!shouldSend) {
    console.log(`  ✓  fundable: ${amountDecimal} USDC available`);
    console.log('     Broadcast with:  npm run proof -- --send\n');
    return;
  }

  // ── broadcast ──────────────────────────────────────────────────────────────
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });

  console.log(`  sending ${amountDecimal} USDC → treasury …`);

  const hash = await wallet.sendTransaction({
    to: USDC,
    data: encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [treasury, want] }),
  });

  console.log(`  hash      ${hash}`);
  console.log('  waiting for confirmations …');

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 });

  const artifact = {
    hash,
    status: receipt.status,
    chain: 'base-sepolia',
    chainId: baseSepolia.id,
    asset: 'USDC',
    contract: USDC,
    amount: amountDecimal,
    from: account.address,
    to: treasury,
    blockNumber: receipt.blockNumber.toString(),
    explorer: `https://sepolia.basescan.org/tx/${hash}`,
    producedAt: new Date().toISOString(),
  };
  writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`\n  ✓  ${receipt.status} in block ${receipt.blockNumber}`);
  console.log(`     ${artifact.explorer}`);
  console.log(`     written to proof-artifact.json\n`);
}

main().catch((error: unknown) => {
  console.error('\n  ✗ ', error instanceof Error ? error.message : error, '\n');
  process.exitCode = 1;
});
