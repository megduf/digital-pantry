import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Ingredient, ParsedReceiptLine } from "../types.js";

const client = new Anthropic();

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const ReceiptLineSchema = z.object({
  raw: z.string().describe("The line's original text, as read off the receipt"),
  name: z.string().describe("Clean, human-readable product name"),
  category: z.string().describe("Best-fit pantry category for this item"),
  qty: z.number().describe("Quantity purchased"),
  unit: z.string().describe("'count' for countable items, or a weight unit like lb/oz/kg/g"),
  weight: z.boolean().describe("True if this item is tracked by weight rather than count"),
  price: z.number().nullable().describe("The line's price in dollars, or null if not legible"),
  notItem: z.boolean().describe("True for non-product lines: subtotal, tax, total, discounts, loyalty card lines"),
  cryptic: z.boolean().describe("True if this is an unclear SKU/code the model could not confidently identify as a specific product"),
});
const ReceiptParseSchema = z.object({ lines: z.array(ReceiptLineSchema) });

const IngredientSchema = z.object({
  name: z.string().describe("Clean ingredient name"),
  quantity: z.number().describe("Numeric quantity; default to 1 if the line has no explicit amount"),
  unit: z.string().describe("Unit of measure (cup, tbsp, lb, clove, ...), or empty string if none"),
});
const RecipeParseSchema = z.object({ ingredients: z.array(IngredientSchema) });

function buildReceiptPrompt(categories: string[]): string {
  return [
    "Read every line item off this grocery receipt photo.",
    "",
    `Known pantry categories: ${categories.join(", ")}.`,
    "Prefer one of these categories; only introduce a new one if genuinely nothing fits.",
    "",
    "For each line on the receipt, output one entry. Rules:",
    "- Lines like SUBTOTAL, TAX, TOTAL, discounts, or loyalty-card savings are not items: set notItem=true and leave the other fields as reasonable defaults.",
    "- If a line is a cryptic SKU or code you can't confidently identify as a specific product, set cryptic=true and make the name something like \"SKU 1234 — unknown item\" so the user knows to substitute the real item.",
    "- unit should be 'count' for anything sold by the each, or a weight unit (lb/oz/kg/g) for anything sold by weight — set weight=true to match.",
    "- price is the line's dollar amount as printed, or null if you can't read it.",
    "- Preserve the raw receipt text for each line in `raw`.",
  ].join("\n");
}

function buildRecipePrompt(rawText: string): string {
  return [
    "Parse the ingredient list below into structured entries.",
    "One entry per ingredient line. If a line has no explicit quantity, use 1. If it has no unit, use an empty string for unit.",
    "Skip lines that are clearly not ingredients (section headers like \"For the sauce:\", blank lines, instructions).",
    "",
    "Ingredients text:",
    rawText,
  ].join("\n");
}

export async function parseReceiptImage(
  base64Image: string,
  mediaType: ImageMediaType,
  categories: string[]
): Promise<ParsedReceiptLine[]> {
  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ReceiptParseSchema),
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
          { type: "text", text: buildReceiptPrompt(categories) },
        ],
      },
    ],
  });
  return response.parsed_output?.lines ?? [];
}

export async function parseRecipeText(rawText: string): Promise<Ingredient[]> {
  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: zodOutputFormat(RecipeParseSchema),
    },
    messages: [{ role: "user", content: buildRecipePrompt(rawText) }],
  });
  return response.parsed_output?.ingredients ?? [];
}
