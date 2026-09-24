import { SetMetadata } from '@nestjs/common';

export const TRACKS_ACTIVITY_KEY = 'tracksActivity';
// Marks a route as genuine investigation/learning work — the caller doing something, not just
// asking for something. Never applied to reads, notifications, polling, or token refresh; see
// ActivityInterceptor and ActivityTrackingService for how this feeds presence and inactivity
// reminders.
export const TracksActivity = () => SetMetadata(TRACKS_ACTIVITY_KEY, true);
