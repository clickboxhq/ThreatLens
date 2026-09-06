-- Staffing a cohort previously required the person to already have an account: addStaff
-- returned USER_NOT_FOUND for an unknown address. Students became invitable sight-unseen when
-- cohort invitations landed, which left tutors as the only people who had to pre-register —
-- an inconsistency with no reason a user could infer.
--
-- Null keeps the existing behaviour (invited as a student). Set invites them onto the
-- teaching staff in that role.
ALTER TABLE "cohort_invites" ADD COLUMN "staff_role" "CohortStaffRole";
