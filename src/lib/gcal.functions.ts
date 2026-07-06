import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getUpcomingGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from "./google-calendar.server";

type GCalEvent = {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  htmlLink?: string;
};

export const getUpcomingCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const result = await getUpcomingGoogleCalendarEvents(30, 50);
      return {
        events: result.events as GCalEvent[],
        configured: result.configured,
        error: result.error,
      };
    } catch (err) {
      return { events: [] as GCalEvent[], configured: true, error: (err as Error).message };
    }
  });

const createEventSchema = z.object({
  title: z.string().min(1),
  startsAt: z.string(),
  endsAt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createEventSchema.parse(input))
  .handler(async ({ data }) => {
    return createGoogleCalendarEvent({
      title: data.title,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      location: data.location,
      description: data.description,
    });
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ eventId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    return deleteGoogleCalendarEvent(data.eventId);
  });

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        eventId: z.string().min(1),
        title: z.string().min(1),
        startsAt: z.string(),
        endsAt: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return updateGoogleCalendarEvent(data.eventId, {
      title: data.title,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      location: data.location,
      description: data.description,
    });
  });
