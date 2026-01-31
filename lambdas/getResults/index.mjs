// getResult/index.mjs

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const VOTES_TABLE = process.env.VOTES_TABLE || "Votes";

// CORS headers for browser calls (frontend)
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-admin-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const json = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const method = event?.requestContext?.http?.method;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: "",
      };
    }

    const pollId = event?.queryStringParameters?.pollId;

    if (!pollId) {
      return json(400, { message: "Missing pollId. Use ?pollId=poll1" });
    }

    const res = await ddb.send(
      new QueryCommand({
        TableName: VOTES_TABLE,
        KeyConditionExpression: "pollId = :p",
        ExpressionAttributeValues: { ":p": pollId },
      })
    );

    const items = res.Items || [];

    // If your table stores each option as an item: [{optionId, count}, ...]
    // this mapping is fine.
    const results = items.map((x) => ({
      optionId: x.optionId,
      count: x.count ?? 0,
    }));

    return json(200, { pollId, results });
  } catch (err) {
    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
