import { Client } from "@opensearch-project/opensearch";
import type { Message } from "node-rdkafka";
import { KafkaConsumer } from "node-rdkafka";

const OPEN_SEARCH_URL = "http://localhost:9200";
const OPEN_SEARCH_INDEX = "wikimedia-node";
const KAFKA_TOPIC_NAME = "wikimedia.recentchange.nodejs";
const NUM_MSG_PER_BATCH = 5;

interface IMessage {
  $schema: string;
  meta: {
    uri: string;
    request_id: string;
    id: string;
    dt: Date;
    domain: string;
    stream: string;
    topic: string;
    partition: number;
    offset: number;
  };
  id: number;
  type: string;
  namespace: number;
  title: string;
  comment: string;
  timestamp: number;
  user: string;
  bot: boolean;
  server_url: string;
  server_name: string;
  server_script_path: string;
  wiki: string;
  parsedcomment: string;
}

async function createOpenSearchIndex(client: Client) {
  const indexSettings = {
    settings: {
      index: {
        number_of_shards: 1,
        number_of_replicas: 0
      }
    }
  };
  const indexExists = await client.indices.exists({
    index: OPEN_SEARCH_INDEX
  });

  if (indexExists.statusCode !== 404) {
    console.log("Index already exists");
    return;
  }

  const response = await client.indices.create({
    index: OPEN_SEARCH_INDEX,
    body: indexSettings
  });

  if (response.statusCode === 200) {
    console.log("Index created");
  } else {
    console.log("Error ", response);
  }
}

async function processMessageInBatch(openSearchClient: Client, messages?: Message[]) {
  if (!messages || messages.length === 0) {
    return;
  }

  const body: any[] = [];

  return new Promise((resolve, reject) => {
    messages.forEach((message) => {
      const data = JSON.parse(message.value!.toString()) as IMessage;
      body.push({ index: { _index: OPEN_SEARCH_INDEX, _id: data.meta.id } });
      body.push(data);
    });

    openSearchClient.bulk(
      {
        body
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      }
    );
  });
}

async function createKafkaConsumer(openSearchClient: Client) {
  const consumer = new KafkaConsumer(
    {
      "group.id": "jasen-test",
      "bootstrap.servers": "127.0.0.1:9092"
    },
    {
      "auto.offset.reset": "earliest",
      "enable.auto.commit": false
    }
  );

  consumer.connect();

  consumer.on("ready", () => {
    consumer.subscribe([KAFKA_TOPIC_NAME]);
    console.log("good to go");

    setInterval(async function () {
      consumer.consume(NUM_MSG_PER_BATCH, async (err, messages) => {
        if (messages.length === 0) {
          return;
        }

        const result = await processMessageInBatch(openSearchClient, messages);
        console.log("result:: ", messages, result);
        consumer.commitMessage(messages[messages.length - 1]);
      });
    }, 10000);
  });
}

async function main() {
  // create open search client
  const client = new Client({
    node: OPEN_SEARCH_URL
  });

  await createOpenSearchIndex(client);
  // create index on OpenSearch if not exist
  // create Kafka client

  createKafkaConsumer(client);
  // main logic
  // close things

  // await client.close();
}

main();
