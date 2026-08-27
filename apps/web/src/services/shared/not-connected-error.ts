/**
 * Thrown by every `Api*Service` method until a real backend is wired up.
 * Never caught-and-silenced — surfacing it loudly is the point: it marks
 * exactly which calls still need a real endpoint behind them.
 */
export class NotConnectedError extends Error {
  constructor(message: string) {
    super(`${message} (no backend connected yet — this call is a stub)`);
    this.name = "NotConnectedError";
  }
}
