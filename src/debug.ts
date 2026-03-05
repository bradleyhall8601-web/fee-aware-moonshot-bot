import { BotState } from "./types";

export function dumpDebugState(state: BotState): string {
  return JSON.stringify(state, null, 2);
}
