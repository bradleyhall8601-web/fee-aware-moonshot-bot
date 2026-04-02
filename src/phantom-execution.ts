export async function simulateExecution(price: number, amount: number) {
  return {
    success: true,
    executedPrice: price,
    amount,
    fee: 0.01,
  };
}

export async function liveExecution(price: number, amount: number) {
  // placeholder for real Jupiter/Phantom integration
  return {
    success: true,
    executedPrice: price,
    amount,
    fee: 0.01,
  };
}
