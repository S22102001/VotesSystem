import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const VOTES_TABLE = process.env.VOTES_TABLE || "Votes";
const VOTERS_TABLE = process.env.VOTERS_TABLE || "Voters";

const json = (statusCode, bodyObj) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(bodyObj),
});

export const handler = async (event) => {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const { pollId, voterKey, optionId } = body;

    if (!pollId || !optionId) {
      return json(400, { message: "Missing pollId or optionId" });
    }

    // 1. prvent double votes
    if (voterKey) {
      try {
        await ddb.send(
          new PutCommand({
            TableName: VOTERS_TABLE,
            Item: {
              pollId,
              voterKey,
              createdAt: new Date().toISOString(),
            },
            ConditionExpression: "attribute_not_exists(pollId) AND attribute_not_exists(voterKey)",
          })
        );
      } catch (err) {
        if (err?.name === "ConditionalCheckFailedException") {
          return json(200, { message: "Already voted" });
        }
        throw err;
      }
    }

    // 2. update votes count
    await ddb.send(
      new UpdateCommand({
        TableName: VOTES_TABLE,
        Key: { pollId, optionId },
        UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one",
        ExpressionAttributeNames: { "#count": "count" },
        ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
      })
    );

    return json(200, { message: "Vote recorded successfully" });
  } catch (err) {
    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
