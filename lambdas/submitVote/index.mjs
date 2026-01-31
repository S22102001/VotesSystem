import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const VOTES_TABLE = process.env.VOTES_TABLE || "Votes";
const VOTERS_TABLE = process.env.VOTERS_TABLE || "Voters";

// Pepper is a server-side secret (prevents easy hash guessing).
// Put it in Lambda Environment Variables as ID_PEPPER (any random string).
const ID_PEPPER = process.env.ID_PEPPER || "CHANGE_ME";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // CORS (works for Live Server)
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  },
  body: JSON.stringify(body),
});

// Normalize ID: keep digits only, allow 5-9 digits, pad to 9 with leading zeros.
function normalizeIsraeliId(raw) {
  const digits = String(raw ?? "").replace(/\D/g, ""); // digits only
  if (digits.length < 5 || digits.length > 9) return null;
  return digits.padStart(9, "0");
}

// Israeli ID checksum validation (Luhn-like variant).
function isValidIsraeliId(id9) {
  if (!/^\d{9}$/.test(id9)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = Number(id9[i]);
    // Multiply alternating digits by 1,2,1,2...
    let step = digit * ((i % 2) + 1);
    // If > 9, sum digits (or subtract 9)
    if (step > 9) step -= 9;
    sum += step;
  }
  return sum % 10 === 0;
}

// Hash ID into voterKey (we never store the raw ID).
function idToVoterKey(id9) {
  return crypto
    .createHash("sha256")
    .update(`${id9}:${ID_PEPPER}`)
    .digest("hex");
}

export const handler = async (event) => {
  // Handle CORS preflight
  if (event?.requestContext?.http?.method === "OPTIONS") {
    return json(200, { ok: true });
  }

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body || {});
    const { pollId, optionId, idNumber } = body;

    if (!pollId || !optionId || !idNumber) {
      return json(400, { message: "Missing required fields", required: ["pollId", "optionId", "idNumber"] });
    }

    // A1+A2: digits only + 5-9 digits + pad to 9
    const id9 = normalizeIsraeliId(idNumber);
    if (!id9) {
      return json(400, { message: "Invalid ID length. Use 5-9 digits (digits only)." });
    }

    // A3: checksum validation
    if (!isValidIsraeliId(id9)) {
      return json(400, { message: "Invalid Israeli ID (checksum failed)." });
    }

    const voterKey = idToVoterKey(id9); // anonymous voter ID
    const votedAt = new Date().toISOString();

    // ✅ Atomic transaction:
    // 1) register voter ONLY if not exists (prevents double voting even with incognito/refresh)
    // 2) increment the vote count
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: VOTERS_TABLE,
            Item: { pollId, voterKey, optionId, votedAt },
            ConditionExpression: "attribute_not_exists(pollId) AND attribute_not_exists(voterKey)",
          },
        },
        {
          Update: {
            TableName: VOTES_TABLE,
            Key: { pollId, optionId },
            UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one",
            ExpressionAttributeNames: { "#count": "count" },
            ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
          },
        },
      ],
    }));

    return json(200, { message: "Vote recorded successfully" });
  } catch (err) {
    // If voter already exists => block double vote
    if (
      err?.name === "TransactionCanceledException" ||
      String(err?.message || "").includes("ConditionalCheckFailed")
    ) {
      return json(200, { message: "Already voted" });
    }

    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
