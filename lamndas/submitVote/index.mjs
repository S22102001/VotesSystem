import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

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
    const body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body || {});
    const { pollId, optionId, voterKey } = body;

    if (!pollId || !optionId || !voterKey) {
      return json(400, { message: "Missing required fields", required: ["pollId", "optionId", "voterKey"] });
    }

    // 1. checks doubles
    const voterCheck = await ddb.send(new GetCommand({
      TableName: VOTERS_TABLE,
      Key: { pollId, voterKey },
    }));

    if (voterCheck.Item) {
      return json(200, { message: "Already voted" });
    }

    // 2. updates counter on Votes
    await ddb.send(new UpdateCommand({
      TableName: VOTES_TABLE,
      Key: { pollId, optionId },
      UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one",
      ExpressionAttributeNames: { "#count": "count" },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    }));

    // 3. register voter
    await ddb.send(new PutCommand({
      TableName: VOTERS_TABLE,
      Item: { pollId, voterKey, optionId, votedAt: new Date().toISOString() },
      ConditionExpression: "attribute_not_exists(pollId) AND attribute_not_exists(voterKey)"
    }));

    return json(200, { message: "Vote recorded successfully" });
  } catch (err) {
    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
