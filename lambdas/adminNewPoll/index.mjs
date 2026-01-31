import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// Reuse client between invocations (better performance)
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // CORS (keep this aligned with your API Gateway CORS settings)
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type,x-admin-key",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    body: JSON.stringify(bodyObj),
  };
}

export const handler = async (event) => {
  try {
    // Handle preflight
    if (event?.requestContext?.http?.method === "OPTIONS") {
      return json(200, { ok: true });
    }

    const POLLS_TABLE = process.env.POLLS_TABLE;
    const ADMIN_KEY = process.env.ADMIN_KEY;

    if (!POLLS_TABLE || !ADMIN_KEY) {
      return json(500, { error: "Missing env vars: POLLS_TABLE / ADMIN_KEY" });
    }

    // Admin auth via header
    const adminKey =
      event?.headers?.["x-admin-key"] || event?.headers?.["X-Admin-Key"];

    if (adminKey !== ADMIN_KEY) {
      return json(403, { error: "Forbidden (admin only)" });
    }

    // Create a new pollId
    const pollId = `poll-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Store current poll pointer: key = "CURRENT"
    await ddb.send(
      new PutCommand({
        TableName: POLLS_TABLE,
        Item: {
          key: "CURRENT",
          pollId,
          updatedAt: now,
        },
      })
    );

    return json(200, { message: "New poll created", pollId, updatedAt: now });
  } catch (err) {
    return json(500, { error: "Server error", details: String(err?.message || err) });
  }
};
