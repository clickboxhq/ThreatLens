import type { AccountService } from "./account-service";
import { mockAccountService } from "./mock-account-service";

export const accountService: AccountService = mockAccountService;
export type { AccountService } from "./account-service";
