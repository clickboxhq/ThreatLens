import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { AccountService } from "./account-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`AccountService.${method}`);
};

export const apiAccountService: AccountService = {
  setAccountType: () => notConnected("setAccountType"),
  completeOnboarding: () => notConnected("completeOnboarding"),
  resetSession: () => notConnected("resetSession"),
};
