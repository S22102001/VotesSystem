import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const VOTES_TABLE = process.env.VOTES_TABLE || "Votes";
const VOTERS_TABLE = process.env.VOTERS_TABLE || "Voters";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body || {};

    const { pollId, optionId, voterKey } = body;

    if (!pollId || !optionId || !voterKey) {
      return json(400, {
        message: "Missing required fields",
        required: ["pollId", "optionId", "voterKey"],
      });
    }

    const votedAt = new Date().toISOString();

    // Atomic transaction: (1) register voter if not exists + (2) increment vote count
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: VOTERS_TABLE,
              Item: { pollId, voterKey, optionId, votedAt },
              // if this voter already exists for this poll -> transaction fails -> no count increment
              ConditionExpression:
                "attribute_not_exists(pollId) AND attribute_not_exists(voterKey)",
            },
          },
          {
            Update: {
              TableName: VOTES_TABLE,
              Key: { pollId, optionId },
              UpdateExpression:
                "SET #count = if_not_exists(#count, :zero) + :one",
              ExpressionAttributeNames: { "#count": "count" },
              ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
            },
          },
        ],
      })
    );

    return json(200, { message: "Vote recorded successfully" });
  } catch (err) {
    // If someone already voted, DynamoDB transaction will fail with ConditionalCheckFailed
    const msg = err?.name || err?.code || err?.message || String(err);

    // Common AWS SDK v3 error name for failed conditions in transactions:
    if (
      err?.name === "TransactionCanceledException" ||
      String(err?.message || "").includes("ConditionalCheckFailed")
    ) {
      return json(200, { message: "Already voted" });
    }

    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
