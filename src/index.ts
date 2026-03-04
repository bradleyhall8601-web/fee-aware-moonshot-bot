// Existing content

// Implement scheduler ticks
function runPositionsTick() {
    // logic for positionsTick every 2s
}

function runScannerTick() {
    // logic for scannerTick every 5s
}

function runHealthTick() {
    // logic for healthTick every 10s
}

// Split existing runCycle logic
export function runCycle() {
    // Logic for backward compatibility
}

export function runPositionsTick() {
    // Logic for positions tick
}

export function runScannerTick() {
    // Logic for scanner tick
}

// Set intervals
setInterval(runPositionsTick, 2000);
setInterval(runScannerTick, 5000);
setInterval(runHealthTick, 10000);
// Removed the single interval logic
