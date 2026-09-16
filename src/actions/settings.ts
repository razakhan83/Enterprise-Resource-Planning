"use server";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface StoreSettingsPayload {
  businessName: string;
  tagline?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  email?: string | null;
  address?: string | null;
  ntnNumber?: string | null;
  strnNumber?: string | null;
  fbrPosIntegrated?: boolean;
  defaultInvoiceFormat?: string;
  invoicePrefixEstimate?: string;
  invoicePrefixTax?: string;
  thermalPaperWidth?: string;
  thermalPrinterHeader?: string | null;
  thermalPrinterFooter?: string;
  defaultWarehouseId?: string | null;
  enableCreditLimitEnforcement?: boolean;
  roundOffThreshold?: string;
}

export async function getStoreSettings() {
  try {
    let settings = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.id, "default"),
    });

    if (!settings) {
      // Auto-initialize if not yet created
      const [inserted] = await db
        .insert(storeSettings)
        .values({
          id: "default",
          businessName: "Trading Co.",
          tagline: "Wholesale & Commercial Supplies",
          phonePrimary: "+92 300 1234567",
          phoneSecondary: "+92 321 7654321",
          email: "info@tradingco.pk",
          address: "Plot #42, Wholesale Commercial Market, Karachi",
          ntnNumber: "7482910-4",
          strnNumber: "32-77-8761-234-91",
          fbrPosIntegrated: false,
          defaultInvoiceFormat: "THERMAL_80MM",
          invoicePrefixEstimate: "EST",
          invoicePrefixTax: "TAX",
          thermalPaperWidth: "80mm",
          thermalPrinterHeader: "TRADING CO. - WHOLESALE MERCHANTS",
          thermalPrinterFooter: "Exchange within 3 days with bill. No cash refund.",
          enableCreditLimitEnforcement: false,
          roundOffThreshold: "5.00",
        })
        .onConflictDoNothing()
        .returning();

      settings = inserted || (await db.query.storeSettings.findFirst({
        where: eq(storeSettings.id, "default"),
      }));
    }

    return { success: true, settings };
  } catch (error: any) {
    console.error("Failed to fetch store settings:", error);
    return { success: false, error: error.message };
  }
}

export async function getSettingsFormData() {
  try {
    const settingsRes = await getStoreSettings();
    const allWarehouses = await db.query.warehouses.findMany({
      orderBy: (w, { asc }) => [asc(w.name)],
    });

    return {
      success: true,
      settings: settingsRes.settings,
      warehouses: allWarehouses,
    };
  } catch (error: any) {
    console.error("Failed to load settings form data:", error);
    return { success: false, error: error.message, settings: null, warehouses: [] };
  }
}

export async function updateStoreSettings(payload: StoreSettingsPayload) {
  try {
    const updated = await db
      .insert(storeSettings)
      .values({
        id: "default",
        ...payload,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: storeSettings.id,
        set: {
          ...payload,
          updatedAt: new Date(),
        },
      })
      .returning();

    revalidatePath("/settings");
    revalidatePath("/billing");
    return { success: true, settings: updated[0] };
  } catch (error: any) {
    console.error("Failed to update store settings:", error);
    return { success: false, error: error.message };
  }
}
