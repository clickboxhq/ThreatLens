import { useQueries, useQuery } from "@tanstack/react-query";
import { learningCenterService } from "@/services/learning-center";
import type { CourseDto, LearningPathDto } from "@/types/threatlens-learning";

const keys = {
  courses: ["learning", "courses"] as const,
  path: (pathId: string) => ["learning", "path", pathId] as const,
};

function useCourses() {
  return useQuery({
    queryKey: keys.courses,
    queryFn: () => learningCenterService.listCourses(),
  });
}

/**
 * The courses endpoint only returns each path's scenario count — real per-student progress
 * lives behind GET /learning/paths/:id, one call per path. Fans those out in parallel rather
 * than adding a bulk-progress endpoint the backend doesn't have.
 */
export function useLearningOverview() {
  const coursesQuery = useCourses();
  const courses = coursesQuery.data ?? [];
  const pathIds = courses.flatMap((c) => c.paths.map((p) => p.id));

  const pathQueries = useQueries({
    queries: pathIds.map((id) => ({
      queryKey: keys.path(id),
      queryFn: () => learningCenterService.getPath(id),
      enabled: pathIds.length > 0,
    })),
  });

  const pathsById = new Map<string, LearningPathDto>();
  pathQueries.forEach((q, i) => {
    if (q.data) pathsById.set(pathIds[i], q.data);
  });

  const tracks = courses.map((course) => trackFromCourse(course, pathsById));
  const isPending =
    coursesQuery.isPending || (pathIds.length > 0 && pathQueries.some((q) => q.isPending));

  return { isPending, isError: coursesQuery.isError, courses, tracks };
}

function trackFromCourse(course: CourseDto, pathsById: Map<string, LearningPathDto>) {
  const paths = course.paths
    .map((p) => pathsById.get(p.id))
    .filter((p): p is LearningPathDto => !!p);
  const totalScenarios = paths.reduce((sum, p) => sum + p.totalCount, 0);
  const completedScenarios = paths.reduce((sum, p) => sum + p.completedCount, 0);
  const progress = totalScenarios > 0 ? Math.round((completedScenarios / totalScenarios) * 100) : 0;

  return {
    id: course.id,
    name: course.title,
    pathCount: course.paths.length,
    scenarioCount: course.paths.reduce((sum, p) => sum + p.scenarioCount, 0),
    progress,
    firstPathId: course.paths[0]?.id,
  };
}
