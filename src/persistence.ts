import fs from 'fs';
import path from 'path';

const stateFilePath = path.join(__dirname, '../state.json');

function defaultState() {
  return { positions: [], stats: {}, lastWalletSnapshot: null };
}

function loadPersistedState() {
  if (!fs.existsSync(stateFilePath)) {
    return defaultState();
  }
  const tmpFilePath = `${stateFilePath}.tmp`;
  const content = fs.readFileSync(stateFilePath, 'utf-8');
  return JSON.parse(content);
}

function savePersistedState(state) {
  const tmpFilePath = `${stateFilePath}.tmp`;
  fs.writeFileSync(tmpFilePath, JSON.stringify(state));
  fs.renameSync(tmpFilePath, stateFilePath);
}

export { loadPersistedState, savePersistedState };