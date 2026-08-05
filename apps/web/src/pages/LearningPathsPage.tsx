import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { learningApi } from '../api/endpoints';
import type { Course } from '../api/types';

export function LearningPathsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    learningApi
      .listCourses()
      .then(setCourses)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading learning paths...</p>;

  return (
    <div>
      <h1>Learning Paths</h1>
      {courses.map((course) => (
        <div key={course.id} style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 4 }}>{course.title}</h3>
          <p style={{ color: '#64748b', marginTop: 0 }}>{course.description}</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {course.paths.map((path) => (
              <Link
                key={path.id}
                to={`/paths/${path.id}`}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, textDecoration: 'none', color: 'inherit' }}
              >
                <strong>{path.title}</strong>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>{path.scenarioCount} scenarios</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {courses.length === 0 && <p style={{ color: '#64748b' }}>No learning paths published yet.</p>}
    </div>
  );
}
