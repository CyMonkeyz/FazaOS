import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createCustomSpreadsheet,
  createDriveFolder,
  listDriveFolders,
} from "./google-drive-sheets.server";

export const getDriveFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ folders: await listDriveFolders() }));
export const addDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        parentId: z.string().nullable().optional(),
      })
      .parse(value),
  )
  .handler(async ({ data }) => createDriveFolder(data.name, data.parentId));
const spreadsheetSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  folderId: z.string().nullable().optional(),
  tabs: z
    .array(
      z.object({
        role: z.enum(["summary", "sales", "expenses", "products", "stock", "extra"]),
        name: z.string().trim().min(1).max(80),
        columns: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
      }),
    )
    .min(1)
    .max(12),
});
export const createBusinessSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => spreadsheetSchema.parse(value))
  .handler(async ({ data, context }) => {
    const result = await createCustomSpreadsheet(data);
    const { error } = await (context.supabase as any).from("business_sheet_connections").upsert(
      {
        user_id: context.userId,
        business_id: data.businessId,
        spreadsheet_id: result.spreadsheetId,
        spreadsheet_url: result.spreadsheetUrl,
        folder_id: data.folderId ?? null,
        template_config: { tabs: data.tabs },
        status: "active",
        last_error: null,
      },
      { onConflict: "user_id,business_id" },
    );
    if (error) throw error;
    return result;
  });
