import { useSoc } from "@/lib/store";
import type { AccountService } from "./account-service";

export const mockAccountService: AccountService = {
  setAccountType: (type, name) => useSoc.getState().setAccountType(type, name),
  completeOnboarding: () => useSoc.getState().completeOnboarding(),
  resetSession: () => useSoc.getState().reset(),
};
