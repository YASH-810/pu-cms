import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Event {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  event_type: string;
  event_mode: 'online' | 'offline' | 'hybrid';
  venue: string | null;
  organizer: string | null;
  registration_link: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  registration_deadline_at: string | null;
  max_participants: number | null;
  is_featured: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface EventListResponse {
  events: Event[];
  total: number;
}

export interface CreateEventPayload {
  title: string;
  slug: string;
  event_type: string;
  event_mode: string;
  venue?: string | null;
  organizer?: string | null;
  registration_link?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  start_at: string;
  end_at: string;
  timezone?: string;
  registration_deadline_at?: string | null;
  max_participants?: number | null;
  is_featured?: boolean;
  organization_ids?: string[];
}

export interface UpdateEventPayload {
  title?: string;
  slug?: string;
  event_type?: string;
  event_mode?: string;
  venue?: string | null;
  organizer?: string | null;
  registration_link?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  start_at?: string;
  end_at?: string;
  timezone?: string;
  registration_deadline_at?: string | null;
  max_participants?: number | null;
  is_featured?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);

  listEvents(params: { status?: string; event_type?: string; event_mode?: string; is_featured?: boolean; search?: string; limit?: number; offset?: number } = {}): Observable<EventListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.event_type) httpParams = httpParams.set('event_type', params.event_type);
    if (params.event_mode) httpParams = httpParams.set('event_mode', params.event_mode);
    if (params.is_featured !== undefined) httpParams = httpParams.set('is_featured', String(params.is_featured));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: EventListResponse }>('/api/v1/admin/events', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getEvent(id: string): Observable<Event> {
    return this.http.get<{ data: Event }>(`/api/v1/admin/events/${id}`).pipe(map((res) => res.data));
  }

  createEvent(payload: CreateEventPayload): Observable<Event> {
    return this.http.post<{ data: Event }>('/api/v1/admin/events', payload).pipe(map((res) => res.data));
  }

  updateEvent(id: string, payload: UpdateEventPayload): Observable<Event> {
    return this.http.patch<{ data: Event }>(`/api/v1/admin/events/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Event> {
    return this.http
      .post<{ data: Event }>(`/api/v1/admin/events/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deleteEvent(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/events/${id}`).pipe(map((res) => res.data));
  }

  /** Generate a URL-safe slug from a title */
  slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
