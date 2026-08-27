import { useSoc } from "@/lib/store";
import { accountService } from "@/services/account";

export function useAccount() {
  const accountType = useSoc((s) => s.accountType);
  const accountName = useSoc((s) => s.accountName);
  const onboardingCompleted = useSoc((s) => s.onboardingCompleted);
  return {
    accountType,
    accountName,
    onboardingCompleted,
    setAccountType: accountService.setAccountType,
    completeOnboarding: accountService.completeOnboarding,
    resetSession: accountService.resetSession,
  };
}
