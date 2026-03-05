import { BotState } from "./types";
import { defaultState } from "./persistence";

export function createState(): BotState {
  return defaultState();
}
