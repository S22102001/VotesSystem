import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
  DeleteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const POLLS_TABLE = process.env.POLLS_TABLE;
const VOTES_TABLE = process.env.VOTES_TABLE;
const VOTERS_TABLE = process.env.VOTERS_TABLE;

export const handler = async (event) => {
  try {
    const { pollId } = JSON.parse(event.body);

    if (!pollId) {
      return { statusCode: 400, body: "pollId required" };
    }

    await docClient.send(new DeleteCommand({
      TableName: VOTES_TABLE,
      Key: { pollId, optionId: "optionA" }
    }));

    await docClient.send(new DeleteCommand({
      TableName: VOTES_TABLE,
      Key: { pollId, optionId: "optionB" }
    }));

    let lastKey = undefined;

    do {
      const res = await docClient.send(new QueryCommand({
        TableName: VOTERS_TABLE,
        KeyConditionExpression: "pollId = :p",
        ExpressionAttributeValues: { ":p": pollId },
        ExclusiveStartKey: lastKey
      }));

      if (res.Items && res.Items.length > 0) {
        const deletes = res.Items.map(item => ({
          DeleteRequest: {
            Key: {
              pollId: item.pollId,
              voterKey: item.voterKey
            }
          }
        }));

        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [VOTERS_TABLE]: deletes
          }
        }));
      }

      lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    await docClient.send(new UpdateCommand({
      TableName: POLLS_TABLE,
      Key: { pollId },
      UpdateExpression: "SET results = :r",
      ExpressionAttributeValues: {
        ":r": { optionA: 0, optionB: 0 }
      }
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Poll fully reset" })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Error resetting poll" };
  }
};
