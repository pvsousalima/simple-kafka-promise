import * as config from 'config';
import { HighLevelProducer } from 'node-rdkafka';

export class KafkaProducer {
  private connected: boolean;
  private readonly producerConfig: any;
  private readonly producer: HighLevelProducer;

  constructor() {
    this.connected = false;

    this.producerConfig = {
      ...(config.get('kafka.producer.config')),
      ...{
        'socket.keepalive.enable': true,
        'request.required.acks': 1, // wait for leader ack
        'dr_cb': true,
      },
    };

    this.producer = new HighLevelProducer(this.producerConfig, {});
  }

  /**
   * Connect the producer to kafka, will return broker's metadata or nothing if already connected.
   */
  connect(): Promise<object | null> {
    return new Promise((resolve, reject) => {
      if (this.producer && this.connected === true) {
        resolve();
      } else {
        this.producer.setValueSerializer((v) => v);
        this.producer.setKeySerializer((v) => v);

        this.producer.on('event.throttle', (throttle) => {
          // TODO expose a function to display event.throttle
        });

        this.producer.on('event.log', (log) => {
          const notDisplay = ['TOPPAR', 'APIVERSION'];

          if (notDisplay.indexOf(log.fac) === -1) {
            // TODO expose a function to display event.log
          }
        });

        this.producer.connect(
          null,
          (err, metadata) => {
            if (err) {
              reject(err);
            } else {
              this.connected = true;
              resolve(metadata);
            }
          },
        );
      }
    });
  }

  /**
   * Poll then disconnect hte producer from Kafka.
   *
   * @return The producer metrics.
   */
  disconnect(): Promise<object> {
    return new Promise((resolve, reject) => {
      this.producer.poll();
      this.producer.disconnect(((err, data) => {
        this.connected = false;

        if (err) {
          // Should not happen
          reject(err);
        } else {
          resolve(data);
        }
      }));
    });
  }

  /**
   * Send a message to Kafka and await ack.
   *
   * @param topic Topic to send message to.
   * If `kafka.producer.topicsPrefix` exist in config, the full topic will be `kafka.producer.topicsPrefix + topic`
   * @param message Message to be sent.
   * @param partition Topic partition.
   * @param key Kafka key to be sent along the message.
   */
  sendMessage(topic: string, message: string, partition: number, key: any): Promise<number> {
    return new Promise((resolve, reject) => {
      const fullTopic = (config.get('kafka.producer.topicsPrefix') ? config.get('kafka.producer.topicsPrefix') : '') + topic;

      this.producer.produce(
        fullTopic,
        partition,
        Buffer.from(JSON.stringify(message)),
        key,
        Date.now(),
        (err, offset) => {
          if (err) {
            reject(err);
          } else {
            resolve(offset);
          }
        });
    });
  }
}