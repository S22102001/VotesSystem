import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const VOTES_TABLE = process.env.VOTES_TABLE || "Votes";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const pollId = event?.queryStringParameters?.pollId;
    if (!pollId) return json(400, { message: "pollId is required" });

    const res = await ddb.send(new QueryCommand({
      TableName: VOTES_TABLE,
      KeyConditionExpression: "pollId = :p",
      ExpressionAttributeValues: { ":p": pollId },
    }));

    const out = {};
    for (const item of res.Items || []) {
      out[item.optionId] = item.count ?? 0;
    }
    return json(200, out);
  } catch (err) {
    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
