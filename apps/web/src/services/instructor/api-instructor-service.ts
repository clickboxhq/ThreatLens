import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { InstructorService } from "./instructor-service";

export const apiInstructorService: InstructorService = {
  listCohorts: () => {
    throw new NotConnectedError("InstructorService.listCohorts");
  },
};
