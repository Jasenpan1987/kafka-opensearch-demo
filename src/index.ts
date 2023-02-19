import { Client } from "@opensearch-project/opensearch";
import { KafkaConsumer } from "node-rdkafka";

const OPEN_SEARCH_URL = "http://localhost:9200";
const OPEN_SEARCH_INDEX = "wikimedia-node";
const KAFKA_TOPIC_NAME = "wikimedia.recentchange";

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

async function processMessage(openSearchClient: Client, message?: IMessage) {
  console.log("Message found!  Contents below.", message?.meta);
  if (!message) {
    return;
  }

  const record = await openSearchClient.index({
    id: message.meta.id,
    body: message,
    index: OPEN_SEARCH_INDEX,
    refresh: true
  });

  console.log(record);
}

const aa = {
  $schema: "/mediawiki/recentchange/1.0.0",
  meta: {
    uri: "https://commons.wikimedia.org/wiki/Category:January_2023_in_Bosnia_and_Herzegovina",
    request_id: "88ea7288-0732-4c0d-a2e2-8e528c3dc3cd",
    id: "c8140da6-f4e2-4cc6-a810-246f8b33831d",
    dt: "2023-02-16T14:50:36Z",
    domain: "commons.wikimedia.org",
    stream: "mediawiki.recentchange",
    topic: "eqiad.mediawiki.recentchange",
    partition: 0,
    offset: 4539442699
  },
  id: 2119392811,
  type: "categorize",
  namespace: 14,
  title: "Category:January 2023 in Bosnia and Herzegovina",
  comment: "[[:File:Зеница 20230104 123632.jpg]] removed from category",
  timestamp: 1676559036,
  user: "Ioacc1234red",
  bot: false,
  server_url: "https://commons.wikimedia.org",
  server_name: "commons.wikimedia.org",
  server_script_path: "/w",
  wiki: "commonswiki",
  parsedcomment:
    '<a href="/wiki/File:%D0%97%D0%B5%D0%BD%D0%B8%D1%86%D0%B0_20230104_123632.jpg" title="File:Зеница 20230104 123632.jpg">File:Зеница 20230104 123632.jpg</a> removed from category'
};

async function createKafkaConsumer(openSearchClient: Client) {
  const consumer = new KafkaConsumer(
    {
      "group.id": "jasen-test",
      "bootstrap.servers": "127.0.0.1:9092"
    },
    {
      "auto.offset.reset": "earliest"
      // "enable.auto.commit": false
    }
  );

  consumer.connect();

  consumer
    .on("ready", () => {
      consumer.subscribe([KAFKA_TOPIC_NAME]);
      console.log("good to go");
      setInterval(function () {
        consumer.consume(1);
      }, 1000);
      // consumer.consume();
    })
    .on("data", (data) => {
      if (data?.value) {
        const message = JSON.parse(data?.value?.toString()) as IMessage;
        processMessage(openSearchClient, message);
      }
    })
    .on("event.error", (e) => {
      console.log("event.error", e);
    })
    .on("connection.failure", (e) => {
      console.log("connection.failure", e);
    })
    .on("disconnected", (e) => {
      console.log("disconnected", e);
    })
    .on("offset.commit", (e) => {
      console.log("offset.commit", e);
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
