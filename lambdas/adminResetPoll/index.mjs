import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.POLLS_TABLE; // Polls
const ADMIN_KEY = process.env.ADMIN_KEY;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:5500",
  "Access-Control-Allow-Headers": "content-type,x-admin-key",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

function getAdminKey(event) {
  return (
    event?.headers?.["x-admin-key"] ||
    event?.headers?.["X-Admin-Key"] ||
    event?.headers?.["X-ADMIN-KEY"] ||
    ""
  );
}

export const handler = async (event) => {
  try {
    // Admin auth
    const provided = getAdminKey(event);
    if (!ADMIN_KEY || provided !== ADMIN_KEY) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const body = event?.body ? JSON.parse(event.body) : {};
    let pollId = body?.pollId;

    // If pollId not provided -> take from CURRENT
    if (!pollId) {
      const cur = await ddb.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { key: "CURRENT" },
        })
      );
      pollId = cur?.Item?.pollId;
    }

    if (!pollId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "CURRENT.pollId not set" }),
      };
    }

    // Ensure poll exists
    const poll = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { key: pollId },
      })
    );

    if (!poll?.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Poll not found", pollId }),
      };
    }

    // Reset results
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { key: pollId },
        UpdateExpression: "SET #r = :r, #resetAt = :t",
        ExpressionAttributeNames: {
          "#r": "results",
          "#resetAt": "resetAt",
        },
        ExpressionAttributeValues: {
          ":r": { optionA: 0, optionB: 0 },
          ":t": now,
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, pollId }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "reset failed", details: String(err) }),
    };
  }
};
