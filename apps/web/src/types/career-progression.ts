import type { CareerLevel } from "@/lib/auth-store";

export interface CareerRequirementDto {
  label: string;
  met: boolean;
}

export interface CareerNextLevelDto {
  level: CareerLevel;
  title: string;
  requirements: CareerRequirementDto[];
}

export interface CareerProgressionStatusDto {
  currentLevel: CareerLevel;
  currentTitle: string;
  sessionsScored: number;
  nextLevel: CareerNextLevelDto | null;
}
