import { createHash, randomUUID } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function observationBucket(timestamp = Date.now(), windowMs = 60_000): number {
  return Math.floor(timestamp / windowMs) * windowMs;
}

export function candidateId(mint: string, pairAddress: string, timestamp = Date.now()): string {
  return `cand_${sha256(`solana|${mint}|${pairAddress}|${observationBucket(timestamp)}`).slice(0, 40)}`;
}

export function signalId(candidate: string, strategy: string): string {
  return `sig_${sha256(`${candidate}|${strategy}`).slice(0, 40)}`;
}

export function runId(prefix = 'run'): string {
  return `${prefix}_${randomUUID()}`;
}
