import type { AccountType } from "@/types/account";

export interface AccountService {
  setAccountType(type: AccountType, name?: string): void;
  completeOnboarding(): void;
  /** Resets the whole demo session back to seed data — used by the reset-session control. */
  resetSession(): void;
}
