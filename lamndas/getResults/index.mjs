import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const VOTES_TABLE = process.env.VOTES_TABLE || "Votes";

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
    const pollId =
      event?.queryStringParameters?.pollId ||
      event?.queryStringParameters?.pollID;

    if (!pollId) {
      return json(400, { message: "Missing pollId" });
    }

    const res = await ddb.send(
      new QueryCommand({
        TableName: VOTES_TABLE,
        KeyConditionExpression: "pollId = :p",
        ExpressionAttributeValues: { ":p": pollId },
      })
    );

    const items = res?.Items || [];

    // return {"optionA":4,"optionB":1}
    const out = {};
    for (const it of items) {
      out[it.optionId] = it.count ?? 0;
    }

    return json(200, out);
  } catch (err) {
    return json(500, { message: "Error", error: err?.message || String(err) });
  }
};
